/* LAZY Electrical app: the workspace UI around the engine (LE.model, LE.render, LE.auto, LE.lists, LE.checks, LE.ai).
   Layout: ribbon (commands) · workspace tree + properties (left) · tabbed sheets and lists (centre) · symbols + AI (right).
   Every edit goes through S.H (undo history), then changed() redraws what depends on it. */
(function () {
  'use strict';
  const M = LE.model, SY = LE.symbols, R = LE.render, AU = LE.auto, L = LE.lists, CK = LE.checks, AI = LE.ai, PT = LE.parts;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* ---------- icons (24 px grid, stroke) ---------- */
  const ICON = {
    new: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M12 10v7M8.5 13.5h7"/>', open: '<path d="M3 6h6l2 2h10v11H3z"/>',
    save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7V3M8 21v-7h8v7"/>', pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 17v-5h1.5a1.5 1.5 0 0 1 0 3H9"/>',
    undo: '<path d="M9 5L4 10l5 5"/><path d="M4 10h10a5 5 0 0 1 0 10h-4"/>', redo: '<path d="M15 5l5 5-5 5"/><path d="M20 10H10a5 5 0 0 0 0 10h4"/>',
    cut: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 16L18 3M16 16L6 3"/>', copy: '<rect x="8" y="8" width="12" height="13" rx="1"/><path d="M16 8V4H4v13h4"/>',
    paste: '<rect x="5" y="4" width="14" height="17" rx="1"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/>', del: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 3v5h-5"/>', mirror: '<path d="M12 3v18" stroke-dasharray="2 2"/><path d="M9 6L3 18h6zM15 6l6 12h-6z"/>',
    pagedel: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 14h6"/>', pageprops: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 11h6M9 14h6M9 17h4"/>',
    page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', prev: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', line: '<path d="M4 20L20 4"/>', rect: '<rect x="4" y="6" width="16" height="12"/>', circle: '<circle cx="12" cy="12" r="8"/>',
    frame: '<rect x="3" y="5" width="18" height="14" stroke-dasharray="4 2 1 2"/><path d="M6 9h5"/>',
    grid: '<path d="M4 4h.01M12 4h.01M20 4h.01M4 12h.01M12 12h.01M20 12h.01M4 20h.01M12 20h.01M20 20h.01" stroke-width="2.8"/>',
    zoomin: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5M10.5 8v5"/>', zoomout: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5M8 10.5h5"/>',
    zoomfit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    pottop: '<path d="M3 6h18M5 4L3 6l2 2M19 4l2 2-2 2"/><path d="M8 6v13M16 6v13" stroke-dasharray="2 2"/>',
    potbot: '<path d="M3 18h18M5 16l-2 2 2 2M19 16l2 2-2 2"/><path d="M8 18V5M16 18V5" stroke-dasharray="2 2"/>',
    potcur: '<path d="M3 12h18M5 10l-2 2 2 2M19 10l2 2-2 2"/><path d="M12 4v4M12 16v4"/>',
    wire1: '<path d="M6 4v8h12v8"/><circle cx="6" cy="4" r="1.4" fill="currentColor"/>', wire3: '<path d="M5 3v18M12 3v18M19 3v18"/>',
    ref: '<path d="M12 3v11M7 10l5 5 5-5"/><path d="M8 20h8"/>', cable: '<path d="M6 4v16M11 4v16M16 4v16"/><path d="M3 15L19 8" stroke-width="2.2"/>',
    term: '<path d="M12 3v6M12 15v6"/><circle cx="12" cy="12" r="3"/>', wirenum: '<path d="M7 3v18"/><path d="M11 9.5a2.2 2.2 0 1 1 3.7 1.6L11 15h5"/>',
    renumber: '<path d="M4 7h8M4 12h6M4 17h8"/><path d="M17 5v14M14 16l3 3 3-3"/>', check: '<path d="M4 12l5 5L20 6"/>',
    lists: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke-width="2"/>', table: '<rect x="3" y="4" width="18" height="16"/><path d="M3 9h18M3 14h18M9 4v16"/>',
    ai: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M18 15l.8 2.2 2.2.8-2.2.8L18 21l-.8-2.2-2.2-.8 2.2-.8z"/>',
    select: '<path d="M5 3l14 8-6 2-3 6z"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5"/>', examples: '<path d="M4 5h7v14H4zM13 5h7v14h-7"/>',
    logo: '<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M8 9v6M12 9v6M16 9v6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', folder: '<path d="M3 6h6l2 2h10v11H3z"/>',
    sym: '<path d="M12 3v6M12 15v6"/><rect x="8" y="9" width="8" height="6"/>', parts: '<path d="M4 8l8-4 8 4-8 4z"/><path d="M4 8v8l8 4 8-4V8"/>',
    panelL: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16"/>', panelR: '<rect x="3" y="4" width="18" height="16"/><path d="M15 4v16"/>', panelB: '<rect x="3" y="4" width="18" height="16"/><path d="M3 15h18"/>',
    pin: '<path d="M8 4h8M12 4v8M7 12h10l-2 4H9z M12 16v5"/>'
  };
  const ic = (n) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[n] || ICON.sym) + '</svg>';

  /* ---------- storage ---------- */
  const KEY = 'lazyelectrical.v2.project', PREF = 'lazyelectrical.v2.prefs', RULES = 'lazyelectrical.rules';
  function lsGet(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- state ---------- */
  const S = {
    H: null, tabs: [], active: -1, sel: new Set(), tool: { name: 'select' }, views: {}, clip: null, A: null, checks: null,
    rtab: 'start', ltab: 'tree', rdock: 'syms', prefs: Object.assign({ grid: true, wireNos: true, favs: ['no', 'nc', 'coil', 'pb_no', 'pb_nc', 'lamp', 'term'], left: true, right: true, model: 'claude-opus-5-5', remember: false }, lsGet(PREF, {})),
    cursor: null, lastMaster: '', showChecks: false, findResults: null, treeOpen: lsGet(PREF + '.tree', {})
  };
  const P = () => S.H.P;
  const savePrefs = () => lsSet(PREF, S.prefs);
  const analysis = () => S.A || (S.A = M.analyze(P()));
  const checks = () => S.checks || (S.checks = CK.run(P(), analysis()));
  const curTab = () => S.tabs[S.active] || null;
  const curPage = () => { const t = curTab(); return t && t.kind === 'page' ? M.findPage(P(), t.id) : null; };

  let saveTimer = 0;
  function persist() {
    clearTimeout(saveTimer);
    $('#saved').textContent = 'niet bewaard…';
    saveTimer = setTimeout(() => { $('#saved').textContent = lsSet(KEY, P()) ? 'automatisch bewaard in deze browser' : 'kon niet automatisch bewaren (opslag vol?) — gebruik Opslaan'; }, 400);
  }
  /* after every change: analysis is stale, everything that shows project data is redrawn */
  function changed(o) {
    o = o || {};
    S.A = null; S.checks = null;
    PT.setProject(P());
    S.tabs = S.tabs.filter((t) => t.kind !== 'page' || M.findPage(P(), t.id));
    if (S.active >= S.tabs.length) S.active = S.tabs.length - 1;
    const pg = curPage();
    if (pg) { const ids = new Set(pg.items.map((i) => i.id)); S.sel.forEach((id) => { if (!ids.has(id)) S.sel.delete(id); }); } else S.sel.clear();
    persist(); renderAll(o);
  }
  function exec(label, fn, o) {
    try { const r = S.H.run(label, fn); changed(o); return r; }
    catch (e) { console.error(e); toast(e.message || String(e)); return null; }
  }
  function setProject(Pn, label) {
    if (label) S.H.replace(label, Pn); else S.H.reset(Pn);
    S.tabs = []; S.active = -1; S.sel.clear(); S.views = {};
    const first = P().pages.find((p) => p.kind !== 'cover') || P().pages[0];
    changed();
    if (first) openPage(first.id);
  }

  /* ---------- small UI helpers: toast, dialog, context menu ---------- */
  function toast(m, ms) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms || 4200); }
  /* dialog({title, text, fields:[{k,label,type,value,options,placeholder,list}], ok, cancel}) -> Promise(values | null) */
  function dialog(o) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div'); wrap.className = 'modal';
      const fields = (o.fields || []).map((f, i) => {
        const id = 'dlg' + i, v = esc(f.value == null ? '' : f.value);
        let inp;
        if (f.type === 'select') inp = '<select id="' + id + '">' + f.options.map((op) => '<option value="' + esc(op[0]) + '"' + (String(op[0]) === String(f.value) ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select>';
        else if (f.type === 'textarea') inp = '<textarea id="' + id + '" rows="' + (f.rows || 5) + '" placeholder="' + esc(f.placeholder || '') + '">' + v + '</textarea>';
        else if (f.type === 'check') return '<label class="chk" style="display:flex;gap:6px;align-items:center;color:var(--ink)"><input type="checkbox" id="' + id + '"' + (f.value ? ' checked' : '') + ' style="width:auto"> ' + esc(f.label) + '</label>';
        else inp = '<input id="' + id + '" type="' + (f.type || 'text') + '" value="' + v + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.list ? ' list="' + id + 'l"' : '') + ' autocomplete="off">' + (f.list ? '<datalist id="' + id + 'l">' + f.list.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>' : '');
        return '<div class="f"><label for="' + id + '">' + esc(f.label) + '</label>' + inp + '</div>';
      }).join('');
      wrap.innerHTML = '<div class="box" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><h2>' + esc(o.title) + '</h2>' + (o.text ? '<div class="msg">' + esc(o.text) + '</div>' : '') + (o.html || '') + fields +
        '<div class="acts">' + (o.cancel === false ? '' : '<button type="button" class="btn" data-a="no">' + esc(o.cancel || 'Annuleren') + '</button>') + '<button type="button" class="btn primary" data-a="ok">' + esc(o.ok || 'OK') + '</button></div></div>';
      document.body.appendChild(wrap);
      const done = (ok) => {
        const vals = ok ? {} : null;
        if (ok) (o.fields || []).forEach((f, i) => { const e = $('#dlg' + i, wrap); vals[f.k] = f.type === 'check' ? e.checked : e.value; });
        wrap.remove(); resolve(vals);
      };
      wrap.addEventListener('click', (e) => { const a = e.target.closest('[data-a]'); if (a) done(a.dataset.a === 'ok'); else if (e.target === wrap) done(false); });
      wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); done(true); } });
      const f0 = wrap.querySelector('input,select,textarea') || wrap.querySelector('[data-a=ok]'); setTimeout(() => { f0.focus(); if (f0.select) f0.select(); }, 0);
    });
  }
  const confirmDlg = (title, text, ok) => dialog({ title, text, ok: ok || 'Ja' }).then((v) => !!v);
  function menu(x, y, items) {
    closeMenu();
    const m = document.createElement('div'); m.className = 'ctx'; m.id = 'ctx';
    m.innerHTML = items.map((it, i) => it === '-' ? '<hr>' : '<button type="button" data-i="' + i + '">' + esc(it[0]) + '</button>').join('');
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; closeMenu(); items[+b.dataset.i][1](); });
  }
  function closeMenu() { const m = $('#ctx'); if (m) m.remove(); }
  addEventListener('pointerdown', (e) => { if (!e.target.closest('#ctx')) closeMenu(); }, true);

  /* ---------- downloads (claude.ai download capability, otherwise a normal browser download) ---------- */
  let DL = null;
  function download(name, data, type) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: type || 'application/octet-stream' });
    if (DL) return DL.save({ filename: name, data: blob }).then((r) => { if (r && r.status === 'saved') toast(name + ' opgeslagen.'); }).catch((e) => { if (!(e && e.code === 'declined')) toast('Opslaan lukt hier niet. Open de LAZY Electrical-pagina buiten claude.ai.'); });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    return Promise.resolve();
  }
  const fileName = (ext) => (String(P().info.name || 'project').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'project') + ext;

  /* =====================================================================
     Ribbon
     ===================================================================== */
  const RIB = [
    { id: 'file', label: 'Bestand', file: true },
    { id: 'start', label: 'Start', groups: [
      ['Klembord', [['paste', 'Plakken', 'paste', true], ['col', [['cut', 'Knippen', 'cut'], ['copy', 'Kopiëren', 'copy'], ['del', 'Verwijderen', 'del']]]]],
      ['Bewerken', [['col', [['undo', 'Ongedaan maken', 'undo'], ['redo', 'Opnieuw', 'redo'], ['selall', 'Alles selecteren', 'select']]], ['col', [['rotate', 'Roteren (R)', 'rotate'], ['mirror', 'Spiegelen', 'mirror'], ['lock', 'Tag vergrendelen', 'lock']]]]],
      ['Bladen', [['newpage', 'Nieuw blad', 'new', true], ['col', [['pageprops', 'Bladeigenschappen', 'pageprops'], ['duppage', 'Blad kopiëren', 'copy'], ['delpage', 'Blad verwijderen', 'pagedel']]], ['col', [['prevpage', 'Vorig blad', 'prev'], ['nextpage', 'Volgend blad', 'next'], ['renumpages', 'Bladen hernummeren', 'renumber']]]]],
      ['Project', [['projinfo', 'Project­gegevens', 'info', true], ['col', [['find', 'Zoeken / vervangen', 'search'], ['renumdev', 'Toestellen hernummeren', 'renumber'], ['renumterm', 'Klemmen hernummeren', 'term']]]]],
      ['Controle', [['check', 'Controleren', 'check', true]]]
    ] },
    { id: 'draw', label: 'Tekenen', groups: [
      ['Selecteren', [['t_select', 'Selecteren', 'select', true]]],
      ['Elementen', [['t_text', 'Tekst', 'text', true], ['col', [['t_line', 'Lijn', 'line'], ['t_rect', 'Rechthoek', 'rect'], ['t_circle', 'Cirkel', 'circle']]]]],
      ['Structuur', [['t_flframe', 'Functie/plaats-kader', 'frame', true]]],
      ['Raster', [['grid', 'Raster tonen', 'grid', true]]]
    ] },
    { id: 'elec', label: 'Elektrisch', groups: [
      ['Potentiaal', [['col', [['pot_top', 'Boven (F11)', 'pottop'], ['pot_bottom', 'Onder (F12)', 'potbot'], ['t_potcur', 'Cursor', 'potcur']]]]],
      ['Verbindingen', [['t_wire1', '1 draad', 'wire1', true], ['t_wire3', '3 draden', 'wire3', true], ['col', [['t_wire2', '2 draden', 'wire3'], ['t_wire4', '4 draden', 'wire3'], ['t_wire5', '5 draden', 'wire3']]]]],
      ['Draden', [['wirenos', 'Draadnummers', 'wirenum', true], ['col', [['wiremode', 'Nummering…', 'settings'], ['t_ref', 'Draadverwijzing', 'ref']]]]],
      ['Kabel', [['t_cable', 'Kabel', 'cable', true]]],
      ['Klemmen', [['col', [['t_term', 'Klem plaatsen', 'term'], ['renumterm', 'Klemmen hernummeren', 'renumber']]]]],
      ['Functie/plaats', [['t_flframe', 'Kader', 'frame', true]]]
    ] },
    { id: 'lists', label: 'Lijsten', groups: [
      ['Grafische lijsten', [['l_bom', 'Stuklijst', 'lists', true], ['l_terminals', 'Klemmenplan', 'term', true], ['col', [['l_contents', 'Inhoudsopgave', 'lists'], ['l_components', 'Componenten', 'lists'], ['l_cables', 'Kabellijst', 'cable']]], ['col', [['l_cores', 'Aderlijst', 'cable'], ['l_wires', 'Draadlijst', 'wire1'], ['l_plcio', 'PLC-lijst', 'logo']]]]],
      ['Databaselijsten', [['d_components', 'Componenten', 'table', true], ['col', [['d_terminals', 'Klemmen', 'table'], ['d_cables', 'Kabels', 'table'], ['d_wires', 'Draden', 'table']]], ['col', [['d_plcio', 'PLC I/O', 'table'], ['d_contacts', 'Contacten', 'table'], ['d_parts', 'Artikelen', 'parts']]]]],
      ['Uitvoer', [['pdf', 'PDF', 'pdf', true], ['csvall', 'Lijsten als CSV', 'table', true]]]
    ] },
    { id: 'cab', label: 'Kast', groups: [
      ['Kastindeling', [['newcab', 'Nieuwe kast­indeling', 'new', true]]],
      ['Montage', [['t_encl', 'Montage­plaat', 'rect', true], ['t_rail', 'DIN-rail', 'lists', true], ['t_duct', 'Kabel­goot', 'table', true]]],
      ['Toestellen', [['pick', 'Picklijst', 'parts', true], ['col', [['rotate', 'Toestel draaien', 'rotate'], ['heat', 'Warmte­berekening', 'info']]]]]
    ] },
    { id: 'view', label: 'Beeld', groups: [
      ['Zoom', [['zoomfit', 'Passend', 'zoomfit', true], ['col', [['zoomin', 'Inzoomen (+)', 'zoomin'], ['zoomout', 'Uitzoomen (−)', 'zoomout']]]]],
      ['Tonen', [['grid', 'Raster', 'grid', true], ['wirenos', 'Draadnummers', 'wirenum', true]]],
      ['Panelen', [['col', [['panelL', 'Werkruimte', 'panelL'], ['panelR', 'Symbolen en AI', 'panelR'], ['panelB', 'Controle', 'panelB']]]]]
    ] },
    { id: 'ai', label: 'AI-assistent', groups: [
      ['Assistent', [['aiopen', 'AI-assistent', 'ai', true]]],
      ['Snel', [['col', [['ai_new', 'Nieuw ontwerp…', 'new'], ['ai_check', 'Schema laten nakijken', 'check'], ['ai_explain', 'Schema uitleggen', 'help']]]]]
    ] }
  ];
  const TOOLS = { t_select: 'select', t_text: 'text', t_line: 'line', t_rect: 'rect', t_circle: 'circle', t_flframe: 'flframe', t_potcur: 'potcur', t_wire1: 'wire', t_wire2: 'wire', t_wire3: 'wire', t_wire4: 'wire', t_wire5: 'wire', t_ref: 'place', t_term: 'place', t_cable: 'cable', t_encl: 'encl', t_rail: 'rail', t_duct: 'duct' };
  function pressed(id) {
    if (id === 'grid') return S.prefs.grid;
    if (id === 'wirenos') return S.prefs.wireNos;
    if (id === 'panelL') return S.prefs.left; if (id === 'panelR') return S.prefs.right; if (id === 'panelB') return S.showChecks;
    if (TOOLS[id]) { const t = S.tool; if (t.name !== TOOLS[id]) return false; if (t.name === 'wire') return 't_wire' + t.n === id; if (t.name === 'place') return (id === 't_ref' && t.s === 'ref') || (id === 't_term' && t.s === 'term'); return true; }
    if (id === 'pick') return S.tool.name === 'cab';
    return null;
  }
  function renderRibbon() {
    $('#rtabs').innerHTML = RIB.map((t) => '<button type="button" role="tab" data-rt="' + t.id + '"' + (t.file ? ' class="file"' : '') + ' aria-selected="' + (S.rtab === t.id) + '">' + t.label + '</button>').join('');
    const tab = RIB.find((t) => t.id === S.rtab) || RIB[1];
    const btn = (b) => { const pr = pressed(b[0]); return '<button type="button" class="rb' + (b[3] ? ' big' : '') + '" data-cmd="' + b[0] + '"' + (pr != null ? ' aria-pressed="' + pr + '"' : '') + ' title="' + esc(b[1].replace('­', '')) + '">' + ic(b[2]) + '<span>' + b[1] + '</span></button>'; };
    $('#ribbon').innerHTML = (tab.groups || []).map((g) => '<div class="rgroup"><div class="items">' + g[1].map((b) => b[0] === 'col' ? '<div class="col">' + b[1].map(btn).join('') + '</div>' : btn(b)).join('') + '</div><div class="glabel">' + g[0] + '</div></div>').join('');
    $('#qat').innerHTML = [['save', 'Opslaan (Ctrl+S)', 'save'], ['undo', 'Ongedaan maken (Ctrl+Z)', 'undo'], ['redo', 'Opnieuw (Ctrl+Y)', 'redo'], ['pdf', 'PDF', 'pdf']].map((b) => '<button type="button" data-cmd="' + b[0] + '" title="' + b[1] + '" aria-label="' + b[1] + '">' + ic(b[2]) + '</button>').join('');
  }

  /* =====================================================================
     Commands (ribbon buttons, menus and keyboard all end up here)
     ===================================================================== */
  const CMD = {
    file: () => openBack('home'), save: () => saveFile(), undo: () => { const l = S.H.back(); if (l) { changed(); toast('Ongedaan: ' + l, 1800); } }, redo: () => { const l = S.H.fwd(); if (l) { changed(); toast('Opnieuw: ' + l, 1800); } },
    copy: () => copySel(), cut: () => { if (copySel()) delSel(); }, paste: () => pasteClip(), del: () => delSel(),
    selall: () => { const pg = curPage(); if (!pg) return; S.sel = new Set(pg.items.map((i) => i.id)); renderCanvas(); renderProps(); },
    rotate: () => { const pg = curPage(); if (pg && S.sel.size) exec('Roteren', (Q) => { M.rotateItems(Q, pg.id, [...S.sel]); M.findPage(Q, pg.id).items.forEach((it) => { if (S.sel.has(it.id) && (it.k === 'cab' || it.k === 'duct')) { const w = it.w; it.w = it.h; it.h = w; } }); }); else if (S.tool.name === 'place') { S.tool.r = ((S.tool.r || 0) + 90) % 360; drawOverlay(); } },
    mirror: () => { const pg = curPage(); if (pg && S.sel.size) exec('Spiegelen', (Q) => M.mirrorItems(Q, pg.id, [...S.sel])); },
    lock: () => { const pg = curPage(); if (!pg || !S.sel.size) return; exec('Tag vergrendelen', (Q) => { const pq = M.findPage(Q, pg.id), on = !pq.items.filter((i) => S.sel.has(i.id)).every((i) => i.lock); pq.items.forEach((i) => { if (S.sel.has(i.id)) { if (on) i.lock = true; else delete i.lock; } }); }); },
    newpage: () => newPage(), pageprops: () => pageProps(), delpage: () => delPage(), duppage: () => dupPage(),
    prevpage: () => stepPage(-1), nextpage: () => stepPage(1),
    renumpages: () => confirmDlg('Bladen hernummeren', 'Alle bladen krijgen de nummers 1, 2, 3 … in hun huidige volgorde (pagina-indexen zoals 1a verdwijnen). Toestellen met een tag op basis van het bladnummer behouden hun tag.').then((ok) => ok && exec('Bladen hernummeren', (Q) => M.renumberPages(Q))),
    projinfo: () => openBack('info'), find: () => findReplace(),
    renumdev: () => confirmDlg('Toestellen hernummeren', 'Alle toestellen krijgen nieuwe tags, blad per blad van links naar rechts. Contacten volgen hun spoel. Vergrendelde tags blijven.').then((ok) => { if (ok) exec('Toestellen hernummeren', (Q) => M.renumberDevices(Q)); }),
    renumterm: () => renumTerminals(),
    check: () => { S.showChecks = true; renderChecks(); renderRibbon(); const c = CK.count(checks()); toast(c.error + ' fout' + (c.error === 1 ? '' : 'en') + ', ' + c.warn + ' waarschuwing' + (c.warn === 1 ? '' : 'en') + '.'); },
    grid: () => { S.prefs.grid = !S.prefs.grid; savePrefs(); renderRibbon(); renderCanvas(); },
    wirenos: () => { S.prefs.wireNos = !S.prefs.wireNos; savePrefs(); renderRibbon(); renderCanvas(); },
    wiremode: () => dialog({ title: 'Draadnummering', fields: [{ k: 'm', label: 'Nummering', type: 'select', value: P().settings.wireNo, options: [['seq', 'Doorlopend: 1, 2, 3 …'], ['pagecol', 'Blad.kolom: 2.3, 2.3.1 …'], ['none', 'Geen automatische nummers']] }], text: 'Een potentiaal met een naam (L1, N, +24V …) houdt die naam. Een eigen nummer typ je bij de eigenschappen van een draad; het geldt voor de hele verbinding.' }).then((v) => v && exec('Draadnummering', (Q) => { Q.settings.wireNo = v.m; })),
    pot_top: () => addPotential('top'), pot_bottom: () => addPotential('bottom'),
    newcab: () => newPage('cabinet'), pick: () => { const pg = curPage(); if (!pg || pg.kind !== 'cabinet') { toast('Open eerst een kastindeling (Kast → Nieuwe kastindeling).'); return; } S.sel.clear(); showLeft('props'); renderCanvas(); renderProps(); },
    heat: () => { const pg = curPage(); if (!pg || pg.kind !== 'cabinet') { toast('Open eerst een kastindeling.'); return; } const h = LE.cabinet.heat(P(), pg, analysis()); dialog({ title: 'Warmteberekening', text: 'Vermogensverlies van de geplaatste toestellen: ' + h.watts + ' W' + (h.unknown ? '\n' + h.unknown + ' toestel(len) zonder artikel met verliesgegevens tellen niet mee: kies bij die toestellen een artikelnummer.' : '') + '\n\nVuistregel: een gesloten stalen kast van ongeveer 600 × 800 × 250 mm voert zonder ventilator zo\'n 50 à 80 W af bij 10 °C temperatuurverschil. Bij meer verlies is een ventilator met filter nodig.', cancel: false }); },
    zoomfit: () => { const pg = curPage(); if (pg) { delete S.views[pg.id]; renderCanvas(); } }, zoomin: () => zoomBy(1 / 1.25), zoomout: () => zoomBy(1.25),
    panelL: () => { S.prefs.left = !S.prefs.left; savePrefs(); layoutDocks(); renderRibbon(); }, panelR: () => { S.prefs.right = !S.prefs.right; savePrefs(); layoutDocks(); renderRibbon(); },
    panelB: () => { S.showChecks = !S.showChecks; renderChecks(); renderRibbon(); },
    pdf: () => exportPdf(), csvall: () => exportCsv(),
    aiopen: () => showRight('ai'), ai_new: () => { showRight('ai'); const t = $('#aiText'); if (t) { t.value = 'Ontwerp een nieuw project: '; t.focus(); } },
    ai_check: () => { showRight('ai'); runAI('Kijk het schema na op fouten en gevaarlijke situaties (beveiliging, noodstop, vergrendelingen, kortsluiting, ontbrekende contacten). Leg in gewone taal uit wat je vindt en hoe het beter kan.', 'ask'); },
    ai_explain: () => { showRight('ai'); runAI('Leg in eenvoudige taal uit hoe deze schakeling werkt, stap voor stap (wat gebeurt er als je op start drukt, wat doet elke spoel en elk contact).', 'ask'); }
  };
  Object.keys(TOOLS).forEach((k) => {
    CMD[k] = () => {
      const n = TOOLS[k];
      if (n === 'wire') setTool({ name: 'wire', n: +k.slice(6) });
      else if (k === 't_ref') setTool({ name: 'place', s: 'ref' });
      else if (k === 't_term') setTool({ name: 'place', s: 'term' });
      else setTool({ name: n });
    };
  });
  ['bom', 'terminals', 'contents', 'components', 'cables', 'cores', 'wires', 'plcio'].forEach((k) => { CMD['l_' + k] = () => openTab({ kind: 'list', key: k }); });
  ['components', 'terminals', 'cables', 'wires', 'plcio', 'contacts', 'parts'].forEach((k) => { CMD['d_' + k] = () => openTab({ kind: 'db', key: k }); });
  function run(id) { closeMenu(); const f = CMD[id]; if (f) f(); }

  /* =====================================================================
     Workspace tree
     ===================================================================== */
  const LISTNAMES = { contents: 'Inhoudsopgave', bom: 'Stuklijst', components: 'Componentenlijst', terminals: 'Klemmenplan', cables: 'Kabellijst', cores: 'Aderlijst', wires: 'Draadlijst', plcio: 'PLC-toewijzingslijst', contacts: 'Contactenlijst' };
  const DBNAMES = { components: 'Componenten', terminals: 'Klemmen', cables: 'Kabels', cores: 'Aders', wires: 'Draden', plcio: 'PLC I/O', contacts: 'Contacten', pages: 'Bladen', parts: 'Artikelen (database)' };
  function renderTree() {
    const Pj = P(), t = curTab(), open = (k) => S.treeOpen[k] !== false;
    const node = (attrs, label, o) => '<div class="node' + (o.on ? ' on' : '') + '" ' + attrs + ' tabindex="0">' + (o.tw != null ? '<span class="tw">' + o.tw + '</span>' : '<span class="tw"></span>') + ic(o.icon) .replace('<svg', '<svg class="ic"') + (o.no != null ? '<span class="no">' + esc(o.no) + '</span>' : '') + '<span>' + esc(label) + '</span>' + (o.cnt != null ? '<span class="cnt">' + o.cnt + '</span>' : '') + '</div>';
    const grp = (k, label, icon, inner, cnt) => '<li>' + node('data-fold="' + k + '"', label, { tw: open(k) ? '▾' : '▸', icon, cnt }) + (open(k) ? '<ul>' + inner + '</ul>' : '') + '</li>';
    const pageNode = (pg) => '<li>' + node('data-page="' + pg.id + '"', pg.title || '(zonder titel)', { icon: pg.kind === 'cover' ? 'info' : pg.kind === 'cabinet' ? 'rect' : 'page', no: M.pageLabel(pg), on: t && t.kind === 'page' && t.id === pg.id }) + '</li>';
    const covers = Pj.pages.filter((p) => p.kind === 'cover'), cabs = Pj.pages.filter((p) => p.kind === 'cabinet'), sch = Pj.pages.filter((p) => p.kind !== 'cover' && p.kind !== 'cabinet');
    /* pages can be grouped in folders (page.folder) */
    const folders = []; sch.forEach((p) => { if (p.folder && folders.indexOf(p.folder) < 0) folders.push(p.folder); });
    const schInner = sch.filter((p) => !p.folder).map(pageNode).join('') + folders.map((f) => grp('f:' + f, f, 'folder', sch.filter((p) => p.folder === f).map(pageNode).join(''))).join('');
    const lists = Object.keys(LISTNAMES).map((k) => '<li>' + node('data-list="' + k + '"', LISTNAMES[k], { icon: 'lists', on: t && t.kind === 'list' && t.key === k }) + '</li>').join('');
    const dbs = Object.keys(DBNAMES).map((k) => '<li>' + node('data-db="' + k + '"', DBNAMES[k], { icon: k === 'parts' ? 'parts' : 'table', on: t && t.kind === 'db' && t.key === k }) + '</li>').join('');
    $('#treeBody').innerHTML = '<ul class="tree">' + grp('proj', Pj.info.name || 'Project', 'folder',
      (covers.length ? grp('cover', 'Voorblad', 'info', covers.map(pageNode).join('')) : '') + grp('sch', 'Stroomschema\'s', 'folder', schInner || '<li><div class="node" style="color:var(--muted)">(nog geen bladen)</div></li>', sch.length) +
      grp('cabs', 'Kastindeling', 'rect', cabs.length ? cabs.map(pageNode).join('') : '<li><div class="node" data-cmd="newcab" style="color:var(--muted)">(nieuwe kastindeling…)</div></li>', cabs.length) +
      grp('lists', 'Grafische lijsten', 'lists', lists) + grp('dbs', 'Databaselijsten', 'table', dbs)) + '</ul>';
  }
  function treeClick(e) {
    const n = e.target.closest('.node'); if (!n) return;
    if (n.dataset.fold) { S.treeOpen[n.dataset.fold] = S.treeOpen[n.dataset.fold] === false; lsSet(PREF + '.tree', S.treeOpen); renderTree(); return; }
    if (n.dataset.page) openPage(n.dataset.page);
    else if (n.dataset.list) openTab({ kind: 'list', key: n.dataset.list });
    else if (n.dataset.db) openTab({ kind: 'db', key: n.dataset.db });
  }
  function treeMenu(e) {
    const n = e.target.closest('.node'); if (!n) return;
    e.preventDefault();
    if (n.dataset.page) {
      const id = n.dataset.page;
      menu(e.clientX, e.clientY, [['Openen', () => openPage(id)], ['Bladeigenschappen…', () => { openPage(id); pageProps(); }], ['Nieuw blad hierna…', () => { openPage(id); newPage(); }], ['Blad kopiëren', () => { openPage(id); dupPage(); }], '-',
        ['Omhoog', () => exec('Blad verplaatsen', (Q) => M.movePage(Q, id, -1))], ['Omlaag', () => exec('Blad verplaatsen', (Q) => M.movePage(Q, id, 1))], '-', ['Verwijderen…', () => { openPage(id); delPage(); }]]);
    } else if (n.dataset.fold === 'sch' || n.dataset.fold === 'proj') menu(e.clientX, e.clientY, [['Nieuw blad…', () => newPage()], ['Projectgegevens…', () => openBack('info')], ['Bladen hernummeren', () => run('renumpages')]]);
  }

  /* =====================================================================
     Tabs and views
     ===================================================================== */
  function openTab(t) {
    let i = S.tabs.findIndex((x) => x.kind === t.kind && (x.id || x.key) === (t.id || t.key));
    if (i < 0) { S.tabs.push(t); i = S.tabs.length - 1; }
    S.active = i; S.sel.clear();
    if (t.kind !== 'page' && S.tool.name !== 'select') S.tool = { name: 'select' };
    renderAll();
  }
  function openPage(id) { openTab({ kind: 'page', id }); }
  function closeTab(i) { S.tabs.splice(i, 1); if (S.active >= i) S.active = Math.max(0, S.active - 1); if (!S.tabs.length) S.active = -1; S.sel.clear(); renderAll(); }
  function tabLabel(t) {
    if (t.kind === 'page') { const pg = M.findPage(P(), t.id); return pg ? M.pageLabel(pg) + ' · ' + (pg.title || 'blad') : '?'; }
    if (t.kind === 'list') return LISTNAMES[t.key] || t.key;
    return 'Lijst: ' + (DBNAMES[t.key] || t.key);
  }
  function renderTabs() {
    $('#doctabs').innerHTML = S.tabs.map((t, i) => '<div class="doctab" role="tab" data-tab="' + i + '" aria-selected="' + (i === S.active) + '" tabindex="0"><span>' + esc(tabLabel(t)) + '</span><button type="button" class="x" data-close="' + i + '" aria-label="Sluiten">×</button></div>').join('');
  }
  function stepPage(d) {
    const pgs = P().pages, pg = curPage(); if (!pgs.length) return;
    let i = pg ? pgs.indexOf(pg) + d : 0; i = Math.max(0, Math.min(pgs.length - 1, i));
    openPage(pgs[i].id);
  }
  function renderView() {
    const t = curTab(), v = $('#view');
    v.classList.toggle('tableview', !!t && t.kind !== 'page');
    if (!t) { v.innerHTML = '<div class="empty">Open een blad in de werkruimte links, of laat de AI-assistent een schema ontwerpen.</div>'; return; }
    if (t.kind === 'page') { if (!$('#cv')) { v.innerHTML = '<svg id="cv" xmlns="http://www.w3.org/2000/svg"></svg>'; bindCanvas($('#cv')); } renderCanvas(); return; }
    if (t.kind === 'list') renderListView(v, t.key); else renderDb(v, t.key);
  }
  function renderListView(v, key) {
    const A = analysis(), pages = L.listPages(P(), A, [key]);
    v.innerHTML = '<div class="tablebar"><h2>' + esc(LISTNAMES[key]) + '</h2><span class="hint" style="color:var(--muted)">grafische lijst, altijd actueel · wordt mee afgedrukt in de PDF</span><span class="sp"></span><button class="btn" type="button" data-csv="' + key + '">CSV</button><button class="btn" type="button" data-cmd="d_' + (L.DEFS[key] && DBNAMES[key] ? key : 'components') + '">Als tabel</button></div>' +
      (pages.length ? pages.map((lp) => '<div style="padding:12px;background:#8c949c"><div style="max-width:1400px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.3)">' + R.svg(P(), lp.prims(), { attrs: ' style="display:block;width:100%;height:auto"' }) + '</div></div>').join('') : '<p style="padding:16px">Deze lijst is leeg: er zit nog niets van dit soort in de tekeningen.</p>');
  }
  /* database lists: the same data as tables; some columns can be edited and go straight back into the drawing */
  const EDIT = { components: ['desc', 'part', 'maker'] };
  function renderDb(v, key) {
    if (key === 'parts') return renderParts(v);
    const A = analysis();
    let cols, rows;
    if (key === 'pages') { cols = L.DEFS.contents.cols; rows = L.contents(P()); }
    else { cols = L.DEFS[key].cols; rows = L.DEFS[key].rows(P(), A); }
    const ed = EDIT[key] || [];
    v.innerHTML = '<div class="tablebar"><h2>' + esc(DBNAMES[key]) + '</h2><span style="color:var(--muted)">' + rows.filter((r) => !r.group).length + ' rijen' + (ed.length ? ' · bewerkbare kolommen passen de tekening meteen aan' : '') + ' · klik op een rij om ernaartoe te gaan</span><span class="sp"></span><button class="btn" type="button" data-csv="' + key + '">CSV</button></div>' +
      '<table class="dbt"><thead><tr>' + cols.map((c) => '<th>' + esc(c.h) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map((r, i) => r.group ? '<tr class="grp"><td colspan="' + cols.length + '">' + esc(r.group) + '</td></tr>' :
        '<tr class="' + (r.id ? 'go' : '') + '" data-row="' + i + '"' + (r.id ? ' data-go="' + esc(r.id) + '"' : '') + '>' + cols.map((c) => ed.indexOf(c.k) >= 0 && r.key ? '<td><input data-ek="' + c.k + '" data-dev="' + esc(r.key) + '" value="' + esc(r[c.k]) + '" aria-label="' + esc(c.h) + '"></td>' : '<td>' + esc(r[c.k]) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  }
  function renderParts(v) {
    const all = PT.all();
    v.innerHTML = '<div class="tablebar"><h2>Artikelen</h2><span style="color:var(--muted)">' + all.length + ' artikelen · ' + (P().parts || []).length + ' eigen</span><span class="sp"></span><button class="btn" type="button" id="partAdd">Artikel toevoegen</button><button class="btn" type="button" id="partCsv">CSV importeren</button></div>' +
      '<p class="note" style="padding:0 12px">De ingebouwde artikelen zijn een generiek startpakket (geen echte bestelnummers, behalve LOGO!). Importeer de catalogus van je leverancier als CSV met kolommen zoals artikelnummer;fabrikant;omschrijving;symbolen;NO;NC;breedte;hoogte;diepte;verlies. Kies een artikel bij een toestel in Eigenschappen: het programma controleert dan of je niet meer contacten tekent dan het toestel heeft.</p>' +
      '<table class="dbt"><thead><tr><th>Artikelnummer</th><th>Fabrikant</th><th>Omschrijving</th><th>Symbolen</th><th>Contacten</th><th>B×H×D (mm)</th><th>Verlies (W)</th><th></th></tr></thead><tbody>' +
      all.map((p) => { const own = (P().parts || []).some((x) => x.part === p.part); const c = p.contacts || {}; return '<tr><td>' + esc(p.part) + '</td><td>' + esc(p.maker) + '</td><td>' + esc(p.desc) + '</td><td>' + esc((p.sym || []).join(' ')) + '</td><td>' + esc([c.main ? c.main + ' hoofd' : '', c.NO != null ? c.NO + ' NO' : '', c.NC != null ? c.NC + ' NC' : ''].filter(Boolean).join(', ')) + '</td><td>' + esc(p.w ? p.w + '×' + p.h + '×' + p.d : '') + '</td><td>' + esc(p.loss != null ? p.loss : '') + '</td><td>' + (own ? '<button class="btn" type="button" data-partdel="' + esc(p.part) + '">Verwijderen</button>' : '') + '</td></tr>'; }).join('') + '</tbody></table>';
    $('#partAdd').onclick = () => dialog({ title: 'Artikel toevoegen', fields: [{ k: 'part', label: 'Artikelnummer' }, { k: 'maker', label: 'Fabrikant' }, { k: 'desc', label: 'Omschrijving' }, { k: 'sym', label: 'Symbolen (id\'s, bv. coil main3)' }, { k: 'NO', label: 'Aantal maakcontacten (NO)', type: 'number' }, { k: 'NC', label: 'Aantal verbreekcontacten (NC)', type: 'number' }] }).then((x) => {
      if (!x || !x.part) return;
      exec('Artikel toevoegen', (Q) => { Q.parts = (Q.parts || []).filter((p) => p.part !== x.part); const o = { part: x.part, maker: x.maker, desc: x.desc, sym: x.sym.split(/\s+/).filter(Boolean) }; if (x.NO !== '' || x.NC !== '') o.contacts = { NO: x.NO === '' ? undefined : +x.NO, NC: x.NC === '' ? undefined : +x.NC }; Q.parts.push(o); });
    });
    $('#partCsv').onclick = () => pickFile('.csv,.txt', (txt) => {
      try { const list = PT.fromCSV(txt); if (!list.length) throw new Error('geen artikelen gevonden'); exec('Artikelen importeren', (Q) => { const m = {}; (Q.parts || []).concat(list).forEach((p) => { m[p.part] = p; }); Q.parts = Object.values(m); }); toast(list.length + ' artikelen geïmporteerd.'); }
      catch (e) { toast('Importeren mislukt: ' + e.message); }
    });
  }

  /* =====================================================================
     Canvas: drawing a page, zoom/pan, tools
     ===================================================================== */
  const tpl = () => M.tplOf(P());
  function viewOf(pg) {
    const T = tpl(), W = T.W * T.g, H = T.H * T.g;
    return S.views[pg.id] || (S.views[pg.id] = { x: -8, y: -8, w: W + 16, h: H + 16 });
  }
  function itemBox(it) {
    if (it.k === 'sym') { const b = R.symBox(it); return [b[0] - 0.3, b[1] - 0.3, b[2] + 0.3, b[3] + 0.3]; }
    if (it.k === 'text') { const w = R.tw(it.s, it.size || 0.6); return it.rot ? [it.x - (it.size || 0.6), it.y - w, it.x + 0.2, it.y] : [it.a === 'end' ? it.x - w : it.a === 'middle' ? it.x - w / 2 : it.x, it.y - (it.size || 0.6), it.a === 'end' ? it.x : it.a === 'middle' ? it.x + w / 2 : it.x + w, it.y + 0.15]; }
    if (it.k === 'circle') return [it.x - it.r, it.y - it.r, it.x + it.r, it.y + it.r];
    const pts = M.itemPoints(it); let b = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach((p) => { b = [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])]; });
    return b;
  }
  function hitMarkup(pg, g) {
    const f = (v) => (Math.round(v * g * 100) / 100);
    return pg.items.map((it) => {
      let s = '';
      if (it.k === 'wire' || it.k === 'line') s = '<polyline points="' + it.pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' ') + '"/>';
      else if (it.k === 'pot') s = '<line x1="' + f(it.x1) + '" y1="' + f(it.y) + '" x2="' + f(it.x2) + '" y2="' + f(it.y) + '"/>';
      else if (it.k === 'cable') s = '<line x1="' + f(it.a[0]) + '" y1="' + f(it.a[1]) + '" x2="' + f(it.b[0]) + '" y2="' + f(it.b[1]) + '"/>';
      else if (it.k === 'flframe' || it.k === 'rect' || it.k === 'encl') s = '<rect x="' + f(it.x) + '" y="' + f(it.y) + '" width="' + f(it.w) + '" height="' + f(it.h) + '" style="fill:none!important"/>';
      else { const b = itemBox(it); s = '<rect x="' + f(b[0]) + '" y="' + f(b[1]) + '" width="' + f(b[2] - b[0]) + '" height="' + f(b[3] - b[1]) + '"/>'; }
      return '<g data-id="' + it.id + '">' + s + '</g>';
    }).join('');
  }
  function renderCanvas() {
    const cv = $('#cv'), pg = curPage(); if (!cv || !pg) return;
    const T = tpl(), g = T.g, vb = viewOf(pg);
    cv.setAttribute('viewBox', [vb.x, vb.y, vb.w, vb.h].join(' '));
    cv.setAttribute('class', S.tool.name === 'select' ? 't-select' : 't-draw');
    const prims = R.renderPage(P(), pg, analysis(), { wireNumbers: S.prefs.wireNos });
    const W = T.W * g, H = T.H * g;
    const selCss = [...S.sel].map((id) => '#cv .page g[data-id="' + id + '"] *{stroke:#e8590c}#cv .page g[data-id="' + id + '"] text{fill:#e8590c}').join('');
    const grid = S.prefs.grid ? '<defs><pattern id="gp" width="' + g + '" height="' + g + '" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r="' + (g * 0.045) + '" fill="#b8bec5"/></pattern></defs><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="url(#gp)" pointer-events="none"/>' : '';
    cv.innerHTML = '<style>' + selCss + '</style><rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fff" stroke="#5c636a" stroke-width="0.4"/>' + grid +
      '<g class="page" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" font-family="Helvetica, Arial, sans-serif">' + R.body(prims) + '</g>' +
      '<g class="hit">' + hitMarkup(pg, g) + '</g><g id="ov" pointer-events="none"></g>';
    drawOverlay();
  }
  function zoomBy(f, cx, cy) {
    const pg = curPage(); if (!pg) return;
    const v = viewOf(pg);
    if (cx == null) { cx = v.x + v.w / 2; cy = v.y + v.h / 2; }
    const nw = Math.max(20, Math.min(4000, v.w * f)), k = nw / v.w;
    v.x = cx - (cx - v.x) * k; v.y = cy - (cy - v.y) * k; v.w = nw; v.h = v.h * k;
    $('#cv').setAttribute('viewBox', [v.x, v.y, v.w, v.h].join(' '));
    renderStatus();
  }
  function toMM(e) { const cv = $('#cv'), pt = cv.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; const q = pt.matrixTransform(cv.getScreenCTM().inverse()); return [q.x, q.y]; }
  function toU(e, step) { const g = tpl().g, m = toMM(e); step = step || 1; return [Math.round(m[0] / g / step) * step, Math.round(m[1] / g / step) * step]; }
  function rawU(e) { const g = tpl().g, m = toMM(e); return [m[0] / g, m[1] / g]; }
  function setTool(t) {
    S.tool = t; S.drag = null;
    if (t.name !== 'select') S.sel.clear();
    renderRibbon(); renderSymbols(); renderCanvas(); renderProps(); renderStatus();
  }
  const HINT = {
    select: 'Klik om te selecteren, sleep om te verplaatsen (Ctrl = kopiëren), sleep op een lege plek voor een selectievenster. Dubbelklik = eigenschappen.',
    place: 'Klik om te plaatsen (R = draaien). Rechtsklik of Esc stopt.', wire: 'Klik het beginpunt, klik hoekpunten; het eindpunt op een aansluiting of dubbelklik eindigt. Esc stopt.',
    potcur: 'Klik op de hoogte waar de potentiaal moet komen.', cable: 'Klik het begin en het einde van de kabellijn, schuin over de draden.', text: 'Klik waar de tekst moet komen.',
    line: 'Klik punten; dubbelklik eindigt.', rect: 'Sleep een rechthoek.', encl: 'Klik twee hoeken van de montageplaat.', duct: 'Klik twee hoeken van de kabelgoot.', rail: 'Klik het begin en het einde van de DIN-rail.', cab: 'Klik waar het toestel moet komen; op een DIN-rail klikt het vast. Esc stopt.', circle: 'Sleep van het middelpunt naar de rand.', flframe: 'Sleep een kader rond de toestellen die bij deze functie of plaats horen.'
  };

  /* is there something to connect to at this grid point? (ends a wire) */
  function connAt(pg, p) {
    const A = analysis();
    if (A.syms.some((s) => s.pg.id === pg.id && s.pins.some((q) => q.x === p[0] && q.y === p[1]))) return true;
    if (pg.items.some((r) => r.k === 'pot' && r.y === p[1] && p[0] >= Math.min(r.x1, r.x2) && p[0] <= Math.max(r.x1, r.x2))) return true;
    return pg.items.some((w) => w.k === 'wire' && w.pts.some((q, i) => (q[0] === p[0] && q[1] === p[1]) || (i && M.onSeg(p, w.pts[i - 1], q))));
  }
  function route(a, b, vertFirst) { if (a[0] === b[0] || a[1] === b[1]) return [b]; return vertFirst ? [[a[0], b[1]], b] : [[b[0], a[1]], b]; }

  function drawOverlay() {
    const ov = $('#ov'), pg = curPage(); if (!ov || !pg) return;
    const g = tpl().g, f = (v) => Math.round(v * g * 100) / 100, t = S.tool, c = S.cursor;
    let h = '';
    if (t.name === 'place' && c) {
      const it = { s: t.s, x: c[0], y: c[1], r: t.r || 0 };
      h += '<g fill="none" stroke="#e8590c" stroke-width="0.3" opacity="0.85">' + R.ghost(P(), it).map((p) => R.primSvg(p, '#e8590c')).join('') + '</g>';
      M.symPins(it).forEach((q) => { h += '<circle cx="' + f(q.x) + '" cy="' + f(q.y) + '" r="' + g * 0.12 + '" fill="#e8590c"/>'; });
    }
    if ((t.name === 'wire' || t.name === 'line') && c) {
      const n = t.n || 1;
      const pts = t.pts ? t.pts.concat(route(t.pts[t.pts.length - 1], c, t.vert)) : [c];
      for (let k = 0; k < n; k++) {
        const vert = pts.length > 1 ? Math.abs(pts[pts.length - 1][1] - pts[0][1]) >= Math.abs(pts[pts.length - 1][0] - pts[0][0]) : true;
        const q = pts.map((p) => vert ? [p[0] + k, p[1]] : [p[0], p[1] + k]);
        h += '<polyline points="' + q.map((p) => f(p[0]) + ',' + f(p[1])).join(' ') + '" fill="none" stroke="#1971c2" stroke-width="0.35" stroke-dasharray="1.5 1"/>';
      }
      h += '<circle cx="' + f(c[0]) + '" cy="' + f(c[1]) + '" r="' + g * 0.18 + '" fill="none" stroke="' + (connAt(pg, c) ? '#2b8a3e' : '#1971c2') + '" stroke-width="0.4"/>';
    }
    if (t.name === 'cable' && c) {
      const a = t.a || c; h += '<line x1="' + f(a[0]) + '" y1="' + f(a[1]) + '" x2="' + f(c[0]) + '" y2="' + f(c[1]) + '" stroke="#1971c2" stroke-width="0.4" stroke-dasharray="1.5 1"/>';
    }
    if (t.name === 'potcur' && c) { const T = tpl(); h += '<line x1="' + f(T.x0) + '" y1="' + f(c[1]) + '" x2="' + f(T.x0 + T.cols * T.colW) + '" y2="' + f(c[1]) + '" stroke="#1971c2" stroke-width="0.35" stroke-dasharray="1.5 1"/>'; }
    if (t.name === 'cab' && c) { const k = LE.cabinet.realPerUnit(P(), pg), w = t.w / k, hh = t.h / k, rail = LE.cabinet.snapRail(P(), pg, c[0], c[1]); const y = rail ? rail.y + (35 / k) / 2 - hh / 2 : c[1] - hh / 2; h += '<rect x="' + f(c[0] - w / 2) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(hh) + '" fill="rgba(232,89,12,.12)" stroke="#e8590c" stroke-width="0.35"/>'; }
    if (t.name === 'rail' && t.a && c) h += '<rect x="' + f(Math.min(t.a[0], c[0])) + '" y="' + f(t.a[1]) + '" width="' + f(Math.abs(c[0] - t.a[0])) + '" height="' + f(35 / LE.cabinet.realPerUnit(P(), pg)) + '" fill="none" stroke="#1971c2" stroke-width="0.35" stroke-dasharray="1.5 1"/>';
    if ((t.name === 'rect' || t.name === 'flframe' || t.name === 'encl' || t.name === 'duct') && t.a && c) h += '<rect x="' + f(Math.min(t.a[0], c[0])) + '" y="' + f(Math.min(t.a[1], c[1])) + '" width="' + f(Math.abs(c[0] - t.a[0])) + '" height="' + f(Math.abs(c[1] - t.a[1])) + '" fill="none" stroke="#1971c2" stroke-width="0.35" stroke-dasharray="1.5 1"/>';
    if (t.name === 'circle' && t.a && c) h += '<circle cx="' + f(t.a[0]) + '" cy="' + f(t.a[1]) + '" r="' + f(Math.hypot(c[0] - t.a[0], c[1] - t.a[1])) + '" fill="none" stroke="#1971c2" stroke-width="0.35" stroke-dasharray="1.5 1"/>';
    if (S.drag && S.drag.kind === 'box' && S.drag.b) {
      const a = S.drag.a, b = S.drag.b, cross = b[0] < a[0];
      h += '<rect x="' + f(Math.min(a[0], b[0])) + '" y="' + f(Math.min(a[1], b[1])) + '" width="' + f(Math.abs(b[0] - a[0])) + '" height="' + f(Math.abs(b[1] - a[1])) + '" fill="' + (cross ? 'rgba(43,138,62,.08)' : 'rgba(25,113,194,.08)') + '" stroke="' + (cross ? '#2b8a3e' : '#1971c2') + '" stroke-width="0.3"' + (cross ? ' stroke-dasharray="1.5 1"' : '') + '/>';
    }
    if (c && t.name !== 'select') h += '<path d="M' + f(c[0] - 0.6) + ' ' + f(c[1]) + 'h' + f(1.2) + 'M' + f(c[0]) + ' ' + f(c[1] - 0.6) + 'v' + f(1.2) + '" stroke="#495057" stroke-width="0.2"/>';
    ov.innerHTML = h;
  }

  function bindCanvas(cv) {
    let pan = null, spaceDown = false, lastClick = 0;
    addEventListener('keydown', (e) => { if (e.code === 'Space' && !isTyping(e)) spaceDown = true; });
    addEventListener('keyup', (e) => { if (e.code === 'Space') spaceDown = false; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const m = toMM(e); zoomBy(e.deltaY > 0 ? 1.15 : 1 / 1.15, m[0], m[1]); }, { passive: false });
    cv.addEventListener('pointerdown', (e) => {
      const pg = curPage(); if (!pg) return;
      cv.setPointerCapture(e.pointerId);
      if (e.button === 1 || (e.button === 0 && spaceDown)) { const v = viewOf(pg); pan = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, k: v.w / cv.clientWidth }; e.preventDefault(); return; }
      if (e.button !== 0) return;
      const t = S.tool, u = toU(e);
      if (t.name === 'select') {
        const hit = e.target.closest && e.target.closest('.hit g[data-id]');
        if (hit) {
          const id = hit.dataset.id;
          if (e.shiftKey || e.ctrlKey || e.metaKey) { if (S.sel.has(id) && !e.ctrlKey) S.sel.delete(id); else S.sel.add(id); }
          else if (!S.sel.has(id)) S.sel = new Set([id]);
          S.drag = { kind: 'move', a: u, d: [0, 0], ids: [...S.sel] };
          renderCanvas(); renderProps();
        } else { if (!e.shiftKey) S.sel.clear(); S.drag = { kind: 'box', a: rawU(e), b: null }; renderCanvas(); renderProps(); }
        return;
      }
      toolDown(t, u, e, pg);
    });
    cv.addEventListener('pointermove', (e) => {
      const pg = curPage(); if (!pg) return;
      if (pan) { const v = viewOf(pg); v.x = pan.vx - (e.clientX - pan.x) * pan.k; v.y = pan.vy - (e.clientY - pan.y) * pan.k; cv.setAttribute('viewBox', [v.x, v.y, v.w, v.h].join(' ')); return; }
      const u = toU(e);
      S.cursor = u;
      const d = S.drag;
      if (d && d.kind === 'move') {
        const step = d.ids.every((id) => { const it = pg.items.find((i) => i.id === id); return it && (it.k === 'text'); }) ? 0.5 : 1;
        const uu = toU(e, step), dd = [uu[0] - d.a[0], uu[1] - d.a[1]];
        if (dd[0] !== d.d[0] || dd[1] !== d.d[1]) {
          d.d = dd; d.moved = true;
          const g = tpl().g;
          d.ids.forEach((id) => cv.querySelectorAll('g[data-id="' + id + '"]').forEach((n) => n.setAttribute('transform', 'translate(' + dd[0] * g + ' ' + dd[1] * g + ')')));
        }
      } else if (d && d.kind === 'box') { d.b = rawU(e); drawOverlay(); }
      else drawOverlay();
      renderStatus();
    });
    cv.addEventListener('pointerup', (e) => {
      if (pan) { pan = null; return; }
      const pg = curPage(), d = S.drag; S.drag = null; if (!pg || !d) return;
      if (d.kind === 'move' && d.moved && (d.d[0] || d.d[1])) {
        if (e.ctrlKey || e.altKey) exec('Kopiëren', (Q) => { const out = M.pasteItems(Q, pg.id, M.copyItems(Q, pg.id, d.ids), d.d[0], d.d[1]); S.sel = new Set(out.map((i) => i.id)); });
        else exec('Verplaatsen', (Q) => M.moveItems(Q, pg.id, d.ids, d.d[0], d.d[1]));
      } else if (d.kind === 'move') renderCanvas();
      else if (d.kind === 'box' && d.b) {
        const a = d.a, b = d.b, x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]), cross = b[0] < a[0];
        pg.items.forEach((it) => {
          if (it.k === 'pot' && !cross) return;
          const q = itemBox(it), inside = q[0] >= x0 && q[2] <= x1 && q[1] >= y0 && q[3] <= y1, touch = q[2] >= x0 && q[0] <= x1 && q[3] >= y0 && q[1] <= y1;
          if (cross ? touch : inside) S.sel.add(it.id);
        });
        renderCanvas(); renderProps();
      } else drawOverlay();
    });
    cv.addEventListener('dblclick', (e) => {
      const t = S.tool;
      if (t.name === 'wire' || t.name === 'line') { finishLine(); return; }
      const hit = e.target.closest && e.target.closest('.hit g[data-id]');
      if (hit) { S.sel = new Set([hit.dataset.id]); showLeft('props'); renderCanvas(); renderProps(); const f = $('#propsBody input'); if (f) { f.focus(); f.select(); } }
    });
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const t = S.tool;
      if (t.name === 'wire' || t.name === 'line') { if (t.pts && t.pts.length) finishLine(); else setTool({ name: 'select' }); return; }
      if (t.name !== 'select') { setTool({ name: 'select' }); return; }
      const hit = e.target.closest && e.target.closest('.hit g[data-id]');
      if (!hit) { menu(e.clientX, e.clientY, [['Plakken', () => pasteClip(rawU(e))], ['Bladeigenschappen…', () => pageProps()], ['Passend in beeld', () => run('zoomfit')]]); return; }
      const id = hit.dataset.id; if (!S.sel.has(id)) { S.sel = new Set([id]); renderCanvas(); renderProps(); }
      menu(e.clientX, e.clientY, itemMenu(id));
    });
    cv.addEventListener('pointerleave', () => { S.cursor = null; drawOverlay(); });
    void lastClick;
  }
  function itemMenu(id) {
    const pg = curPage(), it = pg.items.find((i) => i.id === id), A = analysis(), s = A.symById[id], out = [['Eigenschappen', () => showLeft('props')]];
    if (s && s.dev) {
      const dv = s.dev, others = dv.all.filter((x) => x !== s);
      others.slice(0, 12).forEach((o) => out.push(['Ga naar ' + o.d.name.toLowerCase() + ' (' + o.ref + ')', () => goTo(o.pg.id, o.it.id)]));
      if (!dv.master && s.d.role === 'slave') out.push(['Spoel ' + dv.full + ' ontbreekt', () => {}]);
    }
    if (it && it.k === 'pot') {
      const rf = A.potRefs[id] || {};
      [rf.prev, rf.next].filter(Boolean).forEach((r) => { const pgo = M.pageByLabel(P(), r.split('.')[0]); if (pgo) out.push(['Ga naar blad ' + r, () => openPage(pgo.id)]); });
    }
    if (s && s.d.role === 'ref') (A.refInfo[id] || []).forEach((r) => { const o = A.syms.find((x) => x.d.role === 'ref' && x.ref === r && (x.it.p || {}).name === (it.p || {}).name); if (o) out.push(['Ga naar verwijzing ' + r, () => goTo(o.pg.id, o.it.id)]); });
    out.push('-', ['Roteren', () => run('rotate')], ['Spiegelen', () => run('mirror')], ['Kopiëren', () => run('copy')], ['Knippen', () => run('cut')], ['Verwijderen', () => run('del')]);
    return out;
  }
  function goTo(pageId, itemId) {
    openPage(pageId);
    S.sel = new Set([itemId]);
    const pg = M.findPage(P(), pageId), it = pg && pg.items.find((i) => i.id === itemId);
    if (it) {
      const g = tpl().g, b = itemBox(it), v = viewOf(pg), w = Math.min(v.w, 160), h = v.h * w / v.w;
      S.views[pg.id] = { x: (b[0] + b[2]) / 2 * g - w / 2, y: (b[1] + b[3]) / 2 * g - h / 2, w, h };
    }
    renderCanvas(); renderProps();
  }
  function isTyping(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }

  async function toolDown(t, u, e, pg) {
    if (t.name === 'place') {
      const d = SY.get(t.s); const o = { r: t.r || 0 };
      if (d.role === 'slave') {
        const masters = Object.values(analysis().devices).filter((x) => x.master && x.master.d.role === 'master').map((x) => x.tag);
        const v = await dialog({ title: d.name + ' plaatsen', text: 'Bij welk toestel hoort dit contact? (de tag van de spoel of het toestel, bv. K1)', fields: [{ k: 'tag', label: 'Tag', value: S.lastMaster || masters[0] || '', list: masters }] });
        if (!v) return; o.tag = v.tag.replace(/^-/, '').trim(); S.lastMaster = o.tag;
      }
      if (d.role === 'ref') { const v = await dialog({ title: 'Draadverwijzing', text: 'Verwijzingen met dezelfde naam horen bij elkaar (bv. op twee bladen).', fields: [{ k: 'name', label: 'Naam', value: '' }] }); if (!v || !v.name) return; o.p = { name: v.name }; }
      const it = exec(d.name + ' plaatsen', (Q) => M.place(Q, pg.id, t.s, u[0], u[1], o));
      if (it) { if (d.role === 'master') S.lastMaster = it.tag; S.sel = new Set(); renderProps(); }
      return;
    }
    if (t.name === 'wire' || t.name === 'line') {
      if (!t.pts) { t.pts = [u]; t.vert = true; drawOverlay(); return; }
      const last = t.pts[t.pts.length - 1];
      if (u[0] === last[0] && u[1] === last[1]) return;
      t.vert = Math.abs(u[1] - last[1]) >= Math.abs(u[0] - last[0]);
      t.pts = t.pts.concat(route(last, u, t.vert));
      if (t.name === 'wire' && connAt(pg, u) && t.pts.length > 1) finishLine();
      else drawOverlay();
      return;
    }
    if (t.name === 'potcur') {
      const v = await dialog({ title: 'Potentiaal', text: 'Een potentiaal is een rail met een naam. Dezelfde naam op een ander blad is dezelfde potentiaal.', fields: [{ k: 'n', label: 'Naam', value: 'L1', list: potNames() }] });
      if (v && v.n) exec('Potentiaal', (Q) => M.addPot(Q, pg.id, v.n.trim(), { y: u[1], side: u[1] < (tpl().y0 + tpl().y1) / 2 ? 'top' : 'bottom' }));
      return;
    }
    if (t.name === 'cable') {
      if (!t.a) { t.a = rawU(e).map((v) => Math.round(v * 2) / 2); drawOverlay(); return; }
      const b = rawU(e).map((v) => Math.round(v * 2) / 2), a = t.a; t.a = null;
      const v = await dialog({ title: 'Kabel', fields: [{ k: 'tag', label: 'Tag (leeg = automatisch)', value: '' }, { k: 'type', label: 'Type', value: '', placeholder: 'bv. XVB 4G1,5', list: ['XVB 3G1,5', 'XVB 4G1,5', 'XVB 5G2,5', 'XVB 7G1,5', 'YMvK 4G2,5', 'LiYY 4x0,75', 'LiYCY 7x0,75'] }, { k: 'len', label: 'Lengte (m)', value: '' }] });
      if (v) exec('Kabel', (Q) => M.addCable(Q, pg.id, a, b, { tag: v.tag.replace(/^-/, '') || undefined, p: { type: v.type, len: v.len } }));
      drawOverlay(); return;
    }
    if (t.name === 'text') {
      const v = await dialog({ title: 'Tekst', fields: [{ k: 's', label: 'Tekst' }, { k: 'size', label: 'Grootte', type: 'select', value: '0.6', options: [['0.42', 'Klein'], ['0.6', 'Normaal'], ['0.9', 'Groot'], ['1.4', 'Titel']] }] });
      const m = rawU(e).map((x) => Math.round(x * 2) / 2);
      if (v && v.s) exec('Tekst', (Q) => M.addItem(Q, pg.id, { k: 'text', x: m[0], y: m[1], s: v.s, size: +v.size }));
      return;
    }
    if (t.name === 'cab') {
      const m = rawU(e), key = t.dev;
      const it = exec('Toestel in kast', (Q) => LE.cabinet.place(Q, pg.id, key, m[0], m[1]));
      if (it) { const next = LE.cabinet.pickList(P(), analysis()).find((x) => !x.placed && !x.door); if (next) setTool({ name: 'cab', dev: next.key, w: next.w, h: next.h }); else { setTool({ name: 'select' }); toast('Alle toestellen voor de montageplaat staan erin. Deurtoestellen (knoppen, lampen) plaats je apart vanuit de picklijst.'); } }
      return;
    }
    if (t.name === 'rail') {
      if (!t.a) { t.a = u; drawOverlay(); return; }
      const a = t.a; t.a = null; if (u[0] === a[0]) return;
      exec('DIN-rail', (Q) => M.addItem(Q, pg.id, { k: 'rail', x: Math.min(a[0], u[0]), y: a[1], w: Math.abs(u[0] - a[0]) })); return;
    }
    if (t.name === 'encl' || t.name === 'duct') {
      if (!t.a) { t.a = u; drawOverlay(); return; }
      const a = t.a; t.a = null;
      const box = { x: Math.min(a[0], u[0]), y: Math.min(a[1], u[1]), w: Math.abs(u[0] - a[0]), h: Math.abs(u[1] - a[1]) };
      if (box.w && box.h) exec(t.name === 'encl' ? 'Montageplaat' : 'Kabelgoot', (Q) => M.addItem(Q, pg.id, Object.assign({ k: t.name }, box)));
      return;
    }
    if (t.name === 'rect' || t.name === 'flframe' || t.name === 'circle') {
      if (!t.a) { t.a = u; drawOverlay(); return; }
      const a = t.a, b = u; t.a = null;
      if (t.name === 'circle') { const r = Math.hypot(b[0] - a[0], b[1] - a[1]); if (r) exec('Cirkel', (Q) => M.addItem(Q, pg.id, { k: 'circle', x: a[0], y: a[1], r })); return; }
      const box = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) };
      if (!box.w || !box.h) return;
      if (t.name === 'rect') { exec('Rechthoek', (Q) => M.addItem(Q, pg.id, Object.assign({ k: 'rect' }, box))); return; }
      const v = await dialog({ title: 'Functie/plaats-kader', text: 'Toestellen binnen het kader krijgen deze functie (=) en plaats (+), tenzij ze er zelf een hebben.', fields: [{ k: 'fn', label: 'Functie (= installatiedeel)', value: '' }, { k: 'loc', label: 'Plaats (+ kast of veld)', value: '' }] });
      if (v) exec('Functie/plaats-kader', (Q) => M.addItem(Q, pg.id, Object.assign({ k: 'flframe', fn: v.fn, loc: v.loc }, box)));
    }
  }
  function finishLine() {
    const t = S.tool, pg = curPage(); if (!pg || !t.pts || t.pts.length < 2) { if (t.pts) t.pts = null; drawOverlay(); return; }
    const pts = t.pts; t.pts = null;
    if (t.name === 'line') exec('Lijn', (Q) => M.addItem(Q, pg.id, { k: 'line', pts }));
    else exec((t.n || 1) > 1 ? t.n + ' draden' : 'Draad', (Q) => (t.n || 1) > 1 ? M.addWires(Q, pg.id, pts, t.n) : M.addWire(Q, pg.id, pts));
  }
  function potNames() { const s = new Set(['L1', 'L2', 'L3', 'N', 'PE', '1L1', '1N', '+24V', '0V']); P().pages.forEach((pg) => pg.items.forEach((i) => { if (i.k === 'pot') s.add(i.name); })); return [...s]; }
  async function addPotential(side) {
    let pg = curPage(); if (!pg) { toast('Open eerst een blad.'); return; }
    const used = pg.items.filter((i) => i.k === 'pot').map((i) => i.name);
    const sugg = side === 'top' ? ['L1', 'L2', 'L3', 'N', 'PE', '1L1', '+24V'].find((n) => used.indexOf(n) < 0) : ['1N', 'N', '0V', 'PE'].find((n) => used.indexOf(n) < 0);
    const v = await dialog({ title: side === 'top' ? 'Potentiaal bovenaan' : 'Potentiaal onderaan', text: 'Dezelfde naam op een ander blad is dezelfde potentiaal; de kruisverwijzingen komen vanzelf.', fields: [{ k: 'n', label: 'Naam', value: sugg || '', list: potNames() }] });
    if (v && v.n) exec('Potentiaal', (Q) => M.addPot(Q, pg.id, v.n.trim(), { side }));
  }

  /* ---------- clipboard and delete ---------- */
  function copySel() {
    const pg = curPage(); if (!pg || !S.sel.size) return false;
    S.clip = M.copyItems(P(), pg.id, [...S.sel]);
    try { lsSet('lazyelectrical.v2.clip', S.clip); } catch (e) { /* ignore */ }
    toast(S.sel.size + ' element' + (S.sel.size > 1 ? 'en' : '') + ' gekopieerd.', 1500);
    return true;
  }
  function pasteClip(at) {
    const pg = curPage(); const clip = S.clip || lsGet('lazyelectrical.v2.clip', null);
    if (!pg || !clip || !clip.length) { toast('Er is niets om te plakken.'); return; }
    let b = [Infinity, Infinity]; clip.forEach((it) => { const q = itemBox(it); b = [Math.min(b[0], q[0]), Math.min(b[1], q[1])]; });
    const target = at || S.cursor || [b[0] + 2, b[1] + 2];
    const dx = Math.round(target[0] - b[0]), dy = Math.round(target[1] - b[1]);
    exec('Plakken', (Q) => { const out = M.pasteItems(Q, pg.id, clip, dx, dy); S.sel = new Set(out.map((i) => i.id)); });
  }
  function delSel() { const pg = curPage(); if (!pg || !S.sel.size) return; const ids = [...S.sel]; S.sel.clear(); exec('Verwijderen', (Q) => M.deleteItems(Q, pg.id, ids)); }

  /* ---------- pages ---------- */
  async function newPage(kind) {
    const cur = curPage();
    if (kind === 'cabinet') {
      const c = await dialog({ title: 'Nieuwe kastindeling', text: 'Een kastindeling toont de montageplaat op schaal. De toestellen uit het schema plaats je vanuit de picklijst.', fields: [{ k: 'title', label: 'Omschrijving', value: 'Kastindeling' }, { k: 'w', label: 'Breedte montageplaat (mm)', type: 'number', value: 600 }, { k: 'h', label: 'Hoogte montageplaat (mm)', type: 'number', value: 800 }, { k: 'scale', label: 'Schaal', type: 'select', value: '5', options: [['2', '1:2'], ['5', '1:5'], ['10', '1:10']] }, { k: 'rails', label: 'Aantal DIN-rails', type: 'number', value: 3 }] });
      if (!c) return;
      const pgc = exec('Nieuwe kastindeling', (Q) => {
        const p = M.addPage(Q, { title: c.title, kind: 'cabinet' }); p.scale = +c.scale;
        const T = M.tplOf(Q), k = T.g * p.scale, w = Math.min(+c.w / k, T.cols * T.colW - 6), h = Math.min(+c.h / k, T.y1 - T.y0 - 5), x = T.x0 + 4, y = T.y0 + 3;
        M.addItem(Q, p.id, { k: 'encl', x, y, w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100 });
        const n = Math.max(0, Math.min(8, +c.rails || 0)), duct = 40 / k;
        for (let i = 0; i < n; i++) {
          const ry = y + (h / (n + 1)) * (i + 1) - (35 / k) / 2;
          M.addItem(Q, p.id, { k: 'rail', x: x + 1, y: Math.round(ry * 100) / 100, w: Math.round((w - 2) * 100) / 100 });
          M.addItem(Q, p.id, { k: 'duct', x: x + 1, y: Math.round((ry - (h / (n + 1)) / 2 + 35 / k / 2 - duct / 2) * 100) / 100, w: Math.round((w - 2) * 100) / 100, h: Math.round(duct * 100) / 100 });
        }
        return p;
      });
      if (pgc) { openPage(pgc.id); showLeft('props'); }
      return;
    }
    const v = await dialog({ title: 'Nieuw blad', fields: [{ k: 'title', label: 'Omschrijving', value: 'Stuurstroom' }, { k: 'kind', label: 'Soort', type: 'select', value: 'schematic', options: [['schematic', 'Stroomschema'], ['cover', 'Voorblad']] }, { k: 'rails', label: 'Potentialen', type: 'select', value: 'ctrl', options: [['none', 'Geen'], ['ctrl', 'Stuurstroom 1L1 / 1N'], ['dc', 'Stuurstroom +24V / 0V'], ['power', 'Hoofdstroom L1 L2 L3 N PE']] }, { k: 'folder', label: 'Map (optioneel)', value: cur ? cur.folder || '' : '' }] });
    if (!v) return;
    const pg = exec('Nieuw blad', (Q) => {
      const p = M.addPage(Q, { title: v.title, kind: v.kind, after: cur ? cur.id : undefined, folder: v.folder || '', fn: cur ? cur.fn : '', loc: cur ? cur.loc : '' });
      if (v.kind !== 'cover') {
        if (v.rails === 'ctrl') { M.addPot(Q, p.id, '1L1'); M.addPot(Q, p.id, '1N', { side: 'bottom' }); }
        if (v.rails === 'dc') { M.addPot(Q, p.id, '+24V'); M.addPot(Q, p.id, '0V', { side: 'bottom' }); }
        if (v.rails === 'power') ['L1', 'L2', 'L3', 'N', 'PE'].forEach((n) => M.addPot(Q, p.id, n));
      }
      return p;
    });
    if (pg) openPage(pg.id);
  }
  async function pageProps() {
    const pg = curPage(); if (!pg) return;
    const v = await dialog({ title: 'Bladeigenschappen', fields: [{ k: 'title', label: 'Omschrijving', value: pg.title }, { k: 'no', label: 'Bladnummer', type: 'number', value: pg.no }, { k: 'index', label: 'Index (bv. a voor 1a)', value: pg.index || '' }, { k: 'fn', label: 'Functie (=)', value: pg.fn || '' }, { k: 'loc', label: 'Plaats (+)', value: pg.loc || '' }, { k: 'folder', label: 'Map', value: pg.folder || '' }] });
    if (!v) return;
    exec('Bladeigenschappen', (Q) => { const p = M.findPage(Q, pg.id); p.title = v.title; p.no = Math.max(1, parseInt(v.no, 10) || p.no); p.index = v.index.trim(); p.fn = v.fn.trim(); p.loc = v.loc.trim(); p.folder = v.folder.trim(); });
  }
  async function delPage() {
    const pg = curPage(); if (!pg) return;
    if (await confirmDlg('Blad verwijderen', 'Blad ' + M.pageLabel(pg) + ' "' + (pg.title || '') + '" verwijderen? (Ongedaan maken kan.)', 'Verwijderen')) exec('Blad verwijderen', (Q) => M.deletePage(Q, pg.id));
  }
  function dupPage() {
    const pg = curPage(); if (!pg) return;
    const np = exec('Blad kopiëren', (Q) => { const p = M.addPage(Q, { title: pg.title + ' (kopie)', after: pg.id, fn: pg.fn, loc: pg.loc, folder: pg.folder }); M.pasteItems(Q, p.id, M.copyItems(Q, pg.id, pg.items.map((i) => i.id)), 0, 0); return p; });
    if (np) openPage(np.id);
  }
  async function renumTerminals() {
    const strips = Object.keys(M.stripsOf(P())); if (!strips.length) { toast('Er zijn nog geen klemmen.'); return; }
    const v = await dialog({ title: 'Klemmen hernummeren', text: 'De klemmen van de strook krijgen de nummers 1, 2, 3 … in de volgorde van de bladen (van links naar rechts). PE-klemmen heten PE. Vergrendelde klemmen blijven.', fields: [{ k: 's', label: 'Klemmenstrook', type: 'select', value: strips[0], options: strips.map((s) => [s, '-' + s]) }] });
    if (v) exec('Klemmen hernummeren', (Q) => M.renumberTerminals(Q, v.s));
  }
  async function findReplace() {
    const v = await dialog({ title: 'Zoeken en vervangen', fields: [{ k: 'q', label: 'Zoek (tag, omschrijving, tekst, potentiaal)' }, { k: 'r', label: 'Vervangen door (leeg = alleen zoeken)' }] });
    if (!v || !v.q) return;
    const q = v.q.toLowerCase(), hits = [];
    P().pages.forEach((pg) => pg.items.forEach((it) => {
      const txt = [it.tag, it.name, it.s && it.k === 'text' ? it.s : '', (it.p || {}).desc, (it.p || {}).desc2, (it.p || {}).type, (it.p || {}).name].filter(Boolean).join(' | ');
      if (txt.toLowerCase().indexOf(q) >= 0) hits.push({ pg, it, txt });
    }));
    if (v.r) {
      const rx = new RegExp(v.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); let n = 0;
      exec('Vervangen', (Q) => Q.pages.forEach((pg) => pg.items.forEach((it) => {
        ['desc', 'desc2'].forEach((k) => { if (it.p && typeof it.p[k] === 'string' && rx.test(it.p[k])) { it.p[k] = it.p[k].replace(rx, v.r); n++; } rx.lastIndex = 0; });
        if (it.k === 'text' && rx.test(it.s)) { it.s = it.s.replace(rx, v.r); n++; } rx.lastIndex = 0;
      })));
      toast(n + ' keer vervangen (omschrijvingen en teksten).');
      return;
    }
    S.findResults = hits; S.showChecks = true; renderChecks();
    toast(hits.length + ' gevonden.');
  }

  /* =====================================================================
     Properties panel
     ===================================================================== */
  function showLeft(tab) { S.ltab = tab; if (!S.prefs.left) { S.prefs.left = true; savePrefs(); layoutDocks(); } renderDockTabs(); }
  function showRight(tab) { S.rdock = tab; if (!S.prefs.right) { S.prefs.right = true; savePrefs(); layoutDocks(); } renderDockTabs(); if (tab === 'ai') renderAI(); }
  function renderDockTabs() {
    document.querySelectorAll('[data-ltab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.ltab === S.ltab)));
    document.querySelectorAll('[data-rtab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rtab === S.rdock)));
    $('#treeBody').hidden = S.ltab !== 'tree'; $('#propsBody').hidden = S.ltab !== 'props';
    $('#symBody').hidden = S.rdock !== 'syms'; $('#aiBody').hidden = S.rdock !== 'ai';
  }
  function layoutDocks() { const w = $('#work'); w.classList.toggle('noleft', !S.prefs.left); w.classList.toggle('noright', !S.prefs.right); }
  const fld = (k, label, val, o) => { o = o || {}; return '<div class="f"><label for="pp_' + k + '">' + esc(label) + '</label>' + (o.options ? '<select id="pp_' + k + '" data-pk="' + k + '">' + o.options.map((op) => '<option value="' + esc(op[0]) + '"' + (String(op[0]) === String(val) ? ' selected' : '') + '>' + esc(op[1]) + '</option>').join('') + '</select>' : '<input id="pp_' + k + '" data-pk="' + k + '" value="' + esc(val == null ? '' : val) + '"' + (o.list ? ' list="pl_' + k + '"' : '') + (o.ph ? ' placeholder="' + esc(o.ph) + '"' : '') + ' autocomplete="off">' + (o.list ? '<datalist id="pl_' + k + '">' + o.list.map((x) => '<option value="' + esc(x[0]) + '">' + esc(x[1] || '') + '</option>').join('') + '</datalist>' : '')) + '</div>'; };
  const chk = (k, label, val) => '<label class="chk"><input type="checkbox" data-pk="' + k + '"' + (val ? ' checked' : '') + '> ' + esc(label) + '</label>';
  function renderProps() {
    const b = $('#propsBody'), pg = curPage();
    if (!pg) { b.innerHTML = '<div class="props"><p class="info">Open een blad om eigenschappen te zien.</p></div>'; return; }
    const items = pg.items.filter((i) => S.sel.has(i.id)), A = analysis();
    let h = '<div class="props">';
    if (!items.length && pg.kind === 'cabinet') {
      const list = LE.cabinet.pickList(P(), A), heat = LE.cabinet.heat(P(), pg, A), todo = list.filter((x) => !x.placed);
      h += '<h3>Kastindeling ' + esc(M.pageLabel(pg)) + '</h3>' + fld('pg_title', 'Omschrijving', pg.title) + fld('pg_scale', 'Schaal', String(pg.scale || 5), { options: [['2', '1:2'], ['5', '1:5'], ['10', '1:10']] }) +
        '<p class="info">Warmteverlies geplaatste toestellen: <b>' + heat.watts + ' W</b>' + (heat.unknown ? ' (' + heat.unknown + ' zonder artikel)' : '') + '</p>' +
        '<h3>Picklijst (' + todo.length + ' nog te plaatsen)</h3><div class="btns">' + (todo.length ? '<button class="btn" type="button" data-pickall="1">Alles na elkaar plaatsen</button>' : '') + '</div>' +
        list.map((x) => '<div class="info" style="display:flex;gap:6px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:3px 0"><span><b>' + esc(x.tag) + '</b> ' + esc(x.name) + (x.desc ? ' · ' + esc(x.desc) : '') + '<br>' + Math.round(x.w) + ' × ' + Math.round(x.h) + ' mm' + (x.door ? ' · deur' : '') + '</span>' + (x.placed ? '<span style="color:var(--ok)">✓</span>' : '<button class="btn" type="button" data-pick="' + esc(x.key) + '">Plaatsen</button>') + '</div>').join('');
    } else if (!items.length) {
      h += '<h3>Blad ' + esc(M.pageLabel(pg)) + '</h3>' + fld('pg_title', 'Omschrijving', pg.title) + '<div class="row">' + fld('pg_fn', 'Functie (=)', pg.fn) + fld('pg_loc', 'Plaats (+)', pg.loc) + '</div>' +
        '<p class="info">' + pg.items.filter((i) => i.k === 'sym').length + ' symbolen · ' + pg.items.filter((i) => i.k === 'wire').length + ' draden' + (pg.spec && !pg.edited ? ' · opgebouwd door de AI-assistent of een voorbeeld' : '') + '</p>' +
        '<p class="info">Tip: klik een symbool rechts om het te plaatsen. Gebruik <b>Elektrisch → 1 draad</b> (Ctrl+1) of <b>3 draden</b> (Ctrl+3) om te verbinden.</p>';
    } else if (items.length > 1) {
      h += '<h3>' + items.length + ' elementen</h3><p class="info">Velden die je hier invult, gelden voor alle geselecteerde toestellen.</p>' + fld('m_desc', 'Omschrijving', '') + fld('m_part', 'Artikelnummer', '', { list: PT.all().map((p) => [p.part, p.desc]) }) + fld('m_fn', 'Functie (=)', '') + fld('m_loc', 'Plaats (+)', '') +
        '<div class="btns"><button class="btn" type="button" data-cmd="rotate">Roteren</button><button class="btn" type="button" data-cmd="copy">Kopiëren</button><button class="btn" type="button" data-cmd="del">Verwijderen</button></div>';
    } else {
      const it = items[0], p = it.p || {};
      if (it.k === 'sym') {
        const d = SY.get(it.s), s = A.symById[it.id] || {};
        h += '<h3>' + esc(d.name) + '</h3>';
        if (d.role === 'ref') h += fld('p.name', 'Naam van de verwijzing', p.name) + '<p class="info">Verwijzingen met dezelfde naam zijn verbonden.' + ((A.refInfo[it.id] || []).length ? ' Tegenhanger: ' + esc(A.refInfo[it.id].join(', ')) : ' Nog geen tegenhanger.') + '</p>';
        else if (d.role !== 'plain') {
          const masters = Object.values(A.devices).filter((x) => x.master && x.master.d.role === 'master').map((x) => [x.tag, x.master.d.name]);
          h += fld('tag', d.role === 'terminal' ? 'Klemmenstrook' : d.role === 'slave' ? 'Tag (van de spoel/het toestel)' : 'Tag', it.tag, d.role === 'slave' ? { list: masters } : {});
          if (d.role === 'terminal') h += fld('no', 'Klemnummer', it.no);
          if (d.kind === 'DI' || d.kind === 'DO') h += fld('p.addr', 'PLC-adres', p.addr);
          h += '<div class="row">' + fld('fn', 'Functie (=)', it.fn, { ph: s.fn || '' }) + fld('loc', 'Plaats (+)', it.loc, { ph: s.loc || '' }) + '</div>';
          h += fld('p.desc', 'Omschrijving 1', p.desc) + fld('p.desc2', 'Omschrijving 2', p.desc2);
          if (d.role !== 'slave') h += fld('p.part', 'Artikelnummer', p.part, { list: PT.forSymbol(it.s).map((x) => [x.part, x.desc]) }) + fld('p.maker', 'Fabrikant', p.maker);
          const pins = (s.pins || []).map((q) => q.n).join(', ');
          if (d.pins.length > 1 && d.role !== 'terminal') h += fld('pins', 'Aansluitingen (leeg = automatisch)', it.pins ? it.pins.join(', ') : '', { ph: pins });
          h += '<div class="btns">' + chk('lock', 'Tag vergrendelen', it.lock) + chk('lr', 'Label rechts', it.lr) + (d.role !== 'slave' ? chk('p.showPart', 'Artikel tonen', p.showPart) : '') + '</div>';
          if (s.dev) {
            const dv = s.dev;
            h += '<p class="info"><b>' + esc(dv.full) + '</b> · ' + esc(s.ref ? 'blad.kolom ' + s.ref : '') + (d.role === 'slave' ? (dv.master ? '<br>Hoort bij ' + esc(dv.master.d.name.toLowerCase()) + ' op ' + esc(dv.master.ref) : '<br><span style="color:var(--err)">Er is geen spoel of toestel met deze tag.</span>') : '') +
              (dv.slaves.length ? '<br>Contacten: ' + dv.slaves.map((x) => esc(x.pins.map((q) => q.n).join('-')) + ' (' + esc(x.ref) + ')').join(', ') : '') + '</p>';
          }
        }
      } else if (it.k === 'wire') {
        const net = A.nets[A.wireNet[it.id]];
        h += '<h3>Draad</h3>' + fld('no', 'Draadnummer (geldt voor de hele verbinding)', it.no, { ph: A.wireNo[A.wireNet[it.id]] || '' }) + '<div class="row">' + fld('color', 'Kleur', it.color, { list: [['BK', 'zwart'], ['BU', 'blauw'], ['RD', 'rood'], ['BN', 'bruin'], ['GY', 'grijs'], ['GNYE', 'groen/geel'], ['OG', 'oranje'], ['WH', 'wit']] }) + fld('size', 'Doorsnede (mm²)', it.size, { list: [['0.75'], ['1'], ['1.5'], ['2.5'], ['4'], ['6']] }) + '</div>' +
          '<p class="info">' + (net ? (net.name ? 'Potentiaal <b>' + esc(net.name) + '</b><br>' : '') + 'Verbonden met: ' + (net.pins.length ? net.pins.map((q) => esc((q.sym.dev ? q.sym.dev.full : q.sym.d.name) + ':' + (q.pin.n || ''))).join(', ') : 'niets') : '') + '</p>';
      } else if (it.k === 'cab') {
        const dv = A.devices[it.dev], k = LE.cabinet.realPerUnit(P(), pg);
        h += '<h3>Toestel in de kast</h3><p class="info"><b>' + esc(dv ? dv.full : it.dev) + '</b>' + (dv ? ' · ' + esc((dv.master || dv.all[0]).d.name) + (dv.p.part ? '<br>Artikel ' + esc(dv.p.part) : '<br>Geen artikel: standaardmaat gebruikt') : '<br><span style="color:var(--err)">Bestaat niet meer in het schema.</span>') + '<br>' + Math.round(it.w * k) + ' × ' + Math.round(it.h * k) + ' mm</p>' +
          (dv ? '<div class="btns"><button class="btn" type="button" data-goschema="' + esc(it.dev) + '">Naar het schema</button></div>' : '');
      } else if (it.k === 'rail' || it.k === 'duct' || it.k === 'encl') {
        const k = LE.cabinet.realPerUnit(P(), pg);
        h += '<h3>' + { rail: 'DIN-rail', duct: 'Kabelgoot', encl: 'Montageplaat' }[it.k] + '</h3><p class="info">' + Math.round(it.w * k) + (it.k === 'rail' ? ' mm lang' : ' × ' + Math.round(it.h * k) + ' mm') + '</p>';
      } else if (it.k === 'pot') h += '<h3>Potentiaal</h3>' + fld('name', 'Naam', it.name, { list: potNames().map((n) => [n]) }) + '<p class="info">Dezelfde naam op andere bladen is dezelfde potentiaal.</p>';
      else if (it.k === 'cable') {
        const cab = A.cables[it.id] || { cores: [] }, cores = it.cores || [];
        h += '<h3>Kabel</h3>' + fld('tag', 'Tag', it.tag) + fld('p.type', 'Type', p.type, { list: [['XVB 3G1,5'], ['XVB 4G1,5'], ['XVB 5G2,5'], ['XVB 7G1,5'], ['YMvK 4G2,5'], ['LiYY 4x0,75'], ['LiYCY 7x0,75']] }) + '<div class="row">' + fld('p.len', 'Lengte (m)', p.len) + fld('p.part', 'Artikelnummer', p.part) + '</div>' +
          '<h3>Aders (' + cab.cores.length + ' draden gekruist)</h3><table class="cores"><tr><td>Ader</td><td>Kleur</td><td>mm²</td></tr>' + cab.cores.map((cc, i) => '<tr><td><input data-core="' + i + '" data-ck="no" value="' + esc((cores[i] || {}).no || cc.core) + '"></td><td><input data-core="' + i + '" data-ck="color" value="' + esc((cores[i] || {}).color || '') + '"></td><td><input data-core="' + i + '" data-ck="size" value="' + esc((cores[i] || {}).size || '') + '"></td></tr>').join('') + '</table>';
      } else if (it.k === 'text') h += '<h3>Tekst</h3>' + fld('s', 'Tekst', it.s) + '<div class="row">' + fld('size', 'Grootte', it.size || 0.6) + fld('rot', 'Hoek', it.rot || 0, { options: [[0, '0°'], [90, '90°']] }) + '</div>' + chk('bold', 'Vet', it.bold);
      else if (it.k === 'flframe') h += '<h3>Functie/plaats-kader</h3>' + fld('fn', 'Functie (=)', it.fn) + fld('loc', 'Plaats (+)', it.loc) + '<p class="info">Toestellen binnen het kader krijgen deze functie en plaats, tenzij ze er zelf een hebben.</p>';
      else h += '<h3>' + esc({ line: 'Lijn', rect: 'Rechthoek', circle: 'Cirkel' }[it.k] || it.k) + '</h3>' + (it.k !== 'circle' ? chk('dash', 'Gestippeld', it.dash) : '');
      h += '<div class="btns"><button class="btn" type="button" data-cmd="rotate">Roteren</button><button class="btn" type="button" data-cmd="copy">Kopiëren</button><button class="btn" type="button" data-cmd="del">Verwijderen</button></div>';
    }
    b.innerHTML = h + '</div>';
  }
  function propChange(e) {
    const el = e.target, pg = curPage(); if (!pg) return;
    const k = el.dataset.pk, v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.core != null) {
      const i = +el.dataset.core, ck = el.dataset.ck, id = [...S.sel][0];
      exec('Kabeladers', (Q) => { const f = M.itemById(Q, id); if (!f) return; const c = f.it.cores = f.it.cores || []; while (c.length <= i) c.push({}); c[i][ck] = v; });
      return;
    }
    if (!k) return;
    if (k === 'pg_scale') {
      /* keep the real sizes: everything on the page is scaled with the new factor */
      const old = pg.scale || 5, f = old / +v;
      exec('Schaal', (Q) => { const p = M.findPage(Q, pg.id); p.scale = +v; p.items.forEach((it) => { ['x', 'y', 'w', 'h'].forEach((q) => { if (it[q] != null) it[q] = Math.round(it[q] * (q === 'x' || q === 'y' ? 1 : f) * 100) / 100; }); }); });
      return;
    }
    if (k.indexOf('pg_') === 0) { exec('Bladeigenschappen', (Q) => { const p = M.findPage(Q, pg.id); p[k.slice(3)] = v; }); return; }
    if (k.indexOf('m_') === 0) {
      const f = k.slice(2), ids = [...S.sel];
      exec('Eigenschappen', (Q) => ids.forEach((id) => { const x = M.itemById(Q, id); if (!x || x.it.k !== 'sym') return; if (f === 'fn' || f === 'loc') x.it[f] = v; else { x.it.p = x.it.p || {}; x.it.p[f] = v; } }));
      return;
    }
    const id = [...S.sel][0];
    exec('Eigenschap', (Q) => {
      const f = M.itemById(Q, id); if (!f) return;
      const it = f.it;
      if (k.indexOf('p.') === 0) { it.p = it.p || {}; if (v === '' || v === false) delete it.p[k.slice(2)]; else it.p[k.slice(2)] = v; return; }
      if (k === 'pins') { const list = String(v).split(/[,\s]+/).filter(Boolean); if (list.length) it.pins = list; else delete it.pins; return; }
      if (k === 'tag') { it.tag = String(v).replace(/^-/, '').trim(); return; }
      if (k === 'size' || k === 'rot') { it[k] = +v; return; }
      if (k === 'lock' || k === 'lr' || k === 'bold' || k === 'dash') { if (v) it[k] = true; else delete it[k]; return; }
      if (v === '' && (k === 'fn' || k === 'loc' || k === 'no' || k === 'color' || k === 'size')) delete it[k]; else it[k] = v;
      if (f.pg.spec) f.pg.edited = true;
    });
  }

  /* =====================================================================
     Symbol browser
     ===================================================================== */
  let symFilter = '';
  function renderSymbols() {
    const b = $('#symBody'), q = symFilter.toLowerCase(), favs = S.prefs.favs || [];
    const pick = (s) => !q || s.name.toLowerCase().indexOf(q) >= 0 || s.id.indexOf(q) >= 0 || s.cat.toLowerCase().indexOf(q) >= 0;
    const card = (s) => '<button type="button" class="sym" data-sym="' + s.id + '" aria-pressed="' + (S.tool.name === 'place' && S.tool.s === s.id) + '" title="' + esc(s.name) + ' (' + s.id + ')"><span class="star' + (favs.indexOf(s.id) >= 0 ? ' on' : '') + '" data-fav="' + s.id + '" title="Favoriet">★</span>' + R.preview(s.id, 38) + '<span>' + esc(s.name) + '</span></button>';
    const cats = [['★ Favorieten', SY.list().filter((s) => favs.indexOf(s.id) >= 0)]].concat(SY.CATS.map((c) => [c, SY.list().filter((s) => s.cat === c)]));
    const filterVal = $('#symQ') ? $('#symQ').value : symFilter;
    b.innerHTML = '<div class="symfilter"><input id="symQ" type="search" placeholder="Zoek symbool (bv. contact, motor, klem)" aria-label="Zoek symbool" value="' + esc(filterVal) + '"></div>' +
      cats.map(([c, list]) => { list = list.filter(pick); return list.length ? '<div class="symcat">' + esc(c) + '</div><div class="symgrid">' + list.map(card).join('') + '</div>' : ''; }).join('');
  }

  /* =====================================================================
     Checks panel and status bar
     ===================================================================== */
  function renderChecks() {
    const box = $('#checks'); box.hidden = !S.showChecks; if (!S.showChecks) return;
    if (S.findResults) {
      box.innerHTML = '<div class="hd"><b>Zoekresultaten (' + S.findResults.length + ')</b><span class="sp"></span><button class="btn" type="button" data-findclose="1">Sluiten</button></div>' +
        S.findResults.map((r, i) => '<div class="chk-row" data-find="' + i + '"><span class="lv info">›</span><span>Blad ' + esc(M.pageLabel(r.pg)) + ': ' + esc(r.txt) + '</span></div>').join('');
      return;
    }
    const list = checks(), c = CK.count(list);
    box.innerHTML = '<div class="hd"><b>Controle</b><span>' + c.error + ' fouten · ' + c.warn + ' waarschuwingen</span><span class="sp"></span><button class="btn" type="button" data-cmd="panelB">Sluiten</button></div>' +
      (list.length ? list.map((x, i) => '<div class="chk-row" data-chk="' + i + '"><span class="lv ' + x.level + '">' + (x.level === 'error' ? '✖' : x.level === 'warn' ? '!' : 'i') + '</span><span>' + esc(x.msg) + '</span></div>').join('') : '<div class="chk-row" style="cursor:default"><span class="lv" style="color:var(--ok)">✓</span><span>Geen fouten gevonden.</span></div>');
  }
  function renderStatus() {
    const pg = curPage(), T = tpl(), c = S.cursor, cnt = CK.count(checks());
    const v = pg && S.views[pg.id], zoom = pg ? Math.round(100 * (T.W * T.g + 16) / (v ? v.w : T.W * T.g + 16)) : 100;
    const pos = pg && c ? 'kolom ' + M.colOf(P(), c[0]) + ' · rij ' + M.rowOf(P(), c[1]) + ' · x ' + c[0] + ' y ' + c[1] : '';
    $('#status').innerHTML = '<button type="button" data-cmd="panelL" title="Werkruimte tonen/verbergen">☰</button><span>' + (pg ? 'Blad ' + esc(M.pageLabel(pg)) + ' van ' + P().pages.length : '') + '</span><span>' + pos + '</span><span>Raster ' + T.g + ' mm</span>' +
      '<span class="sp" style="overflow:hidden;text-overflow:ellipsis">' + esc(pg ? HINT[S.tool.name] || '' : '') + '</span>' +
      '<button type="button" data-cmd="check" title="Controle">' + (cnt.error ? '<span class="err">✖ ' + cnt.error + '</span>' : '<span class="ok">✓ 0</span>') + ' · <span class="' + (cnt.warn ? 'wrn' : 'ok') + '">! ' + cnt.warn + '</span></button><span>' + (pg ? zoom + '%' : '') + '</span><button type="button" data-cmd="panelR" title="Symbolen en AI tonen/verbergen">◧</button>';
  }
  function renderAll(o) {
    o = o || {};
    $('#projName').textContent = '— ' + (P().info.name || 'Project');
    renderRibbon(); renderTree(); renderTabs(); renderView(); renderProps(); renderChecks(); renderStatus();
    if (!o.keepSymbols && !$('#symBody').innerHTML) renderSymbols();
    if (S.rdock === 'ai' && !$('#aiBody').innerHTML) renderAI();
  }

  /* =====================================================================
     Backstage: File menu (new, open, save, examples, export, project data, settings)
     ===================================================================== */
  function openBack(sec) { S.back = sec || 'home'; renderBack(); $('#back').hidden = false; }
  function closeBack() { $('#back').hidden = true; }
  function renderBack() {
    const I = P().info, St = P().settings;
    const nav = [['home', 'Start', 'info'], ['new', 'Nieuw', 'new'], ['open', 'Openen', 'open'], ['save', 'Opslaan', 'save'], ['examples', 'Voorbeelden', 'examples'], ['export', 'Exporteren', 'pdf'], ['info', 'Projectgegevens', 'pageprops'], ['settings', 'Instellingen', 'settings'], ['help', 'Help', 'help']];
    let body = '';
    const sec = S.back;
    if (sec === 'home') body = '<h1>LAZY Electrical</h1><p class="note">Elektrische schema\'s voor schakelkasten: stroomschema\'s, kruisverwijzingen, klemmenplannen, kabellijsten en stuklijsten — met een AI-assistent die zelf schema\'s kan ontwerpen.</p>' +
      '<h2>Snel beginnen</h2><div class="cards"><button class="card" data-back="new"><b>Nieuw project</b><span>Leeg project met voorblad en een eerste blad.</span></button><button class="card" data-back="examples"><b>Voorbeeld openen</b><span>Direct starten, omkeerschakeling, ster-driehoek, LOGO!.</span></button><button class="card" data-backcmd="aiopen"><b>Laat de AI ontwerpen</b><span>Beschrijf de schakeling in gewone taal.</span></button><button class="card" data-back="open"><b>Project openen</b><span>Een .lazy.json-bestand van je computer.</span></button></div>';
    else if (sec === 'new') body = '<h1>Nieuw project</h1><div class="form"><label for="np_name">Projectnaam</label><input id="np_name" value="Nieuw project"><label for="np_t">Bladformaat</label><select id="np_t">' + Object.values(M.TEMPLATES).map((t) => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join('') + '</select><label for="np_m">Tags</label><select id="np_m"><option value="consecutive">Doorlopend: K1, K2 …</option><option value="pagecol">Blad + kolom: 2K3</option><option value="pagecons">Blad + volgnummer: 2K1</option></select><label for="np_l">Letters</label><select id="np_l"><option value="81346">IEC 81346 (P = lamp, T = voeding)</option><option value="old">Oudere schoolnorm (H = lamp, G = voeding)</option></select></div><p><button class="btn primary" type="button" id="np_go">Project maken</button></p><p class="note">Het huidige project wordt vervangen (Ongedaan maken kan). Bewaar het eerst als je het wilt houden.</p>';
    else if (sec === 'open') body = '<h1>Openen</h1><p><button class="btn primary" type="button" id="op_file">Bestand kiezen (.lazy.json)</button></p><p class="note">Projecten van de vorige versie van LAZY Electrical (het formulier) kun je niet openen: dat programma tekende plaatjes in plaats van toestellen en draden. Laat de AI-assistent zo\'n schakeling opnieuw opbouwen.</p>';
    else if (sec === 'save') body = '<h1>Opslaan</h1><p class="note">Het project wordt automatisch bewaard in deze browser. Bewaar het ook als bestand om het te delen of op een andere computer te openen.</p><p><button class="btn primary" type="button" data-backcmd="save">Opslaan als .lazy.json</button></p>';
    else if (sec === 'examples') body = '<h1>Voorbeelden</h1><div class="cards">' + LE.examples.map((e) => '<button class="card" data-ex="' + e.id + '"><b>' + esc(e.name) + '</b><span>' + esc(e.spec.info.desc1 || '') + '</span></button>').join('') + '</div><p class="note">Elk voorbeeld is gemaakt met dezelfde paginabeschrijving die de AI-assistent gebruikt.</p>';
    else if (sec === 'export') body = '<h1>Exporteren</h1><div class="cards"><button class="card" data-backcmd="pdf"><b>PDF van de hele set</b><span>Alle bladen plus de grafische lijsten (stuklijst, klemmenplan …).</span></button><button class="card" data-backcmd="csvall"><b>Lijsten als CSV</b><span>Stuklijst, klemmen, kabels, draden en PLC voor Excel.</span></button><button class="card" id="ex_svg"><b>Huidig blad als SVG</b><span>Vectortekening van het open blad.</span></button></div>';
    else if (sec === 'info') body = '<h1>Projectgegevens</h1><p class="note">Deze gegevens staan in de titelhoek van elk blad.</p><div class="form">' + [['name', 'Projectnaam'], ['desc1', 'Omschrijving 1'], ['desc2', 'Omschrijving 2'], ['customer', 'Klant'], ['company', 'Bedrijf / school'], ['drawingNo', 'Tekeningnummer'], ['author', 'Getekend door'], ['created', 'Datum'], ['revision', 'Revisie'], ['revDate', 'Revisiedatum']].map((f) => '<label for="pi_' + f[0] + '">' + f[1] + '</label><input id="pi_' + f[0] + '" data-info="' + f[0] + '" value="' + esc(I[f[0]] || '') + '">').join('') + '</div>';
    else if (sec === 'settings') body = '<h1>Instellingen</h1><h2>Project</h2><div class="form">' +
      '<label for="st_t">Bladformaat</label><select id="st_t" data-set="template">' + Object.values(M.TEMPLATES).map((t) => '<option value="' + t.id + '"' + (St.template === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>' +
      '<label for="st_m">Tags van nieuwe toestellen</label><select id="st_m" data-set="tagMode">' + [['consecutive', 'Doorlopend: K1, K2 …'], ['pagecol', 'Blad + kolom: 2K3'], ['pagecons', 'Blad + volgnummer: 2K1']].map((o) => '<option value="' + o[0] + '"' + (St.tagMode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label for="st_l">Letters</label><select id="st_l" data-set="letters"><option value="81346"' + (St.letters !== 'old' ? ' selected' : '') + '>IEC 81346</option><option value="old"' + (St.letters === 'old' ? ' selected' : '') + '>Oudere schoolnorm</option></select>' +
      '<label for="st_w">Draadnummers</label><select id="st_w" data-set="wireNo">' + [['seq', 'Doorlopend'], ['pagecol', 'Blad.kolom'], ['none', 'Geen']].map((o) => '<option value="' + o[0] + '"' + (St.wireNo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>' +
      '<label for="st_p">Aansluitnummers tonen</label><select id="st_p" data-set="showPinNo"><option value="1"' + (St.showPinNo !== false ? ' selected' : '') + '>Ja</option><option value="0"' + (St.showPinNo === false ? ' selected' : '') + '>Nee</option></select></div>' +
      '<h2>AI-assistent</h2>' + aiSettingsHtml();
    else if (sec === 'help') body = '<h1>Help</h1><h2>Sneltoetsen</h2><div class="form" style="grid-template-columns:200px 1fr">' + [['Ctrl+Z / Ctrl+Y', 'Ongedaan maken / opnieuw'], ['Ctrl+C / X / V', 'Kopiëren / knippen / plakken'], ['Delete', 'Verwijderen'], ['R', 'Roteren (ook tijdens plaatsen)'], ['Esc of rechtsklik', 'Gereedschap stoppen'], ['Ctrl+1 / Ctrl+3', '1 draad / 3 draden'], ['F11 / F12', 'Potentiaal boven / onder'], ['Page Up / Page Down', 'Vorig / volgend blad'], ['+ / −, muiswiel', 'Zoomen'], ['Spatie + slepen, middelste muisknop', 'Verschuiven'], ['Ctrl + slepen', 'Kopie slepen'], ['Ctrl+S', 'Opslaan']].map((r) => '<b>' + r[0] + '</b><span>' + r[1] + '</span>').join('') + '</div>' +
      '<h2>Hoe werkt het?</h2><p class="note">Symbolen met dezelfde tag zijn één toestel: de spoel K1 en de contacten K1 horen samen. Contactnummers, kruisverwijzingen, het contactbeeld onder de spoelen, draadnummers, klemmenplannen en lijsten maakt het programma zelf, ook na wijzigingen met de hand. Draden verbinden alleen op aansluitpunten, op andere draden (T-verbinding, met een stip) of op potentialen. Alles ligt op het raster.</p>';
    $('#back').innerHTML = '<nav><button type="button" class="close" data-backclose="1">' + ic('prev') + 'Terug</button>' + nav.map((n) => '<button type="button" data-back="' + n[0] + '" aria-selected="' + (sec === n[0]) + '">' + ic(n[2]) + n[1] + '</button>').join('') + '</nav><section>' + body + '</section>';
  }
  function backClick(e) {
    const t = e.target;
    if (t.closest('[data-backclose]')) { closeBack(); return; }
    const b = t.closest('[data-back]'); if (b) { S.back = b.dataset.back; renderBack(); return; }
    const c = t.closest('[data-backcmd]'); if (c) { closeBack(); run(c.dataset.backcmd); return; }
    const ex = t.closest('[data-ex]'); if (ex) { const e2 = LE.examples.find((x) => x.id === ex.dataset.ex); const r = AU.buildProject(e2.spec); setProject(r.P, 'Voorbeeld openen'); closeBack(); toast('Voorbeeld geopend: ' + e2.name); return; }
    if (t.id === 'np_go') {
      const Pn = M.newProject({ info: { name: $('#np_name').value || 'Nieuw project' }, settings: { template: $('#np_t').value, tagMode: $('#np_m').value, letters: $('#np_l').value } });
      M.addPage(Pn, { title: 'Voorblad', kind: 'cover' });
      const pg = M.addPage(Pn, { title: 'Hoofdstroom' }); ['L1', 'L2', 'L3', 'N', 'PE'].forEach((n) => M.addPot(Pn, pg.id, n));
      setProject(Pn, 'Nieuw project'); closeBack(); return;
    }
    if (t.id === 'op_file') { pickFile('.json,.lazy.json', (txt) => { try { setProject(M.load(txt), 'Project openen'); closeBack(); toast('Project geopend.'); } catch (err) { toast('Kan dit bestand niet openen: ' + err.message); } }); return; }
    if (t.id === 'ex_svg') { const pg = curPage(); if (!pg) { toast('Open eerst een blad.'); return; } download(fileName('_blad' + M.pageLabel(pg) + '.svg'), R.svg(P(), R.renderPage(P(), pg, analysis())), 'image/svg+xml'); }
    if (t.id === 'ai_savekey') saveAiSettings();
  }
  function backChange(e) {
    const t = e.target;
    if (t.dataset.info) exec('Projectgegevens', (Q) => { Q.info[t.dataset.info] = t.value; });
    if (t.dataset.set) exec('Instellingen', (Q) => { const k = t.dataset.set; Q.settings[k] = k === 'showPinNo' ? t.value === '1' : t.value; });
    if (t.id === 'ai_model' || t.id === 'ai_remember') saveAiSettings();
  }
  function pickFile(accept, cb) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept;
    i.onchange = () => { const f = i.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => cb(String(r.result)); r.readAsText(f); };
    i.click();
  }
  function saveFile() { download(fileName('.lazy.json'), JSON.stringify(P(), null, 1), 'application/json'); }

  /* =====================================================================
     Export: PDF (drawings + lists), CSV
     ===================================================================== */
  function exportPdf() {
    if (!window.jspdf) { toast('De PDF-bibliotheek is niet geladen. Controleer je internetverbinding en herlaad de pagina.'); return; }
    const T = tpl(), W = T.W * T.g, H = T.H * T.g, A = analysis();
    const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: [W, H] });
    const lists = L.listPages(P(), A);
    const sheets = P().pages.map((pg) => () => R.renderPage(P(), pg, A, { extraPages: lists.length, wireNumbers: S.prefs.wireNos })).concat(lists.map((l) => l.prims));
    const hex = (c) => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4), 16)] : [0, 0, 0]; };
    const clean = (s) => String(s).replace(/Δ/g, 'D').replace(/[^\x20-\xff]/g, '?');
    sheets.forEach((mk, i) => {
      if (i) doc.addPage([W, H], 'landscape');
      doc.setLineCap('round'); doc.setLineJoin('round'); doc.setDrawColor(0);
      mk().forEach((p) => {
        if (p.t === 'l' || p.t === 'pl') { doc.setLineWidth(p.w); doc.setLineDashPattern(p.dash === 2 ? [3, 1, 0.6, 1] : p.dash ? [1.2, 0.8] : [], 0); }
        if (p.t === 'l') doc.line(p.x1, p.y1, p.x2, p.y2);
        else if (p.t === 'pl') {
          const d = []; for (let k = 1; k < p.pts.length; k++) d.push([p.pts[k][0] - p.pts[k - 1][0], p.pts[k][1] - p.pts[k - 1][1]]);
          if (p.fill) doc.setFillColor(...(p.fill === 'k' ? [0, 0, 0] : p.fill === 'w' ? [255, 255, 255] : hex(p.fill)));
          doc.lines(d, p.pts[0][0], p.pts[0][1], [1, 1], p.fill ? (p.close ? 'FD' : 'S') : 'S', !!p.close);
        } else if (p.t === 'r' || p.t === 'c') {
          doc.setLineWidth(p.lw); doc.setLineDashPattern(p.dash === 2 ? [3, 1, 0.6, 1] : p.dash ? [1.2, 0.8] : [], 0);
          let st = 'S'; if (p.fill) { doc.setFillColor(...(p.fill === 'k' ? [0, 0, 0] : p.fill === 'w' ? [255, 255, 255] : hex(p.fill))); st = 'FD'; }
          if (p.t === 'r') doc.rect(p.x, p.y, p.w, p.h, st); else doc.circle(p.x, p.y, p.r, st);
        } else if (p.t === 'tx') {
          doc.setFont('helvetica', p.bold ? 'bold' : 'normal'); doc.setFontSize(p.size * 72 / 25.4); doc.setTextColor(...hex(p.color || '#000000'));
          const s = clean(p.s), w = doc.getTextWidth(s), off = p.a === 'middle' ? w / 2 : p.a === 'end' ? w : 0;
          if (p.rot) doc.text(s, p.x, p.y + off, { angle: p.rot }); else doc.text(s, p.x - off, p.y);
          doc.setTextColor(0, 0, 0);
        }
      });
    });
    download(fileName('.pdf'), doc.output('blob'), 'application/pdf');
  }
  function exportCsv() {
    const A = analysis(), parts = ['bom', 'components', 'terminals', 'cables', 'cores', 'wires', 'plcio'].map((k) => '### ' + L.DEFS[k].title + '\r\n' + L.csv(P(), k, A).replace(/^﻿/, ''));
    download(fileName('_lijsten.csv'), '﻿' + parts.join('\r\n\r\n'), 'text/csv');
  }

  /* =====================================================================
     AI assistant panel
     ===================================================================== */
  let SAMPLE = null, aiCtl = null, aiBlocked = false;
  const AI_ERR = { not_granted: 'Je hebt de pagina geen toestemming gegeven om Claude te gebruiken.', sampling_disabled: 'Claude is niet beschikbaar voor dit account.', rate_limited: 'Te veel aanvragen of je gebruikslimiet is bereikt. Probeer het later opnieuw.', session_expired: 'Je bent afgemeld. Meld je opnieuw aan bij Claude.', refused: 'Claude weigerde deze vraag. Formuleer ze anders.', invalid_json: 'Claude gaf geen bruikbaar antwoord.', bad_key: 'De API-sleutel werkt niet. Controleer hem bij Instellingen.', network: 'Geen verbinding met de Claude-API.', overloaded: 'De Claude-API is even overbelast. Probeer het zo opnieuw.' };
  function apiKey() { return S.apiKey || lsGet('lazyelectrical.v2.apikey', ''); }
  function aiMode() { return SAMPLE && !aiBlocked ? 'claude.ai' : apiKey() ? 'key' : 'manual'; }
  function aiSettingsHtml() {
    return '<div class="form"><label for="ai_key">Eigen API-sleutel (Claude)</label><input id="ai_key" type="password" autocomplete="off" placeholder="sk-ant-…" value="' + esc(apiKey()) + '">' +
      '<label for="ai_model">Model</label><select id="ai_model">' + [['claude-opus-5-5', 'Claude Opus 5.5 (beste ontwerpen)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (sneller, goedkoper)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (snelst, eenvoudige vragen)']].map((m) => '<option value="' + m[0] + '"' + (S.prefs.model === m[0] ? ' selected' : '') + '>' + m[1] + '</option>').join('') + '</select>' +
      '<label for="ai_remember">Sleutel onthouden</label><label style="color:var(--ink)"><input id="ai_remember" type="checkbox"' + (S.prefs.remember ? ' checked' : '') + ' style="width:auto"> in deze browser bewaren</label></div>' +
      '<p><button class="btn primary" type="button" id="ai_savekey">Bewaren</button></p><p class="note">Op claude.ai gebruikt de assistent je eigen Claude-account en heb je geen sleutel nodig. Elders (bv. de GitHub-pagina of het bestand op je computer) kun je een eigen API-sleutel van console.anthropic.com gebruiken; de sleutel gaat dan rechtstreeks van je browser naar Anthropic en wordt alleen in deze browser bewaard als je dat aanvinkt. Zonder sleutel maakt de assistent een opdracht die je in een Claude-gesprek plakt.</p>';
  }
  function saveAiSettings() {
    const k = $('#ai_key') ? $('#ai_key').value.trim() : apiKey();
    S.prefs.model = $('#ai_model') ? $('#ai_model').value : S.prefs.model; S.prefs.remember = $('#ai_remember') ? $('#ai_remember').checked : S.prefs.remember; savePrefs();
    S.apiKey = k; if (S.prefs.remember && k) lsSet('lazyelectrical.v2.apikey', k); else lsSet('lazyelectrical.v2.apikey', '');
    toast(k ? 'AI-instellingen bewaard.' : 'Geen sleutel: de assistent werkt via kopiëren en plakken (of op claude.ai).'); renderAI();
  }
  function rules() { const r = lsGet(RULES, []); return (Array.isArray(r) ? r : String(r).split('\n')).map((x) => String(x).trim()).filter(Boolean); }
  function renderAI() {
    const mode = aiMode(), b = $('#aiBody');
    const modeTxt = mode === 'claude.ai' ? 'Verbonden met je Claude-account (claude.ai).' : mode === 'key' ? 'Gebruikt je eigen API-sleutel · ' + S.prefs.model : 'Geen directe verbinding: de assistent maakt een opdracht om in een Claude-gesprek te plakken. Stel een API-sleutel in bij Bestand → Instellingen voor directe antwoorden.';
    const rl = rules();
    b.innerHTML = '<div class="ai"><div class="f"><label for="aiText" style="font-weight:600">Wat moet de assistent doen?</label></div><textarea id="aiText" placeholder="Bv. Een pomp die start met een drukknop en stopt met een vlotter, met noodstop, thermische beveiliging en signaallampen. Of: voeg een tweede startknop toe op blad 3."></textarea>' +
      '<div class="row"><button class="btn primary" type="button" id="aiGo">Ontwerpen / wijzigen</button><button class="btn" type="button" id="aiAsk">Vraag stellen</button><button class="btn" type="button" id="aiStop" hidden>Stoppen</button><button class="btn" type="button" id="aiUndo" hidden>Ongedaan maken</button></div>' +
      '<div class="aistatus" id="aiStatus"></div><div id="aiManual" hidden></div>' +
      '<p class="hint">' + esc(modeTxt) + '</p>' +
      '<p class="hint">De assistent tekent niet met de hand: hij beschrijft stroompaden en het programma tekent ze op het raster, controleert ze en stuurt fouten terug tot het klopt (maximaal 3 rondes). Alles kan ongedaan gemaakt worden.</p>' +
      '<details' + (rl.length ? ' open' : '') + '><summary>Eigen ontwerpregels (' + rl.length + ')</summary><div class="rules" style="margin-top:6px">' + rl.map((r, i) => '<div class="rl"><span>' + esc(r) + '</span><button type="button" data-rdel="' + i + '" aria-label="Regel verwijderen">×</button></div>').join('') +
      '<div class="row"><input id="ruleNew" placeholder="Bv. Gebruik altijd 24V DC stuurspanning" style="flex:1;border:1px solid var(--line);border-radius:3px;padding:4px 6px" aria-label="Nieuwe regel"><button class="btn" type="button" id="ruleAdd">Toevoegen</button></div></div></details></div>';
  }
  function aiStatus(t, err) { const s = $('#aiStatus'); if (!s) return; s.className = 'aistatus' + (err ? ' err' : ''); s.textContent = t || ''; }
  /* the three ways to reach Claude */
  async function askClaude(prompt, signal, onProgress) {
    const mode = aiMode();
    if (mode === 'claude.ai') { const r = await SAMPLE(prompt, { signal, cache: false, onText: (t) => onProgress && onProgress(t.length) }); return r.text; }
    if (mode === 'key') return askApi(prompt, signal, onProgress);
    throw Object.assign(new Error('manual'), { code: 'manual' });
  }
  /* direct Messages API call from the browser with the user's own key (streamed, so long designs do not time out) */
  async function askApi(prompt, signal, onProgress) {
    const model = S.prefs.model || 'claude-opus-5-5', fallback = model !== 'claude-haiku-5-5';
    const headers = { 'content-type': 'application/json', 'x-api-key': apiKey(), 'anthropic-version': '2026-10-21', 'anthropic-dangerous-direct-browser-access': 'true' };
    if (fallback) headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    const body = { model, max_tokens: 64000, stream: true, output_config: { effort: model === 'claude-haiku-5-5' ? 'medium' : 'high' }, messages: [{ role: 'user', content: prompt }] };
    if (fallback) body.fallbacks = 'default';
    let res;
    try { res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body), signal }); }
    catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('gestopt'), { code: 'cancelled' }); throw Object.assign(new Error('network'), { code: 'network' }); }
    if (!res.ok) {
      const code = res.status === 401 || res.status === 403 ? 'bad_key' : res.status === 429 ? 'rate_limited' : res.status === 529 || res.status >= 500 ? 'overloaded' : 'api';
      let msg = ''; try { msg = (await res.json()).error.message; } catch (e) { /* ignore */ }
      throw Object.assign(new Error(msg || 'HTTP ' + res.status), { code });
    }
    const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '', text = '', stop = '';
    for (;;) {
      const { value, done } = await rd.read(); if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const line = chunk.split('\n').find((l) => l.indexOf('data:') === 0); if (!line) continue;
        let ev; try { ev = JSON.parse(line.slice(5)); } catch (e) { continue; }
        if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') { text += ev.delta.text; if (onProgress) onProgress(text.length); }
        else if (ev.type === 'message_delta' && ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        else if (ev.type === 'error') throw Object.assign(new Error((ev.error && ev.error.message) || 'fout'), { code: ev.error && ev.error.type === 'overloaded_error' ? 'overloaded' : 'api' });
      }
    }
    if (stop === 'refusal') throw Object.assign(new Error('geweigerd'), { code: 'refused' });
    return text;
  }
  async function runAI(question, mode) {
    question = String(question || '').trim();
    if (!question) { aiStatus('Typ eerst wat de assistent moet doen.', true); return; }
    const opts = { P: P(), question, mode, rules: rules() };
    if (aiMode() === 'manual') { manualAI(opts); return; }
    aiCtl = new AbortController();
    $('#aiGo').disabled = true; $('#aiAsk').disabled = true; $('#aiStop').hidden = false;
    let label = '';
    try {
      const res = await AI.run(Object.assign(opts, { onStatus: (t) => { label = t; aiStatus(t); }, ask: (pr) => askClaude(pr, aiCtl.signal, (n) => aiStatus(label + ' (' + n + ' tekens)')) }));
      showAiResult(res);
    } catch (e) {
      const c = e && e.code;
      if (c === 'cancelled' || (e && e.name === 'AbortError')) aiStatus('Gestopt.');
      else { aiStatus((AI_ERR[c] || 'Er ging iets mis: ' + (e && e.message)) + (c === 'not_granted' || c === 'sampling_disabled' ? ' Probeer opnieuw: de assistent schakelt nu over op kopiëren en plakken.' : ''), true); if (c === 'not_granted' || c === 'sampling_disabled') { aiBlocked = true; } }
    } finally {
      const g = $('#aiGo'); if (g) { g.disabled = false; $('#aiAsk').disabled = false; $('#aiStop').hidden = true; }
      aiCtl = null;
    }
  }
  function showAiResult(res) {
    if (res.answer) { aiStatus(res.answer); return; }
    if (!res.changed) { aiStatus(res.uitleg || 'Geen wijzigingen.'); return; }
    const before = P().pages.map((p) => p.id);
    S.H.replace('AI-assistent', res.P); changed();
    const fresh = P().pages.find((p) => before.indexOf(p.id) < 0 && p.kind !== 'cover') || P().pages.find((p) => p.kind !== 'cover');
    S.tabs = []; S.active = -1; if (fresh) openPage(fresh.id);
    const rest = (res.remaining || []).length, warn = (res.warnings || []).length;
    aiStatus((res.uitleg || 'Klaar.') + (rest ? '\n\nNog niet opgelost (' + rest + '): ' + res.remaining.slice(0, 5).join(' · ') : '') + (warn ? '\n\nWaarschuwingen: ' + warn + ' (zie Controle).' : '') + '\n\n(' + res.attempts + ' ronde' + (res.attempts > 1 ? 's' : '') + ')');
    $('#aiUndo').hidden = false;
  }
  function manualAI(opts) {
    const prompt = AI.buildPrompt(opts) + '\n\nAntwoord met ALLEEN het JSON-object.';
    const m = $('#aiManual'); m.hidden = false;
    m.innerHTML = '<div class="f"><label for="aiPrompt">1. Kopieer deze opdracht en plak ze in een gesprek met Claude</label><textarea id="aiPrompt" rows="4" readonly style="font-family:var(--f-mono);font-size:11px;min-height:0"></textarea></div><div class="row"><button class="btn" type="button" id="aiCopy">Opdracht kopiëren</button></div><div class="f"><label for="aiAnswer">2. Plak hier het antwoord van Claude</label><textarea id="aiAnswer" rows="4" style="min-height:0"></textarea></div><div class="row"><button class="btn primary" type="button" id="aiLoad">Antwoord laden</button></div>';
    $('#aiPrompt').value = prompt;
    $('#aiCopy').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(prompt).then(() => toast('Opdracht gekopieerd. Plak ze in Claude.')) : Promise.reject()).catch(() => { $('#aiPrompt').select(); toast('Geselecteerd: druk op Ctrl+C.'); });
    $('#aiLoad').onclick = () => {
      try {
        const res = AI.apply(P(), AI.parse($('#aiAnswer').value));
        res.attempts = 1; res.remaining = AI.mustFix(res); res.warnings = res.checks.filter((c) => c.level === 'warn').map((c) => c.msg);
        m.hidden = true; m.innerHTML = ''; showAiResult(res);
        if (res.remaining.length) aiStatus($('#aiStatus').textContent + '\n\nWil je dat Claude de fouten verbetert? Plak dan deze fouten terug in het gesprek:\n- ' + res.remaining.join('\n- '));
      } catch (e) { aiStatus('Dat antwoord kon niet geladen worden: ' + e.message + '. Plak het volledige antwoord (het JSON-blok).', true); }
    };
    aiStatus('');
  }

  /* =====================================================================
     Events
     ===================================================================== */
  function bind() {
    document.addEventListener('click', (e) => {
      const c = e.target.closest('[data-cmd]'); if (c && !c.closest('.back')) { run(c.dataset.cmd); return; }
      const rt = e.target.closest('[data-rt]'); if (rt) { if (rt.dataset.rt === 'file') openBack('home'); else { S.rtab = rt.dataset.rt; renderRibbon(); } return; }
      const lt = e.target.closest('[data-ltab]'); if (lt) { S.ltab = lt.dataset.ltab; renderDockTabs(); return; }
      const rt2 = e.target.closest('[data-rtab]'); if (rt2) { showRight(rt2.dataset.rtab); return; }
      const tab = e.target.closest('[data-close]'); if (tab) { closeTab(+tab.dataset.close); return; }
      const tb = e.target.closest('[data-tab]'); if (tb) { S.active = +tb.dataset.tab; S.sel.clear(); renderAll(); return; }
      const fav = e.target.closest('[data-fav]'); if (fav) { e.stopPropagation(); const f = S.prefs.favs, i = f.indexOf(fav.dataset.fav); if (i >= 0) f.splice(i, 1); else f.push(fav.dataset.fav); savePrefs(); renderSymbols(); return; }
      const sy = e.target.closest('[data-sym]'); if (sy) { if (!curPage()) { toast('Open eerst een blad.'); return; } setTool(S.tool.name === 'place' && S.tool.s === sy.dataset.sym ? { name: 'select' } : { name: 'place', s: sy.dataset.sym }); return; }
      const ch = e.target.closest('[data-chk]'); if (ch) { const x = checks()[+ch.dataset.chk]; if (x && x.page) { if (x.id) goTo(x.page, x.id); else openPage(x.page); } return; }
      const fd = e.target.closest('[data-find]'); if (fd) { const r = S.findResults[+fd.dataset.find]; goTo(r.pg.id, r.it.id); return; }
      if (e.target.closest('[data-findclose]')) { S.findResults = null; S.showChecks = false; renderChecks(); return; }
      const go = e.target.closest('tr[data-go]'); if (go && !e.target.closest('input')) { const f = M.itemById(P(), go.dataset.go); if (f) goTo(f.pg.id, f.it.id); else { const pg = M.findPage(P(), go.dataset.go); if (pg) openPage(pg.id); } return; }
      const csv = e.target.closest('[data-csv]'); if (csv) { download(fileName('_' + csv.dataset.csv + '.csv'), L.csv(P(), csv.dataset.csv === 'pages' ? 'contents' : csv.dataset.csv), 'text/csv'); return; }
      const pk = e.target.closest('[data-pick]'); if (pk) { const x = LE.cabinet.pickList(P(), analysis()).find((y) => y.key === pk.dataset.pick); if (x) setTool({ name: 'cab', dev: x.key, w: x.w, h: x.h }); return; }
      if (e.target.closest('[data-pickall]')) { const x = LE.cabinet.pickList(P(), analysis()).find((y) => !y.placed); if (x) setTool({ name: 'cab', dev: x.key, w: x.w, h: x.h }); return; }
      const gs = e.target.closest('[data-goschema]'); if (gs) { const dv = analysis().devices[gs.dataset.goschema]; const m = dv && (dv.master || dv.all[0]); if (m) goTo(m.pg.id, m.it.id); return; }
      const pd = e.target.closest('[data-partdel]'); if (pd) { exec('Artikel verwijderen', (Q) => { Q.parts = (Q.parts || []).filter((p) => p.part !== pd.dataset.partdel); }); return; }
      if (e.target.id === 'aiGo') runAI($('#aiText').value, 'design');
      else if (e.target.id === 'aiAsk') runAI($('#aiText').value, 'ask');
      else if (e.target.id === 'aiStop') { if (aiCtl) aiCtl.abort(); }
      else if (e.target.id === 'aiUndo') { const l = S.H.back(); if (l) { changed(); aiStatus('Vorige versie teruggezet.'); $('#aiUndo').hidden = true; } }
      else if (e.target.id === 'ruleAdd') { const v = $('#ruleNew').value.trim(); if (v) { lsSet(RULES, rules().concat([v])); renderAI(); } }
      else { const rd = e.target.closest('[data-rdel]'); if (rd) { const r = rules(); r.splice(+rd.dataset.rdel, 1); lsSet(RULES, r); renderAI(); } }
    });
    $('#treeBody').addEventListener('click', treeClick);
    $('#treeBody').addEventListener('contextmenu', treeMenu);
    $('#treeBody').addEventListener('keydown', (e) => { if (e.key === 'Enter') treeClick(e); });
    $('#propsBody').addEventListener('change', propChange);
    $('#view').addEventListener('change', (e) => {
      const t = e.target; if (!t.dataset.ek) return;
      const key = t.dataset.dev, k = t.dataset.ek, v = t.value;
      exec('Toestel aanpassen', (Q) => { const A2 = M.analyze(Q), dv = A2.devices[key]; if (!dv) return; const m = dv.master || dv.all[0]; m.it.p = m.it.p || {}; m.it.p[k] = v; });
    });
    $('#symBody').addEventListener('input', (e) => { if (e.target.id === 'symQ') { symFilter = e.target.value; const pos = e.target.selectionStart; renderSymbols(); const q = $('#symQ'); q.focus(); q.setSelectionRange(pos, pos); } });
    $('#back').addEventListener('click', backClick);
    $('#back').addEventListener('change', backChange);
    $('#aiBody').addEventListener('keydown', (e) => { if (e.target.id === 'aiText' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAI(e.target.value, 'design'); } if (e.target.id === 'ruleNew' && e.key === 'Enter') { e.preventDefault(); $('#ruleAdd').click(); } });
    addEventListener('keydown', (e) => {
      if (!$('#back').hidden) { if (e.key === 'Escape') closeBack(); return; }
      if ($('.modal')) return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 's') { e.preventDefault(); saveFile(); return; }
      if (isTyping(e)) return;
      const k = e.key;
      if (ctrl && k.toLowerCase() === 'z') { e.preventDefault(); run(e.shiftKey ? 'redo' : 'undo'); }
      else if (ctrl && k.toLowerCase() === 'y') { e.preventDefault(); run('redo'); }
      else if (ctrl && k.toLowerCase() === 'c') { e.preventDefault(); run('copy'); }
      else if (ctrl && k.toLowerCase() === 'x') { e.preventDefault(); run('cut'); }
      else if (ctrl && k.toLowerCase() === 'v') { e.preventDefault(); run('paste'); }
      else if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); run('selall'); }
      else if (ctrl && k === '1') { e.preventDefault(); run('t_wire1'); }
      else if (ctrl && k === '3') { e.preventDefault(); run('t_wire3'); }
      else if (k === 'F11') { e.preventDefault(); run('pot_top'); }
      else if (k === 'F12') { e.preventDefault(); run('pot_bottom'); }
      else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); run('del'); }
      else if (k === 'Escape') { const t = S.tool; if ((t.name === 'wire' || t.name === 'line') && t.pts) { t.pts = null; drawOverlay(); } else if (t.a) { t.a = null; drawOverlay(); } else if (t.name !== 'select') setTool({ name: 'select' }); else { S.sel.clear(); renderCanvas(); renderProps(); } }
      else if (k === 'r' || k === 'R') run('rotate');
      else if (k === 'PageUp') { e.preventDefault(); stepPage(-1); }
      else if (k === 'PageDown') { e.preventDefault(); stepPage(1); }
      else if (k === '+' || k === '=') zoomBy(1 / 1.25);
      else if (k === '-') zoomBy(1.25);
      else if (k.indexOf('Arrow') === 0 && S.sel.size) { e.preventDefault(); const pg = curPage(); const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[k]; exec('Verplaatsen', (Q) => M.moveItems(Q, pg.id, [...S.sel], d[0], d[1])); }
    });
    addEventListener('resize', () => renderStatus());
  }

  /* =====================================================================
     Start
     ===================================================================== */
  function init() {
    let Pn = null, note = '';
    try { const saved = lsGet(KEY, null); if (saved) Pn = M.load(saved); } catch (e) { note = 'Het bewaarde project kon niet geladen worden; er is een voorbeeld geopend.'; }
    if (!Pn) { Pn = AU.buildProject(LE.examples[0].spec).P; note = note || 'Welkom! Er is een voorbeeldproject geopend. Kies Bestand → Nieuw voor een leeg project, of laat de AI-assistent iets ontwerpen.'; }
    S.H = new M.History(Pn);
    PT.setProject(Pn);
    bind(); layoutDocks(); renderDockTabs(); renderSymbols();
    const first = Pn.pages.find((p) => p.kind !== 'cover') || Pn.pages[0];
    if (first) openPage(first.id); else renderAll();
    if (note) toast(note, 6500);
    if (window.claude && window.claude.use) {
      window.claude.use('sample').then((s) => { SAMPLE = s; renderAI(); }).catch(() => {});
      window.claude.use('downloads').then((d) => { DL = d; }).catch(() => {});
    }
  }
  init();
})();
