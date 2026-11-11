# BFS viewer pilot

This pilot compares a [standalone viewer](standalone-bfs.js) with AlgoViz on the [same observed BFS run](../examples/upstream-bfs/README.md). The observation data and correctness checks were held fixed. The standalone viewer consumes expanded snapshots and implements its own graph, frontier, and timeline. AlgoViz consumes the v1 spec and trace and uses its existing inspector.

## Results

Both viewers matched the expected graph and ordered frontier at all six steps in Edge with HTTP requests blocked. Both passed backward stepping and seeking. The follow-up change added a third view listing visited vertices. Both viewers showed the expected visited list at every step.

| Measurement | Standalone | AlgoViz |
| --- | --- | --- |
| Viewer-specific source | 87-line HTML generator, including the optional visited view | 16-line spec using existing renderers |
| Base offline HTML | 4,516 bytes | 179,294 bytes |
| Offline HTML with visited view | 4,630 bytes | 179,633 bytes |
| Adding the visited view | Add a panel and filter the existing node statuses in the viewer | Add an Array binding and emit a `/visited` array in each frame |

AlgoViz reused its renderer and timeline code. Its HTML was larger because it included the reusable inspector, replay engine, schema validator, and license notices. The standalone viewer computed the derived list directly from existing state. AlgoViz's v1 bindings needed the list to be materialized by the trace producer.

The source counts exclude observation code and AlgoViz's reusable infrastructure. This was one small run by the same author with the reference snapshots available in both cases. It measured viewer source, output size, and state fidelity. The [multi-algorithm study](../DECISIONS.md#validation-experiment-to-run-early) will measure authoring time, intervention counts, and longer-run behavior.

## Reproduce the two viewers

```sh
npm ci
node benchmarks/standalone-bfs.js examples/upstream-bfs/expected-states.json standalone.html
npm run algoviz -- preview examples/upstream-bfs/visualization.json examples/upstream-bfs/trace.jsonl --output algoviz.html
```

Open both files offline and compare them with [the expected states](../examples/upstream-bfs/expected-states.json). For the follow-up, pass `--visited` to the standalone generator. In a copy of the AlgoViz inputs, add a view with `id: "visited"`, `type: "array"`, and `source: "/visited"`. Set `/visited` in the initial state and replace it at each step with the node IDs whose status is `visited`, in node ID order.
