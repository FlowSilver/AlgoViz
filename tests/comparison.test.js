import assert from "node:assert/strict";
import { test } from "node:test";
import { firstDifferentAction, indexRun } from "../packages/core/comparison.js";
import { loadReplay } from "../packages/core/index.js";

function trace(frames) {
  const [state, ...rest] = frames;
  return [
    { type: "initial", version: 1, state },
    ...rest.map((frame) => ({ type: "step", updates: Object.entries(frame).map(([key, value]) => ({
      op: "add", path: `/${key}`, value,
    })) })),
  ].map((line) => JSON.stringify(line)).join("\n");
}

test("indexes episode resets independently of trace position and finds the shared divergence", () => {
  const left = indexRun({ traceText: trace([
    { episode: 0, t: 0 }, { t: 1, last: { action: "LEFT" } }, { t: 2 }, { episode: 1, t: 0 },
  ]) });
  const right = indexRun({ traceText: trace([{ episode: 0, t: 0 }, { t: 1, last: { action: "RIGHT" } }]) });
  assert.equal(firstDifferentAction([left, right], 0), 1);
  assert.equal(firstDifferentAction([left, right], 1), undefined);
  assert.equal(left.episodes[1].start, 3);
  assert.equal(right.episodes[1], undefined);
  assert.throws(() => indexRun({ traceText: trace([{ episode: 0, t: 0 }, { t: 2 }]), traceSource: "gap" }),
    /gap:2: Expected consecutive zero-based episode and t values/);
});

test("checkpointed seeks preserve the previous recorded state even at a checkpoint", () => {
  const replay = loadReplay(trace([{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }, { n: 5 }]), {
    checkpointInterval: 2,
  });
  for (const step of [5, 4, 2, 3, 0]) {
    assert.equal(replay.seek(step).state.n, step);
    assert.deepEqual(replay.changes, step === 0 ? [] : [{ kind: "changed", path: "/n", before: step - 1, after: step }]);
  }
});
