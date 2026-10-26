# LAZY Electrical

Electrical CAD for wiring diagrams, control panels and complete schematic sets, with an AI assistant that can design a schematic by itself and check and fix it.

> The program's interface is in Dutch (Nederlands). An English interface is on the roadmap.

**Status: early, but usable.** The core of a professional electrical CAD program works: components with pins, real wires and nets, automatic tags and cross-references, terminal plans, cable lists, BOM, checks, PDF sets and a cabinet layout. A lot is still missing; see [docs/ROADMAP.md](docs/ROADMAP.md).

## What it does

**Workspace:** a ribbon with commands, a project tree (sheets, cabinet layouts, graphical lists, database lists), tabbed sheets, a symbol browser with search and favourites, a properties panel and a check panel.

**Drawing:**
- Place symbols (contacts, coils, timers, push buttons, emergency stop, breakers, motor protection, overloads, fuses, motors, lamps, terminals, PLC inputs and outputs, power supplies …).
- Draw 1, 2, 3, 4 or 5 wires at once. A wire drawn through a symbol is cut at its pins automatically.
- Potentials (L1, N, PE, +24V …) with cross-references between sheets.
- Cables drawn across wires, with cores.
- Continuation arrows.
- Function/location frames (`=` and `+`, IEC 81346).
- Text, lines, rectangles and circles.
- Everything snaps to the grid. Moving a symbol drags its wires along, and undo/redo works for everything.

**Done automatically, also after hand edits:**
- Device tags: consecutive, page + column, or page + number.
- Contact numbers (13-14, 21-22 …).
- The contact cross under each coil, and cross-references from contacts to their coil.
- Wire numbers, terminal numbers and PLC addresses.

**Lists:** contents, BOM, component list, terminal plan (inner and outer side, bridges, cable cores), cable and core lists, wire list, PLC I/O list and contact list. They are printed with the set, shown as editable tables, and exported as CSV.

**Checks:** short circuits, contacts without a coil, duplicate tags, terminal numbers and PLC addresses, unconnected pins, loose wires, more contacts than the chosen part has, and cables with too few cores.

**Cabinet layout:** a mounting plate to scale with DIN rails and cable ducts. Devices come from a pick list, are sized from the parts database and snap onto the rails. You also get a heat-loss total, and the rail and duct lengths go into the BOM.

**Parts database:** a generic starter set, your own parts, and CSV import of a supplier catalogue.

**AI assistant:**
- Describe a circuit ("a pump that starts with a button and stops with a float switch, with emergency stop and lamps") and it designs the complete project: power circuit, control circuit, PLC.
- Ask it to change an existing project, or ask questions about the schematic.
- It doesn't draw coordinates. It writes circuit descriptions, which the program lays out on the grid, checks, and sends back with any errors until they are fixed (up to 3 rounds). Every AI change can be undone.
- You can teach it your own design rules.

**Output:** a PDF of the whole set (A3 or A4), an SVG of a single sheet, CSV lists, and the project file (`.lazy.json`).

## Try it

Open the published version: **https://neidhart-romanee-conti.github.io/LAZY-electrical/**
The repository's Pages setting must be set to "GitHub Actions" for this link to work.

The AI assistant works three ways:
- **On claude.ai** (when the page is opened there as an artifact): it uses your own Claude account.
- **With your own API key** (File → Instellingen): the browser talks to the Claude API directly.
- **Without either:** it gives you a prompt to paste into Claude, and you paste the answer back.

## Build it yourself

You need [Node.js](https://nodejs.org) 20 or newer. There are no other dependencies.

```bash
npm test          # run the automatic checks
npm run build     # writes dist/index.html
```

Open `dist/index.html` in your browser. The whole program is one self-contained HTML file.

## Project layout

```
src/electrical/   the program: symbols, model, render, parts, auto (layout engine), lists, cabinet,
                  checks, examples, ai, app (user interface), ui.html (page and styles)
tests/            automatic tests (node --test)
docs/ROADMAP.md   where the project is going
```

## License

Code: [GPL-3.0](LICENSE). Siemens and LOGO! are trademarks of Siemens AG. This project is not affiliated with Siemens or with any commercial CAD vendor.
