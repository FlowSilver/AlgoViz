import { loadReplay } from "../../packages/core/index.js";
import { resolvePointer } from "../../packages/core/json-pointer.js";
import { renderArray, renderGraph } from "../../packages/renderers/index.js";
import { attachInspection } from "./inspection.js";

const error = document.getElementById("error");
const stepLabel = document.getElementById("step");
const views = document.getElementById("views");
const seek = document.getElementById("seek");
const previous = document.getElementById("previous");
const next = document.getElementById("next");

function showError(cause) {
  error.textContent = cause.message;
  error.hidden = false;
}

function viewTitle(id) {
  const title = id.replaceAll(/[-_]+/g, " ").trim() || id;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function start() {
  const { traceText, specText, traceSource, specSource } = JSON.parse(document.getElementById("preview-data").textContent);
  const replay = loadReplay(traceText, { specText, traceSource, specSource });
  const inspect = attachInspection(replay);
  const spec = JSON.parse(specText);
  views.dataset.layout = spec.layout;
  document.getElementById("source").textContent = traceSource;
  seek.max = String(replay.lastStep);
  seek.disabled = replay.lastStep === 0;

  const panels = spec.views.map((view, index) => {
    const title = viewTitle(view.id);
    const panel = document.createElement("section");
    panel.className = `view view--${view.type}`;
    panel.dataset.viewId = view.id;
    const heading = document.createElement("h2");
    heading.id = `view-heading-${index}`;
    heading.textContent = title;
    panel.setAttribute("aria-labelledby", heading.id);
    const content = document.createElement("div");
    panel.append(heading, content);
    views.append(panel);
    return { view, title, content };
  });

  function render(frame) {
    const { step, state } = frame;
    const nodes = panels.map(({ view, title }, index) => {
      const data = resolvePointer(state, view.source);
      return view.type === "graph" ? renderGraph(data, title, index) : renderArray(data, view.item);
    });
    for (const [index, panel] of panels.entries()) panel.content.replaceChildren(nodes[index]);
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

try {
  start();
} catch (cause) {
  stepLabel.value = "Trace unavailable";
  showError(cause);
}
