/* LAZY Electrical edit operations: small, exact changes to an existing drawing, written as JSON.
   The AI uses them for everything a whole new page description cannot express (merge terminal strips, renumber,
   change one contact, move a symbol, add a wire …). They address things the way a person would: by device tag,
   by terminal ("X1:3"), or by a grid point on a page. Never by internal ids, so a list of operations can be stored
   and replayed after a standard project is rebuilt (see standard.js, "edits").

   apply(P, ops, errors, label) mutates P and returns the operations that worked.
   describe(P) is the drawing as text (symbols, pins, wires, rails with their grid coordinates) for the AI. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.ops = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols;
  const PROPS = ['desc', 'desc2', 'part', 'maker', 'addr', 'name'];
  const isPt = (p) => Array.isArray(p) && p.length === 2 && Number.isInteger(p[0]) && Number.isInteger(p[1]);
  const isTerm = (it) => it.k === 'sym' && (SY.get(it.s) || {}).role === 'terminal';

  /* ---------- choosing what an operation works on ---------- */
  function pageOf(P, label, fail) {
    const pg = M.pageByLabel(P, String(label));
    if (!pg) fail('blad "' + label + '" bestaat niet (bladen: ' + P.pages.map(M.pageLabel).join(', ') + ')');
    return pg;
  }
  /* symbols chosen by "tag", "term" ("X1:3") or "page" + "at" ([x, y] = a pin or the insertion point);
     "only" keeps one symbol type, "page" limits the search to one sheet */
  function pick(P, op, fail) {
    const pg = op.page != null ? pageOf(P, op.page, fail) : null;
    if (op.page != null && !pg) return [];
    if (op.tag == null && op.term == null && op.at == null) { fail('kies symbolen met "tag", "term" of "page" + "at"'); return []; }
    if (op.at != null && !isPt(op.at)) { fail('"at" moet [x, y] met gehele getallen zijn'); return []; }
    if (op.at != null && !pg) { fail('"at" heeft ook "page" nodig'); return []; }
    let strip = null, no = null;
    if (op.term != null) { const m = /^(.+):([^:]+)$/.exec(String(op.term)); if (!m) { fail('"term" moet "strook:nummer" zijn, bv. "X1:3"'); return []; } strip = m[1]; no = m[2]; }
    const out = [];
    (pg ? [pg] : P.pages).forEach((p) => p.items.forEach((it) => {
      if (it.k !== 'sym') return;
      if (op.tag != null && it.tag !== String(op.tag)) return;
      if (strip != null && !(isTerm(it) && it.tag === strip && String(it.no) === no)) return;
      if (op.only != null && it.s !== op.only) return;
      if (op.at != null && !(it.x === op.at[0] && it.y === op.at[1]) && !M.symPins(it).some((q) => q.x === op.at[0] && q.y === op.at[1])) return;
      out.push({ pg: p, it });
    }));
    if (!out.length) fail('niets gevonden voor ' + JSON.stringify(Object.assign({}, op.page != null ? { page: op.page } : {}, op.tag != null ? { tag: op.tag } : {}, op.term != null ? { term: op.term } : {}, op.at ? { at: op.at } : {}, op.only ? { only: op.only } : {})));
    return out;
  }
  const byPage = (list) => { const m = new Map(); list.forEach((x) => { if (!m.has(x.pg)) m.set(x.pg, []); m.get(x.pg).push(x.it.id); }); return m; };
  function wireAt(pg, p) {
    return pg.items.filter((w) => w.k === 'wire' && w.pts.some((q, i) => (q[0] === p[0] && q[1] === p[1]) || (i && M.onSeg(p, w.pts[i - 1], q))));
  }
  /* page-based tags (2K3) follow the page: renumber after a page change, like a newly generated project */
  function retag(P) { if ((P.settings || {}).tagMode !== 'consecutive') LE.auto.retag(P); }
  function stripsIn(P) { return Object.keys(M.stripsOf(P)); }

  /* ---------- the operations ---------- */
  const OPS = {
    /* devices and texts */
    set(P, op, fail) {
      const list = pick(P, op, fail); if (!list.length) return false;
      if (op.s != null && !SY.get(op.s)) return fail('onbekend symbool "' + op.s + '"');
      list.forEach(({ pg, it }) => {
        if (op.s != null) { it.s = String(op.s); delete it.pins; }
        it.p = it.p || {};
        PROPS.forEach((k) => { if (op[k] === null) delete it.p[k]; else if (op[k] != null) it.p[k] = String(op[k]); });
        if (op.no != null && isTerm(it)) it.no = String(op.no);
        if (op.strip != null && isTerm(it)) it.tag = String(op.strip);
        if (op.pins === null) delete it.pins; else if (Array.isArray(op.pins)) it.pins = op.pins.map(String);
        if (op.lock != null) { if (op.lock) it.lock = true; else delete it.lock; }
        if (op.fn != null) { if (op.fn) it.fn = String(op.fn); else delete it.fn; }
        if (op.loc != null) { if (op.loc) it.loc = String(op.loc); else delete it.loc; }
        M.fixPage(P, pg);
      });
      return true;
    },
    setDevice(P, op, fail) { // kept for older answers: description and part data of a device's master symbol
      let n = 0;
      P.pages.forEach((pg) => pg.items.forEach((it) => {
        if (it.k !== 'sym' || it.tag !== String(op.tag)) return;
        const d = SY.get(it.s); if (d.role !== 'master' && d.role !== 'device') return;
        it.p = it.p || {}; ['desc', 'desc2', 'part', 'maker'].forEach((k) => { if (op[k] != null) it.p[k] = String(op[k]); }); n++;
      }));
      return n ? true : fail('toestel ' + op.tag + ' niet gevonden');
    },
    renameDevice(P, op, fail) {
      if (!op.to) return fail('"to" ontbreekt');
      return M.renameDevice(P, String(op.from), String(op.to)) ? true : fail('toestel ' + op.from + ' niet gevonden');
    },
    renumberDevices(P) { LE.auto.retag(P, true); return true; },
    delete(P, op, fail) {
      const list = pick(P, op, fail); if (!list.length) return false;
      byPage(list).forEach((ids, pg) => M.deleteItems(P, pg.id, ids, { heal: op.heal !== false }));
      return true;
    },
    replaceText(P, op, fail) {
      if (!op.find) return fail('"find" ontbreekt');
      const f = String(op.find), r = String(op.replace == null ? '' : op.replace), sw = (v) => String(v).split(f).join(r);
      let n = 0;
      P.pages.forEach((pg) => {
        if (pg.title && pg.title.indexOf(f) >= 0) { pg.title = sw(pg.title); n++; }
        pg.items.forEach((it) => {
          if (it.k === 'text' && it.s && it.s.indexOf(f) >= 0) { it.s = sw(it.s); n++; }
          ['desc', 'desc2'].forEach((k) => { if (it.p && it.p[k] && it.p[k].indexOf(f) >= 0) { it.p[k] = sw(it.p[k]); n++; } });
        });
      });
      return n ? true : fail('tekst "' + f + '" niet gevonden');
    },

    /* terminals */
    mergeStrips(P, op, fail) {
      const into = String(op.into || 'X1'), all = stripsIn(P);
      const from = (Array.isArray(op.from) ? op.from : op.from != null ? [op.from] : all).map(String).filter((s) => s !== into);
      const miss = from.filter((s) => all.indexOf(s) < 0);
      if (miss.length) return fail('klemmenstrook ' + miss.join(', ') + ' bestaat niet (stroken: ' + all.join(', ') + ')');
      P.pages.forEach((pg) => pg.items.forEach((it) => { if (isTerm(it) && from.indexOf(it.tag) >= 0) it.tag = into; }));
      if (op.renumber !== false) M.renumberTerminals(P, into);
      return true;
    },
    renumberTerminals(P, op, fail) {
      const all = stripsIn(P), list = op.strip != null ? [String(op.strip)] : all;
      if (op.strip != null && all.indexOf(String(op.strip)) < 0) return fail('klemmenstrook ' + op.strip + ' bestaat niet (stroken: ' + all.join(', ') + ')');
      list.forEach((s) => M.renumberTerminals(P, s));
      return true;
    },

    /* pages */
    setPage(P, op, fail, errors, where) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      const e0 = errors.length, saved = M.clone(pg.items);
      LE.auto.buildPage(P, op.spec || {}, errors, { page: pg });
      if (errors.length > e0) { pg.items = saved; for (let i = e0; i < errors.length; i++) errors[i] = where + ': ' + errors[i]; return false; }
      retag(P); return true;
    },
    addPage(P, op, fail, errors, where) {
      const after = op.after != null ? pageOf(P, op.after, fail) : null;
      if (op.after != null && !after) return false;
      const e0 = errors.length;
      LE.auto.buildPage(P, op.spec || {}, errors, { after: after ? after.id : (P.pages.length ? P.pages[P.pages.length - 1].id : undefined) });
      if (errors.length > e0) { for (let i = e0; i < errors.length; i++) errors[i] = where + ': ' + errors[i]; return false; }
      retag(P); return true;
    },
    deletePage(P, op, fail) { const pg = pageOf(P, op.page, fail); if (!pg) return false; M.deletePage(P, pg.id); retag(P); return true; },
    pageProps(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      ['title', 'fn', 'loc', 'folder'].forEach((k) => { if (op[k] != null) pg[k] = String(op[k]); });
      return true;
    },
    movePage(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      const first = op.after === 0 || op.after === '0' || op.after === 'begin';
      const ref = first ? null : pageOf(P, op.after, fail); if (!first && !ref) return false;
      P.pages.splice(P.pages.indexOf(pg), 1);
      P.pages.splice(first ? 0 : P.pages.indexOf(ref) + 1, 0, pg);
      M.renumberPages(P); retag(P); return true;
    },
    renumberPages(P) { M.renumberPages(P); retag(P); return true; },
    setInfo(P, op) { Object.assign(P.info, op.info || {}); return true; },
    setSettings(P, op) { Object.assign(P.settings, op.settings || {}); return true; },

    /* drawing by hand, in grid units */
    place(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      const d = SY.get(op.s);
      if (!d) return fail('onbekend symbool "' + op.s + '"');
      if (!isPt(op.at)) return fail('"at" moet [x, y] met gehele getallen zijn');
      if (d.role === 'slave' && !op.tag) return fail('"' + op.s + '" is een contact en heeft een "tag" nodig (de tag van de spoel of het toestel)');
      const r = ((+op.r || 0) % 360 + 360) % 360;
      if (r % 90) return fail('"r" moet 0, 90, 180 of 270 zijn');
      const p = {}; PROPS.forEach((k) => { if (op[k] != null && op[k] !== '') p[k] = String(op[k]); });
      M.place(P, pg.id, d.id, op.at[0], op.at[1], { r, m: !!op.mirror, tag: op.tag != null ? String(op.tag) : undefined, no: op.no, addr: op.addr, name: op.name, p });
      return true;
    },
    wire(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!Array.isArray(op.pts) || op.pts.length < 2 || !op.pts.every(isPt)) return fail('"pts" moet minstens twee punten [x, y] met gehele getallen hebben');
      if (!M.addWire(P, pg.id, op.pts, op.no ? { no: String(op.no) } : null)) return fail('de draad heeft geen lengte');
      return true;
    },
    deleteWire(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!isPt(op.at)) return fail('"at" moet [x, y] met gehele getallen zijn');
      const ws = wireAt(pg, op.at); if (!ws.length) return fail('geen draad door [' + op.at + '] op blad ' + op.page);
      M.deleteItems(P, pg.id, ws.map((w) => w.id)); return true;
    },
    wireNo(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!isPt(op.at)) return fail('"at" moet [x, y] met gehele getallen zijn');
      const ws = wireAt(pg, op.at); if (!ws.length) return fail('geen draad door [' + op.at + '] op blad ' + op.page);
      /* a wire number belongs to the whole net */
      const A = M.analyze(P), net = A.wireNet[ws[0].id];
      A.nets[net].wires.forEach(({ w }) => { if (op.no) w.no = String(op.no); else delete w.no; });
      return true;
    },
    move(P, op, fail) {
      if (!isPt(op.by)) return fail('"by" moet [dx, dy] met gehele getallen zijn');
      const list = pick(P, op, fail); if (!list.length) return false;
      byPage(list).forEach((ids, pg) => M.moveItems(P, pg.id, ids, op.by[0], op.by[1]));
      return true;
    },
    rotate(P, op, fail) { const list = pick(P, op, fail); byPage(list).forEach((ids, pg) => M.rotateItems(P, pg.id, ids)); return list.length > 0; },
    mirror(P, op, fail) { const list = pick(P, op, fail); byPage(list).forEach((ids, pg) => M.mirrorItems(P, pg.id, ids)); return list.length > 0; },
    pot(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!op.name) return fail('"name" ontbreekt');
      M.addPot(P, pg.id, String(op.name), { y: op.y, side: op.side, x1: op.x1, x2: op.x2 }); return true;
    },
    deletePot(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      const n = pg.items.length; pg.items = pg.items.filter((it) => !(it.k === 'pot' && it.name === String(op.name)));
      return n !== pg.items.length ? true : fail('potentiaal ' + op.name + ' staat niet op blad ' + op.page);
    },
    text(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!Array.isArray(op.at) || op.at.length !== 2) return fail('"at" moet [x, y] zijn');
      M.addItem(P, pg.id, { k: 'text', x: +op.at[0], y: +op.at[1], s: String(op.text || ''), size: +op.size || 0.6 }); return true;
    },
    cable(P, op, fail) {
      const pg = pageOf(P, op.page, fail); if (!pg) return false;
      if (!Array.isArray(op.from) || !Array.isArray(op.to)) return fail('"from" en "to" moeten [x, y] zijn');
      M.addCable(P, pg.id, op.from, op.to, { tag: op.tag, p: { type: op.type || '', len: op.len || '' } }); return true;
    }
  };
  /* operations that draw by hand: on a generated page they make it hand-edited (like editing it in the app) */
  const HAND = new Set(['place', 'wire', 'deleteWire', 'move', 'rotate', 'mirror', 'delete', 'set', 'pot', 'deletePot', 'text', 'cable']);

  function apply(P, ops, errors, label) {
    const done = [];
    (Array.isArray(ops) ? ops : []).forEach((op, i) => {
      const where = (label || 'bewerking ') + (i + 1) + (op && op.op ? ' (' + op.op + ')' : '');
      if (!op || typeof op !== 'object') { errors.push(where + ': geen object'); return; }
      const fn = OPS[op.op];
      if (!fn) { errors.push(where + ': onbekende bewerking "' + op.op + '" (' + Object.keys(OPS).join(', ') + ')'); return; }
      const e0 = errors.length, fail = (msg) => { errors.push(where + ': ' + msg); return false; };
      const snap = JSON.stringify(P.pages), before = HAND.has(op.op) ? new Map(P.pages.map((pg) => [pg.id, JSON.stringify(pg.items)])) : null;
      let ok;
      try { ok = fn(P, op, fail, errors, where); } catch (e) { ok = fail(e.message); }
      if (ok === false || errors.length > e0) { P.pages = JSON.parse(snap); return; } // a failed operation changes nothing
      if (before && !P.standard && !P.school) P.pages.forEach((pg) => { if (pg.spec && before.get(pg.id) !== JSON.stringify(pg.items)) pg.edited = true; });
      done.push(op);
    });
    return done;
  }

  /* ---------- the drawing as text, for the AI ---------- */
  function describe(P, o) {
    o = o || {};
    const max = o.max || 60000, A = M.analyze(P), T = M.tplOf(P), out = [];
    out.push('Raster: x naar rechts, y naar beneden. Kolommen 0-' + (T.cols - 1) + ': kolom c loopt van x=' + T.x0 + '+' + T.colW + '·c; tekengebied x ' + T.x0 + '..' + (T.x0 + T.cols * T.colW) + ', y ' + T.y0 + '..' + Math.floor(T.y1) + '.');
    const strips = M.stripsOf(P), sk = Object.keys(strips);
    if (sk.length) out.push('Klemmenstroken: ' + sk.map((s) => s + ' (' + strips[s].map((it) => it.no || '?').join(', ') + ')').join('; '));
    const pin = (s) => s.pins.map((p) => (s.d.kind === 'DO' && p.i === 1 && (s.it.p || {}).addr ? s.it.p.addr : p.n || p.i + 1) + '(' + p.x + ',' + p.y + ')').join(' ');
    const pages = P.pages.filter((pg) => pg.kind !== 'cover');
    const full = pages.map((pg) => {
      const L = ['BLAD ' + M.pageLabel(pg) + ' "' + (pg.title || '') + '"' + (pg.fn ? ' =' + pg.fn : '') + (pg.loc ? ' +' + pg.loc : '')];
      const pots = pg.items.filter((it) => it.k === 'pot');
      if (pots.length) L.push(' potentialen: ' + pots.map((r) => r.name + ' y=' + r.y + ' x' + r.x1 + '..' + r.x2).join(' | '));
      pg.items.forEach((it) => {
        if (it.k === 'sym') {
          const s = A.symById[it.id]; if (!s) return;
          const p = it.p || {}, nm = isTerm(it) ? it.tag + ':' + (it.no || '?') : s.d.role === 'ref' ? '→' + (p.name || '') : it.tag ? '-' + it.tag : '';
          L.push(' ' + it.s + ' ' + nm + (p.desc ? ' "' + p.desc + (p.desc2 ? ' / ' + p.desc2 : '') + '"' : '') + (p.addr ? ' ' + p.addr : '') + ' @' + it.x + ',' + it.y + (it.r ? ' r' + it.r : '') + (it.m ? ' gespiegeld' : '') + ' | ' + pin(s));
        } else if (it.k === 'cable') L.push(' kabel ' + it.tag + ' ' + ((it.p || {}).type || '') + ' (' + it.a + ')-(' + it.b + ')');
        else if (it.k === 'text') L.push(' tekst "' + it.s + '" @' + it.x + ',' + it.y);
      });
      const ws = pg.items.filter((it) => it.k === 'wire');
      if (ws.length) L.push(' draden: ' + ws.map((w) => w.pts.map((q) => q[0] + ',' + q[1]).join('→') + (w.no ? ' nr ' + w.no : '')).join(' | '));
      return L.join('\n');
    });
    let txt = out.concat(full).join('\n');
    if (txt.length > max) txt = out.concat(full.map((b) => b.split('\n').filter((l) => l.indexOf(' draden:') !== 0).join('\n'))).join('\n') + '\n(draden weggelaten: tekening te groot)';
    return txt.length > max ? txt.slice(0, max) + '\n(ingekort)' : txt;
  }

  return { apply, describe, OPS: Object.keys(OPS) };
})();
if (typeof module !== 'undefined') module.exports = LE;
