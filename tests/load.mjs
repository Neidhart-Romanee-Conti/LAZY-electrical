// Loads the browser engines into a sandbox so tests run in plain Node, with or without the local symbol library.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
export const hasLocalSymbols = existsSync(join(root, 'symbols/local/seelib.js'));

export function loadElectrical({ symbols = false } = {}) {
  const ctx = vm.createContext({ Math, JSON, Object, Array, String, Number, isFinite });
  if (symbols) vm.runInContext(read('symbols/local/seelib.js') + '\n' + read('symbols/local/seeall.js'), ctx);
  vm.runInContext(read('src/electrical/engine.js') + '\n;globalThis.__SF = SF;', ctx);
  return ctx.__SF;
}
export function loadLogo() {
  const ctx = vm.createContext({ Math, JSON, Object, Array, String, Number, isFinite });
  vm.runInContext(read('src/logo/engine.js') + '\n;globalThis.__LL = LL;', ctx);
  return ctx.__LL;
}
