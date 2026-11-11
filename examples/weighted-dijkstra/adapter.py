"""Record the pinned upstream Dijkstra implementation used in the benchmark."""

import argparse
from contextlib import redirect_stdout
from io import StringIO
import json
from pathlib import Path
import sys
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
BENCHMARK = HERE.parents[1] / "benchmarks" / "dijkstra"
sys.path.insert(0, str(BENCHMARK))
import upstream_dijkstra as upstream


UpstreamQueue = upstream.PriorityQueue


class ObservedQueue(UpstreamQueue):
    def __init__(self, observe):
        super().__init__()
        self.observe = observe
        self.last_vertex = None

    def extract_min(self):
        self.last_vertex = super().extract_min()
        return self.last_vertex

    def is_empty(self):
        # The upstream loop checks here before the first pop and after each relaxation pass.
        self.observe(self.last_vertex, self.pop_order())
        return super().is_empty()

    def pop_order(self):
        # Drain a copy using the original heap operations so the live queue is untouched.
        remaining = UpstreamQueue()
        remaining.cur_size = self.cur_size
        remaining.array = self.array[:self.cur_size]
        remaining.pos = self.pos.copy()
        entries = []
        while not remaining.is_empty():
            entries.append(remaining.array[0])
            remaining.extract_min()
        return entries


def build_graph(indices, edges):
    graph = upstream.Graph(len(indices))
    # Supply directed adjacency directly, including an empty list for the isolated vertex.
    graph.adjList = {index: [] for index in indices.values()}
    for edge in edges:
        graph.adjList[indices[edge["source"]]].append((indices[edge["target"]], edge["weight"]))
    return graph


def run(graph, source):
    with redirect_stdout(StringIO()):
        graph.dijkstra(source)


def distances(graph, vertices):
    return dict(zip(vertices, (None if value == sys.maxsize else value for value in graph.dist), strict=True))


def record(fixture):
    vertices = fixture["vertices"]
    edges = fixture["edges"]
    indices = {vertex: index for index, vertex in enumerate(vertices)}
    source = indices[fixture["source"]]
    original = build_graph(indices, edges)
    run(original, source)

    observed = build_graph(indices, edges)
    records = []
    settled = set()
    previous_status = []

    def observe(vertex, entries):
        if vertex is not None:
            settled.add(vertex)
        queued = {index for _, index in entries}
        statuses = [
            "settled" if index in settled else "queued" if index in queued else "unseen"
            for index in range(len(vertices))
        ]
        frontier = [{"vertex": vertices[index], "distance": value} for value, index in entries]
        estimates = [{"vertex": name, "distance": value} for name, value in distances(observed, vertices).items()]
        if vertex is None:
            records.append({
                "type": "initial", "version": 1,
                "state": {
                    "graph": {
                        "nodes": [{"id": name, "status": status} for name, status in zip(vertices, statuses, strict=True)],
                        "edges": [
                            {"id": edge["id"], "source": edge["source"], "target": edge["target"], "label": edge["weight"]}
                            for edge in edges
                        ],
                    },
                    "frontier": frontier,
                    "distances": estimates,
                },
            })
        else:
            updates = [
                {"op": "replace", "path": "/frontier", "value": frontier},
                {"op": "replace", "path": "/distances", "value": estimates},
            ]
            updates.extend(
                {"op": "replace", "path": f"/graph/nodes/{index}/status", "value": status}
                for index, status in enumerate(statuses)
                if status != previous_status[index]
            )
            records.append({
                "type": "step", "updates": updates,
                "events": [{"type": "node.settle", "data": {"nodeId": vertices[vertex]}}],
            })
        previous_status[:] = statuses

    with patch.object(upstream, "PriorityQueue", lambda: ObservedQueue(observe)):
        run(observed, source)
    if observed.dist != original.dist or observed.par != original.par:
        raise RuntimeError("Recording changed the upstream Dijkstra result")

    return records, {"original": distances(original, vertices), "recorded": distances(observed, vertices), "states": len(records)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()

    fixture = json.loads((BENCHMARK / "fixture.json").read_text(encoding="utf-8"))
    records, result = record(fixture)
    spec = (HERE / "visualization.json").read_text(encoding="utf-8")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "visualization.json").write_text(spec, encoding="utf-8", newline="\n")
    trace = "".join(json.dumps(row, separators=(",", ":")) + "\n" for row in records)
    (args.output / "trace.jsonl").write_text(trace, encoding="utf-8", newline="\n")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
