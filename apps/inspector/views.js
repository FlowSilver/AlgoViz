import { resolvePointer } from "../../packages/core/json-pointer.js";
import { renderArray, renderGraph } from "../../packages/renderers/index.js";

function viewTitle(id) {
  const title = id.replaceAll(/[-_]+/g, " ").trim() || id;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export function attachViews(container, specText, renderers, runIndex, headingTag = "h2") {
  const spec = JSON.parse(specText);
  container.dataset.layout = spec.layout;
  const panels = spec.views.map((view, index) => {
    const title = viewTitle(view.id);
    const key = `${runIndex}-${index}`;
    const panel = document.createElement("section");
    panel.className = `view view--${view.type}`;
    panel.dataset.viewId = view.id;
    const heading = document.createElement(headingTag);
    heading.id = `view-heading-${key}`;
    heading.textContent = title;
    panel.setAttribute("aria-labelledby", heading.id);
    const content = document.createElement("div");
    panel.append(heading, content);
    container.append(panel);
    let render;
    if (view.type === "graph") render = (data) => renderGraph(data, title, key);
    if (view.type === "array") render = (data) => renderArray(data, view.item);
    if (view.type === "custom") {
      const custom = renderers.get(view.renderer);
      if (typeof custom !== "function") throw new Error(`Missing renderer "${view.renderer}"`);
      render = (data) => custom(data, { id: view.id, title });
    }
    return { view, render, content };
  });

  return (frame) => {
    const nodes = panels.map(({ view, render }) => render(resolvePointer(frame.state, view.source)));
    for (const [index, panel] of panels.entries()) panel.content.replaceChildren(nodes[index]);
  };
}
