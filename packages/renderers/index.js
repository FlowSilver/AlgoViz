import { resolveArrayItem } from "../core/json-pointer.js";

const svgNamespace = "http://www.w3.org/2000/svg";
const nodeRadius = 21;

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(svgNamespace, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

function shorten(label, limit) {
  const characters = Array.from(label);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join("")}…` : label;
}

function edgePath(source, target) {
  if (source === target) {
    const { x, y } = source;
    return `M ${x + 16} ${y - 15} C ${x + 52} ${y - 49}, ${x + 2} ${y - 64}, ${x - 4} ${y - 24}`;
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const start = nodeRadius / length;
  const end = (nodeRadius + 4) / length;
  return `M ${source.x + dx * start} ${source.y + dy * start} L ${target.x - dx * end} ${target.y - dy * end}`;
}

function edgeLabelPosition(source, target, lane) {
  if (source === target) return { x: source.x + 34 + lane * 15, y: source.y - 42 };
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const offset = (10 + lane * 14) / Math.hypot(dx, dy);
  return {
    x: (source.x + target.x) / 2 + dy * offset,
    y: (source.y + target.y) / 2 - dx * offset,
  };
}

export function renderGraph({ nodes, edges }, title, viewIndex) {
  if (nodes.length === 0) return empty("No nodes");

  const ordered = [...nodes].sort((a, b) => a.id < b.id ? -1 : Number(a.id > b.id));
  const radius = Math.max(97, ordered.length * 13);
  const width = 2 * (radius + 92);
  const height = 2 * (radius + 55);
  const positions = new Map(ordered.map((node, index) => {
    const angle = index * 2 * Math.PI / ordered.length - Math.PI / 2;
    return [node.id, ordered.length === 1
      ? { x: width / 2, y: height / 2 }
      : { x: width / 2 + radius * Math.cos(angle), y: height / 2 + radius * Math.sin(angle) }];
  }));

  const graph = svgElement("svg", { class: "graph", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": title });
  const arrowId = `edge-arrow-${viewIndex}`;
  const defs = svgElement("defs");
  const marker = svgElement("marker", { id: arrowId, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: "auto" });
  marker.append(svgElement("path", { d: "M 0 0 L 8 4 L 0 8 Z", class: "graph-arrow" }));
  defs.append(marker);
  graph.append(defs);

  const edgeLabels = svgElement("g");
  const labelLanes = new Map();
  for (const edge of edges) {
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    const path = svgElement("path", { class: "graph-edge", "data-edge-id": edge.id, "marker-end": `url(#${arrowId})`, d: edgePath(source, target) });
    const label = typeof edge.label === "string" || typeof edge.label === "number" ? String(edge.label) : "";
    const description = svgElement("title");
    description.textContent = `${edge.source} → ${edge.target}${label ? ` (${label})` : ""}`;
    path.append(description);
    graph.append(path);

    if (label) {
      const key = JSON.stringify([edge.source, edge.target]);
      const lane = labelLanes.get(key) ?? 0;
      labelLanes.set(key, lane + 1);
      const position = edgeLabelPosition(source, target, lane);
      const text = svgElement("text", { ...position, class: "graph-edge-label", "data-edge-label-for": edge.id });
      text.textContent = shorten(label, 18);
      edgeLabels.append(text);
    }
  }
  if (edgeLabels.childElementCount) graph.append(edgeLabels);

  for (const node of ordered) {
    const { x, y } = positions.get(node.id);
    const name = node.label ?? node.id;
    const status = node.status ?? "";
    const group = svgElement("g", { class: "graph-node", transform: `translate(${x} ${y})`, "data-node-id": node.id, "data-status": status });
    const description = svgElement("title");
    description.textContent = status ? `${name} (${status})` : name;
    const label = svgElement("text", { y: 4 });
    label.textContent = shorten(name, 6);
    group.append(description, svgElement("circle", { r: nodeRadius }), label);
    if (status) {
      const state = svgElement("text", { class: "graph-status", y: 35 });
      state.textContent = shorten(status, 18);
      group.append(state);
    }
    graph.append(group);
  }
  return graph;
}

function empty(message) {
  const paragraph = document.createElement("p");
  paragraph.className = "empty";
  paragraph.textContent = message;
  return paragraph;
}

export function renderArray(values, binding) {
  if (values.length === 0) return empty("Empty");
  const list = document.createElement("ol");
  list.className = binding ? "array array--labeled" : "array";
  for (const entry of values) {
    const item = document.createElement("li");
    let value = entry;
    if (binding) {
      const resolved = resolveArrayItem(entry, binding);
      value = resolved.value;
      const label = document.createElement("span");
      label.className = "array-label";
      label.textContent = resolved.label;
      item.dataset.label = resolved.label;
      item.append(label);
    }

    const display = document.createElement("code");
    const json = JSON.stringify(value);
    item.dataset.value = json;
    display.textContent = typeof value === "string" && value !== "" ? value : json;
    if (binding && value === null) display.textContent = binding.nullLabel ?? "—";
    item.append(display);
    list.append(item);
  }
  return list;
}
