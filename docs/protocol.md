# AlgoViz protocol v1

The inspector consumes a JSON Visualization Specification and a JSONL Execution Trace for one run. The spec and the trace's initial record both declare `version: 1`. Reject missing, unsupported, or mismatched versions. Encode both files as UTF-8 without a byte order mark. Reject duplicate member names in JSON objects so each binding and update has a single interpretation.

## Visualization Specification

Validate the spec against the [Visualization Specification schema](../schemas/visualization-spec.schema.json). The `views` list determines display order. The `layout` field arranges views left to right (`row`) or top to bottom (`column`). Each view has a unique `id`, a `type`, and a `source` pointer into the state of the current step. The empty pointer binds the whole state.

| View type | Data at `source` |
| --- | --- |
| `graph` | A graph with `nodes` and `edges` arrays. Nodes have stable `id` values and optional `label` and `status` text. Each edge has a stable `id` plus `source` and `target` node IDs. Starting in `v0.2.0`, text and numeric values in `edge.label` appear beside the edge. Other values remain valid graph metadata. [Graph view data schema](../schemas/graph-view-data.schema.json) |
| `array` | A JSON array in display order. For a frontier queue, index `0` holds the next item. Starting in `v0.2.0`, an optional `item` binding displays a label and value for each entry. |

Use unique node IDs and unique edge IDs within a graph. Both endpoints of each edge must resolve to nodes in that graph at the same step. Keep an element's ID stable as its data changes. Resolve and validate every binding at step 0 and after applying all updates in each subsequent step. Each view reads the same committed state.

### Labeled Array items

An Array view's `item.label` and `item.value` are JSON Pointers evaluated against each array entry. The label resolves to a string and the value resolves to any JSON value. Both pointers must resolve in every frame. `item.nullLabel` sets the display text for an explicit `null` value. It defaults to `—`.

```json
{
  "id": "tentative-distances",
  "type": "array",
  "source": "/distances",
  "item": { "label": "/vertex", "value": "/distance", "nullLabel": "∞" }
}
```

The entry `{"vertex":"S","distance":0}` displays `S` with value `0`. The entry `{"vertex":"U","distance":null}` displays `U` with `∞`. Array views without `item` display their entries directly, including the original `v0.1.0` specs.

## Execution Trace

Write one JSON record per line, using LF or CRLF with an optional final newline. Reject empty files and blank lines. Validate each record against the [trace record schema](../schemas/trace-record.schema.json).

| Record | Position | Meaning |
| --- | --- | --- |
| `initial` | First line, exactly once | Holds `version` and the initial `state` object. This is step 0. |
| `step` | Every subsequent line | Holds an `updates` array and optional `events`. Each record advances the step index by one, even when `updates` is empty. |

Apply each `updates` array in order to a candidate state starting from the last committed state. An operation sees the results of earlier operations in its batch. Publish the new state and its events together after every operation and binding check succeeds. On failure, reject the whole step, preserve the previous committed state, and stop at the failed line. Semantic events can inform presentation. Only state updates determine the next state, and replay works when an event type is unknown.

### State updates

Use `add`, `remove`, and `replace` from JSON Patch. `path` is a JSON Pointer to a member or array element within the state object. Updates to the root are invalid. Pointer tokens decode `~1` to `/`, then `~0` to `~`. Resolve each intermediate token against an existing object member or array element. Array indices are zero-based decimal integers with no leading zeroes except `0`. [JSON Patch](https://www.rfc-editor.org/rfc/rfc6902#section-4) · [JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901#section-4)

| Operation | Object member | Array element |
| --- | --- | --- |
| `add` | Set the member to `value`, creating it when absent. | Insert `value` at an index from `0` through the current length. Use `-` to append. |
| `remove` | Delete an existing member. | Delete an existing element and shift later elements left. |
| `replace` | Set an existing member to `value`. | Set an existing element to `value` without changing the array length. |

`add` and `replace` require `value`, which can be any JSON value, including `null`. `remove` takes only `op` and `path`. Report an error for a missing or scalar parent, a missing `remove` or `replace` target, or an array index outside the operation's allowed range. Treat object keys as literal member names. For example, `/frontier/00` fails when `frontier` is an array. The array append token `-` is valid only as the final array token of `add`.

### Validation errors

For an invalid spec, report the file, the location of the offending field when available, and the reason. For an invalid trace, report the file, one-based line number, and reason. For a failing update, also report the zero-based operation index and the update path. For a failing view binding, include the view ID and source pointer. Schema validation checks each document or record's shape. The reader must also enforce record order, apply state updates, and validate bindings and graph references at each step.

## Graph-search fixture

The example traces breadth-first search from node `A`. It visits outgoing neighbors in the order shown in the graph, queues each node at discovery, and records a step after each node is processed. `B` discovers `D`, so processing `C` leaves `D` in the queue once.

- [Spec](../examples/graph-search/visualization.json) binds the views to `/graph` and `/frontier`.
- [Trace](../examples/graph-search/trace.jsonl) records the initial state and four steps.
- [Expected states](../examples/graph-search/expected-states.json) lists the fixed edge set, each node's status, and the ordered frontier at every step. Compare against these values after committing each step.

## Replay API

The [replay core](../packages/core/index.js) takes decoded JSONL text. Supply `specText` to validate the spec and its bindings at each reconstructed step. Optional `traceSource` and `specSource` names appear in `ReplayError` diagnostics.

```js
import { readFileSync } from "node:fs";
import { loadReplay } from "./packages/core/index.js";

const replay = loadReplay(readFileSync("examples/graph-search/trace.jsonl", "utf8"), {
  specText: readFileSync("examples/graph-search/visualization.json", "utf8"),
});

console.log(replay.current.state.frontier); // ["A"]
console.log(replay.stepForward().state.frontier); // ["B", "C"]
console.log(replay.stepBackward().state.frontier); // ["A"]
console.log(replay.seek(replay.lastStep).state.frontier); // []
```

`current`, `stepForward()`, `stepBackward()`, and `seek(step)` return detached frames containing `step`, `state`, and `events`. Stepping at an endpoint returns its current frame. Seeking outside `0` through `lastStep` throws a `RangeError`.

The offline preview's State panel shows the selected frame's JSON state. The Changes panel compares it with the preceding recorded step using JSON Pointer paths. Step 0 is the initial state. Added or removed values display `Absent` on the missing side, while an explicit JSON `null` displays as `null`. Array entries are compared by index.

`replay.changes` returns the same net comparison as detached `added`, `removed`, and `changed` records. Each record includes its path and the applicable `before` and `after` values. The comparison follows recorded step order regardless of navigation direction. Writes that cancel within a batch produce no change for that path.

Loading validates record structure and the initial view bindings when a spec is supplied. Navigation checks update targets and view bindings as it reconstructs steps. A failed step or seek throws a `ReplayError` and preserves the current frame and its change baseline. Replay keeps the initial state, the selected state, and its preceding state when available. It rebuilds earlier steps from the initial state. Decoding bytes is the caller's responsibility. The JavaScript reader rejects numbers that decode outside its finite range.
