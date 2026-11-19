# CLAUDE.md

Tizen TV launcher (see README.md). Target: Samsung GU55U8079FUXZG, Tizen 10, 1920x1080 stage,
remote-only navigation.

## Ground rules

- Work in the browser preview only. Do not connect to the TV, run `sdb`, sign/build/install a
  package, or change Home or startup behaviour. Do not touch `native/`.
- Normal edit surface: `src/js/config.js`, `src/js/brands.js`, `src/css/style.css`, brand marks in
  `src/img/marks/`. Per-TV values (devlog URL, weather) go in the gitignored `src/js/config.local.js`.
- Ask before installing anything (npm packages, browsers, Playwright, ...).

## Node / npm on this machine

Node 22 is installed at `%LOCALAPPDATA%\Programs\node` and is **not on PATH** (neither in
PowerShell nor in Git Bash). Use the full path:

```powershell
& "$env:LOCALAPPDATA\Programs\node\npm.cmd" run preview    # http://localhost:8080
& "$env:LOCALAPPDATA\Programs\node\npm.cmd" run devlog     # :8099 -> logs/tv.jsonl
& "$env:LOCALAPPDATA\Programs\node\node.exe" scripts/build-marks.mjs
```

Git Bash: `/c/Users/Andreas/AppData/Local/Programs/node/node.exe scripts/serve.mjs`.
`npm run` finds `node` on its own. Start servers in the background and stop them when done
(they hold ports 8080 / 8099).

## Preview

- `#all`, `#lab`, `#settings`, `#homeapps`, `#consoles` in the URL open a screen directly.
- Keys: arrows + Enter, Esc/Backspace = Back, `R` `G` `Y` `B` = colour keys.
- The preview uses `src/js/tizen-mock.js`. Its app list does **not** contain the app ids from
  `config.js` (ARD, ZDF, arte, Nebula, Moonlight, TizenYouTube), so those tiles are skipped on
  Home unless the mock is extended for the test (e.g. intercept `tizen-mock.js` while taking
  screenshots) — do not commit mock changes for that.
- Screenshots without installing anything: drive headless Edge
  (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe --headless=new
  --remote-debugging-port=...`) over CDP with Node 22's built-in `WebSocket`; keep such helper
  scripts in the scratchpad, not the repo.

## Tiles and brand marks

- `src/js/brands.js`: per-brand `bg`, `fg`, `mark` (file in `src/img/marks/`) or `text`, and
  optional `pad: [vertical%, horizontal%]` to size the logo inside the 300x170 tile.
- After adding or changing a mark or a brand's `fg`, run `scripts/build-marks.mjs`; it writes the
  pre-coloured `src/img/tiles/<key>.svg` used at runtime. It strips `fill="..."` attributes and
  recolours to `fg`; `style="fill:..."` survives, which is how multi-colour marks (Nebula,
  Moonlight) keep their colours.
- Crop marks by setting the SVG `viewBox` to the logo's bounding box so `pad` controls the size.
- Record the source and licence of every new mark in `src/img/marks/SOURCES.md`.
- Do not set `pad` on brands used by HDMI input tiles: input tiles size the mark in CSS and
  `pad` would override it.

## Verify

Check changes visually in the preview (Home, a scrolled row with a focused tile, `#all`,
`#homeapps`) before reporting them done.
