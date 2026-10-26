/* LAZY Electrical drawing engine: project description -> list of sheets of drawing primitives.
   Units are millimetres on an A4 landscape sheet (297 x 210). No DOM access: runs in browser and Node. */
var SF = (function () {
  'use strict';
  var PW = 297, PH = 210, FX = 10, CW = 27, FY = 14.5, RH = (182 - 14.5) / 6;
  function X(c) { return FX + CW * c; }
  function Y(r) { return FY + RH * r; }
  function colOf(x) { return Math.max(0, Math.min(9, Math.floor((x - FX) / CW + 1e-6))); }
  var K = 0.6, PS = 3 / CW; // SEE symbols at 60%: 5-unit pole pitch becomes 3 mm

  var PLC = {
    '0BA5': { label: 'LOGO! 24 (0BA5)', order: '6ED1 052-1CC00-0BA5', short: '24', supply: 'DC 24V', ai: 'I7=AI1(0-10V)    I8=AI2(0-10V)', out: 'OUTPUT 4xTRANS./0.3A' },
    '0BA6': { label: 'LOGO! 24 (0BA6)', order: '6ED1 052-1CC00-0BA6', short: '24', supply: 'DC 24V', ai: 'I7=AI1(0-10V)    I8=AI2(0-10V)', out: 'OUTPUT 4xTRANS./0.3A' },
    '24CE': { label: 'LOGO! 24CE (LOGO! 8)', order: '6ED1 052-1CC08-0BA1', short: '24CE', supply: 'DC 24V', ai: 'I1,I2,I7,I8 = AI (0-10V)', out: 'OUTPUT 4xTRANS./0.3A' },
    '24RCE': { label: 'LOGO! 24RCE (LOGO! 8)', order: '6ED1 052-1HB08-0BA1', short: '24RCE', supply: 'AC/DC 24V', ai: '', out: 'OUTPUT 4xRELAY/10A' },
    'none': { label: 'Geen PLC (bedrade schakeling)', order: '', short: '', supply: '', ai: '', out: '' },
    '1224RCE': { label: 'LOGO! 12/24RCE (LOGO! 8)', order: '6ED1 052-1MD08-0BA1', short: '12/24RCE', supply: 'DC 12/24V', ai: 'I1,I2,I7,I8 = AI (0-10V)', out: 'OUTPUT 4xRELAY/10A' }
  };
  var ROLES = { DOL: ['run'], REV: ['right', 'left'], YD: ['main', 'star', 'delta'] };
  var ROLE_NL = { run: '', right: 'RECHTS', left: 'LINKS', main: 'NET', star: 'STER', delta: 'DRIEHOEK' };
  var TYPE_NL = { DOL: 'direct', REV: 'omkeer', YD: 'ster-driehoek' };

  /* ---------- primitives ---------- */
  function tw(s, size) {
    var w = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (/[0-9]/.test(ch)) w += 0.556;
      else if (ch === ' ') w += 0.278;
      else if (/[il.,:;|!'()\/\[\]]/.test(ch)) w += 0.26;
      else if (/[mwMW]/.test(ch)) w += 0.86;
      else if (/[A-Z+]/.test(ch)) w += 0.68;
      else w += 0.53;
    }
    return w * size;
  }
  /* page of primitives; open()/close() put everything drawn in between into one group (a movable symbol in the editor) */
  function Pg() { this.p = []; this.gm = {}; this.dep = 0; this.cur = null; this.n = 0; }
  Pg.prototype.add = function (q) { if (this.cur) q.g = this.cur; this.p.push(q); };
  Pg.prototype.open = function (k) { if (this.dep++ === 0) { this.cur = 'g' + (++this.n); this.gm[this.cur] = { k: k || 'sym' }; } };
  Pg.prototype.close = function () { if (--this.dep === 0) this.cur = null; };
  Pg.prototype.l = function (x1, y1, x2, y2, o) { o = o || {}; this.add({ t: 'l', x1: x1, y1: y1, x2: x2, y2: y2, w: o.w || 0.25, dash: o.dash || 0 }); };
  Pg.prototype.pl = function (pts, o) { o = o || {}; this.add({ t: 'pl', pts: pts, w: o.w || 0.25, close: !!o.close, fill: o.fill || null, dash: o.dash || 0 }); };
  Pg.prototype.r = function (x, y, w, h, o) { o = o || {}; this.add({ t: 'r', x: x, y: y, w: w, h: h, lw: o.w || 0.25, fill: o.fill || null }); };
  Pg.prototype.c = function (x, y, r, o) { o = o || {}; this.add({ t: 'c', x: x, y: y, r: r, lw: o.w || 0.25, fill: o.fill || null }); };
  Pg.prototype.t = function (x, y, s, o) {
    o = o || {}; s = String(s == null ? '' : s); if (!s) return;
    var size = o.size || 2.2, rot = o.rot || 0, a = o.a || 'start', w = tw(s, size), off = 0;
    if (a === 'middle') off = w / 2; else if (a === 'end') off = w;
    var sx = x, sy = y;
    if (rot === 90) sy = y + off; else sx = x - off;
    this.add({ t: 'tx', x: sx, y: sy, s: s, size: size, rot: rot, bold: !!o.bold, a: a, ax: x, ay: y });
  };
  function arc(cx, cy, r, a0, a1, n) {
    n = n || 14; var pts = [];
    for (var i = 0; i <= n; i++) { var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return pts;
  }

  /* ---------- registry: device tags, positions, cross references ---------- */
  function Reg(prev) { this.d = {}; this.prev = prev; this.term = 0; this.pins = {}; }
  Reg.prototype.dev = function (k) { return this.d[k] || (this.d[k] = { tag: '', ref: '', H: [], M: [], V: [] }); };
  Reg.prototype.set = function (k, tag, s, x) {
    this.used = this.used || {};
    var base = tag, n = 0;
    while (this.used[tag] && this.used[tag] !== k) tag = base + '.' + (++n);
    this.used[tag] = k;
    var d = this.dev(k); d.tag = tag; d.ref = s + '.' + colOf(x); return tag;
  };
  Reg.prototype.use = function (k, kind, s, x) { this.dev(k)[kind].push(s + '.' + colOf(x)); };
  Reg.prototype.info = function (k) { return (this.prev && this.prev.d[k]) || { tag: '?', ref: '', H: [], M: [], V: [] }; };
  Reg.prototype.nt = function () { return ++this.term; };
  Reg.prototype.pin = function (k, kind) {
    var c = this.pins[k] || (this.pins[k] = { r: 0, no: 0, nc: 0 });
    if (kind === 'relayNO') { c.r++; return [c.r + '1', c.r + '4']; }
    if (kind === 'relayNC') { c.r++; return [c.r + '1', c.r + '2']; }
    if (kind === 'auxNO') { var a = [['13', '14'], ['43', '44'], ['53', '54']]; return a[Math.min(c.no++, 2)]; }
    var b = [['21', '22'], ['31', '32'], ['61', '62']]; return b[Math.min(c.nc++, 2)];
  };

  /* ---------- small symbols ---------- */
  function dot(g, x, y) { g.c(x, y, 0.45, { fill: 'k' }); }
  function v(g, x, y1, y2) { if (Math.abs(y2 - y1) > 0.01) g.l(x, y1, x, y2); }
  function term(g, x, y, n, noX) {
    g.c(x, y, 0.6, { fill: 'w' });
    if (!noX) g.t(x - 1.3, y + 0.7, 'X', { a: 'end', size: 1.7 });
    g.t(x + 2.3, y - 1.0, n, { rot: 90, size: 1.6 });
  }
  function chev(g, x, y) { g.pl([[x - 1, y - 0.9], [x, y], [x - 1, y + 0.9]]); }
  function bus(g, y, name, lref, rref, x1, x2) {
    x1 = x1 == null ? X(0.2) : x1; x2 = x2 == null ? X(9.45) : x2;
    g.l(x1, y, x2, y); chev(g, x1, y);
    g.t(x1 + 0.7, y - 0.45, name, { size: 1.7 });
    if (lref) g.t(x1 - 1.6, y + 0.65, lref, { a: 'end', size: 1.6 });
    chev(g, x2 + 1, y); g.l(x2, y, x2 + 1, y);
    g.t(x2 - 0.4, y - 0.45, name, { a: 'end', size: 1.7 });
    if (rref) g.t(x2 + 1.9, y + 0.65, rref, { size: 1.6 });
  }
  function arrowDown(g, x, y, name, ref) {
    g.pl([[x - 0.9, y - 1.1], [x, y], [x + 0.9, y - 1.1]]);
    g.t(x + 1.9, y - 2.4, name, { rot: 90, size: 1.7 });
    if (ref) g.t(x + 0.6, y + 1.2, ref, { rot: 90, a: 'end', size: 1.6 });
  }
  function pinTxt(g, x, y, h, p, dx, sz) {
    if (!p) return; dx = dx || 2.5; sz = sz || 1.5;
    g.t(x + dx, y + 0.1, p[0], { rot: 90, a: 'end', size: sz });
    g.t(x + dx, y + h - 0.1, p[1], { rot: 90, size: sz });
  }
  function label(g, x, y, l1, l2, side) {
    var o = side === 'right' ? {} : { a: 'end' };
    var ls = l2 ? wrap(l2, 11) : [];
    var y0 = y - (ls.length > 1 ? 1.1 * (ls.length - 1) : 0);
    g.t(x, y0, l1, Object.assign({ size: 2 }, o));
    ls.forEach(function (t, i) { g.t(x, y0 + 2.3 * (i + 1), t, Object.assign({ size: 1.7 }, o)); });
  }
  /* contact, height 6, wire ends at y (top) and y+6 (bottom) */
  function contact(g, x, y, kind, o) {
    o = o || {};
    var b = y + 6;
    var sk = kind === 'NC' ? (o.act === 'push' ? 'PB_NC' : o.act === 'estop' ? 'ESTOP' : o.act === 'thermal' ? 'TH_NC' : 'NC')
      : kind === 'NO' ? (o.act === 'push' ? 'PB_NO' : o.act ? null : 'NO') : null;
    if (sk && seeAt(g, sk, x, y)) {
      pinTxt(g, x, y, 6, o.pins, kind === 'NC' ? 2.9 : 2.3);
      if (o.l1 || o.l2) label(g, x - (o.act === 'estop' ? 8.6 : o.act ? 7.6 : 3.2), y + 2.6, o.l1, o.l2);
      return;
    }
    if (kind === 'NC') {
      g.l(x, y, x + 2.4, y); g.l(x, b, x + 2.6, y - 0.5);
    } else if (kind === 'th') {
      g.l(x, y, x, y + 1); g.r(x - 0.95, y + 1, 1.9, 4);
      g.pl([[x, y + 1], [x, y + 2.2], [x + 0.55, y + 2.2], [x + 0.55, y + 3.8], [x, y + 3.8], [x, y + 5]]);
      g.l(x, y + 5, x, b);
    } else {
      g.l(x, b, x - 2.2, y + 0.9);
      if (kind === 'brk') { g.l(x - 0.7, y - 0.7, x + 0.7, y + 0.7); g.l(x + 0.7, y - 0.7, x - 0.7, y + 0.7); }
      if (kind === 'NOc') g.pl(arc(x, y + 0.75, 0.75, 90, 270, 8));
    }
    var mid = kind === 'NC' ? [x + 1.25, y + 2.6] : [x - 1.1, y + 3.5];
    if (o.act === 'push') {
      g.l(mid[0], mid[1], x - 5, mid[1], { dash: 1 });
      g.l(x - 5, mid[1] - 1.2, x - 5, mid[1] + 1.2); g.l(x - 5, mid[1] - 1.2, x - 4.3, mid[1] - 1.2); g.l(x - 5, mid[1] + 1.2, x - 4.3, mid[1] + 1.2);
    } else if (o.act === 'estop') {
      g.l(mid[0], mid[1], x - 4.4, mid[1], { dash: 1 });
      g.l(x - 4.4, mid[1] - 1.7, x - 4.4, mid[1] + 1.7);
      g.pl(arc(x - 4.4, mid[1], 1.7, 90, 270, 10));
    } else if (o.act === 'thermal') {
      g.l(mid[0], mid[1], x - 4.2, mid[1], { dash: 1 });
      g.pl([[x - 4.2, mid[1]], [x - 4.2, mid[1] - 1.1], [x - 5.4, mid[1] - 1.1], [x - 5.4, mid[1] + 1.1], [x - 6.6, mid[1] + 1.1]]);
    }
    if (kind !== 'th') pinTxt(g, x, y, 6, o.pins, kind === 'NC' ? 3.6 : 2.5);
    if (o.l1 || o.l2) label(g, x - (o.act ? 7.6 : 3.4), y + 2.6, o.l1, o.l2);
  }
  function poles(g, xs, y, kind, pins, l1, l2, side) {
    var sk = kind === 'brk' ? ['', 'BRK1', 'BRK2', 'BRK3', 'BRK4'][xs.length] : kind === 'NOc' && xs.length === 3 ? 'MAIN3' : kind === 'th' && xs.length === 3 ? 'THR3' : null;
    if (sk && seeAt(g, sk, xs[0], y)) {
      if (side === 'right') label(g, xs[xs.length - 1] + 3, y + 2.6, l1, l2, 'right');
      else label(g, xs[0] - (kind === 'brk' ? 4.4 : 3.2), y + 2.6, l1, l2);
      return;
    }
    xs.forEach(function (x, i) { contact(g, x, y, kind, {}); if (kind === 'th') pinTxt(g, x, y, 6, pins && pins[i], 2.1, 1.25); else pinTxt(g, x, y, 6, pins && pins[i], 2.3, 1.35); });
    if (xs.length > 1 && kind !== 'th') g.l(xs[0] - 1.1, y + 3.5, xs[xs.length - 1] - 1.1, y + 3.5, { dash: 1 });
    if (side === 'right') label(g, xs[xs.length - 1] + 3, y + 2.6, l1, l2, 'right');
    else label(g, xs[0] - 3.4, y + 2.6, l1, l2);
  }
  function wrap(s, n) {
    s = String(s || ''); if (s.length <= n) return [s];
    var cut = s.lastIndexOf(' ', n), hy = s.lastIndexOf('-', n - 1);
    if (hy > cut) cut = hy + 1;
    if (cut < 4) cut = n;
    return [s.slice(0, cut).trim()].concat(wrap(s.slice(cut).trim(), n));
  }
  function coil(g, x, y, tag, d1, d2, sym) {
    if (!see(g, sym || 'COIL', x, y + 3) && !see(g, 'COIL', x, y + 3)) { g.r(x - 3.8, y + 1.2, 7.6, 3.6); g.l(x, y, x, y + 1.2); g.l(x, y + 4.8, x, y + 6); }
    pinTxt(g, x, y - 1.4, 6 + 2.8, ['A1', 'A2'], 2.5);
    var lines = wrap(d1, 11).concat(d2 ? [d2] : []), lx = sym && sym.indexOf('TO') === 0 ? x - 5.4 : x - 4.6;
    var y0 = y + 3.6 - lines.length * 1.15;
    g.t(lx, y0, tag, { a: 'end', size: 2 });
    lines.forEach(function (ln, i) { g.t(lx, y0 + 2.3 * (i + 1), ln, { a: 'end', size: 1.7 }); });
  }
  function xtable(g, x, y, cols, info) {
    var w = 3.8, n = cols.length, x0 = x - n * w / 2, rows = 1;
    cols.forEach(function (c, i) {
      var cx = x0 + w * i + w / 2, list = info[c] || [];
      g.t(cx, y, c, { a: 'middle', size: 1.8, bold: true });
      list.forEach(function (e, j) { g.t(cx, y + 3 + j * 2.2, e, { a: 'middle', size: 1.6 }); });
      rows = Math.max(rows, list.length);
    });
    g.l(x0, y + 0.8, x0 + n * w, y + 0.8);
    for (var i = 1; i < n; i++) g.l(x0 + w * i, y - 2.2, x0 + w * i, y + 2.5 + rows * 2.2);
  }
  function lamp(g, x, y) {
    if (see(g, 'LAMP', x, y + 3, K)) return;
    var r = 2, cy = y + 3;
    g.l(x, y, x, y + 1); g.l(x, y + 5, x, y + 6);
    g.c(x, cy, r); var d = r * 0.707;
    g.l(x - d, cy - d, x + d, cy + d); g.l(x + d, cy - d, x - d, cy + d);
  }
  function buzzer(g, x, y) {
    g.l(x, y, x, y + 6); g.pl(arc(x, y + 3, 2, -90, 90, 12));
  }
  function block(g, xc, y, top, tag, fn, io) {
    if (lib('DI') && lib('DO')) {
      var k = K, ox, oy, tx;  /* same 60% as every other symbol: keeps the pins on the 3 mm grid */
      var fit = function (t) { var w = tw(t, 2.1), room = 35 * k; return w > room ? Math.max(1.2, 2.1 * room / w) : 2.1; };
      if (top === 'DI') { ox = xc + 5 * k; oy = y + 25 * k; see(g, 'DI', ox, oy, k); tx = function (sy, t) { g.t(ox - 22.2 * k, oy - sy * k, t, { size: fit(String(t || '')) }); }; tx(2.1, tag); tx(-17.2, fn); tx(-25.4, io); }
      else { ox = xc + 15 * k; oy = y + 30 * k; see(g, 'DO', ox, oy, k); tx = function (sy, t) { g.t(ox - 32.2 * k, oy - sy * k, t, { size: fit(String(t || '')) }); }; tx(20.8, tag); tx(1.5, fn); tx(-6.7, io); }
      return;
    }
    var x0 = xc - 14, x1 = xc + 14, h = 42;
    g.r(x0, y, 28, h);
    if (top === 'DI') {
      g.t(x0 + 1.8, y + 4.6, 'DI', { size: 2.4 });
      g.t(x0 + 1.8, y + 12.2, tag, { size: 1.9 }); g.l(x0 + 1.5, y + 13, x1 - 1.5, y + 13);
      g.l(x0 + 1.5, y + 19.5, x1 - 1.5, y + 19.5);
      g.t(x0 + 1.8, y + 24.5, fn, { size: 1.9 });
      g.t(x0 + 1.8, y + 30, io, { size: 1.9 }); g.l(x0 + 1.5, y + 30.8, x1 - 1.5, y + 30.8);
    } else {
      g.t(x0 + 1.8, y + 6.2, tag, { size: 1.9 }); g.l(x0 + 1.5, y + 7, x1 - 1.5, y + 7);
      g.l(x0 + 1.5, y + 14, x1 - 1.5, y + 14);
      g.t(x0 + 1.8, y + 19, fn, { size: 1.9 });
      g.t(x0 + 1.8, y + 25, io, { size: 1.9 }); g.l(x0 + 1.5, y + 25.8, x1 - 1.5, y + 25.8);
      g.t(x0 + 1.8, y + 39.6, 'DO', { size: 2.4 });
    }
  }
  function psu(g, x0, y0) {
    g.r(x0, y0, 11, 11); g.l(x0, y0 + 11, x0 + 11, y0);
    g.t(x0 + 0.6, y0 + 3, '230V AC', { size: 1.5 });
    g.t(x0 + 10.4, y0 + 9.6, '24V DC', { a: 'end', size: 1.5 });
  }
  function motor(g, cx, cy, r) {
    g.c(cx, cy, r); g.t(cx, cy - 0.2, 'M', { a: 'middle', size: 2.4 }); g.t(cx, cy + 2.8, '3~', { a: 'middle', size: 2 });
  }
  function screw(g, x, y) { g.c(x, y, 1.1); g.l(x - 0.75, y + 0.75, x + 0.75, y - 0.75); }
  /* optional external symbol library (SEELIB, local only, never committed): units of 5 per 3 mm, y pointing up */
  function lib(key) { return (typeof SEELIB !== 'undefined' && SEELIB[key]) || null; }
  function see(g, key, ox, oy, k, o) {
    var S = lib(key); if (!S) return false;
    o = o || {}; k = k || K;
    var M = function (x, y) { return [ox + x * k, oy - y * k]; };
    S.l.forEach(function (l) { var a = M(l[0], l[1]), b = M(l[2], l[3]); g.l(a[0], a[1], b[0], b[1]); });
    S.p.forEach(function (pts) { g.pl(pts.map(function (q) { return M(q[0], q[1]); })); });
    S.t.forEach(function (t) {
      var txt = o.sub && Object.prototype.hasOwnProperty.call(o.sub, t[0]) ? o.sub[t[0]] : t[0]; if (!txt) return;
      var a = M(t[1], t[2]); g.t(a[0], a[1], txt, { size: t[3] * k * 0.85, rot: t[4], a: t[5] });
    });
    return true;
  }
  /* place a symbol so its first pole's top connection lands on (x, yTop) */
  function seeAt(g, key, x, yTop, k, o) {
    var S = lib(key); if (!S) return false; k = k || K;
    return see(g, key, x - S.x0 * k, yTop + S.yt * k, k, o);
  }

  /* ---------- frame and title block ---------- */
  function frame(g, sh, total, P) {
    g.r(6, 10, 282, 193, { w: 0.35 });
    g.l(10, 10, 10, 182); g.l(X(10), 10, X(10), 203);
    g.l(10, FY, X(10), FY);
    for (var c = 0; c < 10; c++) { if (c) g.l(X(c), 10, X(c), FY); g.t(X(c + 0.5), FY - 1.1, c, { a: 'middle', size: 2 }); }
    for (var r = 0; r < 6; r++) { if (r) g.l(6, Y(r), 10, Y(r)); g.t(8, Y(r + 0.5) + 0.8, 'ABCDEF'[r], { a: 'middle', size: 2 }); }
    g.l(6, 182, 288, 182);
    g.t(285.5, 60, 'Blad volgnummer:  ' + sh.no, { rot: 90, a: 'middle', size: 1.6 });
    g.t(285.5, 112, 'Plotdatum:', { rot: 90, a: 'middle', size: 1.6 });
    g.t(285.5, 158, 'Ontwerp: LAZY Electrical', { rot: 90, a: 'middle', size: 1.4 });
    // title block
    g.l(80, 182, 80, 203); g.l(128, 182, 128, 203); g.l(170, 182, 170, 203);
    g.l(170, 192.5, 288, 192.5);
    g.l(222, 182, 222, 203); g.l(260, 182, 260, 192.5); g.l(247, 192.5, 247, 203); g.l(272, 182, 272, 203); g.l(280, 192.5, 280, 203);
    // brand mark
    g.r(9, 185, 13, 15); g.l(9, 189, 15, 189); g.l(15, 189, 18, 192.5); g.l(9, 196, 15, 196); g.l(15, 196, 18, 192.5); g.l(18, 192.5, 22, 192.5);
    g.t(25, 194.5, 'LAZY Electrical', { size: 4.2, bold: true });
    g.t(25, 198.8, P.school || '', { size: 1.8 });
    g.t(129, 186, sh.title, { size: 2 });
    var F = function (x, y, k, val, w) { g.t(x + 0.8, y + 2.6, k, { size: 1.5 }); g.t(x + w - 1, y + 8.4, val, { a: 'end', size: 2.1 }); };
    F(170, 182, 'Projectnaam:', P.name, 52); F(222, 182, 'Tekeningnr.:', P.nr, 38); F(260, 182, 'Corr.:', '', 12); F(272, 182, 'Tek.:', P.tek, 16);
    F(170, 192.5, 'Datum:', P.date, 52); F(222, 192.5, 'Functie:', P.functie, 25); F(247, 192.5, 'Locatie:', P.locatie, 25);
    g.t(272.8, 195.1, 'Blad:', { size: 1.5 }); g.t(276, 201.6, sh.no, { a: 'middle', size: 2.6 });
    g.t(280.8, 195.1, 'Van :', { size: 1.5 }); g.t(284, 201.6, total, { a: 'middle', size: 2.6 });
  }

  /* ---------- helpers on the project ---------- */
  function parseLoad(s) {
    s = String(s || '');
    if (s.indexOf('M:') === 0) { var p = s.split(':'); return { type: 'M', m: +p[1], role: p[2] }; }
    return { type: s || 'LAMP' };
  }
  function motorPots(k) { var b = (k + 2) + 'L'; return [b + '1', b + '2', b + '3']; }
  function U(s) { return String(s || '').toUpperCase(); }
  function mDesc(P, m, role) {
    var mo = P.motors[m] || { name: 'MOTOR' };
    return (U(mo.name) + ' ' + (ROLE_NL[role] || '')).trim() + ' 230V';
  }
  function interlockOf(P, m, role) {
    var t = (P.motors[m] || {}).type;
    if (t === 'REV') return role === 'right' ? 'left' : role === 'left' ? 'right' : null;
    if (t === 'YD') return role === 'star' ? 'delta' : role === 'delta' ? 'star' : null;
    return null;
  }

  /* ---------- plan: which sheets, what goes where ---------- */
  function plan(P) {
    var sheets = [], n = 1;
    sheets.push({ kind: 'supply', no: n++, title: 'voedingsblad' });
    if (P.plc === 'none') {
      var LG = packRungs(ladderOf(P));
      if (!LG.length) LG = [[]];
      markHomes(LG);
      LG.forEach(function (gr) { sheets.push({ kind: 'ladder', no: n++, title: 'stuurschakeling', pots: ['1L1', '1N'], rungs: gr }); });
      var cur0 = null, xm = 0;
      P.motors.slice(0, 3).forEach(function (m, i) {
        var w = m.type === 'YD' ? 2.3 : m.type === 'REV' ? 2.0 : 1.75;
        if (!cur0 || xm + w > 10.2) { cur0 = { kind: 'power', no: n++, title: 'vermogenblad', items: [] }; sheets.push(cur0); xm = 1.6; }
        cur0.items.push({ k: 'motor', m: i, x: xm }); xm += w;
      });
      sheets.forEach(function (sh2) { if (sh2.kind === 'power') { var pots = []; sh2.items.forEach(function (it) { pots = pots.concat(motorPots(it.m)); }); pots.push('PE'); sh2.pots = pots; } });
      return sheets;
    }
    var ci = [];
    if (P.estop) ci.push({ k: 'estop' });
    if (P.estop) P.motors.forEach(function (m, i) { ci.push({ k: 'safety', m: i }); });
    P.outputs.forEach(function (o, i) {
      var L = parseLoad(o.load);
      if (L.type === 'M' && P.motors[L.m]) ci.push({ k: 'mcoil', o: i, m: L.m, role: L.role });
    });
    var first = P.estop ? [5.0, 5.9, 7.0, 8.0, 9.0] : [5.0, 6.0, 7.0, 8.0, 9.0];
    var cont = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
    var q = ci.slice(), firstSheet = true;
    do {
      var slots = firstSheet ? first : cont;
      var items = q.splice(0, slots.length).map(function (it, j) { it.x = slots[j]; return it; });
      sheets.push({ kind: 'control', no: n++, title: 'stuurschakeling', items: items, logo: firstSheet, pots: ['+24V', '0V', '1L1', '1N'] });
      firstSheet = false;
    } while (q.length);
    var IX = [1.6, 3.35, 5.1, 6.85], OX = [1.75, 3.5, 5.25, 7.1];
    var ins = P.inputs.map(function (v, i) { return { idx: i, n: v.n }; }).sort(function (a, b) { return a.n - b.n; });
    for (var a = 0; a < ins.length; a += 4)
      sheets.push({ kind: 'inputs', no: n++, title: 'ingangen', pots: ['+24V', '0V'], items: ins.slice(a, a + 4).map(function (it, j) { it.x = IX[j]; return it; }) });
    var outs = P.outputs.map(function (v, i) { return { idx: i, n: v.n }; }).sort(function (a, b) { return a.n - b.n; });
    for (var b = 0; b < outs.length; b += 4)
      sheets.push({ kind: 'outputs', no: n++, title: 'uitgangen', pots: ['0V'], items: outs.slice(b, b + 4).map(function (it, j) { it.x = OX[j]; return it; }) });
    var pw = [];
    P.outputs.forEach(function (o, i) { var L = parseLoad(o.load); if (L.type === 'LAMP' || L.type === 'BUZZER') pw.push({ k: 'load', o: i, w: 1.75 }); });
    P.motors.forEach(function (m, i) { pw.push({ k: 'motor', m: i, w: m.type === 'YD' ? 2.3 : m.type === 'REV' ? 2.0 : 1.75 }); });
    var cur = null, x = 0;
    pw.forEach(function (it) {
      if (!cur || x + it.w > 10.2) { cur = { kind: 'power', no: n++, title: 'vermogenblad', items: [] }; sheets.push(cur); x = 1.6; }
      it.x = x; x += it.w; cur.items.push(it);
    });
    sheets.forEach(function (s) {
      if (s.kind !== 'power') return;
      var pots = [], lamps = false;
      s.items.forEach(function (it) { if (it.k === 'motor') pots = pots.concat(motorPots(it.m)); else lamps = true; });
      if (s.items.some(function (it) { return it.k === 'motor'; })) pots.push('PE');
      if (lamps) pots.push('1L1', '1N');
      s.pots = pots;
    });
    return sheets;
  }

  /* ---------- sheet drawers ---------- */
  function drawSupply(g, sh, P, R, C) {
    var names = ['L1', 'L2', 'L3', 'N', 'PE'], by = function (i) { return Y(0) + 4.5 + i * 3; };
    names.forEach(function (nm, i) { bus(g, by(i), nm, '', nm === 'PE' ? C.rref(sh, 'PE') : ''); });
    var mx = function (i) { return X(1.0 + i * PS); };
    var yT = Y(1.0), yB = Y(1.3);
    for (var i = 0; i < 4; i++) { dot(g, mx(i), by(i)); v(g, mx(i), by(i), yT); term(g, mx(i), yT, R.nt(), i > 0); v(g, mx(i), yT, yB); }
    poles(g, [mx(0), mx(1), mx(2), mx(3)], yB, 'brk', [['1', '2'], ['3', '4'], ['5', '6'], ['7', '8']], '1Q1', 'hoofdautomaat ' + (P.mainBreaker || '') + ' /4P');
    var dy = function (i) { return Y(2.0) + i * 3; };
    var br = P.plc === 'none' ? [{ k: 'c230', x: 3.6, taps: [1, 3] }] : [{ k: 'c24', x: 2.0, taps: [0, 3] }, { k: 'c230', x: 3.6, taps: [1, 3] }];
    P.motors.slice(0, 3).forEach(function (m, k) { br.push({ k: 'm', m: k, x: [5.2, 6.6, 8.0][k], taps: [0, 1, 2] }); });
    var ends = [0, 0, 0, 0];
    br.forEach(function (b) { b.taps.forEach(function (t, j) { ends[t] = Math.max(ends[t], X(b.x + j * PS)); }); });
    for (i = 0; i < 4; i++) { v(g, mx(i), yB + 6, dy(i)); if (ends[i] > mx(i)) g.l(mx(i), dy(i), ends[i], dy(i)); }
    var yBr = Y(3.0), yArr = Y(5.3);
    br.forEach(function (b) {
      var xs = b.taps.map(function (t, j) { return X(b.x + j * PS); });
      xs.forEach(function (x, j) { dot(g, x, dy(b.taps[j])); v(g, x, dy(b.taps[j]), yBr); });
      var tag = '1F' + colOf(xs[0] - 2.2);
      if (b.k === 'c24') {
        poles(g, xs, yBr, 'brk', [['1', '2'], ['3', '4']], tag, 'STUUR 24V ' + (P.b24 || '') + ' /2P');
        var py = Y(3.45), px0 = xs[0] - 3, pex = xs[0] + 6, seePsu = !!lib('PSU'), outs, pyb;
        xs.forEach(function (x) { v(g, x, yBr + 6, py); });
        v(g, pex, by(4), py); dot(g, pex, by(4));
        g.open();
        if (seePsu) {
          see(g, 'PSU', xs[0], py + 25 * K); pyb = py + 18; outs = [['+24V', xs[0] + 3], ['0V', xs[0] + 6]];
        } else {
          g.t(xs[0] + 0.6, py - 0.8, 'L', { rot: 90, size: 1.5 }); g.t(xs[1] + 0.6, py - 0.8, 'N', { rot: 90, size: 1.5 }); g.t(pex + 0.6, py - 0.8, 'PE', { rot: 90, size: 1.5 });
          psu(g, px0, py); pyb = py + 11; outs = [['+24V', xs[0]], ['0V', xs[1]]];
        }
        label(g, px0 - 1.2, py + 8, '1T' + colOf(px0), 'VOEDING STUUR 24V');
        g.close();
        var yt = Y(4.3);
        outs.forEach(function (p) {
          v(g, p[1], pyb, yt); term(g, p[1], yt, R.nt(), p[0] === '0V'); v(g, p[1], yt, yArr);
          arrowDown(g, p[1], yArr, p[0], C.rref(sh, p[0]));
        });
      } else if (b.k === 'c230') {
        poles(g, xs, yBr, 'brk', [['1', '2'], ['3', '4']], tag, 'STUUR 230V ' + (P.b230 || '') + ' /2P');
        [['1L1', xs[0]], ['1N', xs[1]]].forEach(function (p) { v(g, p[1], yBr + 6, yArr); arrowDown(g, p[1], yArr, p[0], C.rref(sh, p[0])); });
      } else {
        var mo = P.motors[b.m];
        poles(g, xs, yBr, 'brk', [['1', '2'], ['3', '4'], ['5', '6']], tag, U(mo.name) + ' ' + (mo.breaker || '') + ' /3P');
        motorPots(b.m).forEach(function (pn, j) { v(g, xs[j], yBr + 6, yArr); arrowDown(g, xs[j], yArr, pn, C.rref(sh, pn)); });
      }
    });
  }

  function busesOf(g, sh, C, y0, step) {
    var ys = {};
    sh.pots.forEach(function (p, i) { var y = y0 + i * step; ys[p] = y; bus(g, y, p, C.lref(sh, p), C.rref(sh, p)); });
    return ys;
  }

  function drawLogo(g, x0, y0, P, R, sh, ys) {
    var M = PLC[P.plc] || PLC['0BA5'];
    var LB = lib('LOGO');
    if (LB) {
      var ox = x0 + 0.5, oy = y0 + 90.2 * K;
      see(g, 'LOGO', ox, oy, K, { sub: { 'DC 24V': M.supply, '24': M.short, 'OUTPUT 4xTRANS./0.3A': M.out, '6ED1 052-1CC00-0BA5': P.order || M.order } });
      var lx = ox + LB.pins.Lp[0] * K, mx2 = ox + LB.pins.M[0] * K, ly = oy - LB.pins.Lp[1] * K;
      v(g, lx, ys['+24V'], ly); dot(g, lx, ys['+24V']);
      v(g, mx2, ys['0V'], ly); dot(g, mx2, ys['0V']);
      var t0 = R.set('logo', sh.no + 'K' + colOf(x0), sh.no, x0);
      label(g, x0 - 2, y0 + 27, t0, 'PLC');
      return;
    }
    var W = 46, H = 53;
    g.r(x0, y0, W, H);
    var tl = ['L+', 'M', 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8'];
    tl.forEach(function (t, i) { var x = x0 + 3 + i * 3; screw(g, x, y0 + 2.6); g.t(x, y0 + 5.6, t, { a: 'middle', size: 1.3 }); });
    g.l(x0, y0 + 7, x0 + W, y0 + 7);
    g.t(x0 + 1.5, y0 + 10.5, M.supply + '   ' + M.ai, { size: 1.5 });
    g.l(x0, y0 + 12.5, x0 + W, y0 + 12.5);
    g.t(x0 + 2.5, y0 + 18, 'Siemens', { size: 3 });
    g.r(x0 + 3, y0 + 20, 17, 13);
    g.r(x0 + 27, y0 + 14.5, 15, 4.5);
    var kx = x0 + 34.5, ky = y0 + 26;
    g.pl([[kx - 1.6, ky - 2.6], [kx, ky - 4.4], [kx + 1.6, ky - 2.6]], { close: true });
    g.pl([[kx - 1.6, ky + 2.6], [kx, ky + 4.4], [kx + 1.6, ky + 2.6]], { close: true });
    g.pl([[kx - 2.6, ky - 1.6], [kx - 4.4, ky], [kx - 2.6, ky + 1.6]], { close: true });
    g.pl([[kx + 2.6, ky - 1.6], [kx + 4.4, ky], [kx + 2.6, ky + 1.6]], { close: true });
    g.r(x0 + 27, y0 + 32, 6, 3.4); g.t(x0 + 30, y0 + 34.6, 'ESC', { a: 'middle', size: 1.5, bold: true });
    g.r(x0 + 35, y0 + 32, 6, 3.4); g.t(x0 + 38, y0 + 34.6, 'OK', { a: 'middle', size: 1.5, bold: true });
    g.t(x0 + 1.5, y0 + 38.5, 'LOGO!', { size: 3 });
    g.t(x0 + 15, y0 + 38.5, M.short, { size: 1.8 });
    g.t(x0 + W - 1.2, y0 + 38.3, P.order || M.order, { a: 'end', size: 1.3 });
    g.l(x0, y0 + 40, x0 + W, y0 + 40);
    g.t(x0 + 1.5, y0 + 44, M.out, { size: 1.5 });
    g.r(x0 + 31, y0 + 41.3, 12, 3.6);
    g.l(x0, y0 + 46.3, x0 + W, y0 + 46.3);
    for (var k = 0; k < 4; k++) {
      var qx = x0 + 3.2 + k * 11;
      screw(g, qx, y0 + 48.6); screw(g, qx + 3.4, y0 + 48.6);
      g.t(qx, y0 + 52, 'Q' + (k + 1), { a: 'middle', size: 1.3 }); g.t(qx + 3.4, y0 + 52, 'M', { a: 'middle', size: 1.3 });
    }
    var lx = x0 + 3, mxx = x0 + 6;
    v(g, lx, ys['+24V'], y0 + 1.5); dot(g, lx, ys['+24V']);
    v(g, mxx, ys['0V'], y0 + 1.5); dot(g, mxx, ys['0V']);
    var tag = R.set('logo', sh.no + 'K' + colOf(x0), sh.no, x0);
    label(g, x0 - 2, y0 + 27, tag, 'PLC');
  }

  function drawControl(g, sh, P, R, C) {
    var ys = busesOf(g, sh, C, Y(0) + 4.5, 3), s = sh.no;
    if (sh.logo) drawLogo(g, X(2.2), Y(1.05), P, R, sh, ys);
    var yR = Y(3.95);
    sh.items.forEach(function (it) {
      var x = X(it.x), col = colOf(x - 4);
      if (it.k === 'estop') {
        dot(g, x, ys['+24V']); v(g, x, ys['+24V'], Y(1.0)); term(g, x, Y(1.0), R.nt()); v(g, x, Y(1.0), Y(1.3));
        var stag = R.set('estop', s + 'S' + colOf(x), s, x);
        contact(g, x, Y(1.3), 'NC', { act: 'estop', pins: ['11', '12'], l1: stag, l2: 'NOODSTOP' });
        v(g, x, Y(1.3) + 6, Y(1.8)); term(g, x, Y(1.8), R.nt()); v(g, x, Y(1.8), Y(2.6));
        var ktag = R.set('estopK', s + 'K' + colOf(x), s, x);
        coil(g, x, Y(2.6), ktag, 'NOOD', 'wago 24V');
        var xr = x + 0.25 * CW;
        v(g, x, Y(2.6) + 6, yR); g.l(x, yR, xr, yR); v(g, xr, yR, ys['0V']); dot(g, xr, ys['0V']);
        xtable(g, x, Y(4.55), ['M', 'V'], R.info('estopK'));
        return;
      }
      dot(g, x, ys['1L1']); v(g, x, ys['1L1'], Y(1.9));
      var key, desc, desc2;
      if (it.k === 'safety') {
        var ek = R.info('estopK');
        contact(g, x, Y(1.9), 'NO', { pins: R.pin('estopK', 'relayNO'), l1: ek.tag, l2: ek.ref });
        R.use('estopK', 'M', s, x);
        v(g, x, Y(1.9) + 6, Y(3.0));
        key = 'safety' + it.m; desc = 'NOOD'; desc2 = P.motors.length > 1 ? U(P.motors[it.m].name) : '230V';
      } else {
        var ok = 'out' + it.o, oi = R.info(ok);
        contact(g, x, Y(1.9), 'NO', { pins: R.pin(ok, 'relayNO'), l1: oi.tag, l2: oi.ref });
        R.use(ok, 'M', s, x);
        var il = interlockOf(P, it.m, it.role), yc = Y(1.9) + 6;
        if (il) {
          var ik = 'mc_' + it.m + '_' + il, ii = R.info(ik);
          v(g, x, yc, Y(2.25));
          contact(g, x, Y(2.25), 'NC', { pins: R.pin(ik, 'auxNC'), l1: ii.tag, l2: ii.ref });
          R.use(ik, 'V', s, x); yc = Y(2.25) + 6;
        }
        v(g, x, yc, Y(3.0));
        key = 'mc_' + it.m + '_' + it.role; desc = U((P.motors[it.m] || {}).name || 'MOTOR'); desc2 = (ROLE_NL[it.role] ? ROLE_NL[it.role] + ' ' : '') + '230V';
      }
      var tag = R.set(key, s + 'Q' + colOf(x), s, x);
      coil(g, x, Y(3.0), tag, desc, desc2);
      var xr2 = x + 0.35 * CW;
      v(g, x, Y(3.0) + 6, yR); g.l(x, yR, xr2, yR); v(g, xr2, yR, ys['1N']); dot(g, xr2, ys['1N']);
      xtable(g, x, Y(4.55), ['H', 'M', 'V'], R.info(key));
    });
  }

  function drawInputs(g, sh, P, R, C) {
    var ys = busesOf(g, sh, C, Y(0) + 4.5, 3), s = sh.no, logo = R.info('logo').tag;
    sh.items.forEach(function (it) {
      var inp = P.inputs[it.idx], x = X(it.x), y0 = Y(1.35);
      var k = inp.kind, inPanel = k === 'THERMAL'; /* thermal relay sits in the panel: no X terminals */
      dot(g, x, ys['+24V']); v(g, x, ys['+24V'], Y(1.0)); if (!inPanel) term(g, x, Y(1.0), R.nt()); v(g, x, Y(1.0), y0);
      if (k === 'ESTOP' && P.estop) {
        var e = R.info('estop');
        contact(g, x, y0, 'NC', { act: 'estop', pins: ['21', '22'], l1: e.tag, l2: e.ref }); R.use('estop', 'V', s, x);
      } else if (k === 'THERMAL') {
        var tk = 'therm' + (inp.m || 0), t = R.info(tk);
        contact(g, x, y0, 'NC', { act: 'thermal', pins: ['95', '96'], l1: t.tag, l2: t.ref }); R.use(tk, 'V', s, x);
      } else {
        var tag = R.set('in' + it.idx, s + 'S' + colOf(x), s, x);
        var nc = k === 'NC' || k === 'ESTOP';
        contact(g, x, y0, nc ? 'NC' : 'NO', { act: k === 'ESTOP' ? 'estop' : 'push', pins: nc ? ['21', '22'] : ['13', '14'], l1: tag, l2: U(inp.fn) });
      }
      v(g, x, y0 + 6, Y(1.85)); if (!inPanel) term(g, x, Y(1.85), R.nt()); v(g, x, Y(1.85), Y(2.95) - 3);
      block(g, x, Y(2.95), 'DI', logo, U(inp.fn), 'I' + inp.n);
    });
  }

  function drawOutputs(g, sh, P, R, C) {
    var yb = Y(4.4), s = sh.no, logo = R.info('logo').tag;
    bus(g, yb, '0V', C.lref(sh, '0V'), C.rref(sh, '0V'));
    sh.items.forEach(function (it) {
      var o = P.outputs[it.idx], x = X(it.x), yt = Y(0.5);
      block(g, x, yt, 'DO', logo, o.fn, 'Q' + o.n);
      v(g, x, yt + 39, Y(3.2));
      var tag = R.set('out' + it.idx, s + 'K' + colOf(x), s, x);
      coil(g, x, Y(3.2), tag, U(o.fn), 'wago 24V');
      v(g, x, Y(3.2) + 6, yb); dot(g, x, yb);
      xtable(g, x, yb + 9, ['M', 'V'], R.info('out' + it.idx));
    });
  }

  function drawMotor(g, it, P, R, s, ys) {
    var m = it.m, mo = P.motors[m], x0c = it.x, type = mo.type || 'DOL';
    var px = [0, 1, 2].map(function (i) { return X(x0c + i * PS); });
    var pots = motorPots(m);
    px.forEach(function (x, i) { dot(g, x, ys[pots[i]]); });
    var y = Y(1.3), top = px.map(function (x, i) { return ys[pots[i]]; });
    function down(xs, from, to) { xs.forEach(function (x, i) { v(g, x, Array.isArray(from) ? from[i] : from, to); }); }
    var MAIN = [['1', '2'], ['3', '4'], ['5', '6']];
    function mc(role, xs, yy, side) {
      var k = 'mc_' + m + '_' + role, i = R.info(k); R.use(k, 'H', s, xs[0]);
      poles(g, xs, yy, 'NOc', MAIN, i.tag, i.ref, side);
    }
    if (P.estop && P.plc !== 'none') {
      down(px, top, y);
      var si = R.info('safety' + m); R.use('safety' + m, 'H', s, px[0]);
      poles(g, px, y, 'NOc', MAIN, si.tag, si.ref); top = y + 6;
    }
    var seeMotor = type !== 'YD' && !!lib('MOTOR');
    var pex = type === 'YD' ? X(x0c) + 12 : px[0] + 12;  /* offsets in whole grid steps (3 mm) */
    dot(g, pex, ys.PE);
    var yTerm, thermalAt, cx, cy, r = 4.6, lines;
    if (type === 'REV') {
      var rx = [0, 1, 2].map(function (i) { return X(x0c) + 18 + i * 3; }), yc = Y(2.35);
      var ty = [0, 1, 2].map(function (i) { return Y(1.7) + i * 3; });
      down(px, top, yc);
      rx.forEach(function (x, i) { dot(g, px[i], ty[i]); g.l(px[i], ty[i], x, ty[i]); v(g, x, ty[i], yc); });
      mc('right', px, yc); mc('left', rx, yc, 'right');
      var oy = [0, 1, 2].map(function (i) { return yc + 7.5 + i * 3; });
      rx.forEach(function (x, i) { v(g, x, yc + 6, oy[i]); g.l(x, oy[i], px[2 - i], oy[i]); dot(g, px[2 - i], oy[i]); });
      top = yc + 6; thermalAt = Y(3.3); yTerm = Y(4.1);
    } else if (type === 'YD') {
      down(px, top, Y(2.25)); mc('main', px, Y(2.25)); top = Y(2.25) + 6; thermalAt = Y(3.05); yTerm = Y(4.25);
    } else {
      down(px, top, Y(2.25)); mc('run', px, Y(2.25)); top = Y(2.25) + 6; thermalAt = Y(3.15); yTerm = Y(4.05);
    }
    var therm = mo.thermal !== false, ttag = '';
    if (therm) {
      down(px, top, thermalAt);
      ttag = R.set('therm' + m, s + 'B' + colOf(px[0] - 3), s, px[0] - 3);
      poles(g, px, thermalAt, 'th', MAIN, ttag, '');
      top = thermalAt + 6;
    }
    var termX = px.slice(), termLbl = ['U1', 'V1', 'W1'];
    if (type === 'YD') {
      var qx = [0, 1, 2].map(function (i) { return X(x0c) + 18 + i * 3; });
      var sx = [0, 1, 2].map(function (i) { return X(x0c) + 36 + i * 3; });
      var yd = top + 12;
      [0, 1, 2].forEach(function (j) {
        var tyj = top + 3 + j * 3, k = (j + 2) % 3;
        dot(g, px[j], tyj); g.l(px[j], tyj, qx[k], tyj); v(g, qx[k], tyj, yd);
      });
      mc('delta', qx, yd, 'right');
      var ysT = yd + 18;
      [0, 1, 2].forEach(function (k) {
        var syk = yd + 6 + 3 + k * 3;
        v(g, qx[k], yd + 6, yTerm); dot(g, qx[k], syk); g.l(qx[k], syk, sx[k], syk); v(g, sx[k], syk, ysT);
      });
      mc('star', sx, ysT, 'right');
      sx.forEach(function (x) { v(g, x, ysT + 6, ysT + 7.5); });
      g.l(sx[0], ysT + 7.5, sx[2], ysT + 7.5);
      termX = px.concat(qx); termLbl = ['U1', 'V1', 'W1', 'U2', 'V2', 'W2'];
    }
    down(px, top, yTerm);
    v(g, pex, ys.PE, yTerm);
    var tl = termX.concat([pex]), tlb = termLbl.concat(['PE']);
    tl.forEach(function (x, i) { term(g, x, yTerm, R.nt(), i > 0); g.t(x + 1.7, yTerm + 2.4, tlb[i], { rot: 90, a: 'end', size: 1.4 }); });
    if (seeMotor) {
      var yMt = yTerm + 4;
      px.forEach(function (x) { v(g, x, yTerm, yMt); });
      v(g, pex, yTerm, yMt - 1.5); g.l(pex, yMt - 1.5, px[0] + 9, yMt - 1.5); v(g, px[0] + 9, yMt - 1.5, yMt);
      g.open();
      see(g, 'MOTOR', px[0] + 3, yMt + 6, K);
      cx = px[0] + 3; cy = yMt + 6; r = 4.5;
      label(g, cx - r - 2, cy - 0.5, s + 'M' + colOf(px[0] - 3), U(mo.name));
      g.close();
      if (therm) xtable(g, cx, cy + r + 4.5, ['M', 'V'], R.info('therm' + m));
      return;
    }
    cx = type === 'YD' ? pex : px[1]; cy = yTerm + 11.5; r = type === 'YD' ? 5 : 4.6;
    var angs = type === 'YD' ? [-165, -145, -120, -60, -35, -15] : [-130, -90, -50];
    var yk = cy - r - 2.6;
    termX.forEach(function (x) { v(g, x, yTerm, yk); });
    v(g, pex, yTerm, yk);
    g.open();
    termX.forEach(function (x, i) { var a = angs[i] * Math.PI / 180; g.l(x, yk, cx + r * Math.cos(a), cy + r * Math.sin(a)); });
    if (type === 'YD') g.l(pex, yk, pex, cy - r);
    else { g.l(pex, yk, pex, cy); g.l(pex, cy, cx + r, cy); }
    motor(g, cx, cy, r);
    label(g, cx - r - 2, cy - 0.5, s + 'M' + colOf(px[0] - 3), U(mo.name)); g.close();
    if (therm) xtable(g, cx, cy + r + 4.5, ['M', 'V'], R.info('therm' + m));
  }

  function drawPower(g, sh, P, R, C) {
    var ys = busesOf(g, sh, C, Y(0) + 4, 3.0), s = sh.no;
    sh.items.forEach(function (it) {
      if (it.k === 'motor') { drawMotor(g, it, P, R, s, ys); return; }
      var o = P.outputs[it.o], x = X(it.x), L = parseLoad(o.load), ok = 'out' + it.o, oi = R.info(ok);
      dot(g, x, ys['1L1']); v(g, x, ys['1L1'], Y(1.85));
      contact(g, x, Y(1.85), 'NO', { pins: R.pin(ok, 'relayNO'), l1: oi.tag, l2: oi.ref }); R.use(ok, 'M', s, x);
      v(g, x, Y(1.85) + 6, Y(3.3)); term(g, x, Y(3.3), R.nt()); v(g, x, Y(3.3), Y(3.5));
      var tag = R.set('load' + it.o, s + 'P' + colOf(x), s, x);
      g.open();
      if (L.type === 'BUZZER') buzzer(g, x, Y(3.5)); else lamp(g, x, Y(3.5));
      if (L.type === 'BUZZER' || !lib('LAMP')) { g.t(x + 2.4, Y(3.5) + 0.2, '1', { rot: 90, a: 'end', size: 1.4 }); g.t(x + 2.4, Y(3.5) + 6.2, '2', { rot: 90, size: 1.4 }); }
      var ll = wrap(o.fn, 18); g.t(x - 3, Y(3.5) + 1.6, tag, { a: 'end', size: 2 });
      ll.forEach(function (t, i) { g.t(x - 3, Y(3.5) + 3.9 + i * 2.2, t, { a: 'end', size: 1.7 }); });
      g.close();
      var yR = Y(4.35), xr = x + 0.4 * CW;
      v(g, x, Y(3.5) + 6, Y(4.0)); term(g, x, Y(4.0), R.nt()); v(g, x, Y(4.0), yR);
      g.l(x, yR, xr, yR); v(g, xr, yR, ys['1N']); dot(g, xr, ys['1N']);
    });
  }


  /* hardwired contactor control (no PLC): stop/start with self-holding, interlocks, signal lamps */
  function hwOf(P) {
    var mo = P.motors[0] || {}, roles = mo.type === 'REV' ? ['right', 'left'] : ['run'];
    var NL = { run: 'START', right: 'START RECHTS', left: 'START LINKS' };
    var h = P.hw || {}, starts = {};
    var clean = function (a) { return (Array.isArray(a) ? a : []).map(function (t) { return String(t || '').trim(); }).filter(Boolean).slice(0, 3); };
    roles.forEach(function (r) { var l = clean(h.starts && h.starts[r]).slice(0, roles.length > 1 ? 2 : 3); starts[r] = l.length ? l : [NL[r]]; });
    var stops = clean(h.stops);
    var H = { roles: roles, starts: starts, stops: stops.length ? stops : ['STOP'], lamps: h.lamps !== false };
    var w = 2.6;
    roles.forEach(function (r) { w += (starts[r].length + 1) * HW_PITCH + 0.75; });
    var nl = roles.length + (mo.thermal !== false ? 1 : 0);
    H.lampSheet = H.lamps && w + 0.2 + nl * 1.0 > 9.6;
    return H;
  }
  var HW_PITCH = 0.8;
  /* hardwired contactor control (no PLC): stop buttons in series, start buttons in parallel with a holding contact,
     interlocks for reversing, signal lamps */
  function drawHardwired(g, sh, P, R, C) {
    var s = sh.no, mo = P.motors[0];
    var y1 = Y(0) + 4.5;
    bus(g, y1, '1L1', C.lref(sh, '1L1'), C.rref(sh, '1L1'));
    if (!mo || mo.type === 'YD') {
      bus(g, Y(4.5), '1N', C.lref(sh, '1N'), C.rref(sh, '1N'));
      g.t(X(1), Y(2), mo ? 'Ster-driehoek zonder PLC: nog niet ondersteund.' : 'Geen motor ingegeven.', { size: 3 }); return;
    }
    var H = hwOf(P), roles = H.roles, therm = mo.thermal !== false, rev = roles.length > 1;
    var nOther = function (i) { return rev ? H.starts[roles[1 - i]].length : 0; };
    function heights(ts, gp) {
      var blk = ts + gp + 6 + ts;
      var chain = (therm ? 6 : 0) + (P.estop ? blk : 0) + 2 + H.stops.length * blk + (H.stops.length - 1) + 2;
      var br = Math.max.apply(null, roles.map(function (r, i) { return 2 + blk + 2 + (rev ? nOther(i) * blk + gp + 6 : 0); }));
      return chain + br;
    }
    var TS = 3, GP = 3;
    if (Y(0.55) + heights(TS, GP) + 4 > 150) { TS = 2.2; GP = 2.2; }
    var yCoil = Math.max(Y(3.97), Y(0.55) + heights(TS, GP) + 4), yN = yCoil + 11;
    bus(g, yN, '1N', C.lref(sh, '1N'), C.rref(sh, '1N'));
    var cy;
    function T(x) { v(g, x, cy, cy + TS); term(g, x, cy + TS, R.nt()); cy += TS; }
    function gap(x, d) { v(g, x, cy, cy + d); cy += d; }
    function button(x, kind, key, pins, name) {
      T(x); gap(x, GP);
      var t = key ? R.set(key, s + 'S' + colOf(x), s, x) : null;
      contact(g, x, cy, kind, { act: 'push', pins: pins, l1: t || name.l1, l2: t ? name : name.l2 }); cy += 6; T(x);
    }
    var x0 = X(0.85), x1 = X(1.7);
    dot(g, x0, y1); cy = y1; gap(x0, Y(0.55) - y1);
    if (therm) { var ti = R.info('therm0'); contact(g, x0, cy, 'NC', { act: 'thermal', pins: ['95', '96'], l1: ti.tag, l2: ti.ref }); R.use('therm0', 'V', s, x0); cy += 6; }
    if (P.estop) {
      T(x0); gap(x0, GP);
      var et = R.set('estop', s + 'S' + colOf(x0), s, x0);
      contact(g, x0, cy, 'NC', { act: 'estop', pins: ['11', '12'], l1: et, l2: 'NOODSTOP' }); cy += 6; T(x0);
    }
    gap(x0, 2); g.l(x0, cy, x1, cy);
    H.stops.forEach(function (nm, k) { if (k) gap(x1, 1); button(x1, 'NC', 'stop_' + k, ['21', '22'], U(nm)); });
    gap(x1, 2);
    var yn = cy, P55 = HW_PITCH * CW, bxs = [], bx = X(2.6);
    roles.forEach(function (r) { bxs.push(bx); bx += (H.starts[r].length + 1) * P55 + 0.75 * CW; });
    g.l(x1, yn, bxs[bxs.length - 1], yn);
    bxs.forEach(function (x, i) { if (i < bxs.length - 1) dot(g, x, yn); });
    roles.forEach(function (role, i) {
      var bx = bxs[i], list = H.starts[role], key = 'mc_0_' + role;
      var sx = list.map(function (_, j) { return bx + j * P55; }), hx = bx + list.length * P55;
      cy = yn; gap(bx, 2); var ya = cy;
      dot(g, bx, ya); g.l(bx, ya, hx, ya);
      sx.forEach(function (x, j) { if (j) dot(g, x, ya); });
      var yb;
      sx.forEach(function (x, j) { cy = ya; button(x, 'NO', 'start_' + role + '_' + j, ['13', '14'], U(list[j])); gap(x, 2); yb = cy; });
      sx.forEach(function (x, j) { if (j) dot(g, x, yb); });
      dot(g, bx, yb);
      var hy = ya + (yb - ya - 6) / 2, ki = R.info(key);
      v(g, hx, ya, hy); contact(g, hx, hy, 'NO', { pins: R.pin(key, 'auxNO') }); R.use(key, 'M', s, hx);
      label(g, hx + 3.6, hy + 2.6, ki.tag, ki.ref, 'right');
      v(g, hx, hy + 6, yb); g.l(hx, yb, bx, yb);
      cy = yb;
      if (rev) {
        var other = roles[1 - i], ck = 'mc_0_' + other, ci2 = R.info(ck);
        H.starts[other].forEach(function (_, j) { var oi = R.info('start_' + other + '_' + j); button(bx, 'NC', null, ['21', '22'], { l1: oi.tag, l2: oi.ref }); });
        gap(bx, GP);
        contact(g, bx, cy, 'NC', { pins: R.pin(ck, 'auxNC'), l1: ci2.tag, l2: ci2.ref }); R.use(ck, 'V', s, bx); cy += 6;
      }
      gap(bx, yCoil - cy);
      var tag = R.set(key, s + 'Q' + colOf(bx), s, bx);
      coil(g, bx, yCoil, tag, U(mo.name), (ROLE_NL[role] ? ROLE_NL[role] + ' ' : '') + '230V');
      v(g, bx, yCoil + 6, yN); dot(g, bx, yN);
      xtable(g, bx, yN + 8, ['H', 'M', 'V'], R.info(key));
    });
    if (!H.lamps || H.lampSheet) return;
    var last = bxs[bxs.length - 1] + (H.starts[roles[roles.length - 1]].length) * P55;
    hwLamps(g, s, P, R, H, y1, yN, Math.max(X(6.3), last + 0.95 * CW));
  }
  function hwLamps(g, s, P, R, H, y1, yN, lx0) {
    var mo = P.motors[0], therm = mo.thermal !== false;
    var lamps = H.roles.map(function (r) { return { k: 'mc_0_' + r, fn: 'lamp ' + (r === 'run' ? 'motor aan' : r === 'right' ? 'rechts' : 'links') }; });
    if (therm) lamps.push({ k: 'therm0', fn: 'lamp storing thermisch', th: true });
    var step = Math.min(CW, (X(9.3) - lx0) / Math.max(1, lamps.length - 1));
    lamps.forEach(function (L, i) {
      var x = lx0 + i * step, li = R.info(L.k);
      dot(g, x, y1); v(g, x, y1, Y(1.9));
      if (L.th) { contact(g, x, Y(1.9), 'NO', { act: 'thermal', pins: ['97', '98'], l1: li.tag, l2: li.ref }); R.use(L.k, 'M', s, x); }
      else { contact(g, x, Y(1.9), 'NO', { pins: R.pin(L.k, 'auxNO'), l1: li.tag, l2: li.ref }); R.use(L.k, 'M', s, x); }
      v(g, x, Y(1.9) + 6, Y(2.9)); term(g, x, Y(2.9), R.nt()); v(g, x, Y(2.9), Y(3.15));
      var tag = R.set('hl' + i, s + 'P' + colOf(x), s, x);
      lamp(g, x, Y(3.15));
      g.t(x - 3, Y(3.15) + 1.6, tag, { a: 'end', size: 2 });
      wrap(L.fn, 12).forEach(function (t, j) { g.t(x - 3, Y(3.15) + 3.9 + j * 2.2, t, { a: 'end', size: 1.7 }); });
      v(g, x, Y(3.15) + 6, Y(3.6)); term(g, x, Y(3.6), R.nt()); v(g, x, Y(3.6), yN); dot(g, x, yN);
    });
  }
  function drawHwLampSheet(g, sh, P, R, C) {
    var y1 = Y(0) + 4.5, yN = Y(4.5);
    bus(g, y1, '1L1', C.lref(sh, '1L1'), C.rref(sh, '1L1'));
    bus(g, yN, '1N', C.lref(sh, '1N'), C.rref(sh, '1N'));
    hwLamps(g, sh.no, P, R, hwOf(P), y1, yN, X(1.6));
  }


  /* ---------- ladder: hardwired control circuits described as rungs ----------
     rung = series list of elements; element = contact {t:'NO'|'NC', kind, dev, name, m}
     | {par:[[...],[...]]} | output {coil|lamp|buzzer: id, ...}. A par whose branches all end in an
     output is a split (no rejoin) and must be the last element of its list. */
  var LPITCH = 0.85, FIELD = { push: 1, estop: 1, limit: 1, 'switch': 1, sensor: 1 };
  function isOut(el) { return !!(el && (el.coil || el.lamp || el.buzzer)); }
  function endsOut(seq) { var l = seq && seq[seq.length - 1]; return isOut(l) || !!(l && l.par && l.par.length && l.par.every(endsOut)); }
  function cHeight(el, S) { return FIELD[el.kind] ? 2 * S.ts + S.gp + 6 : S.gp + 6; }
  function meas(seq, S) {
    var w = 1, h = 0;
    (seq || []).forEach(function (el) {
      if (el.par) {
        var bw = 0, bh = 0;
        el.par.forEach(function (b) { var m = meas(b, S); bw += m.w; bh = Math.max(bh, m.h); });
        w = Math.max(w, bw); h += (endsOut([el]) ? 2 : 4 + (S.gp ? 0 : 3)) + bh;
      } else if (!isOut(el)) h += cHeight(el, S);
    });
    return { w: w, h: h };
  }
  function ladderFromHw(P) {
    var mo = P.motors[0]; if (!mo || mo.type === 'YD') return { rungs: [] };
    var H = hwOf(P), rungs = [], therm = mo.thermal !== false, head = [];
    if (therm) head.push({ t: 'NC', kind: 'thermal', m: 0 });
    if (P.estop) head.push({ t: 'NC', kind: 'estop', dev: 'NS', name: 'NOODSTOP' });
    H.stops.forEach(function (n, i) { head.push({ t: 'NC', kind: 'push', dev: 'STOP' + i, name: n }); });
    var cid = function (r) { return 'KM_' + r; };
    var branch = function (r) {
      var b = [{ par: H.starts[r].map(function (n, j) { return [{ t: 'NO', kind: 'push', dev: 'ST_' + r + j, name: n }]; }).concat([[{ t: 'NO', kind: 'aux', dev: cid(r) }]]) }];
      if (H.roles.length > 1) {
        var o = r === 'right' ? 'left' : 'right';
        H.starts[o].forEach(function (n, j) { b.push({ t: 'NC', kind: 'push', dev: 'ST_' + o + j, name: n }); });
        b.push({ t: 'NC', kind: 'aux', dev: cid(o) });
      }
      b.push({ coil: cid(r), type: 'contactor', name: mo.name, drives: '0:' + r });
      return b;
    };
    if (H.roles.length === 1) rungs.push(head.concat(branch('run')));
    else rungs.push(head.concat([{ par: [branch('right'), branch('left')] }]));
    if (H.lamps) {
      H.roles.forEach(function (r) { rungs.push([{ t: 'NO', kind: 'aux', dev: cid(r) }, { lamp: 'H_' + r, name: 'lamp ' + (r === 'run' ? 'motor aan' : r === 'right' ? 'rechts' : 'links') }]); });
      if (therm) rungs.push([{ t: 'NO', kind: 'thermal', m: 0 }, { lamp: 'H_th', name: 'lamp storing thermisch' }]);
    }
    return { rungs: rungs };
  }
  /* rungs that start with the same contacts share them: one common chain, then a split */
  function sameContact(a, b) {
    return !!(a && b && !a.par && !b.par && !isOut(a) && !isOut(b) && a.t === b.t && a.kind === b.kind &&
      String(a.dev || '') === String(b.dev || '') && (+a.m || 0) === (+b.m || 0));
  }
  function mergePrefixes(rungs) {
    var out = [], used = rungs.map(function () { return false; });
    rungs.forEach(function (r, i) {
      if (used[i]) return;
      var grp = [i];
      for (var j = i + 1; j < rungs.length; j++) if (!used[j] && r.length > 1 && rungs[j].length > 1 && sameContact(r[0], rungs[j][0])) grp.push(j);
      if (grp.length === 1) { out.push(r); return; }
      var n = 0;
      while (grp.every(function (k) { return rungs[k].length > n + 1 && sameContact(rungs[k][n], r[n]); })) n++;
      grp.forEach(function (k) { used[k] = true; });
      var rests = mergePrefixes(grp.map(function (k) { return rungs[k].slice(n); }));
      var prefix = r.slice(0, n).map(function (el, idx) {
        var named = grp.map(function (k) { return rungs[k][idx]; }).filter(function (e) { return e.name; })[0];
        return named && !el.name ? Object.assign({}, el, { name: named.name }) : el;
      });
      out.push(rests.length === 1 ? prefix.concat(rests[0]) : prefix.concat([{ par: rests }]));
    });
    return out;
  }
  function ladderOf(P) {
    var L = P.ladder;
    if (L && Array.isArray(L.rungs) && L.rungs.length) {
      var clean = function (seq) {
        return (Array.isArray(seq) ? seq : []).filter(function (el) { return el && typeof el === 'object'; }).map(function (el) {
          if (el.par) { var c = {}; for (var k in el) c[k] = el[k]; c.par = (Array.isArray(el.par) ? el.par : []).map(clean).filter(function (b) { return b.length; }); return c; }
          return el;
        });
      };
      return { rungs: mergePrefixes(L.rungs.map(clean).filter(function (r) { return r.length; })), custom: true };
    }
    return ladderFromHw(P);
  }
  function coilIndex(rungs) {
    var coils = {}, outs = [];
    rungs.forEach(function walkR(seq) { (seq || []).forEach(function (el) { if (el && el.par) el.par.forEach(walkR); else if (isOut(el)) outs.push(el); }); });
    outs.forEach(function (el) { if (el.coil) coils[el.coil] = el; });
    return { coils: coils, outs: outs };
  }
  function checkLadder(P, L) {
    var err = [], warn = [], ci = coilIndex(L.rungs), seenCoil = {};
    ci.outs.forEach(function (el) { if (el.coil) { if (seenCoil[el.coil]) err.push('Spoel ' + el.coil + ' komt twee keer voor als uitgang.'); seenCoil[el.coil] = 1; } });
    var types = ['contactor', 'relay', 'timer_on', 'timer_off'];
    ci.outs.forEach(function (el) {
      if (el.coil && el.type && types.indexOf(el.type) < 0) err.push('Spoel ' + el.coil + ': onbekend type "' + el.type + '" (kies contactor, relay, timer_on of timer_off).');
      if (el.drives) {
        var p = String(el.drives).split(':'), mo = P.motors[+p[0]];
        if (!mo) err.push('Spoel ' + el.coil + ' stuurt motor ' + p[0] + ', maar die motor bestaat niet.');
        else if ((ROLES[mo.type] || []).indexOf(p[1]) < 0) err.push('Spoel ' + el.coil + ': rol "' + p[1] + '" bestaat niet voor motortype ' + mo.type + ' (rollen: ' + (ROLES[mo.type] || []).join(', ') + ').');
      }
    });
    L.rungs.forEach(function (r, i) {
      var nr = 'Sport ' + (i + 1);
      if (!Array.isArray(r) || !r.length) { err.push(nr + ' is leeg.'); return; }
      if (!endsOut(r)) err.push(nr + ' eindigt niet op een spoel, lamp of zoemer.');
      (function walk(seq, top) {
        seq.forEach(function (el, j) {
          if (!el || typeof el !== 'object') { err.push(nr + ': ongeldig element.'); return; }
          if (isOut(el) && j !== seq.length - 1) err.push(nr + ': een uitgang (' + (el.coil || el.lamp || el.buzzer) + ') moet het laatste element van zijn tak zijn.');
          if (el.par) {
            if (!Array.isArray(el.par) || el.par.length < 2) err.push(nr + ': een parallelle groep heeft minstens 2 takken nodig.');
            else {
              var outsN = el.par.filter(endsOut).length;
              if (outsN && outsN !== el.par.length) err.push(nr + ': in een parallelle groep eindigen ofwel alle takken op een uitgang, ofwel geen enkele.');
              if (outsN && j !== seq.length - 1) err.push(nr + ': een splitsing naar meerdere uitgangen moet het laatste element zijn.');
              el.par.forEach(function (b) { if (!Array.isArray(b) || !b.length) err.push(nr + ': lege tak in een parallelle groep.'); else walk(b); });
            }
          } else if (!isOut(el)) {
            if (el.t !== 'NO' && el.t !== 'NC') err.push(nr + ': contact zonder "t" (NO of NC).');
            var k = el.kind;
            if (['push', 'estop', 'limit', 'switch', 'sensor', 'aux', 'timer', 'thermal'].indexOf(k) < 0) err.push(nr + ': onbekend soort contact "' + k + '".');
            if ((k === 'aux' || k === 'timer') && !ci.coils[el.dev]) err.push(nr + ': contact verwijst naar spoel "' + el.dev + '", maar die spoel bestaat niet.');
            if (k === 'timer' && ci.coils[el.dev] && String(ci.coils[el.dev].type || '').indexOf('timer') !== 0) err.push(nr + ': tijdcontact van ' + el.dev + ', maar dat is geen tijdrelais.');
            if (k === 'thermal' && (!P.motors[+el.m || 0] || P.motors[+el.m || 0].thermal === false)) err.push(nr + ': thermisch contact van motor ' + (+el.m || 0) + ', maar die motor heeft geen thermisch relais.');
            if (FIELD[k] && !el.dev) err.push(nr + ': drukknop of schakelaar zonder "dev".');
          }
        });
      })(r, true);
      if (meas(r, { ts: 3, gp: 0 }).w * LPITCH > 8.7) err.push(nr + ' is te breed voor één blad (te veel parallelle takken).');
      if (meas(r, { ts: 3, gp: 0 }).h > 128) err.push(nr + ' is te lang voor één blad (te veel contacten in serie).');
    });
    var cnt = {}, isNO = {};
    (function walk(seq) { (seq || []).forEach(function (el) {
      if (!el || typeof el !== 'object') return;
      if (el.par) { el.par.forEach(walk); return; }
      if (isOut(el)) return;
      if (el.t === 'NO' && el.dev) isNO[el.dev] = 1;
      if (el.t !== 'NC') return;
      var key = el.kind === 'thermal' ? 'thermisch contact van motor ' + ((+el.m || 0) + 1) : (el.kind === 'estop' || el.kind === 'push') && el.dev ? el.dev : null;
      if (key) cnt[key] = (cnt[key] || { n: 0, el: el }), cnt[key].n++;
    }); })(L.rungs.reduce(function (a, r) { return a.concat(r); }, []));
    Object.keys(cnt).forEach(function (k) {
      var c = cnt[k];
      if (c.n > 1 && !(c.el.kind === 'push' && isNO[k])) err.push('Beveiliging "' + (c.el.name || k) + '" staat ' + c.n + ' keer in de stuurkring. Zet noodstop, stopknoppen en thermische contacten één keer in een gemeenschappelijke keten en splits daarna naar de spoelen.');
    });
    P.motors.forEach(function (mo, m) {
      (ROLES[mo.type] || []).forEach(function (r) {
        if (!ci.outs.some(function (el) { return el.drives === m + ':' + r; })) warn.push((mo.name || 'Motor ' + (m + 1)) + (ROLE_NL[r] ? ' (' + ROLE_NL[r].toLowerCase() + ')' : '') + ': geen spoel in de stuurkring stuurt deze contactor.');
      });
    });
    return { errors: err, warnings: warn };
  }
  function markHomes(groups) {
    var home = {}, all = [];
    groups.forEach(function (gr) { gr.forEach(function (o) {
      (function walk(seq) { (seq || []).forEach(function (el) {
        if (el.par) el.par.forEach(walk);
        else if (!isOut(el) && FIELD[el.kind] && el.dev) {
          all.push(el);
          var h = home[el.dev];
          if (!h || (h.t !== 'NO' && el.t === 'NO')) home[el.dev] = el;
        }
      }); })(o.r);
    }); });
    all.forEach(function (el) { Object.defineProperty(el, '_home', { value: home[el.dev] === el, configurable: true, writable: true, enumerable: false }); });
  }
  function packRungs(L) {
    var groups = [], cur = null, x = 0, S = { ts: 3, gp: 0 };
    L.rungs.forEach(function (r) {
      var w = meas(r, S).w;
      if (!cur || x + (w - 1) * LPITCH > 9.3) { cur = []; groups.push(cur); x = 1.0; }
      cur.push({ r: r, x: x }); x += w * LPITCH + 0.25;
    });
    return groups;
  }
  function drawLadderSheet(g, sh, P, R, C) {
    var s = sh.no, y1 = Y(0) + 4.5, rungs = sh.rungs.map(function (o) { return o.r; });
    var S = { ts: 3, gp: 3 }, need = function () { return Math.max.apply(null, rungs.map(function (r) { return meas(r, S).h; }).concat([0])); };
    var coilY = Math.max(Y(3.6), y1 + 3 + need() + 4);
    if (coilY > 150) { S = { ts: 3, gp: 0 }; coilY = Math.max(Y(3.6), y1 + 3 + need() + 4); }
    coilY = Math.min(coilY, 152);
    var yN = coilY + 11;
    bus(g, y1, '1L1', C.lref(sh, '1L1'), C.rref(sh, '1L1'));
    bus(g, yN, '1N', C.lref(sh, '1N'), C.rref(sh, '1N'));
    var ci = coilIndex(ladderOf(P).rungs), keyOf = {};
    Object.keys(ci.coils).forEach(function (id) { var c = ci.coils[id]; keyOf[id] = c.drives ? 'mc_' + String(c.drives).replace(':', '_') : 'coil_' + id; });
    var blk = R.blk || (R.blk = {}), tblk = R.tblk || (R.tblk = {});
    function devKey(el) { return 'dev_' + el.dev; }
    function contactEl(el, x, y) {
      var k = el.kind || 'aux', nc = el.t === 'NC', cy = y, field = FIELD[k];
      if (field) { v(g, x, cy, cy + S.ts); term(g, x, cy + S.ts, R.nt()); cy += S.ts; }
      v(g, x, cy, cy + S.gp); cy += S.gp;
      g.open();
      var l1, l2, pins, sym = null, lx = 3.2;
      if (field) {
        var dk = devKey(el), first = el._home === true;
        if (first) { l1 = R.set(dk, s + ((k === 'limit' || k === 'sensor') ? 'B' : 'S') + colOf(x), s, x); l2 = U(el.name || ''); }
        else { var di = R.info(dk); l1 = di.tag; l2 = di.ref; }
        var n = blk[dk] = (blk[dk] || 0) + 1;
        pins = nc ? [n + '1', n + '2'] : [n + '3', n + '4'];
        if (k === 'limit') { sym = nc ? 'LIM_NC' : 'LIM_NO'; lx = 8.2; }
        else if (k === 'switch' && !nc) { sym = 'SW_NO'; lx = 7.6; }
        if (sym && seeAt(g, sym, x, cy)) { pinTxt(g, x, cy, 6, pins, nc ? 2.9 : 2.3); label(g, x - lx, cy + 2.6, l1, l2); }
        else contact(g, x, cy, nc ? 'NC' : 'NO', { act: k === 'estop' ? 'estop' : (k === 'push' ? 'push' : null), pins: pins, l1: l1, l2: l2 });
      } else if (k === 'aux' || k === 'timer') {
        var ck = keyOf[el.dev] || ('coil_' + el.dev), ci2 = R.info(ck), cd = ci.coils[el.dev] || {};
        R.use(ck, nc ? 'V' : 'M', s, x);
        if (k === 'timer') {
          var tn = tblk[ck] = (tblk[ck] || 0) + 1;
          pins = nc ? [tn + '5', tn + '6'] : [tn + '5', tn + '8'];
          sym = nc ? 'T_NC' : (cd.type === 'timer_off' ? 'TOF_NO' : 'TON_NO');
          lx = nc ? 3.4 : (cd.type === 'timer_off' ? 6.2 : 5);
          if (seeAt(g, sym, x, cy)) { pinTxt(g, x, cy, 6, pins, nc ? 2.9 : 2.3); label(g, x - lx, cy + 2.6, ci2.tag, ci2.ref); }
          else contact(g, x, cy, nc ? 'NC' : 'NO', { pins: pins, l1: ci2.tag, l2: ci2.ref });
        } else {
          pins = R.pin(ck, cd.type === 'relay' ? (nc ? 'relayNC' : 'relayNO') : (nc ? 'auxNC' : 'auxNO'));
          contact(g, x, cy, nc ? 'NC' : 'NO', { pins: pins, l1: ci2.tag, l2: ci2.ref });
        }
      } else if (k === 'thermal') {
        var tk = 'therm' + (+el.m || 0), ti = R.info(tk);
        R.use(tk, nc ? 'V' : 'M', s, x);
        contact(g, x, cy, nc ? 'NC' : 'NO', { act: 'thermal', pins: nc ? ['95', '96'] : ['97', '98'], l1: ti.tag, l2: ti.ref });
      }
      g.close();
      cy += 6;
      if (field) { v(g, x, cy, cy + S.ts); term(g, x, cy + S.ts, R.nt()); cy += S.ts; }
      return cy;
    }
    function output(el, x, y) {
      v(g, x, y, coilY);
      if (el.coil) {
        var c = el, key = keyOf[c.coil], tp = c.type || 'contactor';
        var letter = tp === 'contactor' ? 'Q' : 'K';
        var tag = R.set(key, s + letter + colOf(x), s, x);
        var role = ROLE_NL[String(c.drives || '').split(':')[1]] || '';
        if (role && U(c.name).indexOf(role) >= 0) role = '';
        var d2 = c.time ? 't = ' + c.time : (role + ' 230V').trim();
        coil(g, x, coilY, tag, U(c.name || ''), d2, tp === 'timer_on' ? 'TON_COIL' : tp === 'timer_off' ? 'TOF_COIL' : 'COIL');
        v(g, x, coilY + 6, yN); dot(g, x, yN);
        xtable(g, x, yN + 8, c.drives ? ['H', 'M', 'V'] : ['M', 'V'], R.info(key));
      } else {
        var id = el.lamp || el.buzzer, lk = 'out_' + id;
        var t2 = R.set(lk, s + 'P' + colOf(x), s, x);
        g.open();
        if (el.buzzer) buzzer(g, x, coilY); else lamp(g, x, coilY);
        g.t(x - 3, coilY + 1.4, t2, { a: 'end', size: 2 });
        wrap(el.name || '', 12).forEach(function (t, j) { g.t(x - 3, coilY + 3.7 + j * 2.2, t, { a: 'end', size: 1.7 }); });
        g.close();
        v(g, x, coilY + 6, yN); dot(g, x, yN);
      }
    }
    function seq(list, x, y) {
      var cy = y;
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (el.par) {
          var split = endsOut([el]), ws = el.par.map(function (b) { return meas(b, S).w; }), xs = [], acc = 0;
          ws.forEach(function (w) { xs.push(x + acc * LPITCH * CW); acc += w; });
          var yT = cy + 2, last = xs[xs.length - 1];
          v(g, x, cy, yT); g.l(x, yT, last, yT);
          xs.forEach(function (bx, j) { if (j < xs.length - 1) dot(g, bx, yT); });
          var ends = el.par.map(function (b, j) { return seq(b, xs[j], yT); });
          if (split) return null;
          var yB = Math.max.apply(null, ends) + 2;
          ends.forEach(function (ye, j) { v(g, xs[j], ye, yB); });
          g.l(x, yB, last, yB);
          xs.forEach(function (bx, j) { if (j < xs.length - 1) dot(g, bx, yB); });
          cy = yB;
          if (!S.gp) { v(g, x, cy, cy + 3); cy += 3; }  /* compact mode: keep a grid step below a parallel group */
        } else if (isOut(el)) { output(el, x, cy); return null; }
        else cy = contactEl(el, x, cy);
      }
      return cy;
    }
    sh.rungs.forEach(function (o) {
      var x = X(o.x);
      dot(g, x, y1); v(g, x, y1, y1 + 3);
      seq(o.r, x, y1 + 3);
    });
  }

  /* ---------- validation ---------- */
  function validate(P) {
    var w = [];
    if (P.plc === 'none') {
      if (!P.motors.length) w.push('Voeg een motor toe.');
      if (P.motors.length > 3) w.push('Maximaal 3 motoren: alleen de eerste 3 worden getekend.');
      var Lx = ladderOf(P);
      if (!Lx.custom && P.motors[0] && P.motors[0].type === 'YD') w.push('Ster-driehoek zonder PLC heeft een tijdrelais nodig: beschrijf de schakeling aan de AI-assistent of in de laddercode.');
      if (!Lx.custom && P.motors.length > 1) w.push('Met de eenvoudige knoppen wordt alleen de stuurkring van de eerste motor getekend; beschrijf meerdere motoren aan de AI-assistent of in de laddercode.');
      var ck = checkLadder(P, Lx);
      return w.concat(ck.errors, ck.warnings);
    }
    if (P.motors.length > 3) w.push('Maximaal 3 motoren: alleen de eerste 3 komen op het voedingsblad.');
    if (P.inputs.length > 8) w.push('Een LOGO!-basismodule heeft 8 ingangen; je hebt er ' + P.inputs.length + '.');
    if (P.outputs.length > 4) w.push('Een LOGO!-basismodule heeft 4 uitgangen; je hebt er ' + P.outputs.length + '.');
    var seen = {};
    P.inputs.forEach(function (i) { if (seen['I' + i.n]) w.push('Ingang I' + i.n + ' is twee keer gebruikt.'); seen['I' + i.n] = 1; });
    P.outputs.forEach(function (o) { if (seen['Q' + o.n]) w.push('Uitgang Q' + o.n + ' is twee keer gebruikt.'); seen['Q' + o.n] = 1; });
    P.motors.forEach(function (mo, m) {
      (ROLES[mo.type] || ROLES.DOL).forEach(function (r) {
        var c = P.outputs.filter(function (o) { var L = parseLoad(o.load); return L.type === 'M' && L.m === m && L.role === r; }).length;
        var nm = (mo.name || 'Motor ' + (m + 1)) + (ROLE_NL[r] ? ' (' + ROLE_NL[r].toLowerCase() + ')' : '');
        if (!c) w.push(nm + ': geen uitgang stuurt deze contactor.');
        if (c > 1) w.push(nm + ' wordt door ' + c + ' uitgangen gestuurd.');
      });
    });
    P.outputs.forEach(function (o) {
      var L = parseLoad(o.load);
      if (L.type === 'M' && (!P.motors[L.m] || (ROLES[P.motors[L.m].type] || []).indexOf(L.role) < 0)) w.push('Uitgang Q' + o.n + ' verwijst naar een motorcontactor die niet meer bestaat.');
    });
    P.inputs.forEach(function (i) {
      if (i.kind === 'THERMAL' && (!P.motors[i.m || 0] || P.motors[i.m || 0].thermal === false)) w.push('Ingang I' + i.n + ' leest een thermisch relais in, maar die motor heeft er geen.');
    });
    if (P.estop && !P.inputs.some(function (i) { return i.kind === 'ESTOP'; })) w.push('De noodstop staat aan, maar geen enkele ingang leest hem in.');
    return w;
  }

  /* ---------- render ---------- */
  /* each of these draws one symbol: group it so it moves as one in the editor */
  function grp(fn, k) { return function (g) { g.open(k); try { return fn.apply(this, arguments); } finally { g.close(); } }; }
  term = grp(term); contact = grp(contact); poles = grp(poles); coil = grp(coil); xtable = grp(xtable); lamp = grp(lamp);
  buzzer = grp(buzzer); block = grp(block); psu = grp(psu); motor = grp(motor); see = grp(see); arrowDown = grp(arrowDown);
  drawLogo = grp(drawLogo); frame = grp(frame, 'frame');

  /* one part from the symbol library, drawn around (x, y) for the editor */
  var PARTS = [
    ['Contacten', [['NO', 'Maakcontact (NO)'], ['NC', 'Verbreekcontact (NC)'], ['PB_NO', 'Drukknop NO'], ['PB_NC', 'Drukknop NC'], ['ESTOP', 'Noodstop'], ['TH_NC', 'Thermisch contact NC'], ['LIM_NO', 'Eindeloop NO'], ['LIM_NC', 'Eindeloop NC'], ['SW_NO', 'Schakelaar'], ['TON_NO', 'Tijdcontact opkomend'], ['TOF_NO', 'Tijdcontact afvallend'], ['T_NC', 'Tijdcontact NC']]],
    ['Spoelen en signalisatie', [['COIL', 'Spoel contactor'], ['RELAY', 'Spoel relais'], ['TON_COIL', 'Tijdrelais opkomend'], ['TOF_COIL', 'Tijdrelais afvallend'], ['LAMP', 'Signaallamp'], ['BUZZER', 'Zoemer']]],
    ['Beveiliging en vermogen', [['BRK1', 'Automaat 1P'], ['BRK2', 'Automaat 2P'], ['BRK3', 'Automaat 3P'], ['BRK4', 'Automaat 4P'], ['THR3', 'Thermisch relais 3P'], ['MAIN3', 'Vermogencontacten 3P'], ['MOTOR', 'Motor 3~'], ['PSU', 'Voeding 24V DC']]],
    ['LOGO! en aansluitingen', [['LOGO', 'LOGO!'], ['DI', 'LOGO!-ingang'], ['DO', 'LOGO!-uitgang'], ['TERM', 'Klem (X)'], ['DOT', 'Verbindingspunt'], ['XT', 'Kruisverwijzingstabel']]]
  ];
  /* any symbol from the optional full external library (SEEALL), top connection at (x, y) */
  function seeAll(g, id, x, y) {
    var S = typeof SEEALL !== 'undefined' && SEEALL[id]; if (!S) return false;
    var k = K, ox = x - S.x0 * k, oy = y + S.yt * k, M = function (px, py) { return [ox + px * k, oy - py * k]; };
    S.l.forEach(function (l) { var a = M(l[0], l[1]), b = M(l[2], l[3]); g.l(a[0], a[1], b[0], b[1]); });
    S.p.forEach(function (pts) { g.pl(pts.map(function (q) { return M(q[0], q[1]); })); });
    S.t.forEach(function (t) { var a = M(t[1], t[2]); g.t(a[0], a[1], t[0], { size: t[3] * k * 0.85, rot: t[4], a: t[5] }); });
    if (S.tag) label(g, ox + S.b[0] * k - 1.5, oy - S.b[3] * k + 3, '-?', '');
    return true;
  }
  function part(key, x, y) {
    var g = new Pg(); g.open(key === 'DOT' ? 'dot' : 'sym');
    if (String(key).indexOf('ALL:') === 0) { seeAll(g, key.slice(4), x, y); g.close(); return g.p; }
    if (key === 'NO' || key === 'NC') contact(g, x, y, key, { pins: key === 'NO' ? ['13', '14'] : ['21', '22'], l1: '-K?', l2: '' });
    else if (key === 'PB_NO' || key === 'PB_NC') contact(g, x, y, key.slice(3), { act: 'push', pins: key === 'PB_NO' ? ['13', '14'] : ['21', '22'], l1: '-S?', l2: 'NAAM' });
    else if (key === 'ESTOP') contact(g, x, y, 'NC', { act: 'estop', pins: ['11', '12'], l1: '-S?', l2: 'NOODSTOP' });
    else if (key === 'TH_NC') contact(g, x, y, 'NC', { act: 'thermal', pins: ['95', '96'], l1: '-F?', l2: '' });
    else if (key === 'COIL' || key === 'RELAY' || key === 'TON_COIL' || key === 'TOF_COIL') coil(g, x, y, key === 'COIL' ? '-Q?' : '-K?', 'NAAM', key.indexOf('_COIL') > 0 ? 't = 5 s' : '230V', key === 'RELAY' ? 'COIL' : key);
    else if (key === 'LAMP' || key === 'BUZZER') { if (key === 'LAMP') lamp(g, x, y); else buzzer(g, x, y); g.t(x - 3, y + 1.6, '-P?', { a: 'end', size: 2 }); g.t(x - 3, y + 3.9, 'naam', { a: 'end', size: 1.7 }); }
    else if (/^BRK\d$/.test(key)) { var n = +key[3], xs = []; for (var i = 0; i < n; i++) xs.push(x + i * PS); poles(g, xs, y, 'brk', null, '-F?', 'C10A /' + n + 'P'); }
    else if (key === 'THR3' || key === 'MAIN3') poles(g, [x, x + PS, x + 2 * PS], y, key === 'THR3' ? 'th' : 'NOc', key === 'THR3' ? [['1', '2'], ['3', '4'], ['5', '6']] : [['1', '2'], ['3', '4'], ['5', '6']], key === 'THR3' ? '-F?' : '-Q?', '');
    else if (key === 'MOTOR') { if (!see(g, 'MOTOR', x, y + 6, K)) motor(g, x, y + 6, 4.5); label(g, x - 6.5, y + 5.5, '-M?', 'MOTOR'); }
    else if (key === 'PSU') { if (!see(g, 'PSU', x, y + 25 * K)) psu(g, x - 3, y); label(g, x - 4.2, y + 8, '-T?', 'VOEDING 24V'); }
    else if (key === 'LOGO') { if (!see(g, 'LOGO', x, y + 50 * K, K)) g.r(x, y, 40, 50); label(g, x - 2, y + 27, '-K?', 'PLC'); }
    else if (key === 'DI' || key === 'DO') block(g, x, y, key, '-K?', 'FUNCTIE', key === 'DI' ? 'I1' : 'Q1');
    else if (key === 'TERM') term(g, x, y, '1');
    else if (key === 'DOT') dot(g, x, y);
    else if (key === 'XT') xtable(g, x, y, ['H', 'M', 'V'], {});
    else if (!seeAt(g, key, x, y)) contact(g, x, y, 'NO', {});
    else if (key.indexOf('T') === 0 || key === 'LIM_NO' || key === 'LIM_NC' || key === 'SW_NO') { var nc = /NC$/.test(key); pinTxt(g, x, y, 6, key.indexOf('T') === 0 ? (nc ? ['15', '16'] : ['15', '18']) : (nc ? ['21', '22'] : ['13', '14']), nc ? 2.9 : 2.3); label(g, x - (key.indexOf('LIM') === 0 ? 8.2 : key === 'SW_NO' ? 7.6 : 5), y + 2.6, key.indexOf('T') === 0 ? '-K?' : key === 'SW_NO' ? '-S?' : '-B?', key === 'SW_NO' ? 'NAAM' : key.indexOf('LIM') === 0 ? 'NAAM' : ''); }
    g.close();
    return g.p;
  }

  /* ---------- grid: SEE's 5-unit grid at 60% = 3 mm, through the frame's column lines (x = 10 + 27c) ---------- */
  var GRID = { g: 3, o: 1 };
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function q(v) { return r3(GRID.o + GRID.g * Math.round((v - GRID.o) / GRID.g)); }
  function onSeg(p, l, eps) {
    eps = eps || 0.05;
    if (p[0] < Math.min(l.x1, l.x2) - eps || p[0] > Math.max(l.x1, l.x2) + eps || p[1] < Math.min(l.y1, l.y2) - eps || p[1] > Math.max(l.y1, l.y2) + eps) return false;
    var dx = l.x2 - l.x1, dy = l.y2 - l.y1, len = Math.hypot(dx, dy); if (len < 1e-9) return Math.hypot(p[0] - l.x1, p[1] - l.y1) < eps;
    return Math.abs((p[0] - l.x1) * dy - (p[1] - l.y1) * dx) / len < eps;
  }
  function shiftPrim(p, dx, dy) {
    if (!dx && !dy) return;
    if (p.t === 'l') { p.x1 = r3(p.x1 + dx); p.x2 = r3(p.x2 + dx); p.y1 = r3(p.y1 + dy); p.y2 = r3(p.y2 + dy); }
    else if (p.t === 'pl') p.pts = p.pts.map(function (c) { return [r3(c[0] + dx), r3(c[1] + dy)]; });
    else { p.x = r3(p.x + dx); p.y = r3(p.y + dy); if (p.ax != null) { p.ax = r3(p.ax + dx); p.ay = r3(p.ay + dy); } }
  }
  /* connection points of a symbol: its line ends (and small circles) that touch a wire */
  function pinsOf(list, wires) {
    var pins = [];
    list.forEach(function (p) {
      var pts = p.t === 'l' ? [[p.x1, p.y1], [p.x2, p.y2]] : p.t === 'c' && p.r < 1.5 ? [[p.x, p.y]] : [];
      pts.forEach(function (pt) { if (wires.some(function (w) { return onSeg(pt, w); })) pins.push(pt); });
    });
    return pins.sort(function (a, b) { return a[1] - b[1] || a[0] - b[0]; });
  }
  /* align a sheet to the grid: wires and dots snap point by point (connections and right angles survive),
     each symbol moves as one so its connection points land on the grid, loose texts and arrows follow the nearest wire end.
     kindOf(prim) -> 'frame' | 'wire' | 'dot' | 'sym' | 'text' | 'shape' | 'loose' */
  function alignPrims(prims, kindOf) {
    var wires = prims.filter(function (p) { return p.t === 'l' && kindOf(p) === 'wire'; });
    var byG = {}, gd = {};
    prims.forEach(function (p) { var k = kindOf(p); if (k === 'sym' || k === 'shape') (byG[p.g] = byG[p.g] || []).push(p); });
    Object.keys(byG).forEach(function (gid) { var pins = pinsOf(byG[gid], wires); if (pins.length) gd[gid] = [q(pins[0][0]) - pins[0][0], q(pins[0][1]) - pins[0][1]]; });
    var ends = []; wires.forEach(function (w) { ends.push([w.x1, w.y1]); ends.push([w.x2, w.y2]); });
    function nearDelta(x, y) {
      var best = null, bd = 4.5;
      ends.forEach(function (e) { var d = Math.hypot(e[0] - x, e[1] - y); if (d < bd) { bd = d; best = e; } });
      return best ? [q(best[0]) - best[0], q(best[1]) - best[1]] : [0, 0];
    }
    var moves = prims.map(function (p) {
      var k = kindOf(p);
      if (k === 'frame') return null;
      if (k === 'wire' && p.t === 'l') return 'snap';
      if (k === 'dot') return 'snapc';
      if ((k === 'sym' || k === 'shape') && gd[p.g]) return gd[p.g];
      var a = p.t === 'pl' ? p.pts[p.pts.length > 1 ? 1 : 0] : p.t === 'l' ? [p.x1, p.y1] : [p.ax != null ? p.ax : p.x, p.ay != null ? p.ay : p.y];
      return nearDelta(a[0], a[1]);
    });
    prims.forEach(function (p, i) {
      var m = moves[i];
      if (!m) return;
      if (m === 'snap') { p.x1 = q(p.x1); p.y1 = q(p.y1); p.x2 = q(p.x2); p.y2 = q(p.y2); }
      else if (m === 'snapc') { p.x = q(p.x); p.y = q(p.y); }
      else shiftPrim(p, m[0], m[1]);
    });
    return prims;
  }
  function kindFor(groups) {
    return function (p) {
      if (p.g) return (groups[p.g] || {}).k || 'sym';
      if (p.t === 'l') return 'wire';
      if (p.t === 'c' && p.fill === 'k') return 'dot';
      return 'loose';
    };
  }

  function render(P) {
    var sheets = plan(P), total = sheets.length;
    var origin = { '+24V': 2, '0V': 2, '1L1': 3, '1N': 3, 'PE': 9 };
    P.motors.slice(0, 3).forEach(function (m, k) { motorPots(k).forEach(function (p) { origin[p] = colOf(X([5.2, 6.6, 8.0][k])); }); });
    function uses(sh, p) { return sh.kind === 'supply' || (sh.pots || []).indexOf(p) >= 0; }
    var C = {
      lref: function (sh, p) {
        var i = sheets.indexOf(sh);
        for (var j = i - 1; j >= 0; j--) if (uses(sheets[j], p)) return j === 0 ? '1.' + (origin[p] == null ? 9 : origin[p]) : sheets[j].no + '.9';
        return '';
      },
      rref: function (sh, p) {
        var i = sheets.indexOf(sh);
        for (var j = i + 1; j < sheets.length; j++) if (sheets[j].kind !== 'supply' && uses(sheets[j], p)) return sheets[j].no + '.0';
        return '';
      }
    };
    var prev = null, out;
    for (var pass = 0; pass < 2; pass++) {
      var R = new Reg(prev);
      out = sheets.map(function (sh) {
        var g = new Pg();
        frame(g, sh, total, P);
        if (sh.kind === 'supply') drawSupply(g, sh, P, R, C);
        else if (sh.kind === 'control') drawControl(g, sh, P, R, C);
        else if (sh.kind === 'inputs') drawInputs(g, sh, P, R, C);
        else if (sh.kind === 'outputs') drawOutputs(g, sh, P, R, C);
        else if (sh.kind === 'hardwired') drawHardwired(g, sh, P, R, C);
        else if (sh.kind === 'ladder') drawLadderSheet(g, sh, P, R, C);
        else if (sh.kind === 'hwlamps') drawHwLampSheet(g, sh, P, R, C);
        else drawPower(g, sh, P, R, C);
        if (P.grid !== false) alignPrims(g.p, kindFor(g.gm));
        return { no: sh.no, title: sh.title, prims: g.p, groups: g.gm };
      });
      prev = R;
    }
    return out;
  }

  function example() {
    return {
      name: 'motorschakeling logo', tek: 'Dto', date: '1/10/2025', nr: '', functie: '', locatie: '', school: '',
      plc: '0BA5', order: '6ED1 052-1CC00-0BA5', estop: true, mainBreaker: 'C20A', b24: 'C6A', b230: 'C10A',
      motors: [{ name: 'MOTOR', type: 'DOL', breaker: 'C20A', thermal: true }],
      inputs: [
        { n: 1, fn: 'START', kind: 'NO' }, { n: 2, fn: 'STOP', kind: 'NC' },
        { n: 3, fn: 'NOODSTOP', kind: 'ESTOP' }, { n: 4, fn: 'THERMISCH CONTACT', kind: 'THERMAL', m: 0 }
      ],
      outputs: [
        { n: 1, fn: 'motor', load: 'M:0:run' }, { n: 2, fn: 'lamp noodstop', load: 'LAMP' },
        { n: 3, fn: 'lamp thermische veiligheid', load: 'LAMP' }, { n: 4, fn: 'zoemer', load: 'BUZZER' }
      ]
    };
  }

  return { render: render, part: part, GRID: GRID, q: q, alignPrims: alignPrims, pinsOf: pinsOf, onSeg: onSeg, PARTS: PARTS, tw: tw, validate: validate, hwOf: hwOf, ladderOf: ladderOf, checkLadder: checkLadder, example: example, PLC: PLC, ROLES: ROLES, ROLE_NL: ROLE_NL, TYPE_NL: TYPE_NL, PW: PW, PH: PH };
})();
if (typeof module !== 'undefined') module.exports = SF;
