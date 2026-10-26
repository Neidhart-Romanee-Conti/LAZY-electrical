# Symbols

LAZY Electrical draws with **built-in symbols** (simple IEC-style shapes in `src/electrical/engine.js`).
Everything in this repository is free to use under the project license.

## Private symbol libraries (`symbols/local/`)

You can drop a private symbol library into `symbols/local/` (`seelib.js`, `seeall.js`).
`npm run build` bundles it automatically, so your own copy of the program looks the way you are used to.

**This folder is ignored by git and must never be committed.** Symbol libraries taken from commercial
CAD software belong to their makers; publishing them is not allowed.

## Plan

Draw a complete, original IEC 60617-style symbol library for this project (see `docs/ROADMAP.md`),
published under CC BY-SA 4.0, so the public version no longer needs any private library.
