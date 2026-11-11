# Record an existing BFS implementation

This example adapts Omkar Pathak's breadth-first search from TheAlgorithms/Python. The vendored `upstream_bfs.py` is identical to the pinned upstream file and keeps its [MIT license](LICENSE-upstream.md). [Pinned source](https://github.com/TheAlgorithms/Python/blob/bc8df6de3143b417c4d174200fd7edd0dbba4ce3/graphs/breadth_first_search.py)

The [adapter](adapter.py) observes the algorithm's existing FIFO queue. It records the initial frontier and the frontier after each processed vertex. It runs BFS first with the original queue, then with the observed queue, and checks that the returned vertex sets agree. The graph contains a cycle, self-loops, and a vertex unreachable from the default start.

From the repository root with Python 3.10+ and Node.js 22+:

```sh
python -B examples/upstream-bfs/adapter.py bfs-run
npm ci
npm run algoviz -- validate bfs-run/visualization.json bfs-run/trace.jsonl
npm run algoviz -- preview bfs-run/visualization.json bfs-run/trace.jsonl
```

Open the printed URL in a browser. The checked-in [spec](visualization.json) and [trace](trace.jsonl) were generated from start vertex `0`. [Expected states](expected-states.json) records the graph and frontier across its six frames. The browser test regenerates the example, compares it with these files, and checks the inspector with HTTP requests blocked. It also checks the original algorithm's result from start vertices `2` and `5`.
