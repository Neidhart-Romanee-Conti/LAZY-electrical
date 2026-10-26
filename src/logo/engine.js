/* LAZY Logo engine: LOGO!-style function blocks, simulator, checks, behaviour tests and auto-layout.
   Pure JS, no DOM: runs in the browser and in Node. Program = {model, blocks:[{id,type,x,y,p}], wires:[{from,to,pin}], tests:[...]} */
var LL = (function () {
  'use strict';
  var MODELS = {
    '0BA5': { label: 'LOGO! 24 (0BA5)', I: 8, Q: 4, M: 24 },
    '0BA6': { label: 'LOGO! 24 (0BA6)', I: 8, Q: 4, M: 27 },
    'LOGO8': { label: 'LOGO! 8 (0BA8 / 0BA9)', I: 8, Q: 4, M: 64 }
  };
  var T = {
    I: { cat: 'Co', sym: function (p) { return 'I' + p.n; }, name: 'Ingang', ins: [], dflt: [], params: { n: 1, push: false, nc: false, desc: '' },
      ev: function (a, s, p, dt, c) { return c.inputs[p.n] ? 1 : 0; } },
    Q: { cat: 'Co', sym: function (p) { return 'Q' + p.n; }, name: 'Uitgang', ins: [''], dflt: [0], params: { n: 1, desc: '' }, noOut: true,
      ev: function (a, s, p, dt, c) { c.outputs[p.n] = a[0]; return a[0]; } },
    M: { cat: 'Co', sym: function (p) { return 'M' + p.n; }, name: 'Merker', ins: [''], dflt: [0], params: { n: 1, desc: '' },
      ev: function (a, s) { var o = s.v || 0; s.next = a[0]; return o; }, commit: function (s) { s.v = s.next || 0; } },
    HI: { cat: 'Co', sym: function () { return 'hi'; }, name: 'Altijd 1', ins: [], dflt: [], params: {}, ev: function () { return 1; } },
    LO: { cat: 'Co', sym: function () { return 'lo'; }, name: 'Altijd 0', ins: [], dflt: [], params: {}, ev: function () { return 0; } },
    AND: { cat: 'GF', sym: function () { return '&'; }, name: 'EN', ins: ['', '', '', ''], dflt: [1, 1, 1, 1], params: {}, ev: function (a) { return a.every(Boolean) ? 1 : 0; } },
    NAND: { cat: 'GF', sym: function () { return '&'; }, neg: true, name: 'NEN', ins: ['', '', '', ''], dflt: [1, 1, 1, 1], params: {}, ev: function (a) { return a.every(Boolean) ? 0 : 1; } },
    OR: { cat: 'GF', sym: function () { return '≥1'; }, name: 'OF', ins: ['', '', '', ''], dflt: [0, 0, 0, 0], params: {}, ev: function (a) { return a.some(Boolean) ? 1 : 0; } },
    NOR: { cat: 'GF', sym: function () { return '≥1'; }, neg: true, name: 'NOF', ins: ['', '', '', ''], dflt: [0, 0, 0, 0], params: {}, ev: function (a) { return a.some(Boolean) ? 0 : 1; } },
    XOR: { cat: 'GF', sym: function () { return '=1'; }, name: 'XOF', ins: ['', ''], dflt: [0, 0], params: {}, ev: function (a) { return (a[0] ^ a[1]) ? 1 : 0; } },
    NOT: { cat: 'GF', sym: function () { return '1'; }, neg: true, name: 'NIET', ins: [''], dflt: [0], params: {}, ev: function (a) { return a[0] ? 0 : 1; } },
    EDGE: { cat: 'GF', sym: function () { return '↑'; }, name: 'Flank', ins: [''], dflt: [0], params: {},
      ev: function (a, s) { var o = a[0] && !s.prev ? 1 : 0; s.prev = a[0]; return o; } },
    TON: { cat: 'SF', sym: function () { return '⊓Δ'; }, name: 'Opkomvertraging', ins: ['Trg'], dflt: [0], params: { T: 3 },
      ev: function (a, s, p, dt) { s.t = a[0] ? (s.t || 0) + dt : 0; return s.t >= +p.T - 1e-9 ? 1 : 0; },
      stat: function (s, p) { return Math.max(0, p.T - (s.t || 0)).toFixed(1) + 's'; } },
    TOF: { cat: 'SF', sym: function () { return 'Δ⊓'; }, name: 'Afvalvertraging', ins: ['Trg', 'R'], dflt: [0, 0], params: { T: 5 },
      ev: function (a, s, p, dt) { if (a[1]) { s.on = 0; s.t = 0; } else if (a[0]) { s.on = 1; s.t = 0; } else if (s.on) { s.t += dt; if (s.t >= +p.T - 1e-9) s.on = 0; } return s.on ? 1 : 0; },
      stat: function (s, p) { return s.on ? Math.max(0, p.T - (s.t || 0)).toFixed(1) + 's' : ''; } },
    RS: { cat: 'SF', sym: function () { return 'RS'; }, name: 'Zelfhoudrelais', ins: ['S', 'R'], dflt: [0, 0], params: {},
      ev: function (a, s) { if (a[1]) s.q = 0; else if (a[0]) s.q = 1; return s.q ? 1 : 0; } },
    TGL: { cat: 'SF', sym: function () { return '⇅'; }, name: 'Impulsrelais', ins: ['Trg', 'S', 'R'], dflt: [0, 0, 0], params: {},
      ev: function (a, s) { var e = a[0] && !s.prev; s.prev = a[0]; if (a[2]) s.q = 0; else if (a[1]) s.q = 1; else if (e) s.q = s.q ? 0 : 1; return s.q ? 1 : 0; } },
    CTR: { cat: 'SF', sym: function () { return '+/−'; }, name: 'Op/neer-teller', ins: ['R', 'Cnt', 'Dir'], dflt: [0, 0, 0], params: { on: 5 },
      ev: function (a, s, p) { s.c = s.c || 0; var e = a[1] && !s.prev; s.prev = a[1]; if (a[0]) s.c = 0; else if (e) s.c += a[2] ? -1 : 1; if (s.c < 0) s.c = 0; return s.c >= +p.on ? 1 : 0; },
      stat: function (s, p) { return (s.c || 0) + '/' + p.on; } },
    CLK: { cat: 'SF', sym: function () { return '⊓⊔'; }, name: 'Pulsgever', ins: ['En'], dflt: [1], params: { th: 1, tl: 1 },
      ev: function (a, s, p, dt) { if (!a[0]) { s.t = 0; return 0; } s.t = (s.t || 0) + dt; var per = +p.th + +p.tl; return (s.t % per) < +p.th ? 1 : 0; } }
  };

  function restInputs(prog) {
    var r = {};
    (prog.blocks || []).forEach(function (b) { if (b.type === 'I') r[b.p.n] = b.p.nc ? 1 : 0; });
    return r;
  }

  /* simulator: one scan cycle per step(dt) */
  function makeSim(prog) {
    var byTo = {}, blocks = {}, state = {}, vals = {};
    (prog.wires || []).forEach(function (w) { (byTo[w.to] = byTo[w.to] || {})[w.pin] = w.from; });
    (prog.blocks || []).forEach(function (b) { blocks[b.id] = b; state[b.id] = {}; });
    var sim = { inputs: restInputs(prog), outputs: {}, vals: vals, state: state };
    sim.step = function (dt) {
      var cur = {}, visiting = {}, ctx = { inputs: sim.inputs, outputs: {} };
      function val(id) {
        if (id in cur) return cur[id];
        var b = blocks[id]; if (!b || !T[b.type]) return 0;
        if (visiting[id]) return vals[id] || 0;
        visiting[id] = 1;
        var t = T[b.type], src = byTo[id] || {};
        var a = t.ins.map(function (_, i) { return src[i] != null ? val(src[i]) : t.dflt[i]; });
        cur[id] = t.ev(a, state[id], b.p || {}, dt, ctx) ? 1 : 0;
        return cur[id];
      }
      Object.keys(blocks).forEach(val);
      Object.keys(blocks).forEach(function (id) { var t = T[blocks[id].type]; if (t && t.commit) t.commit(state[id]); });
      Object.keys(vals).forEach(function (k) { delete vals[k]; });
      Object.keys(cur).forEach(function (k) { vals[k] = cur[k]; });
      sim.outputs = ctx.outputs;
    };
    return sim;
  }

  /* structural checks: errors block a correct program, warnings are hints */
  function check(prog) {
    var err = [], warn = [], M = MODELS[prog.model] || MODELS['0BA5'], ids = {}, qn = {}, in2 = {};
    (prog.blocks || []).forEach(function (b) {
      if (!b || !b.id) { err.push('Een blok heeft geen "id".'); return; }
      if (ids[b.id]) err.push('Blok-id ' + b.id + ' komt twee keer voor.');
      ids[b.id] = b;
      if (!T[b.type]) { err.push('Blok ' + b.id + ': onbekend type "' + b.type + '".'); return; }
      var p = b.p || {};
      if (b.type === 'I' && !(p.n >= 1 && p.n <= M.I)) err.push('Blok ' + b.id + ': ingang I' + p.n + ' bestaat niet op een ' + M.label + ' (I1 tot I' + M.I + ').');
      if (b.type === 'Q') {
        if (!(p.n >= 1 && p.n <= M.Q)) err.push('Blok ' + b.id + ': uitgang Q' + p.n + ' bestaat niet op een ' + M.label + ' (Q1 tot Q' + M.Q + ').');
        if (qn[p.n]) err.push('Uitgang Q' + p.n + ' wordt door twee blokken gestuurd (' + qn[p.n] + ' en ' + b.id + '). Combineer de voorwaarden eerst met een OF-blok.');
        qn[p.n] = b.id;
      }
      if (b.type === 'M' && !(p.n >= 1 && p.n <= M.M)) err.push('Blok ' + b.id + ': merker M' + p.n + ' bestaat niet (M1 tot M' + M.M + ').');
      if ((b.type === 'TON' || b.type === 'TOF') && !(+p.T > 0)) err.push('Blok ' + b.id + ': tijd T moet groter dan 0 zijn.');
      if (b.type === 'CLK' && !(+p.th > 0 && +p.tl > 0)) err.push('Blok ' + b.id + ': hoog- en laagtijd moeten groter dan 0 zijn.');
      if (b.type === 'CTR' && !(+p.on >= 1)) err.push('Blok ' + b.id + ': de teller moet minstens op 1 schakelen.');
    });
    (prog.wires || []).forEach(function (w) {
      var a = ids[w.from], b = ids[w.to];
      if (!a) { err.push('Verbinding van onbekend blok "' + w.from + '".'); return; }
      if (!b) { err.push('Verbinding naar onbekend blok "' + w.to + '".'); return; }
      if (a.type === 'Q') err.push('Verbinding vanuit uitgang ' + w.from + ': een Q-blok heeft geen uitgang. Gebruik een merker of de bron van Q.');
      var t = T[b.type];
      if (t && !(w.pin >= 0 && w.pin < t.ins.length)) err.push('Verbinding naar ' + w.to + ' (' + b.type + '): ingang ' + w.pin + ' bestaat niet (dit blok heeft ' + t.ins.length + ' ingang' + (t.ins.length === 1 ? '' : 'en') + ').');
      var key = w.to + ':' + w.pin;
      if (in2[key]) err.push('Ingang ' + w.pin + ' van ' + w.to + ' krijgt twee verbindingen. Combineer ze eerst met een EN- of OF-blok.');
      in2[key] = 1;
    });
    (prog.blocks || []).forEach(function (b) {
      if (b.type === 'Q' && !(prog.wires || []).some(function (w) { return w.to === b.id; })) warn.push('Uitgang Q' + b.p.n + ' is nergens mee verbonden.');
    });
    return { errors: err, warnings: warn };
  }

  /* behaviour tests: [{name, steps:[{set:{I1:1}, t:0.2, expect:{Q1:1}}]}] */
  function parseIO(k) { var m = /^([IQM])\s*(\d+)$/i.exec(String(k).trim()); return m ? { k: m[1].toUpperCase(), n: +m[2] } : null; }
  function runTests(prog) {
    var res = [];
    (prog.tests || []).forEach(function (tc, ti) {
      var sim = makeSim(prog), ok = true, log = [], name = tc.name || tc.naam || ('Test ' + (ti + 1));
      var steps = tc.steps || tc.stappen || [];
      sim.step(0.05);
      steps.forEach(function (st, si) {
        if (!ok) return;
        var set = st.set || st.ingangen || {}, dur = +(st.t != null ? st.t : st.tijd != null ? st.tijd : 0.2);
        Object.keys(set).forEach(function (k) { var io = parseIO(k); if (io && io.k === 'I') sim.inputs[io.n] = set[k] ? 1 : 0; });
        for (var tt = 0; tt < Math.max(dur, 0.05) - 1e-9; tt += 0.05) sim.step(0.05);
        var exp = st.expect || st.verwacht || {};
        Object.keys(exp).forEach(function (k) {
          var io = parseIO(k); if (!io) return;
          var got = io.k === 'Q' ? (sim.outputs[io.n] ? 1 : 0) : io.k === 'M' ? mFlag(prog, sim, io.n) : (sim.inputs[io.n] ? 1 : 0);
          if (got !== (exp[k] ? 1 : 0)) { ok = false; log.push('stap ' + (si + 1) + ': ' + io.k + io.n + ' is ' + got + ', verwacht ' + (exp[k] ? 1 : 0)); }
        });
      });
      res.push({ name: name, ok: ok, log: log });
    });
    return res;
  }
  function mFlag(prog, sim, n) {
    var b = (prog.blocks || []).filter(function (x) { return x.type === 'M' && x.p.n === n; })[0];
    return b ? (sim.state[b.id].v ? 1 : 0) : 0;
  }

  /* layered layout: sources left, outputs right */
  function blkH(type) { return Math.max(2, T[type] ? T[type].ins.length : 2) * 18 + 22; }
  function autoLayout(prog) {
    var B = {}, srcs = {}, level = {};
    prog.blocks.forEach(function (b) { B[b.id] = b; srcs[b.id] = []; });
    prog.wires.forEach(function (w) { if (srcs[w.to]) srcs[w.to].push(w.from); });
    /* ignore feedback wires (cycles, e.g. interlocks) so they don't push blocks to the right */
    var succ = {}, mark = {}, back = {};
    prog.wires.forEach(function (w) { if (B[w.from] && B[w.to]) (succ[w.from] = succ[w.from] || []).push(w.to); });
    function dfs(id) { mark[id] = 1; (succ[id] || []).forEach(function (n) { if (mark[n] === 1) back[id + '>' + n] = 1; else if (!mark[n]) dfs(n); }); mark[id] = 2; }
    prog.blocks.filter(function (b) { return !srcs[b.id].length; }).concat(prog.blocks).forEach(function (b) { if (!mark[b.id]) dfs(b.id); });
    function lv(id, seen) {
      if (level[id] != null) return level[id];
      var b = B[id]; if (b.type === 'I' || b.type === 'HI' || b.type === 'LO') return (level[id] = 0);
      var l = 1;
      srcs[id].forEach(function (s) { if (B[s] && !back[s + '>' + id]) l = Math.max(l, lv(s) + 1); });
      return (level[id] = l);
    }
    prog.blocks.forEach(function (b) { lv(b.id); });
    var maxL = 0;
    prog.blocks.forEach(function (b) { if (b.type !== 'Q') maxL = Math.max(maxL, level[b.id]); });
    prog.blocks.forEach(function (b) { if (b.type === 'Q') level[b.id] = maxL + 1; });
    var cols = {};
    prog.blocks.forEach(function (b) { (cols[level[b.id]] = cols[level[b.id]] || []).push(b); });
    Object.keys(cols).forEach(function (l) {
      var y = 40;
      cols[l].sort(function (a, b) {
        var ka = a.type === 'I' || a.type === 'Q' ? a.p.n : avgSrcY(a), kb = b.type === 'I' || b.type === 'Q' ? b.p.n : avgSrcY(b);
        return ka - kb;
      });
      cols[l].forEach(function (b) { b.x = 40 + (+l) * 176; b.y = y; y += blkH(b.type) + 34; });
    });
    function avgSrcY(b) { var s = srcs[b.id].filter(function (x) { return B[x]; }); return s.length ? s.reduce(function (a, x) { return a + (B[x].y || 0); }, 0) / s.length : 0; }
    return prog;
  }

  function normalize(o, keep) {
    if (!o || typeof o !== 'object') throw { code: 'invalid_json' };
    if (o.program && typeof o.program === 'object' && !o.blocks) o = Object.assign({}, o.program, { _uitleg: o._uitleg });
    if (!Array.isArray(o.blocks)) throw { code: 'invalid_json' };
    var p = { model: MODELS[o.model] ? o.model : (keep && keep.model) || '0BA5', blocks: [], wires: [], tests: [] };
    o.blocks.forEach(function (b, i) {
      if (!b || typeof b !== 'object') return;
      var type = String(b.type || '').toUpperCase(), t = T[type];
      var par = Object.assign({}, t ? t.params : {}, b.p || b.params || {});
      if (par.n != null) par.n = +par.n;
      ['T', 'th', 'tl', 'on'].forEach(function (k) { if (par[k] != null) par[k] = +par[k]; });
      par.push = !!par.push; if (type === 'I') par.nc = !!par.nc;
      p.blocks.push({ id: String(b.id || ('B' + (i + 1))), type: type, x: +b.x || 0, y: +b.y || 0, p: par });
    });
    (Array.isArray(o.wires) ? o.wires : []).forEach(function (w) { if (w && w.from != null && w.to != null) p.wires.push({ from: String(w.from), to: String(w.to), pin: +w.pin || 0 }); });
    if (Array.isArray(o.tests)) p.tests = o.tests;
    var needLayout = p.blocks.some(function (b) { return !b.x && !b.y; });
    if (needLayout) autoLayout(p);
    return { prog: p, uitleg: String(o._uitleg || '') };
  }

  function example() {
    return normalize({ model: '0BA5', blocks: [
      { id: 'B1', type: 'I', p: { n: 1, push: true, desc: 'START' } },
      { id: 'B2', type: 'I', p: { n: 2, push: true, nc: true, desc: 'STOP (NC)' } },
      { id: 'B3', type: 'I', p: { n: 3, nc: true, desc: 'NOODSTOP (NC)' } },
      { id: 'B4', type: 'I', p: { n: 4, nc: true, desc: 'THERMISCH (NC)' } },
      { id: 'B5', type: 'AND', p: {} },
      { id: 'B6', type: 'NOT', p: {} },
      { id: 'B7', type: 'RS', p: {} },
      { id: 'B8', type: 'Q', p: { n: 1, desc: 'motor' } },
      { id: 'B9', type: 'NOT', p: {} },
      { id: 'B10', type: 'Q', p: { n: 2, desc: 'lamp noodstop' } },
      { id: 'B11', type: 'NOT', p: {} },
      { id: 'B12', type: 'Q', p: { n: 3, desc: 'lamp thermische veiligheid' } },
      { id: 'B13', type: 'CLK', p: { th: 0.5, tl: 0.5 } },
      { id: 'B14', type: 'OR', p: {} },
      { id: 'B15', type: 'Q', p: { n: 4, desc: 'zoemer' } }
    ], wires: [
      { from: 'B2', to: 'B5', pin: 0 }, { from: 'B3', to: 'B5', pin: 1 }, { from: 'B4', to: 'B5', pin: 2 },
      { from: 'B5', to: 'B6', pin: 0 }, { from: 'B1', to: 'B7', pin: 0 }, { from: 'B6', to: 'B7', pin: 1 },
      { from: 'B7', to: 'B8', pin: 0 }, { from: 'B3', to: 'B9', pin: 0 }, { from: 'B9', to: 'B10', pin: 0 },
      { from: 'B4', to: 'B11', pin: 0 }, { from: 'B11', to: 'B12', pin: 0 },
      { from: 'B9', to: 'B14', pin: 0 }, { from: 'B11', to: 'B14', pin: 1 }, { from: 'B14', to: 'B13', pin: 0 }, { from: 'B13', to: 'B15', pin: 0 }
    ], tests: [
      { name: 'Start en stop', steps: [{ set: { I1: 1 }, t: 0.2 }, { set: { I1: 0 }, t: 0.2, expect: { Q1: 1 } }, { set: { I2: 0 }, t: 0.2, expect: { Q1: 0 } }, { set: { I2: 1 }, t: 0.2, expect: { Q1: 0 } }] },
      { name: 'Noodstop schakelt uit en meldt', steps: [{ set: { I1: 1 }, t: 0.2 }, { set: { I1: 0, I3: 0 }, t: 0.2, expect: { Q1: 0, Q2: 1 } }] },
      { name: 'Thermisch relais', steps: [{ set: { I1: 1 }, t: 0.2 }, { set: { I1: 0, I4: 0 }, t: 0.2, expect: { Q1: 0, Q3: 1 } }] }
    ] }).prog;
  }

  return { T: T, MODELS: MODELS, makeSim: makeSim, check: check, runTests: runTests, autoLayout: autoLayout, normalize: normalize, example: example, restInputs: restInputs, blkH: blkH };
})();
if (typeof module !== 'undefined') module.exports = LL;
