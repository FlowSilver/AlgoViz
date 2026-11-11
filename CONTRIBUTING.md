# Contributing to AlgoViz

AlgoViz is in pre-release development. Start with the [project overview](README.md), [design decisions](DECISIONS.md), and [v0.1.0 backlog](OPEN_SOURCE_DEVELOPMENT.md#6-mvp-v010-initial-backlog). The first release targets offline replay of one graph-search run with a synchronized graph and frontier queue.

## Open an issue

Search [existing issues](https://github.com/FlowSilver/AlgoViz/issues) before opening a new one. Use the [issue chooser](https://github.com/FlowSilver/AlgoViz/issues/new/choose) to report a bug or propose a design change.

- For a proposal, describe the use case, affected decisions, and how to verify the outcome. For changes to the trace or spec, include a small example and the expected state at a few steps.
- For a bug, include the affected commit or version, the smallest reproduction you can share, and the expected and observed results. Use public or synthetic inputs when sharing traces or logs.
- For a vulnerability, use the private channel in the [security policy](SECURITY.md).

## Submit a pull request

1. Fork the repository and branch from `main`. Keep the change focused on one outcome.
2. Explain what changed and why. Link a relevant issue when one exists. A small, self-contained fix can go straight to a pull request.
3. Describe how you verified the change. For documentation, check the links and examples you touched. When changing the protocol, update the affected schema, examples, and tests together as those artifacts become available.
4. Open the pull request against `main`. If the change relies on an open design decision, explain the assumption and its impact in the description.

Participation follows the [code of conduct](CODE_OF_CONDUCT.md). Contributions are made under the project's [Apache-2.0 license](LICENSE).

## Run the tests

From the repository root, use Node.js 22 or later:

```sh
npm ci
npm test
```

The tests cover the [replay API](docs/protocol.md#replay-api) against the graph-search fixture and exercise invalid records, updates, and bindings. GitHub Actions runs the same commands for pull requests and pushes to `main`.

To verify the offline inspector and the upstream BFS example, install Python 3.10 or later, run `npx playwright install chromium`, and then run `npm run test:browser`. Set `ALGOVIZ_BROWSER_CHANNEL=msedge` or `chrome` to use a locally installed browser. Set `ALGOVIZ_PYTHON` if your Python executable is named differently.

## Local pre-commit hook

Run this once from your clone to enable the repository's hook:

```sh
git config --local core.hooksPath .githooks
```

The hook uses Git's built-in check for whitespace errors and leftover merge conflict markers in staged changes. If a check fails, fix the reported lines, stage the fixes, and retry the commit.
