import { firstDifferentAction, indexRun } from "../../packages/core/comparison.js";
import { attachInspection } from "./inspection.js";
import { attachViews } from "./views.js";

function attachRun(container, input, run, renderers, index) {
  const panel = document.getElementById("comparison-run").content.firstElementChild.cloneNode(true);
  const id = run.replay.seek(0).state.run?.id ?? `${index === 0 ? "Left" : "Right"} · ${input.traceSource}`;
  panel.dataset.run = String(id);
  panel.querySelector("h2").textContent = String(id);
  container.append(panel);

  const status = panel.querySelector("[data-run-status]");
  const content = panel.querySelector("[data-run-content]");
  const renderViews = attachViews(panel.querySelector(".views"), input.specText, renderers, index, "h3");
  const inspect = attachInspection(run.replay, panel);
  return (episode, step) => {
    const entry = run.episodes[episode];
    const available = entry && step < entry.actions.length;
    content.hidden = !available;
    panel.dataset.available = String(Boolean(available));
    if (!available) {
      status.textContent = entry ? `Episode ended at step ${entry.actions.length - 1}` : "Episode unavailable";
      return;
    }
    const frame = run.replay.seek(entry.start + step);
    const { last, status: outcome } = frame.state;
    renderViews(frame);
    inspect(frame);
    status.textContent = last?.action
      ? [last.action, typeof last.reward === "number" && `Reward ${last.reward}`, outcome].filter(Boolean).join(" · ")
      : step === 0 ? "Episode start" : `Trace step ${frame.step}`;
  };
}

export function startComparison(inputs, renderers, { seek, previous, next, stepLabel, error, showError }) {
  const runs = inputs.map(indexRun);
  const container = document.getElementById("comparison");
  const form = document.getElementById("episode-form");
  const episodeField = document.getElementById("episode");
  const difference = document.getElementById("first-difference");
  const lastEpisode = Math.max(...runs.map((run) => run.episodes.length)) - 1;
  const show = inputs.map((input, index) => attachRun(container, input, runs[index], renderers, index));
  let episode = 0;
  let step = 0;
  let differenceStep;

  document.getElementById("single-run").hidden = true;
  document.getElementById("source").textContent = "Run comparison";
  container.hidden = false;
  form.hidden = false;
  difference.hidden = false;
  episodeField.max = String(lastEpisode);

  function lastStep(value) {
    return Math.max(...runs.map((run) => run.episodes[value]?.actions.length ?? 0)) - 1;
  }

  function select(nextEpisode, nextStep) {
    try {
      for (const update of show) update(nextEpisode, nextStep);
      if (nextEpisode !== episode || differenceStep === undefined) {
        differenceStep = firstDifferentAction(runs, nextEpisode);
      }
      episode = nextEpisode;
      step = nextStep;
      const max = lastStep(episode);
      episodeField.value = String(episode);
      seek.max = String(max);
      seek.value = String(step);
      seek.disabled = max === 0;
      previous.disabled = episode === 0 && step === 0;
      next.disabled = episode === lastEpisode && step === max;
      difference.disabled = differenceStep === undefined;
      stepLabel.value = `Episode ${episode} · Step ${step} of ${max}`;
      error.hidden = true;
    } catch (cause) {
      episodeField.value = String(episode);
      seek.value = String(step);
      showError(cause);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = episodeField.valueAsNumber;
    if (Number.isInteger(value) && value >= 0 && value <= lastEpisode) select(value, 0);
  });
  difference.addEventListener("click", () => select(episode, differenceStep));
  seek.addEventListener("input", () => select(episode, seek.valueAsNumber));
  previous.addEventListener("click", () => step === 0
    ? select(episode - 1, lastStep(episode - 1)) : select(episode, step - 1));
  next.addEventListener("click", () => step === lastStep(episode)
    ? select(episode + 1, 0) : select(episode, step + 1));
  select(0, 0);
}
