import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadReplay, ReplayError } from "../packages/core/index.js";

const fixture = new URL("../examples/graph-search/", import.meta.url);
const traceText = readFileSync(new URL("trace.jsonl", fixture), "utf8");
const specText = readFileSync(new URL("visualization.json", fixture), "utf8");
const expected = JSON.parse(readFileSync(new URL("expected-states.json", fixture), "utf8"));

function trace(state, ...steps) {
  return [{ type: "initial", version: 1, state }, ...steps].map((record) => JSON.stringify(record)).join("\n");
}

function step(...updates) {
  return { type: "step", updates };
}

test("forward, backward, and seek all reproduce the five fixture states", () => {
  const replay = loadReplay(traceText, { specText });
  assert.equal(replay.lastStep, 4);
  assert.deepEqual(replay.stepBackward(), replay.current);
  const frames = [replay.current];
  for (let index = 1; index <= replay.lastStep; index++) frames.push(replay.stepForward());

  for (const [index, frame] of frames.entries()) {
    const { graph, frontier } = frame.state;
    const nodeStatus = Object.fromEntries(graph.nodes.map(({ id, status }) => [id, status]));
    assert.deepEqual({ step: frame.step, nodeStatus, frontier }, expected.steps[index]);
    assert.deepEqual(graph.edges, expected.edges);
  }
  assert.deepEqual(replay.stepForward(), frames.at(-1));
  for (let index = replay.lastStep - 1; index >= 0; index--) {
    assert.deepEqual(replay.stepBackward(), frames[index]);
  }
  for (const index of [4, 1, 3, 0, 2, 4]) assert.deepEqual(replay.seek(index), frames[index]);
  assert.deepEqual(frames[0].events, []);
  assert.deepEqual(frames[1].events, [{ type: "node.visit", data: { nodeId: "A" } }]);
});

test("a failed update rolls back the whole navigation and reports the update location", () => {
  const input = trace({ queue: ["A"], count: 0 },
    step({ op: "replace", path: "/count", value: 1 }),
    step({ op: "remove", path: "/queue/0" }, { op: "replace", path: "/queue/9", value: "B" }),
    step({ op: "replace", path: "/count", value: 2 }));
  const replay = loadReplay(input, { traceSource: "broken.jsonl" });
  const before = replay.stepForward();
  const invalidUpdate = {
    name: "ReplayError", source: "broken.jsonl", line: 3, operationIndex: 1, path: "/queue/9",
  };
  assert.throws(() => replay.stepForward(), invalidUpdate);
  assert.deepEqual(replay.current, before);
  assert.throws(() => replay.seek(3), invalidUpdate);
  assert.deepEqual(replay.current, before);

  replay.seek(0);
  const initial = replay.current;
  assert.throws(() => replay.seek(3), invalidUpdate);
  assert.deepEqual(replay.current, initial);
  assert.deepEqual(replay.stepForward(), before);
});

test("seeking outside the timeline leaves the current frame unchanged", () => {
  const replay = loadReplay(traceText);
  const before = replay.seek(2);
  for (const target of [-1, 5, 0.5, "2", NaN]) {
    assert.throws(() => replay.seek(target), RangeError);
    assert.deepEqual(replay.current, before);
  }
});

test("returned frames and inserted values stay independent of later navigation", () => {
  const replay = loadReplay(trace({},
    { ...step({ op: "add", path: "/items", value: [{ count: 1 }] }), events: [{ type: "observe" }] },
    step({ op: "replace", path: "/items/0/count", value: 2 })));
  const first = replay.stepForward();
  assert.deepEqual(replay.stepForward().state, { items: [{ count: 2 }] });
  assert.deepEqual(first.state, { items: [{ count: 1 }] });
  first.state.items[0].count = 99;
  first.events[0].type = "changed";
  assert.deepEqual(replay.stepBackward(), {
    step: 1, state: { items: [{ count: 1 }] }, events: [{ type: "observe" }],
  });
});

test("updates handle pointer escapes, literal member names, and ordered array insertion", () => {
  const replay = loadReplay(trace({ "a/b~c": null, "00": 1, items: ["A", "C"] }, step(
    { op: "add", path: "/items/1", value: "B" },
    { op: "add", path: "/items/3", value: "D" },
    { op: "add", path: "/items/-", value: "E" },
    { op: "replace", path: "/items/0", value: "a" },
    { op: "remove", path: "/items/2" },
    { op: "replace", path: "/a~1b~0c", value: 2 },
    { op: "remove", path: "/00" },
    { op: "add", path: "/__proto__", value: { label: "literal" } },
    { op: "replace", path: "/__proto__/label", value: "updated" },
    { op: "add", path: "/", value: null },
  )));
  const { state } = replay.stepForward();
  assert.deepEqual(state, {
    "a/b~c": 2, items: ["a", "B", "D", "E"], ["__proto__"]: { label: "updated" }, "": null,
  });
  assert.equal(Object.getPrototypeOf(state), Object.prototype);
});

test("updates reject missing members, scalar parents, and invalid array indices", () => {
  for (const path of ["/missing", "/missing/child", "/scalar/child", "/items/00", "/items/-", "/items/1"]) {
    const replay = loadReplay(trace({ scalar: null, items: ["A"] }, step({ op: "replace", path, value: "B" })));
    assert.throws(() => replay.stepForward(), { name: "ReplayError", line: 2, operationIndex: 0, path });
  }
});

test("the loader rejects malformed JSONL, invalid records, and duplicate keys", () => {
  const initial = trace({});
  const cases = [
    ["", 1, /initial record/i],
    [`${initial}\n\n`, 2, /blank/i],
    [`\uFEFF${initial}`, 1, /json/i],
    [JSON.stringify(step()), 1, /initial/],
    [`${initial}\n${initial}`, 2, /step/],
    [initial.replace('"version":1', '"version":2'), 1, /version/],
    [initial.replace('"state":{}', '"state":[]'), 1, /state/],
    [`${initial}\n{"type":"step","updates":[],}`, 2, /json/i],
    ['{"type":"initial","version":1,"state":{"x":1,"\\u0078":2}}', 1, /duplicate member "x"/i],
    ['{"type":"initial","version":1,"state":{"x":1e400}}', 1, /finite/],
  ];
  for (const [input, line, message] of cases) {
    assert.throws(() => loadReplay(input), { name: "ReplayError", line, message });
  }

  const missingValue = trace({ key: 1 }, step({ op: "replace", path: "/key" }));
  assert.throws(() => loadReplay(missingValue), {
    name: "ReplayError", line: 2, operationIndex: 0, path: "/key", message: /value/,
  });
  const badEscape = trace({}, step({ op: "add", path: "/key~2", value: 1 }));
  assert.throws(() => loadReplay(badEscape), {
    name: "ReplayError", line: 2, operationIndex: 0, path: "/key~2",
  });
});

test("initial-only traces and event-only steps work with either line ending", () => {
  const initialOnly = loadReplay(trace({}));
  assert.equal(initialOnly.lastStep, 0);
  assert.deepEqual(initialOnly.stepForward(), initialOnly.stepBackward());

  const eventOnly = trace({ value: 1 }, { ...step(), events: [{ type: "unrecognized" }] });
  for (const input of [eventOnly, `${eventOnly}\n`, `${eventOnly.replaceAll("\n", "\r\n")}\r\n`]) {
    const replay = loadReplay(input);
    assert.deepEqual(replay.stepForward(), { step: 1, state: { value: 1 }, events: [{ type: "unrecognized" }] });
  }
});

test("supplied view bindings are checked only against complete states", () => {
  const graph = { nodes: [{ id: "A" }, { id: "B" }], edges: [{ id: "A-B", source: "A", target: "B" }] };
  const input = trace({ graph, frontier: [] },
    step({ op: "remove", path: "/graph/nodes/1" }, { op: "remove", path: "/graph/edges/0" }),
    step({ op: "add", path: "/graph/edges/-", value: graph.edges[0] }));
  const replay = loadReplay(input, { specText });
  const before = replay.stepForward();
  assert.deepEqual(before.state.graph, { nodes: [{ id: "A" }], edges: [] });
  assert.throws(() => replay.stepForward(), {
    name: "ReplayError", line: 3, viewId: "search-graph", path: "/graph", message: /missing node/,
  });
  assert.deepEqual(replay.current, before);
  assert.throws(() => loadReplay(trace({ graph, frontier: null }), { specText }), {
    name: "ReplayError", line: 1, viewId: "frontier", path: "/frontier",
  });
  assert.throws(() => loadReplay(input, { specText: specText.replace('"id": "frontier"', '"id": "search-graph"') }), {
    name: "ReplayError", source: "visualization.json", viewId: "search-graph", message: /duplicate/i,
  });
  assert.throws(() => loadReplay(input, { specText: "{}" }), ReplayError);
});

test("labeled Array item bindings validate every candidate frame before committing", () => {
  const view = {
    id: "distances", type: "array", source: "/distances",
    item: { label: "/vertex", value: "/cost~1estimate", nullLabel: "∞" },
  };
  const specification = (view) => JSON.stringify({ version: 1, layout: "row", views: [view] });
  const state = { distances: [{ vertex: "S", "cost/estimate": 0 }, { vertex: "U", "cost/estimate": null }] };
  const input = trace(state,
    step({ op: "replace", path: "/distances/1/cost~1estimate", value: 4 }),
    step({ op: "remove", path: "/distances/1/cost~1estimate" }));
  const replay = loadReplay(input, { specText: specification(view) });
  assert.deepEqual(replay.current.state, state);
  const before = replay.stepForward();
  assert.equal(before.state.distances[1]["cost/estimate"], 4);
  assert.throws(() => replay.stepForward(), {
    name: "ReplayError", line: 3, viewId: "distances", path: "/distances", message: /Array item 1.*cost\/estimate/,
  });
  assert.deepEqual(replay.current, before);

  assert.throws(() => loadReplay(trace({ distances: [{ vertex: 0, "cost/estimate": 1 }] }), { specText: specification(view) }), {
    name: "ReplayError", line: 1, viewId: "distances", message: /Array item 0.*string label/,
  });
  assert.throws(() => loadReplay(input, { specText: specification({ ...view, type: "graph" }) }), {
    name: "ReplayError", source: "visualization.json", message: /\/views\/0\/type/,
  });
  assert.throws(() => loadReplay(input, { specText: specification({ ...view, item: { label: "/vertex", value: "distance" } }) }), {
    name: "ReplayError", source: "visualization.json", message: /\/views\/0\/item\/value/,
  });
});
