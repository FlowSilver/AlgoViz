# AlgoViz: Key Design Decisions and Trade-offs

> **Document type: Working design decisions.** These are the current recommended directions emerging from discussion, **not a claim that features exist or that every choice is final**. They should be revisited through prototypes and user testing.
>
> Status legend: **Tentative** = current preferred direction; **To validate** = key assumption without empirical evidence; **Open** = still needs a decision.

See the [project overview](README.md) for the release goal and the [contributing guide](CONTRIBUTING.md) for proposing a change to a decision.

## Decision summary

| ID | Topic | Current direction | Status |
| --- | --- | --- | --- |
| D01 | Product positioning | Algorithm Execution Inspector, not a one-off animation generator | Tentative |
| D02 | Role of AI | Use external AI coding agents; do not bundle an LLM | Tentative |
| D03 | Core model | State + View + Transition; separate Spec and Trace inputs | Tentative |
| D04 | API vs. DSL | Bounded declarative DSL + generic state updates + optional semantic events | Tentative |
| D05 | State authority | State patches are the source of truth; semantic events enhance presentation | Tentative |
| D06 | Adaptation | Prefer external adapters; add minimal instrumentation when necessary | Tentative |
| D07 | Language support | Protocol first; JSONL files before SDKs and live streaming | Tentative |
| D08 | Renderers | Graph and Array in v0.1.0, with custom renderers deferred | Tentative |
| D09 | Execution environment | Local first; no untrusted cloud code execution in MVP | Tentative |
| D10 | Agent interface | CLI + schemas + Skill before evaluating MCP | Tentative |
| D11 | Product value | Benchmark against AI-generated standalone web apps | To validate |

## Rationale and trade-offs

### D01 — Shift from an animation framework to an execution inspector

**Decision:** Center the product on observing, replaying, debugging, and comparing execution traces—not merely generating an animation.

**Why:** AI can already generate simple animations. Persistent traces, run comparison, timeline controls, and state inspection benefit more from a shared, tested runtime.

**Trade-off:** This targets research and engineering workflows; the first release is more demanding than a simple animation library. Education is not the primary positioning.

### D02 — AI interprets algorithms; AlgoViz provides the reliable runtime

**Decision:** External coding agents inspect unfamiliar code, choose observation points, and generate adapters and specs. AlgoViz supplies stable protocols, validation, playback, and rendering without a bundled model.

**Why:** Avoid rebuilding a coding agent while remaining compatible with different models, languages, and development tools.

**Trade-off:** Integration quality partly depends on the agent. Machine-readable documentation and actionable validation errors become essential.

### D03 — State + View + Transition, not a universal Algorithm interface

**Decision:** **State** represents observable data, **View** defines mappings and layout, and **Transition** represents ordered changes. The two main artifacts are a **Visualization Specification** and an **Execution Trace**.

**Why:** Search, dynamic programming, optimization, and reinforcement learning do not naturally share a full algorithm-level interface, but all expose observable state and change.

**Trade-off:** A generic protocol cannot infer algorithm-specific meaning on its own; AI still has to map semantics to visualization.

### D04 — Use a bounded DSL, not a second frontend programming language

**Decision:** The Spec primarily describes data sources, components, visual encodings, and layout. Special visual behavior can be implemented through custom renderer plugins.

**Rejected extremes:** a purely fixed algorithm-event API; or an unrestricted DSL with loops, functions, and arbitrary scripting.

**Why:** The former is too rigid for novel algorithms; the latter becomes a new, hard-to-maintain UI framework. AI can already write code when custom logic is genuinely needed.

**Trade-off:** Unusual visualizations still require a plugin, and the boundary of the declarative layer must be explicit.

### D05 — Generic state updates are authoritative; semantic events are optional

**Decision:** State updates in the Trace determine the actual visual state at each step. Optional events such as `array.swap` or `node.visit` can communicate animation intent but cannot contradict the state update.

The [v1 trace format](docs/protocol.md#execution-trace) uses `add`, `remove`, and `replace` operations with JSON Pointer paths. A step commits its updates as a batch after validating view bindings.

**Why:** A renderer can reconstruct correct state even if it does not understand an optional semantic event, and cross-language integration is simpler.

**Trade-off:** Raw patches alone may produce unexpressive animations. Rich transitions require renderer-specific interpretation. Event order, stable IDs, and protocol versions must be defined.

### D06 — Adapt externally first; instrument the algorithm only when needed

**Decision:** Reuse existing callbacks, logs, generators, or iteration outputs before modifying algorithm code. If internal state is not exposed, let the agent add minimal instrumentation at meaningful points.

**Why:** Reduce the risk of changing algorithm behavior, performance, or maintainability.

**Trade-off:** “Zero modification” cannot be guaranteed. If the implementation only exposes a final result, the exact internal execution trace cannot be reconstructed without observing execution. Test behavioral equivalence where possible.

### D07 — Start cross-language support with a common protocol, not many SDKs

**Decision:** Define a versioned, language-independent serialized format. **JSONL trace import** is the MVP route; language-specific SDKs are convenience wrappers, and live transport can follow.

**Why:** Multiple languages need only emit compatible records rather than requiring a complex library per language from day one.

**Trade-off:** JSONL may be inefficient for very large or high-frequency traces. Streaming, batching, and binary formats may become necessary while preserving compatibility.

### D08 — Provide useful built-ins while retaining a plugin escape hatch

**Decision:** Ship Graph and Array in `v0.1.0` and use them to show a search graph and its frontier queue at the same execution step. Evaluate Grid and custom renderer registration in later releases.

**Why:** These two renderers exercise synchronization between different views and cover the first integration without requiring a renderer for each algorithm.

**Trade-off:** Plugin APIs, lifecycle, isolation, version compatibility, and trusted-code boundaries require careful design. The MVP should not try to support every renderer type.

### D09 — Local first; do not host arbitrary code execution in the MVP

**Decision:** Algorithms run locally or in the user's existing environment; AlgoViz loads their resulting traces for inspection.

**Why:** Avoid early complexity around compilers, language dependencies, resource isolation, and security sandboxes.

**Trade-off:** Users may still need to run local commands. “Upload source and execute instantly in the cloud” is not an initial capability.

### D10 — Start agent integration with CLI, schemas, and a Skill

**Decision:** Offer discoverable renderer documentation, strict schemas, actionable error messages, and commands such as `validate` and `preview`. First prove that coding agents can integrate against these interfaces.

**Why:** Modern agents already read repositories, edit files, and execute commands; MCP should not be a prerequisite for the MVP.

**Trade-off:** Agent capabilities and tool discovery vary. MCP or IDE integration may later improve the experience.

### D11 — Benchmark against asking AI to write the whole webpage

**Decision:** Evaluate the framework against the realistic alternative: the same AI agent generating an independent interactive visualization from scratch.

**Key hypothesis (unvalidated):** For complex, repeatedly examined algorithms, AlgoViz reduces implementation and iteration cost while improving reproducibility and reliability.

**Risk:** If standalone AI-generated visualization remains faster, more accurate, and similarly maintainable, the product direction should change rather than simply expanding the framework.

## Proposed v0.1.0 scope

**In scope:**

- A versioned JSON Visualization Specification for view selection, bindings to trace state, and basic layout, plus a versioned JSONL Execution Trace. Both inputs have schema validation.
- Deterministic reconstruction of one run, forward and backward stepping, and seeking to any recorded step.
- Graph and Array renderers with a demo showing a search graph and its ordered frontier queue in sync.
- Local `validate` and `preview` commands, offline browser replay, and agent instructions for generating an adapter and spec.
- An end-to-end agent adaptation of one existing graph-search algorithm without prior AlgoViz integration. Verify that the adapted algorithm returns the same result on the demo inputs and that both views match the recorded execution at known steps.

**Out of scope for v0.1.0:**

- Built-in LLM and universal hosted code execution.
- Language SDKs, an MCP server, or an IDE plugin.
- Zero-instrumentation recovery of arbitrary internal algorithm state.
- Grid and other additional renderers, custom renderer plugins, and an unrestricted programmable DSL.
- Live streaming and cross-run comparison.

## Open design questions

1. **Large-scale execution:** When do we snapshot, sample, and chunk traces? How can users seek efficiently across millions of steps?
2. **State vs. layout:** Where do graph-node coordinates live? Which layouts must reproduce deterministically?
3. **Plugin contract:** How should version compatibility, lifecycle, capability declarations, and third-party trust be handled?
4. **Run comparison:** How should steps align across traces—index, semantic milestone, wall-clock time, or comparable state?
5. **Correctness:** How can we test that instrumentation preserves behavior and that adapters capture the right state?
6. **Data handling:** What are the redaction and sharing conventions for large or sensitive execution traces?

## Validation experiment to run early

The [BFS viewer pilot](benchmarks/README.md) holds observation data fixed and compares a standalone viewer with AlgoViz on one run.

Choose five real algorithms spanning different types and levels of complexity. For each, ask the **same coding agent** to complete two tasks:

- **Baseline A:** “Generate an interactive standalone webpage visualizing this algorithm.”
- **Experiment B:** “Use AlgoViz to create an interactive visualization of this algorithm.”

Keep functional requirements equivalent. Measure time to first correct result, human interventions and iterations, state fidelity, generated and maintained code, cost of adding a new view, replay/compare capabilities, and stability on long traces. Include at least one change request after the initial visualization rather than evaluating generation alone.

**Go/no-go principle:** Continue investing if AlgoViz demonstrates a repeatable advantage in a clearly valuable use case—not merely a prettier animation.

