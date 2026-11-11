"""Write AlgoViz v1 execution traces from Python using only the standard library.

Pass the complete observable state to ``TraceWriter.step``. The writer compares it
with the previous state and records the JSON Patch ``add``, ``remove``, and
``replace`` operations that reproduce it.
"""

import json


def _token(key):
    return str(key).replace("~", "~0").replace("/", "~1")


def _same(before, after):
    return type(before) is type(after) and before == after


def diff(before, after, path=""):
    """Return v1 state updates that turn ``before`` into ``after``."""
    if isinstance(before, dict) and isinstance(after, dict):
        updates = [{"op": "remove", "path": f"{path}/{_token(key)}"} for key in before if key not in after]
        for key, value in after.items():
            member = f"{path}/{_token(key)}"
            if key not in before:
                updates.append({"op": "add", "path": member, "value": value})
            else:
                updates.extend(diff(before[key], value, member))
        return updates
    if isinstance(before, list) and isinstance(after, list):
        if len(after) == len(before):
            return [update for index, (old, new) in enumerate(zip(before, after)) for update in diff(old, new, f"{path}/{index}")]
        if len(after) > len(before) and all(_same(old, new) for old, new in zip(before, after)):
            return [{"op": "add", "path": f"{path}/-", "value": value} for value in after[len(before):]]
    if _same(before, after) and not isinstance(before, (dict, list)):
        return []
    if not path:
        raise ValueError("the trace state must remain a JSON object")
    return [{"op": "replace", "path": path, "value": after}]


def _encode(record):
    return json.dumps(record, separators=(",", ":"), ensure_ascii=False, allow_nan=False) + "\n"


def _snapshot(state):
    return json.loads(json.dumps(state, allow_nan=False))


class TraceWriter:
    """Record one run as a v1 JSONL trace."""

    def __init__(self, file, state):
        if not isinstance(state, dict):
            raise TypeError("the initial state must be a dict")
        self._file = file
        self._state = _snapshot(state)
        self.steps = 0
        file.write(_encode({"type": "initial", "version": 1, "state": self._state}))

    def step(self, state, events=None):
        """Record the next state and optional ``{"type": ..., "data": {...}}`` events."""
        after = _snapshot(state)
        record = {"type": "step", "updates": diff(self._state, after)}
        if events:
            record["events"] = events
        self._file.write(_encode(record))
        self._state = after
        self.steps += 1
