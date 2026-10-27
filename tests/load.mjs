// Loads the browser engine into a sandbox so tests run in plain Node.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
// The order matters: later modules use the earlier ones (same order as in the built app).
export const ELECTRICAL = ['symbols', 'model', 'render', 'parts', 'auto', 'lists', 'cabinet', 'checks', 'standard', 'examples', 'ai'];

export function loadElectrical() {
  const ctx = vm.createContext({ Math, JSON, Object, Array, String, Number, Set, Map, Date, RegExp, Error, isFinite, parseInt, parseFloat, console });
  for (const f of ELECTRICAL) vm.runInContext(read('src/electrical/' + f + '.js'), ctx, { filename: f + '.js' });
  return vm.runInContext('LE', ctx);
}
