// LAZY Electrical engine tests: model editing, automatic layout, nets, lists, checks and the AI apply loop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadElectrical } from './load.mjs';

const LE = loadElectrical();
const M = LE.model;
const plain = (x) => JSON.parse(JSON.stringify(x));
/* editing tests use fixed settings so tag names and coordinates stay predictable */
const NP = () => M.newProject({ settings: { template: 'A3', tagMode: 'consecutive' } });
const consec = (spec) => Object.assign({}, spec, { settings: { template: 'A3', tagMode: 'consecutive' } });
const EX = (id) => consec(LE.examples.find((e) => e.id === id).spec);

/* ---------- helpers ---------- */
function gridIssues(P) {
  const out = [];
  P.pages.forEach((pg) => pg.items.forEach((it) => {
    if (it.k === 'wire') it.pts.forEach((p) => { if (!Number.isInteger(p[0]) || !Number.isInteger(p[1])) out.push('wire off grid on ' + pg.title); });
    if (it.k === 'sym') M.symPins(it).forEach((p) => { if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) out.push('pin off grid ' + it.tag); });
    if (it.k === 'wire') for (let i = 1; i < it.pts.length; i++) { const a = it.pts[i - 1], b = it.pts[i]; if (a[0] !== b[0] && a[1] !== b[1]) out.push('diagonal wire on ' + pg.title); }
  }));
  return out;
}
/* parallel wires must be at least one grid unit apart: no two wires may overlap along a line */
function overlaps(P) {
  const out = [];
  P.pages.forEach((pg) => {
    const segs = [];
    pg.items.filter((i) => i.k === 'wire').forEach((w) => { for (let i = 1; i < w.pts.length; i++) segs.push([w.id, w.pts[i - 1], w.pts[i]]); });
    for (let i = 0; i < segs.length; i++) for (let j = i + 1; j < segs.length; j++) {
      const [ia, a1, a2] = segs[i], [ib, b1, b2] = segs[j];
      if (ia === ib) continue;
      const vert = (p, q) => p[0] === q[0];
      if (vert(a1, a2) && vert(b1, b2) && a1[0] === b1[0]) {
        const lo = Math.max(Math.min(a1[1], a2[1]), Math.min(b1[1], b2[1])), hi = Math.min(Math.max(a1[1], a2[1]), Math.max(b1[1], b2[1]));
        if (hi > lo) out.push(pg.title + ': vertical wires overlap at x=' + a1[0] + ' y ' + lo + '..' + hi);
      }
      if (!vert(a1, a2) && !vert(b1, b2) && a1[1] === b1[1]) {
        const lo = Math.max(Math.min(a1[0], a2[0]), Math.min(b1[0], b2[0])), hi = Math.min(Math.max(a1[0], a2[0]), Math.max(b1[0], b2[0]));
        if (hi > lo) out.push(pg.title + ': horizontal wires overlap at y=' + a1[1] + ' x ' + lo + '..' + hi);
      }
    }
  });
  return out;
}
/* the connections a 1-pole path description promises, as union-find over "item:pin" keys */
function expected(path, trace) {
  const p = new Map(), f = (x) => { if (!p.has(x)) p.set(x, x); while (p.get(x) !== x) x = p.get(x); return x; }, u = (a, b) => { if (a && b) p.set(f(a), f(b)); };
  const itemOf = (el) => { const t = trace.find((x) => x.el === el); assert.ok(t, 'element was not placed: ' + JSON.stringify(el)); return t.it; };
  const toKey = path.to ? 'pot:' + path.to : null;
  function walk(seq, inKey, split) {
    let cur = inKey;
    seq.forEach((el, i) => {
      const last = i === seq.length - 1;
      if (el.par) {
        const isSplit = el.par.every((b) => LE.auto.isOut(b[b.length - 1]));
        const outs = el.par.map((b) => walk(b, cur, isSplit));
        if (isSplit) { cur = null; return; }
        outs.forEach((o) => u(o, outs[0])); cur = outs[0]; return;
      }
      const it = itemOf(el), d = LE.symbols.get(el.s);
      u(cur, it.id + ':0'); f(it.id + ':0');
      cur = d.pins.length > 1 ? it.id + ':1' : null;
      if (d.pins.length > 1) f(cur);
      if ((d.through || []).length) u(it.id + ':0', cur); // a terminal passes the wire straight through
      if (last && split && toKey) u(cur, toKey);
    });
    return cur;
  }
  const out = walk(path.chain, 'pot:' + path.from, false);
  if (out && toKey) u(out, toKey);
  return { f, keys: [...p.keys()] };
}
function actualNet(A, key) {
  if (key.startsWith('pot:')) { const n = A.nets.find((x) => x.pots.has(key.slice(4))); return n ? 'n' + n.id : key; }
  const [id, i] = key.split(':'); return 'n' + A.symById[id].pins[+i].net;
}

/* ---------- model ---------- */
test('model: a contact dropped on a wire splits it, numbers itself and cross-references its coil', () => {
  const P = NP(), pg = M.addPage(P, { title: 't' });
  M.addPot(P, pg.id, 'L1'); M.addPot(P, pg.id, 'N', { side: 'bottom' });
  M.addWire(P, pg.id, [[10, 3], [10, 46]]);
  const s1 = M.place(P, pg.id, 'pb_no', 10, 10), k1 = M.place(P, pg.id, 'coil', 10, 40), c = M.place(P, pg.id, 'no', 10, 20, { tag: 'K1' });
  assert.equal(s1.tag, 'S1'); assert.equal(k1.tag, 'K1');
  assert.equal(pg.items.filter((i) => i.k === 'wire').length, 4);
  const A = M.analyze(P), cs = A.symById[c.id];
  assert.deepEqual(plain(cs.pins.map((p) => p.n)), ['13', '14']);
  assert.equal(cs.xref, '1.' + M.colOf(P, 10));
  assert.equal(A.nets[A.symById[k1.id].pins[1].net].name, 'N');
  assert.deepEqual(plain(LE.checks.run(P, A).filter((x) => x.level === 'error')), []);
});
test('model: deleting an inline contact joins the wire again, moving a coil drags its wires along', () => {
  const P = NP(), pg = M.addPage(P, {});
  M.addPot(P, pg.id, 'L1'); M.addPot(P, pg.id, 'N', { side: 'bottom' });
  M.addWire(P, pg.id, [[10, 3], [10, 46]]);
  const k = M.place(P, pg.id, 'coil', 10, 40), c = M.place(P, pg.id, 'no', 10, 20, { tag: 'K1' });
  M.deleteItems(P, pg.id, [c.id]);
  assert.equal(pg.items.filter((i) => i.k === 'wire').length, 2);
  M.moveItems(P, pg.id, [k.id], 2, 0);
  assert.deepEqual(gridIssues(P), []);
  const A = M.analyze(P);
  assert.equal(A.nets[A.symById[k.id].pins[0].net].name, 'L1');
  assert.equal(A.nets[A.symById[k.id].pins[1].net].name, 'N');
});
test('model: copy/paste gives new tags and keeps contacts with their new coil; undo restores', () => {
  const P = NP(), H = new M.History(P), pg = M.addPage(P, {});
  const k = M.place(P, pg.id, 'coil', 10, 30), c = M.place(P, pg.id, 'no', 10, 20, { tag: 'K1' });
  const clip = M.copyItems(P, pg.id, [k.id, c.id]);
  H.run('paste', (Q) => M.pasteItems(Q, pg.id, clip, 6, 0));
  const tags = H.P.pages[0].items.filter((i) => i.k === 'sym').map((i) => i.tag).sort();
  assert.deepEqual(plain(tags), ['K1', 'K1', 'K2', 'K2']);
  H.back();
  assert.equal(H.P.pages[0].items.length, 2);
});
test('model: renumbering devices follows page order and keeps locked tags', () => {
  const P = NP(), pg = M.addPage(P, {});
  M.place(P, pg.id, 'coil', 30, 30, { tag: 'K7' }); M.place(P, pg.id, 'coil', 10, 30, { tag: 'K3' });
  const locked = M.place(P, pg.id, 'coil', 50, 30, { tag: 'K9' }); locked.lock = true;
  M.renumberDevices(P);
  const byX = pg.items.filter((i) => i.k === 'sym').sort((a, b) => a.x - b.x).map((i) => i.tag);
  assert.deepEqual(plain(byX), ['K1', 'K2', 'K9']);
});
test('model: save and load round trip', () => {
  const ex = LE.auto.buildProject(LE.examples.find((e) => e.id === 'dol').spec).P;
  const back = M.load(M.serialize(ex));
  assert.equal(back.pages.length, ex.pages.length);
  assert.ok(back.seq >= ex.seq);
  assert.throws(() => M.load('{"hello":1}'));
});

/* ---------- automatic layout of every example ---------- */
/* standard examples are built from the short standard format, the others from page descriptions */
const build = (ex) => (ex.standard ? LE.standard.buildProject(ex.standard) : LE.auto.buildProject(ex.spec));
const pagesOf = (ex) => (ex.standard ? LE.standard.build(ex.standard).spec.pages : ex.spec.pages);
for (const ex of LE.examples) {
  test('layout: ' + ex.name, () => {
    const r = build(ex);
    assert.deepEqual(plain(r.errors), []);
    const P = r.P;
    assert.deepEqual(gridIssues(P), []);
    assert.deepEqual(overlaps(P), []);
    const A = M.analyze(P), checks = LE.checks.run(P, A);
    assert.deepEqual(plain(checks.filter((c) => c.level !== 'info').map((c) => c.msg)), []);
    /* every page renders */
    P.pages.forEach((pg) => { const prims = LE.render.renderPage(P, pg, A); assert.ok(prims.length > 10); assert.ok(LE.render.svg(P, prims).startsWith('<svg')); });
  });
  test('layout nets: ' + ex.name, () => {
    /* rebuild page by page with a trace, then compare the promised connections with the drawn ones */
    const P = NP(), errs = [];
    for (const ps of pagesOf(ex)) {
      const trace = [];
      LE.auto.buildPage(P, ps, errs, { trace });
      const A = M.analyze(P);
      for (const path of ps.paths) {
        if (Array.isArray(path.from) || path.macro) continue;
        const E = expected(path, trace), keys = E.keys;
        for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
          const want = E.f(keys[i]) === E.f(keys[j]), got = actualNet(A, keys[i]) === actualNet(A, keys[j]);
          assert.equal(got, want, (want ? 'OPEN' : 'SHORT') + ' between ' + keys[i] + ' and ' + keys[j] + ' on "' + ps.title + '"');
        }
      }
    }
    assert.deepEqual(plain(errs), []);
  });
}
test('layout: star-delta power circuit connects windings correctly', () => {
  const P = LE.auto.buildProject(EX('yd')).P, A = M.analyze(P);
  const motor = A.syms.find((s) => s.it.s === 'motor6'), net = (n) => motor.pins.find((p) => p.n === n).net;
  const dev = (tag, s) => A.syms.find((x) => x.it.tag === tag && x.it.s === s);
  const k1 = dev('K1', 'main3'), k2 = dev('K2', 'main3'), k3 = dev('K3', 'main3');
  // star contactor shorts W2 U2 V2 when closed: its three bottom pins are one net, its tops go to the windings
  assert.equal(k2.pins[1].net, k2.pins[3].net); assert.equal(k2.pins[3].net, k2.pins[5].net);
  assert.equal(k2.pins[0].net, net('W2')); assert.equal(k2.pins[2].net, net('U2')); assert.equal(k2.pins[4].net, net('V2'));
  // delta contactor: line side from after K1, motor side to W2 U2 V2
  assert.equal(k3.pins[0].net, k1.pins[1].net); assert.equal(k3.pins[1].net, net('W2'));
  assert.notEqual(net('U1'), net('W2'));
});
test('layout: reversing circuit swaps L1 and L3', () => {
  const P = LE.auto.buildProject(EX('rev')).P, A = M.analyze(P);
  const dev = (tag) => A.syms.find((x) => x.it.tag === tag && x.it.s === 'main3');
  const k1 = dev('K1'), k2 = dev('K2');
  assert.equal(k1.pins[0].net, k2.pins[0].net); // both fed from L1 side
  assert.equal(k2.pins[1].net, k1.pins[5].net); // K2 pole 1 output lands on the L3 line after K1
  assert.equal(k2.pins[5].net, k1.pins[1].net);
  assert.equal(k2.pins[3].net, k1.pins[3].net);
});
test('layout: errors are reported in plain Dutch for the AI', () => {
  const P = NP(), errs = [];
  LE.auto.buildPage(P, { title: 'x', top: ['L1'], bottom: ['N'], paths: [{ from: 'L1', to: 'N', chain: [{ s: 'coil', tag: 'K1' }, { s: 'no' }, { s: 'bestaatniet' }] }] }, errs);
  assert.ok(errs.some((e) => /laatste element/.test(e)));
  assert.ok(errs.some((e) => /tag/.test(e)));
  assert.ok(errs.some((e) => /onbekend symbool/.test(e)));
  assert.equal(P.pages.length, 0);
});
test('layout: too many paths spill onto a continuation page', () => {
  const P = NP(), errs = [], paths = [];
  for (let i = 1; i <= 24; i++) paths.push({ from: 'L1', to: 'N', chain: [{ s: 'pb_no', tag: 'S' + i, desc: 'KNOP ' + i }, { s: 'lamp', tag: 'P' + i, desc: 'LAMP ' + i }] });
  const pages = LE.auto.buildPage(P, { title: 'Lampen', top: ['L1'], bottom: ['N'], paths }, errs);
  assert.deepEqual(plain(errs), []);
  assert.ok(pages.length >= 2);
  assert.match(pages[1].title, /vervolg/);
  assert.deepEqual(plain(LE.checks.run(P).filter((c) => c.level === 'error')), []);
});

/* ---------- checks ---------- */
test('checks: short circuit, missing coil and duplicate tag are errors', () => {
  const P = NP(), pg = M.addPage(P, {});
  M.addPot(P, pg.id, 'L1'); M.addPot(P, pg.id, 'N', { side: 'bottom' });
  M.addWire(P, pg.id, [[10, 3], [10, 46]]);
  M.place(P, pg.id, 'no', 20, 20, { tag: 'K5' });
  M.place(P, pg.id, 'coil', 30, 20, { tag: 'K1' }); M.place(P, pg.id, 'coil', 40, 20, { tag: 'K1' });
  const msgs = LE.checks.run(P).filter((c) => c.level === 'error').map((c) => c.msg).join('\n');
  assert.match(msgs, /Kortsluiting/);
  assert.match(msgs, /hoort bij geen spoel/);
  assert.match(msgs, /twee keer/);
});

/* ---------- lists ---------- */
test('lists: BOM, terminals, cables and PLC I/O follow the drawing', () => {
  const P = LE.auto.buildProject(EX('logo')).P, A = M.analyze(P), L = LE.lists;
  const bom = L.bom(P, A);
  assert.ok(bom.some((r) => r.part === '6ED1 052-1MD08-0BA1' && r.qty === 1));
  const io = L.plcio(P, A);
  assert.deepEqual(plain(io.map((r) => r.addr)), ['I1', 'I2', 'I3', 'I4', 'Q1', 'Q2', 'Q3']);
  assert.match(io[0].conn, /-S1:14/);
  const X = L.terminals(P, A).find((s) => s.strip === '-X1');
  assert.deepEqual(plain(X.rows.map((r) => r.no)), ['1', '2', '3', 'PE']);
  assert.match(X.rows[0].outer, /-M1:U1/);
  const P2 = LE.auto.buildProject(EX('dol')).P, cab = L.cables(P2)[0];
  assert.equal(cab.tag, '-W1'); assert.equal(cab.used, 4); assert.equal(cab.total, 4);
  assert.match(L.csv(P2, 'bom'), /^﻿Aantal;Artikelnummer/);
  assert.ok(L.listPages(P2).length >= 5);
  assert.ok(L.listPages(P2)[1].prims().length > 20);
});

/* ---------- cabinet layout ---------- */
test('cabinet: pick list, snapping onto a DIN rail, heat and rail length in the BOM', () => {
  const P = LE.auto.buildProject(EX('dol')).P, cab = M.addPage(P, { title: 'Kast', kind: 'cabinet' });
  cab.scale = 5;
  M.addItem(P, cab.id, { k: 'encl', x: 6, y: 5, w: 24, h: 32 });
  M.addItem(P, cab.id, { k: 'rail', x: 7, y: 10, w: 22 });
  const list = LE.cabinet.pickList(P);
  assert.ok(list.some((x) => x.tag === '-K1') && list.some((x) => x.tag === '-X1'));
  assert.ok(!list.some((x) => x.tag === '-M1'), 'motors are field devices, not in the cabinet');
  P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'sym' && it.tag === 'K1' && it.s === 'coil') it.p.part = 'GEN-CT-9A-10'; }));
  const it = LE.cabinet.place(P, cab.id, '||K1', 12, 10.6);
  const k = LE.cabinet.realPerUnit(P, cab);
  assert.equal(Math.round(it.w * k), 45); assert.equal(Math.round(it.h * k), 85);
  assert.ok(Math.abs(it.y + it.h / 2 - (10 + 35 / k / 2)) < 0.01, 'centred on the rail');
  assert.equal(LE.cabinet.pickList(P).find((x) => x.tag === '-K1').placed, 1);
  assert.equal(LE.cabinet.heat(P, cab).watts, 2);
  assert.ok(LE.lists.bom(P).some((r) => r.part === 'GEN-DIN-35' && r.qty === 0.6));
  LE.cabinet.place(P, cab.id, '||K1', 20, 10.6);
  assert.match(LE.checks.run(P).filter((c) => c.level === 'error').map((c) => c.msg).join(), /twee keer in de kastindeling/);
  assert.ok(LE.render.renderPage(P, cab).length > 20);
});

/* ---------- AI ---------- */
test('ai: a full project answer is applied and checked', () => {
  const reply = { project: LE.examples.find((e) => e.id === 'rev').spec, _uitleg: 'ok' };
  const r = LE.ai.apply(M.newProject(), LE.ai.parse('```json\n' + JSON.stringify(reply) + '\n```'));
  assert.deepEqual(plain(LE.ai.mustFix(r)), []);
  assert.ok(r.P.pages.length >= 3);
});
test('ai: ops change an existing project without touching other pages', () => {
  const P = LE.auto.buildProject(EX('dol')).P;
  const r = LE.ai.apply(P, { ops: [{ op: 'setDevice', tag: 'M1', desc: 'POMP 2' }, { op: 'addPage', spec: { title: 'Extra', top: ['1L1'], bottom: ['1N'], paths: [{ from: '1L1', to: '1N', chain: [{ s: 'no', tag: 'K1' }, { s: 'horn', tag: 'P9', desc: 'ALARM' }] }] } }] });
  assert.deepEqual(plain(LE.ai.mustFix(r)), []);
  assert.equal(r.P.pages.length, P.pages.length + 1);
  assert.equal(P.pages.length, 3, 'original project is not changed');
});
test('ai: a standard answer builds the standard sheet set and is shown back for changes', () => {
  const std = LE.examples.find((e) => e.id === 'std_rev').standard;
  const r = LE.ai.apply(M.newProject(), { standard: std, _uitleg: 'ok' });
  assert.deepEqual(plain(LE.ai.mustFix(r)), []);
  assert.deepEqual(plain(r.P.pages.map((p) => p.title)), ['Voedingsblad', 'Stuurschakeling', 'Ingangen', 'Uitgangen', 'Vermogenblad']);
  assert.match(LE.ai.buildPrompt({ P: r.P, question: 'voeg een lamp toe' }), /STANDAARDPROJECT: \{/);
  const extra = Object.assign({}, std, { extraPages: [{ title: 'Verlichting', top: ['1L1'], bottom: ['1N'], paths: [{ from: '1L1', to: '1N', chain: [{ s: 'sel_no', tag: 'S30', desc: 'LICHT' }, { s: 'lamp', tag: 'P30', desc: 'VERLICHTING' }] }] }] });
  const r3 = LE.ai.apply(M.newProject(), { standard: extra });
  assert.deepEqual(plain(LE.ai.mustFix(r3)), []);
  assert.equal(r3.P.pages[r3.P.pages.length - 1].title, 'Verlichting');
  const bad = JSON.parse(JSON.stringify(std)); bad.outputs = bad.outputs.slice(0, 1);
  const r2 = LE.ai.apply(M.newProject(), { standard: bad });
  assert.ok(LE.ai.mustFix(r2).some((e) => /rol "left" heeft geen PLC-uitgang/.test(e)));
});
/* ---------- edit operations ---------- */
const terms = (P) => P.pages.flatMap((pg) => pg.items.filter((i) => i.k === 'sym' && LE.symbols.get(i.s).role === 'terminal').map((i) => i.tag + ':' + i.no));
test('ops: all terminals onto one strip, numbered on; kept when the standard project is rebuilt', () => {
  const std = LE.examples.find((e) => e.id === 'std_rev').standard;
  const P0 = LE.ai.apply(M.newProject(), { standard: std }).P;
  const r = LE.ai.apply(P0, { ops: [{ op: 'mergeStrips', into: 'X1' }] });
  assert.deepEqual(plain(LE.ai.mustFix(r)), []);
  const want = Array.from({ length: 17 }, (_, i) => 'X1:' + (i + 1)).concat(['X1:PE']);
  assert.deepEqual(plain(terms(r.P)), want);
  assert.equal(r.P.standard.edits.length, 1);
  /* a changed standard project without "edits" keeps the earlier edits */
  const std2 = JSON.parse(JSON.stringify(std)); std2.inputs.push({ n: 6, desc: 'RESET', kind: 'NO' });
  const r2 = LE.ai.apply(r.P, { standard: std2 });
  assert.deepEqual(plain(LE.ai.mustFix(r2)), []);
  assert.ok(terms(r2.P).every((t) => /^X1:/.test(t)) && terms(r2.P).includes('X1:19'));
  /* the same result straight from the standard project */
  const r3 = LE.ai.apply(M.newProject(), { standard: Object.assign({}, std, { terminalStrip: 'X1' }) });
  assert.deepEqual(plain(LE.ai.mustFix(r3)), []);
  assert.deepEqual(plain(terms(r3.P)), want);
});
test('ops: hand-level edits stay on the grid; a failed operation changes nothing', () => {
  const P0 = LE.auto.buildProject(EX('dol')).P;
  const before = terms(P0).length;
  const r = LE.ai.apply(P0, { ops: [
    { op: 'set', tag: 'S2', s: 'pb_nc' },
    { op: 'renameDevice', from: 'S2', to: 'S9' },
    { op: 'replaceText', find: 'POMP', replace: 'POMP 1' },
    { op: 'renumberTerminals' }
  ] });
  assert.deepEqual(plain(r.errors), []);
  assert.ok(r.P.pages.some((pg) => pg.items.some((i) => i.tag === 'S9' && i.s === 'pb_nc')));
  assert.ok(r.P.pages.some((pg) => pg.edited), 'a page changed by hand is marked hand-edited');
  assert.equal(terms(r.P).length, before);
  /* insert a contact into an existing straight wire: the wire is cut at its pins */
  const pg = r.P.pages.find((p) => p.items.some((i) => i.tag === 'S9'));
  const w = pg.items.find((i) => i.k === 'wire' && i.pts.length === 2 && i.pts[0][0] === i.pts[1][0] && Math.abs(i.pts[1][1] - i.pts[0][1]) >= 6);
  const x = w.pts[0][0], y = Math.min(w.pts[0][1], w.pts[1][1]) + 2;
  const r2 = LE.ai.apply(r.P, { ops: [{ op: 'place', page: M.pageLabel(pg), s: 'no', at: [x, y], tag: 'K1' }] });
  assert.deepEqual(plain(r2.errors), []);
  assert.deepEqual(gridIssues(r2.P), []);
  assert.deepEqual(overlaps(r2.P), []);
  const A = M.analyze(r2.P), s = A.syms.find((q) => q.it.s === 'no' && q.it.x === x && q.it.y === y);
  assert.notEqual(s.pins[0].net, s.pins[1].net, 'the new contact is in series, not shorted by the old wire');
  const r3 = LE.ai.apply(r.P, { ops: [{ op: 'delete', tag: 'S9' }, { op: 'move', tag: 'NOPE', by: [1, 0] }] });
  assert.ok(r3.errors.some((e) => /bewerking 2 \(move\): niets gevonden/.test(e)));
  assert.ok(!r3.P.pages.some((p) => p.items.some((i) => i.tag === 'S9')), 'operations before the failed one still apply');
  /* the prompt explains the operations and shows the drawing with coordinates */
  assert.match(LE.ai.buildPrompt({ P: r.P, question: 'alle klemmen op X1' }), /"op": "mergeStrips"[\s\S]*TEKENING[\s\S]*BLAD \d+ "/);
});
test('ai: the loop feeds errors back and accepts the corrected answer', async () => {
  const bad = { project: { pages: [{ title: 'S', top: ['L1'], bottom: ['N'], paths: [{ from: 'L1', to: 'N', chain: [{ s: 'coil', tag: 'K1' }, { s: 'pb_no' }] }] }] } };
  const good = { project: { pages: [{ title: 'S', top: ['L1'], bottom: ['N'], paths: [{ from: 'L1', to: 'N', chain: [{ s: 'pb_no', tag: 'S1' }, { s: 'lamp', tag: 'P1' }] }] }] }, _uitleg: 'goed' };
  const prompts = [];
  const res = await LE.ai.run({ P: M.newProject(), question: 'lamp met knop', ask: async (p) => { prompts.push(p); return prompts.length === 1 ? 'Hier is het: ' + JSON.stringify(bad) : JSON.stringify(good); } });
  assert.equal(res.attempts, 2);
  assert.match(prompts[1], /HET PROGRAMMA VOND DEZE FOUTEN/);
  assert.equal(res.uitleg, 'goed');
  assert.match(prompts[0], /plc_di/); // the symbol catalogue is in the prompt
});
