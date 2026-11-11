"""Deterministic FrozenLake and tabular Q-learning using only the Python standard library.

The environment follows Gymnasium's FrozenLake-v1 with ``is_slippery=False``: the
default maps, action encoding, observation ``row * ncol + col``, reward schedule
``(1, 0, 0)``, termination on a hole or the goal, and truncation by the time limit.
A move off the grid leaves the agent in place.

Run this file directly for the uninstrumented summaries of one configured run.
"""

import argparse
import json
import random
from pathlib import Path


MAPS = {
    "4x4": ("SFFF", "FHFH", "FFFH", "HFFG"),
    "8x8": (
        "SFFFFFFF", "FFFFFFFF", "FFFHFFFF", "FFFFFHFF",
        "FFFHFFFF", "FHHFFFHF", "FHFFHFHF", "FFFHFFFG",
    ),
}
MAX_EPISODE_STEPS = {"4x4": 100, "8x8": 200}
ACTIONS = ("LEFT", "DOWN", "RIGHT", "UP")
REWARD_SCHEDULE = {"G": 1, "H": 0, "F": 0, "S": 0}

HERE = Path(__file__).resolve().parent


class FrozenLake:
    def __init__(self, map_name):
        self.desc = MAPS[map_name]
        self.nrow = len(self.desc)
        self.ncol = len(self.desc[0])
        self.max_episode_steps = MAX_EPISODE_STEPS[map_name]
        self.state = 0
        self.elapsed = 0

    def reset(self):
        self.state = 0
        self.elapsed = 0
        return self.state

    def step(self, action):
        row, col = divmod(self.state, self.ncol)
        if action == 0:
            col = max(col - 1, 0)
        elif action == 1:
            row = min(row + 1, self.nrow - 1)
        elif action == 2:
            col = min(col + 1, self.ncol - 1)
        elif action == 3:
            row = max(row - 1, 0)
        else:
            raise ValueError(f"invalid action {action!r}")
        self.state = row * self.ncol + col
        tile = self.desc[row][col]
        self.elapsed += 1
        terminated = tile in "GH"
        # Gymnasium's TimeLimit wrapper truncates at the limit even on a terminal step.
        truncated = self.elapsed >= self.max_episode_steps
        return self.state, REWARD_SCHEDULE[tile], terminated, truncated


def outcome(env, state, terminated, truncated):
    if terminated:
        return "goal" if env.desc[state // env.ncol][state % env.ncol] == "G" else "hole"
    return "truncated" if truncated else "running"


def train(settings, run, observer=None):
    """Train until at least ``minTransitions`` transitions, finishing the last episode.

    ``observer`` receives read-only copies of each reset and transition. It must not
    draw from the random generator or change the Q-table.
    """
    rng = random.Random(run["seed"])
    env = FrozenLake(settings["map"])
    alpha, gamma, epsilon = settings["alpha"], settings["gamma"], run["epsilon"]
    q = [[0.0] * len(ACTIONS) for _ in range(env.nrow * env.ncol)]
    summaries = []
    transitions = 0
    while transitions < settings["minTransitions"]:
        episode = len(summaries)
        state = env.reset()
        episode_return = 0
        actions = []
        if observer:
            observer.reset(episode, state)
        while True:
            explored = rng.random() < epsilon
            if explored:
                action = rng.randrange(len(ACTIONS))
            else:
                best = max(q[state])
                action = rng.choice([index for index, value in enumerate(q[state]) if value == best])
            next_state, reward, terminated, truncated = env.step(action)
            target = reward if terminated else reward + gamma * max(q[next_state])
            q[state][action] += alpha * (target - q[state][action])
            episode_return += reward
            actions.append(ACTIONS[action][0])
            transitions += 1
            result = outcome(env, next_state, terminated, truncated)
            if observer:
                observer.transition({
                    "episode": episode, "t": env.elapsed, "from": state, "action": action,
                    "explored": explored, "to": next_state, "reward": reward,
                    "terminated": terminated, "truncated": truncated, "outcome": result,
                    "q": q[state][action],
                })
            state = next_state
            if terminated or truncated:
                break
        summaries.append({"episode": episode, "steps": env.elapsed, "return": episode_return,
                          "outcome": result, "actions": "".join(actions)})
    return summaries


def load_runs(path=HERE / "runs.json"):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Print per-episode summaries of one uninstrumented run.")
    parser.add_argument("run", help="run id from runs.json")
    parser.add_argument("--runs", type=Path, default=HERE / "runs.json")
    args = parser.parse_args()
    config = load_runs(args.runs)
    runs = {run["id"]: run for run in config["runs"]}
    if args.run not in runs:
        parser.error(f"unknown run {args.run!r}; choose from {', '.join(runs)}")
    summaries = train(config["settings"], runs[args.run])
    print(json.dumps({"run": args.run, "episodes": summaries}, separators=(",", ":")))


if __name__ == "__main__":
    main()
