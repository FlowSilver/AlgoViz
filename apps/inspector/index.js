import { loadReplay } from "../../packages/core/index.js";
import { startComparison } from "./comparison.js";
import { attachInspection } from "./inspection.js";
import { attachViews } from "./views.js";

const error = document.getElementById("error");
const stepLabel = document.getElementById("step");
const seek = document.getElementById("seek");
const previous = document.getElementById("previous");
const next = document.getElementById("next");

function showError(cause) {
  error.textContent = cause.message;
  error.hidden = false;
}

function startSingle(input, renderers) {
  const replay = loadReplay(input.traceText, input);
  const root = document.getElementById("single-run");
  const inspect = attachInspection(replay, root);
  const renderViews = attachViews(document.getElementById("views"), input.specText, renderers, 0);
  document.getElementById("source").textContent = input.traceSource;
  seek.max = String(replay.lastStep);
  seek.disabled = replay.lastStep === 0;

  function render(frame) {
    const { step } = frame;
    renderViews(frame);
    inspect(frame);
    stepLabel.value = `Step ${step} of ${replay.lastStep}`;
    seek.value = String(step);
    previous.disabled = step === 0;
    next.disabled = step === replay.lastStep;
    error.hidden = true;
  }

  function navigate(action) {
    try {
      render(action());
    } catch (cause) {
      seek.value = String(replay.current.step);
      showError(cause);
    }
  }

  previous.addEventListener("click", () => navigate(() => replay.stepBackward()));
  next.addEventListener("click", () => navigate(() => replay.stepForward()));
  seek.addEventListener("input", () => navigate(() => replay.seek(seek.valueAsNumber)));
  render(replay.current);
}

export function start(renderers) {
  try {
    const { runs } = JSON.parse(document.getElementById("preview-data").textContent);
    if (runs.length === 2) startComparison(runs, renderers, { seek, previous, next, stepLabel, error, showError });
    else startSingle(runs[0], renderers);
  } catch (cause) {
    stepLabel.value = "Trace unavailable";
    showError(cause);
  }
}
