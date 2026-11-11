import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { chromium } from "playwright";

const selectors = {
  episode: "#episode",
  go: "#episode-form button",
  seek: "#seek",
  position: "#step",
  previous: "#previous",
  next: "#next",
  difference: "#first-difference",
};
const actions = ["LEFT", "DOWN", "RIGHT", "UP"];

function oracle() {
  const python = process.env.ALGOVIZ_PYTHON ?? "python";
  const file = fileURLToPath(new URL("oracle.py", import.meta.url));
  return JSON.parse(execFileSync(python, ["-B", file], { encoding: "utf8" }));
}

export async function checkComparison(path, { bestActions = false } = {}) {
  const { map, samples } = oracle();
  const channel = process.env.ALGOVIZ_BROWSER_CHANNEL ?? (process.platform === "win32" ? "msedge" : undefined);
  const browser = await chromium.launch({ channel });
  try {
    const page = await browser.newPage();
    const failures = [];
    const requests = [];
    page.on("pageerror", (error) => failures.push(error.message));
    await page.route(/^https?:/, (route) => {
      requests.push(route.request().url());
      return route.abort();
    });
    const started = performance.now();
    await page.goto(pathToFileURL(resolve(path)).href);
    await page.locator(selectors.episode).waitFor({ timeout: 10000 });
    await page.locator("[data-run='epsilon-0.1'] [data-agent='true']").waitFor({ timeout: 10000 });
    const loadMs = performance.now() - started;

    const go = async (episode, step) => {
      await page.locator(selectors.episode).fill(String(episode));
      await page.locator(selectors.go).click();
      if (step !== 0) await page.locator(selectors.seek).fill(String(step));
    };
    for (const panel of await page.locator("[data-run] [data-state-panel] summary").all()) await panel.click();

    async function verify(sample) {
      const { episode, step, runs } = sample;
      assert.match(await page.locator(selectors.position).textContent(), new RegExp(`Episode ${episode}.*Step ${step}(?:\\s|$)`));
      for (const [run, expected] of Object.entries(runs)) {
        const panel = page.locator(`[data-run="${run}"]`);
        const message = await panel.locator("[data-run-status]").textContent();
        if (!expected) {
          assert.match(message, /Episode (ended|unavailable)/);
          assert.equal(await panel.locator("[data-run-content]").isVisible(), false, `${run} shows a stale frame`);
          continue;
        }
        const state = JSON.parse(await panel.locator("[data-state-json]").textContent());
        assert.deepEqual([state.episode, state.t, state.cell, state.status], [episode, step, expected.cell, expected.status]);
        assert.deepEqual([state.last?.action ?? null, state.last?.reward ?? null], [expected.action, expected.reward]);
        assert.deepEqual(state.path, expected.path);
        if (expected.action) {
          assert(message.includes(expected.action), `${run} action is missing from the summary`);
          assert(message.includes(`Reward ${expected.reward}`), `${run} reward is missing from the summary`);
        }
        const cells = await panel.locator("[data-cell][data-tile]").evaluateAll((nodes) => nodes.map((node) => ({
          cell: Number(node.dataset.cell), tile: node.dataset.tile,
          agent: node.dataset.agent === "true", visited: node.dataset.visited === "true",
        })));
        assert.deepEqual(cells, Array.from(map.join(""), (tile, cell) => ({
          cell, tile, agent: cell === expected.cell, visited: expected.path.includes(cell),
        })));
        assert.deepEqual(JSON.parse(await panel.locator("[data-path]").getAttribute("data-path")), expected.path);
        const values = await panel.locator("[data-action][data-q]").evaluateAll((nodes) => nodes.map((node) => [
          node.dataset.action, Number(node.dataset.q),
        ]));
        assert.deepEqual(values, actions.map((action, i) => [action, expected.q[i]]));
        if (expected.beforeCell !== null && expected.beforeCell !== expected.cell) {
          const change = panel.locator('[data-change-path="/cell"]');
          assert.equal(Number(await change.locator('[data-change-side="before"]').textContent()), expected.beforeCell);
          assert.equal(Number(await change.locator('[data-change-side="after"]').textContent()), expected.cell);
        }
        if (bestActions) {
          const best = panel.locator("[data-best-actions]");
          assert.deepEqual(JSON.parse(await best.getAttribute("data-best-actions", { timeout: 2000 })), expected.best);
          assert.equal(Number(await best.getAttribute("data-best-value")), Math.max(...expected.q));
          const text = await best.textContent();
          assert(expected.best.every((action) => text.toUpperCase().includes(action)));
        }
      }
    }

    const [reset, before, diverged, ended, missing, ...random] = samples;
    await go(reset.episode, reset.step);
    await verify(reset);
    await page.locator(selectors.difference).click();
    await verify(diverged);
    await page.locator(selectors.previous).click();
    await verify(before);
    await page.locator(selectors.next).click();
    await verify(diverged);
    await page.locator(selectors.next).click();
    await verify(ended);
    await go(missing.episode, missing.step);
    await verify(missing);
    for (const sample of random) {
      await go(sample.episode, sample.step);
      await verify(sample);
    }
    const seekTimes = await page.evaluate(({ positions, selectors }) => {
      const episode = document.querySelector(selectors.episode);
      const seek = document.querySelector(selectors.seek);
      const go = document.querySelector(selectors.go);
      return positions.map((position) => {
        const start = performance.now();
        episode.value = String(position.episode);
        go.click();
        if (position.step > 0) {
          seek.value = String(position.step);
          seek.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return performance.now() - start;
      }).sort((a, b) => a - b);
    }, { positions: random, selectors });
    assert.deepEqual(failures, []);
    assert.deepEqual(requests, []);
    return {
      status: "passed", browser: browser.version(), channel: channel ?? "chromium", htmlBytes: statSync(path).size,
      loadMs: Math.round(loadMs), medianSeekMs: seekTimes[Math.ceil(seekTimes.length / 2) - 1],
      p95SeekMs: seekTimes[Math.ceil(seekTimes.length * 0.95) - 1],
    };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [path, option] = process.argv.slice(2);
  if (!path || (option !== undefined && option !== "--best-actions")) {
    console.error("Usage: node benchmarks/frozenlake/check.mjs <viewer.html> [--best-actions]");
    process.exitCode = 2;
  } else {
    console.log(JSON.stringify(await checkComparison(path, { bestActions: option === "--best-actions" }), null, 2));
  }
}
