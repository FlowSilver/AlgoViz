# AlgoViz — Open-Source Strategy and Development Workflow

> **Project Positioning:** AI-Native Algorithm Execution Inspector  
> **Mission:** A reusable runtime for observing, replaying, debugging, and comparing arbitrary algorithm executions.  
> **Document Status:** Proposed  
> **Last Updated:** 2026-11-11

## 1. Executive Summary

AlgoViz is a public Apache-2.0 project. The [contributing guide](CONTRIBUTING.md) describes the current workflow. This document records the proposed development process and `v0.1.0` backlog.

Recommended workflow:

```text
Product Vision & Requirements
          ↓
Milestone / Epic
          ↓
GitHub Issue (Feature / Bug / Task / Spike)
          ↓
Feature Branch → Implementation → Tests
          ↓
Pull Request → CI → Review → Merge
          ↓
Working Increment → MVP Release → Feedback
                              ↺
```

Guiding principles:

- Follow an **AI-assisted, human-directed** approach: humans define goals and acceptance criteria; AI assists with implementation, testing, and review.
- Maintain quality controls and traceability without importing unnecessary process overhead from larger teams.
- **An Issue represents a problem to solve or an outcome to deliver; a PR represents a proposed change. Do not rigidly require one Issue per PR.**
- Prioritize validating AlgoViz's practical advantages over having AI generate visualization code from scratch.

---

## 2. Why Open Source?

AlgoViz is general-purpose infrastructure for developers. Open source may provide the following benefits:

| Area | Potential Value |
| --- | --- |
| Developer adoption | Developers and coding agents can inspect protocols, examples, and implementations, reducing integration friction |
| Cross-language ecosystem | Contributors can build SDKs or adapters for Python, C++, Rust, Java, and other languages |
| Renderer ecosystem | The community can contribute graph, tree, grid, and domain-specific visualization plugins |
| Transparency and trust | Developers can inspect how traces, state reconstruction, and replay behave |
| Reusable infrastructure | AlgoViz may become a dependency for research and engineering projects rather than a one-off visualization website |
| Engineering experience | Publicly demonstrates API design, architecture, testing, CI/CD, and open-source maintenance practices |

### 2.1 Boundaries and Risks of Open Source

- Open source does not automatically attract a community or users. Demand and developer experience still need to be validated.
- Rapid early API changes may create compatibility burdens. Clearly identify `0.x` releases as experimental where appropriate.
- External contributions introduce maintenance, review, and security-response responsibilities.
- Public code does not replace good user documentation or reliable end-to-end examples.

### 2.2 License

AlgoViz uses the [Apache License 2.0](LICENSE). Its permissive terms and explicit patent grant support broad integration. Check compatibility with dependency licenses before release.

---

## 3. Recommended Software Development Life Cycle (SDLC)

Do not treat `Requirements → User Stories → PR → Review → Merge → MVP` as a strict linear process. Prefer continuous iteration and progressively refining requirements for each stage.

### 3.1 Responsibilities of Each Layer

| Layer | Question Answered | AlgoViz Example |
| --- | --- | --- |
| Product Vision | Why are we building this, and for whom? | AI-Native Algorithm Execution Inspector |
| Requirement | What capability must the product provide? | Reproducible replay of algorithm execution states |
| User Story | Who needs what, and why? | A researcher wants to return to any step before an algorithm failure |
| Epic | Which related capabilities should be delivered together? | Execution Replay Engine |
| Issue | What is the next verifiable piece of work? | Implement deterministic trace reducer |
| Pull Request | What concrete code or documentation changes address the work? | `feat(core): add deterministic replay` |
| Milestone | When will we deliver a meaningful increment? | MVP v0.1.0 |

### 3.2 Recommended Practices

1. Maintain a concise product vision and MVP scope; do not attempt to enumerate every requirement upfront.
2. Break the MVP into a small set of **Milestones / Epics**.
3. Use **GitHub Issues** to describe goals, acceptance criteria, and constraints.
4. Implement on feature branches, add necessary tests, and open **Pull Requests**.
5. Merge into `main` only after CI passes and self-review or peer review is complete.
6. Validate each working increment end to end. The MVP is a milestone deliverable, not the sole or final step of development.
7. Gather real feedback and reprioritize the backlog.

---

## 4. Relationship Between GitHub Issues, Tasks, and PRs

### 4.1 Core Principle

**Issues describe what needs to be solved; PRs describe what is being changed.**

As a default, aim for **one small Issue → one PR** because it simplifies review, rollback, and traceability. This is a guideline, not a hard rule:

- **One complex Issue → multiple PRs:** For example, define the protocol, implement the parser, then add tests.
- **Several closely related small Issues → one PR:** Appropriate only when the combined changes remain focused and easy to verify.
- **Discussion or research Issue → possibly no PR:** For example, architectural exploration, user interviews, or product trade-offs.
- **Urgent bug fix → preferably a linked Issue:** But avoid delaying an urgent fix for process alone.

A PR should have **one coherent purpose, be independently reviewable, and provide a clear verification path**.

### 4.2 Example GitHub Issue

```markdown
## Goal
Implement deterministic replay for a sequence of trace events.

## Why
Users need to step backward and jump to earlier execution states
without rerunning their algorithm.

## Acceptance Criteria
- [ ] Applying the same initial state and events yields the same final state.
- [ ] Forward/backward navigation reproduces the expected state.
- [ ] Invalid trace events return actionable validation errors.
- [ ] Unit tests cover boundary cases.

## Out of Scope
- Real-time streaming
- Cross-run diff

## References
- docs/architecture.md
```

### 4.3 Example Pull Request

```markdown
## Summary
Implement deterministic state replay using trace patches.

## Related Issues
Closes #4

## Changes
- Add trace reducer
- Add replay controller
- Add unit tests

## Verification
- [x] Unit tests pass
- [x] Trace replay is deterministic for test fixtures
- [x] Existing renderers still pass regression tests

## Notes / Risks
Describe any migration or compatibility considerations.
```

On GitHub, a PR merged into the default branch can automatically close a linked Issue using a keyword such as `Closes #4`.

---

## 5. Review and CI for a Solo Maintainer

**Keep PRs, but do not require a second human reviewer while maintaining the project alone.**

| Stage | Recommendation for a Solo Project |
| --- | --- |
| Development | Use feature branches rather than making long-running changes directly on `main` |
| PR | Document the purpose, acceptance criteria, design impact, and testing steps |
| CI | Run formatting checks, linting, type checking, unit tests, and builds automatically |
| Review | Review the diff yourself; optionally use AI to surface potential issues |
| Merge | Prefer Squash Merge once the acceptance criteria are met |
| As the community grows | Add human maintainer reviews for protocol, plugin API, and security-sensitive changes |

AI review cannot replace executable tests, and code inspection alone cannot establish whether the collected states faithfully represent the original algorithm's execution.

Configure default-branch protection or rulesets, subject to repository permissions and GitHub plan support, and require important CI checks to pass before merging.

---

## 6. MVP v0.1.0: Initial Backlog

The release is complete when a coding agent can adapt an existing graph-search algorithm with no prior AlgoViz integration and replay one local run in an offline browser preview. The search graph and ordered frontier queue must stay in sync during forward and backward stepping and when seeking to any recorded step.

| Tracking | Type | Work Item | Primary Acceptance Outcome |
| --- | --- | --- | --- |
| [BFS pilot](benchmarks/README.md) | Research | Compare the offline viewer workflows on the release example | Compare state fidelity, viewer-specific code, output size, and a follow-up view. |
| [#1](https://github.com/FlowSilver/AlgoViz/issues/1) | Core | Define the minimal Spec and Trace formats | Specify a versioned JSON spec for view selection, bindings to trace state, and basic layout, plus a versioned JSONL trace with initial state, ordered updates, and optional events. Provide schemas for both. |
| [#3](https://github.com/FlowSilver/AlgoViz/issues/3) | Core | Implement deterministic trace replay | Reconstruct one run and support forward and backward stepping and seeking to any recorded step. |
| [#5](https://github.com/FlowSilver/AlgoViz/issues/5) | Renderer | Implement Graph and Array renderers | Show a search graph and its ordered frontier queue at the same execution step. |
| [#6](https://github.com/FlowSilver/AlgoViz/issues/6) | Tooling | Build `validate` and `preview` commands | Validate the spec and trace from local files and generate an offline browser preview. |
| [#7](https://github.com/FlowSilver/AlgoViz/issues/7) | AI Integration and Testing | Ship the skill and verify an end-to-end adaptation | Enable agents to produce an adapter and spec. Compare the recorded algorithm's result with the original, then verify graph and frontier states in the browser. |

### 6.1 Out of Scope for v0.1.0

- Grid and other additional renderers, custom renderer plugins, and support for every algorithm category.
- Language SDKs, an MCP server, and IDE plugins.
- An online IDE that runs arbitrary user code in the cloud.
- A large, fully featured visualization DSL, live streaming, and cross-run comparison.
- Advanced real-time collaboration, hosted experiment management, or a plugin marketplace.
- Premature extreme performance optimization, unless MVP use cases expose an actual bottleneck.

### 6.2 Product Value Validation Experiment

Using the same diverse set of algorithms and equivalent functional requirements, compare:

- **Group A:** AI generates a standalone visualization application from scratch.
- **Group B:** AI integrates the algorithm with AlgoViz to generate a visualization.

Measure:

1. Time to first successful result.
2. Number of human interventions required.
3. Amount of generated and maintained code.
4. Fidelity of the visualization to the algorithm's actual execution state.
5. Cost of adding views, variables, or replay features.
6. Stability of replay for long traces and reusability in later experiments.

**Further investment should be justified by measured benefits, not by the assumption that a framework must be better.**

---

## 7. Proposed GitHub Repository Structure

Start with a monorepo to reduce coordination and versioning overhead across modules.

```text
algoviz/
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── .github/
│   ├── ISSUE_TEMPLATE/
│   ├── pull_request_template.md
│   └── workflows/
│       └── ci.yml
├── docs/
│   ├── architecture.md
│   ├── requirements.md
│   ├── decisions.md
│   └── adr/
├── packages/
│   ├── core/
│   ├── protocol/
│   ├── renderers/
│   └── cli/
├── apps/
│   └── inspector/
├── examples/
│   └── graph-search/
└── tests/
```

The root community files and GitHub templates are in place. Add source, examples, tests, and CI directories as the corresponding modules become runnable.

### 7.1 GitHub Projects

One Kanban board is enough:

`Backlog → Todo → In Progress → Done`

- **Milestones:** Represent release goals, such as `MVP v0.1.0`.
- **Labels:** Classify work with `feature`, `bug`, `task`, `spike`, `documentation`, `priority`, and similar tags.
- **Issues:** Track verifiable requirements and tasks.
- **Projects:** Show progress; they do not replace Issue descriptions.

A solo project does not need Sprints, Story Points, Velocity tracking, or recurring Scrum meetings at the outset.

---

## 8. Architecture Decision Records (ADRs)

Gradually evolve the existing `DECISIONS` document into separate **Architecture Decision Records**.

Suggested initial records:

- `ADR-001: Standardize the execution trace protocol`
- `ADR-002: Separate algorithm instrumentation from rendering`
- `ADR-003: Prefer CLI and agent-readable docs over a built-in AI agent`
- `ADR-004: Keep the core renderer-independent`
- `ADR-005: Defer full DSL design until validated by real integrations`

Each ADR can include: `Status`, `Context`, `Decision`, `Consequences`, and `Alternatives Considered`.

Do not treat ideas from discussions as irreversible final decisions. Use statuses such as `Proposed`, `Accepted`, and `Superseded`.

---

## 9. Responsibilities in AI-Assisted Development

| Role | Responsibilities |
| --- | --- |
| Human maintainer | Define product value and requirements, make architectural trade-offs, approve significant changes, and perform final acceptance |
| AI coding agent | Implement from Issues, generate tests, update documentation, prepare PRs, and assist in reviews |
| CI | Consistently execute checks that can be automated |

Every Issue assigned to AI should ideally contain at least:

- A clear **Goal** and **Why**.
- Objectively testable **Acceptance Criteria**.
- **Out of Scope** boundaries to prevent unbounded expansion.
- Constraints concerning protocols, directories, tests, and backward compatibility.

Ensure other human developers can understand and maintain the resulting code without access to the AI conversation that produced it.

---

## 10. Early Working Agreement

1. Link changes beyond trivial spelling fixes to an Issue whenever practical.
2. Define testable Acceptance Criteria before implementing a new feature.
3. Keep each PR focused on one main logical change; avoid unrelated large-scale refactors.
4. Whenever the core protocol changes, update its schema, tests, examples, and documentation together.
5. Keep the default branch buildable and runnable; do not merge when CI fails.
6. Validate both visualization correctness and whether instrumentation has changed the original algorithm's behavior.
7. Evaluate maintenance cost, license compatibility, and alternatives before adding dependencies.
8. Write ADRs for major design decisions rather than leaving the rationale only in chats, Issue comments, or PRs.
9. Release a usable end-to-end version early instead of waiting for every planned feature.
10. At each Milestone, review whether the project is moving closer to demonstrating that **AI + AlgoViz outperforms AI-generated visualization from scratch**.

---

## 11. Current Recommendations and Open Questions

### Recommended for Adoption

- **Workflow:** Lightweight SDLC + GitHub Issues + PRs + CI.
- **Review:** Self-review plus AI assistance during solo development; no mandatory second reviewer.
- **Code organization:** Start with a monorepo.
- **Release strategy:** Deliver `v0.1.0` early and iterate based on real-world feedback.

### Still to Be Validated

- AlgoViz's speed and maintenance-cost advantage over AI generating code directly.
- How many algorithm categories the minimal trace protocol can represent.
- Whether a complete DSL is necessary or a generic trace format with programmable renderers is sufficient.
- Early demand for individual programming languages and their maintenance costs.
- Whether real-time streaming, large-trace optimization, and cross-run comparison are near-term necessities.

## 12. Next Steps

The [v0.2.0 milestone](https://github.com/FlowSilver/AlgoViz/milestone/2) covers [graph edge labels](https://github.com/FlowSilver/AlgoViz/issues/12), [labeled Array items](https://github.com/FlowSilver/AlgoViz/issues/13), and the [supported offline Dijkstra example](https://github.com/FlowSilver/AlgoViz/issues/14). The browser checks cover all five weighted frames and the existing BFS previews.

1. Collect feedback on the [weighted Dijkstra workflow](examples/weighted-dijkstra/README.md).
2. Extend the [timed Dijkstra trial](benchmarks/dijkstra/README.md) to the planned multi-algorithm comparison and record authoring and iteration cost.
3. Turn the most important findings into issues with testable acceptance criteria.

---

**Core Principle:** Use open-source collaboration and lightweight SDLC to keep AlgoViz reliable and maintainable over time, while always prioritizing product validation and working software over process for its own sake.
