import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkComparison } from "../benchmarks/frozenlake/check.mjs";

test("compares the verified FrozenLake runs and keeps the custom grid synchronized offline", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "algoviz-comparison-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const example = fileURLToPath(new URL("../examples/frozenlake/", import.meta.url));
  const cli = fileURLToPath(new URL("../packages/cli/index.js", import.meta.url));
  const python = process.env.ALGOVIZ_PYTHON ?? "python";
  const spec = join(example, "comparison.json");
  const output = join(directory, "compare.html");
  execFileSync(python, ["-B", join(example, "record.py"), directory]);
  const args = [
    cli, "compare", spec, join(directory, "epsilon-0.1", "trace.jsonl"),
    spec, join(directory, "epsilon-0.3", "trace.jsonl"),
  ];
  assert.throws(() => execFileSync(process.execPath, args, { stdio: "pipe" }), /requires --renderer frozenlake=<file>/);
  execFileSync(process.execPath, [...args, "--renderer", `frozenlake=${join(example, "grid.js")}`, "--output", output]);
  const report = await checkComparison(output);
  assert.equal(report.status, "passed");
  t.diagnostic(JSON.stringify(report));
});
