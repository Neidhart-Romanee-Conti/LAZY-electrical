# Notes for Claude (and other contributors)

## The project
- **What it is:** LAZY Electrical, an electrical CAD program for wiring diagrams and control panels, with an AI assistant at its core.
- **Goal:** match most of a professional electrical CAD program's features (components, cross-references, terminal plans, BOM, PDF sets), with the AI as a first-class tool.
- **Owner:** a student who is new to GitHub and programming. Explain git steps in plain words, keep commits small and well described, and don't assume prior knowledge.
- **Interface language:** Dutch. Keep every user-facing text in Dutch unless asked otherwise. Code, comments, commits and docs are in English.

## Rules that matter
- **Never commit a symbol library derived from commercial software.** `symbols/local/` holds a private library for the owner's own builds and is git-ignored. Public builds must work with the built-in symbols in `src/electrical/engine.js`.
- **Don't name or imitate commercial products in the UI or branding.** Siemens LOGO! may be named, since it is the hardware the program supports.
- **Everything must stay on the 3 mm grid:** grid = `SF.GRID` (step 3 mm, origin 1 mm, so the frame's column lines at x = 10 + 27c are on it).
  - New symbols need connection points that are whole grid steps apart.
  - Wires must end exactly on a pin, not run into a symbol.
  - Parallel wires must be at least 3 mm apart.
  - `tests/grid.test.mjs` checks all of this, including that alignment never creates opens or shorts. Run it after any layout change.
- **Keep it dependency-free** unless there is a strong reason: plain JS, one HTML file per app, `node --test` for tests.

## How the code works
- **`src/electrical/engine.js`** (global `SF`) turns a project object (form data + optional `ladder`) into sheets of drawing primitives.
  - **Primitives:** `{t:'l'|'pl'|'r'|'c'|'tx', ...}`. Primitives that belong to one symbol share a group id `g`; `groups[g].k` is the kind (`sym`, `frame`, …).
  - **Two passes:** `render()` runs twice, so cross-references can point forward. It then aligns every sheet to the grid (`alignPrims`).
  - **Ladder format:** a rung is a series list of contacts, `{par:[[...],[...]]}` parallel groups, and an output at the end. `checkLadder()` validates it.
- **`src/electrical/editor.js`** is drawing mode. `P.drawing` holds editable sheets (the primitives with group ids). After hand edits, the form no longer redraws the sheets until "Opnieuw genereren".
- **`src/electrical/ui.html`:**
  - the form;
  - the AI assistant: prompt = format spec + user rules + current project; the reply is checked with `checkLadder`, and up to 3 retries/correction rounds;
  - the rules card;
  - PDF export via jsPDF.
- **`src/logo/engine.js`** (global `LL`): LOGO! function blocks, the simulator (`makeSim`), `check`, behaviour tests (`runTests`), `autoLayout`.
  - LAZY Logo can link a LAZY Electrical project: its inputs/outputs become fixed constraints for the AI, and interlocks are checked by random simulation.
- **AI on claude.ai** uses the artifact `sample` capability (`window.claude.use('sample')`). Elsewhere it falls back to copy-paste mode.

## Decisions and preferences (from earlier work with the owner)

**Look and feel**
- Plain black and white with IBM Plex Sans/Mono, square borders, no colors.
- Header logo: an inverted **LAZY** block followed by the app name.
- Keep the UI lean. The owner explicitly asked to remove:
  - explanation texts and hint paragraphs;
  - example placeholder texts in input fields;
  - "save as example" features;
  - notes about the Claude account.
- Don't add such texts back. Short labels are enough.
- Every form section can be collapsed (remembered per browser). In drawing mode (Tekenen) the whole form panel is hidden by default, with a "Formulier tonen" button.

**Drawing conventions (the owner's school layout)**
- A4 landscape, frame with columns 0–9 and rows A–F, title block at the bottom.
- Sheet order:
  1. supply (voedingsblad: L1–L3/N/PE, main breaker, PSU, breakers);
  2. control circuit (stuurschakeling);
  3. LOGO! inputs (ingangen) and outputs (uitgangen), with a WAGO 24 V relay per output;
  4. power circuit (vermogenblad).
- Device tags = sheet number + letter + column (e.g. `2K3`). Duplicates get `.1`, `.2`.
- Cross-reference tables H/M/V under coils.
- Terminals marked `X` + number, only for parts outside the panel. Thermal relays sit in the panel, so they get no X terminals.

**Behaviour the owner asked for**
- The AI must never show "invalid answer" errors to the user. Repair the answer, retry quietly, and only report real failures in plain Dutch.
- Protection devices (emergency stop, stop buttons, thermal contacts) appear once at the start of a rung, then the rung branches. Never repeat them per coil.
- "Start from two places" means two NO start buttons in parallel and two NC stop buttons in series.
- The rules card ("Regels voor de AI") holds general rules that apply to every project. It is saved per account on claude.ai (artifact `db`) and in localStorage elsewhere.
- In LAZY Logo, push buttons have a "vast" toggle in the simulator, so several buttons can be held at once.

**Hardware**
- **At home:** the owner has a LOGO! 24 0BA5 (6ED1 052-1CC00-0BA5, 24 V DC, transistor outputs, no Ethernet).
- **At school:** an Ethernet LOGO!.
- Programs reach the module through LOGO! Soft Comfort. The `bridge/` only remote-controls a LOGO! 8 over Ethernet.

**Known limitations right now**
- In drawing mode, wires don't follow when a symbol is moved.
- Tags and cross-references don't update after hand edits; that needs the component model.
- PDF export of hand-edited drawings hasn't been tested on real output yet.
- The public build uses simple built-in symbols. The owner's own builds use the private library in `symbols/local/`.

## Commands
- `npm test` runs all tests.
- `npm run build` writes `dist/index.html` and `dist/logo.html`.

## Big next step
Move from "drawing primitives" to a real component model (components with ids and pins, wires connecting pins, nets). Then tags, cross-references, wire numbers, terminal plans and BOM update themselves after manual edits, and the AI can work through the same editing commands. See `docs/ROADMAP.md`.
