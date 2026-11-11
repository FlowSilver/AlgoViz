# AlgoViz

**AI-Native Algorithm Execution Inspector**  
*A reusable runtime for observing, replaying, debugging, and comparing arbitrary algorithm executions.*

> Status: Pre-release. The replay core can load a v1 trace and navigate its states. The browser inspector and CLI described below are planned.

## Positioning

**AlgoViz is an extensible algorithm execution inspector and visualization runtime designed for AI coding agents.**

A researcher or developer already has an algorithm and can simply ask their preferred coding agent:

> “Use AlgoViz to visualize my pathfinding algorithm. Show the search space, frontier queue, and cost evolution.”

The agent reads the existing algorithm, identifies meaningful internal states, and creates an adapter with minimal intrusion into the original implementation. AlgoViz handles recording, validation, replay, rendering, and interactive inspection. **The user should not need to learn a visualization API or rebuild a frontend for each algorithm.**

AlgoViz **does not need a built-in LLM** and is not intended to replace coding agents such as Codex or Claude Code.

## Why not just ask AI to generate a webpage?

For a simple, one-off animation, AI-generated standalone code may be the better choice. AlgoViz aims to add reusable value when users need to:

- **Inspect, not just watch:** step forward and backward, seek to a point in time, examine state, and synchronize multiple views.
- **Reproduce, not just execute:** save a standard execution trace for offline inspection, sharing, and reproducibility.
- **Compare, not just present:** examine differences between inputs, runs, or algorithm versions.
- **Reuse, not just regenerate:** rely on tested timelines, renderers, validators, and interactions rather than having AI recreate infrastructure each time.

The differentiator is not that “AI cannot draw animations.” It is the hypothesis that **AI + AlgoViz can deliver a more reliable and reusable observation workflow with less effort than AI + general-purpose frontend libraries.** This hypothesis still needs testing.

## Target users and use cases

The primary audience is algorithm researchers, software engineers, and teams that need repeated access to internal execution state, including:

- Graph search and path planning: expanded nodes, frontier queues, distances, and heuristic costs.
- Dynamic programming and optimization: state tables, iterative convergence, and objective values.
- Reinforcement learning and simulation: environment states, actions, rewards, and intermediate outcomes.
- Novel algorithms: AI-generated adapters without requiring the algorithm to fit a predefined category.

Educational sorting animations may be supported, but they are not the primary differentiator.

## Intended user workflow

1. The user asks an AI coding agent for a visualization in an existing repository.
2. The agent inspects the algorithm and available state, then selects built-in renderers or creates a custom renderer.
3. The agent creates an **adapter**: reuse callbacks, logs, or iterators when possible; otherwise introduce minimal instrumentation at meaningful points.
4. The instrumented run produces an **Execution Trace**; the agent also generates a **Visualization Specification**.
5. AlgoViz validates and loads both inputs, presenting an interactive execution inspector in the browser.
6. The user saves, shares, replays, inspects, or compares runs.

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
  Renderers: Graph / Array / Grid / custom plugins
                  │
                  ▼
        Browser-based Algorithm Inspector
```

### Three core abstractions

- **State:** observable algorithm data at a particular step, modeled in a serializable way with stable identities.
- **View:** declarative mapping from data to visual components such as graphs, arrays, grids, tables, and charts.
- **Transition:** state changes recorded in the trace, optionally augmented by semantic events for richer animation.

### Two primary inputs

| Input | Responsibility |
| --- | --- |
| **Visualization Specification** | Describes views, data sources, visual encodings, and layout without hard-coding algorithm names. |
| **Execution Trace** | Records ordered state changes, optional semantic events, and metadata for deterministic replay. |

Generic state updates are the source of truth for reconstruction. Semantic events such as `node.visit` or `array.swap` may enhance animations, but must not create a conflicting second state model.

## Extension model

- **Built-in renderers:** start with Graph and Array. Grid and other renderers are candidates for later releases.
- **Composed views:** drive synchronized views, such as a search graph and its frontier queue, from one trace.
- **Custom renderer plugins:** consider a registration API after `v0.1.0`.
- **Language-agnostic integration:** use a common protocol; start with JSON/JSONL files and add live streaming and lightweight language SDKs later if justified.
- **AI integration:** start with CLI tools, machine-readable schemas, and agent Skill documentation; consider MCP as an optional future interface.

## Minimum viable product (v0.1.0)

The release goal is an end-to-end workflow in which a coding agent adapts an existing graph-search algorithm that has never been integrated with AlgoViz.

1. Define and validate two versioned inputs, a JSON Visualization Specification and a JSONL Execution Trace. The first spec needs view selection, bindings to trace state, and a basic layout.
2. Reconstruct one run deterministically and support forward and backward stepping and seeking to any recorded step.
3. Ship Graph and Array renderers. The demo shows the search graph and the ordered frontier queue at the same step.
4. Provide `validate` and `preview` commands for local files, offline browser replay, and agent-readable instructions for generating an adapter and spec.
5. Verify that the adapted algorithm produces the same result as the original on the demo inputs and that both views match the recorded execution at known steps.

Grid and other additional renderers, custom renderer plugins, live streaming, and cross-run comparison are deferred beyond `v0.1.0`.

The [v1 protocol and replay API](docs/protocol.md) define both file formats and show how to inspect the graph-search fixture.

Illustrative command shape (**not implemented**):

```bash
algoviz validate visualization.json trace.jsonl
algoviz preview visualization.json trace.jsonl
```

## What success looks like

The benchmark must be **asking AI to generate a standalone visualization directly**, not merely writing a frontend by hand. Measure time to first correct result, human interventions, correctness of displayed state, cost of adding views, value for comparing repeated runs, and performance on large traces.

**Key question: for complex algorithms and iterative investigation, does AlgoViz actually make visualization easier and more reliable than AI-generated standalone code?**

## Non-goals for now

- Replacing AI coding agents or bundling a proprietary language model.
- Automatically inferring every internal execution step from arbitrary untouched source code.
- Providing a universal hosted compiler/runtime for all languages in the MVP.
- Turning the DSL into a full frontend programming language with loops, functions, and arbitrary scripting.

## Contributing

Small graph-search examples with expected states and feedback on the [v1 protocol](docs/protocol.md) are welcome.

- [Contributing guide](CONTRIBUTING.md) for opening issues and submitting changes.
- [Design decisions](DECISIONS.md) and [development plan](OPEN_SOURCE_DEVELOPMENT.md) for the release scope and proposed backlog.
- [Code of conduct](CODE_OF_CONDUCT.md) and [security policy](SECURITY.md) for reporting concerns.

## License

AlgoViz is licensed under the [Apache License 2.0](LICENSE).

