import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const cli = fileURLToPath(new URL("../packages/cli/index.js", import.meta.url));
const fixture = new URL("../examples/graph-search/", import.meta.url);
const spec = fileURLToPath(new URL("visualization.json", fixture));
const trace = fileURLToPath(new URL("trace.jsonl", fixture));

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

test("validate traverses every step and identifies invalid updates", (t) => {
  const valid = run("validate", spec, trace);
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /Validated 5 replay states/);

  const directory = mkdtempSync(join(tmpdir(), "algoviz-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const brokenTrace = join(directory, "broken.jsonl");
  const invalid = readFileSync(trace, "utf8").trimEnd() + '\n{"type":"step","updates":[{"op":"remove","path":"/frontier/0"}]}\n';
  writeFileSync(brokenTrace, invalid);
  const result = run("validate", spec, brokenTrace);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /broken\.jsonl:6 update 0 at "\/frontier\/0"/);
  const badPreview = join(directory, "broken.html");
  assert.equal(run("preview", spec, brokenTrace, "--output", badPreview).status, 1);
  assert.throws(() => readFileSync(badPreview), { code: "ENOENT" });
});

test("preview writes a new HTML file and prints its URL", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "algoviz-cli-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = join(directory, "search preview.html");
  const result = run("preview", spec, trace, "--output", file);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `Open ${pathToFileURL(file).href}`);
  const html = readFileSync(file, "utf8");
  assert.match(html, /<title>AlgoViz<\/title>/);
  assert.match(html, /Apache License/);
  assert.match(html, /jsonc-parser\n\nThe MIT License/);
  assert.equal(run("preview", spec, trace, "--output", file).status, 1);
  assert.equal(readFileSync(file, "utf8"), html);
});
