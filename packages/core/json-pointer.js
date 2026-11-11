/** @import { ItemBinding, JsonObject, JsonValue, StateUpdate } from "./types.js" */

/** @param {string} pointer */
function tokens(pointer) {
  if (pointer === "") return [];
  return pointer.slice(1).split("/").map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

/**
 * @param {JsonValue[]} array
 * @param {string} token
 * @param {boolean} [inserting]
 */
function arrayIndex(array, token, inserting = false) {
  if (inserting && token === "-") return array.length;
  if (!/^(?:0|[1-9][0-9]*)$/.test(token)) {
    throw new Error(`Invalid array index ${JSON.stringify(token)}`);
  }

  const index = Number(token);
  const lastIndex = inserting ? array.length : array.length - 1;
  if (index > lastIndex) throw new Error(`Array index ${token} is out of range`);
  return index;
}

/**
 * @param {JsonValue} parent
 * @param {string} key
 * @returns {JsonValue}
 */
function readMember(parent, key) {
  if (Array.isArray(parent)) return parent[arrayIndex(parent, key)];
  if (parent === null || typeof parent !== "object") {
    throw new Error(`Cannot read member ${JSON.stringify(key)} from a scalar`);
  }
  if (!Object.hasOwn(parent, key)) throw new Error(`Missing member ${JSON.stringify(key)}`);
  return parent[key];
}

/**
 * @param {JsonValue} state
 * @param {string} pointer
 */
export function resolvePointer(state, pointer) {
  return tokens(pointer).reduce(readMember, state);
}

/**
 * @param {JsonValue} entry
 * @param {ItemBinding} binding
 */
export function resolveArrayItem(entry, binding) {
  const label = resolvePointer(entry, binding.label);
  if (typeof label !== "string") {
    throw new Error(`Expected a string label at ${JSON.stringify(binding.label)}`);
  }
  return { label, value: resolvePointer(entry, binding.value) };
}

/**
 * @param {JsonObject} state
 * @param {StateUpdate} update
 */
export function applyUpdate(state, { op, path, value }) {
  const parents = tokens(path);
  const key = parents.pop();
  if (key === undefined) throw new Error("Update path must name a state member");
  const parent = parents.reduce(readMember, state);

  if (Array.isArray(parent)) {
    const index = arrayIndex(parent, key, op === "add");
    if (op === "add") parent.splice(index, 0, structuredClone(value));
    else if (op === "remove") parent.splice(index, 1);
    else parent[index] = structuredClone(value);
    return;
  }

  if (parent === null || typeof parent !== "object") {
    throw new Error(`Cannot update member ${JSON.stringify(key)} on a scalar`);
  }
  if (op !== "add") readMember(parent, key);

  if (op === "remove") {
    delete parent[key];
  } else {
    // JSON keys such as __proto__ must become ordinary own properties.
    Object.defineProperty(parent, key, {
      value: structuredClone(value),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
}
