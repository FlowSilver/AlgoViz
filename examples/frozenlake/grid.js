const tiles = { S: "Start", F: "Ice", H: "Hole", G: "Goal" };
const actions = ["Left", "Down", "Right", "Up"];
const styles = `
  .lake { padding: 1rem; }
  .lake-grid { display: grid; gap: .3rem; max-width: 24rem; margin: 0 auto; }
  .lake-cell { display: grid; place-content: center; gap: .1rem; min-height: 2.7rem; text-align: center;
    border: 1px solid #cbd9df; border-radius: .35rem; background: #eff7fa; color: #214155; }
  .lake-cell[data-tile="S"] { background: #f4f1e8; }
  .lake-cell[data-tile="G"] { background: #dff3db; }
  .lake-cell[data-tile="H"] { background: #e1e7ed; }
  .lake-cell[data-visited="true"] { box-shadow: inset 0 -3px #51a6b6; }
  .lake-cell[data-agent="true"] { outline: 2px solid #135974; outline-offset: -2px; }
  .lake-cell small { font: .72rem var(--mono, monospace); }
  .lake-path { overflow-wrap: anywhere; color: var(--muted); font: .78rem/1.5 var(--mono, monospace); }
  .lake-values { display: flex; flex-wrap: wrap; gap: .35rem .8rem; margin: 0; font: .8rem var(--mono, monospace); }
  .lake-values div { display: flex; gap: .35rem; }
  .lake-values dd { margin: 0; font-weight: 700; }
`;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export default function renderFrozenLake({ map, cell, path, q }) {
  const wrapper = element("div", undefined, "lake");
  wrapper.append(element("style", styles));
  const grid = element("div", undefined, "lake-grid");
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "FrozenLake grid");
  grid.style.gridTemplateColumns = `repeat(${map[0].length}, minmax(0, 1fr))`;
  const visited = new Set(path);
  for (const [index, tile] of Array.from(map.join("")).entries()) {
    const atAgent = index === cell;
    const square = element("div", undefined, "lake-cell");
    Object.assign(square.dataset, { cell: index, tile, visited: visited.has(index), agent: atAgent });
    square.append(element("small", index), element("small", atAgent ? `Agent · ${tiles[tile]}` : tiles[tile]));
    grid.append(square);
  }
  const pathLabel = element("p", `Path ${path.join(" → ")}`, "lake-path");
  pathLabel.dataset.path = JSON.stringify(path);
  const values = element("dl", undefined, "lake-values");
  values.setAttribute("aria-label", `Action values at cell ${cell}`);
  for (const [index, action] of actions.entries()) {
    const value = q[cell][index];
    const entry = element("div");
    const label = element("dt", action);
    const display = element("dd", Number(value.toFixed(4)));
    Object.assign(display.dataset, { action: action.toUpperCase(), q: value });
    entry.append(label, display);
    values.append(entry);
  }
  wrapper.append(grid, pathLabel, values);
  return wrapper;
}
