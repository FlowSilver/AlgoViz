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

async function checkGeneratedInputs(generated, checkedIn) {
  for (const name of ["visualization.json", "trace.jsonl"]) {
    const expected = (await readFile(new URL(name, checkedIn), "utf8")).replaceAll("\r\n", "\n");
    assert.equal(await readFile(new URL(name, generated), "utf8"), expected);
  }
}

async function checkFixture(browser, file, expected, inspect) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 740 } });
  const requests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route(/^https?:/, async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto(pathToFileURL(file).href);
  if (inspect) await page.locator("#state-panel summary").click();

  const previous = page.getByRole("button", { name: "Previous" });
  const next = page.getByRole("button", { name: "Next" });
  const seek = page.getByRole("slider", { name: "Seek" });
  const positions = await page.locator("[data-node-id]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("transform")));
  const edgeLabels = expected.edges.filter((edge) => edge.label !== undefined).map((edge) => ({ id: edge.id, label: String(edge.label) }));

  function viewItems(viewId) {
    return page.locator(`[data-view-id="${viewId}"] .array li:visible`).evaluateAll((items) => items.map((item) => {
      const value = JSON.parse(item.dataset.value);
      const label = item.querySelector(".array-label");
      return label ? { label: label.textContent, value, text: item.querySelector("code").textContent } : value;
    }));
  }

  async function checkStep(index) {
    const target = expected.steps[index];
    assert.equal(await page.locator("#step").textContent(), `Step ${index} of ${expected.steps.length - 1}`);
    const nodes = await page.locator("[data-node-id]").evaluateAll((elements) => elements.map((element) => ({
      id: element.dataset.nodeId, status: element.dataset.status, position: element.getAttribute("transform"),
    })));
    assert.deepEqual(Object.fromEntries(nodes.map(({ id, status }) => [id, status])), target.nodeStatus);
    assert.deepEqual(nodes.map(({ position }) => position), positions);
    assert.deepEqual(await page.locator("[data-edge-id]").evaluateAll((edges) => edges.map((edge) => edge.dataset.edgeId)), expected.edges.map((edge) => edge.id));
    assert.deepEqual(await page.locator("[data-edge-label-for]:visible").evaluateAll((labels) => labels.map((label) => ({
      id: label.dataset.edgeLabelFor, label: label.textContent,
    }))), edgeLabels);
    assert.deepEqual(await viewItems("frontier"), target.frontier);
    if (target.distances) assert.deepEqual(await viewItems("tentative-distances"), target.distances);
    if (inspect) await inspect(page, index);
  }

  assert(await previous.isDisabled());
  for (let index = 0; index < expected.steps.length; index++) {
    if (index > 0) await next.click();
    await checkStep(index);
  }
  assert(await next.isDisabled());
  for (let index = expected.steps.length - 2; index >= 0; index--) {
    await previous.click();
    await checkStep(index);
  }
  for (let index = expected.steps.length - 1; index > 0; index--) {
    await seek.fill(String(index));
    await checkStep(index);
  }
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
  await checkGeneratedInputs(generated, fixture);
  const file = join(directory, "upstream-bfs.html");
  buildPreview(generated, file);
  const expected = JSON.parse(await readFile(new URL("expected-states.json", fixture), "utf8"));
  const browser = await chromium.launch({ channel: process.env.ALGOVIZ_BROWSER_CHANNEL });
  t.after(() => browser.close());
  await checkFixture(browser, file, expected);
});

test("edge labels and labeled Array values follow the current replay frame", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "algoviz-labeled-views-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "visualization.json"), JSON.stringify({
    version: 1, layout: "row", views: [
      { id: "graph", type: "graph", source: "/graph" },
      { id: "distances", type: "array", source: "/distances", item: { label: "/vertex", value: "/distance", nullLabel: "∞" } },
    ],
  }));
  const records = [
    { type: "initial", version: 1, state: {
      graph: {
        nodes: [{ id: "A" }, { id: "B" }],
        edges: [
          { id: "A-B", source: "A", target: "B", label: 0 },
          { id: "B-B", source: "B", target: "B", label: "loop" },
          { id: "B-A", source: "B", target: "A", label: { metadata: true } },
        ],
      },
      distances: [{ vertex: "A", distance: 0 }, { vertex: "B", distance: null }],
    } },
    { type: "step", updates: [
      { op: "replace", path: "/graph/edges/0/label", value: "shortcut" },
      { op: "remove", path: "/graph/edges/1/label" },
      { op: "replace", path: "/distances/1/distance", value: 2 },
    ] },
  ];
  await writeFile(join(directory, "trace.jsonl"), records.map((record) => JSON.stringify(record)).join("\n"));
  const file = join(directory, "labeled.html");
  buildPreview(pathToFileURL(`${directory}/`), file);
  const browser = await chromium.launch({ channel: process.env.ALGOVIZ_BROWSER_CHANNEL });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(pathToFileURL(file).href);

  const labels = page.locator("[data-edge-label-for]");
  const itemLabels = page.locator("[data-view-id=distances] .array-label");
  const itemValues = page.locator("[data-view-id=distances] .array code");
  assert.deepEqual(await labels.allTextContents(), ["0", "loop"]);
  assert.deepEqual(await itemLabels.allTextContents(), ["A", "B"]);
  assert.deepEqual(await itemValues.allTextContents(), ["0", "∞"]);
  await page.getByRole("button", { name: "Next" }).click();
  assert.equal(await page.locator('[data-edge-label-for="A-B"]').textContent(), "shortcut");
  assert.equal(await page.locator('[data-edge-label-for="B-B"]').count(), 0);
  assert.deepEqual(await itemValues.allTextContents(), ["0", "2"]);
  assert.equal(await page.locator('[data-change-path="/graph/edges/1/label"] [data-change-side="after"]').textContent(), "Absent");
  assert.equal(await page.locator('[data-change-path="/distances/1/distance"] [data-change-side="before"]').textContent(), "null");
  await page.getByRole("slider", { name: "Seek" }).fill("0");
  assert.deepEqual(await labels.allTextContents(), ["0", "loop"]);
  assert.deepEqual(await itemValues.allTextContents(), ["0", "∞"]);
  await page.close();
});

test("the weighted Dijkstra example uses native views across all five offline frames", async (t) => {
  const fixture = new URL("../examples/weighted-dijkstra/", import.meta.url);
  const benchmark = new URL("../benchmarks/dijkstra/", import.meta.url);
  const { edges } = JSON.parse(await readFile(new URL("fixture.json", benchmark), "utf8"));
  const { result, frames } = JSON.parse(await readFile(new URL("expected.json", benchmark), "utf8"));
  const directory = await mkdtemp(join(tmpdir(), "algoviz-weighted-dijkstra-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const adapter = fileURLToPath(new URL("adapter.py", fixture));
  const observed = execFileSync(process.env.ALGOVIZ_PYTHON ?? "python", ["-B", adapter, directory], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(observed), { original: result, recorded: result, states: frames.length });

  const generated = pathToFileURL(`${directory}/`);
  await checkGeneratedInputs(generated, fixture);
  const validation = execFileSync(process.execPath, [cli, "validate", join(directory, "visualization.json"), join(directory, "trace.jsonl")], { encoding: "utf8" });
  assert.match(validation, /Validated 5 replay states/);

  const labeledItems = (items) => items.map((item) => {
    const [label, text] = item.split(": ");
    return { label, text, value: text === "∞" ? null : Number(text) };
  });
  const expected = {
    edges: edges.map(({ id, weight }) => ({ id, label: weight })),
    steps: frames.map((frame) => ({
      nodeStatus: frame.status, frontier: labeledItems(frame.frontier), distances: labeledItems(frame.distances),
    })),
  };
  const file = join(directory, "dijkstra.html");
  buildPreview(generated, file);
  const browser = await chromium.launch({ channel: process.env.ALGOVIZ_BROWSER_CHANNEL });
  t.after(() => browser.close());
  await checkFixture(browser, file, expected, async (page, index) => {
    const target = expected.steps[index];
    const state = JSON.parse(await page.locator("#state-json").textContent());
    assert.deepEqual(state.distances, target.distances.map(({ label, value }) => ({ vertex: label, distance: value })));
    if (index === 0) assert.equal(await page.locator("#change-list").textContent(), "Initial state");
    if (index === 2) {
      const change = page.locator('[data-change-path="/distances/1/distance"]');
      assert.equal(await change.locator('[data-change-side="before"]').textContent(), "5");
      assert.equal(await change.locator('[data-change-side="after"]').textContent(), "2");
    }
  });
});
