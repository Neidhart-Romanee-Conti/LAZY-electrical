/* LAZY Electrical project model: components with pins, wires that connect pins, nets, device tags and cross-references.
   Everything here is pure data + functions (no DOM), so it runs in the browser and in Node tests.
   Geometry is stored in grid units: symbol pins and wire points are whole numbers, so the drawing is always on the grid. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.model = (function () {
  'use strict';
  const SY = LE.symbols;

  /* ---------- page templates (sheet size, grid and frame layout, in grid units) ---------- */
  const TEMPLATES = {
    A3: { id: 'A3', name: 'A3 liggend, raster 5 mm', g: 5, W: 84, H: 59.4, ox0: 1, oy0: 1, ox1: 83, oy1: 58.4, x0: 2, y0: 2, cols: 10, colW: 8, y1: 51, rows: 6 },
    A4: { id: 'A4', name: 'A4 liggend, raster 3 mm', g: 3, W: 99, H: 70, ox0: 3, oy0: 2, ox1: 95, oy1: 68, x0: 4, y0: 3, cols: 10, colW: 9, y1: 59, rows: 6 }
  };
  const tplOf = (P) => TEMPLATES[(P.settings || {}).template] || TEMPLATES.A3;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const today = () => { const d = new Date(); return d.getDate() + '-' + (d.getMonth() + 1) + '-' + d.getFullYear(); };

  function newProject(o) {
    o = o || {};
    return {
      format: 'lazy-electrical', version: 2, seq: 0,
      info: Object.assign({ name: 'Nieuw project', desc1: '', desc2: '', customer: '', drawingNo: '', author: '', company: '', created: today(), revision: 'A', revDate: '', revText: '' }, o.info || {}),
      /* defaults: A4, tags from sheet + letter + column (2K3) */
      settings: Object.assign({ template: 'A4', tagMode: 'pagecol', letters: '81346', wireNo: 'seq', showPinNo: true }, o.settings || {}),
      pages: [], parts: [], extras: [], revisions: []
    };
  }
  const nid = (P) => 'i' + (++P.seq).toString(36);

  /* ---------- pages ---------- */
  const pageLabel = (pg) => String(pg.no) + (pg.index || '');
  function findPage(P, id) { return P.pages.find((p) => p.id === id) || null; }
  function pageByLabel(P, label) { return P.pages.find((p) => pageLabel(p) === String(label)) || null; }
  function addPage(P, o) {
    o = o || {};
    const pg = { id: 'p' + (++P.seq).toString(36), no: 1, index: '', title: o.title || '', kind: o.kind || 'schematic', fn: o.fn || '', loc: o.loc || '', folder: o.folder || '', items: [] };
    if (o.spec) pg.spec = o.spec;
    const at = o.after ? P.pages.findIndex((p) => p.id === o.after) : -1;
    if (at >= 0 && at < P.pages.length - 1) {
      /* insert between two pages: keep the numbers of the existing pages (page index 1a, 1b … like a page insert) */
      const prev = P.pages[at], next = P.pages[at + 1];
      if (next.no === prev.no + 1 || (next.no === prev.no && next.index > prev.index)) {
        pg.no = prev.no;
        let c = prev.index ? String.fromCharCode(prev.index.charCodeAt(0) + 1) : 'a';
        while (P.pages.some((p) => p.no === pg.no && p.index === c)) c = String.fromCharCode(c.charCodeAt(0) + 1);
        pg.index = c;
      } else pg.no = prev.no + 1;
      P.pages.splice(at + 1, 0, pg);
    } else {
      pg.no = o.no || (P.pages.reduce((m, p) => Math.max(m, p.no), 0) + 1);
      P.pages.push(pg);
    }
    return pg;
  }
  function deletePage(P, id) { P.pages = P.pages.filter((p) => p.id !== id); }
  function movePage(P, id, dir) {
    const i = P.pages.findIndex((p) => p.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= P.pages.length) return false;
    const t = P.pages[i]; P.pages[i] = P.pages[j]; P.pages[j] = t; return true;
  }
  function renumberPages(P) { P.pages.forEach((p, i) => { p.no = i + 1; p.index = ''; }); }

  /* ---------- geometry ---------- */
  const key = (x, y) => x + ',' + y;
  const rnd = (v) => Math.round(v);
  /* symbol transform: optional mirror (flip x), then rotation clockwise in 90° steps (y points down) */
  function tf(it) {
    const r = ((it.r || 0) % 360 + 360) % 360, m = it.m ? -1 : 1;
    return (x, y) => {
      x *= m;
      if (r === 90) return [it.x - y, it.y + x];
      if (r === 180) return [it.x - x, it.y - y];
      if (r === 270) return [it.x + y, it.y - x];
      return [it.x + x, it.y + y];
    };
  }
  function symPins(it) {
    const d = SY.get(it.s); if (!d) return [];
    const T = tf(it);
    return d.pins.map((p, i) => { const q = T(p.x, p.y); return { i, n: (it.pins && it.pins[i] != null) ? it.pins[i] : p.n, x: rnd(q[0]), y: rnd(q[1]) }; });
  }
  function onSeg(p, a, b) { // p strictly inside the axis-parallel segment a-b
    if (a[0] === b[0]) return p[0] === a[0] && p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]);
    if (a[1] === b[1]) return p[1] === a[1] && p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]);
    return false;
  }
  function onSegIncl(p, a, b) { return onSeg(p, a, b) || (p[0] === a[0] && p[1] === a[1]) || (p[0] === b[0] && p[1] === b[1]); }
  /* make a polyline orthogonal and tidy: integer points, no duplicates, no collinear middle points */
  function cleanPts(pts) {
    let q = pts.map((p) => [rnd(p[0]), rnd(p[1])]), out = [];
    q.forEach((p) => {
      const l = out[out.length - 1];
      if (l && l[0] === p[0] && l[1] === p[1]) return;
      if (l && l[0] !== p[0] && l[1] !== p[1]) out.push([p[0], l[1]]);
      out.push(p);
    });
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1], b = out[i], c = out[i + 1];
      if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) {
        /* keep the point if the line doubles back (a U-turn on one line) */
        const back = a[0] === b[0] ? (b[1] - a[1]) * (c[1] - b[1]) < 0 : (b[0] - a[0]) * (c[0] - b[0]) < 0;
        if (!back) { out.splice(i, 1); i--; }
      }
    }
    return out;
  }

  /* after any edit: wires are split at symbol pins, and wire pieces that run straight through a symbol are removed.
     This is what lets you draw a wire first and drop a contact on it (or draw a wire straight through symbols). */
  function fixPage(P, pg) {
    const syms = pg.items.filter((i) => i.k === 'sym');
    const pinAt = {}, pairs = [];
    syms.forEach((it) => {
      const d = SY.get(it.s); if (!d) return;
      const pins = symPins(it);
      pins.forEach((p) => { (pinAt[key(p.x, p.y)] = pinAt[key(p.x, p.y)] || []).push([it.id, p.i]); });
      d.pairs.forEach((pr) => { const a = pins[pr[0]], b = pins[pr[1]]; if (a && b) pairs.push([key(a.x, a.y), key(b.x, b.y), it.id]); });
    });
    const out = [];
    pg.items.forEach((it) => {
      if (it.k !== 'wire') { out.push(it); return; }
      const pts = cleanPts(it.pts);
      if (pts.length < 2) return;
      /* split at pins that sit on a vertex or inside a segment */
      let cur = [pts[0]], pieces = [];
      for (let s = 1; s < pts.length; s++) {
        const a = pts[s - 1], b = pts[s], cuts = [];
        Object.keys(pinAt).forEach((k) => { const c = k.split(',').map(Number); if (onSeg(c, a, b)) cuts.push(c); });
        cuts.sort((u, v) => Math.hypot(u[0] - a[0], u[1] - a[1]) - Math.hypot(v[0] - a[0], v[1] - a[1]));
        cuts.forEach((c) => { cur.push(c); pieces.push(cur); cur = [c]; });
        cur.push(b);
        if (s < pts.length - 1 && pinAt[key(b[0], b[1])]) { pieces.push(cur); cur = [b]; }
      }
      pieces.push(cur);
      pieces.forEach((pc, n) => {
        const q = cleanPts(pc); if (q.length < 2) return;
        const ka = key(q[0][0], q[0][1]), kb = key(q[q.length - 1][0], q[q.length - 1][1]);
        if (q.length === 2 && pairs.some((pr) => (pr[0] === ka && pr[1] === kb) || (pr[0] === kb && pr[1] === ka))) return; // runs through a symbol body
        const w = n === 0 ? it : Object.assign(clone(it), { id: nid(P) });
        w.pts = q; out.push(w);
      });
    });
    pg.items = out;
    return pg;
  }

  /* ---------- tags ---------- */
  const isAuto = (t) => !t || /\?/.test(t);
  function letterOf(P, s) { return SY.letter(s, (P.settings || {}).letters); }
  function colOf(P, x) { const T = tplOf(P); return Math.max(0, Math.min(T.cols - 1, Math.floor((x - T.x0) / T.colW))); }
  function rowOf(P, y) { const T = tplOf(P); return 'ABCDEFGH'[Math.max(0, Math.min(T.rows - 1, Math.floor((y - T.y0) / ((T.y1 - T.y0) / T.rows))))]; }
  function allTags(P) {
    const s = new Set();
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'sym' && it.tag) s.add(it.tag); if (it.k === 'cable' && it.tag) s.add(it.tag); }));
    return s;
  }
  /* next free tag for a letter; fill = take the lowest free number instead of the highest + 1 (renumbering) */
  function nextTag(P, letter, pg, x, fill) {
    const mode = (P.settings || {}).tagMode, used = allTags(P);
    const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (mode === 'pagecol' && pg) {
      const base = pageLabel(pg) + letter + colOf(P, x);
      if (!used.has(base)) return base;
      for (let k = 1; ; k++) if (!used.has(base + '.' + k)) return base + '.' + k;
    }
    const prefix = mode === 'pagecons' && pg ? pageLabel(pg) + letter : letter, re = new RegExp('^' + esc(prefix) + '(\\d+)$');
    if (fill) { for (let k = 1; ; k++) if (!used.has(prefix + k)) return prefix + k; }
    let n = 0; used.forEach((t) => { const m = re.exec(t); if (m) n = Math.max(n, +m[1]); });
    return prefix + (n + 1);
  }
  function stripsOf(P) {
    const m = {};
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'sym' && (SY.get(it.s) || {}).role === 'terminal' && it.tag) (m[it.tag] = m[it.tag] || []).push(it); }));
    return m;
  }
  function nextTerminalNo(P, strip) {
    const list = stripsOf(P)[strip] || []; let n = 0;
    list.forEach((it) => { if (/^\d+$/.test(it.no || '')) n = Math.max(n, +it.no); });
    return String(n + 1);
  }

  /* ---------- editing operations (all mutate P; wrap them in a History for undo) ---------- */
  function place(P, pageId, s, x, y, o) {
    o = o || {};
    const pg = findPage(P, pageId), d = SY.get(s);
    if (!pg) throw new Error('blad bestaat niet');
    if (!d) throw new Error('onbekend symbool: ' + s);
    const it = { id: nid(P), k: 'sym', s, x: rnd(x), y: rnd(y) };
    if (o.r) it.r = o.r; if (o.m) it.m = true;
    if (o.fn) it.fn = o.fn; if (o.loc) it.loc = o.loc;
    if (o.pins) it.pins = o.pins.slice();
    it.p = Object.assign({}, o.p || {});
    if (d.role === 'terminal') {
      it.tag = o.tag || lastStrip(P) || 'X1';
      it.no = o.no != null ? String(o.no) : nextTerminalNo(P, it.tag);
    } else if (d.role === 'ref') { it.tag = ''; it.p.name = it.p.name || o.name || ''; }
    else if (d.role === 'plain') it.tag = '';
    else if (d.role === 'slave') it.tag = o.tag || '';
    else it.tag = o.tag || nextTag(P, letterOf(P, s), pg, it.x);
    if (d.kind === 'DI' || d.kind === 'DO') it.p.addr = it.p.addr || o.addr || nextAddr(P, it.tag, d.kind);
    pg.items.push(it);
    fixPage(P, pg);
    return it;
  }
  function lastStrip(P) {
    let t = null; P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'sym' && (SY.get(it.s) || {}).role === 'terminal' && it.tag) t = it.tag; })); return t;
  }
  function nextAddr(P, plcTag, kind) {
    const pre = kind === 'DI' ? 'I' : 'Q'; let n = 0;
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      const d = it.k === 'sym' && SY.get(it.s);
      if (d && d.kind === kind && it.tag === plcTag) { const m = /^[IQ](\d+)$/.exec((it.p || {}).addr || ''); if (m) n = Math.max(n, +m[1]); }
    }));
    return pre + (n + 1);
  }
  function addWire(P, pageId, pts, o) {
    const pg = findPage(P, pageId); if (!pg) throw new Error('blad bestaat niet');
    const q = cleanPts(pts); if (q.length < 2) return null;
    const w = Object.assign({ id: nid(P), k: 'wire', pts: q }, o || {});
    pg.items.push(w); fixPage(P, pg); return w;
  }
  /* several parallel wires at once (the "3 wires" tool): each next wire is offset by 1 grid unit */
  function addWires(P, pageId, pts, n, o) {
    const out = [], a = pts[0], b = pts[pts.length - 1];
    const vert = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
    for (let i = 0; i < n; i++) out.push(addWire(P, pageId, pts.map((p) => vert ? [p[0] + i, p[1]] : [p[0], p[1] + i]), o));
    return out;
  }
  function addPot(P, pageId, name, o) {
    o = o || {};
    const pg = findPage(P, pageId), T = tplOf(P);
    const side = o.side || 'top', pots = pg.items.filter((i) => i.k === 'pot' && i.side === side);
    let y = o.y;
    if (y == null) {
      if (side === 'top') { y = T.y0 + 1; while (pots.some((p) => p.y === y)) y++; }
      else { y = Math.floor(T.y1) - 5; while (pots.some((p) => p.y === y)) y--; } // room below for the contact cross
    }
    const it = { id: nid(P), k: 'pot', name: String(name || 'L1'), y: rnd(y), x1: rnd(o.x1 != null ? o.x1 : T.x0), x2: rnd(o.x2 != null ? o.x2 : T.x0 + T.cols * T.colW), side };
    pg.items.push(it); return it;
  }
  function addCable(P, pageId, a, b, o) {
    o = o || {};
    const pg = findPage(P, pageId);
    const it = { id: nid(P), k: 'cable', a: [a[0], a[1]], b: [b[0], b[1]], tag: o.tag || nextTag(P, 'W', pg, a[0]), p: Object.assign({ type: '', len: '' }, o.p || {}), cores: o.cores || [] };
    pg.items.push(it); return it;
  }
  function addItem(P, pageId, item) {
    const pg = findPage(P, pageId); const it = Object.assign({ id: nid(P) }, item); pg.items.push(it); return it;
  }
  function itemById(P, id) {
    for (const pg of P.pages) { const it = pg.items.find((i) => i.id === id); if (it) return { pg, it }; }
    return null;
  }
  function setProps(P, id, patch) {
    const f = itemById(P, id); if (!f) return null;
    Object.keys(patch).forEach((k) => {
      if (k === 'p') f.it.p = Object.assign({}, f.it.p || {}, patch.p);
      else if (patch[k] === undefined || patch[k] === null) delete f.it[k];
      else f.it[k] = patch[k];
    });
    if (f.it.k === 'sym' || f.it.k === 'wire') fixPage(P, f.pg);
    return f.it;
  }
  /* rename a whole device: master, slaves and cables keep belonging together */
  function renameDevice(P, from, to, fn, loc) {
    let n = 0;
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if ((it.k === 'sym' || it.k === 'cable') && it.tag === from && (fn == null || effFn(P, pg, it) === fn) && (loc == null || effLoc(P, pg, it) === loc)) { it.tag = to; n++; }
    }));
    return n;
  }

  function itemPoints(it) {
    if (it.k === 'wire' || it.k === 'line') return it.pts;
    if (it.k === 'cable') return [it.a, it.b];
    if (it.k === 'pot') return [[it.x1, it.y], [it.x2, it.y]];
    if (it.k === 'rect' || it.k === 'flframe' || it.k === 'encl' || it.k === 'duct' || it.k === 'cab') return [[it.x, it.y], [it.x + it.w, it.y + it.h]];
    if (it.k === 'rail') return [[it.x, it.y], [it.x + it.w, it.y + 1]];
    return [[it.x, it.y]];
  }
  function shift(it, dx, dy) {
    if (it.k === 'wire' || it.k === 'line') it.pts = it.pts.map((p) => [p[0] + dx, p[1] + dy]);
    else if (it.k === 'cable') { it.a = [it.a[0] + dx, it.a[1] + dy]; it.b = [it.b[0] + dx, it.b[1] + dy]; }
    else if (it.k === 'pot') { it.y += dy; it.x1 += dx; it.x2 += dx; }
    else { it.x += dx; it.y += dy; }
  }
  /* move items; wires that end on a moved pin or moved wire end follow (rubberband) and stay orthogonal */
  function moveItems(P, pageId, ids, dx, dy, o) {
    o = o || {};
    const pg = findPage(P, pageId), sel = new Set(ids);
    if (!dx && !dy) return;
    const anchors = new Set();
    pg.items.forEach((it) => {
      if (!sel.has(it.id)) return;
      if (it.k === 'sym') symPins(it).forEach((p) => anchors.add(key(p.x, p.y)));
      if (it.k === 'wire') [it.pts[0], it.pts[it.pts.length - 1]].forEach((p) => anchors.add(key(p[0], p[1])));
    });
    pg.items.forEach((it) => { if (sel.has(it.id)) shift(it, dx, dy); });
    if (o.rubber !== false) pg.items.forEach((w) => {
      if (w.k !== 'wire' || sel.has(w.id)) return;
      [0, w.pts.length - 1].forEach((e) => {
        const p = w.pts[e]; if (!anchors.has(key(p[0], p[1]))) return;
        const nb = e === 0 ? 1 : w.pts.length - 2, q = w.pts[nb];
        const wasVert = p[0] === q[0];
        const np = [p[0] + dx, p[1] + dy];
        if (w.pts.length > 2) {
          w.pts[e] = np;
          if (wasVert) w.pts[nb] = [np[0], q[1]]; else w.pts[nb] = [q[0], np[1]];
        } else if ((wasVert && dx === 0) || (!wasVert && dy === 0)) w.pts[e] = np;
        else if (wasVert) { const my = Math.round((np[1] + q[1]) / 2); w.pts = e === 0 ? [np, [np[0], my], [q[0], my], q] : [q, [q[0], my], [np[0], my], np]; }
        else { const mx = Math.round((np[0] + q[0]) / 2); w.pts = e === 0 ? [np, [mx, np[1]], [mx, q[1]], q] : [q, [mx, q[1]], [mx, np[1]], np]; }
      });
    });
    fixPage(P, pg);
  }
  function rotateItems(P, pageId, ids) {
    const pg = findPage(P, pageId), sel = new Set(ids);
    pg.items.forEach((it) => { if (sel.has(it.id) && it.k === 'sym') it.r = ((it.r || 0) + 90) % 360; if (sel.has(it.id) && it.k === 'text') it.rot = ((it.rot || 0) + 90) % 360 === 180 ? 0 : 90; });
    fixPage(P, pg);
  }
  function mirrorItems(P, pageId, ids) {
    const pg = findPage(P, pageId), sel = new Set(ids);
    pg.items.forEach((it) => { if (sel.has(it.id) && it.k === 'sym') it.m = !it.m; });
    fixPage(P, pg);
  }
  /* delete; if a two-pin symbol sat inline in a straight wire, the two wire halves are joined again (heal) */
  function deleteItems(P, pageId, ids, o) {
    o = o || {};
    const pg = findPage(P, pageId), sel = new Set(ids), heal = [];
    pg.items.forEach((it) => {
      if (!sel.has(it.id) || it.k !== 'sym' || o.heal === false) return;
      const d = SY.get(it.s), pins = symPins(it);
      d.pairs.forEach((pr) => heal.push([pins[pr[0]], pins[pr[1]]]));
    });
    pg.items = pg.items.filter((it) => !sel.has(it.id));
    heal.forEach(([a, b]) => {
      if (!a || !b) return;
      const at = (p) => pg.items.filter((w) => w.k === 'wire' && (key(...w.pts[0]) === key(p.x, p.y) || key(...w.pts[w.pts.length - 1]) === key(p.x, p.y)));
      const wa = at(a), wb = at(b);
      if (wa.length !== 1 || wb.length !== 1 || wa[0] === wb[0]) return;
      const busy = (p) => pg.items.some((it) => it.k === 'sym' && symPins(it).some((q) => q.x === p.x && q.y === p.y));
      if (busy(a) || busy(b)) return;
      const ra = wa[0].pts[0][0] === a.x && wa[0].pts[0][1] === a.y ? wa[0].pts.slice().reverse() : wa[0].pts.slice();
      const rb = wb[0].pts[0][0] === b.x && wb[0].pts[0][1] === b.y ? wb[0].pts.slice() : wb[0].pts.slice().reverse();
      wa[0].pts = cleanPts(ra.concat(rb));
      pg.items = pg.items.filter((w) => w !== wb[0]);
    });
    fixPage(P, pg);
  }
  /* copy/paste: items keep their relative positions; devices get new tags unless keepTags */
  function copyItems(P, pageId, ids) {
    const pg = findPage(P, pageId), sel = new Set(ids);
    return clone(pg.items.filter((it) => sel.has(it.id)));
  }
  function pasteItems(P, pageId, items, dx, dy, o) {
    o = o || {};
    const pg = findPage(P, pageId), map = {}, out = [];
    items = clone(items);
    /* masters first so their contacts can follow the new tag */
    const order = (it) => { const d = it.k === 'sym' && SY.get(it.s); return d && d.role === 'master' ? 0 : 1; };
    items.sort((a, b) => order(a) - order(b));
    items.forEach((it) => {
      it.id = nid(P); shift(it, dx, dy);
      const d = it.k === 'sym' && SY.get(it.s);
      if (!o.keepTags && d) {
        if (d.role === 'master' || d.role === 'device') {
          const old = it.tag;
          if (map[old] == null) map[old] = nextTag(P, letterOf(P, it.s), pg, it.x);
          it.tag = map[old];
          if (d.kind === 'DI' || d.kind === 'DO') delete it.p.addr;
        } else if (d.role === 'slave' && map[it.tag] != null) { it.tag = map[it.tag]; delete it.pins; }
        else if (d.role === 'terminal') it.no = nextTerminalNo(P, it.tag);
      }
      if (!o.keepTags && it.k === 'cable') it.tag = nextTag(P, 'W', pg, it.a[0]);
      pg.items.push(it); out.push(it);
    });
    fixPage(P, pg);
    return out;
  }

  /* ---------- function / location (= plant section, + place) ---------- */
  function frameOf(pg, it) {
    const x = it.x != null ? it.x : (it.a || [0])[0], y = it.y != null ? it.y : (it.a || [0, 0])[1];
    return pg.items.find((f) => f.k === 'flframe' && x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h) || null;
  }
  function effFn(P, pg, it) { if (it.fn) return it.fn; const f = frameOf(pg, it); return (f && f.fn) || pg.fn || ''; }
  function effLoc(P, pg, it) { if (it.loc) return it.loc; const f = frameOf(pg, it); return (f && f.loc) || pg.loc || ''; }
  function fullTag(fn, loc, tag) { return (fn ? '=' + fn : '') + (loc ? '+' + loc : '') + '-' + tag; }

  /* ---------- analysis: devices, nets, cross references (computed, never stored) ---------- */
  function UF() { const p = new Map(); const f = (x) => { if (!p.has(x)) p.set(x, x); let r = x; while (p.get(r) !== r) r = p.get(r); let c = x; while (p.get(c) !== r) { const n = p.get(c); p.set(c, r); c = n; } return r; }; return { f, u: (a, b) => { a = f(a); b = f(b); if (a !== b) p.set(a, b); }, keys: () => p.keys() }; }

  function analyze(P) {
    const T = tplOf(P), uf = UF(), A = { T, syms: [], symById: {}, devices: {}, nets: [], netOf: {}, wireNet: {}, dots: {}, potRefs: {}, refInfo: {}, cables: {}, wireNo: {}, pageIdx: {} };
    P.pages.forEach((pg, i) => { A.pageIdx[pg.id] = i; });
    const refStr = (pg, x) => pageLabel(pg) + '.' + colOf(P, x);

    P.pages.forEach((pg) => {
      const K = (x, y) => pg.id + '|' + key(x, y);
      const wires = pg.items.filter((i) => i.k === 'wire'), pots = pg.items.filter((i) => i.k === 'pot');
      const arms = {}, arm = (x, y, n) => { const k = key(x, y); arms[k] = (arms[k] || 0) + n; };
      const isWirePt = {};
      wires.forEach((w) => {
        uf.f(K(...w.pts[0]));
        w.pts.forEach((p, j) => { uf.u(K(...w.pts[0]), K(p[0], p[1])); arm(p[0], p[1], j === 0 || j === w.pts.length - 1 ? 1 : 2); isWirePt[key(p[0], p[1])] = 1; });
      });
      /* points that can attach to something: wire vertices and symbol pins */
      const pts = [];
      wires.forEach((w) => w.pts.forEach((p, j) => pts.push({ p, end: j === 0 || j === w.pts.length - 1 })));
      pg.items.forEach((it) => {
        if (it.k !== 'sym') return;
        const d = SY.get(it.s); if (!d) return;
        const pins = symPins(it), info = { it, pg, d, pins: [], dev: null, ref: refStr(pg, it.x), col: colOf(P, it.x), row: rowOf(P, it.y) };
        pins.forEach((p) => { const k = K(p.x, p.y); uf.f(k); info.pins.push(Object.assign({ key: k }, p)); pts.push({ p: [p.x, p.y], end: true, pin: true }); arm(p.x, p.y, 1); });
        (d.through || []).forEach((t) => uf.u(info.pins[t[0]].key, info.pins[t[1]].key));
        /* a continuation arrow is the potential with the same name (so "2L1" on sheet 1 feeds the rail 2L1 on sheet 6) */
        if (d.role === 'ref' && (it.p || {}).name) uf.u(info.pins[0].key, 'pot:' + it.p.name);
        A.syms.push(info); A.symById[it.id] = info;
      });
      /* T-junctions: a wire end or pin inside another wire's segment */
      pts.forEach((q) => {
        if (!q.end) return;
        wires.forEach((w) => {
          for (let s = 1; s < w.pts.length; s++) if (onSeg(q.p, w.pts[s - 1], w.pts[s])) { uf.u(K(q.p[0], q.p[1]), K(...w.pts[0])); arm(q.p[0], q.p[1], 2); }
        });
      });
      /* potentials: anything ending on the rail joins the named potential */
      pots.forEach((r) => {
        const a = [Math.min(r.x1, r.x2), r.y], b = [Math.max(r.x1, r.x2), r.y];
        uf.f('pot:' + r.name);
        const seen = new Set();
        pts.forEach((q) => {
          if (!onSegIncl(q.p, a, b)) return;
          const k = key(q.p[0], q.p[1]); if (seen.has(k)) return; seen.add(k);
          uf.u(K(q.p[0], q.p[1]), 'pot:' + r.name);
          arm(q.p[0], q.p[1], onSeg(q.p, a, b) ? 2 : 1);
        });
      });
      A.dots[pg.id] = Object.keys(arms).filter((k) => arms[k] >= 3 && isWirePt[k] !== undefined).map((k) => k.split(',').map(Number));
    });

    /* nets */
    const netIdx = new Map();
    const netFor = (k) => { const r = uf.f(k); if (!netIdx.has(r)) { netIdx.set(r, A.nets.length); A.nets.push({ id: A.nets.length, pins: [], wires: [], pots: new Set(), refs: new Set(), name: '' }); } return A.nets[netIdx.get(r)]; };
    A.syms.forEach((s) => s.pins.forEach((p) => { const n = netFor(p.key); p.net = n.id; n.pins.push({ sym: s, pin: p }); }));
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if (it.k === 'wire') { const n = netFor(pg.id + '|' + key(...it.pts[0])); n.wires.push({ pg, w: it }); A.wireNet[it.id] = n.id; }
      if (it.k === 'pot') { const n = netFor('pot:' + it.name); n.pots.add(it.name); }
    }));
    A.syms.forEach((s) => { if (s.d.role === 'ref' && (s.it.p || {}).name) A.nets[s.pins[0].net].refs.add(s.it.p.name); });
    A.nets.forEach((n) => { n.name = [...n.pots][0] || [...n.refs][0] || ''; });

    /* devices: symbols with the same function, location and tag are one device */
    A.syms.forEach((s) => {
      const role = s.d.role;
      if (role === 'ref' || role === 'plain') return;
      const fn = effFn(P, s.pg, s.it), loc = effLoc(P, s.pg, s.it), tag = s.it.tag || '';
      s.fn = fn; s.loc = loc;
      if (!tag) return;
      const k = fn + '|' + loc + '|' + tag;
      const dv = A.devices[k] || (A.devices[k] = { key: k, tag, fn, loc, full: fullTag(fn, loc, tag), master: null, masters: [], slaves: [], all: [], terminals: [], role });
      s.dev = dv; dv.all.push(s);
      if (role === 'master') { dv.masters.push(s); if (!dv.master) dv.master = s; }
      else if (role === 'slave') dv.slaves.push(s);
      else if (role === 'terminal') { dv.terminals.push(s); dv.role = 'terminal'; }
      else if (role === 'device' && !dv.master) dv.master = s;
    });
    Object.values(A.devices).forEach((dv) => {
      const m = dv.master || dv.all[0];
      dv.p = Object.assign({}, (m && m.it.p) || {});
      dv.letter = m ? m.d.letter : '';
      dv.sym = m ? m.d : null;
      /* automatic contact numbers for contacts whose numbers were not typed in by hand */
      const used = new Set(), byPos = (a, b) => (A.pageIdx[a.pg.id] - A.pageIdx[b.pg.id]) || (a.it.x - b.it.x) || (a.it.y - b.it.y);
      dv.slaves.sort(byPos);
      /* contacts of a device: its slaves, or the contact blocks of a push button / switch drawn as several symbols */
      const contacts = dv.slaves.concat(dv.all.filter((s) => s.d.role === 'device').sort(byPos));
      contacts.forEach((s) => { if (s.it.pins) s.it.pins.forEach((n) => { if (/^\d\d$/.test(n)) used.add(n[0]); }); });
      let seq = 1, mainN = 0;
      const nextSeq = () => { while (used.has(String(seq))) seq++; used.add(String(seq)); return seq++; };
      contacts.forEach((s) => {
        if (s.it.pins) return;
        const kd = s.d.kind;
        let names = null;
        if (kd === 'NO') { const n = nextSeq(); names = [n + '3', n + '4']; }
        else if (kd === 'NC') { const n = nextSeq(); names = [n + '1', n + '2']; }
        else if (kd === 'CO') { const n = nextSeq(); names = [n + '2', n + '4', n + '1']; }
        else if (kd === 'tNO') { const n = nextSeq(); names = [n + '7', n + '8']; }
        else if (kd === 'tNC') { const n = nextSeq(); names = [n + '5', n + '6']; }
        else if (kd === 'main') { names = []; for (let i = 0; i < (s.d.poles || 1); i++) names.push(String(mainN * 2 + 1), String(mainN * 2 + 2)), mainN++; }
        else if (kd === 'DI') names = [String((s.it.p || {}).addr || 'I?')];
        if (names) s.pins.forEach((p, i) => { if (names[i] != null) p.n = names[i]; });
      });
      dv.slaves.forEach((s) => { s.xref = dv.master ? dv.master.ref : ''; });
    });

    /* where each potential name appears: rails (page.0 on the next sheet, page.9 on the previous one) and continuation arrows (their own page.column) */
    const occ = {};
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'pot') (occ[it.name] = occ[it.name] || []).push({ pg, rail: true }); }));
    A.syms.forEach((s) => { const nm = s.d.role === 'ref' && (s.it.p || {}).name; if (nm) (occ[nm] = occ[nm] || []).push({ pg: s.pg, sym: s }); });
    const refOf = (o, side) => (o.sym ? o.sym.ref : pageLabel(o.pg) + '.' + (side === 'prev' ? T.cols - 1 : 0));
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if (it.k !== 'pot') return;
      const list = occ[it.name], i = A.pageIdx[pg.id];
      const before = list.filter((o) => A.pageIdx[o.pg.id] < i), after = list.filter((o) => A.pageIdx[o.pg.id] > i);
      A.potRefs[it.id] = { prev: before.length ? refOf(before[before.length - 1], 'prev') : '', next: after.length ? refOf(after[0], 'next') : '' };
    }));
    /* continuation arrows: show where the same name continues (other arrows, or the potential rail on another sheet) */
    A.syms.filter((s) => s.d.role === 'ref').forEach((s) => {
      const nm = (s.it.p || {}).name;
      A.refInfo[s.it.id] = nm ? occ[nm].filter((o) => o.pg !== s.pg && o.sym !== s).map((o) => refOf(o, 'next')).filter((r, i, a) => a.indexOf(r) === i) : [];
    });

    /* wire numbers per net (named potentials keep their name) */
    const mode = (P.settings || {}).wireNo || 'seq', usedNo = {};
    const order = A.nets.filter((n) => n.wires.length).map((n) => {
      let best = null;
      n.wires.forEach(({ pg, w }) => w.pts.forEach((p) => { const c = [A.pageIdx[pg.id], p[0], p[1], pg]; if (!best || c[0] < best[0] || (c[0] === best[0] && (c[1] < best[1] || (c[1] === best[1] && c[2] < best[2])))) best = c; }));
      return { n, best };
    }).sort((a, b) => a.best[0] - b.best[0] || a.best[1] - b.best[1] || a.best[2] - b.best[2]);
    let seqNo = 0;
    order.forEach(({ n, best }) => {
      const manual = n.wires.map((x) => x.w.no).find((v) => v);
      if (manual) { A.wireNo[n.id] = manual; return; }
      if (n.name) { A.wireNo[n.id] = n.name; return; }
      if (mode === 'none') return;
      let no;
      if (mode === 'seq') no = String(++seqNo);
      else {
        const base = pageLabel(best[3]) + '.' + colOf(P, best[1]);
        usedNo[base] = (usedNo[base] || 0) + 1;
        no = usedNo[base] === 1 ? base : base + '.' + (usedNo[base] - 1);
      }
      A.wireNo[n.id] = no;
    });

    /* cables: which wires does the cable line cross, in order from its start point */
    P.pages.forEach((pg) => pg.items.forEach((c) => {
      if (c.k !== 'cable') return;
      const hits = [];
      pg.items.forEach((w) => {
        if (w.k !== 'wire') return;
        for (let s = 1; s < w.pts.length; s++) {
          const h = segX(c.a, c.b, w.pts[s - 1], w.pts[s]);
          if (h) { hits.push({ w, net: A.wireNet[w.id], t: h.t, pt: h.pt }); break; }
        }
      });
      hits.sort((a, b) => a.t - b.t);
      A.cables[c.id] = { pg, it: c, cores: hits.map((h, i) => Object.assign(h, { core: (c.cores[i] || {}).no || String(i + 1), color: (c.cores[i] || {}).color || '', size: (c.cores[i] || {}).size || '' })) };
    }));
    return A;
  }
  function segX(a, b, c, d) { // intersection of segment a-b with c-d: returns {t (0..1 along a-b), pt} or null
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t < 0 || t > 1 || u < 0 || u > 1) return null;
    return { t, pt: [a[0] + t * r[0], a[1] + t * r[1]] };
  }

  /* devices renumbered page by page, left to right (locked tags stay) */
  function renumberDevices(P) {
    const A = analyze(P), map = {}, keep = new Set();
    const list = Object.values(A.devices).filter((d) => d.role !== 'terminal' && (d.master || d.all[0]));
    list.forEach((d) => { if (d.all.some((s) => s.it.lock)) keep.add(d.tag); });
    list.sort((a, b) => { const sa = a.master || a.all[0], sb = b.master || b.all[0]; return (A.pageIdx[sa.pg.id] - A.pageIdx[sb.pg.id]) || (sa.it.x - sb.it.x) || (sa.it.y - sb.it.y); });
    /* clear first so the numbering starts fresh, then hand out new tags in order */
    const saved = [];
    list.forEach((d) => { if (keep.has(d.tag)) return; d.all.forEach((s) => { saved.push([s.it, d.tag]); s.it.tag = '?' + d.key; }); });
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'cable' && !it.lock) { saved.push([it, it.tag]); it.tag = '?'; } }));
    list.forEach((d) => {
      if (keep.has(d.tag)) return;
      /* keep the device's own letter (a contactor tagged Q stays Q even though its coil symbol defaults to K) */
      const m = d.master || d.all[0], letter = (d.tag.match(/^\d*[a-z]?\.?([A-Z]+)/) || [])[1] || letterOf(P, m.it.s) || 'K';
      const nt = nextTag(P, letter, m.pg, m.it.x, true);
      d.all.forEach((s) => { s.it.tag = nt; });
      map[d.tag] = nt;
    });
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'cable' && it.tag === '?') { it.tag = nextTag(P, 'W', pg, it.a[0], true); const old = saved.find((x) => x[0] === it); if (old) map[old[1]] = it.tag; } }));
    return map;
  }
  function renumberTerminals(P, strip) {
    const A = analyze(P), list = A.syms.filter((s) => s.d.role === 'terminal' && s.it.tag === strip && !s.it.lock);
    list.sort((a, b) => (A.pageIdx[a.pg.id] - A.pageIdx[b.pg.id]) || (a.it.x - b.it.x) || (a.it.y - b.it.y));
    let n = 0; list.forEach((s) => { if (s.d.id === 'term_pe') { s.it.no = 'PE'; return; } s.it.no = String(++n); });
    return list.length;
  }

  /* ---------- undo / redo ---------- */
  function History(P) { this.P = P; this.undo = []; this.redo = []; this.limit = 100; }
  History.prototype.run = function (label, fn) {
    const snap = JSON.stringify(this.P);
    try {
      const r = fn(this.P);
      this.undo.push({ label, snap }); if (this.undo.length > this.limit) this.undo.shift();
      this.redo = [];
      return r;
    } catch (e) { this.P = JSON.parse(snap); throw e; }
  };
  History.prototype.back = function () { const u = this.undo.pop(); if (!u) return null; this.redo.push({ label: u.label, snap: JSON.stringify(this.P) }); this.P = JSON.parse(u.snap); return u.label; };
  History.prototype.fwd = function () { const r = this.redo.pop(); if (!r) return null; this.undo.push({ label: r.label, snap: JSON.stringify(this.P) }); this.P = JSON.parse(r.snap); return r.label; };
  History.prototype.reset = function (P) { this.P = P; this.undo = []; this.redo = []; };
  /* swap in a whole new project (an AI design, a loaded example) as one undoable step */
  History.prototype.replace = function (label, P) { this.undo.push({ label, snap: JSON.stringify(this.P) }); if (this.undo.length > this.limit) this.undo.shift(); this.redo = []; this.P = P; };

  /* ---------- file format ---------- */
  function serialize(P) { return JSON.stringify(P); }
  function load(txt) {
    const o = typeof txt === 'string' ? JSON.parse(txt) : txt;
    if (!o || o.format !== 'lazy-electrical' || !Array.isArray(o.pages)) throw new Error('dit is geen LAZY Electrical-project (versie 2)');
    const P = newProject(); Object.assign(P, o);
    P.info = Object.assign(newProject().info, o.info || {}); P.settings = Object.assign(newProject().settings, o.settings || {});
    P.parts = o.parts || []; P.extras = o.extras || []; P.revisions = o.revisions || [];
    let mx = 0; P.pages.forEach((pg) => { [pg.id].concat(pg.items.map((i) => i.id)).forEach((id) => { const n = parseInt(String(id).slice(1), 36); if (n > mx) mx = n; }); pg.items = pg.items || []; });
    P.seq = Math.max(P.seq || 0, mx);
    return P;
  }

  return {
    TEMPLATES, tplOf, newProject, nid, pageLabel, findPage, pageByLabel, addPage, deletePage, movePage, renumberPages,
    tf, symPins, cleanPts, fixPage, onSeg, colOf, rowOf, nextTag, nextTerminalNo, letterOf, stripsOf,
    place, addWire, addWires, addPot, addCable, addItem, itemById, setProps, renameDevice, moveItems, rotateItems, mirrorItems, deleteItems,
    copyItems, pasteItems, itemPoints, effFn, effLoc, fullTag, analyze, renumberDevices, renumberTerminals, History, serialize, load, clone, isAuto
  };
})();
if (typeof module !== 'undefined') module.exports = LE;
