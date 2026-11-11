# Timed FrozenLake comparison

Two fresh coding-agent sessions built offline viewers for the same [verified FrozenLake traces](../../examples/frozenlake/README.md). Each trace has 10,000 transitions. The standalone session built a viewer from the JSONL inputs. The AlgoViz session used the `v0.4.0` comparison CLI and the shipped grid renderer.

## Method

Both sessions received the same [requirements](prompts.md) and [browser checker](check.mjs). The checker compares both viewers to [samples collected directly from the learner](oracle.py). It checks the first differing action in episode 1008, the run that ends one step earlier, a missing episode, backward and forward steps, and 25 fixed random positions. It checks the tiles, agent, path, action values, State, Changes, action and reward summaries, and offline operation. The follow-up asks both sessions to display the highest Q value and every action tied for it.

The authoring timer ran from prompt dispatch until the first passing checker run, including tool latency. The load timer ran from navigation to the first rendered grid in a fresh Edge page. Seek timings cover dispatching the episode and step controls and the synchronous updates to both views and the open inspection panels. They exclude browser painting. Both sessions ran on one Windows machine with a Core Ultra 9 285H, Node.js 24.6.0, Python 3.13.7, and Edge 157.0.4341.46.

## Results

| Measurement | Standalone | AlgoViz |
| --- | ---: | ---: |
| Initial prompt to first pass | 3m 28s | 54s |
| Follow-up prompt to first pass | 44s | 41s |
| Failed checker attempts, initial / follow-up | 0 / 0 | 0 / 0 |
| Human interventions, initial / follow-up | 0 / 0 | 0 / 0 |
| Initial offline HTML | 4,436,239 bytes | 11,299,620 bytes |
| Initial page load | 180 ms | 1,388 ms |
| Initial median / p95 seek | 0.4 / 0.5 ms | 1.6 / 2.6 ms |

Both viewers passed every shared browser check on their first run. AlgoViz reached its first pass sooner by reusing replay, comparison, and rendering code. The standalone viewer loaded faster and was smaller. Its build pre-indexed the two fixture traces and emitted compact episode data. AlgoViz embedded both v1 traces and parsed, validated, and indexed them when the page opened. The follow-up added a derived display to each viewer. These measurements describe one pair on one machine and include a prepared toolkit. They give no estimate of variance or of the effort to build that toolkit.

An unrelated run-label fallback changed during the trial. The AlgoViz follow-up first passed against that revision in 41 seconds. The same follow-up passed again against the exact initial source after 102 seconds. The archive contains the pinned rebuild, with both checks recorded in [timings.json](timings.json).

## Reproduce

Extract [viewers.zip](viewers.zip) and open each phase's `viewer.html` offline. The archive includes its build sources and the pinned AlgoViz runtime. To rebuild from a repository checkout, first regenerate the input directory using the recorder:

```sh
python -B examples/frozenlake/record.py /path/to/extracted/input
node examples/frozenlake/check.mjs /path/to/extracted/input
```

For the standalone builds, run `node build.mjs` from each phase directory. For AlgoViz, run `npm ci` in the archive's `algoviz/initial/source`, then run `node build.mjs` in each phase directory. Move the archived `viewer.html` before rebuilding either AlgoViz phase because its CLI creates a new file. From the repository root, run `node benchmarks/frozenlake/check.mjs <viewer.html>`. Add `--best-actions` for the follow-up.
