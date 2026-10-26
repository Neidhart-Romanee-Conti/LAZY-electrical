# Roadmap

The aim: the everyday feature set of a professional electrical CAD program, plus an AI assistant that can work with every part of it.
This list comes from the feature descriptions of commercial electrical CAD tools, sorted by what matters most for control panel work.
✅ = works today · 🟡 = partly · ⬜ = not yet

## Phase 1: solid foundation
- ✅ Single-file web apps, automatic tests, published on GitHub Pages
- ⬜ English interface next to Dutch
- ⬜ Built-in AI with your own API key (besides claude.ai and copy-paste)
- ⬜ Save and open project files (`.lazy.json`) instead of copy-paste
- ⬜ Original IEC 60617 symbol library (CC BY-SA), replacing private libraries
- ⬜ Desktop version (e.g. Tauri) for real files and offline use

## Phase 2: component model (the big one)
- 🟡 Schematic editing: place, move, rotate, delete, wires, text, grid snapping. Today this edits drawings; it should edit components.
- ⬜ Components with id, type, pins and properties; symbols are only their pictures
- ⬜ Wires connect pins; nets (potentials) are computed
- 🟡 Automatic device tags (sheet + column, e.g. `2K3`): today for generated sheets only
- 🟡 Cross-references (coil ↔ contacts, potential arrows between sheets): today for generated sheets only
- ⬜ Contact management: a relay's contacts can't exceed what it physically has
- ⬜ Wire numbering (automatic, per potential or per wire)
- ⬜ Real-time checks: unconnected pins, open contacts, duplicate tags, coils without a counterpart

## Phase 3: documents and lists
- 🟡 PDF export of the whole set (works; later: clickable cross-references)
- ⬜ Project tree with sheet management (add, reorder, renumber)
- ⬜ Title block templates (school, company)
- ⬜ Bill of materials with part numbers
- ⬜ Terminal strip plans (graphical terminal matrix)
- ⬜ Cable list and cable core assignment
- ⬜ PLC I/O lists (LOGO! first, later other PLCs)
- ⬜ Parts database (manufacturer, part number, number of contacts, dimensions)

## Phase 4: drawing power
- ⬜ Symbol editor (draw your own symbols with defined pins)
- ⬜ Macros: reusable circuit pieces (e.g. "motor starter with thermal relay")
- ⬜ Copy/paste between sheets and projects (with re-tagging)
- ⬜ DXF export / import
- ⬜ Multi-line text, dimensions, frames

## Phase 5: panel layout
- ⬜ 2D cabinet layout linked to the schematic (DIN rails, cable ducts, components to scale)
- ⬜ Pick list: place every schematic component in the cabinet exactly once

## AI assistant (grows with every phase)
- ✅ Generate a project from a description, check it, fix it automatically
- ✅ Teachable with your own design rules
- ✅ LAZY Logo: write a LOGO! program plus tests, linked to the real wiring
- ⬜ The AI works through the same editing commands as the user, so every AI change is undoable and checked
- ⬜ Electrical rule check in plain language ("emergency stop doesn't cut motor 2")
- ⬜ Explain a schematic, find mistakes, suggest parts and breaker sizes
- ⬜ Generate BOM, terminal plan and LOGO! program from one description

## Out of scope (for now)
- House installation plans
- 3D cabinet design
- Uploading programs to a LOGO! directly (the vendor's transfer protocol isn't public)
