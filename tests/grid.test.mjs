// Every generated sheet must sit on the 3 mm grid without changing the circuit:
// all wire ends and symbol connection points on grid points, no bent wires,
// and exactly the same electrical connections as the unaligned drawing (no opens, no shorts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadElectrical, hasLocalSymbols } from './load.mjs';
import { projects } from './projects.mjs';

function kindOf(sh) { return (p) => (p.g ? ((sh.groups[p.g] || {}).k || 'sym') : p.t === 'l' ? 'wire' : p.t === 'c' && p.fill === 'k' ? 'dot' : 'loose'); }
function nets(SF, sh) {
  const K = kindOf(sh), W = [], P = [], par = {};
  sh.prims.forEach((p, i) => {
    const k = K(p);
    if (k === 'wire' && p.t === 'l' && Math.hypot(p.x1 - p.x2, p.y1 - p.y2) > 1e-6) W.push([i, p]);
    else if ((k === 'sym' || k === 'shape') && p.t === 'l') { P.push(['p' + i + 'a', [p.x1, p.y1]]); P.push(['p' + i + 'b', [p.x2, p.y2]]); }
  });
  const f = (x) => { while (par[x] !== undefined && par[x] !== x) x = par[x]; return x; };
  const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
  W.forEach(([i]) => (par['w' + i] = 'w' + i));
  W.forEach(([i, w]) => [[w.x1, w.y1], [w.x2, w.y2]].forEach((e) => W.forEach(([j, v]) => { if (i !== j && SF.onSeg(e, v, 0.05)) u('w' + i, 'w' + j); })));
  const touched = {};
  P.forEach(([id, pt]) => W.forEach(([j, v]) => { if (SF.onSeg(pt, v, 0.05)) { par[id] = par[id] || id; u(id, 'w' + j); touched[id] = 1; } }));
  return { f, touched, ids: P.map((p) => p[0]) };
}
function audit(SF, P) {
  const on = (v) => Math.abs((v - SF.GRID.o) / SF.GRID.g - Math.round((v - SF.GRID.o) / SF.GRID.g)) < 1e-6;
  const before = SF.render(Object.assign({}, P, { grid: false })), after = SF.render(P), issues = [];
  after.forEach((sh, si) => {
    const K = kindOf(sh), W = sh.prims.filter((p) => K(p) === 'wire' && p.t === 'l'), tag = 'sheet ' + sh.no + ': ';
    W.forEach((w) => {
      if (![w.x1, w.y1, w.x2, w.y2].every(on)) issues.push(tag + 'wire off grid ' + [w.x1, w.y1, w.x2, w.y2]);
      if (Math.abs(w.x1 - w.x2) > 1e-6 && Math.abs(w.y1 - w.y2) > 1e-6) issues.push(tag + 'bent wire ' + [w.x1, w.y1, w.x2, w.y2]);
    });
    sh.prims.filter((p) => K(p) === 'dot').forEach((d) => { if (!on(d.x) || !on(d.y)) issues.push(tag + 'junction dot off grid'); });
    const S = {};
    sh.prims.forEach((p) => { const k = K(p); if (k === 'sym' || k === 'shape') (S[p.g] = S[p.g] || []).push(p); });
    Object.keys(S).forEach((g) => SF.pinsOf(S[g], W).forEach((pt) => { if (!on(pt[0]) || !on(pt[1])) issues.push(tag + 'pin off grid ' + pt); }));
    const nb = nets(SF, before[si]), na = nets(SF, sh);
    const ids = nb.ids.filter((id) => nb.touched[id] || na.touched[id]);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const x = ids[a], y = ids[b];
      const sb = nb.touched[x] && nb.touched[y] && nb.f(x) === nb.f(y), sa = na.touched[x] && na.touched[y] && na.f(x) === na.f(y);
      if (sb !== sa) issues.push(tag + (sb ? 'OPEN' : 'SHORT') + ' between ' + x + ' and ' + y);
    }
  });
  return [...new Set(issues)];
}

const variants = [['built-in symbols', false]].concat(hasLocalSymbols ? [['local symbol library', true]] : []);
for (const [vname, sym] of variants) {
  const SF = loadElectrical({ symbols: sym });
  for (const [name, P] of projects(SF)) {
    test(`grid: ${name} (${vname})`, () => {
      if (P.plc === 'none') assert.deepEqual(JSON.parse(JSON.stringify(SF.checkLadder(P, P.ladder).errors)), [], 'test project must be valid');
      assert.deepEqual(audit(SF, P), []);
    });
  }
}
