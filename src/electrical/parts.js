/* LAZY Electrical parts database. The built-in catalogue is a small generic starter set (no invented manufacturer
   part numbers): import your supplier's catalogue as CSV for real part numbers. A part tells the program how many
   contacts a device really has (contact check), its size (cabinet layout) and its heat loss (heat calculation).
   contacts: main = power poles, NO / NC = auxiliary contacts. Sizes in mm (width x height x depth). */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.parts = (function () {
  'use strict';
  const G = 'Generiek';
  const CAT = [
    { part: 'GEN-CT-9A-10', maker: G, desc: 'Contactor 9 A AC-3, 1 NO hulpcontact, spoel 230 V AC', sym: ['coil', 'main3'], contacts: { main: 3, NO: 1, NC: 0 }, w: 45, h: 85, d: 90, loss: 2 },
    { part: 'GEN-CT-9A-01', maker: G, desc: 'Contactor 9 A AC-3, 1 NC hulpcontact, spoel 230 V AC', sym: ['coil', 'main3'], contacts: { main: 3, NO: 0, NC: 1 }, w: 45, h: 85, d: 90, loss: 2 },
    { part: 'GEN-CT-18A-11', maker: G, desc: 'Contactor 18 A AC-3, 1 NO + 1 NC, spoel 230 V AC', sym: ['coil', 'main3'], contacts: { main: 3, NO: 1, NC: 1 }, w: 45, h: 85, d: 95, loss: 3 },
    { part: 'GEN-CT-25A-22', maker: G, desc: 'Contactor 25 A AC-3, 2 NO + 2 NC, spoel 230 V AC', sym: ['coil', 'main3'], contacts: { main: 3, NO: 2, NC: 2 }, w: 55, h: 85, d: 100, loss: 4 },
    { part: 'GEN-CT-9A-24VDC', maker: G, desc: 'Contactor 9 A AC-3, 1 NO + 1 NC, spoel 24 V DC', sym: ['coil', 'main3'], contacts: { main: 3, NO: 1, NC: 1 }, w: 45, h: 85, d: 95, loss: 3 },
    { part: 'GEN-AUX-11', maker: G, desc: 'Hulpcontactblok 1 NO + 1 NC (opbouw voorzijde)', sym: [], contacts: { NO: 1, NC: 1 }, w: 45, h: 40, d: 40, loss: 0 },
    { part: 'GEN-AUX-22', maker: G, desc: 'Hulpcontactblok 2 NO + 2 NC (opbouw voorzijde)', sym: [], contacts: { NO: 2, NC: 2 }, w: 45, h: 40, d: 40, loss: 0 },
    { part: 'GEN-RL-2CO-230', maker: G, desc: 'Hulprelais 2 wisselcontacten, spoel 230 V AC, met voet', sym: ['coil'], contacts: { NO: 2, NC: 2 }, w: 16, h: 80, d: 75, loss: 1 },
    { part: 'GEN-RL-2CO-24', maker: G, desc: 'Hulprelais 2 wisselcontacten, spoel 24 V DC, met voet', sym: ['coil'], contacts: { NO: 2, NC: 2 }, w: 16, h: 80, d: 75, loss: 0.5 },
    { part: 'GEN-TR-ON-1CO', maker: G, desc: 'Tijdrelais opkomend vertraagd 0,1 s–10 min, 1 wissel, 24–240 V', sym: ['coil_ton'], contacts: { NO: 1, NC: 1 }, w: 18, h: 90, d: 65, loss: 1 },
    { part: 'GEN-TR-OFF-1CO', maker: G, desc: 'Tijdrelais afvallend vertraagd 0,1 s–10 min, 1 wissel, 24–240 V', sym: ['coil_tof'], contacts: { NO: 1, NC: 1 }, w: 18, h: 90, d: 65, loss: 1 },
    { part: 'GEN-MPCB-4A', maker: G, desc: 'Motorbeveiligingsschakelaar 2,5–4 A, 1 NO + 1 NC hulpcontact', sym: ['mpcb3'], contacts: { main: 3, NO: 1, NC: 1 }, w: 45, h: 90, d: 95, loss: 5 },
    { part: 'GEN-MPCB-10A', maker: G, desc: 'Motorbeveiligingsschakelaar 6,3–10 A, 1 NO + 1 NC hulpcontact', sym: ['mpcb3'], contacts: { main: 3, NO: 1, NC: 1 }, w: 45, h: 90, d: 95, loss: 7 },
    { part: 'GEN-OL-4A', maker: G, desc: 'Thermisch relais 2,8–4 A, 1 NO + 1 NC (97-98 / 95-96)', sym: ['ol3'], contacts: { NO: 1, NC: 1 }, w: 45, h: 75, d: 90, loss: 4 },
    { part: 'GEN-OL-10A', maker: G, desc: 'Thermisch relais 7–10 A, 1 NO + 1 NC (97-98 / 95-96)', sym: ['ol3'], contacts: { NO: 1, NC: 1 }, w: 45, h: 75, d: 90, loss: 5 },
    { part: 'GEN-MCB-C6-1P', maker: G, desc: 'Installatieautomaat C6 1P', sym: ['mcb1'], w: 18, h: 90, d: 70, loss: 1.5 },
    { part: 'GEN-MCB-C10-1P', maker: G, desc: 'Installatieautomaat C10 1P', sym: ['mcb1'], w: 18, h: 90, d: 70, loss: 2 },
    { part: 'GEN-MCB-C6-2P', maker: G, desc: 'Installatieautomaat C6 2P (1P+N)', sym: ['mcb2'], w: 36, h: 90, d: 70, loss: 3 },
    { part: 'GEN-MCB-C10-2P', maker: G, desc: 'Installatieautomaat C10 2P (1P+N)', sym: ['mcb2'], w: 36, h: 90, d: 70, loss: 3.5 },
    { part: 'GEN-MCB-C16-3P', maker: G, desc: 'Installatieautomaat C16 3P', sym: ['mcb3'], w: 54, h: 90, d: 70, loss: 6 },
    { part: 'GEN-MCB-C20-4P', maker: G, desc: 'Installatieautomaat C20 4P', sym: ['mcb4'], w: 72, h: 90, d: 70, loss: 8 },
    { part: 'GEN-RCD-40-30-4P', maker: G, desc: 'Aardlekschakelaar 40 A 30 mA 4P', sym: ['rcd4'], w: 72, h: 90, d: 75, loss: 4 },
    { part: 'GEN-ISO-25-3P', maker: G, desc: 'Hoofdschakelaar 25 A 3P, deurgreep', sym: ['isol3'], w: 45, h: 90, d: 85, loss: 2 },
    { part: 'GEN-PSU-24V-2.5A', maker: G, desc: 'Voeding 100–240 V AC / 24 V DC 2,5 A (60 W)', sym: ['psu'], w: 36, h: 90, d: 60, loss: 7 },
    { part: 'GEN-PSU-24V-5A', maker: G, desc: 'Voeding 100–240 V AC / 24 V DC 5 A (120 W)', sym: ['psu'], w: 54, h: 90, d: 60, loss: 12 },
    { part: 'GEN-PB-NO-GN', maker: G, desc: 'Drukknop groen, 1 NO, Ø22 mm', sym: ['pb_no'], contacts: { NO: 1 }, w: 30, h: 30, d: 50, loss: 0 },
    { part: 'GEN-PB-NC-RD', maker: G, desc: 'Drukknop rood, 1 NC, Ø22 mm', sym: ['pb_nc'], contacts: { NC: 1 }, w: 30, h: 30, d: 50, loss: 0 },
    { part: 'GEN-ES-NC', maker: G, desc: 'Noodstop paddenstoel Ø40, draai-ontgrendeling, 1 NC', sym: ['estop'], contacts: { NC: 1 }, w: 40, h: 40, d: 60, loss: 0 },
    { part: 'GEN-LMP-GN-230', maker: G, desc: 'Signaallamp LED groen 230 V AC, Ø22 mm', sym: ['lamp'], w: 30, h: 30, d: 50, loss: 0.5 },
    { part: 'GEN-LMP-RD-230', maker: G, desc: 'Signaallamp LED rood 230 V AC, Ø22 mm', sym: ['lamp'], w: 30, h: 30, d: 50, loss: 0.5 },
    { part: 'GEN-TB-2.5', maker: G, desc: 'Doorgangsklem 2,5 mm² grijs', sym: ['term'], w: 5.2, h: 50, d: 40, loss: 0 },
    { part: 'GEN-TB-PE-2.5', maker: G, desc: 'Aardklem 2,5 mm² groen/geel', sym: ['term_pe'], w: 5.2, h: 50, d: 40, loss: 0 },
    { part: 'GEN-TB-END', maker: G, desc: 'Eindplaat voor doorgangsklem', sym: [], w: 1, h: 50, d: 40, loss: 0 },
    { part: 'GEN-DIN-35', maker: G, desc: 'Montagerail 35 mm (per meter)', sym: [], w: 1000, h: 35, d: 7.5, loss: 0 },
    { part: 'GEN-DUCT-40x60', maker: G, desc: 'Bedradingskoker 40 x 60 mm (per meter)', sym: [], w: 1000, h: 40, d: 60, loss: 0 },
    { part: '6ED1 052-1MD08-0BA1', maker: 'Siemens', desc: 'LOGO! 12/24RCE, 8 DI (4 AI), 4 DO relais 10 A', sym: ['plc'], io: { DI: 8, DO: 4 }, w: 71.5, h: 90, d: 60, loss: 2 },
    { part: '6ED1 052-1HB08-0BA1', maker: 'Siemens', desc: 'LOGO! 24RCE, 8 DI, 4 DO relais 10 A', sym: ['plc'], io: { DI: 8, DO: 4 }, w: 71.5, h: 90, d: 60, loss: 2 },
    { part: '6ED1 052-1CC08-0BA1', maker: 'Siemens', desc: 'LOGO! 24CE, 8 DI (4 AI), 4 DO transistor 0,3 A', sym: ['plc'], io: { DI: 8, DO: 4 }, w: 71.5, h: 90, d: 60, loss: 2 }
  ];
  let extra = [];
  /* the project's own parts (imported or typed in) come first */
  function setProject(P) { extra = (P && P.parts) || []; }
  function all() { return extra.concat(CAT.filter((c) => !extra.some((e) => e.part === c.part))); }
  function find(part) { if (!part) return null; return all().find((c) => c.part === part) || null; }
  function forSymbol(id) { return all().filter((c) => !c.sym || !c.sym.length || c.sym.indexOf(id) >= 0); }
  /* CSV import: header row with (some of) part;maker;desc;symbols;main;no;nc;w;h;d;loss — comma or semicolon separated */
  function fromCSV(txt) {
    const lines = String(txt || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
    const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((s) => s.trim()); };
    const head = split(lines[0]).map((h) => h.toLowerCase());
    const col = (names) => head.findIndex((h) => names.some((n) => h === n || h.indexOf(n) === 0));
    const ix = { part: col(['part', 'artikel', 'bestel', 'code']), maker: col(['maker', 'fabrikant', 'merk']), desc: col(['desc', 'omschrijving', 'beschrijving']), sym: col(['sym', 'symbool']), main: col(['main', 'hoofd']), no: col(['no', 'maak']), nc: col(['nc', 'verbreek']), w: col(['w', 'breedte']), h: col(['h', 'hoogte']), d: col(['d', 'diepte']), loss: col(['loss', 'verlies', 'warmte']) };
    if (ix.part < 0) throw new Error('kolom met artikelnummer (part / artikelnummer) ontbreekt');
    const num = (v) => { const n = parseFloat(String(v || '').replace(',', '.')); return isFinite(n) ? n : undefined; };
    return lines.slice(1).map((l) => {
      const c = split(l), g = (k) => (ix[k] >= 0 ? c[ix[k]] : '');
      if (!g('part')) return null;
      const o = { part: g('part'), maker: g('maker'), desc: g('desc'), sym: g('sym') ? g('sym').split(/[\s|/]+/).filter(Boolean) : [] };
      const ct = { main: num(g('main')), NO: num(g('no')), NC: num(g('nc')) };
      if (ct.main != null || ct.NO != null || ct.NC != null) o.contacts = ct;
      ['w', 'h', 'd', 'loss'].forEach((k) => { const v = num(g(k)); if (v != null) o[k] = v; });
      return o;
    }).filter(Boolean);
  }
  return { CAT, all, find, forSymbol, setProject, fromCSV };
})();
if (typeof module !== 'undefined') module.exports = LE;
