/* LAZY Electrical cabinet layout: a 2D panel layout to scale, linked to the schematic.
   A cabinet page (page.kind 'cabinet', page.scale = 5 for 1:5) holds:
     {k:'encl', x,y,w,h}   mounting plate / enclosure     {k:'rail', x,y,w}   DIN rail 35 mm
     {k:'duct', x,y,w,h}   cable duct                      {k:'cab', dev, x,y,w,h}   a device from the schematic
   Coordinates are grid units on the sheet like everything else; real sizes follow from the scale.
   The pick list shows every device of the schematic that is not placed yet. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.cabinet = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols;
  const RAIL_MM = 35;
  /* devices that are not mounted on the plate (field devices) */
  const FIELD = new Set(['motor3', 'motor6', 'motor1', 'lim_no', 'lim_nc', 'prox_no', 'flt_no', 'flt_nc', 'valve', 'heater']);
  const DOOR = new Set(['pb_no', 'pb_nc', 'estop', 'sel_no', 'sel_nc', 'lamp', 'horn', 'isol3', 'isol4']);
  const DEFAULT = { coil: [45, 85], coil_ton: [18, 90], coil_tof: [18, 90], mpcb3: [45, 90], ol3: [45, 75], fuse1: [18, 90], fuse3: [54, 90], rcd2: [36, 90], rcd4: [72, 90], psu: [54, 90], vfd: [100, 200], trafo1: [80, 90], plc: [72, 90], res: [20, 40], pb_no: [30, 30], pb_nc: [30, 30], estop: [40, 40], sel_no: [30, 30], sel_nc: [30, 30], lamp: [30, 30], horn: [30, 30], isol3: [45, 90], isol4: [60, 90] };

  const realPerUnit = (P, pg) => M.tplOf(P).g * (pg.scale || 5);
  function partOf(P, part) { return part ? ((P.parts || []).find((x) => x.part === part) || (LE.parts && LE.parts.find(part))) : null; }
  /* real size (mm) of a device */
  function sizeOf(P, dv) {
    if (dv.role === 'terminal') { const n = dv.terminals.length, p = partOf(P, (dv.terminals[0].it.p || {}).part); return [Math.max(1, n) * ((p && p.w) || 5.2) + 2, (p && p.h) || 50]; }
    const m = dv.master || dv.all[0], pt = partOf(P, dv.p.part);
    if (pt && pt.w && pt.h) return [pt.w, pt.h];
    const id = m.d.id;
    if (/^mcb(\d)$/.test(id)) return [18 * +id[3], 90];
    return DEFAULT[id] || [45, 60];
  }
  /* everything of the schematic that belongs in the cabinet, and whether it is placed */
  function pickList(P, A) {
    A = A || M.analyze(P);
    const placed = {};
    P.pages.forEach((pg) => pg.items.forEach((it) => { if (it.k === 'cab') placed[it.dev] = (placed[it.dev] || 0) + 1; }));
    return Object.values(A.devices).filter((dv) => {
      const m = dv.master || dv.all[0];
      if (!m || (m.d.role === 'slave' && !dv.master)) return false;
      return !FIELD.has(m.d.id);
    }).map((dv) => {
      const m = dv.master || dv.all[0], sz = sizeOf(P, dv);
      return { key: dv.key, tag: dv.full, name: dv.role === 'terminal' ? 'Klemmenstrook (' + dv.terminals.length + ' klemmen)' : m.d.name, desc: dv.p.desc || '', w: sz[0], h: sz[1], door: DOOR.has(m.d.id), placed: placed[dv.key] || 0, loss: lossOf(P, dv) };
    }).sort((a, b) => (LE.lists ? LE.lists.natural(a.tag, b.tag) : a.tag < b.tag ? -1 : 1));
  }
  function lossOf(P, dv) {
    if (dv.role === 'terminal') return 0;
    const pt = partOf(P, dv.p.part); return pt && pt.loss != null ? +pt.loss : 0;
  }
  /* heat produced inside one cabinet page: sum of the placed devices' losses (from their part data) */
  function heat(P, pg, A) {
    A = A || M.analyze(P);
    let w = 0, unknown = 0;
    pg.items.forEach((it) => {
      if (it.k !== 'cab') return;
      const dv = A.devices[it.dev]; if (!dv) return;
      const pt = dv.role !== 'terminal' && partOf(P, dv.p.part);
      if (dv.role === 'terminal') return;
      if (pt && pt.loss != null) w += +pt.loss; else unknown++;
    });
    return { watts: Math.round(w * 10) / 10, unknown };
  }
  /* lengths of DIN rail and cable duct (for the BOM and cut list), in metres */
  function cutList(P) {
    const out = { rail: [], duct: [] };
    P.pages.forEach((pg) => {
      if (pg.kind !== 'cabinet') return;
      const k = realPerUnit(P, pg);
      pg.items.forEach((it) => {
        if (it.k === 'rail') out.rail.push(Math.round(it.w * k));
        if (it.k === 'duct') out.duct.push(Math.round(Math.max(it.w, it.h) * k));
      });
    });
    return out;
  }
  /* put a device on a cabinet page; near a DIN rail it snaps onto the rail (centred on it) */
  function place(P, pageId, key, x, y) {
    const pg = M.findPage(P, pageId), A = M.analyze(P), dv = A.devices[key];
    if (!pg || !dv) throw new Error('toestel niet gevonden');
    const k = realPerUnit(P, pg), sz = sizeOf(P, dv), w = sz[0] / k, h = sz[1] / k;
    let px = x - w / 2, py = y - h / 2;
    const rail = snapRail(P, pg, x, y);
    if (rail) py = rail.y + (RAIL_MM / k) / 2 - h / 2;
    const it = { id: M.nid(P), k: 'cab', dev: key, x: r2(px), y: r2(py), w: r2(w), h: r2(h) };
    pg.items.push(it);
    return it;
  }
  function snapRail(P, pg, x, y) {
    const k = realPerUnit(P, pg), rh = RAIL_MM / k;
    return pg.items.find((r) => r.k === 'rail' && x >= r.x - 1 && x <= r.x + r.w + 1 && Math.abs(y - (r.y + rh / 2)) <= 3) || null;
  }
  const r2 = (v) => Math.round(v * 100) / 100;

  /* drawing (called by the renderer for cabinet pages) */
  function draw(c, P, pg, A, it) {
    const k = realPerUnit(P, pg);
    if (it.k === 'encl') {
      c.r(it.x, it.y, it.w, it.h, { w: 0.5 });
      c.r(it.x + 0.3, it.y + 0.3, it.w - 0.6, it.h - 0.6, { w: 0.18 });
      dim(c, it.x, it.y + it.h + 0.8, it.x + it.w, Math.round(it.w * k) + ' mm');
      dimV(c, it.x - 0.8, it.y, it.y + it.h, Math.round(it.h * k) + ' mm');
    } else if (it.k === 'rail') {
      const h = RAIL_MM / k;
      c.r(it.x, it.y, it.w, h, { fill: '#e9ecef', w: 0.25 });
      c.l(it.x, it.y + h * 0.2, it.x + it.w, it.y + h * 0.2, { w: 0.15 }); c.l(it.x, it.y + h * 0.8, it.x + it.w, it.y + h * 0.8, { w: 0.15 });
      c.t(it.x + it.w, it.y - 0.15, 'DIN ' + Math.round(it.w * k) + ' mm', 0.38, { a: 'end', color: '#555' });
    } else if (it.k === 'duct') {
      c.r(it.x, it.y, it.w, it.h, { fill: '#f1f3f5', w: 0.25 });
      const vert = it.h > it.w, n = Math.floor((vert ? it.h : it.w) / 1.2);
      for (let i = 1; i < n; i++) { if (vert) c.l(it.x, it.y + i * 1.2, it.x + it.w * 0.25, it.y + i * 1.2, { w: 0.1 }); else c.l(it.x + i * 1.2, it.y, it.x + i * 1.2, it.y + it.h * 0.25, { w: 0.1 }); }
      c.t(it.x + it.w / 2, it.y + it.h / 2 + 0.15, 'koker ' + Math.round(Math.min(it.w, it.h) * k) + ' mm', 0.36, { a: 'middle', color: '#555', rot: vert ? 90 : 0 });
    } else if (it.k === 'cab') {
      const dv = A.devices[it.dev];
      c.r(it.x, it.y, it.w, it.h, { fill: dv ? '#fff' : '#ffe3e3', w: 0.3 });
      const tag = dv ? dv.full : '?' + it.dev.split('|')[2];
      const size = Math.max(0.3, Math.min(0.55, it.w / Math.max(2, tag.length) * 1.6));
      c.t(it.x + it.w / 2, it.y + it.h / 2, tag, size, { a: 'middle', bold: true });
      if (dv && dv.p.part && it.h > 2.5) c.t(it.x + it.w / 2, it.y + it.h / 2 + size * 1.3, dv.p.part, Math.min(0.32, size * 0.7), { a: 'middle', color: '#555' });
    }
  }
  function dim(c, x1, y, x2, txt) { c.l(x1, y, x2, y, { w: 0.15 }); c.l(x1, y - 0.3, x1, y + 0.3, { w: 0.15 }); c.l(x2, y - 0.3, x2, y + 0.3, { w: 0.15 }); c.t((x1 + x2) / 2, y - 0.15, txt, 0.42, { a: 'middle' }); }
  function dimV(c, x, y1, y2, txt) { c.l(x, y1, x, y2, { w: 0.15 }); c.l(x - 0.3, y1, x + 0.3, y1, { w: 0.15 }); c.l(x - 0.3, y2, x + 0.3, y2, { w: 0.15 }); c.t(x - 0.15, (y1 + y2) / 2, txt, 0.42, { a: 'middle', rot: 90 }); }

  /* checks for cabinet pages */
  function check(P, A, add) {
    const seen = {};
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if (it.k !== 'cab') return;
      const ref = { pg, it, ref: M.pageLabel(pg) };
      if (!A.devices[it.dev]) add('warn', 'In de kastindeling (blad ' + M.pageLabel(pg) + ') staat ' + it.dev.split('|')[2] + ', maar dat toestel bestaat niet (meer) in het schema.', ref);
      if (seen[it.dev]) add('error', 'Toestel ' + (A.devices[it.dev] ? A.devices[it.dev].full : it.dev) + ' staat twee keer in de kastindeling.', ref);
      seen[it.dev] = 1;
    }));
  }

  return { pickList, sizeOf, heat, cutList, place, snapRail, draw, check, realPerUnit, RAIL_MM };
})();
if (typeof module !== 'undefined') module.exports = LE;
