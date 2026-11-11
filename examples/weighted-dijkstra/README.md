# Weighted Dijkstra replay

This example adapts the [pinned Dijkstra implementation](../../benchmarks/dijkstra/upstream_dijkstra.py) and [weighted fixture](../../benchmarks/dijkstra/fixture.json) from the timed comparison. The upstream source keeps its [MIT license](../../benchmarks/dijkstra/LICENSE-upstream.md).

## Open the recorded run

From the AlgoViz checkout with Node.js 22 or later:

```sh
npm ci
npm run algoviz -- validate examples/weighted-dijkstra/visualization.json examples/weighted-dijkstra/trace.jsonl
npm run algoviz -- preview examples/weighted-dijkstra/visualization.json examples/weighted-dijkstra/trace.jsonl
```

Open the printed file URL in a browser. The Graph view displays weights beside their edges. The Frontier shows the live queue in pop order. Tentative distances use `∞` for a vertex that has yet to be reached. Both Array views bind the vertex ID and numeric distance directly from the trace. At step 2, **Changes** shows A's distance falling from `5` to `2` at `/distances/1/distance`. Expand **State** to see the full frame.

## Record the run again

The adapter reads the [benchmark fixture](../../benchmarks/dijkstra/fixture.json). To try another input, change its `source`, `vertices`, or `edges` in your local checkout. Edge weights are nonnegative, and every endpoint must name a listed vertex. The regression tests use the original fixture and expected frames.

Use Python 3.10 or later to regenerate the spec and trace in a separate output directory:

```sh
python -B examples/weighted-dijkstra/adapter.py dijkstra-run
npm run algoviz -- validate dijkstra-run/visualization.json dijkstra-run/trace.jsonl
npm run algoviz -- preview dijkstra-run/visualization.json dijkstra-run/trace.jsonl
```

The [adapter](adapter.py) observes the existing decrease-key queue at the start and after each settled vertex. It derives pop order by draining a copy with the original queue operations. It checks that the original and observed runs agree on distances and predecessors. The browser test regenerates the two inputs and compares edge weights, queue order, and tentative distances with the [five expected frames](../../benchmarks/dijkstra/expected.json) while stepping forward, stepping backward, and seeking with HTTP requests blocked.
