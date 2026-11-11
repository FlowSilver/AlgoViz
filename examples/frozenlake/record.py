"""Record each configured FrozenLake Q-learning run as an AlgoViz v1 trace."""

import argparse
import json
from pathlib import Path

from algoviz_trace import TraceWriter
from frozenlake import ACTIONS, MAPS, HERE, load_runs, train


class RunObserver:
    """Mirror resets and transitions into the observable state without touching the learner."""

    def __init__(self, file, settings, run):
        self.file = file
        self.writer = None
        self.state = {
            "run": {"id": run["id"], "seed": run["seed"], "epsilon": run["epsilon"],
                    "alpha": settings["alpha"], "gamma": settings["gamma"]},
            "map": list(MAPS[settings["map"]]),
            "episode": 0,
            "t": 0,
            "cell": 0,
            "status": "running",
            "episodeReturn": 0,
            "path": [0],
            "last": None,
            "q": [[0.0] * len(ACTIONS) for _ in range(len(MAPS[settings["map"]]) * len(MAPS[settings["map"]][0]))],
            "totals": {"transitions": 0, "goals": 0, "holes": 0, "truncations": 0},
        }

    def reset(self, episode, cell):
        state = self.state
        state.update(episode=episode, t=0, cell=cell, status="running", episodeReturn=0, path=[cell], last=None)
        if self.writer is None:
            self.writer = TraceWriter(self.file, state)
        else:
            self.writer.step(state, [{"type": "episode.reset", "data": {"episode": episode}}])

    def transition(self, change):
        state = self.state
        state["t"] = change["t"]
        state["cell"] = change["to"]
        state["status"] = change["outcome"]
        state["episodeReturn"] += change["reward"]
        state["path"].append(change["to"])
        state["last"] = {
            "from": change["from"], "action": ACTIONS[change["action"]], "explored": change["explored"],
            "to": change["to"], "reward": change["reward"],
            "terminated": change["terminated"], "truncated": change["truncated"],
        }
        state["q"][change["from"]][change["action"]] = change["q"]
        totals = state["totals"]
        totals["transitions"] += 1
        events = None
        if change["outcome"] != "running":
            totals[{"goal": "goals", "hole": "holes", "truncated": "truncations"}[change["outcome"]]] += 1
            events = [{"type": "episode.end", "data": {"episode": change["episode"], "outcome": change["outcome"]}}]
        self.writer.step(state, events)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="directory that receives one folder per run")
    parser.add_argument("--runs", type=Path, default=HERE / "runs.json")
    args = parser.parse_args()
    config = load_runs(args.runs)
    spec = (HERE / "visualization.json").read_text(encoding="utf-8")
    report = []
    for run in config["runs"]:
        directory = args.output / run["id"]
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "visualization.json").write_text(spec, encoding="utf-8", newline="\n")
        with (directory / "trace.jsonl").open("w", encoding="utf-8", newline="\n") as file:
            observer = RunObserver(file, config["settings"], run)
            summaries = train(config["settings"], run, observer)
        report.append({"run": run["id"], "episodes": len(summaries),
                       "transitions": observer.state["totals"]["transitions"], "states": observer.writer.steps + 1})
    print(json.dumps(report))


if __name__ == "__main__":
    main()
