import { applyUpdate } from "./json-pointer.js";
import { checkBindings, loadTrace, loadViews, ReplayError } from "./protocol.js";

export { ReplayError } from "./protocol.js";

export function loadReplay(traceText, {
  traceSource = "trace.jsonl",
  specText,
  specSource = "visualization.json",
} = {}) {
  const records = loadTrace(traceText, traceSource);
  const views = specText === undefined ? [] : loadViews(specText, specSource);
  return new TraceReplay(records, views, traceSource);
}

class TraceReplay {
  #records;
  #views;
  #source;
  #frame;

  constructor(records, views, source) {
    this.#records = records;
    this.#views = views;
    this.#source = source;
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

  stepForward() {
    return this.seek(Math.min(this.#frame.step + 1, this.lastStep));
  }

  stepBackward() {
    return this.seek(Math.max(this.#frame.step - 1, 0));
  }

  seek(step) {
    if (!Number.isInteger(step) || step < 0 || step > this.lastStep) {
      throw new RangeError(`Step must be an integer from 0 through ${this.lastStep}`);
    }
    if (step === this.#frame.step) return this.current;

    const start = step > this.#frame.step ? this.#frame : { step: 0, state: this.#records[0].state };
    const candidate = structuredClone(start.state);
    for (let next = start.step + 1; next <= step; next++) {
      const line = next + 1;
      for (const [operationIndex, update] of this.#records[next].updates.entries()) {
        try {
          applyUpdate(candidate, update);
        } catch (error) {
          throw new ReplayError(error.message, {
            source: this.#source, line, operationIndex, path: update.path,
          });
        }
      }
      checkBindings(candidate, this.#views, this.#source, line);
    }

    // Keep the cursor and events together with the last state the caller reached successfully.
    this.#frame = { step, state: candidate, events: this.#records[step].events ?? [] };
    return this.current;
  }
}
