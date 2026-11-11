import { applyUpdate } from "./json-pointer.js";
import { checkBindings, loadTrace, loadViews, ReplayError } from "./protocol.js";
import { diffStates } from "./state-changes.js";

/** @import { JsonObject, ReplayFrame, ReplayOptions, StateChange, TraceRecords, ViewSpec } from "./types.js" */

export { ReplayError } from "./protocol.js";

/**
 * @param {string} traceText
 * @param {ReplayOptions} [options]
 */
export function loadReplay(traceText, {
  traceSource = "trace.jsonl",
  specText,
  specSource = "visualization.json",
  checkpointInterval,
} = {}) {
  const records = loadTrace(traceText, traceSource);
  const views = specText === undefined ? [] : loadViews(specText, specSource);
  return new TraceReplay(records, views, traceSource, checkpointInterval);
}

class TraceReplay {
  #records;
  #views;
  #source;
  #checkpointInterval;
  #lastCheckpoint = 0;
  /** @type {Map<number, JsonObject>} */
  #checkpoints = new Map();
  /** @type {ReplayFrame} */
  #frame;
  /** @type {JsonObject | undefined} */
  #previousState;

  /**
   * @param {TraceRecords} records
   * @param {ViewSpec[]} views
   * @param {string} source
   * @param {number} [checkpointInterval]
   */
  constructor(records, views, source, checkpointInterval) {
    if (checkpointInterval !== undefined && (!Number.isSafeInteger(checkpointInterval) || checkpointInterval < 1)) {
      throw new RangeError("Checkpoint interval must be a positive integer");
    }
    this.#records = records;
    this.#views = views;
    this.#source = source;
    this.#checkpointInterval = checkpointInterval;
    const state = records[0].state;
    checkBindings(state, views, source, 1);
    this.#frame = { step: 0, state, events: [] };
  }

  get current() {
    return structuredClone(this.#frame);
  }

  get lastStep() {
    return this.#records.length - 1;
  }

  /** @returns {StateChange[]} */
  get changes() {
    return this.#previousState ? structuredClone(diffStates(this.#previousState, this.#frame.state)) : [];
  }

  stepForward() {
    return this.seek(Math.min(this.#frame.step + 1, this.lastStep));
  }

  stepBackward() {
    return this.seek(Math.max(this.#frame.step - 1, 0));
  }

  /** @param {number} step */
  seek(step) {
    if (!Number.isInteger(step) || step < 0 || step > this.lastStep) {
      throw new RangeError(`Step must be an integer from 0 through ${this.lastStep}`);
    }
    if (step === this.#frame.step) return this.current;

    const interval = this.#checkpointInterval;
    // Start before the target to reconstruct the Changes panel's preceding state.
    const checkpoint = interval ? Math.min(this.#lastCheckpoint, Math.floor((step - 1) / interval) * interval) : 0;
    const start = this.#frame.step < step && this.#frame.step > checkpoint
      ? this.#frame : { step: Math.max(checkpoint, 0), state: this.#checkpoints.get(checkpoint) ?? this.#records[0].state };
    const candidate = structuredClone(start.state);
    /** @type {[number, JsonObject][]} */
    const checkpoints = [];
    /** @type {JsonObject | undefined} */
    let previousState;
    for (let next = start.step + 1; next <= step; next++) {
      const line = next + 1;
      const record = this.#records[next];
      if (record.type !== "step") throw new Error(`Missing step record at line ${line}`);
      if (next === step) previousState = next === start.step + 1 ? start.state : structuredClone(candidate);
      for (const [operationIndex, update] of record.updates.entries()) {
        try {
          applyUpdate(candidate, update);
        } catch (error) {
          throw new ReplayError(error instanceof Error ? error.message : String(error), {
            source: this.#source, line, operationIndex, path: update.path,
          });
        }
      }
      checkBindings(candidate, this.#views, this.#source, line);
      if (interval && next > this.#lastCheckpoint && next % interval === 0) {
        checkpoints.push([next, structuredClone(candidate)]);
      }
    }

    const record = this.#records[step];
    // Commit the frame and its comparison baseline only after successful validation.
    this.#frame = { step, state: candidate, events: record.type === "step" ? record.events ?? [] : [] };
    this.#previousState = previousState;
    for (const [index, state] of checkpoints) {
      this.#checkpoints.set(index, state);
      this.#lastCheckpoint = index;
    }
    return this.current;
  }
}
