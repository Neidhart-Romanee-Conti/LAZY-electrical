# LAZY Electrical

Vibe-coded electrical CAD for wiring diagrams, control panels and complete schematic sets, with a powerful AI assistant that helps design, check and fix circuits.

> The program's interface is in Dutch (Nederlands). An English interface is on the roadmap.

**Status: early prototype.** It already works for small control panels, but a lot is still missing. See [docs/ROADMAP.md](docs/ROADMAP.md).

## What it does today

**LAZY Electrical**, the schematic program:
- **Generates a full schematic set from a short form:** supply sheet, control circuit, LOGO! inputs and outputs, and power circuit.
- **Two kinds of control circuit:** with a Siemens LOGO!, or hard-wired with contactors written as ladder rungs (timers, limit switches, reversing, star-delta, up to 3 motors).
- **Tags and cross-references:** device tags are numbered automatically, and the cross-reference tables under coils are filled in.
- **Drawing mode (Tekenen):** drag and drop symbols, draw wires, edit any text. Everything snaps to a 3 mm grid.
- **AI assistant:** describe a circuit ("reverse a motor from two places without a LOGO!") and it builds the project. It checks the result and fixes mistakes automatically. You can teach it your own design rules.
- **PDF export** of the whole set.

**LAZY Logo**, a function-block editor and simulator for the Siemens LOGO!:
- **Build and simulate:** function-block diagrams with a live simulator (NC inputs, push buttons, timers, counters).
- **Behaviour tests:** "press I1 → Q1 must turn on".
- **AI assistant:** writes the program and its tests, and repairs it until the tests pass.
- **Linked to a schematic:** link a LAZY Electrical schematic so the AI uses your real wiring, and it checks interlocks (e.g. reversing contactors never on together).

## Try it

Open the published version: **https://neidhart-romanee-conti.github.io/LAZY-electrical/** (LAZY Electrical) and `/logo.html` (LAZY Logo).
The repository's Pages setting must be set to "GitHub Actions" for these links to work.

The AI assistant works directly inside claude.ai (when opened there as an artifact). In a normal browser it gives you a prompt to paste into Claude, and you paste the answer back. A built-in API-key option is planned.

## Build it yourself

You need [Node.js](https://nodejs.org) 20 or newer. There are no other dependencies.

```bash
npm test          # run the automatic checks
npm run build     # writes dist/index.html and dist/logo.html
```

Open `dist/index.html` in your browser. Each app is one self-contained HTML file.

## Project layout

```
src/electrical/   LAZY Electrical: engine.js (drawing engine), editor.js (drawing mode), ui.html (interface)
src/logo/         LAZY Logo: engine.js (blocks, simulator, checks), ui.html
bridge/           Python tool to run a LAZY Logo program against a real LOGO! 8 over Ethernet
symbols/          symbol notes; symbols/local/ is for private libraries and is never committed
tests/            automatic tests (node --test)
docs/ROADMAP.md   where the project is going
```

## License

Code: [AGPL-3.0](LICENSE). Siemens and LOGO! are trademarks of Siemens AG. This project is not affiliated with Siemens or with any commercial CAD vendor.
