import { loadReplay, ReplayError } from "./index.js";

/** @import { ReplayOptions } from "./types.js" */

/**
 * Index a run by its zero-based episode and step coordinates, validating each frame.
 * @param {ReplayOptions & { traceText: string }} input
 */
export function indexRun({ traceText, ...options }) {
  const replay = loadReplay(traceText, { ...options, checkpointInterval: 128 });
  /** @type {{ start: number, actions: (string | undefined)[] }[]} */
  const episodes = [];
  let frame = replay.current;
  while (true) {
    const { episode, t, last } = frame.state;
    const current = episodes.at(-1);
    if (episode === episodes.length && t === 0) {
      episodes.push({ start: frame.step, actions: [undefined] });
    } else if (current && episode === episodes.length - 1 && t === current.actions.length) {
      const action = last && typeof last === "object" && !Array.isArray(last) ? last.action : undefined;
      current.actions.push(typeof action === "string" ? action : undefined);
    } else {
      throw new ReplayError("Expected consecutive zero-based episode and t values", {
        source: options.traceSource ?? "trace.jsonl", line: frame.step + 1,
      });
    }
    if (frame.step === replay.lastStep) return { replay, episodes };
    frame = replay.stepForward();
  }
}

/**
 * Find the first transition with a different recorded action in the shared part of an episode.
 * @param {ReturnType<typeof indexRun>[]} runs
 * @param {number} episode
 */
export function firstDifferentAction(runs, episode) {
  const [a, b] = runs.map((run) => run.episodes[episode]?.actions ?? []);
  for (let step = 1; step < Math.min(a.length, b.length); step++) {
    if (a[step] !== undefined && b[step] !== undefined && a[step] !== b[step]) return step;
  }
  return undefined;
}
