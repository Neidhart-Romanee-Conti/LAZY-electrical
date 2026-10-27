/* LAZY Electrical renderer: turns a page of the project into drawing primitives in millimetres,
   and primitives into SVG. The same primitives feed the PDF export.
   Primitive: {t:'l'|'pl'|'r'|'c'|'tx', ...} plus an optional item id so the editor can tell what was clicked. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.render = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols;

  /* ---------- text width estimate (Helvetica-like), in the same unit as size ---------- */
  function tw(s, size) {
    let w = 0;
    for (const ch of String(s)) {
      if (/[0-9]/.test(ch)) w += 0.556;
      else if (ch === ' ') w += 0.278;
      else if (/[il.,:;|!'()/[\]]/.test(ch)) w += 0.26;
      else if (/[mwMW]/.test(ch)) w += 0.86;
      else if (/[A-Z+=]/.test(ch)) w += 0.68;
      else w += 0.53;
    }
    return w * size;
  }
  function wrap(s, maxW, size) {
    s = String(s || '').trim(); if (!s) return [];
    const words = s.split(/\s+/), out = []; let cur = '';
    words.forEach((w) => { const t = cur ? cur + ' ' + w : w; if (cur && tw(t, size) > maxW) { out.push(cur); cur = w; } else cur = t; });
    if (cur) out.push(cur);
    return out;
  }

  /* ---------- a small drawing context in grid units; everything is scaled to mm on output ---------- */
  function Ctx(g, id) { this.g = g; this.p = []; this.id = id || null; }
  Ctx.prototype.push = function (q) { if (this.id && !q.id) q.id = this.id; this.p.push(q); return q; };
  Ctx.prototype.l = function (x1, y1, x2, y2, o) { o = o || {}; const g = this.g; return this.push({ t: 'l', x1: x1 * g, y1: y1 * g, x2: x2 * g, y2: y2 * g, w: o.w || 0.25, dash: o.dash || 0 }); };
  Ctx.prototype.pl = function (pts, o) { o = o || {}; const g = this.g; return this.push({ t: 'pl', pts: pts.map((q) => [q[0] * g, q[1] * g]), w: o.w || 0.25, close: !!o.close, fill: o.fill || null, dash: o.dash || 0 }); };
  Ctx.prototype.r = function (x, y, w, h, o) { o = o || {}; const g = this.g; return this.push({ t: 'r', x: x * g, y: y * g, w: w * g, h: h * g, lw: o.w || 0.25, fill: o.fill || null, dash: o.dash || 0 }); };
  Ctx.prototype.c = function (x, y, r, o) { o = o || {}; const g = this.g; return this.push({ t: 'c', x: x * g, y: y * g, r: r * g, lw: o.w || 0.25, fill: o.fill || null }); };
  Ctx.prototype.t = function (x, y, s, size, o) {
    o = o || {}; s = String(s == null ? '' : s); if (!s) return null;
    const g = this.g;
    return this.push({ t: 'tx', x: x * g, y: y * g, s, size: size * g, rot: o.rot || 0, a: o.a || 'start', bold: !!o.bold, color: o.color || null });
  };
  function arcPts(cx, cy, r, a0, a1, n) {
    n = n || 12; const out = [];
    for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }

  /* ---------- frame and title block (own design) ---------- */
  function frame(c, P, pg, total, T) {
    const I = P.info, x1 = T.x0 + T.cols * T.colW, rh = (T.y1 - T.y0) / T.rows;
    c.r(T.ox0, T.oy0, T.ox1 - T.ox0, T.oy1 - T.oy0, { w: 0.5 });
    c.l(T.x0, T.oy0, T.x0, T.y1); c.l(x1, T.oy0, x1, T.y1); c.l(T.ox0, T.y0, T.ox1, T.y0); c.l(T.ox0, T.y1, T.ox1, T.y1, { w: 0.5 });
    if (pg.kind !== 'cover') {
      for (let i = 0; i < T.cols; i++) { if (i) c.l(T.x0 + i * T.colW, T.oy0, T.x0 + i * T.colW, T.y0); c.t(T.x0 + (i + 0.5) * T.colW, T.y0 - 0.28, String(i), 0.55, { a: 'middle' }); }
      for (let r = 0; r < T.rows; r++) { if (r) c.l(T.ox0, T.y0 + r * rh, T.x0, T.y0 + r * rh); c.t((T.ox0 + T.x0) / 2, T.y0 + (r + 0.5) * rh + 0.2, 'ABCDEFGH'[r], 0.55, { a: 'middle' }); }
    }
    /* title block: brand | project | page title | fields */
    const y = T.y1, h = T.oy1 - T.y1, W = T.ox1 - T.ox0, X = (f) => T.ox0 + W * f;
    const cols = [0, 0.16, 0.42, 0.66, 0.79, 0.9, 1];
    cols.slice(1, -1).forEach((f) => c.l(X(f), y, X(f), T.oy1));
    const L = 0.4, V = 0.55;
    const field = (x0, x1, yy, hh, label, val, big) => {
      c.t(x0 + 0.15, yy + 0.5, label, L, { color: '#444' });
      const lines = wrap(val, (x1 - x0) - 0.3, big || V).slice(0, Math.max(1, Math.floor((hh - 0.6) / ((big || V) * 1.25))));
      lines.forEach((ln, i) => c.t(x0 + 0.15, yy + 0.6 + (big || V) * 1.2 * (i + 1), ln, big || V));
    };
    /* brand */
    const bx = X(0) + 0.3, by = y + h / 2;
    c.pl([[bx, by - 0.9], [bx + 0.7, by - 0.9], [bx + 0.35, by], [bx + 0.9, by], [bx + 0.2, by + 1.1], [bx + 0.4, by + 0.25], [bx, by + 0.25]], { close: true, fill: 'k' });
    c.t(bx + 1.3, by + 0.05, 'LAZY Electrical', 0.7, { bold: true });
    if (I.company) c.t(bx + 1.3, by + 0.9, I.company, 0.42);
    field(X(cols[1]), X(cols[2]), y, h / 2, 'Project', I.name, 0.65);
    field(X(cols[1]), X(cols[2]), y + h / 2, h / 2, 'Omschrijving', [I.desc1, I.desc2].filter(Boolean).join(' · '));
    c.l(X(cols[1]), y + h / 2, X(cols[2]), y + h / 2);
    field(X(cols[2]), X(cols[3]), y, h, 'Blad', pg.title || '', 0.7);
    const half = h / 2;
    [[cols[3], cols[4], 'Tekeningnr.', I.drawingNo], [cols[4], cols[5], 'Revisie', I.revision], [cols[5], cols[6], 'Getekend', I.author]].forEach((f) => field(X(f[0]), X(f[1]), y, half, f[2], f[3]));
    c.l(X(cols[3]), y + half, X(cols[6]), y + half);
    field(X(cols[3]), X(cols[4]), y + half, half, 'Datum', I.revDate || I.created);
    field(X(cols[4]), X(cols[5]), y + half, half, 'Functie / plaats', (pg.fn ? '=' + pg.fn : '') + (pg.loc ? ' +' + pg.loc : ''));
    c.t(X(cols[5]) + 0.15, y + half + 0.5, 'Blad', L, { color: '#444' });
    c.t(X(cols[5]) + (X(cols[6]) - X(cols[5])) / 2, y + half + half * 0.75, M.pageLabel(pg) + ' / ' + total, 0.75, { a: 'middle', bold: true });
  }

  /* ---------- symbols ---------- */
  function symBox(it) {
    const d = SY.get(it.s), T = M.tf(it); let b = [Infinity, Infinity, -Infinity, -Infinity];
    const add = (q) => { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); };
    d.g.forEach((e) => {
      if (e[0] === 'l' || e[0] === 'd') { add(T(e[1], e[2])); add(T(e[3], e[4])); }
      else if (e[0] === 'p') e[1].forEach((q) => add(T(q[0], q[1])));
      else if (e[0] === 'c' || e[0] === 'a') { add(T(e[1] - e[3], e[2] - e[3])); add(T(e[1] + e[3], e[2] + e[3])); }
      else if (e[0] === 'r') { add(T(e[1], e[2])); add(T(e[1] + e[3], e[2] + e[4])); }
    });
    d.pins.forEach((p) => add(T(p.x, p.y)));
    return b;
  }
  function drawSymGfx(c, it, d) {
    const T = M.tf(it);
    d.g.forEach((e) => {
      const k = e[0];
      if (k === 'l' || k === 'd') { const a = T(e[1], e[2]), b = T(e[3], e[4]); c.l(a[0], a[1], b[0], b[1], { dash: k === 'd' ? 1 : 0 }); }
      else if (k === 'p') c.pl(e[1].map((q) => T(q[0], q[1])), { close: !!e[2], fill: e[3] });
      else if (k === 'c') { const q = T(e[1], e[2]); c.c(q[0], q[1], e[3], { fill: e[4] }); }
      else if (k === 'r') c.pl([[e[1], e[2]], [e[1] + e[3], e[2]], [e[1] + e[3], e[2] + e[4]], [e[1], e[2] + e[4]]].map((q) => T(q[0], q[1])), { close: true, fill: e[5] });
      else if (k === 'a') c.pl(arcPts(e[1], e[2], e[3], e[4], e[5]).map((q) => T(q[0], q[1])));
      else if (k === 't') { const q = T(e[1], e[2]); c.t(q[0], q[1], e[3], e[4], { a: e[5] || 'start' }); }
    });
  }
  const TAG = 0.55, DESC = 0.42, PIN = 0.36, REF = 0.4;
  function showTag(P, pg, s) {
    const fn = s.fn || '', loc = s.loc || '';
    const pre = (fn && fn !== (pg.fn || '') ? '=' + fn : '') + (loc && loc !== (pg.loc || '') ? '+' + loc : '');
    return pre + '-' + (s.it.tag || '?');
  }
  function drawSym(c, P, pg, A, it) {
    const d = SY.get(it.s); if (!d) return;
    const s = A.symById[it.id] || { pins: M.symPins(it), it, d };
    const p = it.p || {}, b = symBox(it), vert = !(it.r === 90 || it.r === 270);
    drawSymGfx(c, it, d);
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
    /* pin numbers */
    if ((P.settings || {}).showPinNo !== false && d.role !== 'terminal' && d.role !== 'ref' && d.kind !== 'DI') {
      /* upright symbols: numbers right of the pin, inside (below a top pin, above a bottom pin); lying symbols: above the pin */
      (s.pins || []).forEach((q) => {
        if (!q.n) return;
        if (vert) c.t(q.x + 0.15, q.y < cy ? q.y + 0.45 : q.y - 0.12, q.n, PIN);
        else if (q.x < cx) c.t(q.x + 0.12, q.y - 0.12, q.n, PIN);
        else c.t(q.x - 0.12, q.y - 0.12, q.n, PIN, { a: 'end' });
      });
    }
    if (d.role === 'terminal') {
      /* the strip name only on the first terminal of a row of the same strip, the number next to each terminal */
      const T = M.tf(it), o = T(0, 0.5);
      const prev = pg.items.some((x) => x !== it && x.k === 'sym' && x.tag === it.tag && (SY.get(x.s) || {}).role === 'terminal' && (x.r || 0) === (it.r || 0) &&
        (vert ? x.y === it.y && x.x === it.x - 1 : x.x === it.x && x.y === it.y - 1));
      if (vert) { if (!prev) c.t(o[0] - 0.3, o[1] + 0.18, '-' + (it.tag || '?'), PIN + 0.04, { a: 'end' }); c.t(o[0] + 0.25, o[1] + 0.18, it.no || '', PIN + 0.02); }
      else { c.t(o[0], o[1] - 0.3, it.no || '', DESC, { a: 'middle' }); if (!prev) c.t(o[0], o[1] + 0.75, '-' + (it.tag || '?'), PIN, { a: 'middle' }); }
      return;
    }
    if (d.role === 'ref') {
      /* upright arrow: name and destination written vertically under the arrow (rows of arrows stay readable) */
      const refs = (A.refInfo[it.id] || []).map((r) => '/' + r).join(' ');
      if (vert) c.t(it.x + 0.15, b[3] + 0.25, (p.name || '?') + (refs ? '  ' + refs : ''), DESC, { rot: 90, a: 'end' });
      else {
        c.t(b[2] + 0.2, b[1] + 0.45, p.name || '?', DESC, { bold: true });
        if (refs) c.t(b[2] + 0.2, b[1] + 0.95, refs, REF);
      }
      return;
    }
    if (d.role === 'plain') return;
    if (d.kind === 'DI' || d.kind === 'DO') {
      const T = M.tf(it), q = T(0, 1.0);
      c.t(q[0], q[1] + 0.18, p.addr || '?', DESC + 0.04, { a: 'middle', bold: true });
    }
    /* label: tag, descriptions, cross reference */
    const lines = [[showTag(P, pg, s), TAG, true]];
    const descW = vert ? 3.6 : 6;
    [p.desc, p.desc2].forEach((t) => wrap(t, descW, DESC).forEach((ln) => lines.push([ln, DESC])));
    if (p.showPart && p.part) lines.push([p.part, DESC]);
    if (d.role === 'slave' && s.xref) lines.push(['/' + s.xref, REF]);
    /* contact cross: as a table under the potential right below the device (coils), otherwise as lines in the label */
    let mirrorTable = false;
    if (d.mirror && s.dev && s.dev.slaves.length) {
      const rail = pg.items.some((r) => r.k === 'pot' && r.y > b[3] - 0.01 && r.y - b[3] <= 3 && it.x >= Math.min(r.x1, r.x2) && it.x <= Math.max(r.x1, r.x2));
      if (rail && vert) mirrorTable = true;
      else mirrorLines(s).forEach((t) => lines.push([t, REF]));
    }
    if (vert) {
      /* label left of the symbol (default) or right of it (it.lr), centred on the symbol */
      const lx = it.lr ? b[2] + 0.8 : Math.min(b[0], it.x + d.lab[0] + 0.7) - 0.25, h = lines.reduce((a, l) => a + l[1] * 1.25, 0);
      let yy = cy - h / 2 + lines[0][1];
      lines.forEach((l) => { c.t(lx, yy, l[0], l[1], { a: it.lr ? 'start' : 'end' }); yy += l[1] * 1.25; });
    } else {
      let yy = b[1] - 0.25 - (lines.length - 1) * 0.55;
      lines.forEach((l) => { c.t(b[0], yy, l[0], l[1]); yy += 0.55; });
    }
    if (mirrorTable) drawMirror(c, P, pg, A, s, b);
  }
  function mirrorLines(s) {
    const g = {};
    s.dev.slaves.forEach((x) => {
      const k = x.d.kind, name = k === 'main' ? 'H' : k === 'DI' ? 'IN' : k === 'DO' ? 'UIT' : /NC$/.test(k) ? 'V' : 'M';
      (g[name] = g[name] || []).push(k === 'DI' || k === 'DO' ? ((x.it.p || {}).addr || '') + '/' + x.ref : '/' + x.ref);
      if (k === 'CO') (g.V = g.V || []).push('/' + x.ref);
    });
    return Object.keys(g).map((k) => k + ' ' + g[k].join(' '));
  }
  function drawMirror(c, P, pg, A, s, b) {
    const dv = s.dev, cols = [];
    if (s.d.id === 'plc' || s.d.id === 'logo') {
      const di = [], dq = [];
      dv.slaves.forEach((x) => (x.d.kind === 'DI' ? di : dq).push(((x.it.p || {}).addr || '') + ' ' + x.ref));
      cols.push(['IN', di], ['UIT', dq]);
    } else {
      const m = [], no = [], nc = [];
      dv.slaves.forEach((x) => {
        const k = x.d.kind;
        if (k === 'main') m.push(x.ref);
        else if (k === 'NO' || k === 'tNO' || k === 'thNO') no.push(x.ref);
        else if (k === 'NC' || k === 'tNC' || k === 'thNC') nc.push(x.ref);
        else if (k === 'CO') { no.push(x.ref); nc.push(x.ref); }
      });
      /* H = hoofdcontacten, M = maakcontacten (NO), V = verbreekcontacten (NC) */
      if (m.length || s.d.id === 'coil') cols.push(['H', m]);
      cols.push(['M', no], ['V', nc]);
    }
    /* below the nearest potential rail under the device, otherwise right under the symbol */
    const rails = pg.items.filter((r) => r.k === 'pot' && r.y > b[3] - 0.01 && s.it.x >= Math.min(r.x1, r.x2) && s.it.x <= Math.max(r.x1, r.x2));
    const y0 = (rails.length ? Math.max(...rails.map((r) => r.y)) : b[3]) + 0.9;
    const w = s.d.id === 'plc' || s.d.id === 'logo' ? 2.2 : 1.6, x0 = s.it.x - (cols.length * w) / 2;
    const rows = Math.max(1, ...cols.map((x) => x[1].length));
    cols.forEach((col, i) => {
      const x = x0 + i * w;
      c.t(x + w / 2, y0, col[0], REF, { a: 'middle' });
      col[1].forEach((t, j) => c.t(x + w / 2, y0 + 0.65 + j * 0.5, t, REF - 0.04, { a: 'middle' }));
      if (i) c.l(x, y0 - 0.45, x, y0 + 0.25 + rows * 0.5);
    });
    c.l(x0, y0 + 0.15, x0 + cols.length * w, y0 + 0.15);
  }

  /* ---------- the page ---------- */
  function renderPage(P, pg, A, o) {
    o = o || {};
    A = A || M.analyze(P);
    const T = M.tplOf(P), c = new Ctx(T.g), total = P.pages.length + (o.extraPages || 0);
    c.id = '__frame'; frame(c, P, pg, total, T); c.id = null;
    if (pg.kind === 'cover') { cover(c, P, T); return c.p; }
    if (pg.kind === 'cabinet') c.t(T.x0 + 0.5, T.y0 + 1, 'Kastindeling — schaal 1:' + (pg.scale || 5), 0.6, { bold: true });
    const dots = A.dots[pg.id] || [];
    pg.items.forEach((it) => {
      c.id = it.id;
      if (it.k === 'sym') drawSym(c, P, pg, A, it);
      else if (it.k === 'wire') {
        c.pl(it.pts, { w: it.w || 0.25 });
        const net = A.wireNet[it.id], no = A.wireNo[net], nm = A.nets[net] && A.nets[net].name;
        if (no && !nm && o.wireNumbers !== false) {
          let best = null;
          for (let s = 1; s < it.pts.length; s++) { const a = it.pts[s - 1], b = it.pts[s], L = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]); if (!best || L > best.L) best = { a, b, L }; }
          if (best && best.L >= 3) {
            const mx = (best.a[0] + best.b[0]) / 2, my = (best.a[1] + best.b[1]) / 2;
            if (best.a[0] === best.b[0]) c.t(mx - 0.12, my, no, PIN, { rot: 90, a: 'middle', color: '#1a4fa0' });
            else c.t(mx, my - 0.15, no, PIN, { a: 'middle', color: '#1a4fa0' });
          }
        }
      } else if (it.k === 'pot') {
        const a = Math.min(it.x1, it.x2), b = Math.max(it.x1, it.x2), rf = A.potRefs[it.id] || {};
        c.l(a, it.y, b, it.y, { w: 0.35 });
        c.pl([[a + 0.35, it.y - 0.25], [a, it.y], [a + 0.35, it.y + 0.25]]);
        c.pl([[b - 0.35, it.y - 0.25], [b, it.y], [b - 0.35, it.y + 0.25]]);
        c.t(a + 0.5, it.y - 0.15, it.name, DESC);
        c.t(b - 0.5, it.y - 0.15, it.name, DESC, { a: 'end' });
        if (rf.prev) c.t(a - 0.15, it.y + 0.15, rf.prev, PIN, { a: 'end' });
        if (rf.next) c.t(b + 0.15, it.y + 0.15, rf.next, PIN);
      } else if (it.k === 'cable') {
        c.l(it.a[0], it.a[1], it.b[0], it.b[1], { w: 0.3 });
        const cab = A.cables[it.id] || { cores: [] };
        cab.cores.forEach((h) => c.c(h.pt[0], h.pt[1], 0.12));
        const left = it.a[0] <= it.b[0] ? it.a : it.b, p = it.p || {};
        c.t(left[0] - 0.2, left[1] + 0.15, '-' + it.tag, TAG - 0.05, { a: 'end' });
        if (p.type) c.t(left[0] - 0.2, left[1] + 0.7, p.type, DESC, { a: 'end' });
        cab.cores.forEach((h) => { if (h.core) c.t(h.pt[0] + 0.12, h.pt[1] - 0.18, h.core, PIN - 0.04, { color: '#555' }); });
      } else if (it.k === 'text') c.t(it.x, it.y, it.s, it.size || 0.6, { rot: it.rot || 0, a: it.a || 'start', bold: !!it.bold });
      else if (it.k === 'line') c.pl(it.pts, { dash: it.dash ? 1 : 0, w: it.w || 0.25 });
      else if (it.k === 'rect') c.r(it.x, it.y, it.w, it.h, { dash: it.dash ? 1 : 0, w: it.lw || 0.25 });
      else if (it.k === 'circle') c.c(it.x, it.y, it.r);
      else if ((it.k === 'encl' || it.k === 'rail' || it.k === 'duct' || it.k === 'cab') && LE.cabinet) LE.cabinet.draw(c, P, pg, A, it);
      else if (it.k === 'flframe') {
        c.r(it.x, it.y, it.w, it.h, { dash: 2, w: 0.3 });
        c.t(it.x + 0.2, it.y + 0.6, (it.fn ? '=' + it.fn : '') + (it.loc ? ' +' + it.loc : ''), DESC, { bold: true });
      }
    });
    c.id = null;
    dots.forEach((q) => c.c(q[0], q[1], 0.13, { fill: 'k' }));
    return c.p;
  }
  function cover(c, P, T) {
    const I = P.info, cx = (T.x0 + T.x0 + T.cols * T.colW) / 2, y = T.y0 + (T.y1 - T.y0) * 0.3;
    c.t(cx, y, I.name || 'Project', 2.0, { a: 'middle', bold: true });
    [I.desc1, I.desc2].forEach((d, i) => d && c.t(cx, y + 2.2 + i * 1.3, d, 0.95, { a: 'middle' }));
    const rows = [['Klant', I.customer], ['Bedrijf', I.company], ['Tekeningnummer', I.drawingNo], ['Getekend door', I.author], ['Datum', I.created], ['Revisie', I.revision]].filter((r) => r[1]);
    rows.forEach((r, i) => { c.t(cx - 0.5, y + 6 + i * 1.1, r[0], 0.6, { a: 'end', color: '#444' }); c.t(cx + 0.5, y + 6 + i * 1.1, r[1], 0.6); });
  }

  /* ---------- tables for graphical lists ---------- */
  function tablePage(P, title, columns, rows, pgInfo) {
    const T = M.tplOf(P), c = new Ctx(T.g);
    const pg = Object.assign({ kind: 'list', title, no: '', index: '', fn: '', loc: '' }, pgInfo || {});
    c.id = '__frame'; frame(c, P, pg, pgInfo.total || P.pages.length, T); c.id = null;
    const x0 = T.x0 + 0.5, x1 = T.x0 + T.cols * T.colW - 0.5, W = x1 - x0, rowH = 0.9, y0 = T.y0 + 1.5;
    const sum = columns.reduce((a, col) => a + col.w, 0);
    let x = x0; const xs = columns.map((col) => { const v = x; x += W * col.w / sum; return v; }); xs.push(x1);
    c.t(x0, y0 - 0.4, title, 0.75, { bold: true });
    c.r(x0, y0, W, rowH, { fill: '#e8e8e8', w: 0.25 });
    columns.forEach((col, i) => c.t(xs[i] + 0.2, y0 + rowH * 0.68, col.h, 0.42, { bold: true }));
    rows.forEach((r, j) => {
      const yy = y0 + rowH * (j + 1);
      if (r.group) { c.r(x0, yy, W, rowH, { fill: '#f3f3f3', w: 0.15 }); c.t(x0 + 0.2, yy + rowH * 0.68, r.group, 0.44, { bold: true }); return; }
      c.l(x0, yy + rowH, x1, yy + rowH, { w: 0.12 });
      columns.forEach((col, i) => {
        let s = String(r[col.k] == null ? '' : r[col.k]); const max = xs[i + 1] - xs[i] - 0.4;
        while (s.length > 1 && tw(s, 0.42) > max) s = s.slice(0, -1);
        c.t(xs[i] + 0.2, yy + rowH * 0.68, s, 0.42);
      });
    });
    const yEnd = y0 + rowH * (rows.length + 1);
    xs.forEach((xx) => c.l(xx, y0, xx, yEnd, { w: 0.15 }));
    c.l(x0, yEnd, x1, yEnd, { w: 0.25 });
    return c.p;
  }
  function rowsPerPage(P) { const T = M.tplOf(P); return Math.floor((T.y1 - T.y0 - 3) / 0.9) - 1; }

  /* ---------- SVG ---------- */
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  function primSvg(p, ink) {
    const dash = p.dash ? ' stroke-dasharray="' + (p.dash === 2 ? '3 1 0.6 1' : '1.2 0.8') + '"' : '';
    const fill = (f) => (f === 'k' ? '#000' : f === 'w' ? '#fff' : f || 'none');
    if (p.t === 'l') return '<line x1="' + f2(p.x1) + '" y1="' + f2(p.y1) + '" x2="' + f2(p.x2) + '" y2="' + f2(p.y2) + '" stroke-width="' + p.w + '"' + dash + '/>';
    if (p.t === 'pl') return '<' + (p.close ? 'polygon' : 'polyline') + ' points="' + p.pts.map((q) => f2(q[0]) + ',' + f2(q[1])).join(' ') + '" fill="' + fill(p.fill) + '" stroke-width="' + p.w + '"' + dash + '/>';
    if (p.t === 'r') return '<rect x="' + f2(p.x) + '" y="' + f2(p.y) + '" width="' + f2(p.w) + '" height="' + f2(p.h) + '" fill="' + fill(p.fill) + '" stroke-width="' + p.lw + '"' + dash + '/>';
    if (p.t === 'c') return '<circle cx="' + f2(p.x) + '" cy="' + f2(p.y) + '" r="' + f2(p.r) + '" fill="' + fill(p.fill) + '" stroke-width="' + p.lw + '"/>';
    if (p.t === 'tx') {
      const anchor = p.a === 'middle' ? 'middle' : p.a === 'end' ? 'end' : 'start';
      const tr = p.rot ? ' transform="rotate(-' + p.rot + ' ' + f2(p.x) + ' ' + f2(p.y) + ')"' : '';
      return '<text x="' + f2(p.x) + '" y="' + f2(p.y) + '" font-size="' + f2(p.size) + '" text-anchor="' + anchor + '" stroke="none" fill="' + (p.color || ink || '#000') + '"' + (p.bold ? ' font-weight="700"' : '') + tr + '>' + esc(p.s) + '</text>';
    }
    return '';
  }
  /* primitives -> SVG markup; items are grouped (<g data-id>) so the editor can select them */
  function body(prims) {
    let out = '', cur = undefined;
    prims.forEach((p) => {
      const id = p.id || null;
      if (id !== cur) { if (cur !== undefined) out += '</g>'; out += id ? '<g data-id="' + esc(id) + '">' : '<g>'; cur = id; }
      out += primSvg(p);
    });
    if (cur !== undefined) out += '</g>';
    return out;
  }
  function svg(P, prims, o) {
    o = o || {};
    const T = M.tplOf(P), W = T.W * T.g, H = T.H * T.g;
    const out = body(prims);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + f2(W) + ' ' + f2(H) + '"' + (o.attrs || '') + '><rect x="0" y="0" width="' + f2(W) + '" height="' + f2(H) + '" fill="#fff" stroke="none"/>' +
      '<g fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" font-family="Helvetica, Arial, sans-serif" style="font-kerning:none">' +
      out + '</g>' + (o.extra || '') + '</svg>';
  }
  /* a small stand-alone picture of one symbol (symbol browser) */
  function preview(id, px) {
    const d = SY.get(id); if (!d) return '';
    const b = SY.bbox(id), pad = 0.4, w = b[2] - b[0] + 2 * pad, h = b[3] - b[1] + 2 * pad, s = Math.max(w, h);
    const c = new Ctx(10), it = { s: id, x: 0, y: 0 };
    drawSymGfx(c, it, d);
    const vb = [(b[0] - pad - (s - w) / 2) * 10, (b[1] - pad - (s - h) / 2) * 10, s * 10, s * 10].map(f2).join(' ');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + (px || 40) + '" height="' + (px || 40) + '"><g fill="none" stroke="currentColor" stroke-width="' + f2(s * 0.45) + '" stroke-linecap="round" font-family="Helvetica, Arial, sans-serif">' +
      c.p.map((p) => primSvg(Object.assign({}, p, p.t === 'l' || p.t === 'pl' ? { w: f2(s * 0.45) } : p.t === 'r' || p.t === 'c' ? { lw: f2(s * 0.45) } : {}), 'currentColor')).join('') + '</g></svg>';
  }

  /* the graphics of a symbol that is not placed yet (the ghost that follows the cursor while placing) */
  function ghost(P, it) { const d = SY.get(it.s); if (!d) return []; const c = new Ctx(M.tplOf(P).g); drawSymGfx(c, it, d); return c.p; }

  return { renderPage, tablePage, rowsPerPage, svg, body, primSvg, preview, ghost, symBox, tw, wrap, Ctx };
})();
if (typeof module !== 'undefined') module.exports = LE;
