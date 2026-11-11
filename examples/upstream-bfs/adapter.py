"""Record the unmodified TheAlgorithms BFS using its existing FIFO queue."""

import argparse
import json
from pathlib import Path
from queue import Queue
from unittest.mock import patch

import upstream_bfs


ADJACENCY = {0: [1, 2], 1: [3], 2: [3, 4], 3: [1], 4: [4], 5: [5]}
SPEC = {
    "version": 1,
    "layout": "row",
    "views": [
        {"id": "search-graph", "type": "graph", "source": "/graph"},
        {"id": "frontier", "type": "array", "source": "/frontier"},
    ],
}


class ObservedQueue(Queue):
    def __init__(self, observe):
        super().__init__()
        self.observe = observe
        self.last_vertex = None

    def get(self, block=True, timeout=None):
        self.last_vertex = super().get(block, timeout)
        return self.last_vertex

    def empty(self):
        # BFS checks the queue after initialization and after processing each vertex.
        with self.mutex:
            frontier = tuple(self.queue)
        self.observe(self.last_vertex, frontier)
        return not frontier


def record_bfs(graph, start):
    records = []
    processed = set()
    vertices = list(graph.vertices)
    prior_status = []

    def observe(vertex, queue):
        if vertex is not None:
            processed.add(vertex)
        status = [
            "visited" if node in processed else "queued" if node in queue else "unseen"
            for node in vertices
        ]
        frontier = [str(node) for node in queue]
        if not records:
            records.append({
                "type": "initial", "version": 1,
                "state": {
                    "graph": {
                        "nodes": [{"id": str(node), "status": state} for node, state in zip(vertices, status)],
                        "edges": [
                            {"id": f"{source}:{index}", "source": str(source), "target": str(target)}
                            for source, neighbors in graph.vertices.items()
                            for index, target in enumerate(neighbors)
                        ],
                    },
                    "frontier": frontier,
                },
            })
        else:
            updates = [{"op": "replace", "path": "/frontier", "value": frontier}]
            updates.extend(
                {"op": "replace", "path": f"/graph/nodes/{index}/status", "value": state}
                for index, state in enumerate(status)
                if state != prior_status[index]
            )
            records.append({
                "type": "step", "updates": updates,
                "events": [{"type": "node.visit", "data": {"nodeId": str(vertex)}}],
            })
        prior_status[:] = status

    # Only the queue constructed by this single-threaded example is observed.
    with patch.object(upstream_bfs, "Queue", lambda: ObservedQueue(observe)):
        visited = graph.bfs(start)
    return visited, records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--start", type=int, choices=ADJACENCY, default=0)
    args = parser.parse_args()

    graph = upstream_bfs.Graph()
    graph.vertices = ADJACENCY
    original = graph.bfs(args.start)
    visited, records = record_bfs(graph, args.start)
    if visited != original:
        raise RuntimeError("Recording changed the upstream BFS result")

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "visualization.json").write_text(json.dumps(SPEC, indent=2) + "\n", encoding="utf-8", newline="\n")
    trace = "".join(json.dumps(record, separators=(",", ":")) + "\n" for record in records)
    (args.output / "trace.jsonl").write_text(trace, encoding="utf-8", newline="\n")
    print(json.dumps({"start": args.start, "visited": sorted(visited), "states": len(records)}))


if __name__ == "__main__":
    main()
