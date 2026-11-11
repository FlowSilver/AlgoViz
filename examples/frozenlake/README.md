# Compare two FrozenLake Q-learning runs

Why did two Q-learning runs with different exploration rates take different paths through the same grid? This fixture records two tabular Q-learning runs in deterministic FrozenLake. It then checks the traces independently and finds the first action where a selected episode diverges.

Both runs use the default 4×4 map, seed `7`, learning rate `0.5`, and discount `0.95`. Only the exploration rate differs: `ε = 0.1` and `ε = 0.3`. Each run trains until it has recorded at least 10,000 transitions and then finishes its current episode. [Run settings](runs.json)

| Run | Episodes | Transitions | Trace states |
| --- | ---: | ---: | ---: |
| `epsilon-0.1` | 1,557 | 10,000 | 11,557 |
| `epsilon-0.3` | 1,448 | 10,000 | 11,448 |

Both runs happen to finish an episode on exactly the 10,000th transition.

## Environment

[frozenlake.py](frozenlake.py) implements Gymnasium's `FrozenLake-v1` with `is_slippery=False` using only the Python standard library. It follows the documented map, the action encoding `0 = LEFT`, `1 = DOWN`, `2 = RIGHT`, `3 = UP`, the observation `row * ncol + col`, the reward schedule `(1, 0, 0)`, and the 100-step time limit. A move off the grid leaves the agent in place. [FrozenLake documentation](https://gymnasium.farama.org/environments/toy_text/frozen_lake/)

The learner chooses a uniformly random action with probability ε. Otherwise it picks the highest-valued action, breaking ties at random. With equal seeds, the two runs make identical choices through episode 115. When the action values at a cell are tied, a greedy choice and an exploratory choice consume the same random draws. The runs first take different actions in episode 116.

## Record and check the runs

From the AlgoViz checkout, use Node.js 22 or later and Python 3.10 or later:

```sh
npm ci
python -B examples/frozenlake/record.py frozenlake-runs
node examples/frozenlake/check.mjs frozenlake-runs
```

[record.py](record.py) writes `frozenlake-runs/<run>/trace.jsonl` and a `visualization.json` for each run. It mirrors the learner's resets and transitions into the observable state and passes each state to [algoviz_trace.py](algoviz_trace.py). This small standard-library recorder writes the v1 `add`, `remove`, and `replace` updates that reproduce the state. Each trace is about 4.5 MB.

Step 0 is the reset for episode 0. Each transition and each later reset advances the trace by one step. In every state, `episode` and `t` locate the step within its episode, `cell` is the observation, and `last` holds the transition that produced it. `q` holds the action values in `LEFT`, `DOWN`, `RIGHT`, `UP` order.

[check.mjs](check.mjs) replays each trace with the AlgoViz core and checks it against a separate JavaScript implementation of the environment and learner. It does not share code with the recorder. For every recorded step, it checks the following:

- **Transitions.** Each action moves the agent to the cell, reward, termination, and truncation that FrozenLake gives. The episode return, path, totals, and the single updated action value follow the Q-learning update. A greedy action must be one of the highest-valued actions.
- **Resets.** A new episode follows every terminated or truncated episode and only those. It returns the agent to cell 0 with step 0, return 0, and the learned values unchanged. The trace ends with a finished episode.
- **Separate run.** Running [frozenlake.py](frozenlake.py) without the recorder produces summaries of the same runs. The checker compares each episode's length, return, outcome, and action sequence with them.

The checker prints each trace's SHA-256 digest, along with the comparison below. [expected.json](expected.json) holds the expected report. The tests regenerate both runs and require an exact match.

## Episode 1008

In episode 1008, the `ε = 0.1` run reaches the goal and the `ε = 0.3` run falls into a hole. Both runs take `DOWN`, `DOWN`, `RIGHT`, `DOWN` and reach cell 13. In both runs, the learned values there favor `RIGHT`.

| Step 5 | `epsilon-0.1` | `epsilon-0.3` |
| --- | --- | --- |
| Trace step | 7517 | 8089 |
| Values at cell 13 (L, D, R, U) | 0, 0.9025, 0.95, 0.8574 | 0, 0.9025, 0.95, 0.8574 |
| Action | `RIGHT`, greedy | `LEFT`, exploratory |
| Resulting cell and reward | 14, 0 | 12 (hole), 0 |
| Episode outcome | Goal after 6 steps, return 1 | Hole after 5 steps, return 0 |

The values are rounded here. The `ε = 0.3` run did not learn a different preference at cell 13. It took an exploratory action. `LEFT` still has value 0 in both runs because a hole gives the same reward as an unexplored move. The `ε = 0.3` run ends one step earlier. Episode 1008 starts at trace step 7512 in `epsilon-0.1` and 8084 in `epsilon-0.3`.

To inspect one run now, preview it and seek to its trace step:

```sh
npm run algoviz -- preview frozenlake-runs/epsilon-0.3/visualization.json frozenlake-runs/epsilon-0.3/trace.jsonl
```

Expand **State** to read `last`, `cell`, `status`, and `q` at the selected step.

## Fault injection

The tests change one trace line, then confirm that the altered trace still passes v1 replay and that the checker rejects it. The checker reports the run, line, episode, and step within the episode:

```text
epsilon-0.1 epsilon-0.1/trace.jsonl:7519 episode 1008 step 6: reward is 0, expected 1
epsilon-0.3 epsilon-0.3/trace.jsonl:8085 episode 1008 step 0: reset placed the agent at cell 1, expected the start cell 0
```

The first line comes from setting the goal reward to 0. The second comes from resetting the agent to cell 1. A third test checks a trace against a separate run with another seed and reports the first episode whose summary differs.
