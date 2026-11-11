"""Record completed rows from the upstream 0/1 knapsack dynamic programming table."""

import argparse
import json
from pathlib import Path

from upstream_knapsack import knapsack


HERE = Path(__file__).resolve().parent


def load_input(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object containing capacity and items")
    capacity = data.get("capacity")
    items = data.get("items")
    if type(capacity) is not int or capacity <= 0:
        raise ValueError("capacity must be a positive integer")
    if not isinstance(items, list) or not items:
        raise ValueError("items must be a nonempty array")
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            raise ValueError(f"items[{index}] must be an object")
        if not isinstance(item.get("name"), str) or not item["name"]:
            raise ValueError(f"items[{index}].name must be a nonempty string")
        if type(item.get("weight")) is not int or item["weight"] <= 0:
            raise ValueError(f"items[{index}].weight must be a positive integer")
        if type(item.get("value")) is not int:
            raise ValueError(f"items[{index}].value must be an integer")
    return capacity, items


def record(capacity, items):
    weights = [item["weight"] for item in items]
    values = [item["value"] for item in items]
    optimum, table = knapsack(capacity, weights, values, len(items))
    records = [{
        "type": "initial", "version": 1,
        "state": {
            "capacity": capacity,
            "items": items,
            "processedItems": 0,
            "bestByCapacity": [{"capacity": str(limit), "value": value} for limit, value in enumerate(table[0])],
        },
    }]
    for index, (before, after) in enumerate(zip(table[:-1], table[1:], strict=True), start=1):
        updates = [{"op": "replace", "path": "/processedItems", "value": index}]
        updates.extend(
            {"op": "replace", "path": f"/bestByCapacity/{limit}/value", "value": value}
            for limit, (previous, value) in enumerate(zip(before, after, strict=True))
            if value != previous
        )
        records.append({
            "type": "step",
            "updates": updates,
            "events": [{"type": "item.process", "data": {"name": items[index - 1]["name"]}}],
        })
    return records, optimum


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--input", type=Path, default=HERE / "input.json")
    args = parser.parse_args()
    try:
        capacity, items = load_input(args.input)
    except (OSError, ValueError) as error:
        parser.error(f"{args.input}: {error}")

    records, optimum = record(capacity, items)
    spec = (HERE / "visualization.json").read_text(encoding="utf-8")
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "visualization.json").write_text(spec, encoding="utf-8", newline="\n")
    trace = "".join(json.dumps(record, separators=(",", ":")) + "\n" for record in records)
    (args.output / "trace.jsonl").write_text(trace, encoding="utf-8", newline="\n")
    print(json.dumps({"optimalValue": optimum, "states": len(records)}))


if __name__ == "__main__":
    main()
