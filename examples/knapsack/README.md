# Inspect a knapsack run

This example records the dynamic programming table returned by the unmodified [upstream knapsack algorithm](upstream_knapsack.py). Step 0 contains the empty row. Each following step represents the completed row for one more item. The default run reaches a best value of `18` at capacity `6`, using the compass and water. [Pinned upstream source](https://github.com/TheAlgorithms/Python/blob/0525ef5da830e3bbebcc25c0bde6162971480aee/dynamic_programming/knapsack.py) · [MIT license](LICENSE-upstream.md)

## Replay the recorded run

From the AlgoViz checkout with Node.js 22 or later:

```sh
npm ci
npm run algoviz -- validate examples/knapsack/visualization.json examples/knapsack/trace.jsonl
npm run algoviz -- preview examples/knapsack/visualization.json examples/knapsack/trace.jsonl
```

Open the printed file URL. The Array view displays the best value at every capacity for the selected row. Expand **State** to see the input, processed item count, and recorded row. In **Changes**, step 3 shows `/bestByCapacity/6/value` rising from `16` to `18`.

## Try your own input

Copy [input.json](input.json) to `my-knapsack.json` and edit `capacity` or `items`. Use a positive integer capacity, at least one named item, positive integer weights, and integer values. Run the adapter with Python 3.10 or later:

```sh
python -B examples/knapsack/adapter.py knapsack-custom --input my-knapsack.json
npm run algoviz -- validate knapsack-custom/visualization.json knapsack-custom/trace.jsonl
npm run algoviz -- preview knapsack-custom/visualization.json knapsack-custom/trace.jsonl
```

With the default items, changing capacity to `5` gives an optimum of `16`. The [adapter](adapter.py) reads the input, runs the original implementation, and serializes its returned table. Browser tests compare all four default frames and their changes with expected values, and also verify the custom capacity run.
