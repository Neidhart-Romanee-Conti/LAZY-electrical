/* LAZY Electrical checks (electrical rule check). Every message is in Dutch and points at a page and item,
   so the app can jump to it. Levels: 'error' (the circuit is wrong), 'warn' (probably wrong), 'info'.
   The AI assistant gets the errors back and must fix them before its answer is accepted. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.checks = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols;

  function run(P, A) {
    A = A || M.analyze(P);
    const out = [], add = (level, msg, s, extra) => out.push(Object.assign({ level, msg, page: s && s.pg ? s.pg.id : null, id: s && s.it ? s.it.id : null, where: s && s.ref ? s.ref : '' }, extra || {}));
    const devs = Object.values(A.devices);

    /* tags and devices */
    A.syms.forEach((s) => {
      if (s.d.role === 'slave' && !s.it.tag) add('error', 'Contact zonder tag op blad ' + s.ref + ': geef de tag van de spoel of het toestel waartoe het hoort.', s);
      if (s.d.role === 'terminal' && !s.it.no) add('warn', 'Klem ' + M.fullTag(s.fn, s.loc, s.it.tag) + ' op blad ' + s.ref + ' heeft geen klemnummer.', s);
    });
    devs.forEach((d) => {
      if (d.role === 'terminal') return;
      if (d.masters.length > 1) d.masters.slice(1).forEach((s) => add('error', 'Tag ' + d.full + ' is twee keer gebruikt (' + d.masters.map((x) => x.d.name.toLowerCase() + ' op ' + x.ref).join(' en ') + ').', s));
      if (!d.master && d.slaves.length) d.slaves.forEach((s) => add('error', 'Contact ' + d.full + ' (blad ' + s.ref + ') hoort bij geen spoel of toestel: teken de spoel ' + d.full + ' of verander de tag.', s));
      if (d.master && d.master.d.id.indexOf('coil') === 0 && !d.slaves.length) add('warn', 'Spoel ' + d.full + ' heeft nog geen contacten.', d.master);
      if (d.master && d.slaves.length) {
        const pt = d.p.part ? (P.parts || []).find((x) => x.part === d.p.part) || (LE.parts && LE.parts.find(d.p.part)) : null;
        const cap = pt && pt.contacts;
        if (cap) {
          const n = { main: 0, NO: 0, NC: 0 };
          d.slaves.forEach((s) => { const k = s.d.kind; if (k === 'main') n.main += s.d.poles || 1; else if (k === 'NO' || k === 'tNO' || k === 'thNO') n.NO++; else if (k === 'NC' || k === 'tNC' || k === 'thNC') n.NC++; else if (k === 'CO') { n.NO++; n.NC++; } });
          [['main', 'hoofdcontacten'], ['NO', 'maakcontacten (NO)'], ['NC', 'verbreekcontacten (NC)']].forEach(([k, nm]) => {
            if (cap[k] != null && n[k] > cap[k]) add('warn', d.full + ' gebruikt ' + n[k] + ' ' + nm + ', maar ' + d.p.part + ' heeft er maar ' + cap[k] + '. Voeg een hulpcontactblok toe of kies een ander artikel.', d.master);
          });
        }
      }
    });
    /* PLC: one address per channel */
    const addr = {};
    A.syms.forEach((s) => {
      if (s.d.kind !== 'DI' && s.d.kind !== 'DO') return;
      const k = (s.dev ? s.dev.key : s.it.tag) + '|' + ((s.it.p || {}).addr || '');
      if (addr[k]) add('error', 'PLC-adres ' + (s.it.p || {}).addr + ' van ' + (s.dev ? s.dev.full : s.it.tag) + ' is twee keer gebruikt (' + addr[k].ref + ' en ' + s.ref + ').', s);
      else addr[k] = s;
    });
    /* terminal numbers unique per strip */
    const tno = {};
    A.syms.forEach((s) => {
      if (s.d.role !== 'terminal' || !s.it.no || s.it.no === 'PE') return; // several PE terminals in one strip is normal
      const k = M.fullTag(s.fn, s.loc, s.it.tag) + ':' + s.it.no;
      if (tno[k]) add('error', 'Klem ' + k + ' bestaat twee keer (' + tno[k].ref + ' en ' + s.ref + ').', s); else tno[k] = s;
    });

    /* connections */
    A.nets.forEach((n) => {
      if (n.pots.size > 1) {
        const s = n.pins[0] ? n.pins[0].sym : null, w = n.wires[0];
        add('error', 'Kortsluiting: de potentialen ' + [...n.pots].join(' en ') + ' zijn met elkaar verbonden.', s || (w ? { pg: w.pg, it: w.w, ref: M.pageLabel(w.pg) } : null));
      }
    });
    A.syms.forEach((s) => {
      if (s.d.role === 'plain' || s.d.role === 'ref') return;
      s.pins.forEach((p) => {
        const n = A.nets[p.net];
        const alone = n && n.pins.length === 1 && !n.wires.length && !n.pots.size;
        if (alone && s.d.role !== 'terminal') add('warn', 'Aansluiting ' + (s.dev ? s.dev.full : '-' + (s.it.tag || '?')) + ':' + (p.n || p.i + 1) + ' (blad ' + s.ref + ') is niet aangesloten.', s);
      });
      if (s.d.role === 'terminal') {
        const free = s.pins.filter((p) => { const n = A.nets[p.net]; return n && n.pins.length === 1 && !n.wires.length && !n.pots.size; });
        if (free.length === 2) add('warn', 'Klem ' + M.fullTag(s.fn, s.loc, s.it.tag) + ':' + (s.it.no || '?') + ' (blad ' + s.ref + ') is aan geen enkele kant aangesloten.', s);
      }
      /* both sides of a contact or coil on the same net: it is bridged and does nothing */
      (s.d.pairs || []).forEach((pr) => {
        const a = s.pins[pr[0]], b = s.pins[pr[1]];
        if (a && b && a.net === b.net && !(s.d.through || []).length) add(s.d.kind || s.d.role === 'master' ? 'error' : 'warn', (s.dev ? s.dev.full : s.d.name) + ' (blad ' + s.ref + ') is overbrugd: ' + (a.n || '') + ' en ' + (b.n || '') + ' zitten op dezelfde draad.', s);
      });
    });
    /* loose wire ends */
    P.pages.forEach((pg) => {
      const pins = new Set(), ends = {}, segs = [];
      A.syms.filter((s) => s.pg === pg).forEach((s) => s.pins.forEach((p) => pins.add(p.x + ',' + p.y)));
      const wires = pg.items.filter((i) => i.k === 'wire'), pots = pg.items.filter((i) => i.k === 'pot');
      wires.forEach((w) => { w.pts.forEach((p, j) => { const k = p[0] + ',' + p[1]; ends[k] = (ends[k] || 0) + (j === 0 || j === w.pts.length - 1 ? 1 : 2); }); for (let j = 1; j < w.pts.length; j++) segs.push([w.pts[j - 1], w.pts[j]]); });
      wires.forEach((w) => [w.pts[0], w.pts[w.pts.length - 1]].forEach((p) => {
        const k = p[0] + ',' + p[1];
        if (pins.has(k) || ends[k] > 1) return;
        if (segs.some((sg) => M.onSeg(p, sg[0], sg[1]))) return;
        if (pots.some((r) => r.y === p[1] && p[0] >= Math.min(r.x1, r.x2) && p[0] <= Math.max(r.x1, r.x2))) return;
        add('warn', 'Losse draad op blad ' + M.pageLabel(pg) + ' (kolom ' + M.colOf(P, p[0]) + '): het draadeinde is nergens op aangesloten.', { pg, it: w, ref: M.pageLabel(pg) + '.' + M.colOf(P, p[0]) });
      }));
    });
    /* continuation arrows need a partner */
    A.syms.forEach((s) => {
      if (s.d.role !== 'ref') return;
      if (!(s.it.p || {}).name) add('warn', 'Draadverwijzing op blad ' + s.ref + ' heeft geen naam.', s);
      else if (!(A.refInfo[s.it.id] || []).length) add('warn', 'Draadverwijzing "' + s.it.p.name + '" (blad ' + s.ref + ') heeft geen tegenhanger.', s);
    });
    /* cables: no more wires than cores */
    Object.keys(A.cables).forEach((id) => {
      const c = A.cables[id], total = LE.lists ? LE.lists.coresInType((c.it.p || {}).type) : 0;
      const ref = { pg: c.pg, it: c.it, ref: M.pageLabel(c.pg) };
      if (!c.cores.length) add('warn', 'Kabel -' + c.it.tag + ' (blad ' + M.pageLabel(c.pg) + ') kruist geen draden.', ref);
      else if (total && c.cores.length > total) add('error', 'Kabel -' + c.it.tag + ' heeft ' + total + ' aders, maar er lopen ' + c.cores.length + ' draden door.', ref);
    });
    if (LE.cabinet) LE.cabinet.check(P, A, add);
    const order = { error: 0, warn: 1, info: 2 };
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }
  function count(list) { return { error: list.filter((x) => x.level === 'error').length, warn: list.filter((x) => x.level === 'warn').length }; }
  return { run, count };
})();
if (typeof module !== 'undefined') module.exports = LE;
