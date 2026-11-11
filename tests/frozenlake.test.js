import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkRecording, FixtureError } from "../examples/frozenlake/check.mjs";
import { loadReplay } from "../packages/core/index.js";

const example = fileURLToPath(new URL("../examples/frozenlake/", import.meta.url));
const expected = JSON.parse(readFileSync(join(example, "expected.json"), "utf8"));
const { episode } = expected.comparison;
let recorded;

before(() => {
  recorded = mkdtempSync(join(tmpdir(), "algoviz-frozenlake-"));
  execFileSync(process.env.ALGOVIZ_PYTHON ?? "python", ["-B", join(example, "record.py"), recorded]);
});

after(() => rmSync(recorded, { recursive: true, force: true }));

/** Copy the recording, rewrite one trace line, and return the copy and the one-based line number. */
function alter(t, run, line, from, to) {
  const directory = mkdtempSync(join(tmpdir(), "algoviz-frozenlake-altered-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(recorded, directory, { recursive: true });
  const file = join(directory, run, "trace.jsonl");
  const lines = readFileSync(file, "utf8").split("\n");
  assert(lines[line - 1].includes(from), `line ${line} contains ${from}`);
  lines[line - 1] = lines[line - 1].replace(from, to);
  writeFileSync(file, lines.join("\n"));
  // The altered trace is still a valid v1 trace; only the fixture checks can reject it.
  loadReplay(readFileSync(file, "utf8")).seek(line - 1);
  return directory;
}

test("records two reproducible 10,000-transition runs that pass independent validation", () => {
  const report = checkRecording(recorded, { episode });
  assert.deepEqual(report, expected);
  for (const run of Object.values(report.runs)) assert(run.transitions >= 10_000);
  const outcomes = Object.values(report.comparison.outcomes).map((run) => run.outcome);
  assert.notEqual(outcomes[0], outcomes[1]);
});

test("reports the run, episode, and step of an altered reward", (t) => {
  const run = "epsilon-0.1";
  const { resetStep, steps } = expected.comparison.outcomes[run];
  const line = resetStep + steps + 1;
  const directory = alter(t, run, line, '"path":"/last/reward","value":1', '"path":"/last/reward","value":0');
  assert.throws(() => checkRecording(directory), (error) => {
    assert(error instanceof FixtureError);
    assert.equal(error.message, `${run} ${run}/trace.jsonl:${line} episode ${episode} step ${steps}: reward is 0, expected 1`);
    return true;
  });
});

test("reports the run, episode, and step of an altered reset", (t) => {
  const run = "epsilon-0.3";
  const line = expected.comparison.outcomes[run].resetStep + 1;
  const directory = alter(t, run, line, '"path":"/cell","value":0', '"path":"/cell","value":1');
  assert.throws(() => checkRecording(directory), (error) => {
    assert(error instanceof FixtureError);
    assert.equal(error.message, `${run} ${run}/trace.jsonl:${line} episode ${episode} step 0: reset placed the agent at cell 1, expected the start cell 0`);
    return true;
  });
});

test("reports an episode whose trace disagrees with the uninstrumented run", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "algoviz-frozenlake-runs-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  // Record with one seed and compare against an uninstrumented run that uses another.
  const config = JSON.parse(readFileSync(join(example, "runs.json"), "utf8"));
  const runsPath = join(directory, "runs.json");
  config.runs = config.runs.slice(0, 1).map((run) => ({ ...run, seed: run.seed + 1 }));
  writeFileSync(runsPath, JSON.stringify(config));
  const recording = join(directory, "recording");
  cpSync(join(recorded, config.runs[0].id), join(recording, config.runs[0].id), { recursive: true });
  const original = JSON.parse(readFileSync(join(example, "runs.json"), "utf8")).runs[0];
  // Keep the trace's recorded seed consistent with the altered config so only the summaries differ.
  const trace = join(recording, original.id, "trace.jsonl");
  writeFileSync(trace, readFileSync(trace, "utf8").replace(`"seed":${original.seed}`, `"seed":${original.seed + 1}`));
  assert.throws(() => checkRecording(recording, { runsPath }), /epsilon-0\.1 epsilon-0\.1\/trace\.jsonl:\d+ episode \d+: trace summary .* differs from the uninstrumented run/);
});
