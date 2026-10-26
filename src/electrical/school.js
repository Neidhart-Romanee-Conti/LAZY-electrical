/* LAZY Electrical school projects: a short description of WHAT is in the installation (PLC or not, emergency stop,
   motors, PLC inputs and outputs, or the contact rungs of a hard-wired control circuit) is turned into the fixed
   sheet set the owner's school uses, always in the same order and style:
     voedingsblad → stuurschakeling → ingangen → uitgangen → vermogenblad (one per motor).
   The result is a normal page-description project (see auto.js), so layout, checks and lists work as usual.

   School project:
   { "info": {...}, "plc": "0BA5" | "24CE" | "none", "estop": true,
     "mainBreaker": "C20A", "b24": "C6A", "b230": "C10A",
     "motors": [ { "name": "LOOPBAND", "type": "DOL" | "REV" | "YD", "breaker": "C10A", "power": "1,5 kW", "thermal": true } ],
     "inputs":  [ { "n": 1, "desc": "STOP", "kind": "NC" } ],                          (with a PLC)
     "outputs": [ { "n": 1, "desc": "MOTOR RECHTS", "load": "M:0:right" } ],            (with a PLC)
     "ladder":  { "rungs": [ rung, ... ] } }                                          (without a PLC) */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.school = (function () {
  'use strict';
  const ROLES = { DOL: ['run'], REV: ['right', 'left'], YD: ['main', 'star', 'delta'] };
  const ROLE_NL = { run: '', right: 'RECHTS', left: 'LINKS', main: 'NET', star: 'STER', delta: 'DRIEHOEK' };
  const PLCS = {
    '0BA5': { part: '6ED1 052-1CC00-0BA5', desc: 'LOGO! 24', di: 8, dq: 4 },
    '24CE': { part: '6ED1 052-1CC08-0BA1', desc: 'LOGO! 24CE', di: 8, dq: 4 },
    '24RCE': { part: '6ED1 052-1HB08-0BA1', desc: 'LOGO! 24RCE', di: 8, dq: 4 },
    '1224RCE': { part: '6ED1 052-1MD08-0BA1', desc: 'LOGO! 12/24RCE', di: 8, dq: 4 }
  };
  const IR = 'GEN-IR-24V-1CO'; // 24 V interface relay ("WAGO") per PLC output
  const U = (s) => String(s == null ? '' : s).toUpperCase();

  /* internal tags of the devices the generator adds itself: high numbers, so they never collide with the tags in a
     hand-written ladder; the whole project is renumbered afterwards (per sheet and column, or consecutively) */
  const T = {
    main: 'Q901', f24: 'F901', f230: 'F902', fMotor: (i) => 'F' + (910 + i), psu: 'T901', plc: 'K901', nood: 'K902', estop: 'S901',
    line: (i) => 'Q' + (920 + i * 5), role: (i, j) => 'Q' + (921 + i * 5 + j), ol: (i) => 'B' + (901 + i), motor: (i) => 'M' + (901 + i),
    xIn: 'X1', xField: 'X2', xMotor: (i) => 'X' + (3 + i), relay: (n) => 'K' + (950 + n), lamp: (n) => 'P' + (950 + n), input: (n, sensor) => (sensor ? 'B' : 'S') + (950 + n)
  };
  const potsOf = (i) => [(i + 2) + 'L1', (i + 2) + 'L2', (i + 2) + 'L3'];
  const field = (el) => [{ s: 'term', tag: T.xField }, el, { s: 'term', tag: T.xField }];

  function build(sp) {
    const errs = [];
    if (!sp || typeof sp !== 'object') return { spec: null, errors: ['geen schoolproject-object'] };
    const plcKey = String(sp.plc || 'none'), plc = PLCS[plcKey] || null, hasPlc = plcKey !== 'none';
    if (hasPlc && !plc) errs.push('onbekende PLC "' + plcKey + '" (gebruik 0BA5, 24CE, 24RCE, 1224RCE of none)');
    const motors = (Array.isArray(sp.motors) ? sp.motors : []).map((m, i) => {
      const type = ROLES[U(m.type)] ? U(m.type) : null;
      if (!type) errs.push('motor ' + (i + 1) + ': type moet DOL, REV of YD zijn');
      return { name: U(m.name || 'MOTOR ' + (i + 1)), type: type || 'DOL', breaker: m.breaker || 'C10A', power: m.power || '', thermal: m.thermal !== false };
    });
    const estop = sp.estop !== false;
    const pages = [], devices = {};

    /* 1. voedingsblad */
    const vb = { title: 'Voedingsblad', top: ['L1', 'L2', 'L3', 'N', 'PE'], mid: ['L1.1', 'L2.1', 'L3.1', 'N.1'], paths: [
      { from: ['L1', 'L2', 'L3', 'N'], to: ['L1.1', 'L2.1', 'L3.1', 'N.1'], chain: [{ s: 'term', tag: T.xIn }, { s: 'mcb4', tag: T.main, desc: 'HOOFDAUTOMAAT', desc2: (sp.mainBreaker || 'C20A') + ' 4P' }] }
    ] };
    if (hasPlc) vb.paths.push({ from: ['L1.1', 'N.1'], pe: 'PE', out: ['+24V', '0V'], chain: [{ s: 'mcb2', tag: T.f24, desc: 'STUUR 24V', desc2: (sp.b24 || 'C6A') + ' 2P' }, { s: 'psu', tag: T.psu, desc: 'VOEDING', desc2: '24V DC' }] });
    vb.paths.push({ from: ['L1.1', 'N.1'], out: ['1L1', '1N'], chain: [{ s: 'mcb2', tag: T.f230, desc: 'STUUR 230V', desc2: (sp.b230 || 'C10A') + ' 2P' }] });
    motors.forEach((m, i) => vb.paths.push({ from: ['L1.1', 'L2.1', 'L3.1'], out: potsOf(i), chain: [{ s: 'mcb3', tag: T.fMotor(i), desc: m.name, desc2: m.breaker + ' 3P' }] }));
    pages.push(vb);

    /* which contactor drives which motor role */
    const roleTag = {}; motors.forEach((m, i) => ROLES[m.type].forEach((r, j) => { roleTag[i + ':' + r] = T.role(i, j); }));
    const roleDesc = (i, r) => [motors[i].name, (ROLE_NL[r] ? ROLE_NL[r] + ' ' : '') + '230V'];
    const interlock = (i, r) => {
      const t = motors[i].type;
      const other = t === 'REV' ? { right: 'left', left: 'right' }[r] : t === 'YD' ? { star: 'delta', delta: 'star' }[r] : null;
      return other ? [{ s: 'nc', tag: roleTag[i + ':' + other] }] : [];
    };

    if (hasPlc) {
      if (plc) devices[T.plc] = { desc: plc.desc, part: plc.part, maker: 'Siemens' };
      const inputs = (Array.isArray(sp.inputs) ? sp.inputs : []).slice().sort((a, b) => a.n - b.n);
      const outputs = (Array.isArray(sp.outputs) ? sp.outputs : []).slice().sort((a, b) => a.n - b.n);
      const seen = {};
      inputs.forEach((x) => { if (seen['I' + x.n]) errs.push('ingang I' + x.n + ' is twee keer gebruikt'); seen['I' + x.n] = 1; if (!(x.n >= 1 && x.n <= (plc ? plc.di : 8))) errs.push('ingang I' + x.n + ' bestaat niet (I1-I' + (plc ? plc.di : 8) + ')'); });
      outputs.forEach((x) => { if (seen['Q' + x.n]) errs.push('uitgang Q' + x.n + ' is twee keer gebruikt'); seen['Q' + x.n] = 1; if (!(x.n >= 1 && x.n <= (plc ? plc.dq : 4))) errs.push('uitgang Q' + x.n + ' bestaat niet (Q1-Q' + (plc ? plc.dq : 4) + ')'); });
      /* every motor role needs exactly one output */
      const driven = {};
      outputs.forEach((o) => {
        const m = /^M:(\d+):(\w+)$/.exec(String(o.load || ''));
        if (!m) return;
        const k = m[1] + ':' + m[2];
        if (!roleTag[k]) errs.push('uitgang Q' + o.n + ': "' + o.load + '" bestaat niet (motor ' + m[1] + ' heeft rollen ' + (motors[+m[1]] ? ROLES[motors[+m[1]].type].join(', ') : 'geen') + ')');
        else if (driven[k]) errs.push('uitgang Q' + o.n + ' en Q' + driven[k] + ' sturen allebei ' + o.load);
        else driven[k] = o.n;
      });
      Object.keys(roleTag).forEach((k) => { if (!driven[k]) errs.push('motor ' + k.split(':')[0] + ' (' + motors[+k.split(':')[0]].name + ') rol "' + k.split(':')[1] + '" heeft geen PLC-uitgang (load "M:' + k + '")'); });
      if (estop && !inputs.some((x) => U(x.kind) === 'ESTOP')) errs.push('er is een noodstop: geef ook een ingang met kind "ESTOP" (tweede contact van de noodstop naar de PLC)');

      /* 2. stuurschakeling: LOGO! module, emergency stop circuit and the 230 V contactor coils */
      const ss = { title: 'Stuurschakeling', top: ['+24V', '1L1'], bottom: ['0V', '1N'], paths: [{ from: '+24V', to: '0V', chain: [{ s: 'logo', tag: T.plc }] }] };
      if (estop) {
        ss.paths.push({ from: '+24V', to: '0V', chain: field({ s: 'estop', tag: T.estop, desc: 'NOODSTOP' }).concat([{ s: 'coil', tag: T.nood, desc: 'NOOD', desc2: 'WAGO 24V', part: IR }]) });
        const lines = motors.map((m, i) => ({ s: 'coil', tag: T.line(i), desc: 'NOOD', desc2: (motors.length > 1 ? m.name + ' ' : '') + '230V' }));
        if (lines.length) ss.paths.push({ from: '1L1', to: '1N', chain: [{ s: 'no', tag: T.nood }].concat(lines.length > 1 ? [{ par: lines.map((l) => [l]) }] : lines) });
      }
      outputs.forEach((o) => {
        const m = /^M:(\d+):(\w+)$/.exec(String(o.load || '')); if (!m || !roleTag[m[1] + ':' + m[2]]) return;
        const i = +m[1], r = m[2], d = roleDesc(i, r);
        ss.paths.push({ from: '1L1', to: '1N', chain: [{ s: 'no', tag: T.relay(o.n) }].concat(interlock(i, r), [{ s: 'coil', tag: roleTag[i + ':' + r], desc: d[0], desc2: d[1] }]) });
      });
      pages.push(ss);

      /* 3. ingangen */
      const KIND = { NO: 'pb_no', NC: 'pb_nc', LIMIT_NO: 'lim_no', LIMIT_NC: 'lim_nc', SENSOR: 'prox_no', SWITCH: 'sel_no', SWITCH_NC: 'sel_nc', FLOAT: 'flt_no', FLOAT_NC: 'flt_nc' };
      const ing = { title: 'Ingangen', top: ['+24V'], bottom: ['0V'], paths: inputs.map((x) => {
        const kind = U(x.kind || 'NO'), desc = U(x.desc), di = { s: 'plc_di', tag: T.plc, addr: 'I' + x.n, desc };
        if (kind === 'ESTOP') return { from: '+24V', chain: field({ s: 'estop', tag: T.estop }).concat([di]) };
        if (kind === 'THERMAL') {
          const mi = +x.m || 0;
          if (!motors[mi]) errs.push('ingang I' + x.n + ': thermisch contact van motor ' + mi + ', maar die motor bestaat niet');
          else if (!motors[mi].thermal) errs.push('ingang I' + x.n + ': motor ' + motors[mi].name + ' heeft geen thermisch relais (thermal: false)');
          return { from: '+24V', chain: [{ s: 'th_nc', tag: T.ol(mi) }, di] };
        }
        const s = KIND[kind];
        if (!s) { errs.push('ingang I' + x.n + ': onbekende soort "' + x.kind + '" (gebruik NO, NC, ESTOP, THERMAL, LIMIT_NO, LIMIT_NC, SENSOR, SWITCH, FLOAT)'); return { from: '+24V', chain: [di] }; }
        return { from: '+24V', chain: field({ s, tag: T.input(x.n, /LIMIT|SENSOR|FLOAT/.test(kind)), desc }).concat([di]) };
      }) };
      if (ing.paths.length) pages.push(ing);

      /* 4. uitgangen: one 24 V interface relay per motor output, lamps and buzzers directly on the 24 V output */
      const uit = { title: 'Uitgangen', top: ['+24V'], bottom: ['0V'], paths: outputs.map((o) => {
        const load = String(o.load || 'LAMP').toUpperCase(), desc = U(o.desc), dq = { s: 'plc_do', tag: T.plc, addr: 'Q' + o.n, desc };
        if (load.indexOf('M:') === 0) return { from: '+24V', to: '0V', chain: [dq, { s: 'coil', tag: T.relay(o.n), desc: desc || 'MOTOR', desc2: 'WAGO 24V', part: IR }] };
        if (load === 'BUZZER') return { from: '+24V', to: '0V', chain: [dq, { s: 'horn', tag: T.lamp(o.n), desc: desc || 'ZOEMER', desc2: '24V' }] };
        if (load === 'RELAY') return { from: '+24V', to: '0V', chain: [dq, { s: 'coil', tag: T.relay(o.n), desc, desc2: 'WAGO 24V', part: IR }] };
        return { from: '+24V', to: '0V', chain: [dq, { s: 'lamp', tag: T.lamp(o.n), desc: desc || 'LAMP', desc2: '24V' }] };
      }) };
      if (uit.paths.length) pages.push(uit);
    } else {
      /* 2. stuurschakeling of a hard-wired control circuit, written as rungs between 1L1 and 1N */
      const rungs = sp.ladder && Array.isArray(sp.ladder.rungs) ? sp.ladder.rungs : [];
      if (!rungs.length) errs.push('zonder PLC is "ladder": {"rungs": [...]} nodig: de stuurschakeling als sporten');
      const coilType = {};
      const scan = (seq) => (Array.isArray(seq) ? seq : []).forEach((e) => { if (e && e.par) e.par.forEach(scan); else if (e && e.coil) coilType[e.coil] = e.type || 'contactor'; });
      rungs.forEach(scan);
      const drives = {};
      const conv = (seq, where) => {
        const out = [];
        (Array.isArray(seq) ? seq : []).forEach((e, k) => {
          const at = where + ', element ' + (k + 1);
          if (!e || typeof e !== 'object') { errs.push(at + ': geen object'); return; }
          if (e.par) { out.push({ par: (Array.isArray(e.par) ? e.par : []).map((b, bi) => conv(b, at + ' tak ' + (bi + 1))) }); return; }
          if (e.coil) {
            const t = e.type || 'contactor', s = t === 'timer_on' ? 'coil_ton' : t === 'timer_off' ? 'coil_tof' : 'coil';
            if (e.drives) {
              const m = /^(\d+):(\w+)$/.exec(String(e.drives));
              if (!m || !roleTag[m[1] + ':' + m[2]]) errs.push(at + ': "drives": "' + e.drives + '" bestaat niet');
              else if (drives[m[1] + ':' + m[2]]) errs.push(at + ': twee spoelen sturen motor ' + e.drives);
              else drives[m[1] + ':' + m[2]] = e.coil;
            }
            out.push({ s, tag: e.coil, desc: U(e.name), desc2: e.time || (t === 'contactor' ? '230V' : '') });
            return;
          }
          if (e.lamp) { out.push({ s: 'lamp', tag: e.lamp, desc: U(e.name) }); return; }
          if (e.buzzer) { out.push({ s: 'horn', tag: e.buzzer, desc: U(e.name) }); return; }
          const nc = U(e.t) === 'NC', kind = String(e.kind || '');
          if (kind === 'thermal') { const mi = +e.m || 0; if (!motors[mi]) errs.push(at + ': thermisch contact van motor ' + mi + ', maar die motor bestaat niet'); out.push({ s: nc ? 'th_nc' : 'th_no', tag: T.ol(mi) }); return; }
          if (kind === 'aux') { out.push({ s: nc ? 'nc' : 'no', tag: e.dev }); return; }
          if (kind === 'timer') { const tof = coilType[e.dev] === 'timer_off'; out.push({ s: (nc ? 'nc_' : 'no_') + (tof ? 'tof' : 'ton'), tag: e.dev }); return; }
          const S = { push: nc ? 'pb_nc' : 'pb_no', estop: 'estop', limit: nc ? 'lim_nc' : 'lim_no', 'switch': nc ? 'sel_nc' : 'sel_no', sensor: nc ? 'lim_nc' : 'prox_no', float: nc ? 'flt_nc' : 'flt_no' }[kind];
          if (!S) { errs.push(at + ': onbekende soort "' + kind + '" (push, estop, limit, switch, sensor, float, aux, timer, thermal)'); return; }
          field({ s: S, tag: e.dev, desc: U(e.name) }).forEach((x) => out.push(x));
        });
        return out;
      };
      const ss = { title: 'Stuurschakeling', top: ['1L1'], bottom: ['1N'], paths: rungs.map((r, ri) => ({ from: '1L1', to: '1N', chain: conv(r, 'sport ' + (ri + 1)) })) };
      pages.push(ss);
      /* the power sheet uses the coil tags the rungs gave each motor role */
      Object.keys(roleTag).forEach((k) => { if (drives[k]) roleTag[k] = drives[k]; else errs.push('motor ' + k.split(':')[0] + ' rol "' + k.split(':')[1] + '": geen spoel met "drives": "' + k + '"'); });
    }

    /* 5. vermogenblad per motor */
    motors.forEach((m, i) => {
      const p = { macro: m.type.toLowerCase(), from: potsOf(i), pe: 'PE', breaker: false, pre: hasPlc && estop ? [{ s: 'main3', tag: T.line(i) }] : [], term: { tag: T.xMotor(i) }, motor: { tag: T.motor(i), desc: m.name, desc2: m.power } };
      if (m.thermal) p.ol = { tag: T.ol(i) }; else p.ol = false;
      if (m.type === 'DOL') p.contactor = roleTag[i + ':run'];
      if (m.type === 'REV') { p.fwd = { tag: roleTag[i + ':right'], desc: 'RECHTS' }; p.rev = { tag: roleTag[i + ':left'], desc: 'LINKS' }; }
      if (m.type === 'YD') { p.main = { tag: roleTag[i + ':main'], desc: 'NET' }; p.star = { tag: roleTag[i + ':star'], desc: 'STER' }; p.delta = { tag: roleTag[i + ':delta'], desc: 'DRIEHOEK' }; }
      pages.push({ title: 'Vermogenblad' + (motors.length > 1 ? ' ' + m.name : ''), top: potsOf(i).concat(['PE']), paths: [p] });
    });
    if (!motors.length) errs.push('er is geen motor ("motors" is leeg)');

    return { spec: { info: sp.info || {}, cover: false, devices, pages }, errors: errs };
  }

  /* the whole project from a school description; the description is kept on the project for later changes */
  function buildProject(sp) {
    const r = build(sp);
    if (!r.spec) return { P: null, errors: r.errors };
    const b = LE.auto.buildProject(r.spec);
    if (b.P) { if (b.P.settings.tagMode === 'consecutive') LE.auto.retag(b.P, true); b.P.school = JSON.parse(JSON.stringify(sp)); }
    return { P: b.P, errors: r.errors.concat(b.errors) };
  }

  return { build, buildProject, ROLES, PLCS };
})();
if (typeof module !== 'undefined') module.exports = LE;
