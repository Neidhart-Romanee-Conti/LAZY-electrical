# LAZY Electrical

Free, open-source electrical CAD for wiring diagrams and control panels, with a built-in AI assistant that can design a schematic for you, check it and fix it.

**[Open LAZY Electrical in your browser →](https://neidhart-romanee-conti.github.io/LAZY-electrical/)**

Nothing to install, no account needed. It runs entirely in your browser, and your projects stay on your computer.

> The interface is in Dutch (Nederlands). An English interface is planned.

**Status: early, but usable.** It already handles complete control-panel projects. Some features are still missing; see the [roadmap](docs/ROADMAP.md).

## Getting started

1. **Open the app** using the link above.
2. **Look at an example:** open **Bestand → Voorbeelden** (File → Examples) and pick one, for example a reversing motor or a star-delta starter.
3. **Start your own:** open **Bestand → Nieuw project** (File → New project). Click a symbol in the **Symbolen** panel on the right to place it, and draw wires with **Ctrl+1** (one wire) or **Ctrl+3** (three wires).
4. **Or let the AI design it:** open the **AI-assistent** tab on the right and describe your circuit, e.g. *"a pump that starts with a push button and stops with a float switch, with emergency stop and signal lamps"*.
5. **Save and print:** **Ctrl+S** saves the project as a `.lazy.json` file. The PDF button exports the whole set.

All keyboard shortcuts are listed under **Bestand → Help**.

## Features

- **Schematics:** a library of standard symbols (contacts, coils, timers, push buttons, breakers, overloads, motors, lamps, terminals, PLC I/O, power supplies …). Everything snaps to the grid, and wires follow when you move a symbol.
- **Automatic numbering:** device tags, contact numbers, wire numbers, terminal numbers and PLC addresses. Coils get a contact cross, and contacts get cross-references to their coil. All of it updates after every edit.
- **Lists:** bill of materials, component list, terminal plan, cable and core lists, wire list, PLC I/O list and contact list. They're printed with the set and can be exported as CSV.
- **Checks:** finds short circuits, contacts without a coil, duplicate tags, unconnected pins, loose wires and more.
- **Cabinet layout:** a mounting plate to scale, with DIN rails and cable ducts.
- **Parts database:** a starter set of generic parts, plus your own parts or a supplier catalogue imported from CSV.
- **Output:** a PDF of the whole set (A3 or A4), SVG of a single sheet, CSV lists.

## The AI assistant

- **Design:** describe a circuit and it builds the complete project: supply, control circuit, PLC inputs and outputs, and power circuit.
- **Change:** ask it to change an existing project. Besides redesigning, it can edit the drawing itself: merge and renumber terminal strips, rename or renumber devices, swap a contact, move, delete or add symbols and wires, and change sheets.
- **Ask:** ask it questions about your schematic.
- **Every result is checked:** the program checks the AI's work and sends any errors back to it to fix. You can undo every AI change.
- **Your own rules:** add design rules of your own (for example *"always use 24 V DC control voltage"*), and the AI follows them in every project.

You can connect the assistant in three ways:

- **On claude.ai:** it uses your own Claude account.
- **With your own API key** from [console.anthropic.com](https://console.anthropic.com): enter it under **Bestand → Instellingen** (File → Settings). The key is only stored in your browser.
- **Without either:** the app gives you a prompt to paste into any Claude chat, and you paste the answer back.

## Running it locally

You need [Node.js](https://nodejs.org) 20 or newer. There are no other dependencies.

```bash
git clone https://github.com/Neidhart-Romanee-Conti/LAZY-electrical.git
cd LAZY-electrical
npm test          # run the automatic tests
npm run build     # writes dist/index.html
```

Open `dist/index.html` in your browser. The whole program is that one HTML file, so you can also copy it and use it offline.

## Contributing

Bug reports, ideas and pull requests are welcome. Please open an issue first for bigger changes.

```
src/electrical/   the program: symbols, model, render, parts, auto (layout engine), lists, cabinet,
                  checks, standard (standard sheet set), examples, ai, app (interface), ui.html
tests/            automatic tests (node --test)
docs/ROADMAP.md   planned features
```

## License

[GPL-3.0](LICENSE). Siemens and LOGO! are trademarks of Siemens AG. This project is not affiliated with Siemens or with any commercial CAD vendor.
