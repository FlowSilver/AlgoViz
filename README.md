# AlgoViz

**AI-Native Algorithm Execution Inspector**  
*A local runtime for replaying and inspecting recorded algorithm executions.*

## Try the offline preview

Download the demo HTML from the [latest release](https://github.com/FlowSilver/AlgoViz/releases/latest) and open it in your browser. Step forward, step backward, or seek. Expand **State** to inspect the recorded values and use **Changes** to compare with the preceding recorded step.

To generate the [knapsack preview](examples/knapsack/README.md) from a checkout with Node.js 22 or later:

```sh
npm ci
npm run algoviz -- validate examples/knapsack/visualization.json examples/knapsack/trace.jsonl
npm run algoviz -- preview examples/knapsack/visualization.json examples/knapsack/trace.jsonl
```

Open the printed `file://` URL. The generated HTML embeds the trace, spec, and inspector for offline use. Pass `--output preview.html` to choose a new file path.

## What ships today

- **Local validation and replay.** `validate` checks a JSON visualization spec and its JSONL execution trace. `preview` builds a self-contained inspector with synchronized views and timeline controls. [v1 protocol and replay API](docs/protocol.md)
- **Side-by-side replay.** `compare` aligns two traces by episode and step in one offline HTML file. The FrozenLake example uses a custom grid renderer to investigate two verified 10,000-transition runs. [Record and compare FrozenLake](examples/frozenlake/README.md#compare-the-runs)
- **Graph and Array views.** Graph edges support labels, and Array items can bind separate labels and values. The [BFS](examples/upstream-bfs/README.md) and [Dijkstra](examples/weighted-dijkstra/README.md) examples show graph state and frontier order. The [knapsack example](examples/knapsack/README.md#try-your-own-input) accepts a separate JSON input for capacity and items.
- **Step inspection.** State shows the selected frame as JSON. Changes shows before and after values at the paths that changed from the preceding recorded step.
- **Agent integration.** The [AlgoViz skill](.agents/skills/algoviz/SKILL.md) guides coding agents through choosing observation points, recording the trace, and verifying the result.

## Positioning

**AlgoViz is an extensible algorithm execution inspector and visualization runtime designed for AI coding agents.**

A researcher or developer already has an algorithm and can simply ask their preferred coding agent:

> “Use AlgoViz to visualize my pathfinding algorithm. Show the search space, frontier queue, and cost evolution.”

The agent reads the existing algorithm, identifies meaningful internal states, and creates an adapter with minimal changes to the original implementation. The adapter records the run. AlgoViz validates and replays it with reusable renderers and inspection controls.

AlgoViz **does not need a built-in LLM** and is not intended to replace coding agents such as Codex or Claude Code.

## Why not just ask AI to generate a webpage?

AlgoViz is designed for researchers and engineers who revisit algorithm runs and need reusable tooling for:

- Inspecting state and changes at a known step across synchronized views.
- Saving and sharing execution traces for offline replay.
- Reusing the timeline, renderers, and validator across algorithms.

The working hypothesis is that AI + AlgoViz reduces the effort to build and revise a reliable viewer. The [BFS pilot](benchmarks/README.md), [timed Dijkstra trial](benchmarks/dijkstra/README.md), and [FrozenLake comparison](benchmarks/frozenlake/README.md) report measurements.

## Target users and use cases

The primary audience is algorithm researchers, software engineers, and teams that need repeated access to internal execution state, including:

- Graph search and path planning: expanded nodes, frontier queues, distances, and heuristic costs.
- Dynamic programming and optimization: state tables, iterative convergence, and objective values.
- Reinforcement learning and simulation: environment states, actions, rewards, and intermediate outcomes.
- Novel algorithms: AI-generated adapters without requiring the algorithm to fit a predefined category.

Educational sorting animations may be supported, but they are not the primary differentiator.

## Adapt an algorithm

1. The user asks an AI coding agent for a visualization in an existing repository.
2. The agent inspects the algorithm and available state, then selects Graph, Array, or a locally registered custom renderer.
3. The agent creates an **adapter** by reusing callbacks, logs, or iterators where possible and adding observation hooks where needed.
4. The instrumented run produces an **Execution Trace**; the agent also generates a **Visualization Specification**.
5. AlgoViz validates and loads both inputs, presenting an interactive execution inspector in the browser.
6. The user saves or shares the trace and opens the offline HTML to inspect the run.

> Principle: visualization should not alter the original algorithm's behavior. If an algorithm exposes only its final result, missing internal steps cannot be reconstructed reliably without additional instrumentation.

## Architecture overview

```text
Existing algorithm (Python / C++ / Java / Rust / ...)
                  │
                  ▼
AI Coding Agent ── AlgoViz docs, schemas, CLI / Skill
                  │
                  ▼
Adapter / minimal instrumentation
                  │
           ┌──────┴───────────┐
           ▼                  ▼
    Execution Trace    Visualization Specification
   (states and events)  (views, bindings, layout)
           └──────┬───────────┘
                  ▼
           AlgoViz Runtime
      validate · reconstruct · replay · sync
                  │
                  ▼
  Graph and Array views · State and Changes panels
                  │
                  ▼
        Browser-based Algorithm Inspector
```

### Three core abstractions

- **State:** observable algorithm data at a particular step, modeled in a serializable way with stable identities.
- **View:** declarative mapping from recorded data to a Graph, Array, or registered custom component.
- **Transition:** state changes recorded in the trace, optionally augmented by semantic events for richer animation.

### Two primary inputs

| Input | Responsibility |
| --- | --- |
| **Visualization Specification** | Describes views, data sources, visual encodings, and layout without hard-coding algorithm names. |
| **Execution Trace** | Records ordered state changes, optional semantic events, and metadata for deterministic replay. |

Generic state updates are the source of truth for reconstruction. Semantic events such as `node.visit` or `array.swap` may enhance animations, but must not create a conflicting second state model.

## Roadmap

The [v0.4.0 milestone](https://github.com/FlowSilver/AlgoViz/milestone/4) tracks the FrozenLake comparison and npm publication. See the [development plan](OPEN_SOURCE_DEVELOPMENT.md#12-next-steps) and [open design questions](DECISIONS.md#open-design-questions) for what comes next.

## Minimum viable product (v0.1.0)

The first release established deterministic replay, the Graph and Array views, and an end-to-end adaptation of an existing BFS implementation. [v0.1.0 release](https://github.com/FlowSilver/AlgoViz/releases/tag/v0.1.0) · [First release scope](DECISIONS.md#v010-release-scope)

## What success looks like

The benchmark must be **asking AI to generate a standalone visualization directly**, not merely writing a frontend by hand. Measure time to first correct result, human interventions, correctness of displayed state, cost of adding views, value for comparing repeated runs, and performance on large traces.

**Key question: for complex algorithms and iterative investigation, does AlgoViz actually make visualization easier and more reliable than AI-generated standalone code?**

## Non-goals for now

- Replacing AI coding agents or bundling a proprietary language model.
- Automatically inferring every internal execution step from arbitrary untouched source code.
- Providing a universal hosted compiler/runtime for all languages in the MVP.
- Turning the DSL into a full frontend programming language with loops, functions, and arbitrary scripting.

## Contributing

Small algorithm examples with expected states and feedback on the [v1 protocol](docs/protocol.md) are welcome.

- [Contributing guide](CONTRIBUTING.md) for opening issues and submitting changes.
- [Design decisions](DECISIONS.md) and [development plan](OPEN_SOURCE_DEVELOPMENT.md) for the release scope and proposed backlog.
- [Code of conduct](CODE_OF_CONDUCT.md) and [security policy](SECURITY.md) for reporting concerns.

## License

AlgoViz is licensed under the [Apache License 2.0](LICENSE).
The vendored algorithms retain their upstream MIT licenses. [BFS license](examples/upstream-bfs/LICENSE-upstream.md) · [Dijkstra license](benchmarks/dijkstra/LICENSE-upstream.md) · [Knapsack license](examples/knapsack/LICENSE-upstream.md)

