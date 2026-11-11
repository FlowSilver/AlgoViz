# Dijkstra trial prompts

Each session received the following initial prompt with its own workspace path and task sentence. The local paths are represented by `<trial directory>`.

## Initial prompt

> Work only in `<trial directory>`. Set your command workdir there. Use system tools normally, but do not read or write other project/workspace directories or publish anything. `<task sentence>` Use the pinned unmodified upstream_dijkstra.py and fixture.json supplied in this directory. Observe its real decrease-key priority queue, including the initial queue and the queue after each settled vertex. Preserve and verify the result of the original algorithm. Use directed adjacency with every vertex present, including the isolated vertex. Produce build.py that regenerates viewer.html and result.json with `original` and `recorded` distance maps (null for unreachable). Include the weighted graph, node status, live queue in pop order, previous and next controls, and seeking. The common checker `node check.mjs .` rebuilds and checks the five frames, graph edges, weights, queue, navigation, and final distances with HTTP requests blocked. For the test contract, use `#step` text `Step N of 4`, accessible button names `Previous` and `Next`, slider name `Seek`, graph attributes `data-node-id`, `data-status` (`queued`, `unseen`, `settled`) and `data-edge-id` matching fixture IDs. Make `data-view-id="weights"` list visible strings such as `S -> A: 5` and `data-view-id="frontier"` list visible strings such as `S: 0` in live pop order, with an empty list at the end. The weights list can be a legend beside the graph. The fixture, oracle and checker are read-only; use the oracle for verification, and generate viewer state from real observations. The supplied checker uses installed Edge; if sandboxing blocks browser launch, run that checker with the normal escalated tool. Run the checker until it passes, then end your turn immediately and report the result and generated/source filenames. Do not anticipate additional features.

Standalone task sentence:

> Build an interactive, fully offline Dijkstra viewer as a standalone app with your own render and timeline logic.

AlgoViz task sentence:

> Build an interactive, fully offline Dijkstra viewer with AlgoViz v0.1.0 supplied under toolkit/. Read toolkit/.agents/skills/algoviz/SKILL.md and use the released spec, trace, and CLI. Treat the toolkit as read-only.

## Follow-up prompt

> In the same trial directory, add a visible view of every vertex's current tentative distance. Show `∞` for undiscovered or unreachable vertices. Keep the graph, weights, frontier, and navigation working. For the checker, add a `data-view-id="distances"` view with visible list items such as `S: 0` and `A: ∞` in fixture vertex order. Keep the fixture, oracle, and checker read-only. Run `node check.mjs . --distances` until it passes, then end your turn immediately and report the result and generated/source filenames.
