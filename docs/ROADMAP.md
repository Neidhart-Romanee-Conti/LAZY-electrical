# Roadmap

The aim: the everyday feature set of a professional electrical CAD program, plus an AI assistant that can work with every part of it.
This list comes from the published feature matrices of commercial electrical CAD tools (entry, standard and advanced levels plus add-on modules), sorted by what matters most for control panel work.
✅ = works today · 🟡 = partly · ⬜ = not yet

## Phase 1: solid foundation
- ✅ Single-file web app, automatic tests, published on GitHub Pages
- ✅ Workspace UI: ribbon, project tree, tabbed sheets, symbol browser with search and favourites, properties, check panel, File backstage
- ⬜ English interface next to Dutch
- ✅ Built-in AI with your own API key (besides claude.ai and copy-paste)
- ✅ Save and open project files (`.lazy.json`), autosave in the browser
- 🟡 Auto-backup (autosave of the current project; no history of older versions yet)
- 🟡 Original IEC 60617 symbol library (about 50 own symbols; more to come)
- ⬜ Desktop version (e.g. Tauri) for real files and offline use
- ⬜ Read-only viewer mode (open a project to view and print it, without editing)

## Phase 2: component model
- ✅ Schematic editing: place, move (wires follow), rotate, mirror, delete (wires heal), copy/paste with re-tagging, undo/redo, grid snapping
- ✅ Components with id, type, pins and properties; symbols are only their pictures
- ✅ Wires connect pins; nets (potentials) are computed; junction dots appear by themselves
- ✅ Rubber band: moving a component keeps its wires attached
- ✅ Wire drawn through a symbol is cut at its pins (draw first, drop symbols on it, or the other way round)
- ⬜ Auto-connect suggestions while placing
- ✅ Draw several parallel wires at once (1 to 5)
- ✅ Automatic device tags: consecutive, page + column (`2K3`), page + number
- ⬜ User-defined tag/wire numbering formulas
- ✅ Lock a tag so renumbering leaves it alone
- ✅ Functions and locations (`=` and `+`, IEC 81346) per page, per frame or per component
- ✅ Cross-references: coil ↔ contacts, contact cross under coils, potentials between sheets, continuation arrows, PLC module ↔ channels
- ✅ Contact management: automatic contact numbers; a warning when a device uses more contacts than its part has
- ✅ Devices spread over several sheets (coil + contacts, PLC module + channels, terminal strips)
- 🟡 Signals: named potentials carried across sheets (no signal properties yet)
- ✅ Wire numbering (consecutive or page.column, manual numbers per connection)
- ⬜ Wire direction / connection order editing
- ✅ Checks: unconnected pins, contacts without a coil, duplicate tags/terminals/PLC addresses, short circuits, loose wires, overloaded contacts, cables with too few cores
- ✅ Find and replace text across the project
- ⬜ Replace one symbol type with another across the project

## Phase 3: documents and lists
- ✅ PDF export of the whole set (A3/A4) including the graphical lists
- ⬜ PDF bookmarks and clickable cross-references
- ✅ Project tree with sheet management: add, insert with page index (1a), copy, delete, reorder, renumber, folders
- 🟡 Title block (one own design; templates per school/company still to do); A3 and A4 formats
- ✅ Live lists: components, terminals, BOM, contacts, cables, cores, wires, PLC I/O, contents
- ✅ Jump from a list row to the symbol on its sheet
- 🟡 Edit components in a table (description, part number, maker) — more columns to come
- ✅ Bill of materials with part numbers, counted per part, including cables, DIN rail and duct
- 🟡 Parts that are not drawn (data field exists, no editor yet)
- ✅ Terminal plan (inner/outer side, bridges, cable cores); renumber a strip
- ⬜ Multi-level terminals
- ✅ Cables drawn across wires; cable and core lists
- ⬜ Connector plans (pin matrix per connector)
- ✅ PLC I/O lists with automatic addresses (Siemens LOGO! parts included)
- ✅ Parts database (contacts, sizes, heat loss), CSV import
- ⬜ Labels for terminals, wires and devices (label printers)
- 🟡 CSV export of all lists (import back still to do)
- ⬜ Report generator for own lists

## Phase 4: drawing power
- ⬜ Symbol editor (draw your own symbols with defined pins)
- ⬜ Macros: reusable circuit pieces (the AI's page descriptions and motor-starter macros are a first step)
- ⬜ Macro variants (e.g. motor feeders by power)
- ✅ Copy/paste between sheets with re-tagging; copy a whole sheet
- ⬜ DXF export / import
- ✅ SVG export of a sheet
- ⬜ Insert images and PDF pages
- 🟡 Text, lines, rectangles, circles (no dimensions or layers yet)
- ⬜ Hyperlinks on drawing elements
- ⬜ Redlining: review comments on sheets
- ⬜ IEEE/ANSI style next to IEC

## Phase 5: panel layout
- ✅ 2D cabinet layout to scale, linked to the schematic (mounting plate, DIN rails, cable ducts)
- ✅ Pick list: place every schematic component in the cabinet exactly once (checked)
- ✅ Sizes from the parts database, snap onto DIN rails
- ✅ Rail and duct lengths in the BOM
- ✅ Heat calculation of the placed devices
- ⬜ Drilling templates, door layout, dimensions per device

## Phase 6: revisions and teamwork
- ⬜ Revisions: revision index and change list
- ⬜ Compare two versions of a project
- ⬜ Merge projects
- ⬜ Translate project texts
- ⬜ Shared libraries for a class or company

## AI assistant (grows with every phase)
- ✅ Design a complete project from a description (power circuit, control circuit, PLC), laid out by the program, checked and fixed automatically
- ✅ Change an existing project (rebuild a sheet, add sheets, change devices) as one undoable step
- ✅ Teachable with your own design rules
- ✅ Answer questions about the schematic; review it for mistakes; explain how it works
- ⬜ Small hand-level edits (move one contact, add one wire) through the same model operations
- ⬜ Suggest parts and breaker sizes from the parts database
- ⬜ Read a scanned or photographed old schematic and turn it into an editable project
- ⬜ Generate a project from a spreadsheet (I/O list or motor list)

## Out of scope (for now)
- House installation plans
- 3D cabinet design and wire harness design
- Power distribution calculations (cable sizing, selectivity), maybe later
- Coupling to company document management (PDM) systems
