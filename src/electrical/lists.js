/* LAZY Electrical lists: bill of materials, components, terminals, cables, wires, PLC I/O, contents.
   All lists are computed from the drawings, so they are always up to date. They feed the database views (tables in
   the app), the graphical list pages (printed with the set) and CSV export. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.lists = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols;

  const natural = (a, b) => String(a).localeCompare(String(b), 'nl', { numeric: true });
  const byPos = (A) => (a, b) => (A.pageIdx[a.pg.id] - A.pageIdx[b.pg.id]) || (a.it.x - b.it.x) || (a.it.y - b.it.y);
  const pinName = (s, p) => (s.d.role === 'terminal' ? M.fullTag(s.fn, s.loc, s.it.tag) + ':' + (s.it.no || '?') : (s.dev ? s.dev.full : '-?') + ':' + (p.n || (p.i + 1)));
  function partOf(P, part) { return (P.parts || []).find((x) => x.part === part) || (LE.parts ? LE.parts.find(part) : null); }

  /* other device connections on the same net as pin p of symbol s (what a terminal or channel is wired to) */
  function targets(A, s, p) {
    const n = A.nets[p.net]; if (!n) return [];
    return n.pins.filter((q) => q.sym !== s).map((q) => pinName(q.sym, q.pin)).concat([...n.pots].map((x) => 'potentiaal ' + x));
  }

  function components(P, A) {
    A = A || M.analyze(P);
    return Object.values(A.devices).filter((d) => d.role !== 'terminal').map((d) => {
      const m = d.master || d.all[0], pt = partOf(P, d.p.part);
      return {
        tag: d.full, key: d.key, sym: m.d.name, desc: [d.p.desc, d.p.desc2].filter(Boolean).join(' '), part: d.p.part || '', maker: d.p.maker || (pt && pt.maker) || '',
        refs: d.all.slice().sort(byPos(A)).map((s) => s.ref).join(', '), page: m.ref, id: m.it.id, count: d.all.length
      };
    }).sort((a, b) => natural(a.tag, b.tag));
  }

  function bom(P, A) {
    A = A || M.analyze(P);
    const g = {};
    const add = (part, maker, desc, tag, qty) => {
      const k = (part || '—') + '|' + (part ? maker : desc);
      const r = g[k] || (g[k] = { part: part || '', maker: maker || '', desc: desc || '', qty: 0, tags: [] });
      r.qty += qty; if (tag) r.tags.push(tag);
    };
    Object.values(A.devices).forEach((d) => {
      if (d.role === 'terminal') {
        d.terminals.forEach((t) => { const p = t.it.p || {}; add(p.part || '', p.maker || '', p.part ? (partOf(P, p.part) || {}).desc || t.d.name : t.d.name, null, 1); });
        return;
      }
      const m = d.master || d.all[0]; if (!m || m.d.role === 'slave') return; // contacts without a master are not a part
      const pt = d.p.part ? partOf(P, d.p.part) : null;
      add(d.p.part, d.p.maker || (pt && pt.maker) || '', pt ? pt.desc : m.d.name + (d.p.desc ? ' (' + d.p.desc + ')' : ''), d.full, 1);
    });
    P.pages.forEach((pg) => pg.items.forEach((it) => {
      if (it.k !== 'cable') return; const p = it.p || {};
      add(p.part || '', p.maker || '', 'Kabel ' + (p.type || '') + (p.len ? ' (' + p.len + ' m)' : ''), M.fullTag(M.effFn(P, pg, it), M.effLoc(P, pg, it), it.tag), 1);
    }));
    (P.extras || []).forEach((x) => add(x.part, x.maker, x.desc, x.tag || '', +x.qty || 1));
    /* DIN rail and cable duct from the cabinet layout, in metres (rounded up to 0.1 m) */
    if (LE.cabinet) {
      const cl = LE.cabinet.cutList(P), m = (list) => Math.ceil(list.reduce((a, v) => a + v, 0) / 100) / 10;
      if (cl.rail.length) add('GEN-DIN-35', 'Generiek', 'Montagerail 35 mm in meter (stukken: ' + cl.rail.join(', ') + ' mm)', null, m(cl.rail));
      if (cl.duct.length) add('GEN-DUCT-40x60', 'Generiek', 'Bedradingskoker in meter (stukken: ' + cl.duct.join(', ') + ' mm)', null, m(cl.duct));
    }
    return Object.values(g).map((r) => Object.assign(r, { tags: r.tags.sort(natural).join(', ') })).sort((a, b) => natural(a.part || 'zzz' + a.desc, b.part || 'zzz' + b.desc));
  }

  /* terminal plan: per strip, both sides of each terminal; bridges where two terminals share a net */
  function terminals(P, A) {
    A = A || M.analyze(P);
    const strips = {};
    A.syms.forEach((s) => { if (s.d.role === 'terminal') (strips[M.fullTag(s.fn, s.loc, s.it.tag)] = strips[M.fullTag(s.fn, s.loc, s.it.tag)] || []).push(s); });
    return Object.keys(strips).sort(natural).map((name) => {
      const list = strips[name].sort((a, b) => natural(a.it.no || '', b.it.no || '') || byPos(A)(a, b));
      const rows = list.map((s) => {
        const inner = targets(A, s, s.pins[0]).filter((t) => t.indexOf(name + ':') !== 0);
        const outer = targets(A, s, s.pins[1]).filter((t) => t.indexOf(name + ':') !== 0);
        const bridged = list.filter((o) => o !== s && (o.pins[0].net === s.pins[0].net || o.pins[1].net === s.pins[1].net)).map((o) => o.it.no);
        const cab = cableOn(A, s.pins[1].net) || cableOn(A, s.pins[0].net);
        return { strip: name, no: s.it.no || '?', inner: inner.join(', '), outer: outer.join(', '), bridge: bridged.join(', '), cable: cab, page: s.ref, id: s.it.id, pe: s.d.id === 'term_pe' };
      });
      return { strip: name, rows };
    });
  }
  function cableOn(A, net) {
    for (const id of Object.keys(A.cables)) { const c = A.cables[id]; const h = c.cores.find((x) => x.net === net); if (h) return '-' + c.it.tag + ':' + h.core; }
    return '';
  }

  function cables(P, A) {
    A = A || M.analyze(P);
    return Object.keys(A.cables).map((id) => {
      const c = A.cables[id], p = c.it.p || {}, from = new Set(), to = new Set();
      const cores = c.cores.map((h) => {
        const ends = [h.w.pts[0], h.w.pts[h.w.pts.length - 1]].map((pt) => endName(A, c.pg, pt));
        if (ends[0]) from.add(ends[0].split(':')[0]); if (ends[1]) to.add(ends[1].split(':')[0]);
        return { core: h.core, color: h.color, size: h.size, from: ends[0] || '', to: ends[1] || '', wireNo: A.wireNo[h.net] || '' };
      });
      const total = coresInType(p.type);
      return { tag: '-' + c.it.tag, type: p.type || '', len: p.len || '', used: cores.length, total: total || '', from: [...from].join(', '), to: [...to].join(', '), page: M.pageLabel(c.pg) + '.' + M.colOf(P, Math.min(c.it.a[0], c.it.b[0])), id: c.it.id, cores };
    }).sort((a, b) => natural(a.tag, b.tag));
  }
  function coresInType(type) { const m = /(\d+)\s*[xXgG×]\s*\d/.exec(String(type || '')); return m ? +m[1] : 0; }
  function endName(A, pg, pt) {
    const s = A.syms.find((x) => x.pg === pg && x.pins.some((p) => p.x === pt[0] && p.y === pt[1]));
    if (!s) return '';
    const p = s.pins.find((q) => q.x === pt[0] && q.y === pt[1]);
    return pinName(s, p);
  }

  /* wiring list: every net as a chain of point-to-point connections between device terminals */
  function wires(P, A) {
    A = A || M.analyze(P);
    const out = [];
    A.nets.forEach((n) => {
      const pins = n.pins.filter((q) => q.sym.d.role !== 'ref' && q.sym.d.role !== 'plain').slice().sort((a, b) => (A.pageIdx[a.sym.pg.id] - A.pageIdx[b.sym.pg.id]) || (a.pin.x - b.pin.x) || (a.pin.y - b.pin.y));
      const w = n.wires[0] && n.wires[0].w, no = A.wireNo[n.id] || '';
      for (let i = 1; i < pins.length; i++) {
        out.push({ no, from: pinName(pins[i - 1].sym, pins[i - 1].pin), to: pinName(pins[i].sym, pins[i].pin), page: pins[i - 1].sym.ref, color: (w && w.color) || '', size: (w && w.size) || '', pot: n.name });
      }
    });
    return out.sort((a, b) => natural(a.no, b.no) || natural(a.from, b.from));
  }

  function plcio(P, A) {
    A = A || M.analyze(P);
    const rows = [];
    A.syms.forEach((s) => {
      if (s.d.kind !== 'DI' && s.d.kind !== 'DO') return;
      const p = s.it.p || {}, pin = s.d.kind === 'DI' ? s.pins[0] : s.pins[1];
      const conn = pin ? targets(A, s, pin).filter((t) => t.indexOf('potentiaal') !== 0) : [];
      rows.push({ plc: s.dev ? s.dev.full : '-' + s.it.tag, addr: p.addr || '?', dir: s.d.kind === 'DI' ? 'Ingang' : 'Uitgang', desc: p.desc || '', conn: conn.join(', '), page: s.ref, id: s.it.id });
    });
    return rows.sort((a, b) => natural(a.plc, b.plc) || (a.dir === b.dir ? 0 : a.dir === 'Ingang' ? -1 : 1) || natural(a.addr, b.addr));
  }

  function contacts(P, A) {
    A = A || M.analyze(P);
    const rows = [];
    Object.values(A.devices).forEach((d) => {
      if (!d.slaves.length && !(d.master && d.master.d.mirror)) return;
      rows.push({ group: d.full + (d.master ? ' — ' + d.master.d.name + ' (' + d.master.ref + ')' : ' — GEEN SPOEL/TOESTEL') });
      d.slaves.forEach((s) => rows.push({ tag: d.full, kind: s.d.name, pins: s.pins.map((p) => p.n).join('-'), page: s.ref, id: s.it.id }));
      if (!d.slaves.length) rows.push({ tag: d.full, kind: 'geen contacten', pins: '', page: '' });
    });
    return rows;
  }

  function contents(P) {
    return P.pages.map((pg) => ({ page: M.pageLabel(pg), title: pg.title || '', fn: pg.fn ? '=' + pg.fn : '', loc: pg.loc ? '+' + pg.loc : '', kind: pg.kind === 'cover' ? 'Voorblad' : pg.kind === 'cabinet' ? 'Kastindeling' : 'Stroomschema', id: pg.id }));
  }

  /* ---------- definitions shared by tables, graphical lists and CSV ---------- */
  const DEFS = {
    contents: { title: 'Inhoudsopgave', cols: [{ k: 'page', h: 'Blad', w: 1 }, { k: 'title', h: 'Omschrijving', w: 6 }, { k: 'kind', h: 'Soort', w: 2 }, { k: 'fn', h: 'Functie', w: 1.5 }, { k: 'loc', h: 'Plaats', w: 1.5 }], rows: (P) => contents(P) },
    bom: { title: 'Stuklijst', cols: [{ k: 'qty', h: 'Aantal', w: 1 }, { k: 'part', h: 'Artikelnummer', w: 3 }, { k: 'maker', h: 'Fabrikant', w: 2 }, { k: 'desc', h: 'Omschrijving', w: 5 }, { k: 'tags', h: 'Tags', w: 4 }], rows: bom },
    components: { title: 'Componentenlijst', cols: [{ k: 'tag', h: 'Tag', w: 2 }, { k: 'sym', h: 'Soort', w: 4 }, { k: 'desc', h: 'Omschrijving', w: 4 }, { k: 'part', h: 'Artikelnummer', w: 3 }, { k: 'refs', h: 'Blad.kolom', w: 3 }], rows: components },
    terminals: { title: 'Klemmenplan', cols: [{ k: 'no', h: 'Klem', w: 1 }, { k: 'inner', h: 'Binnen (kast)', w: 5 }, { k: 'outer', h: 'Buiten (veld)', w: 5 }, { k: 'cable', h: 'Kabel:ader', w: 2 }, { k: 'bridge', h: 'Brug', w: 1.2 }, { k: 'page', h: 'Blad', w: 1.2 }],
      rows: (P, A) => { const out = []; terminals(P, A).forEach((s) => { out.push({ group: 'Klemmenstrook ' + s.strip }); s.rows.forEach((r) => out.push(r)); }); return out; } },
    cables: { title: 'Kabellijst', cols: [{ k: 'tag', h: 'Kabel', w: 1.5 }, { k: 'type', h: 'Type', w: 3 }, { k: 'used', h: 'Aders gebruikt', w: 1.5 }, { k: 'total', h: 'Aders', w: 1 }, { k: 'len', h: 'Lengte (m)', w: 1.3 }, { k: 'from', h: 'Van', w: 3 }, { k: 'to', h: 'Naar', w: 3 }, { k: 'page', h: 'Blad', w: 1.2 }], rows: cables },
    cores: { title: 'Aderlijst', cols: [{ k: 'cable', h: 'Kabel', w: 1.5 }, { k: 'core', h: 'Ader', w: 1 }, { k: 'color', h: 'Kleur', w: 1.2 }, { k: 'size', h: 'mm²', w: 1 }, { k: 'from', h: 'Van', w: 4 }, { k: 'to', h: 'Naar', w: 4 }, { k: 'wireNo', h: 'Draadnr.', w: 1.5 }],
      rows: (P, A) => { const out = []; cables(P, A).forEach((c) => c.cores.forEach((x) => out.push(Object.assign({ cable: c.tag }, x)))); return out; } },
    wires: { title: 'Draadlijst', cols: [{ k: 'no', h: 'Draadnr.', w: 1.5 }, { k: 'from', h: 'Van', w: 4 }, { k: 'to', h: 'Naar', w: 4 }, { k: 'pot', h: 'Potentiaal', w: 1.5 }, { k: 'color', h: 'Kleur', w: 1 }, { k: 'size', h: 'mm²', w: 1 }, { k: 'page', h: 'Blad', w: 1.2 }], rows: wires },
    plcio: { title: 'PLC-toewijzingslijst', cols: [{ k: 'plc', h: 'PLC', w: 1.5 }, { k: 'addr', h: 'Adres', w: 1.2 }, { k: 'dir', h: 'Richting', w: 1.5 }, { k: 'desc', h: 'Omschrijving', w: 4 }, { k: 'conn', h: 'Aangesloten op', w: 4 }, { k: 'page', h: 'Blad', w: 1.2 }], rows: plcio },
    contacts: { title: 'Contactenlijst', cols: [{ k: 'tag', h: 'Tag', w: 2 }, { k: 'kind', h: 'Contact', w: 5 }, { k: 'pins', h: 'Aansluitingen', w: 2 }, { k: 'page', h: 'Blad.kolom', w: 2 }], rows: contacts }
  };
  const ORDER = ['contents', 'bom', 'components', 'terminals', 'cables', 'cores', 'wires', 'plcio', 'contacts'];

  /* graphical list pages for printing (split over as many pages as needed) */
  function listPages(P, A, which) {
    A = A || M.analyze(P);
    const R = LE.render, per = R.rowsPerPage(P), out = [];
    (which || ORDER).forEach((k) => {
      const def = DEFS[k]; if (!def) return;
      const rows = def.rows(P, A); if (!rows.length && k !== 'contents') return;
      for (let i = 0; i < Math.max(1, rows.length); i += per) out.push({ key: k, title: def.title + (rows.length > per ? ' (' + (Math.floor(i / per) + 1) + ')' : ''), rows: rows.slice(i, i + per), def });
    });
    const total = P.pages.length + out.length;
    const base = P.pages.reduce((m, p) => Math.max(m, p.no), 0);
    return out.map((l, i) => ({ id: 'list:' + l.key + ':' + i, kind: 'list', key: l.key, title: l.title, no: base + i + 1, total, prims: () => R.tablePage(P, l.title, l.def.cols, l.rows, { no: base + i + 1, total, title: l.title }) }));
  }

  /* CSV (semicolon separated, opens directly in Excel with Dutch settings) */
  function csv(P, key, A) {
    const def = DEFS[key]; if (!def) return '';
    const q = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const rows = def.rows(P, A || M.analyze(P)).filter((r) => !r.group);
    return '﻿' + [def.cols.map((c) => q(c.h)).join(';')].concat(rows.map((r) => def.cols.map((c) => q(r[c.k])).join(';'))).join('\r\n');
  }

  return { components, bom, terminals, cables, wires, plcio, contacts, contents, DEFS, ORDER, listPages, csv, coresInType, natural };
})();
if (typeof module !== 'undefined') module.exports = LE;
