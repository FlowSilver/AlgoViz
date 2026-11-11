# FrozenLake trial prompts

Both sessions started fresh. Each received a writable directory, the path to both prepared traces, the shared checker path, and instructions to record the first passing time and failed attempts. The AlgoViz session also received the comparison CLI, renderer, and spec paths.

## Initial request

Build one self-contained offline HTML viewer with reproducible build sources from the two v1 JSONL traces. Provide one shared episode/step position with previous, next, seek, and a first-differing-action control. Show unavailable runs and steps, each run's action and reward, State and Changes, and the FrozenLake grid with tiles, the current agent, the current episode's path, and the current cell's four Q values. The page must work with the network blocked. Run the shared browser checker and iterate within the session until it passes.

The standalone session received no existing viewer code. The AlgoViz session was asked to use the current AlgoViz compare CLI with the FrozenLake renderer and spec. Neither session could inspect the other session's work.

## Follow-up request

Starting from a copy of the initial viewer, display the current cell's highest Q value and all actions tied for highest for each available run. Keep the display synchronized during stepping and seeking. Preserve the initial behavior. Run the original checker with `--best-actions`.

The browser contract uses `data-best-actions` with a JSON array of action labels in LEFT, DOWN, RIGHT, UP order and `data-best-value` with the numeric maximum. The summary also displays the labels and value as visible text.
