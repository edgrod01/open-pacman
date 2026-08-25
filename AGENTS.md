# AGENTS.md

Vanilla JS + HTML + Canvas Pac-Man clone. No build system, no npm, no test framework.

## Run / verify
- Run with `open src/index.html` (macOS). There is no dev server, bundler, test runner, or linter.
- After changes, verify by reloading the page and playing (arrow keys). There are no automated tests.

## Architecture (no modules — globals on `window`)
Scripts are plain `<script>` tags loaded in order in `src/index.html`: `maze.js` → `game.js` → `render.js` → `main.js`. No ES modules/imports; each file exposes its API via `window.X = X`. Keep that order and the `window`-export pattern.
- `maze.js` — maze data + globals `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`. The `MAZE_STR` tile legend: `#`=wall(1) `.`=dot(2) ` `=empty(0) `-`=door(3).
- `game.js` — state & rules. `createGame()` copies `MAZE` into a per-game `grid` (dots are eaten there, the pristine `MAZE` is never mutated).
- `render.js` — canvas drawing from `game.grid`.
- `main.js` — game loop, keyboard, overlay screens.

## Spec-driven workflow (the point of this repo)
- Large features go through `/spec` then `/spec-impl` (skills in `.agents/skills/`). Specs live in `specs/NN-slug.md`, implementation branches are `spec-NN-slug`.
- `/spec` skill writes specs in the language of the prompt (repo content is Spanish; match existing specs). `spec-impl` only implements specs whose state means "Approved"/"Aprobado".

## Style
- `function name() {}` declarations, spaces inside parens `( x, y )`, single quotes, 2-space indent.
- Movement is fractional-cell per frame (e.g. `PACMAN_SPEED = 0.125`); `aligned()` snaps to integer cells. Keep that model if touching movement.