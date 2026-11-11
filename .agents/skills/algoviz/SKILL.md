---
name: algoviz
description: Adapt an existing algorithm to AlgoViz by recording observable state and producing a v1 spec, execution trace, and offline replay. Use when a user asks to visualize, replay, or inspect an algorithm with AlgoViz.
---

# Record and replay an algorithm with AlgoViz

Read the [v1 protocol](../../../docs/protocol.md) in the AlgoViz checkout. Use the [existing BFS adaptation](../../../examples/upstream-bfs/README.md) as a reference when choosing observation points.

1. Identify the result the algorithm already returns and the intermediate state the user wants to inspect. Prefer callbacks, iterators, or other existing seams. Add a small observation hook if needed. Capture a baseline result for the same input before changing the observation path.
2. Record the initial state once, then one JSONL `step` per meaningful observation. Group related changes in a single update batch so the graph and frontier always refer to the same step. Use stable string IDs for graph nodes and edges, and preserve the frontier's actual ordering. Keep optional events separate from state updates.
3. Write a v1 JSON spec with Graph or Array views. Bind each view's `source` to the current state using JSON Pointer. Start with the requested views and use `row` or `column` layout.
4. From the AlgoViz checkout, install its dependencies with `npm ci` if needed. Run `npm run algoviz -- validate <spec> <trace>` and resolve any record, update, or binding errors it reports. Run `npm run algoviz -- preview <spec> <trace>` and open the printed file URL.
5. Check that the adapted run returns the baseline result. Compare both rendered views against observations at the initial state and selected later steps, including after stepping backward or seeking.

Report the adapter, spec, trace, and preview locations with the input and checks performed. Only put data the user intends to share in a preview file, which embeds the trace and spec.
