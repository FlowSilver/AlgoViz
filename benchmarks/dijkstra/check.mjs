import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const showDistances = args.includes("--distances");
const directory = resolve(args.find((arg) => arg !== "--distances") ?? ".");
const phase = showDistances ? "follow-up" : "initial";
const started = new Date().toISOString();
const expected = JSON.parse(await readFile(new URL("expected.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("fixture.json", import.meta.url), "utf8"));

async function checkBrowser() {
  const channel = process.env.ALGOVIZ_BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);
  const browser = await chromium.launch({ channel });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const requests = [];
    const errors = [];
    await page.route(/^https?:/, (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(pathToFileURL(join(directory, "viewer.html")).href);
    const previous = page.getByRole("button", { name: "Previous", exact: true });
    const next = page.getByRole("button", { name: "Next", exact: true });
    const seek = page.getByRole("slider", { name: "Seek", exact: true });
    const last = expected.frames.length - 1;
    const weights = fixture.edges.map(({ source, target, weight }) => `${source} -> ${target}: ${weight}`);

    async function viewItems(id) {
      const view = page.locator(`[data-view-id="${id}"]`);
      assert(await view.isVisible(), `${id} view must be visible`);
      return (await view.locator("li:visible").allTextContents()).map((text) => text.trim());
    }

    async function checkFrame(step) {
      const frame = expected.frames[step];
      assert.equal(await page.locator("#step").textContent(), `Step ${step} of ${last}`);
      const statuses = await page.locator("[data-node-id]:visible").evaluateAll((nodes) => Object.fromEntries(
        nodes.map((node) => [node.dataset.nodeId, node.dataset.status]),
      ));
      const edges = await page.locator("[data-edge-id]").evaluateAll((items) => items.map((item) => item.dataset.edgeId));
      assert.deepEqual(statuses, frame.status, `Node status at step ${step}`);
      assert.deepEqual(edges.sort(), fixture.edges.map(({ id }) => id).sort(), `Graph edges at step ${step}`);
      assert.deepEqual((await viewItems("weights")).sort(), weights.toSorted(), `Edge weights at step ${step}`);
      assert.deepEqual(await viewItems("frontier"), frame.frontier, `Priority queue at step ${step}`);
      if (showDistances) assert.deepEqual(await viewItems("distances"), frame.distances, `Tentative distances at step ${step}`);
    }

    assert(await previous.isDisabled());
    for (const step of expected.frames.keys()) {
      if (step > 0) await next.click();
      await checkFrame(step);
    }
    assert(await next.isDisabled());
    await previous.click();
    await checkFrame(last - 1);
    for (const step of [1, last, 0]) {
      await seek.fill(String(step));
      await checkFrame(step);
    }
    assert.deepEqual(errors, [], "Browser errors");
    assert.deepEqual(requests, [], "HTTP requests");
  } finally {
    await browser.close();
  }
}

let failure;
try {
  execFileSync(process.env.ALGOVIZ_PYTHON ?? "python", ["-B", "build.py"], { cwd: directory, encoding: "utf8", timeout: 60000 });
  const result = JSON.parse(await readFile(join(directory, "result.json"), "utf8"));
  assert.deepEqual(result.original, expected.result, "Upstream Dijkstra result");
  assert.deepEqual(result.recorded, expected.result, "Recorded Dijkstra result");
  await checkBrowser();
  console.log(`PASS ${phase}: five frames, backward stepping, seeking, and matching Dijkstra results`);
} catch (error) {
  failure = error.message;
  console.error(error);
  process.exitCode = 1;
} finally {
  const finished = new Date().toISOString();
  await appendFile(join(directory, "check-log.jsonl"), `${JSON.stringify({ phase, started, finished, passed: !failure, failure })}\n`);
}
