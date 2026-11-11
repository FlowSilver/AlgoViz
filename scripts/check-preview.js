import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const cli = fileURLToPath(new URL("../packages/cli/index.js", import.meta.url));

function buildPreview(fixture, output) {
  execFileSync(process.execPath, [cli, "preview",
    fileURLToPath(new URL("visualization.json", fixture)), fileURLToPath(new URL("trace.jsonl", fixture)),
    "--output", output]);
}

async function checkFixture(browser, file, expected) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 740 } });
  const requests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:/, async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto(pathToFileURL(file).href);

  const previous = page.getByRole("button", { name: "Previous" });
  const next = page.getByRole("button", { name: "Next" });
  const seek = page.getByRole("slider", { name: "Seek" });
  const positions = await page.locator("[data-node-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("transform")));

  async function checkStep(index) {
    const target = expected.steps[index];
    assert.equal(await page.locator("#step").textContent(), `Step ${index} of ${expected.steps.length - 1}`);
    const nodes = await page.locator("[data-node-id]").evaluateAll((elements) => elements.map((element) => ({
      id: element.dataset.nodeId, status: element.dataset.status, position: element.getAttribute("transform"),
    })));
    assert.deepEqual(Object.fromEntries(nodes.map(({ id, status }) => [id, status])), target.nodeStatus);
    assert.deepEqual(nodes.map(({ position }) => position), positions);
    assert.deepEqual(await page.locator("[data-edge-id]").evaluateAll((edges) => edges.map((edge) => edge.dataset.edgeId)), expected.edges.map((edge) => edge.id));
    const values = await page.locator(".array [data-value]").evaluateAll((items) => items.map((item) => JSON.parse(item.dataset.value)));
    assert.deepEqual(values, target.frontier);
  }

  assert(await previous.isDisabled());
  for (let index = 0; index < expected.steps.length; index++) {
    if (index > 0) await next.click();
    await checkStep(index);
  }
  assert(await next.isDisabled());
  await previous.click();
  await checkStep(expected.steps.length - 2);
  await seek.fill("1");
  await checkStep(1);
  await seek.press("Home");
  await checkStep(0);

  await page.setViewportSize({ width: 375, height: 812 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
  await page.close();
}

test("the offline browser preview keeps graph and frontier synchronized", async (t) => {
  const fixture = new URL("../examples/graph-search/", import.meta.url);
  const expected = JSON.parse(await readFile(new URL("expected-states.json", fixture), "utf8"));
  const directory = await mkdtemp(join(tmpdir(), "algoviz-browser-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = join(directory, "preview.html");
  buildPreview(fixture, file);
  const browser = await chromium.launch({ channel: process.env.ALGOVIZ_BROWSER_CHANNEL });
  t.after(() => browser.close());
  await checkFixture(browser, file, expected);

  const literal = '</script><p id="injected-content">literal</p>';
  await writeFile(join(directory, "visualization.json"), JSON.stringify({
    version: 1, layout: "column", views: [{ id: "values", type: "array", source: "/values" }],
  }));
  await writeFile(join(directory, "trace.jsonl"), JSON.stringify({ type: "initial", version: 1, state: { values: [literal] } }));
  const textFile = join(directory, "literal.html");
  buildPreview(pathToFileURL(`${directory}/`), textFile);
  const textPage = await browser.newPage();
  await textPage.goto(pathToFileURL(textFile).href);
  assert.equal(await textPage.locator(".array code").textContent(), literal);
  assert.equal(await textPage.locator("#injected-content").count(), 0);
  await textPage.close();
});

test("the upstream BFS adapter preserves the result and its generated run replays offline", async (t) => {
  const fixture = new URL("../examples/upstream-bfs/", import.meta.url);
  const directory = await mkdtemp(join(tmpdir(), "algoviz-upstream-bfs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const adapter = fileURLToPath(new URL("adapter.py", fixture));
  for (const [start, visited] of [[0, [0, 1, 2, 3, 4]], [2, [1, 2, 3, 4]], [5, [5]]]) {
    const output = join(directory, String(start));
    const result = execFileSync(process.env.ALGOVIZ_PYTHON ?? "python", ["-B", adapter, output, "--start", String(start)], { encoding: "utf8" });
    assert.deepEqual(JSON.parse(result), { start, visited, states: visited.length + 1 });
    execFileSync(process.execPath, [cli, "validate", join(output, "visualization.json"), join(output, "trace.jsonl")]);
  }

  const generated = pathToFileURL(`${join(directory, "0")}/`);
  for (const name of ["visualization.json", "trace.jsonl"]) {
    const checkedIn = (await readFile(new URL(name, fixture), "utf8")).replaceAll("\r\n", "\n");
    assert.equal(await readFile(new URL(name, generated), "utf8"), checkedIn);
  }
  const file = join(directory, "upstream-bfs.html");
  buildPreview(generated, file);
  const expected = JSON.parse(await readFile(new URL("expected-states.json", fixture), "utf8"));
  const browser = await chromium.launch({ channel: process.env.ALGOVIZ_BROWSER_CHANNEL });
  t.after(() => browser.close());
  await checkFixture(browser, file, expected);
});
