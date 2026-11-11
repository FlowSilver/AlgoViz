#!/usr/bin/env node
// Validate recorded FrozenLake Q-learning traces independently of the Python recorder.
// The environment rules and Q-learning update below are a separate implementation of
// Gymnasium FrozenLake-v1 with is_slippery=False.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { loadReplay } from "../../packages/core/index.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const MAPS = {
  "4x4": ["SFFF", "FHFH", "FFFH", "HFFG"],
  "8x8": ["SFFFFFFF", "FFFFFFFF", "FFFHFFFF", "FFFFFHFF", "FFFHFFFF", "FHHFFFHF", "FHFFHFHF", "FFFHFFFG"],
};
const TIME_LIMITS = { "4x4": 100, "8x8": 200 };
const ACTIONS = ["LEFT", "DOWN", "RIGHT", "UP"];
const MOVES = { LEFT: [0, -1], DOWN: [1, 0], RIGHT: [0, 1], UP: [-1, 0] };
const REWARDS = { G: 1, H: 0, F: 0, S: 0 };
const TOTALS = { goal: "goals", hole: "holes", truncated: "truncations" };
const STATE_KEYS = ["run", "map", "episode", "t", "cell", "status", "episodeReturn", "path", "last", "q", "totals"];
const LAST_KEYS = ["from", "action", "explored", "to", "reward", "terminated", "truncated"];

export class FixtureError extends Error {
  /**
   * @param {string} message
   * @param {{ run: string, source: string, line?: number, episode?: number, step?: number }} location
   */
  constructor(message, { run, source, line, episode, step }) {
    const where = [`${run} ${line === undefined ? source : `${source}:${line}`}`];
    if (episode !== undefined) where.push(`episode ${episode}`);
    if (step !== undefined) where.push(`step ${step}`);
    super(`${where.join(" ")}: ${message}`);
    this.name = "FixtureError";
    Object.assign(this, { run, source, line, episode, step });
  }
}

const show = (value) => JSON.stringify(value);

function argmax(values) {
  const best = Math.max(...values);
  return ACTIONS.filter((_, index) => values[index] === best);
}

function outcomeOf(tile, terminated, truncated) {
  if (terminated) return tile === "G" ? "goal" : "hole";
  return truncated ? "truncated" : "running";
}

/** Compare the recorded state with the expected one, field by field, in a fixed order. */
function compareState(actual, expected) {
  const extra = Object.keys(actual).filter((key) => !STATE_KEYS.includes(key));
  if (extra.length) return `unexpected state field ${show(extra[0])}`;
  for (const key of STATE_KEYS) {
    if (key === "last" && expected.last && actual.last && typeof actual.last === "object") {
      for (const field of LAST_KEYS) {
        if (!isDeepStrictEqual(actual.last[field], expected.last[field])) {
          return `${field} is ${show(actual.last[field])}, expected ${show(expected.last[field])}`;
        }
      }
      const extraLast = Object.keys(actual.last).filter((field) => !LAST_KEYS.includes(field));
      if (extraLast.length) return `unexpected last-transition field ${show(extraLast[0])}`;
      continue;
    }
    if (!isDeepStrictEqual(actual[key], expected[key])) {
      if (key === "q") {
        for (const [cell, row] of expected.q.entries()) {
          for (const [index, value] of row.entries()) {
            const found = actual.q?.[cell]?.[index];
            if (!Object.is(found, value)) return `Q[${cell}][${ACTIONS[index]}] is ${show(found)}, expected ${show(value)}`;
          }
        }
      }
      return `${key} is ${show(actual[key])}, expected ${show(expected[key])}`;
    }
  }
  return undefined;
}

/**
 * Validate one recorded run and return its per-episode summaries and transitions.
 * @param {{ traceText: string, specText?: string, source?: string, settings: any, run: any }} input
 */
export function checkRun({ traceText, specText, source = "trace.jsonl", settings, run }) {
  const map = MAPS[settings.map];
  const limit = TIME_LIMITS[settings.map];
  if (!map) throw new Error(`Unsupported FrozenLake map ${show(settings.map)}`);
  const ncol = map[0].length;
  const tile = (cell) => map[Math.floor(cell / ncol)][cell % ncol];
  const move = (cell, action) => {
    const [dr, dc] = MOVES[action];
    const row = Math.min(Math.max(Math.floor(cell / ncol) + dr, 0), map.length - 1);
    const col = Math.min(Math.max((cell % ncol) + dc, 0), ncol - 1);
    return row * ncol + col;
  };

  const replay = loadReplay(traceText, { specText, traceSource: source });
  const fail = (message, frame) => {
    throw new FixtureError(message, {
      run: run.id, source, line: frame.step + 1, episode: frame.state.episode, step: frame.state.t,
    });
  };

  const initial = {
    run: { id: run.id, seed: run.seed, epsilon: run.epsilon, alpha: settings.alpha, gamma: settings.gamma },
    map: [...map],
    episode: 0, t: 0, cell: 0, status: "running", episodeReturn: 0, path: [0], last: null,
    q: Array.from({ length: map.length * ncol }, () => ACTIONS.map(() => 0)),
    totals: { transitions: 0, goals: 0, holes: 0, truncations: 0 },
  };
  let frame = replay.current;
  const initialError = compareState(frame.state, initial);
  if (initialError) fail(`initial state: ${initialError}`, frame);

  const episodes = [];
  /** @type {any[]} */
  let transitions = [];
  for (let index = 1; index <= replay.lastStep; index++) {
    const previous = frame.state;
    frame = replay.stepForward();
    const state = frame.state;
    let expected;
    if (previous.status === "running") {
      const action = state.last?.action;
      if (!ACTIONS.includes(action)) fail(`action is ${show(action)}, expected one of ${ACTIONS.join(", ")}`, frame);
      if (typeof state.last.explored !== "boolean") fail(`explored is ${show(state.last.explored)}, expected a boolean`, frame);
      const t = previous.t + 1;
      const to = move(previous.cell, action);
      const reward = REWARDS[tile(to)];
      const terminated = "GH".includes(tile(to));
      // Gymnasium's TimeLimit wrapper truncates at the limit even when the step also terminates.
      const truncated = t >= limit;
      const status = outcomeOf(tile(to), terminated, truncated);
      const a = ACTIONS.indexOf(action);
      const q = structuredClone(previous.q);
      const target = terminated ? reward : reward + settings.gamma * Math.max(...previous.q[to]);
      q[previous.cell][a] = previous.q[previous.cell][a] + settings.alpha * (target - previous.q[previous.cell][a]);
      const totals = { ...previous.totals, transitions: previous.totals.transitions + 1 };
      if (status !== "running") totals[TOTALS[status]] += 1;
      expected = {
        ...previous, episode: previous.episode, t, cell: to, status,
        episodeReturn: previous.episodeReturn + reward, path: [...previous.path, to],
        last: { from: previous.cell, action, explored: state.last.explored, to, reward, terminated, truncated },
        q, totals,
      };
      const error = compareState(state, expected);
      if (error) fail(error, frame);
      const greedy = argmax(previous.q[previous.cell]);
      if (!state.last.explored && !greedy.includes(action)) {
        fail(`greedy action ${action} is not among the highest-valued actions ${greedy.join(", ")}`, frame);
      }
      transitions.push({
        traceStep: frame.step, t, from: previous.cell, values: previous.q[previous.cell], greedy, action, explored: state.last.explored,
        cell: to, reward, status, episodeReturn: expected.episodeReturn,
      });
      if (status !== "running") {
        episodes.push({
          episode: state.episode, steps: t, return: expected.episodeReturn, outcome: status,
          actions: transitions.map((step) => step.action[0]).join(""), endStep: frame.step, transitions,
        });
        transitions = [];
      }
    } else {
      expected = { ...previous, episode: previous.episode + 1, t: 0, cell: 0, status: "running", episodeReturn: 0, path: [0], last: null };
      if (state.cell !== 0) fail(`reset placed the agent at cell ${show(state.cell)}, expected the start cell 0`, frame);
      const error = compareState(state, expected);
      if (error) fail(`reset: ${error}`, frame);
    }
  }
  if (frame.state.status === "running") fail("the trace ends before the episode terminates or truncates", frame);
  const total = frame.state.totals.transitions;
  if (total < settings.minTransitions) fail(`recorded ${total} transitions, expected at least ${settings.minTransitions}`, frame);
  return { run: run.id, states: replay.lastStep + 1, transitions: total, episodes };
}

/** Compare trace-derived episode summaries with those of a separate uninstrumented run. */
export function checkSummaries(result, uninstrumented, source = "trace.jsonl") {
  const recorded = result.episodes;
  for (let index = 0; index < Math.max(recorded.length, uninstrumented.length); index++) {
    const episode = recorded[index];
    const expected = uninstrumented[index];
    const summary = episode && { episode: episode.episode, steps: episode.steps, return: episode.return, outcome: episode.outcome, actions: episode.actions };
    if (!isDeepStrictEqual(summary, expected)) {
      throw new FixtureError(
        `trace summary ${show(summary ?? "missing")} differs from the uninstrumented run ${show(expected ?? "missing")}`,
        { run: result.run, source, line: episode && episode.endStep + 1, episode: episode?.episode ?? expected?.episode },
      );
    }
  }
}

/** Align one episode of two checked runs by step within the episode and find the first differing action. */
export function compareEpisode(results, episode) {
  const [a, b] = results.map((result) => {
    const found = result.episodes[episode];
    if (!found) throw new Error(`${result.run} has no episode ${episode}`);
    return found;
  });
  let step = 1;
  while (step <= Math.min(a.steps, b.steps) && a.transitions[step - 1].action === b.transitions[step - 1].action) step++;
  const describe = (result, found) => {
    const { traceStep, ...transition } = found.transitions[step - 1] ?? {};
    return [result.run, found.transitions[step - 1] ? { traceStep, ...transition } : { ended: true, steps: found.steps, outcome: found.outcome }];
  };
  return {
    episode,
    firstDifference: step > Math.max(a.steps, b.steps) ? null : {
      step,
      runs: Object.fromEntries([describe(results[0], a), describe(results[1], b)]),
    },
    outcomes: Object.fromEntries(results.map((result, index) => {
      const found = [a, b][index];
      const resetStep = found.endStep - found.steps;
      return [result.run, { resetStep, steps: found.steps, return: found.return, outcome: found.outcome, actions: found.actions }];
    })),
  };
}

function uninstrumentedSummaries(runId, runsPath) {
  const python = process.env.ALGOVIZ_PYTHON ?? "python";
  const output = execFileSync(python, ["-B", join(here, "frozenlake.py"), runId, "--runs", runsPath], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(output).episodes;
}

/**
 * Check every configured run recorded under `directory` and compare them at `episode`.
 * @param {string} directory
 * @param {{ runsPath?: string, episode?: number }} [options]
 */
export function checkRecording(directory, { runsPath = join(here, "runs.json"), episode } = {}) {
  const config = JSON.parse(readFileSync(runsPath, "utf8"));
  const results = config.runs.map((run) => {
    const source = `${run.id}/trace.jsonl`;
    const traceBytes = readFileSync(join(directory, run.id, "trace.jsonl"));
    const specText = readFileSync(join(directory, run.id, "visualization.json"), "utf8");
    const result = checkRun({ traceText: traceBytes.toString("utf8"), specText, source, settings: config.settings, run });
    checkSummaries(result, uninstrumentedSummaries(run.id, runsPath), source);
    return { ...result, sha256: createHash("sha256").update(traceBytes).digest("hex") };
  });
  return {
    runs: Object.fromEntries(results.map(({ run, states, transitions, episodes, sha256 }) => [run, { states, transitions, episodes: episodes.length, sha256 }])),
    comparison: episode === undefined ? undefined : compareEpisode(results, episode),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: { runs: { type: "string" }, episode: { type: "string" } } });
  if (positionals.length !== 1) {
    console.error("Usage: node examples/frozenlake/check.mjs <recorded-directory> [--episode <n>] [--runs <runs.json>]");
    process.exit(2);
  }
  const expected = JSON.parse(readFileSync(join(here, "expected.json"), "utf8"));
  try {
    const report = checkRecording(positionals[0], {
      runsPath: values.runs, episode: values.episode === undefined ? expected.comparison.episode : Number(values.episode),
    });
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
