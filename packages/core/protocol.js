import Ajv2020 from "ajv/dist/2020.js";
import { visit } from "jsonc-parser";
import graphSchema from "../../schemas/graph-view-data.schema.json" with { type: "json" };
import traceSchema from "../../schemas/trace-record.schema.json" with { type: "json" };
import specSchema from "../../schemas/visualization-spec.schema.json" with { type: "json" };
import { resolvePointer } from "./json-pointer.js";

const ajv = new Ajv2020({ ownProperties: true });
ajv.addSchema(traceSchema, "trace-record");
const validateInitial = ajv.getSchema("trace-record#/$defs/initial");
const validateStep = ajv.getSchema("trace-record#/$defs/step");
const validateSpec = ajv.compile(specSchema);
const validateGraph = ajv.compile(graphSchema);

export class ReplayError extends Error {
  constructor(message, { source, line, operationIndex, path, viewId }) {
    const location = line === undefined ? source : `${source}:${line}`;
    const subject = operationIndex !== undefined ? ` update ${operationIndex}`
      : viewId !== undefined ? ` view ${JSON.stringify(viewId)}` : "";
    const pointer = path === undefined ? "" : ` at ${JSON.stringify(path)}`;
    super(`${location}${subject}${pointer}: ${message}`);
    this.name = "ReplayError";
    Object.assign(this, { source, line, operationIndex, path, viewId });
  }
}

function parseJson(text, location) {
  try {
    const value = JSON.parse(text, (_key, entry) => {
      if (typeof entry === "number" && !Number.isFinite(entry)) {
        throw new Error("Number is outside the finite JavaScript range");
      }
      return entry;
    });
    const keys = [];
    // JSON.parse checks syntax, while the visitor sees keys before duplicates are discarded.
    visit(text, {
      onObjectBegin() { keys.push(new Set()); },
      onObjectEnd() { keys.pop(); },
      onObjectProperty(key) {
        const objectKeys = keys.at(-1);
        if (objectKeys.has(key)) throw new Error(`Duplicate member ${JSON.stringify(key)}`);
        objectKeys.add(key);
      },
    });
    return value;
  } catch (error) {
    throw new ReplayError(error.message, location);
  }
}

function schemaMessage({ instancePath, message }) {
  return instancePath ? `${instancePath} ${message}` : message;
}

export function loadTrace(text, source) {
  if (typeof text !== "string") throw new TypeError("Trace input must be decoded JSONL text");
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length === 0) throw new ReplayError("Expected an initial record", { source, line: 1 });

  return lines.map((lineText, index) => {
    const location = { source, line: index + 1 };
    if (lineText.trim() === "") throw new ReplayError("Blank trace line", location);
    const record = parseJson(lineText, location);
    const expected = index === 0 ? "initial" : "step";
    if (record?.type !== expected) {
      throw new ReplayError(`Expected a record with type ${JSON.stringify(expected)}`, location);
    }

    const validate = index === 0 ? validateInitial : validateStep;
    if (!validate(record)) {
      const problem = validate.errors[0];
      const operation = /^\/updates\/(\d+)(?:\/|$)/.exec(problem.instancePath);
      if (operation) {
        location.operationIndex = Number(operation[1]);
        const path = record.updates[location.operationIndex]?.path;
        if (typeof path === "string") location.path = path;
      }
      throw new ReplayError(schemaMessage(problem), location);
    }
    return record;
  });
}

export function loadViews(text, source) {
  if (typeof text !== "string") throw new TypeError("Spec input must be decoded JSON text");
  const spec = parseJson(text, { source });
  if (!validateSpec(spec)) throw new ReplayError(schemaMessage(validateSpec.errors[0]), { source });

  const ids = new Set();
  for (const view of spec.views) {
    if (ids.has(view.id)) throw new ReplayError("Duplicate view ID", { source, viewId: view.id });
    ids.add(view.id);
  }
  return spec.views;
}

function checkGraph(graph) {
  if (!validateGraph(graph)) throw new Error(schemaMessage(validateGraph.errors[0]));
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  if (nodeIds.size !== graph.nodes.length) throw new Error("Graph node IDs must be unique");
  if (edgeIds.size !== graph.edges.length) throw new Error("Graph edge IDs must be unique");
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Edge ${JSON.stringify(edge.id)} refers to a missing node`);
    }
  }
}

export function checkBindings(state, views, source, line) {
  for (const view of views) {
    try {
      const value = resolvePointer(state, view.source);
      if (view.type === "graph") checkGraph(value);
      else if (!Array.isArray(value)) throw new Error("Expected an array");
    } catch (error) {
      throw new ReplayError(error.message, { source, line, viewId: view.id, path: view.source });
    }
  }
}
