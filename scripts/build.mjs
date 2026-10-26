// Builds the two apps into single, self-contained HTML files in dist/.
// Usage: node scripts/build.mjs
// If symbols/local/ holds a private symbol library (seelib.js / seeall.js), it is bundled in;
// otherwise the apps use their built-in symbols. symbols/local/ is never committed.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const local = (f) => (existsSync(join(root, 'symbols/local', f)) ? read('symbols/local/' + f) + '\n' : '');

mkdirSync(join(root, 'dist'), { recursive: true });

const symbols = local('seelib.js') + local('seeall.js');
const electrical = read('src/electrical/ui.html')
  .replace('/*__ENGINE__*/', () => symbols + read('src/electrical/engine.js'))
  .replace('/*__EDITOR__*/', () => read('src/electrical/editor.js'));
writeFileSync(join(root, 'dist/index.html'), electrical);

const logo = read('src/logo/ui.html').replace('/*__ENGINE__*/', () => read('src/logo/engine.js'));
writeFileSync(join(root, 'dist/logo.html'), logo);

console.log('built dist/index.html (LAZY Electrical' + (symbols ? ', with local symbol library' : ', built-in symbols') + ') and dist/logo.html (LAZY Logo)');
