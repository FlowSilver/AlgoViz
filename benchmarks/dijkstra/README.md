# Timed Dijkstra comparison

This trial followed the [BFS viewer pilot](../README.md). Two fresh sessions with the same inherited coding-agent settings built offline viewers from the same [weighted fixture](fixture.json). One built a standalone viewer. The other used [AlgoViz v0.1.0](https://github.com/FlowSilver/AlgoViz/releases/tag/v0.1.0) at commit `ce4e7339f4770bf62fa75572fecddaff1c0e060f`.

## Input and method

Both sessions received the same unmodified [upstream Dijkstra file](upstream_dijkstra.py) from TheAlgorithms/Python, including its [MIT license](LICENSE-upstream.md). The fixture supplies directed adjacency explicitly and includes the isolated vertex `U`. The upstream priority queue uses decrease-key. Both adapters observed the queue at its loop boundary and drained a copy with the original heap operations to get pop order without changing the live queue. [Pinned upstream revision](https://github.com/TheAlgorithms/Python/blob/0525ef5da830e3bbebcc25c0bde6162971480aee/graphs/dijkstra_algorithm.py)

The [prompts](prompts.md) and [checker](check.mjs) were shared apart from the viewer approach and workspace path. The sessions worked in separate directories on one Windows host with Node.js 24.6.0, Python 3.13.7, Playwright 1.65.0, and Edge 156.0.4314.58. Tooling and dependencies were staged before timing. The sessions overlapped and had no access to each other's outputs by instruction.

Each timer started immediately before its prompt was dispatched and ended when its first passing check finished. The follow-up prompt asked for a tentative-distance view after the initial artifacts had been saved. The checker rebuilds the viewer, compares the original and recorded result to an [independent oracle](expected.json), and checks the five frames, backward navigation, and seeking with HTTP requests blocked. In the follow-up, it also checks the distance list at each step.

## Results

| Measurement | Standalone | AlgoViz |
| --- | ---: | ---: |
| Initial prompt to first pass | 2m 37s | 2m 14s |
| Tentative-distance prompt to first pass | 43s | 54s |
| Failed checker attempts, initial / follow-up | 1 / 0 | 1 / 0 |
| Human interventions, initial / follow-up | 0 / 0 | 0 / 0 |
| Initial offline HTML | 9,302 bytes | 179,429 bytes |
| Follow-up offline HTML | 9,982 bytes | 180,273 bytes |

All four builds passed. The original and observed algorithms agreed on `S=0`, `B=1`, `A=2`, `C=4`, and `U` unreachable. The initial checker attempt in each session failed to launch Edge inside the sandbox. Both reruns passed outside it, and the initial elapsed times include those retries. [Timing and check records](timings.json)

AlgoViz reached its first pass 23 seconds sooner in this pair. The standalone viewer passed the follow-up 11 seconds sooner. These are wall-clock observations from one pair with a prepared environment. They include agent and tool latency and give no estimate of variance or installation time.

## Proposed implementation issue

**Render optional labels on graph edges.** The initial build was the longer phase in both trials, and both sessions had to instrument the original queue. In the AlgoViz trial, the clearest avoidable presentation work was duplicating the weights into a companion Array view and positioning it with custom CSS. The follow-up also required explicit display strings and layout changes. The trial did not time these edits separately.

Use this weighted fixture to check that every edge can show its own weight through the Graph view, the frontier remains synchronized, and the existing unweighted BFS preview still renders. This would let the weighted viewer drop the separate weight legend from the spec.

## Artifacts and reproduction

[Download the viewer archive](viewers.zip) and extract it. Open `viewer.html` in each arm's `initial` or `follow-up` directory to replay the exact saved artifact offline. The archive also contains the build sources, algorithm result, and the AlgoViz specs and traces. All four archived viewers rebuilt byte-for-byte and passed the checker in fresh directories on the trial host.

To rebuild, install the repository's Node dependencies with `npm ci`. Use Python 3.10 or later. Copy `fixture.json`, `upstream_dijkstra.py`, and `LICENSE-upstream.md` into the extracted arm and phase directory. For an AlgoViz build, put a `v0.1.0` checkout in that directory as `toolkit/` and run `npm ci` there. From the current repository root, run `node benchmarks/dijkstra/check.mjs <arm-and-phase-directory>`. Add `--distances` for the follow-up. The checker uses Edge by default on Windows and Playwright Chromium on other platforms. Use `npx playwright install chromium` if needed and set `ALGOVIZ_BROWSER_CHANNEL` to select another installed Chromium channel.
