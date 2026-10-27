/* LAZY Electrical built-in symbol library (original IEC 60617-style drawings, free to use under the project license).
   Coordinates are in grid units with y pointing down; the first pin sits at (0,0). Pins are always whole grid units,
   so every placed symbol connects exactly on the grid.
   Graphics: ['l',x1,y1,x2,y2] line · ['d',x1,y1,x2,y2] dashed line · ['p',[[x,y]..],closed,fill] polyline ·
   ['c',x,y,r,fill] circle · ['r',x,y,w,h,fill] rectangle · ['a',cx,cy,r,a0,a1] arc (degrees, y down) ·
   ['t',x,y,text,size,anchor] fixed text. fill: 'k' black, 'w' white. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.symbols = (function () {
  'use strict';
  const S = {};
  const CATS = ['Contacten', 'Spoelen', 'Beveiliging', 'Schakelaars', 'Verbruikers', 'Voeding', 'Klemmen en verbindingen', 'PLC'];

  /* roles: master = the device itself (coil, breaker); slave = belongs to a master with the same tag (contacts);
     device = stand-alone device that may be drawn in several pieces (push button with two contact blocks);
     terminal = one terminal of a strip; ref = continuation arrow; plain = no device (ground mark). */
  function def(id, o) {
    o.id = id;
    o.pins = o.pins || [];
    o.g = o.g || [];
    if (!o.pairs) o.pairs = o.pins.length === 2 && !o.end ? [[0, 1]] : [];
    o.lab = o.lab || [-0.7, 0.9];
    S[id] = o;
  }

  /* ---------- drawing helpers ---------- */
  const BL = 0.6, BH = 1.4; // where the fixed contact and the pivot sit on a 2-unit contact
  function noPole(x, g) { g.push(['l', x, 0, x, BL], ['l', x, 2, x, BH], ['l', x, BH, x - 0.5, 0.55]); return [x - 0.25, 0.98]; }
  function ncPole(x, g) { g.push(['l', x, 0, x, BL], ['l', x, BL, x + 0.35, BL], ['l', x, 2, x, BH], ['l', x, BH, x + 0.45, 0.45]); return [x + 0.22, 0.93]; }
  function actuator(type, bx, y, g, xa) {
    xa = xa == null ? -1.0 : xa;
    if (type !== 'none') g.push(['d', bx, y, xa, y]);
    if (type === 'push') g.push(['l', xa, y - 0.3, xa, y + 0.3], ['l', xa, y - 0.3, xa + 0.18, y - 0.3], ['l', xa, y + 0.3, xa + 0.18, y + 0.3]);
    else if (type === 'estop') g.push(['l', xa, y - 0.38, xa, y + 0.38], ['a', xa, y, 0.38, 90, 270]);
    else if (type === 'turn') g.push(['p', [[xa + 0.18, y - 0.3], [xa, y - 0.3], [xa, y + 0.3], [xa - 0.18, y + 0.3]]]);
    else if (type === 'limit') g.push(['p', [[xa, y], [xa - 0.35, y - 0.22], [xa - 0.35, y + 0.22]], true]);
    else if (type === 'prox') g.push(['p', [[xa, y], [xa - 0.25, y - 0.25], [xa - 0.5, y], [xa - 0.25, y + 0.25]], true], ['l', xa - 0.4, y - 0.1, xa - 0.1, y - 0.1]);
    else if (type === 'float') g.push(['l', xa, y, xa, y + 0.35], ['c', xa, y + 0.55, 0.2]);
    else if (type === 'thermal') g.push(['p', [[xa, y], [xa, y - 0.2], [xa - 0.3, y - 0.2], [xa - 0.3, y + 0.2], [xa - 0.6, y + 0.2]]]);
    else if (type === 'ton') g.push(['a', xa - 0.25, y, 0.25, -90, 90]);
    else if (type === 'tof') g.push(['a', xa + 0.25, y, 0.25, 90, 270]);
    else if (type === 'breaker') g.push(['r', xa - 0.45, y - 0.25, 0.45, 0.5], ['p', [[xa - 0.38, y + 0.12], [xa - 0.22, y + 0.12], [xa - 0.22, y - 0.12], [xa - 0.07, y - 0.12]]]);
    else if (type === 'motorprot') g.push(['r', xa - 0.45, y - 0.25, 0.45, 0.5], ['p', [[xa - 0.45, y], [xa - 0.6, y], [xa - 0.6, y - 0.2], [xa - 0.85, y - 0.2], [xa - 0.85, y + 0.2], [xa - 1.05, y + 0.2]]]);
    else if (type === 'rcd') g.push(['r', xa - 0.7, y - 0.3, 0.7, 0.6], ['t', xa - 0.35, y + 0.15, 'IΔ', 0.38, 'middle']);
    return xa;
  }
  /* contact symbols: one pole, optional actuator on the left */
  function contact(kind, act) {
    const g = [], m = kind === 'NC' ? ncPole(0, g) : noPole(0, g);
    let left = -0.7;
    if (act) left = actuator(act, m[0], m[1], g) - (act === 'thermal' || act === 'motorprot' ? 0.75 : act === 'prox' ? 0.65 : act === 'limit' ? 0.5 : 0.45);
    return { g, lab: [left, 0.9] };
  }
  /* multi-pole switching devices: poles 1 unit apart, linked by a dashed line */
  function poles(n, pole, act, mark) {
    const g = [], mids = [];
    for (let i = 0; i < n; i++) {
      mids.push(pole === 'NC' ? ncPole(i, g) : noPole(i, g));
      if (mark === 'x') g.push(['l', i - 0.15, BL - 0.15, i + 0.15, BL + 0.15], ['l', i + 0.15, BL - 0.15, i - 0.15, BL + 0.15]);
      if (mark === 'arc') g.push(['a', i, BL + 0.15, 0.15, 90, 270]);
      if (mark === 'bar') g.push(['l', i - 0.15, BL, i + 0.15, BL]);
    }
    if (n > 1) g.push(['d', mids[0][0], mids[0][1], mids[n - 1][0], mids[n - 1][1]]);
    let left = -0.7;
    if (act) left = actuator(act, mids[0][0], mids[0][1], g) - (act === 'motorprot' ? 1.2 : act === 'rcd' ? 0.9 : 0.65);
    const pins = [];
    for (let i = 0; i < n; i++) pins.push({ n: String(2 * i + 1), x: i, y: 0 }, { n: String(2 * i + 2), x: i, y: 2 });
    const pairs = []; for (let i = 0; i < n; i++) pairs.push([2 * i, 2 * i + 1]);
    return { g, pins, pairs, lab: [left, 0.9], poles: n };
  }
  const pin2 = (a, b) => [{ n: a, x: 0, y: 0 }, { n: b, x: 0, y: 2 }];

  /* ---------- contacts ---------- */
  const C = 'Contacten';
  def('no', Object.assign(contact('NO'), { name: 'Maakcontact (NO)', cat: C, role: 'slave', kind: 'NO', letter: 'K', pins: pin2('13', '14'), h: 2 }));
  def('nc', Object.assign(contact('NC'), { name: 'Verbreekcontact (NC)', cat: C, role: 'slave', kind: 'NC', letter: 'K', pins: pin2('11', '12'), h: 2 }));
  def('co', {
    name: 'Wisselcontact', cat: C, role: 'slave', kind: 'CO', letter: 'K', h: 2, lab: [-0.7, 0.9],
    pins: [{ n: '12', x: 0, y: 0 }, { n: '14', x: 1, y: 0 }, { n: '11', x: 0, y: 2 }], pairs: [[0, 2]],
    g: [['l', 0, 0, 0, BL], ['l', 0, BL, 0.35, BL], ['l', 1, 0, 1, 0.75], ['l', 1, 0.75, 0.75, 0.75], ['l', 0, 2, 0, BH], ['l', 0, BH, 0.5, 0.45]]
  });
  def('no_ton', Object.assign(contact('NO', 'ton'), { name: 'Maakcontact opkomend vertraagd', cat: C, role: 'slave', kind: 'tNO', letter: 'K', pins: pin2('17', '18'), h: 2 }));
  def('nc_ton', Object.assign(contact('NC', 'ton'), { name: 'Verbreekcontact opkomend vertraagd', cat: C, role: 'slave', kind: 'tNC', letter: 'K', pins: pin2('15', '16'), h: 2 }));
  def('no_tof', Object.assign(contact('NO', 'tof'), { name: 'Maakcontact afvallend vertraagd', cat: C, role: 'slave', kind: 'tNO', letter: 'K', pins: pin2('17', '18'), h: 2 }));
  def('nc_tof', Object.assign(contact('NC', 'tof'), { name: 'Verbreekcontact afvallend vertraagd', cat: C, role: 'slave', kind: 'tNC', letter: 'K', pins: pin2('15', '16'), h: 2 }));
  def('th_nc', Object.assign(contact('NC', 'thermal'), { name: 'Thermisch contact NC (95-96)', cat: C, role: 'slave', kind: 'thNC', letter: 'B', old: 'F', pins: pin2('95', '96'), h: 2 }));
  def('th_no', Object.assign(contact('NO', 'thermal'), { name: 'Thermisch contact NO (97-98)', cat: C, role: 'slave', kind: 'thNO', letter: 'B', old: 'F', pins: pin2('97', '98'), h: 2 }));

  /* ---------- operator devices (stand-alone devices) ---------- */
  const SW = 'Schakelaars';
  def('pb_no', Object.assign(contact('NO', 'push'), { name: 'Drukknop maak (NO)', cat: SW, role: 'device', kind: 'NO', letter: 'S', pins: pin2('13', '14'), h: 2 }));
  def('pb_nc', Object.assign(contact('NC', 'push'), { name: 'Drukknop verbreek (NC)', cat: SW, role: 'device', kind: 'NC', letter: 'S', pins: pin2('11', '12'), h: 2 }));
  def('estop', Object.assign(contact('NC', 'estop'), { name: 'Noodstop (NC)', cat: SW, role: 'device', kind: 'NC', letter: 'S', pins: pin2('11', '12'), h: 2 }));
  def('sel_no', Object.assign(contact('NO', 'turn'), { name: 'Keuzeschakelaar maak (NO)', cat: SW, role: 'device', kind: 'NO', letter: 'S', pins: pin2('13', '14'), h: 2 }));
  def('sel_nc', Object.assign(contact('NC', 'turn'), { name: 'Keuzeschakelaar verbreek (NC)', cat: SW, role: 'device', kind: 'NC', letter: 'S', pins: pin2('11', '12'), h: 2 }));
  def('lim_no', Object.assign(contact('NO', 'limit'), { name: 'Eindeloopschakelaar NO', cat: SW, role: 'device', kind: 'NO', letter: 'B', pins: pin2('13', '14'), h: 2 }));
  def('lim_nc', Object.assign(contact('NC', 'limit'), { name: 'Eindeloopschakelaar NC', cat: SW, role: 'device', kind: 'NC', letter: 'B', pins: pin2('11', '12'), h: 2 }));
  def('prox_no', Object.assign(contact('NO', 'prox'), { name: 'Naderingsschakelaar NO', cat: SW, role: 'device', kind: 'NO', letter: 'B', pins: pin2('13', '14'), h: 2 }));
  def('flt_no', Object.assign(contact('NO', 'float'), { name: 'Vlotterschakelaar NO', cat: SW, role: 'device', kind: 'NO', letter: 'B', pins: pin2('13', '14'), h: 2 }));
  def('flt_nc', Object.assign(contact('NC', 'float'), { name: 'Vlotterschakelaar NC', cat: SW, role: 'device', kind: 'NC', letter: 'B', pins: pin2('11', '12'), h: 2 }));
  def('isol3', Object.assign(poles(3, 'NO', 'turn', 'bar'), { name: 'Hoofdschakelaar 3P', cat: SW, role: 'master', letter: 'Q', old: 'Q', h: 2 }));
  def('isol4', Object.assign(poles(4, 'NO', 'turn', 'bar'), { name: 'Hoofdschakelaar 4P', cat: SW, role: 'master', letter: 'Q', old: 'Q', h: 2 }));

  /* ---------- coils ---------- */
  const K = 'Spoelen';
  const coilG = [['l', 0, 0, 0, 0.6], ['r', -0.6, 0.6, 1.2, 0.8], ['l', 0, 1.4, 0, 2]];
  def('coil', { name: 'Spoel (relais / contactor)', cat: K, role: 'master', mirror: true, letter: 'K', pins: pin2('A1', 'A2'), h: 2, lab: [-0.9, 0.9], g: coilG });
  def('coil_ton', { name: 'Spoel tijdrelais opkomend vertraagd', cat: K, role: 'master', mirror: true, letter: 'K', pins: pin2('A1', 'A2'), h: 2, lab: [-1.3, 0.9],
    g: coilG.concat([['r', -1.05, 0.6, 0.45, 0.8], ['l', -1.05, 0.6, -0.6, 1.4], ['l', -0.6, 0.6, -1.05, 1.4]]) });
  def('coil_tof', { name: 'Spoel tijdrelais afvallend vertraagd', cat: K, role: 'master', mirror: true, letter: 'K', pins: pin2('A1', 'A2'), h: 2, lab: [-1.3, 0.9],
    g: coilG.concat([['r', -1.05, 0.6, 0.45, 0.8, 'k']]) });
  def('valve', { name: 'Magneetventiel', cat: K, role: 'master', letter: 'M', old: 'Y', pins: pin2('A1', 'A2'), h: 2, lab: [-0.9, 0.9],
    g: coilG.concat([['l', -0.6, 1.4, 0.6, 0.6]]) });

  /* ---------- protection ---------- */
  const F = 'Beveiliging';
  for (let n = 1; n <= 4; n++) def('mcb' + n, Object.assign(poles(n, 'NO', 'breaker', 'x'), { name: 'Installatieautomaat ' + n + 'P', cat: F, role: 'master', letter: 'F', old: 'F', h: 2 }));
  def('mpcb3', Object.assign(poles(3, 'NO', 'motorprot', 'x'), { name: 'Motorbeveiligingsschakelaar 3P', cat: F, role: 'master', mirror: true, letter: 'Q', old: 'Q', h: 2 }));
  def('rcd2', Object.assign(poles(2, 'NO', 'rcd', 'x'), { name: 'Aardlekschakelaar 2P', cat: F, role: 'master', letter: 'F', old: 'F', h: 2 }));
  def('rcd4', Object.assign(poles(4, 'NO', 'rcd', 'x'), { name: 'Aardlekschakelaar 4P', cat: F, role: 'master', letter: 'F', old: 'F', h: 2 }));
  function fuses(n) {
    const g = [], pins = [], pairs = [];
    for (let i = 0; i < n; i++) { g.push(['l', i, 0, i, 2], ['r', i - 0.22, 0.45, 0.44, 1.1]); pins.push({ n: String(2 * i + 1), x: i, y: 0 }, { n: String(2 * i + 2), x: i, y: 2 }); pairs.push([2 * i, 2 * i + 1]); }
    return { g, pins, pairs, poles: n, lab: [-0.6, 0.9] };
  }
  def('fuse1', Object.assign(fuses(1), { name: 'Zekering 1P', cat: F, role: 'master', letter: 'F', h: 2 }));
  def('fuse3', Object.assign(fuses(3), { name: 'Zekering 3P', cat: F, role: 'master', letter: 'F', h: 2 }));
  (function () {
    const g = [], pins = [], pairs = [];
    for (let i = 0; i < 3; i++) {
      g.push(['p', [[i, 0], [i, 0.75], [i + 0.25, 0.75], [i + 0.25, 1.25], [i, 1.25], [i, 2]]]);
      pins.push({ n: String(2 * i + 1), x: i, y: 0 }, { n: String(2 * i + 2), x: i, y: 2 }); pairs.push([2 * i, 2 * i + 1]);
    }
    g.push(['r', -0.35, 0.55, 2.85, 0.9]);
    def('ol3', { name: 'Thermisch relais 3P', cat: F, role: 'master', mirror: true, letter: 'B', old: 'F', h: 2, poles: 3, g, pins, pairs, lab: [-0.6, 0.9] });
  })();

  /* ---------- power switching ---------- */
  def('main3', Object.assign(poles(3, 'NO', null, 'arc'), { name: 'Vermogencontacten 3P (contactor)', cat: C, role: 'slave', kind: 'main', letter: 'K', h: 2 }));
  def('main4', Object.assign(poles(4, 'NO', null, 'arc'), { name: 'Vermogencontacten 4P (contactor)', cat: C, role: 'slave', kind: 'main', letter: 'K', h: 2 }));
  def('main1', Object.assign(poles(1, 'NO', null, 'arc'), { name: 'Vermogencontact 1P (contactor)', cat: C, role: 'slave', kind: 'main', letter: 'K', h: 2 }));

  /* ---------- loads ---------- */
  const V = 'Verbruikers';
  def('motor3', {
    name: 'Motor 3~', cat: V, role: 'master', letter: 'M', end: true, h: 3, lab: [-0.5, 2.3],
    pins: [{ n: 'U1', x: 0, y: 0 }, { n: 'V1', x: 1, y: 0 }, { n: 'W1', x: 2, y: 0 }, { n: 'PE', x: 3, y: 0 }],
    g: [['l', 0, 0, 0, 1.44], ['l', 1, 0, 1, 0.8], ['l', 2, 0, 2, 1.44], ['c', 1, 1.9, 1.1], ['t', 1, 1.85, 'M', 0.75, 'middle'], ['t', 1, 2.55, '3~', 0.5, 'middle'],
      ['p', [[3, 0], [3, 1.9], [2.1, 1.9]]]]
  });
  def('motor6', {
    name: 'Motor 3~ ster-driehoek (6 klemmen)', cat: V, role: 'master', letter: 'M', end: true, h: 4, lab: [-0.5, 3.0],
    /* PE sits between the two winding groups so delta and star contactors can be drawn to the right without crossing it */
    pins: [{ n: 'U1', x: 0, y: 0 }, { n: 'V1', x: 1, y: 0 }, { n: 'W1', x: 2, y: 0 }, { n: 'PE', x: 3, y: 0 }, { n: 'W2', x: 4, y: 0 }, { n: 'U2', x: 5, y: 0 }, { n: 'V2', x: 6, y: 0 }],
    g: [['l', 0, 0, 0, 1], ['l', 1, 0, 1, 1], ['l', 2, 0, 2, 1], ['l', 4, 0, 4, 1], ['l', 5, 0, 5, 1], ['l', 6, 0, 6, 1], ['r', -0.3, 1, 6.6, 0.4],
      ['l', 3, 1.4, 3, 1.6], ['c', 3, 2.7, 1.1], ['t', 3, 2.65, 'M', 0.75, 'middle'], ['t', 3, 3.35, '3~', 0.5, 'middle'],
      ['l', 3, 0, 3, 0.6], ['l', 2.7, 0.6, 3.3, 0.6], ['l', 2.8, 0.75, 3.2, 0.75]]
  });
  def('motor1', {
    name: 'Motor 1~', cat: V, role: 'master', letter: 'M', end: true, h: 3, lab: [-0.5, 2.0],
    pins: [{ n: 'L', x: 0, y: 0 }, { n: 'N', x: 1, y: 0 }, { n: 'PE', x: 2, y: 0 }],
    g: [['l', 0, 0, 0, 1.0], ['l', 1, 0, 1, 1.0], ['c', 0.5, 1.6, 0.8], ['t', 0.5, 1.6, 'M', 0.6, 'middle'], ['t', 0.5, 2.15, '1~', 0.4, 'middle'], ['p', [[2, 0], [2, 1.6], [1.3, 1.6]]]]
  });
  def('lamp', { name: 'Signaallamp', cat: V, role: 'master', letter: 'P', old: 'H', pins: pin2('X1', 'X2'), h: 2, lab: [-0.9, 0.9],
    g: [['l', 0, 0, 0, 0.45], ['l', 0, 1.55, 0, 2], ['c', 0, 1, 0.55], ['l', -0.39, 0.61, 0.39, 1.39], ['l', 0.39, 0.61, -0.39, 1.39]] });
  def('horn', { name: 'Zoemer / claxon', cat: V, role: 'master', letter: 'P', old: 'H', pins: pin2('1', '2'), h: 2, lab: [-0.9, 0.9],
    g: [['l', 0, 0, 0, 0.6], ['l', 0, 1.4, 0, 2], ['l', -0.5, 0.6, 0.5, 0.6], ['l', -0.5, 1.4, 0.5, 1.4], ['a', 0.5, 1.0, 0.4, -90, 90], ['l', -0.5, 0.6, -0.5, 1.4]] });
  def('heater', { name: 'Verwarmingselement', cat: V, role: 'master', letter: 'E', pins: pin2('1', '2'), h: 2, lab: [-0.7, 0.9],
    g: [['l', 0, 0, 0, 0.4], ['l', 0, 1.6, 0, 2], ['r', -0.3, 0.4, 0.6, 1.2], ['l', -0.3, 0.8, 0.3, 0.8], ['l', -0.3, 1.0, 0.3, 1.0], ['l', -0.3, 1.2, 0.3, 1.2]] });
  def('res', { name: 'Weerstand', cat: V, role: 'master', letter: 'R', pins: pin2('1', '2'), h: 2, lab: [-0.7, 0.9],
    g: [['l', 0, 0, 0, 0.4], ['l', 0, 1.6, 0, 2], ['r', -0.25, 0.4, 0.5, 1.2]] });

  /* ---------- supply ---------- */
  const T = 'Voeding';
  def('trafo1', {
    name: 'Transformator 1-fase', cat: T, role: 'master', letter: 'T', h: 4, lab: [-0.6, 2.2],
    pins: [{ n: '1U1', x: 0, y: 0 }, { n: '1U2', x: 1, y: 0 }, { n: '2U1', x: 0, y: 4 }, { n: '2U2', x: 1, y: 4 }], pairs: [[0, 2], [1, 3]],
    g: [['l', 0, 0, 0, 1.01], ['l', 1, 0, 1, 1.01], ['c', 0.5, 1.5, 0.7], ['c', 0.5, 2.5, 0.7], ['l', 0, 4, 0, 2.99], ['l', 1, 4, 1, 2.99]]
  });
  def('psu', {
    name: 'Voeding 230V AC / 24V DC', cat: T, role: 'master', letter: 'T', old: 'G', h: 3, lab: [-0.7, 1.6],
    pins: [{ n: 'L', x: 0, y: 0 }, { n: 'N', x: 1, y: 0 }, { n: 'PE', x: 2, y: 0 }, { n: '+', x: 0, y: 3 }, { n: '-', x: 1, y: 3 }], pairs: [[0, 3], [1, 4]],
    g: [['l', 0, 0, 0, 0.8], ['l', 1, 0, 1, 0.8], ['l', 2, 0, 2, 0.8], ['l', 0, 3, 0, 2.2], ['l', 1, 3, 1, 2.2], ['r', -0.4, 0.8, 2.8, 1.4], ['l', -0.4, 2.2, 2.4, 0.8],
      ['t', 0.1, 1.35, '~', 0.5, 'start'], ['t', 1.9, 2.05, '=', 0.5, 'end']]
  });
  def('vfd', {
    name: 'Frequentieregelaar', cat: T, role: 'master', letter: 'T', old: 'U', h: 3, lab: [-0.7, 1.6],
    pins: [{ n: 'L1', x: 0, y: 0 }, { n: 'L2', x: 1, y: 0 }, { n: 'L3', x: 2, y: 0 }, { n: 'PE', x: 3, y: 0 }, { n: 'U', x: 0, y: 3 }, { n: 'V', x: 1, y: 3 }, { n: 'W', x: 2, y: 3 }, { n: 'PE', x: 3, y: 3 }], pairs: [[0, 4], [1, 5], [2, 6], [3, 7]], through: [[3, 7]],
    g: [['l', 0, 0, 0, 0.8], ['l', 1, 0, 1, 0.8], ['l', 2, 0, 2, 0.8], ['l', 3, 0, 3, 0.8], ['l', 0, 3, 0, 2.2], ['l', 1, 3, 1, 2.2], ['l', 2, 3, 2, 2.2], ['l', 3, 3, 3, 2.2],
      ['r', -0.4, 0.8, 3.8, 1.4], ['l', -0.4, 2.2, 3.4, 0.8], ['t', 0.1, 1.35, '~', 0.5, 'start'], ['t', 3.3, 2.05, 'f', 0.5, 'end']]
  });

  /* ---------- terminals and connections ---------- */
  const X = 'Klemmen en verbindingen';
  def('term', { name: 'Klem', cat: X, role: 'terminal', letter: 'X', h: 1, lab: [-0.3, 0.65], pins: [{ n: '', x: 0, y: 0 }, { n: '', x: 0, y: 1 }], through: [[0, 1]],
    g: [['l', 0, 0, 0, 0.32], ['l', 0, 0.68, 0, 1], ['c', 0, 0.5, 0.18, 'w']] });
  def('term_pe', { name: 'Klem PE', cat: X, role: 'terminal', letter: 'X', h: 1, lab: [-0.3, 0.65], pins: [{ n: '', x: 0, y: 0 }, { n: '', x: 0, y: 1 }], through: [[0, 1]],
    g: [['l', 0, 0, 0, 0.32], ['l', 0, 0.68, 0, 1], ['c', 0, 0.5, 0.18, 'w'], ['l', -0.13, 0.5, 0.13, 0.5]] });
  def('plug', { name: 'Stekerverbinding (pen/bus)', cat: X, role: 'terminal', letter: 'X', h: 1, lab: [-0.35, 0.65], pins: [{ n: '', x: 0, y: 0 }, { n: '', x: 0, y: 1 }], through: [[0, 1]],
    g: [['l', 0, 0, 0, 0.35], ['a', 0, 0.53, 0.18, 180, 360], ['l', 0, 0.6, 0, 1], ['r', -0.08, 0.6, 0.16, 0.12, 'k']] });
  def('ref', { name: 'Draadverwijzing (pijl)', cat: X, role: 'ref', letter: '', end: true, h: 0, lab: [0.3, 0.75], pins: [{ n: '', x: 0, y: 0 }],
    g: [['l', 0, 0, 0, 0.45], ['p', [[-0.25, 0.2], [0, 0.45], [0.25, 0.2]]]] });
  def('ground', { name: 'Aarding', cat: X, role: 'plain', letter: '', end: true, h: 0, lab: [0.5, 0.7], pins: [{ n: '', x: 0, y: 0 }],
    g: [['l', 0, 0, 0, 0.4], ['l', -0.4, 0.4, 0.4, 0.4], ['l', -0.26, 0.55, 0.26, 0.55], ['l', -0.12, 0.7, 0.12, 0.7]] });

  /* ---------- PLC ---------- */
  const PL = 'PLC';
  def('plc', { name: 'PLC-module (voeding)', cat: PL, role: 'master', mirror: true, letter: 'K', old: 'A', h: 2, lab: [-1.2, 0.9], pins: pin2('L+', 'M'),
    g: [['l', 0, 0, 0, 0.5], ['l', 0, 1.5, 0, 2], ['r', -0.9, 0.5, 3.4, 1.0], ['t', 0.8, 1.15, 'PLC', 0.45, 'middle']] });
  /* a compact LOGO!-style module: L+ on top, M at the bottom, the input and output terminals drawn for reference */
  (function () {
    const g = [['l', 0, 0, 0, 1], ['r', -0.8, 1, 13.6, 9], ['l', 0, 10, 0, 11], ['l', -0.8, 2.6, 12.8, 2.6], ['l', -0.8, 8.4, 12.8, 8.4],
      ['r', 0.6, 3.4, 4.6, 3.6], ['t', 2.9, 5.5, 'LOGO!', 0.8, 'middle'], ['t', 8.7, 4.3, 'DC 24V', 0.45, 'middle'],
      ['p', [[7.4, 6.4], [6.8, 6.9], [7.4, 7.4]], true], ['p', [[10.6, 6.4], [11.2, 6.9], [10.6, 7.4]], true], ['p', [[8.5, 5.4], [9, 4.9], [9.5, 5.4]], true], ['p', [[8.5, 7.5], [9, 8], [9.5, 7.5]], true],
      ['c', 0, 1.6, 0.25], ['t', 0, 2.35, 'L+', 0.38, 'middle'], ['c', 0, 9.4, 0.25], ['t', 0, 9.05, 'M', 0.38, 'middle']];
    for (let i = 1; i <= 8; i++) g.push(['c', 1.2 * i + 1, 1.6, 0.25], ['t', 1.2 * i + 1, 2.35, 'I' + i, 0.36, 'middle']);
    for (let i = 1; i <= 4; i++) g.push(['c', 2.4 * i, 9.4, 0.25], ['c', 2.4 * i + 0.8, 9.4, 0.25], ['t', 2.4 * i + 0.4, 9.05, 'Q' + i, 0.36, 'middle']);
    def('logo', { name: 'LOGO!-module', cat: 'PLC', role: 'master', mirror: true, letter: 'K', old: 'A', h: 11, lab: [-1.1, 5], pins: [{ n: 'L+', x: 0, y: 0 }, { n: 'M', x: 0, y: 11 }], g });
  })();
  def('plc_di', { name: 'PLC-ingang', cat: PL, role: 'slave', kind: 'DI', letter: 'K', old: 'A', end: true, h: 1.5, lab: [-1.0, 0.95], pins: [{ n: 'I1', x: 0, y: 0 }],
    g: [['l', 0, 0, 0, 0.5], ['r', -0.8, 0.5, 1.6, 1.0], ['p', [[-0.15, 0.5], [0, 0.68], [0.15, 0.5]]]] });
  def('plc_do', { name: 'PLC-uitgang', cat: PL, role: 'slave', kind: 'DO', letter: 'K', old: 'A', h: 2, lab: [-1.0, 0.95], pins: [{ n: '1', x: 0, y: 0 }, { n: 'Q1', x: 0, y: 2 }],
    g: [['l', 0, 0, 0, 0.5], ['l', 0, 1.5, 0, 2], ['r', -0.8, 0.5, 1.6, 1.0], ['p', [[-0.15, 1.32], [0, 1.5], [0.15, 1.32]]]] });

  /* letter codes: IEC 81346-2 (default) or the older IEC 60750 style still in wide use */
  function letter(id, std) { const s = S[id]; if (!s) return '?'; return std === 'old' && s.old ? s.old : s.letter; }

  /* bounding box of a symbol's graphics (unrotated), for hit testing and previews */
  function bbox(id) {
    const s = S[id]; if (!s) return [0, 0, 0, 0];
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    const add = (x, y) => { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); };
    s.g.forEach((e) => {
      if (e[0] === 'l' || e[0] === 'd') { add(e[1], e[2]); add(e[3], e[4]); }
      else if (e[0] === 'p') e[1].forEach((q) => add(q[0], q[1]));
      else if (e[0] === 'c' || e[0] === 'a') { add(e[1] - e[3], e[2] - e[3]); add(e[1] + e[3], e[2] + e[3]); }
      else if (e[0] === 'r') { add(e[1], e[2]); add(e[1] + e[3], e[2] + e[4]); }
      else if (e[0] === 't') add(e[1], e[2]);
    });
    s.pins.forEach((p) => add(p.x, p.y));
    return b;
  }

  return { S, CATS, letter, bbox, get: (id) => S[id] || null, list: () => Object.keys(S).map((k) => S[k]) };
})();
if (typeof module !== 'undefined') module.exports = LE;
