import { Ajv2020 } from "ajv/dist/2020.js";
import { visit } from "jsonc-parser";
import graphSchema from "../../schemas/graph-view-data.schema.json" with { type: "json" };
import traceSchema from "../../schemas/trace-record.schema.json" with { type: "json" };
import specSchema from "../../schemas/visualization-spec.schema.json" with { type: "json" };
import { resolveArrayItem, resolvePointer } from "./json-pointer.js";

/** @import { ValidateFunction, ErrorObject } from "ajv" */
/** @import { GraphViewData, InitialRecord, ItemBinding, JsonObject, JsonValue, ReplayLocation, StepRecord, TraceRecords, ViewSpec, VisualizationSpec } from "./types.js" */

const ajv = new Ajv2020({ ownProperties: true });
ajv.addSchema(traceSchema, "trace-record");
const validateInitial = /** @type {ValidateFunction<InitialRecord>} */ (recordValidator("initial"));
const validateStep = /** @type {ValidateFunction<StepRecord>} */ (recordValidator("step"));
/** @type {ValidateFunction<VisualizationSpec>} */
const validateSpec = ajv.compile(specSchema);
/** @type {ValidateFunction<GraphViewData>} */
const validateGraph = ajv.compile(graphSchema);

/** @param {"initial" | "step"} type */
function recordValidator(type) {
  const validate = ajv.getSchema(`trace-record#/$defs/${type}`);
  if (!validate) throw new Error(`Missing trace schema for ${type}`);
  return validate;
}

export class ReplayError extends Error {
  /**
   * @param {string} message
   * @param {ReplayLocation} location
   */
  constructor(message, { source, line, operationIndex, path, viewId }) {
    const location = line === undefined ? source : `${source}:${line}`;
    const subject = operationIndex !== undefined ? ` update ${operationIndex}`
      : viewId !== undefined ? ` view ${JSON.stringify(viewId)}` : "";
    const pointer = path === undefined ? "" : ` at ${JSON.stringify(path)}`;
    super(`${location}${subject}${pointer}: ${message}`);
    this.name = "ReplayError";
    this.source = source;
    this.line = line;
    this.operationIndex = operationIndex;
    this.path = path;
    this.viewId = viewId;
  }
}

/**
 * @param {string} text
 * @param {ReplayLocation} location
 * @returns {unknown}
 */
function parseJson(text, location) {
  try {
    const value = JSON.parse(text, (_key, entry) => {
      if (typeof entry === "number" && !Number.isFinite(entry)) {
        throw new Error("Number is outside the finite JavaScript range");
      }
      return entry;
    });
    /** @type {Set<string>[]} */
    const keys = [];
    // JSON.parse checks syntax, while the visitor sees keys before duplicates are discarded.
    visit(text, {
      onObjectBegin() { keys.push(new Set()); },
      onObjectEnd() { keys.pop(); },
      onObjectProperty(key) {
        const objectKeys = keys.at(-1);
        if (!objectKeys) throw new Error("Invalid JSON object");
        if (objectKeys.has(key)) throw new Error(`Duplicate member ${JSON.stringify(key)}`);
        objectKeys.add(key);
      },
    });
    return value;
  } catch (error) {
    throw new ReplayError(error instanceof Error ? error.message : String(error), location);
  }
}

/** @param {ErrorObject | undefined} problem */
function schemaMessage(problem) {
  return [problem?.instancePath, problem?.message ?? "Invalid input"].filter(Boolean).join(" ");
}

/**
 * @template T
 * @param {string} lineText
 * @param {ReplayLocation} location
 * @param {"initial" | "step"} expected
 * @param {ValidateFunction<T>} validate
 * @returns {T}
 */
function readRecord(lineText, location, expected, validate) {
  if (lineText.trim() === "") throw new ReplayError("Blank trace line", location);
  const record = parseJson(lineText, location);
  if (typeof record !== "object" || record === null || !("type" in record) || record.type !== expected) {
    throw new ReplayError(`Expected a record with type ${JSON.stringify(expected)}`, location);
  }
  if (validate(record)) return record;

  const problem = validate.errors?.[0];
  const operation = /^\/updates\/(\d+)(?:\/|$)/.exec(problem?.instancePath ?? "");
  if (operation && "updates" in record && Array.isArray(record.updates)) {
    location.operationIndex = Number(operation[1]);
    const path = record.updates[location.operationIndex]?.path;
    if (typeof path === "string") location.path = path;
  }
  throw new ReplayError(schemaMessage(problem), location);
}

/**
 * @param {string} text
 * @param {string} source
 * @returns {TraceRecords}
 */
export function loadTrace(text, source) {
  if (typeof text !== "string") throw new TypeError("Trace input must be decoded JSONL text");
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  const first = lines.shift();
  if (first === undefined) throw new ReplayError("Expected an initial record", { source, line: 1 });
  const initial = readRecord(first, { source, line: 1 }, "initial", validateInitial);
  return [initial, ...lines.map((text, index) => readRecord(text, { source, line: index + 2 }, "step", validateStep))];
}

/**
 * @param {string} text
 * @param {string} source
 */
export function loadViews(text, source) {
  if (typeof text !== "string") throw new TypeError("Spec input must be decoded JSON text");
  const spec = parseJson(text, { source });
  if (!validateSpec(spec)) throw new ReplayError(schemaMessage(validateSpec.errors?.[0]), { source });

  const ids = new Set();
  for (const view of spec.views) {
    if (ids.has(view.id)) throw new ReplayError("Duplicate view ID", { source, viewId: view.id });
    ids.add(view.id);
  }
  return spec.views;
}

/** @param {JsonValue} graph */
function checkGraph(graph) {
  if (!validateGraph(graph)) throw new Error(schemaMessage(validateGraph.errors?.[0]));
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

/**
 * @param {JsonValue} array
 * @param {ItemBinding | undefined} binding
 */
function checkArray(array, binding) {
  if (!Array.isArray(array)) throw new Error("Expected an array");
  if (!binding) return;
  for (const [index, entry] of array.entries()) {
    try {
      resolveArrayItem(entry, binding);
    } catch (error) {
      throw new Error(`Array item ${index}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * @param {JsonObject} state
 * @param {ViewSpec[]} views
 * @param {string} source
 * @param {number} line
 */
export function checkBindings(state, views, source, line) {
  for (const view of views) {
    try {
      const value = resolvePointer(state, view.source);
      if (view.type === "graph") checkGraph(value);
      else if (view.type === "array") checkArray(value, view.item);
    } catch (error) {
      throw new ReplayError(error instanceof Error ? error.message : String(error), { source, line, viewId: view.id, path: view.source });
    }
  }
}
