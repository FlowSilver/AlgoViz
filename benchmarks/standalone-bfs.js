// One-off offline viewer used as the baseline for the BFS pilot.
import { readFile, writeFile } from "node:fs/promises";

const [source, output, option] = process.argv.slice(2);
if (!source || !output || (option !== undefined && option !== "--visited")) {
  throw new Error("Usage: node benchmarks/standalone-bfs.js <expected-states.json> <output.html> [--visited]");
}

const fixture = JSON.parse(await readFile(source, "utf8"));
const data = JSON.stringify(fixture).replaceAll("<", "\\u003c");
const visited = option === "--visited";
await writeFile(output, `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Standalone BFS</title>
<style>body{font:1rem system-ui;margin:1rem}svg{width:min(100%,28rem)}text{text-anchor:middle;font-size:12px}ol{display:flex;gap:1.5rem}</style>
<h1>Standalone BFS</h1>
<button id="previous">Previous</button><button id="next">Next</button>
<label>Seek <input id="seek" type="range" min="0"></label> <output id="step"></output>
<h2>Search graph</h2><svg id="graph" viewBox="0 0 380 300" role="img" aria-label="Search graph"></svg>
<h2>Frontier</h2><ol id="frontier"></ol>
${visited ? '<h2>Visited</h2><ol id="visited"></ol>' : ""}
<script type="application/json" id="data">${data}</script>
<script>
const { edges, steps } = JSON.parse(document.getElementById('data').textContent);
const graph = document.getElementById('graph');
const seek = document.getElementById('seek');
const previous = document.getElementById('previous');
const next = document.getElementById('next');
const ids = Object.keys(steps[0].nodeStatus);
const positions = new Map(ids.map((id, index) => {
  const angle = 2 * Math.PI * index / ids.length;
  return [id, [190 + 100 * Math.sin(angle), 150 - 100 * Math.cos(angle)]];
}));
function svg(name, attrs, label) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (label !== undefined) el.textContent = label;
  return el;
}
const defs = svg('defs', {});
const marker = svg('marker', { id: 'arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' });
marker.append(svg('path', { d: 'M0 0 L8 4 L0 8 Z', fill: '#516357' }));
defs.append(marker);
function drawList(id, values) {
  document.getElementById(id).replaceChildren(...values.map((value) => {
    const item = document.createElement('li');
    item.textContent = value;
    return item;
  }));
}
let current = 0;
function draw(index) {
  current = index;
  const frame = steps[index];
  graph.replaceChildren(defs);
  for (const edge of edges) {
    const [x, y] = positions.get(edge.source);
    const [tx, ty] = positions.get(edge.target);
    const dx = tx - x;
    const dy = ty - y;
    const scale = 19 / Math.hypot(dx, dy);
    const path = edge.source === edge.target
      ? 'M' + (x + 12) + ' ' + (y - 12) + ' q 40 -40 -15 -9'
      : 'M' + (x + dx * scale) + ' ' + (y + dy * scale) + ' L' + (tx - dx * scale) + ' ' + (ty - dy * scale);
    graph.append(svg('path', { d: path, stroke: '#516357', fill: 'none', 'marker-end': 'url(#arrow)', 'data-edge-id': edge.id }));
  }
  for (const id of ids) {
    const [x, y] = positions.get(id);
    const status = frame.nodeStatus[id];
    const fill = { queued: '#f9ead1', visited: '#d9efe1' }[status] ?? '#f1f4ef';
    graph.append(svg('circle', { cx: x, cy: y, r: 18, fill, stroke: '#516357', 'data-node-id': id, 'data-status': status }));
    graph.append(svg('text', { x, y: y + 4 }, id), svg('text', { x, y: y + 32 }, status));
  }
  drawList('frontier', frame.frontier);
  ${visited ? "drawList('visited', ids.filter((id) => frame.nodeStatus[id] === 'visited'));" : ""}
  previous.disabled = index === 0;
  next.disabled = index === steps.length - 1;
  seek.value = index;
  document.getElementById('step').textContent = 'Step ' + index + ' of ' + (steps.length - 1);
}
previous.onclick = () => draw(current - 1);
next.onclick = () => draw(current + 1);
seek.max = steps.length - 1;
seek.oninput = () => draw(seek.valueAsNumber);
draw(0);
</script></html>
`, { encoding: "utf8", flag: "wx" });
