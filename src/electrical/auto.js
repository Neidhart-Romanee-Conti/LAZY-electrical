/* LAZY Electrical automatic diagram layout ("auto diagram").
   A page is described as potentials (rails) plus current paths; this module places every symbol and wire on the grid.
   The AI assistant writes these descriptions, so it never has to think about coordinates.

   Page spec:
   { "title": "Stuurstroom", "top": ["L1"], "bottom": ["N"], "paths": [path, ...] }
   1-pole path:  { "from": "L1", "to": "N", "chain": [element, ...] }   (to may be left out when the chain ends on a PLC input)
     element:  { "s": "pb_no", "tag": "S1", "desc": "START" }  |  { "par": [[element...], [element...]] }
   multi-pole path: { "from": ["L1","L2","L3"], "pe": "PE", "chain": [ {"s":"mpcb3","tag":"Q1"}, {"s":"main3","tag":"K1"},
                      {"s":"term","tag":"X1","no":["1","2","3"],"pe":true}, {"cable":"W1","type":"4G1,5"}, {"s":"motor3","tag":"M1"} ] }
   motor starters: { "macro": "dol" | "rev" | "yd", "from": ["L1","L2","L3"], "pe": "PE", ... } (see macroSpec below) */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.auto = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols, R = LE.render;
  const TAG = 0.55, DESC = 0.42;
  const LOAD_POLES = { motor3: 3, motor1: 2, psu: 2, vfd: 3, trafo1: 2 };

  const symOf = (el) => (el && el.s ? SY.get(el.s) : null);
  /* outputs end a current path: coils, lamps, valves, PLC inputs … (contacts and terminals do not) */
  const OUT = new Set(['coil', 'coil_ton', 'coil_tof', 'valve', 'lamp', 'horn', 'heater', 'res', 'plc']);
  function isOut(el) {
    if (!el) return false;
    if (el.par) return Array.isArray(el.par) && el.par.length > 0 && el.par.every((b) => Array.isArray(b) && b.length && isOut(b[b.length - 1]));
    const d = symOf(el);
    return !!d && (!!d.end || OUT.has(d.id));
  }
  function labelLines(el, d) {
    const w = [R.tw('-' + (el.tag || (d.letter || 'X') + '00'), TAG)];
    [el.desc, el.desc2].forEach((t) => R.wrap(t, 3.6, DESC).forEach((ln) => w.push(R.tw(ln, DESC))));
    if (d.role === 'slave') w.push(R.tw('/10.9', 0.4));
    return Math.max.apply(null, w);
  }
  function needs(el, d) {
    const b = SY.bbox(d.id);
    let L = -b[0] + 0.25 + labelLines(el, d) + 0.3, Rr = b[2] + 0.8;
    if (el.lr) { Rr = b[2] + 0.8 + labelLines(el, d) + 0.3; L = -b[0] + 0.3; }
    if (d.mirror) { L = Math.max(L, 2.6); Rr = Math.max(Rr, 2.6); }
    return { L, R: Rr };
  }
  const mergeNeed = (a, b) => (a ? { L: Math.max(a.L, b.L), R: Math.max(a.R, b.R) } : b);

  /* ---------- 1-pole chains: build a tree, check it, measure it ---------- */
  function tree1(seq, errs, where) {
    if (!Array.isArray(seq) || !seq.length) { errs.push(where + ': lege reeks (chain)'); return null; }
    const items = [];
    seq.forEach((el, i) => {
      const at = where + ', element ' + (i + 1);
      if (el && el.par) {
        if (!Array.isArray(el.par) || el.par.length < 2) errs.push(at + ': "par" heeft minstens 2 takken nodig');
        const brs = (Array.isArray(el.par) ? el.par : []).map((b, k) => tree1(b, errs, at + ' tak ' + (k + 1))).filter(Boolean);
        const split = isOut(el);
        if (split && i !== seq.length - 1) errs.push(at + ': een splitsing (alle takken eindigen op een uitgang) moet het laatste element van de reeks zijn');
        items.push({ kind: 'par', el, branches: brs, split, h: Math.max(0, ...brs.map((b) => b.h)) + 1 });
        return;
      }
      const d = symOf(el);
      if (!d) { errs.push(at + ': onbekend symbool "' + (el && el.s) + '"'); return; }
      if ((d.poles || 1) > 1 || LOAD_POLES[d.id] || d.pins.length > 2) { errs.push(at + ': "' + el.s + '" is meerpolig; zet het in een pad met "from": ["L1","L2","L3"]'); return; }
      if (isOut(el) && i !== seq.length - 1) errs.push(at + ': "' + el.s + '" is een uitgang (spoel, lamp, ingang …) en moet het laatste element van de reeks zijn');
      if (d.role === 'slave' && !el.tag) errs.push(at + ': "' + el.s + '" is een contact en heeft een "tag" nodig: de tag van de spoel of het toestel waartoe het hoort');
      items.push({ kind: 'sym', el, d, h: d.h });
    });
    return { kind: 'seq', items, h: items.reduce((a, it) => a + 1 + it.h, 0) };
  }
  /* columns: direct elements of a sequence share its column; parallel branches get the next free columns */
  function assign(node, col, cols) {
    node.col = col; let next = col + 1;
    node.items.forEach((it) => {
      if (it.kind === 'sym') cols[col] = mergeNeed(cols[col], needs(it.el, it.d));
      else { let c = col; it.branches.forEach((b, k) => { const n = assign(b, k === 0 ? col : c, cols); c = Math.max(n, (k === 0 ? col : c) + 1); }); next = Math.max(next, c); }
    });
    cols[col] = cols[col] || { L: 1.5, R: 1 };
    return next;
  }

  /* ---------- macros for motor starters ---------- */
  function macroChain(p) {
    const br = p.breaker === false ? null : Object.assign({ s: 'mpcb3' }, p.breaker || {});
    const out = [];
    if (br) out.push(br);
    return out;
  }
  function expandDol(p) {
    const chain = macroChain(p);
    chain.push(elem(p.contactor || p.k1, { s: 'main3', tag: 'K1' }));
    const needOl = p.ol !== false && (p.ol || (chain[0] && chain[0].s !== 'mpcb3'));
    if (needOl) chain.push(Object.assign({ s: 'ol3' }, p.ol || {}));
    if (p.term) chain.push(Object.assign({ s: 'term', no: ['1', '2', '3'], pe: true }, p.term));
    if (p.cable) chain.push(Object.assign({}, p.cable, { cable: p.cable.tag || p.cable.cable || '' }));
    chain.push(Object.assign({ s: 'motor3' }, p.motor || {}));
    return { from: p.from, pe: p.pe, chain };
  }

  /* ---------- page builder ---------- */
  function railY(T, top, bottom) {
    const y = {};
    top.forEach((n, i) => { y[n] = T.y0 + 1 + i; });
    const base = Math.floor(T.y1) - 5 - (bottom.length - 1);
    bottom.forEach((n, i) => { y[n] = base + i; });
    return y;
  }
  function pathWidth(path, errs, where, T) {
    /* returns {cols:[{L,R}], tree?} for one path */
    if (path.macro) {
      const m = String(path.macro).toLowerCase();
      if (m === 'dol') return pathWidth(Object.assign({}, expandDol(path), { _from: path }), errs, where, T);
      if (m !== 'rev' && m !== 'yd') { errs.push(where + ': onbekende macro "' + path.macro + '" (gebruik dol, rev of yd)'); return null; }
      if (!Array.isArray(path.from) || path.from.length !== 3) errs.push(where + ': macro ' + m + ' heeft "from": ["L1","L2","L3"] nodig');
      return { cols: [{ L: 4.2, R: (m === 'rev' ? 8 : 13) + 3.5 }], macro: m };
    }
    if (Array.isArray(path.from)) {
      const n = path.from.length; let L = 1.5;
      if (!Array.isArray(path.chain) || !path.chain.length) { errs.push(where + ': lege reeks (chain)'); return null; }
      let pe = false;
      path.chain.forEach((el, i) => {
        const at = where + ', element ' + (i + 1);
        if (el.cable != null) { L = Math.max(L, 0.8 + R.tw('-' + (el.cable || 'W1'), TAG) + 0.3, 0.8 + R.tw(el.type || '', DESC) + 0.3); return; }
        const d = symOf(el);
        if (!d) { errs.push(at + ': onbekend symbool "' + el.s + '"'); return; }
        if (d.role === 'terminal') { if (el.pe) pe = true; return; }
        const want = LOAD_POLES[d.id] || d.poles || 1;
        if (want !== n) errs.push(at + ': "' + el.s + '" heeft ' + want + ' polen maar het pad heeft er ' + n + ' (from)');
        if (d.end && i !== path.chain.length - 1) errs.push(at + ': "' + el.s + '" is een eindtoestel en moet het laatste element zijn');
        if (d.role === 'slave' && !el.tag) errs.push(at + ': "' + el.s + '" heeft een "tag" nodig (de tag van de spoel)');
        if (d.pins.some((p) => p.n === 'PE')) pe = true;
        L = Math.max(L, needs(el, d).L);
      });
      const last = symOf(path.chain[path.chain.length - 1]);
      if (!(last && last.end) && !path.to) errs.push(where + ': het pad eindigt niet op een verbruiker (motor) en heeft geen "to"-potentialen');
      if (pe && !path.pe) errs.push(where + ': er is een PE-aansluiting; geef "pe": "PE" (naam van de PE-potentiaal) op');
      return { cols: [{ L, R: n - 1 + (pe ? 1 : 0) + 1.2 }], multi: n };
    }
    if (typeof path.from !== 'string') { errs.push(where + ': "from" ontbreekt (naam van een potentiaal bovenaan, bv. "L1")'); return null; }
    const tree = tree1(path.chain, errs, where);
    if (!tree) return null;
    const cols = []; assign(tree, 0, cols);
    const last = path.chain[path.chain.length - 1];
    if (!path.to && !(last && (symOf(last) || {}).end) && !(last && last.par)) errs.push(where + ': geef "to" op (naam van een potentiaal onderaan, bv. "N") of eindig op een PLC-ingang');
    return { cols, tree };
  }

  /* place everything for one page. Returns the list of pages made (more than one if the paths did not fit). */
  function buildPage(P, spec, errs, o) {
    o = o || {};
    const T = M.tplOf(P), where0 = 'Blad "' + (spec.title || '') + '"', e0 = errs.length;
    const paths = Array.isArray(spec.paths) ? spec.paths : [];
    const top = Array.isArray(spec.top) ? spec.top.map(String) : [], bottom = Array.isArray(spec.bottom) ? spec.bottom.map(String) : [];
    paths.forEach((p) => {
      const add = (list, n) => { if (n && list.indexOf(n) < 0 && (list === top ? bottom : top).indexOf(n) < 0) list.push(n); };
      if (!spec.top) { (Array.isArray(p.from) ? p.from : [p.from]).forEach((n) => add(top, n)); if (p.pe && !spec.bottom) add(top, p.pe); }
      if (!spec.bottom) (Array.isArray(p.to) ? p.to : p.to ? [p.to] : []).forEach((n) => add(bottom, n));
    });
    const ry = railY(T, top, bottom);
    const xMax = T.x0 + T.cols * T.colW - 0.5;
    /* measure every path, then pack them left to right over as many pages as needed */
    const measured = paths.map((p, i) => ({ p, w: pathWidth(p, errs, where0 + ', pad ' + (i + 1), T), i }));
    const yTopMax = top.length ? Math.max(...top.map((n) => ry[n])) : T.y0;
    const yBotMin = bottom.length ? Math.min(...bottom.map((n) => ry[n])) : Math.floor(T.y1) - 1;
    measured.forEach((m) => {
      const p = m.p, at = where0 + ', pad ' + (m.i + 1);
      const chk = (n) => { if (n && ry[n] == null) errs.push(at + ': potentiaal "' + n + '" staat niet in "top" of "bottom" van dit blad'); };
      (Array.isArray(p.from) ? p.from : [p.from]).forEach(chk); (Array.isArray(p.to) ? p.to : [p.to]).forEach(chk); chk(p.pe);
      if (m.w && m.w.tree) {
        const yS = yTopMax, yE = p.to ? ry[p.to] : yBotMin;
        if (yS + m.w.tree.h + 1 > yE) errs.push(at + ': te veel elementen onder elkaar (' + m.w.tree.h + ' rasters, er is plaats voor ' + (yE - yS - 1) + '). Maak de reeks korter of verdeel ze.');
      }
    });
    if (errs.length > e0 && !o.force) return [];
    const groups = []; let cur = [], x = null;
    measured.forEach((m) => {
      if (!m.w) return;
      const cols = m.w.cols;
      const place = (start) => { const xs = []; let xx = start; cols.forEach((c, i) => { if (i) xx += Math.max(3, Math.ceil(cols[i - 1].R + c.L + 0.2)); xs.push(xx); }); return xs; };
      let start = x == null ? Math.ceil(T.x0 + cols[0].L + 0.3) : x + Math.max(3, Math.ceil(cur[cur.length - 1].lastR + cols[0].L + 0.6));
      let xs = place(start);
      if (xs[xs.length - 1] + cols[cols.length - 1].R > xMax && cur.length) { groups.push(cur); cur = []; start = Math.ceil(T.x0 + cols[0].L + 0.3); xs = place(start); }
      if (xs[xs.length - 1] + cols[cols.length - 1].R > xMax) errs.push(where0 + ', pad ' + (m.i + 1) + ': het pad is te breed voor één blad');
      cur.push({ m, xs, lastR: cols[cols.length - 1].R }); x = xs[xs.length - 1];
    });
    if (cur.length) groups.push(cur);
    if (errs.length > e0 && !o.force) return [];
    if (!groups.length) groups.push([]);
    const pages = [];
    groups.forEach((g, gi) => {
      const title = (spec.title || 'Stroomschema') + (gi ? ' (vervolg ' + gi + ')' : '');
      const pg = o.page && gi === 0 ? o.page : M.addPage(P, { title, fn: spec.fn, loc: spec.loc, after: pages.length ? pages[pages.length - 1].id : o.after });
      if (o.page && gi === 0) { pg.title = title; pg.items = []; if (spec.fn != null) pg.fn = spec.fn; if (spec.loc != null) pg.loc = spec.loc; }
      pg.spec = Object.assign({}, spec, { paths: g.map((e) => e.m.p) });
      delete pg.edited;
      top.concat(bottom).forEach((n) => M.addPot(P, pg.id, n, { y: ry[n], side: top.indexOf(n) >= 0 ? 'top' : 'bottom' }));
      const ctx = { P, pg, T, ry, wires: [], syms: [], cables: [], yTopMax, yBotMin, errs };
      g.forEach((e) => placePath(ctx, e.m.p, e.m.w, e.xs));
      /* wires first, then symbols: placing a symbol on a wire splits the wire at its pins */
      ctx.wires.forEach((w) => { if (w.length >= 2 && (w[0][0] !== w[w.length - 1][0] || w[0][1] !== w[w.length - 1][1] || w.length > 2)) pg.items.push({ id: M.nid(P), k: 'wire', pts: w }); });
      ctx.syms.forEach((s) => {
        const el = s.el, p = {};
        ['desc', 'desc2', 'part', 'maker', 'name', 'addr'].forEach((k) => { if (el[k] != null && el[k] !== '') p[k] = String(el[k]); });
        if (el.s === 'ref' && el.name) p.name = String(el.name);
        const it = { id: M.nid(P), k: 'sym', s: el.s, x: s.x, y: s.y, tag: el.tag != null ? String(el.tag) : '', p };
        if (el.lr || s.lr) it.lr = true;
        if (el.pins) it.pins = el.pins.map(String);
        if (el.fn) it.fn = el.fn; if (el.loc) it.loc = el.loc;
        const d = SY.get(el.s);
        if (d.role === 'terminal') it.no = s.no != null ? String(s.no) : String(el.no != null ? el.no : '');
        pg.items.push(it);
        s.it = it;
        if (o.trace) o.trace.push({ el: s.el, it });
      });
      /* automatic tags/numbers for what the spec left open (in page order, after all fixed tags are known) */
      ctx.syms.forEach((s) => {
        const it = s.it, d = SY.get(it.s);
        if (d.role === 'terminal') { if (!it.tag) it.tag = 'X1'; if (!it.no) it.no = M.nextTerminalNo(P, it.tag); }
        else if ((d.role === 'master' || d.role === 'device') && !it.tag) it.tag = M.nextTag(P, M.letterOf(P, it.s), pg, it.x);
        if ((d.kind === 'DI' || d.kind === 'DO') && !it.p.addr) it.p.addr = nextAddrFor(P, it.tag, d.kind);
      });
      ctx.cables.forEach((c) => pg.items.push({ id: M.nid(P), k: 'cable', a: c.a, b: c.b, tag: c.tag || M.nextTag(P, 'W', pg, c.a[0]), p: { type: c.type || '', len: c.len || '' }, cores: c.cores || [] }));
      M.fixPage(P, pg);
      pages.push(pg);
    });
    return pages;
  }
  function nextAddrFor(P, tag, kind) {
    const pre = kind === 'DI' ? 'I' : 'Q'; let n = 0;
    P.pages.forEach((pg) => pg.items.forEach((it) => { const d = it.k === 'sym' && SY.get(it.s); if (d && d.kind === kind && it.tag === tag) { const m = /^[IQ](\d+)$/.exec((it.p || {}).addr || ''); if (m) n = Math.max(n, +m[1]); } }));
    return pre + (n + 1);
  }

  function placePath(ctx, path, w, xs) {
    if (path.macro) {
      const m = String(path.macro).toLowerCase();
      if (m === 'dol') return placeMulti(ctx, expandDol(path), xs[0]);
      if (m === 'rev') return placeRev(ctx, path, xs[0]);
      return placeYd(ctx, path, xs[0]);
    }
    if (Array.isArray(path.from)) return placeMulti(ctx, path, xs[0]);
    /* the wire starts at the path's own rail; symbols start below the lowest top rail of the page */
    const yS = ctx.ry[path.from], yE = path.to ? ctx.ry[path.to] : null;
    const r = place1(ctx, w.tree, xs, Math.max(yS, ctx.yTopMax), yE, !!path.to);
    ctx.wires.push([[xs[0], yS], [xs[0], path.to ? yE : r.stop]]);
  }
  /* place a sequence; returns {cur: y after the sequence, stop: where its column wire must end} */
  function place1(ctx, node, xs, yStart, yEnd, align) {
    let cur = yStart, stop = yStart;
    const x = xs[node.col];
    node.items.forEach((it, i) => {
      const last = i === node.items.length - 1;
      if (it.kind === 'sym') {
        let top = cur + 1;
        if (last && align && yEnd != null && !it.d.end) top = Math.max(cur + 1, yEnd - 1 - it.h);
        ctx.syms.push({ el: it.el, x, y: top });
        cur = top + it.h; stop = it.d.end ? top : cur;
        return;
      }
      const busTop = cur + 1, bx = it.branches.map((b) => xs[b.col]);
      let busBot = busTop;
      const ends = it.branches.map((b) => {
        const r = place1(ctx, b, xs, busTop, it.split ? yEnd : null, it.split);
        busBot = Math.max(busBot, r.cur);
        return r;
      });
      if (!it.split) busBot += 1;
      it.branches.forEach((b, k) => {
        if (b.col === node.col) return;
        const yb = it.split ? (yEnd != null && !ends[k].endSym ? yEnd : ends[k].stop) : busBot;
        ctx.wires.push([[bx[k], busTop], [bx[k], yb]]);
      });
      ctx.wires.push([[bx[0], busTop], [bx[bx.length - 1], busTop]]);
      if (!it.split) ctx.wires.push([[bx[0], busBot], [bx[bx.length - 1], busBot]]);
      cur = busBot; stop = it.split ? (yEnd != null ? yEnd : ends[0].stop) : busBot;
    });
    return { cur, stop, endSym: node.items.length && node.items[node.items.length - 1].kind === 'sym' && node.items[node.items.length - 1].d.end };
  }

  /* multi-pole power paths: poles 1 grid apart, PE in the column right of the last pole */
  function placeMulti(ctx, path, x, startY) {
    const n = path.from.length, ry = ctx.ry;
    let cur = startY != null ? startY : ctx.yTopMax;
    const loadLimit = (path.to ? Math.min(...path.to.map((r) => ry[r])) : ctx.yBotMin) - 1;
    let stopY = null, peStop = null, hasPE = !!path.pe;
    path.chain.forEach((el) => {
      if (el.cable != null) {
        const span = n - 1 + (hasPE ? 1 : 0);
        const cores = (el.cores || []).length ? el.cores : Array.from({ length: n }, (_, i) => ({ no: String(i + 1) })).concat(hasPE ? [{ no: 'PE', color: 'GNYE' }] : []);
        ctx.cables.push({ a: [x - 0.6, cur + 1.6], b: [x + span + 0.6, cur + 0.4], tag: el.cable || el.tag || '', type: el.type || '', len: el.len || '', cores });
        cur += 2; return;
      }
      const d = symOf(el);
      if (d.role === 'terminal') {
        const nos = Array.isArray(el.no) ? el.no : [];
        for (let i = 0; i < n; i++) ctx.syms.push({ el: Object.assign({}, el, { s: el.s === 'term_pe' ? 'term' : el.s }), x: x + i, y: cur + 1, no: nos[i] != null ? nos[i] : '' });
        if (el.pe && hasPE) ctx.syms.push({ el: Object.assign({}, el, { s: 'term_pe' }), x: x + n, y: cur + 1, no: 'PE' });
        cur += 2; return;
      }
      if (d.end) {
        const top = Math.max(cur + 1, loadLimit - d.h);
        ctx.syms.push({ el, x, y: top });
        stopY = top; if (d.pins.some((p) => p.n === 'PE')) peStop = top;
        cur = top + d.h; return;
      }
      ctx.syms.push({ el, x, y: cur + 1 });
      d.pins.forEach((p) => { if (p.n === 'PE') peStop = Math.max(peStop == null ? -Infinity : peStop, cur + 1 + p.y); });
      cur += 1 + d.h;
    });
    for (let i = 0; i < n; i++) {
      const end = path.to ? ry[path.to[i]] : stopY != null ? stopY : cur;
      ctx.wires.push([[x + i, ry[path.from[i]]], [x + i, end]]);
    }
    if (hasPE && peStop != null && ry[path.pe] != null) ctx.wires.push([[x + n, ry[path.pe]], [x + n, peStop]]);
    return cur;
  }
  function elem(o, def) { return Object.assign({}, def, typeof o === 'string' ? { tag: o } : o || {}); }
  /* reversing starter: K1 forward, K2 reverse (L1 and L3 swapped), drawn to the right with its label on the right */
  function placeRev(ctx, p, x) {
    const ry = ctx.ry;
    let cur = ctx.yTopMax;
    const chain = macroChain(p);
    const k1 = elem(p.fwd || p.k1 || p.contactor, { s: 'main3', tag: 'K1' }), k2 = elem(p.rev || p.k2, { s: 'main3', tag: 'K2', lr: true });
    if (chain[0]) { ctx.syms.push({ el: chain[0], x, y: cur + 1 }); cur += 3; }
    const yK = cur + 5;
    for (let i = 0; i < 3; i++) ctx.wires.push([[x + i, cur + 1 + i], [x + 5 + i, cur + 1 + i], [x + 5 + i, yK]]);
    ctx.syms.push({ el: k1, x, y: yK }); ctx.syms.push({ el: k2, x: x + 5, y: yK, lr: true });
    cur = yK + 2;
    for (let i = 0; i < 3; i++) ctx.wires.push([[x + 5 + i, yK + 2], [x + 5 + i, cur + 1 + i], [x + 2 - i, cur + 1 + i]]);
    cur += 4;
    const rest = [];
    if (p.ol !== false && (p.ol || (chain[0] && chain[0].s !== 'mpcb3'))) rest.push(elem(p.ol, { s: 'ol3' }));
    if (p.term) rest.push(Object.assign({ s: 'term', no: ['1', '2', '3'], pe: true }, p.term));
    if (p.cable) rest.push(Object.assign({}, p.cable, { cable: p.cable.tag || p.cable.cable || '' }));
    rest.push(elem(p.motor, { s: 'motor3' }));
    placeMulti(ctx, { from: p.from, pe: p.pe, chain: rest }, x, cur);
  }
  /* star-delta starter: K1 main, K3 delta (to W2 U2 V2), K2 star (shorts W2 U2 V2) */
  function placeYd(ctx, p, x) {
    const ry = ctx.ry;
    let cur = ctx.yTopMax;
    const chain = macroChain(p);
    const k1 = elem(p.main || p.k1 || p.contactor, { s: 'main3', tag: 'K1' }), k2 = elem(p.star || p.k2, { s: 'main3', tag: 'K2', lr: true }), k3 = elem(p.delta || p.k3, { s: 'main3', tag: 'K3', lr: true });
    if (chain[0]) { ctx.syms.push({ el: chain[0], x, y: cur + 1 }); cur += 3; }
    ctx.syms.push({ el: k1, x, y: cur + 1 }); cur += 3;
    const yK3 = cur + 5;
    for (let i = 0; i < 3; i++) ctx.wires.push([[x + i, cur + 1 + i], [x + 4 + i, cur + 1 + i], [x + 4 + i, yK3]]);
    ctx.syms.push({ el: k3, x: x + 4, y: yK3, lr: true });
    if (p.ol !== false && (p.ol || (chain[0] && chain[0].s !== 'mpcb3'))) ctx.syms.push({ el: elem(p.ol, { s: 'ol3' }), x, y: yK3 });
    cur = yK3 + 2;
    const yK2 = cur + 5;
    for (let i = 0; i < 3; i++) ctx.wires.push([[x + 4 + i, cur + 1 + i], [x + 10 + i, cur + 1 + i], [x + 10 + i, yK2]]);
    ctx.syms.push({ el: k2, x: x + 10, y: yK2, lr: true });
    ctx.wires.push([[x + 10, yK2 + 2], [x + 12, yK2 + 2]]);
    cur += 4;
    const motor = elem(p.motor, { s: 'motor6' });
    const loadLimit = ctx.yBotMin - 1;
    let yT = null, yC = null;
    if (p.term) { yT = cur + 1; cur += 2; }
    if (p.cable) { yC = cur; cur += 2; }
    const top = Math.max(cur + 1, loadLimit - SY.get('motor6').h);
    if (p.term) {
      const nos = (p.term.no && p.term.no.length >= 6) ? p.term.no : ['1', '2', '3', '4', '5', '6'];
      [0, 1, 2, 4, 5, 6].forEach((dx, i) => ctx.syms.push({ el: { s: 'term', tag: p.term.tag || 'X1' }, x: x + dx, y: yT, no: nos[i] }));
      ctx.syms.push({ el: { s: 'term_pe', tag: p.term.tag || 'X1' }, x: x + 3, y: yT, no: 'PE' });
    }
    if (p.cable) ctx.cables.push({ a: [x - 0.6, yC + 1.6], b: [x + 6.6, yC + 0.4], tag: p.cable.tag || p.cable.cable || '', type: p.cable.type || '', cores: [1, 2, 3].map((i) => ({ no: String(i) })).concat([{ no: 'PE', color: 'GNYE' }], [4, 5, 6].map((i) => ({ no: String(i) }))) });
    ctx.syms.push({ el: motor, x, y: top });
    for (let i = 0; i < 3; i++) {
      ctx.wires.push([[x + i, ry[p.from[i]]], [x + i, top]]);
      ctx.wires.push([[x + 4 + i, yK3 + 2], [x + 4 + i, top]]);
    }
    if (p.pe && ry[p.pe] != null) ctx.wires.push([[x + 3, ry[p.pe]], [x + 3, top]]);
  }

  /* ---------- whole project ---------- */
  function buildProject(spec, o) {
    o = o || {};
    const errs = [];
    if (!spec || typeof spec !== 'object') return { P: null, errors: ['geen project-object'] };
    const P = M.newProject({ info: spec.info, settings: spec.settings });
    if (spec.cover !== false) M.addPage(P, { title: 'Voorblad', kind: 'cover' });
    (Array.isArray(spec.pages) ? spec.pages : []).forEach((ps) => {
      if (ps && ps.kind === 'cover') return;
      buildPage(P, withDevices(ps || {}, spec.devices), errs, { force: o.force });
    });
    if (!Array.isArray(spec.pages) || !spec.pages.length) errs.push('het project heeft geen bladen ("pages")');
    applyDevices(P, spec.devices);
    return { P, errors: errs };
  }
  /* device data given once per tag is copied into the page description before layout, so labels get room */
  function withDevices(ps, devs) {
    if (!devs || typeof devs !== 'object') return ps;
    const fill = (el) => {
      if (!el || typeof el !== 'object') return el;
      if (Array.isArray(el.par)) return Object.assign({}, el, { par: el.par.map((b) => (Array.isArray(b) ? b.map(fill) : b)) });
      const d = el.s && SY.get(el.s), dv = el.tag != null && devs[el.tag];
      if (!d || !dv || (d.role !== 'master' && d.role !== 'device')) return el;
      const out = Object.assign({}, el);
      ['desc', 'desc2', 'part', 'maker'].forEach((k) => { if (out[k] == null && dv[k] != null) out[k] = dv[k]; });
      return out;
    };
    return Object.assign({}, ps, { paths: (ps.paths || []).map((p) => (Array.isArray(p.chain) ? Object.assign({}, p, { chain: p.chain.map(fill) }) : p)) });
  }
  /* device data given once per tag (description, part number) goes onto the master symbol */
  function applyDevices(P, devs) {
    if (!devs || typeof devs !== 'object') return;
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if (it.k !== 'sym') return;
      const dv = devs[it.tag]; if (!dv) return;
      const d = SY.get(it.s);
      if (d.role === 'master' || d.role === 'device') {
        it.p = it.p || {};
        ['desc', 'desc2', 'part', 'maker'].forEach((k) => { if (dv[k] != null && it.p[k] == null) it.p[k] = String(dv[k]); });
      }
    }));
  }
  /* the spec of every generated page, for the AI to read and change */
  function projectSpec(P) {
    return {
      info: P.info, settings: { template: P.settings.template, tagMode: P.settings.tagMode, letters: P.settings.letters },
      pages: P.pages.filter((pg) => pg.kind !== 'cover').map((pg) => pg.spec && !pg.edited ? Object.assign({ page: M.pageLabel(pg) }, pg.spec) : { page: M.pageLabel(pg), title: pg.title, handEdited: true, summary: summarize(P, pg) })
    };
  }
  function summarize(P, pg) {
    const s = [];
    pg.items.forEach((it) => {
      if (it.k === 'sym') s.push(it.s + ' ' + (it.tag || '') + (it.no ? ':' + it.no : '') + ((it.p || {}).desc ? ' "' + it.p.desc + '"' : ''));
      else if (it.k === 'pot') s.push('potentiaal ' + it.name);
      else if (it.k === 'cable') s.push('kabel ' + it.tag + ' ' + ((it.p || {}).type || ''));
    });
    return s.join('; ');
  }

  return { buildPage, buildProject, applyDevices, projectSpec, isOut, expandDol, LOAD_POLES };
})();
if (typeof module !== 'undefined') module.exports = LE;
