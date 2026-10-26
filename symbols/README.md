# Symbols

LAZY Electrical draws with its own built-in symbols: original IEC 60617-style drawings in `src/electrical/symbols.js`.
Everything in this repository is free to use under the project license.

## Adding a symbol

A symbol is a list of pins and graphics in grid units (y points down, first pin at 0,0).
Pins must sit on whole grid units, so every connection lands exactly on the grid.
Give it a role (`master`, `slave`, `device`, `terminal` …) and an IEC 81346 letter. Then run `npm test`.

## `symbols/local/`

This folder is git-ignored and never committed. The program does not use it.
Symbol libraries taken from commercial CAD software belong to their makers, and publishing them is not allowed.
