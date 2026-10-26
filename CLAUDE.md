# Notes for Claude (and other contributors)

## The project
- **What it is:** LAZY Electrical, an electrical CAD program for wiring diagrams and control panels, with an AI assistant at its core.
- **Goal:** match most of a professional electrical CAD program's features (components, cross-references, terminal plans, BOM, PDF sets, cabinet layout), with the AI as a first-class tool that can build a whole schematic by itself.
- **Scope:** this repository is LAZY Electrical only. Don't add separate apps or side projects.
- **Owner:** a student who is new to GitHub and programming. Explain git steps in plain words, keep commits small and well described, and don't assume prior knowledge.
- **Interface language:** Dutch. Keep every user-facing text in Dutch unless asked otherwise. Code, comments, commits and docs are in English.

## Rules that matter
- **Never commit a symbol library derived from commercial software.** `symbols/local/` is git-ignored and not used by the build. All symbols are our own drawings in `src/electrical/symbols.js`.
- **Don't name or imitate commercial products in the UI or branding.** The workspace follows the usual electrical-CAD layout (ribbon, project tree, sheet tabs, symbol browser, list views), but names, icons, colours and symbol drawings are our own. Siemens LOGO! may be named, since it is PLC hardware the program supports.
- **Everything is on the grid:** geometry is stored in grid units (A3: 1 unit = 5 mm, A4: 1 unit = 3 mm, see `TEMPLATES` in `model.js`).
  - Symbol pins and wire points are whole numbers, so connections are exact.
  - New symbols need pins on whole grid units (first pin at 0,0).
  - Wires connect only at their ends or corners: on a pin, on a potential rail, or on another wire (a T-junction, drawn with a dot). Crossing wires do not connect.
  - Parallel wires must be at least one grid unit apart (the tests check that no wires overlap).
  - `tests/electrical.test.mjs` checks grid alignment and compares the connections the layout engine promised with the ones it drew (no opens, no shorts). Run `npm test` after any change to symbols, the model or the layout engine.
- **Keep it dependency-free** unless there is a strong reason: plain JS, one HTML file, `node --test` for tests. jsPDF is loaded from cdnjs for the PDF export only.

## How the code works (`src/electrical/`, global `LE`, loaded in this order)
- **`symbols.js`** (`LE.symbols`): the symbol library. Each symbol has pins, graphics, a role and an IEC 81346 letter.
  - Roles: `master` (coil, breaker), `slave` (contact; belongs to the master with the same tag), `device` (push button), `terminal`, `ref` (continuation arrow), `plain`.
  - `pairs` = pin pairs a wire must not run straight through (the wire is cut there); `through` = pins that are connected inside the symbol.
- **`model.js`** (`LE.model`): the project and all editing operations. Every edit goes through `History.run()` for undo.
  - A project has pages; a page has items: `sym`, `wire`, `pot` (potential rail), `cable`, `text`, `line`, `rect`, `circle`, `flframe` (function/location frame), and cabinet items.
  - `fixPage()` splits wires at pins and removes wire pieces inside symbols, so you can draw a wire first and drop a contact on it.
  - `analyze()` computes everything derived, never stored: nets, devices (same function + location + tag = one device), automatic contact numbers, cross-references, junction dots, wire numbers, cable cores.
- **`render.js`** (`LE.render`): page → drawing primitives in mm (frame, title block, labels, contact cross under coils, potential references, wire numbers) → SVG. The PDF export uses the same primitives.
- **`parts.js`** (`LE.parts`): parts database. A generic starter set without invented part numbers, plus the project's own parts (CSV import). It gives contact capacity, sizes and heat loss.
- **`auto.js`** (`LE.auto`): the layout engine. A page description (potentials + current paths with series/parallel chains, multi-pole paths, motor-starter macros `dol`/`rev`/`yd`) becomes symbols and wires on the grid. The AI and the examples use this format; the AI never places coordinates.
- **`lists.js`** (`LE.lists`): BOM, components, terminal plan, cables, cores, wires, PLC I/O, contacts, contents. These feed the database tables, the printed graphical lists and CSV.
- **`cabinet.js`** (`LE.cabinet`): 2D cabinet layout to scale. It covers the pick list of schematic devices, DIN rails and ducts (lengths go into the BOM), snapping to rails and heat loss.
- **`checks.js`** (`LE.checks`): electrical rule check with Dutch messages: short circuits, contacts without a coil, duplicate tags, unconnected pins, loose wires, too many contacts for the part, and more.
- **`examples.js`**: example projects in the page-description format. They are also the layout tests and the AI's worked example.
- **`ai.js`** (`LE.ai`): the prompt (format + symbol catalogue + design rules + current project), lenient JSON parsing, applying a reply (`project` or `ops`), and the loop. The loop asks Claude, applies and checks the answer, and sends errors back, for up to 3 rounds.
- **`app.js` + `ui.html`**: the workspace UI. It has the ribbon, the tree, tabbed sheets with the drawing tools, properties, the symbol browser, database tables, checks, the File backstage, PDF/CSV export and the AI panel.
- **AI connection:** on claude.ai it uses the artifact `sample` capability (`window.claude.use('sample')`). Elsewhere it can use the user's own API key (a direct browser call with streaming), or fall back to copy-paste.

## Commands
- `npm test` runs all tests.
- `npm run build` writes `dist/index.html` (one self-contained file).

## Next steps
See `docs/ROADMAP.md`. Big open items: symbol editor, macros, DXF, revisions, and letting the AI make small hand-level edits through the same model operations.
