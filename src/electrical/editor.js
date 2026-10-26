/* ===================== Tekenen: free drawing editor =====================
   P.drawing = {v:1, src:<project json at creation>, sheets:[{no,title,prims,groups}]}
   Every primitive has a group id (g); a group is one movable object: a symbol with its texts, a wire, a text, a dot. */
var ED = { grid: true, on: false, sheet: 0, tool: 'sel', sel: [], zoom: 1, undo: [], redo: [], arm: null, wire: null, drag: null, clip: null, hover: null };
var GSEQ = 0;
function newGid() { return 'u' + Date.now().toString(36) + (GSEQ++).toString(36); }
function r2(v) { return Math.round(v * 100) / 100; }
function projSig() { var c = {}; Object.keys(P).forEach(function (k) { if (k !== 'drawing') c[k] = P[k]; }); return JSON.stringify(c); }
function roundPrim(q) {
  ['x', 'y', 'x1', 'y1', 'x2', 'y2', 'w', 'h', 'r', 'ax', 'ay', 'size', 'lw'].forEach(function (k) { if (typeof q[k] === 'number') q[k] = r2(q[k]); });
  if (q.pts) q.pts = q.pts.map(function (p) { return [r2(p[0]), r2(p[1])]; });
  return q;
}
function looseKind(q) { return q.t === 'l' ? 'wire' : q.t === 'tx' ? 'text' : (q.t === 'c' && q.fill === 'k') ? 'dot' : 'shape'; }
function makeDrawing() {
  var sheets = SF.render(P).map(function (sh) {
    var groups = {};
    var prims = sh.prims.map(function (p) {
      var q = roundPrim(JSON.parse(JSON.stringify(p)));
      if (q.g) { var id = 's' + sh.no + q.g; if (!groups[id]) groups[id] = { k: (sh.groups[q.g] || {}).k || 'sym' }; q.g = id; }
      else { var id2 = newGid(); q.g = id2; groups[id2] = { k: looseKind(q) }; }
      return q;
    });
    return { no: sh.no, title: sh.title, prims: prims, groups: groups };
  });
  return { v: 1, src: projSig(), sheets: sheets };
}
function D() { return P.drawing; }
function curS() { var d = D(); if (ED.sheet >= d.sheets.length) ED.sheet = d.sheets.length - 1; return d.sheets[ED.sheet]; }

/* ---------- geometry ---------- */
function primBox(p) {
  if (p.t === 'l') return [Math.min(p.x1, p.x2), Math.min(p.y1, p.y2), Math.max(p.x1, p.x2), Math.max(p.y1, p.y2)];
  if (p.t === 'pl') { var xs = p.pts.map(function (q) { return q[0]; }), ys = p.pts.map(function (q) { return q[1]; }); return [Math.min.apply(null, xs), Math.min.apply(null, ys), Math.max.apply(null, xs), Math.max.apply(null, ys)]; }
  if (p.t === 'r') return [p.x, p.y, p.x + p.w, p.y + p.h];
  if (p.t === 'c') return [p.x - p.r, p.y - p.r, p.x + p.r, p.y + p.r];
  var w = SF.tw(p.s, p.size);
  if (p.rot === 90) return [p.x - p.size * 0.8, p.y - w, p.x + p.size * 0.2, p.y];
  return [p.x, p.y - p.size * 0.8, p.x + w, p.y + p.size * 0.2];
}
function union(bs) { var b = [1e9, 1e9, -1e9, -1e9]; bs.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]); }); return b; }
function index(sh) {
  var order = [], idx = {};
  sh.prims.forEach(function (p, i) { if (!idx[p.g]) { idx[p.g] = []; order.push(p.g); } idx[p.g].push(i); });
  return { order: order, idx: idx };
}
function gk(sh, gid) { return (sh.groups[gid] || {}).k || 'sym'; }
function movePrim(p, dx, dy) {
  if (p.t === 'l') { p.x1 = r2(p.x1 + dx); p.x2 = r2(p.x2 + dx); p.y1 = r2(p.y1 + dy); p.y2 = r2(p.y2 + dy); }
  else if (p.t === 'pl') p.pts = p.pts.map(function (q) { return [r2(q[0] + dx), r2(q[1] + dy)]; });
  else { p.x = r2(p.x + dx); p.y = r2(p.y + dy); if (p.ax != null) { p.ax = r2(p.ax + dx); p.ay = r2(p.ay + dy); } }
}
function rotPrim(p, cx, cy) {
  var R = function (x, y) { return [r2(cx - (y - cy)), r2(cy + (x - cx))]; };
  if (p.t === 'l') { var a = R(p.x1, p.y1), b = R(p.x2, p.y2); p.x1 = a[0]; p.y1 = a[1]; p.x2 = b[0]; p.y2 = b[1]; }
  else if (p.t === 'pl') p.pts = p.pts.map(function (q) { return R(q[0], q[1]); });
  else if (p.t === 'r') { var c1 = R(p.x, p.y), c2 = R(p.x + p.w, p.y + p.h); p.x = Math.min(c1[0], c2[0]); p.y = Math.min(c1[1], c2[1]); p.w = Math.abs(c2[0] - c1[0]); p.h = Math.abs(c2[1] - c1[1]); }
  else if (p.t === 'c') { var c = R(p.x, p.y); p.x = c[0]; p.y = c[1]; }
  else if (p.t === 'tx') {
    var ax = p.ax != null ? p.ax : p.x, ay = p.ay != null ? p.ay : p.y, n = R(ax, ay);
    p.ax = n[0]; p.ay = n[1]; placeText(p);
  }
}
/* text position from its anchor point and alignment */
function placeText(p) {
  if (p.ax == null) return;
  var w = SF.tw(p.s, p.size), off = p.a === 'middle' ? w / 2 : p.a === 'end' ? w : 0;
  if (p.rot === 90) { p.x = p.ax; p.y = r2(p.ay + off); } else { p.x = r2(p.ax - off); p.y = p.ay; }
}

/* ---------- undo ---------- */
function snapState() { return JSON.stringify({ d: D(), s: ED.sheet }); }
function pushUndo() { ED.undo.push(snapState()); if (ED.undo.length > 40) ED.undo.shift(); ED.redo = []; }
function restore(st) { var o = JSON.parse(st); P.drawing = o.d; ED.sheet = o.s; ED.sel = []; edCommit(true); }
function edUndo() { if (!ED.undo.length) return; ED.redo.push(snapState()); restore(ED.undo.pop()); }
function edRedo() { if (!ED.redo.length) return; ED.undo.push(snapState()); restore(ED.redo.pop()); }
var saveT = 0;
function edCommit(full) {
  clearTimeout(saveT); saveT = setTimeout(function () { store.set(JSON.stringify(P)); }, 300);
  edRender(); if (full) { edTabs(); }
  edProps(); edBanner();
}

/* ---------- rendering ---------- */
function primSvg(p, i) {
  if (p.t === 'l') return '<line x1="' + p.x1 + '" y1="' + p.y1 + '" x2="' + p.x2 + '" y2="' + p.y2 + '" stroke-width="' + p.w + '"' + (p.dash ? ' stroke-dasharray="1.2 .8"' : '') + '/>';
  if (p.t === 'pl') return '<' + (p.close ? 'polygon' : 'polyline') + ' points="' + p.pts.map(function (q) { return q[0] + ',' + q[1]; }).join(' ') + '" fill="none" stroke-width="' + p.w + '"/>';
  if (p.t === 'r') return '<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + (p.fill === 'k' ? '#000' : p.fill === 'w' ? '#fff' : 'none') + '" stroke-width="' + p.lw + '"/>';
  if (p.t === 'c') return '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r + '" fill="' + (p.fill === 'k' ? '#000' : p.fill === 'w' ? '#fff' : 'none') + '" stroke-width="' + p.lw + '"/>';
  return '<text data-pi="' + i + '" x="' + p.x + '" y="' + p.y + '" font-size="' + p.size + '"' + (p.bold ? ' font-weight="700"' : '') + (p.rot ? ' transform="rotate(-' + p.rot + ' ' + p.x + ' ' + p.y + ')"' : '') + '>' + esc(p.s) + '</text>';
}
var RANK = { frame: 0, shape: 1, sym: 2, text: 3, dot: 4, wire: 5 };
function edRender() {
  var sh = curS(), ix = index(sh), out = [];
  var order = ix.order.slice().sort(function (a, b) { return (RANK[gk(sh, a)] || 2) - (RANK[gk(sh, b)] || 2); });
  order.forEach(function (gid) {
    var k = gk(sh, gid), ids = ix.idx[gid], lock = k === 'frame', sel = ED.sel.indexOf(gid) >= 0;
    var inner = ids.map(function (i) { return primSvg(sh.prims[i], i); }).join(''), hit = '';
    if (!lock) {
      if (k === 'wire' && ids.length === 1) { var w = sh.prims[ids[0]]; hit = '<line class="hitw" x1="' + w.x1 + '" y1="' + w.y1 + '" x2="' + w.x2 + '" y2="' + w.y2 + '"/>'; }
      else { var b = union(ids.map(function (i) { return primBox(sh.prims[i]); })); hit = '<rect class="hit" x="' + r2(b[0] - 0.6) + '" y="' + r2(b[1] - 0.6) + '" width="' + r2(b[2] - b[0] + 1.2) + '" height="' + r2(b[3] - b[1] + 1.2) + '"/>'; }
    }
    out.push('<g data-g="' + gid + '" class="o' + (lock ? ' lock' : '') + (sel ? ' sel' : '') + (k === 'wire' ? ' w' : '') + '">' + hit + inner + '</g>');
  });
  /* handles for one selected wire */
  if (ED.sel.length === 1 && gk(sh, ED.sel[0]) === 'wire') {
    var wi = ix.idx[ED.sel[0]];
    if (wi && wi.length === 1) { var q = sh.prims[wi[0]]; out.push('<circle class="hd" data-h="1" cx="' + q.x1 + '" cy="' + q.y1 + '" r="0.9"/><circle class="hd" data-h="2" cx="' + q.x2 + '" cy="' + q.y2 + '" r="0.9"/>'); }
  }
  out.push('<g id="edOver"></g>');
  var dots = ED.grid ? '<defs><pattern id="edDots" x="' + (SF.GRID.o - SF.GRID.g / 2) + '" y="' + (SF.GRID.o - SF.GRID.g / 2) + '" width="' + SF.GRID.g + '" height="' + SF.GRID.g + '" patternUnits="userSpaceOnUse"><circle cx="' + SF.GRID.g / 2 + '" cy="' + SF.GRID.g / 2 + '" r="0.17" fill="#b4b4b4"/></pattern></defs><rect x="6" y="10" width="282" height="193" fill="url(#edDots)" pointer-events="none"/>' : '';
  $('#edSvg').innerHTML = '<rect width="297" height="210" fill="#fff"/>' + dots + '<g stroke="#000" stroke-linecap="round" font-family="Helvetica, Arial, sans-serif" fill="#000">' + out.join('') + '</g>';
  ED.ends = null;
}
function overlay(html) { var o = document.getElementById('edOver'); if (o) o.innerHTML = html || ''; }
function edZoom() { var sv = $('#edSvg'); sv.style.width = (ED.zoom * 100) + '%'; $('#edZoomTxt').textContent = Math.round(ED.zoom * 100) + '%'; }
function edTabs() {
  var d = D();
  $('#edTabs').innerHTML = d.sheets.map(function (s, i) { return '<button class="tab' + (i === ED.sheet ? ' on' : '') + '" type="button" data-sheet="' + i + '" aria-pressed="' + (i === ED.sheet) + '">' + s.no + ' · ' + esc(s.title) + '</button>'; }).join('') +
    '<button class="tab" type="button" id="edAddSheet">+ blad</button>' + (d.sheets.length > 1 ? '<button class="tab" type="button" id="edDelSheet">blad verwijderen</button>' : '');
}
function textsOfSel() {
  var sh = curS(), res = [];
  sh.prims.forEach(function (p, i) { if (p.t === 'tx' && ED.sel.indexOf(p.g) >= 0) res.push(i); });
  return res.slice(0, 16);
}
function edProps() {
  var host = $('#edProps'), sh = curS();
  if (!ED.sel.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  var tx = textsOfSel();
  host.innerHTML = (tx.length ? tx.map(function (i) { var p = sh.prims[i]; return '<input type="text" class="pt" data-pi="' + i + '" value="' + esc(p.s) + '" aria-label="Tekst" style="width:' + Math.max(4, Math.min(18, p.s.length + 2)) + 'ch">'; }).join('') : '') +
    '<span class="sp"></span><button class="btn small" type="button" data-act="rot">Draaien</button><button class="btn small" type="button" data-act="dup">Dupliceren</button><button class="btn small" type="button" data-act="del">Verwijderen</button>';
}
function edBanner() {
  var b = $('#edBanner'), d = D();
  var changedForm = d && d.src && d.src !== projSig();
  b.hidden = !changedForm;
  if (changedForm) b.innerHTML = '<span>Het formulier is gewijzigd sinds je begon te tekenen.</span><button class="btn small" type="button" id="edRegen">Opnieuw genereren</button>';
}

/* ---------- pointer helpers ---------- */
function toMM(e) { var sv = $('#edSvg'), pt = sv.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var r = pt.matrixTransform(sv.getScreenCTM().inverse()); return [r.x, r.y]; }
/* snapping: points to the 3 mm grid (SF.GRID), moves in whole grid steps; Alt or "Raster" off = free (0.5 mm) */
function free(e) { return !ED.grid || (e && e.altKey); }
function grid(v, e) { return free(e) ? Math.round(v * 2) / 2 : SF.q(v); }
function gridD(d, e, textOnly) { var st = free(e) || textOnly ? 0.5 : SF.GRID.g; return Math.round(d / st) * st; }
function ends() {
  if (ED.ends) return ED.ends;
  var sh = curS(), L = [];
  sh.prims.forEach(function (p) {
    if (p.t === 'l') { L.push([p.x1, p.y1]); L.push([p.x2, p.y2]); }
    else if (p.t === 'c' && p.r < 1.5) L.push([p.x, p.y]);
  });
  return (ED.ends = L);
}
function snapPt(m, e, skip) {
  var best = null, bd = 1.6 / Math.max(1, ED.zoom * 0.8);
  ends().forEach(function (q) { if (skip && skip(q)) return; var d = Math.hypot(q[0] - m[0], q[1] - m[1]); if (d < bd) { bd = d; best = q; } });
  return best ? [best[0], best[1], true] : [grid(m[0], e), grid(m[1], e), false];
}
function groupNodes() { return ED.sel.map(function (g) { return document.querySelector('#edSvg [data-g="' + g + '"]'); }).filter(Boolean); }
function selectOnly(ids) { ED.sel = ids; edRender(); edProps(); }

/* ---------- actions ---------- */
function delSel() {
  if (!ED.sel.length) return; pushUndo();
  var sh = curS(), s = ED.sel;
  sh.prims = sh.prims.filter(function (p) { return s.indexOf(p.g) < 0 || gk(sh, p.g) === 'frame'; });
  s.forEach(function (g) { if (gk(sh, g) !== 'frame') delete sh.groups[g]; });
  ED.sel = []; edCommit();
}
function rotSel() {
  if (!ED.sel.length) return; pushUndo();
  var sh = curS(), ps = sh.prims.filter(function (p) { return ED.sel.indexOf(p.g) >= 0; }), b = union(ps.map(primBox));
  var cx = Math.round((b[0] + b[2])), cy = Math.round((b[1] + b[3])); cx /= 2; cy /= 2;
  ps.forEach(function (p) { rotPrim(p, cx, cy); });
  edCommit();
}
function copySel() {
  if (!ED.sel.length) return null;
  var sh = curS(), map = {};
  ED.sel.forEach(function (g) { if (gk(sh, g) !== 'frame') map[g] = { k: gk(sh, g) }; });
  return { prims: JSON.parse(JSON.stringify(sh.prims.filter(function (p) { return map[p.g]; }))), groups: map };
}
function pasteClip(c, dx, dy) {
  if (!c || !c.prims.length) return; pushUndo();
  var sh = curS(), ren = {};
  Object.keys(c.groups).forEach(function (g) { ren[g] = newGid(); sh.groups[ren[g]] = { k: c.groups[g].k }; });
  JSON.parse(JSON.stringify(c.prims)).forEach(function (p) { p.g = ren[p.g]; movePrim(p, dx, dy); sh.prims.push(p); });
  ED.sel = Object.keys(ren).map(function (g) { return ren[g]; }); edCommit();
}
function placePart(key, m) {
  pushUndo();
  var sh = curS(), gid = newGid(), prims = SF.part(key, m[0], m[1]);
  sh.groups[gid] = { k: key === 'DOT' ? 'dot' : 'sym' };
  prims.forEach(function (p) { p = roundPrim(p); p.g = gid; sh.prims.push(p); });
  ED.sel = [gid]; edCommit();
}
function addWire(a, b) {
  var sh = curS(), segs = [];
  if (Math.abs(a[0] - b[0]) < 0.01 || Math.abs(a[1] - b[1]) < 0.01) segs.push([a, b]);
  else { var c = [b[0], a[1]]; segs.push([a, c]); segs.push([c, b]); }
  segs.forEach(function (s) {
    if (Math.hypot(s[0][0] - s[1][0], s[0][1] - s[1][1]) < 0.05) return;
    var gid = newGid(); sh.groups[gid] = { k: 'wire' };
    sh.prims.push({ t: 'l', x1: r2(s[0][0]), y1: r2(s[0][1]), x2: r2(s[1][0]), y2: r2(s[1][1]), w: 0.25, dash: 0, g: gid });
  });
}
function editText(i) {
  var sh = curS(), p = sh.prims[i]; if (!p || p.t !== 'tx') return;
  var node = document.querySelector('#edSvg text[data-pi="' + i + '"]'); if (!node) return;
  var r = node.getBoundingClientRect(), wr = $('#edWrap').getBoundingClientRect(), inp = document.createElement('input');
  inp.type = 'text'; inp.className = 'edInline'; inp.value = p.s; inp.setAttribute('aria-label', 'Tekst bewerken');
  inp.style.left = (r.left - wr.left + $('#edWrap').scrollLeft - 4) + 'px'; inp.style.top = (r.top - wr.top + $('#edWrap').scrollTop + r.height / 2 - 14) + 'px';
  $('#edWrap').appendChild(inp); inp.focus(); inp.select();
  var done = false;
  function fin(ok) {
    if (done) return; done = true; var v = inp.value; inp.remove();
    if (!ok || v === p.s) return;
    pushUndo();
    if (!v.trim()) { sh.prims.splice(i, 1); if (!sh.prims.some(function (q) { return q.g === p.g; })) delete sh.groups[p.g]; }
    else { p.s = v; placeText(p); }
    edCommit();
  }
  inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); fin(true); } else if (e.key === 'Escape') { e.preventDefault(); fin(false); } e.stopPropagation(); });
  inp.addEventListener('blur', function () { fin(true); });
}
/* move every wire, dot and symbol of this sheet onto the grid, keeping connections */
function alignSheet() {
  pushUndo(); var sh = curS();
  SF.alignPrims(sh.prims, function (p) { return gk(sh, p.g); });
  sh.prims = sh.prims.filter(function (p) { return !(p.t === 'l' && gk(sh, p.g) === 'wire' && Math.abs(p.x1 - p.x2) < 1e-6 && Math.abs(p.y1 - p.y2) < 1e-6); });
  edCommit(); toast('Blad uitgelijnd op het raster.');
}
function setTool(t) {
  ED.tool = t; ED.wire = null; overlay('');
  if (t !== 'part') { ED.arm = null; document.querySelectorAll('#edPal [data-part]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); }); }
  document.querySelectorAll('#edTools [data-tool]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tool === t)); });
  $('#edSvg').dataset.tool = t;
}

/* ---------- pointer events ---------- */
function bindEditor() {
  var sv = $('#edSvg'), wrap = $('#edWrap');
  sv.addEventListener('pointerdown', function (e) {
    if (e.button === 2) return;
    var m = toMM(e), t = e.target;
    if (ED.tool === 'part' && ED.arm) { var sp = snapPt(m, e); placePart(ED.arm, sp); if (!e.shiftKey) setTool('sel'); return; }
    if (ED.tool === 'pan') { ED.drag = { k: 'pan', x: e.clientX, y: e.clientY, sl: wrap.scrollLeft, st: wrap.scrollTop }; sv.setPointerCapture(e.pointerId); return; }
    if (ED.tool === 'text') {
      var tp = [Math.round(m[0] * 2) / 2, Math.round(m[1] * 2) / 2]; pushUndo();
      var sh0 = curS(), gid = newGid(); sh0.groups[gid] = { k: 'text' };
      sh0.prims.push({ t: 'tx', x: tp[0], y: tp[1], ax: tp[0], ay: tp[1], a: 'start', s: 'tekst', size: 2, rot: 0, bold: false, g: gid });
      ED.sel = [gid]; edCommit(); setTool('sel'); editText(sh0.prims.length - 1); return;
    }
    if (ED.tool === 'wire') {
      var p = snapPt(m, e);
      if (!ED.wire) { ED.wire = { a: [p[0], p[1]], n: 0 }; pushUndo(); return; }
      var a = ED.wire.a;
      if (Math.hypot(a[0] - p[0], a[1] - p[1]) < 0.05) { ED.wire = null; overlay(''); edCommit(); return; }
      addWire(a, [p[0], p[1]]); ED.ends = null; ED.wire.n++;
      if (p[2]) { ED.wire = null; overlay(''); edCommit(); return; }   /* landed on a connection: wire done */
      ED.wire.a = [p[0], p[1]]; edRender(); return;
    }
    /* select tool; a second tap on the same text within 0.4 s edits it */
    if (t.tagName === 'text' && t.dataset.pi != null) {
      var now = Date.now();
      if (ED.lastTx === t.dataset.pi && now - ED.lastT < 400) { ED.lastTx = null; e.preventDefault(); editText(+t.dataset.pi); return; }
      ED.lastTx = t.dataset.pi; ED.lastT = now;
    } else ED.lastTx = null;
    if (t.dataset && t.dataset.h) {
      var sh = curS(), wi = index(sh).idx[ED.sel[0]][0];
      pushUndo(); ED.drag = { k: 'end', h: t.dataset.h, pi: wi, moved: false }; sv.setPointerCapture(e.pointerId); return;
    }
    var gEl = t.closest && t.closest('[data-g]');
    if (gEl && !gEl.classList.contains('lock')) {
      var gid2 = gEl.dataset.g;
      if (e.shiftKey || e.ctrlKey || e.metaKey) { var k = ED.sel.indexOf(gid2); if (k >= 0) ED.sel.splice(k, 1); else ED.sel.push(gid2); edRender(); edProps(); return; }
      if (ED.sel.indexOf(gid2) < 0) selectOnly([gid2]);
      ED.drag = { k: 'move', m0: m, dx: 0, dy: 0, nodes: groupNodes(), moved: false, textOnly: ED.sel.every(function (g) { return gk(curS(), g) === 'text'; }) };
      sv.setPointerCapture(e.pointerId); return;
    }
    ED.drag = { k: 'band', m0: m, m1: m }; sv.setPointerCapture(e.pointerId);
    if (ED.sel.length) { ED.sel = []; edRender(); edProps(); }
  });
  sv.addEventListener('pointermove', function (e) {
    var m = toMM(e), d = ED.drag;
    if (ED.tool === 'wire' && ED.wire) {
      var p = snapPt(m, e), a = ED.wire.a, path = (Math.abs(a[0] - p[0]) < 0.01 || Math.abs(a[1] - p[1]) < 0.01) ? 'M' + a + 'L' + [p[0], p[1]] : 'M' + a + 'L' + [p[0], a[1]] + 'L' + [p[0], p[1]];
      overlay('<path d="' + path + '" fill="none" stroke-width="0.35" stroke-dasharray="1 .6"/>' + (p[2] ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.1" fill="none" stroke-width="0.3"/>' : ''));
      return;
    }
    if (ED.tool === 'wire' || (ED.tool === 'part' && ED.arm)) { var q = snapPt(m, e); overlay(q[2] ? '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="1.1" fill="none" stroke-width="0.3"/>' : ''); return; }
    if (!d) return;
    if (d.k === 'pan') { wrap.scrollLeft = d.sl - (e.clientX - d.x); wrap.scrollTop = d.st - (e.clientY - d.y); return; }
    if (d.k === 'move') {
      d.dx = gridD(m[0] - d.m0[0], e, d.textOnly); d.dy = gridD(m[1] - d.m0[1], e, d.textOnly);
      if (d.dx || d.dy) d.moved = true;
      d.nodes.forEach(function (n) { n.setAttribute('transform', 'translate(' + d.dx + ' ' + d.dy + ')'); });
      return;
    }
    if (d.k === 'end') {
      var sh = curS(), w = sh.prims[d.pi], h = d.h, other = h === '1' ? [w.x2, w.y2] : [w.x1, w.y1], own = h === '1' ? [w.x1, w.y1] : [w.x2, w.y2];
      var sp = snapPt(m, e, function (q) { return (q[0] === own[0] && q[1] === own[1]) || (q[0] === other[0] && q[1] === other[1]); });
      if (!sp[2]) { if (Math.abs(sp[0] - other[0]) < Math.abs(sp[1] - other[1])) sp[0] = other[0]; else sp[1] = other[1]; }  /* keep it straight */
      if (h === '1') { w.x1 = sp[0]; w.y1 = sp[1]; } else { w.x2 = sp[0]; w.y2 = sp[1]; }
      d.moved = true; ED.ends = []; edRender(); ED.ends = null; return;
    }
    if (d.k === 'band') {
      d.m1 = m; var x0 = Math.min(d.m0[0], m[0]), y0 = Math.min(d.m0[1], m[1]);
      overlay('<rect x="' + x0 + '" y="' + y0 + '" width="' + Math.abs(m[0] - d.m0[0]) + '" height="' + Math.abs(m[1] - d.m0[1]) + '" fill="#000" fill-opacity="0.04" stroke-width="0.25" stroke-dasharray="1 .6"/>');
    }
  });
  function up() {
    var d = ED.drag; ED.drag = null; if (!d) return;
    if (d.k === 'move' && d.moved) {
      pushUndo(); var sh = curS();
      sh.prims.forEach(function (p) { if (ED.sel.indexOf(p.g) >= 0) movePrim(p, d.dx, d.dy); });
      edCommit();
    } else if (d.k === 'end') { if (d.moved) edCommit(); else ED.undo.pop(); }
    else if (d.k === 'band') {
      overlay('');
      var x0 = Math.min(d.m0[0], d.m1[0]), y0 = Math.min(d.m0[1], d.m1[1]), x1 = Math.max(d.m0[0], d.m1[0]), y1 = Math.max(d.m0[1], d.m1[1]);
      if (x1 - x0 < 0.5 && y1 - y0 < 0.5) return;
      var sh2 = curS(), ix = index(sh2), pick = [];
      ix.order.forEach(function (g) { if (gk(sh2, g) === 'frame') return; var b = union(ix.idx[g].map(function (i) { return primBox(sh2.prims[i]); })); if (b[0] >= x0 && b[1] >= y0 && b[2] <= x1 && b[3] <= y1) pick.push(g); });
      selectOnly(pick);
    }
  }
  sv.addEventListener('pointerup', up);
  sv.addEventListener('pointercancel', function () { ED.drag = null; edRender(); });
  sv.addEventListener('dblclick', function (e) {
    if (ED.tool === 'wire') { ED.wire = null; overlay(''); edCommit(); return; }
  });
  sv.addEventListener('contextmenu', function (e) { if (ED.tool === 'wire' && ED.wire) { e.preventDefault(); ED.wire = null; overlay(''); edCommit(); } });
  /* drag and drop from the palette */
  sv.addEventListener('dragover', function (e) { e.preventDefault(); });
  sv.addEventListener('drop', function (e) { e.preventDefault(); var k = e.dataTransfer.getData('text/plain'); if (!k || !SF.part) return; placePart(k, snapPt(toMM(e), e)); setTool('sel'); });

  $('#edPal').addEventListener('dragstart', function (e) { var b = e.target.closest('[data-part]'); if (b) { e.dataTransfer.setData('text/plain', b.dataset.part); e.dataTransfer.effectAllowed = 'copy'; } });
  $('#edPal').addEventListener('click', function (e) {
    var b = e.target.closest('[data-part]'); if (!b) return;
    var on = ED.arm === b.dataset.part; setTool(on ? 'sel' : 'part');
    if (!on) { ED.arm = b.dataset.part; b.setAttribute('aria-pressed', 'true'); toast('Klik op het blad om "' + b.textContent.trim() + '" te plaatsen.'); }
  });
  $('#edTools').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tool) { setTool(b.dataset.tool); return; }
    var a = b.dataset.act;
    if (a === 'undo') edUndo(); else if (a === 'redo') edRedo();
    else if (a === 'zin') { ED.zoom = Math.min(6, ED.zoom * 1.25); edZoom(); }
    else if (a === 'zout') { ED.zoom = Math.max(0.5, ED.zoom / 1.25); edZoom(); }
    else if (a === 'zfit') { ED.zoom = 1; edZoom(); }
    else if (a === 'grid') { ED.grid = !ED.grid; lsSet('lazyelectrical.grid', ED.grid); b.setAttribute('aria-pressed', String(ED.grid)); edRender(); }
    else if (a === 'align') { alignSheet(); }
  });
  $('#edProps').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'del') delSel(); else if (b.dataset.act === 'rot') rotSel(); else if (b.dataset.act === 'dup') pasteClip(copySel(), 5, 5);
  });
  var editing = false;
  $('#edProps').addEventListener('focusin', function (e) { if (e.target.dataset.pi != null && !editing) { pushUndo(); editing = true; } });
  $('#edProps').addEventListener('focusout', function () { editing = false; });
  $('#edProps').addEventListener('input', function (e) {
    var i = e.target.dataset.pi; if (i == null) return;
    var p = curS().prims[+i]; p.s = e.target.value; placeText(p);
    clearTimeout(saveT); saveT = setTimeout(function () { store.set(JSON.stringify(P)); }, 300);
    edRender();
  });
  $('#edTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sheet != null) { ED.sheet = +b.dataset.sheet; ED.sel = []; ED.wire = null; edCommit(true); return; }
    if (b.id === 'edAddSheet') {
      pushUndo(); var d = D(), src = curS(), no = Math.max.apply(null, d.sheets.map(function (s) { return s.no; })) + 1, groups = {};
      var prims = JSON.parse(JSON.stringify(src.prims.filter(function (p) { return gk(src, p.g) === 'frame'; })));
      prims.forEach(function (p) { groups[p.g] = { k: 'frame' }; });
      d.sheets.push({ no: no, title: 'nieuw blad', prims: prims, groups: groups }); ED.sheet = d.sheets.length - 1; ED.sel = []; edCommit(true); return;
    }
    if (b.id === 'edDelSheet') {
      if (Date.now() - (b._arm || 0) > 3000) { b._arm = Date.now(); b.textContent = 'zeker? klik nog eens'; return; }
      pushUndo(); D().sheets.splice(ED.sheet, 1); ED.sheet = Math.max(0, ED.sheet - 1); ED.sel = []; edCommit(true);
    }
  });
  $('#edBanner').addEventListener('click', function (e) {
    var b = e.target.closest('#edRegen'); if (!b) return;
    if (Date.now() - (b._arm || 0) > 3000) { b._arm = Date.now(); b.textContent = 'Eigen tekenwerk wissen? Klik nog eens'; return; }
    pushUndo(); P.drawing = makeDrawing(); ED.sel = []; edCommit(true); toast('Opnieuw gegenereerd. Ongedaan maken zet je tekening terug.');
  });
  document.addEventListener('keydown', function (e) {
    if (!ED.on || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    var k = e.key, c = e.ctrlKey || e.metaKey;
    if (c && (k === 'z' || k === 'Z')) { e.preventDefault(); if (e.shiftKey) edRedo(); else edUndo(); return; }
    if (c && (k === 'y' || k === 'Y')) { e.preventDefault(); edRedo(); return; }
    if (c && (k === 'c' || k === 'C')) { ED.clip = copySel(); if (ED.clip) toast('Gekopieerd'); return; }
    if (c && (k === 'v' || k === 'V')) { e.preventDefault(); pasteClip(ED.clip, 5, 5); return; }
    if (c && (k === 'd' || k === 'D')) { e.preventDefault(); pasteClip(copySel(), 5, 5); return; }
    if (c && (k === 'a' || k === 'A')) { e.preventDefault(); var sh = curS(); selectOnly(index(sh).order.filter(function (g) { return gk(sh, g) !== 'frame'; })); return; }
    if (c) return;
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); delSel(); }
    else if (k === 'Escape') { if (ED.wire) { ED.wire = null; overlay(''); edCommit(); } else { setTool('sel'); selectOnly([]); } }
    else if (k === 'r' || k === 'R') rotSel();
    else if (k === 'v' || k === 'V') setTool('sel');
    else if (k === 'w' || k === 'W') setTool('wire');
    else if (k === 't' || k === 'T') setTool('text');
    else if (k === 'h' || k === 'H') setTool('pan');
    else if (k.indexOf('Arrow') === 0 && ED.sel.length) {
      e.preventDefault(); var st = (ED.grid ? SF.GRID.g : 0.5) * (e.shiftKey ? 5 : 1), dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
      pushUndo(); curS().prims.forEach(function (p) { if (ED.sel.indexOf(p.g) >= 0) movePrim(p, dx, dy); }); edCommit();
    }
  });
  $('#edWrap').addEventListener('wheel', function (e) { if (!e.ctrlKey) return; e.preventDefault(); ED.zoom = Math.max(0.5, Math.min(6, ED.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); edZoom(); }, { passive: false });
}
function palIcon(key) {
  var prims = SF.part(key, 0, 0).filter(function (q) { return q.t !== 'tx'; }); if (!prims.length) return '';
  var b = union(prims.map(primBox)), pad = 1.5, vb = [b[0] - pad, b[1] - pad, Math.max(4, b[2] - b[0] + 2 * pad), Math.max(4, b[3] - b[1] + 2 * pad)];
  return '<svg viewBox="' + vb.map(r2).join(' ') + '" aria-hidden="true"><g stroke="#000" stroke-linecap="round" fill="none">' + prims.map(primSvg).join('') + '</g></svg>';
}
function palette() {
  var all = typeof SEEALL !== 'undefined' ? Object.keys(SEEALL).map(function (id) { return ['ALL:' + id, SEEALL[id].n]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'nl'); }) : [];
  var cats = SF.PARTS.concat(all.length ? [['Alle symbolen (eigen bibliotheek)', all]] : []);
  $('#edPal').innerHTML = '<input type="search" id="palSearch" placeholder="Zoeken…" aria-label="Symbool zoeken">' + cats.map(function (c) {
    return '<div class="palh">' + esc(c[0]) + '</div>' + c[1].map(function (p) {
      return '<button type="button" draggable="true" data-part="' + p[0] + '" data-name="' + esc(p[1].toLowerCase()) + '" aria-pressed="false" title="' + esc(p[1]) + '">' + (p[0].indexOf('ALL:') === 0 ? '<i class="lazyico" data-k="' + p[0] + '"></i>' : palIcon(p[0])) + '<span>' + esc(p[1]) + '</span></button>';
    }).join('');
  }).join('');
  /* icons of the full library are drawn when they scroll into view */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { var i = en.target; io.unobserve(i); i.outerHTML = palIcon(i.dataset.k) || '<svg></svg>'; } }); }, { root: $('#edPal') }) : null;
  document.querySelectorAll('#edPal .lazyico').forEach(function (i) { if (io) io.observe(i); else i.outerHTML = palIcon(i.dataset.k); });
  $('#palSearch').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    document.querySelectorAll('#edPal [data-part]').forEach(function (b) { b.hidden = !!q && b.dataset.name.indexOf(q) < 0; });
    document.querySelectorAll('#edPal .palh').forEach(function (h) { h.hidden = !!q; });
  });
  $('#palSearch').addEventListener('keydown', function (e) { e.stopPropagation(); });
}
function paletteOld() {
  $('#edPal').innerHTML = SF.PARTS.map(function (c) {
    return '<div class="palh">' + esc(c[0]) + '</div>' + c[1].map(function (p) {
      var prims = SF.part(p[0], 0, 0).filter(function (q) { return q.t !== 'tx'; }), b = union(prims.map(primBox)), pad = 1.5;
      var vb = [b[0] - pad, b[1] - pad, Math.max(4, b[2] - b[0] + 2 * pad), Math.max(4, b[3] - b[1] + 2 * pad)];
      var ico = '<svg viewBox="' + vb.join(' ') + '" aria-hidden="true"><g stroke="#000" stroke-linecap="round" fill="none">' + prims.map(primSvg).join('') + '</g></svg>';
      return '<button type="button" draggable="true" data-part="' + p[0] + '" aria-pressed="false" title="' + esc(p[1]) + '">' + ico + '<span>' + esc(p[1]) + '</span></button>';
    }).join('');
  }).join('');
}
ED.grid = lsGet('lazyelectrical.grid', true) !== false;
function setMode(draw) {
  ED.on = draw;
  document.querySelectorAll('#modeSeg button').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.mode === 'draw') === draw)); });
  $('#viewPane').hidden = draw; $('#editor').hidden = !draw;
  sideShow(sidePref()[draw ? 'draw' : 'view']);
  if (draw) {
    if (!D()) { P.drawing = makeDrawing(); store.set(JSON.stringify(P)); ED.undo = []; ED.redo = []; }
    if (!$('#edPal').innerHTML) palette();
    $('#edGridBtn').setAttribute('aria-pressed', String(ED.grid));
    edZoom(); setTool(ED.tool === 'part' ? 'sel' : ED.tool); edCommit(true);
  } else { ED.wire = null; renderSheets(); }
}
/* side panel: hidden by default while drawing, shown while viewing; the choice per mode is remembered */
function sidePref() { var p = lsGet('lazyelectrical.side', null); return p && typeof p === 'object' ? p : { view: true, draw: false }; }
function sideShow(on) { $('.main').classList.toggle('noside', !on); var b = $('#sideBtn'); b.textContent = on ? 'Formulier verbergen' : 'Formulier tonen'; b.setAttribute('aria-pressed', String(!on)); }
$('#sideBtn').addEventListener('click', function () { var p = sidePref(), k = ED.on ? 'draw' : 'view'; p[k] = !p[k]; lsSet('lazyelectrical.side', p); sideShow(p[k]); });
sideShow(sidePref().view);
$('#modeSeg').addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode === 'draw'); });
bindEditor();
