"""Get browser expectations directly from the learner, independently of JSONL replay."""
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "examples" / "frozenlake"))
from frozenlake import ACTIONS, MAPS, load_runs, train


class Samples:
    def __init__(self, settings):
        self.map = MAPS[settings["map"]]
        self.q = [[0] * 4 for _ in "".join(self.map)]
        self.frames = {}

    def reset(self, episode, cell):
        self.path = [cell]
        self.previous = None
        self.save(episode, 0, cell, None, None, "running")

    def transition(self, change):
        self.q[change["from"]][change["action"]] = change["q"]
        self.path.append(change["to"])
        self.save(change["episode"], change["t"], change["to"], ACTIONS[change["action"]],
                  change["reward"], change["outcome"])

    def save(self, episode, step, cell, action, reward, status):
        row = self.q[cell][:]
        self.frames[episode, step] = {
            "cell": cell, "beforeCell": self.previous, "path": self.path[:], "action": action,
            "reward": reward, "status": status, "q": row,
            "best": [action for action, value in zip(ACTIONS, row) if value == max(row)],
        }
        self.previous = cell


def main():
    config = load_runs()
    frames = {}
    for run in config["runs"]:
        observer = Samples(config["settings"])
        train(config["settings"], run, observer)
        frames[run["id"]] = observer.frames
    random_positions = random.Random(41).sample(sorted(set().union(*frames.values())), 25)
    positions = [(1008, t) for t in (0, 4, 5, 6)] + [(1500, 0)] + random_positions
    print(json.dumps({
        "map": list(observer.map),
        "samples": [
            {"episode": ep, "step": t, "runs": {run: data.get((ep, t)) for run, data in frames.items()}}
            for ep, t in positions
        ],
    }))


if __name__ == "__main__":
    main()
