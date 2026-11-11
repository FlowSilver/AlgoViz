/** @import { JsonObject, JsonValue, StateChange } from "./types.js" */

/**
 * @param {JsonValue | undefined} value
 * @returns {value is JsonObject}
 */
function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** @param {string} key */
function escapeToken(key) {
  return key.replaceAll("~", "~0").replaceAll("/", "~1");
}

/**
 * @param {JsonValue | undefined} before
 * @param {JsonValue | undefined} after
 * @param {string} path
 * @param {StateChange[]} changes
 */
function compare(before, after, path, changes) {
  if (before === after) return;

  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index++) {
      compare(before[index], after[index], `${path}/${index}`, changes);
    }
    return;
  }

  if (isObject(before) && isObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      compare(
        Object.hasOwn(before, key) ? before[key] : undefined,
        Object.hasOwn(after, key) ? after[key] : undefined,
        `${path}/${escapeToken(key)}`,
        changes,
      );
    }
    return;
  }

  if (before === undefined) {
    if (after !== undefined) changes.push({ kind: "added", path, after });
  } else if (after === undefined) {
    changes.push({ kind: "removed", path, before });
  } else {
    changes.push({ kind: "changed", path, before, after });
  }
}

/**
 * @param {JsonObject} before
 * @param {JsonObject} after
 * @returns {StateChange[]}
 */
export function diffStates(before, after) {
  /** @type {StateChange[]} */
  const changes = [];
  compare(before, after, "", changes);
  return changes;
}
