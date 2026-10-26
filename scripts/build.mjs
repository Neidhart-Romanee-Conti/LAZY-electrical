// Builds LAZY Electrical into one self-contained HTML file: dist/index.html.
// Usage: node scripts/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ELECTRICAL } from '../tests/load.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

mkdirSync(join(root, 'dist'), { recursive: true });

// engine modules in dependency order, then the app
const engine = ELECTRICAL.map((f) => '/* ---- ' + f + '.js ---- */\n' + read('src/electrical/' + f + '.js')).join('\n');
const electrical = read('src/electrical/ui.html')
  .replace('/*__LE__*/', () => engine)
  .replace('/*__APP__*/', () => read('src/electrical/app.js'));
writeFileSync(join(root, 'dist/index.html'), electrical);

console.log('built dist/index.html (LAZY Electrical, ' + Math.round(electrical.length / 1024) + ' kB)');
