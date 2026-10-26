/* LAZY Electrical AI assistant core (no DOM): the prompt, reading Claude's answer, applying it to the project,
   and the check-and-retry loop. The app supplies an ask(prompt) function (claude.ai, own API key, or copy-paste).
   The AI never places coordinates: it writes page descriptions (see auto.js) and the layout engine draws them. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.ai = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols, AU = LE.auto, CK = LE.checks;

  function catalog() {
    const rows = [];
    SY.CATS.forEach((cat) => {
      rows.push('# ' + cat);
      SY.list().filter((s) => s.cat === cat).forEach((s) => {
        const poles = AU.LOAD_POLES[s.id] || s.poles || 1;
        const role = s.role === 'slave' ? 'contact van een spoel/toestel (tag = tag van dat toestel)' : s.role === 'terminal' ? 'klem (tag = klemmenstrook, bv. X1; "no" = klemnummer)' : s.role === 'ref' ? 'draadverwijzing (eindelement, "name")' : s.end ? 'eindtoestel' : AU.isOut({ s: s.id }) ? 'uitgang (laatste element van een reeks)' : 'toestel';
        rows.push('- ' + s.id + ': ' + s.name + ' — ' + role + (poles > 1 ? ', ' + poles + ' polen' : '') + (s.letter ? ', letter ' + s.letter : ''));
      });
    });
    return rows.join('\n');
  }

  const FORMAT = [
    'Je bent de AI-assistent van LAZY Electrical, een elektrisch CAD-programma voor stroomschema\'s van schakelkasten (IEC-normen, tags volgens IEC 81346).',
    'Je tekent NOOIT met coördinaten. Je beschrijft elk blad met potentialen (rails) en stroompaden; het programma plaatst alles zelf op het raster en controleert het schema.',
    '',
    'ANTWOORD altijd met ALLEEN één JSON-object (geen tekst ervoor of erna, geen commentaar in de JSON). Twee vormen:',
    'A) Nieuw of volledig herschreven project:',
    '{ "project": { "info": {"name": "...", "desc1": "...", "author": "..."}, "settings": {"template": "A3"}, "devices": { "K1": {"desc": "...", "part": "..."} }, "pages": [ blad, blad, ... ] }, "_uitleg": "2-4 zinnen in het Nederlands" }',
    'B) Wijzigingen aan het huidige project:',
    '{ "ops": [ operatie, ... ], "_uitleg": "..." } met operaties:',
    '  {"op":"setPage","page":"2","spec": blad}          blad 2 opnieuw opbouwen volgens de nieuwe beschrijving',
    '  {"op":"addPage","after":"2","spec": blad}         nieuw blad na blad 2 (after weglaten = achteraan)',
    '  {"op":"deletePage","page":"3"}',
    '  {"op":"setDevice","tag":"K1","desc":"...","desc2":"...","part":"...","maker":"..."}',
    '  {"op":"renameDevice","from":"K1","to":"K5"}',
    '  {"op":"setInfo","info":{"name":"...","desc1":"..."}}',
    'Gebruik vorm B voor kleine aanpassingen aan een bestaand project, vorm A voor een nieuw ontwerp.',
    '',
    'BLAD: { "title": "Stuurstroom", "top": ["1L1"], "bottom": ["1N"], "paths": [pad, pad, ...] }',
    '  top = potentialen bovenaan (van boven naar onder), bottom = potentialen onderaan. Dezelfde naam op meerdere bladen = dezelfde potentiaal (kruisverwijzingen komen vanzelf).',
    '  Paden worden van links naar rechts geplaatst; past het niet op één blad, dan maakt het programma vervolgbladen.',
    'PAD (1-polig, stuurstroom): { "from": "1L1", "to": "1N", "chain": [element, ...] }  (een reeks van boven naar onder; "to" mag weg als de reeks op een PLC-ingang eindigt)',
    '  element = { "s": "<symbool-id>", "tag": "S1", "desc": "START", "desc2": "tweede regel" }',
    '  parallel = { "par": [ [element, ...], [element, ...] ] }  minstens 2 takken; bv. startknop parallel met houdcontact.',
    '  Eindigen ALLE takken van een "par" op een uitgang (spoel, lamp …), dan is het een splitsing: zet ze dan als LAATSTE element van de reeks.',
    '  Een uitgang (spoel, lamp, zoemer, ventiel, PLC-ingang) is altijd het laatste element van een reeks of tak.',
    'PAD (meerpolig, hoofdstroom): { "from": ["L1","L2","L3"], "pe": "PE", "chain": [ {"s":"mpcb3","tag":"Q1"}, {"s":"main3","tag":"K1"}, {"s":"term","tag":"X1","no":["1","2","3"],"pe":true}, {"cable":"W1","type":"XVB 4G1,5"}, {"s":"motor3","tag":"M1","desc":"POMP"} ] }',
    '  Alle elementen moeten evenveel polen hebben als "from". Een voeding: { "from": ["L1","N"], "pe": "PE", "to": ["+24V","0V"], "chain": [{"s":"mcb2","tag":"F1"},{"s":"psu","tag":"T1"}] }.',
    '  Een stuurstroomautomaat: { "from": ["L1","N"], "to": ["1L1","1N"], "chain": [{"s":"mcb2","tag":"F1","desc":"STUURKRING"}] }.',
    'MOTORSTARTERS (hoofdstroom, aanbevolen):',
    '  { "macro": "dol", "from": ["L1","L2","L3"], "pe": "PE", "breaker": {"s":"mpcb3","tag":"Q1"}, "contactor": "K1", "ol": {"tag":"F2"}, "term": {"tag":"X1"}, "cable": {"tag":"W1","type":"XVB 4G1,5"}, "motor": {"tag":"M1","desc":"POMP","desc2":"2,2 kW"} }',
    '  { "macro": "rev", ... "fwd": {"tag":"K1","desc":"RECHTS"}, "rev": {"tag":"K2","desc":"LINKS"} }   omkeerschakeling (L1 en L3 gekruist)',
    '  { "macro": "yd", ... "main": {"tag":"K1"}, "star": {"tag":"K2"}, "delta": {"tag":"K3"} }   ster-driehoek (motor met 6 klemmen)',
    '  "breaker": mpcb3 (motorbeveiligingsschakelaar, dan is "ol" niet nodig), mcb3 of fuse3 (dan komt er automatisch een thermisch relais "ol"); "breaker": false = geen. "term" en "cable" zijn optioneel.',
    '',
    'SYMBOLEN (gebruik exact deze id\'s):',
    '%CATALOG%',
    '',
    'ONTWERPREGELS:',
    '- Hoofdstroomblad: top ["L1","L2","L3","N","PE"] en de stuurkring via een automaat naar bottom ["1L1","1N"]; stuurstroomblad: top ["1L1"], bottom ["1N"] (230 V AC) of top ["+24V"], bottom ["0V"] (24 V DC).',
    '- Een contact ("no", "nc", "main3", "th_nc", tijdcontacten) heeft als tag de tag van zijn spoel of toestel: hoofdcontacten "main3" van K1 en spoel "coil" K1 vormen één contactor. Hulpcontacten van een motorbeveiligingsschakelaar Q1: {"s":"no","tag":"Q1"}.',
    '- Contactnummers (13-14, 21-22 …), kruisverwijzingen en het contactbeeld onder de spoelen maakt het programma zelf. Geef geen "pins" op.',
    '- Veiligheid: thermisch contact (th_nc van het thermisch relais) of hulpcontact van de motorbeveiliging, noodstop (estop) en stopknoppen (pb_nc) EÉN keer in serie vooraan; daarna startknop (pb_no) parallel met het houdcontact (no van de eigen spoel); daarna de spoel.',
    '- Moeten meerdere spoelen gevoed worden (rechts/links, ster/driehoek), splits NA de gemeenschappelijke veiligheidsketen met een "par" waarvan elke tak op een spoel eindigt. Herhaal de veiligheidsketen nooit per spoel.',
    '- Omkeer: vergrendel met het nc-contact van de andere contactor in elke tak. Ster-driehoek: netcontactor K1 + tijdrelais (coil_ton), ster via nc_ton, driehoek via no_ton, ster en driehoek onderling vergrendeld met nc.',
    '- Signaallampen (lamp) via een no-contact van de contactor; storing via nc van de beveiliging.',
    '- PLC: module {"s":"plc","tag":"K1"} tussen +24V en 0V; ingangen als reeks contact → {"s":"plc_di","tag":"K1","addr":"I1","desc":"START"}; uitgangen als {"s":"plc_do","tag":"K1","addr":"Q1"} gevolgd door de spoel/lamp tussen 1L1 en 1N. Siemens LOGO! heeft I1-I8 en Q1-Q4.',
    '- Tags: S = bedieningsknop/schakelaar, K = relais/contactor/PLC, Q = motorbeveiliging/hoofdschakelaar, F = automaat/zekering/thermisch relais, M = motor, P = signaallamp/zoemer, B = sensor/eindeloop, T = voeding/transformator/regelaar, X = klemmen, W = kabel. Elke tag is uniek per toestel.',
    '- Omschrijvingen ("desc") kort in HOOFDLETTERS (max ±12 tekens per regel), zoals START, STOP, NOODSTOP, POMP, RECHTS.',
    '- Een stroompad kan ongeveer 12 elementen onder elkaar bevatten; maak lange reeksen korter of verdeel ze.',
    '- Past een vraag niet in deze mogelijkheden, maak de beste versie die wel past en zeg het in "_uitleg".'
  ].join('\n');

  function example() {
    const ex = (LE.examples || []).find((e) => e.id === 'dol');
    return ex ? 'VOORBEELD (vorm A) voor "pomp direct starten met start/stop, noodstop en signaallampen":\n' + JSON.stringify({ project: ex.spec, _uitleg: 'Pomp met motorbeveiligingsschakelaar Q1, contactor K1, start/stop en lampen.' }) : '';
  }
  function specText() { return FORMAT.replace('%CATALOG%', catalog()); }

  /* the current project as the AI sees it: page descriptions (or a summary of hand-drawn pages) and the open errors */
  function projectText(P) {
    if (!P || !P.pages.some((p) => p.kind !== 'cover')) return '(leeg project)';
    const s = AU.projectSpec(P);
    const errs = CK.run(P).filter((c) => c.level === 'error').map((c) => c.msg);
    return JSON.stringify(s) + (errs.length ? '\nOPEN FOUTEN: ' + errs.slice(0, 15).join(' | ') : '');
  }
  function buildPrompt(o) {
    const parts = [specText(), example()];
    if (o.rules && o.rules.length) parts.push('EXTRA ONTWERPREGELS VAN DE GEBRUIKER (altijd volgen, ze gaan voor):\n- ' + o.rules.join('\n- '));
    parts.push('HUIDIG PROJECT:\n' + projectText(o.P));
    if (o.mode === 'ask') parts.push('De gebruiker stelt een vraag over het schema. Antwoord dan met { "answer": "je antwoord in het Nederlands" } en verander niets (tenzij de gebruiker uitdrukkelijk om een wijziging vraagt; gebruik dan vorm B).');
    parts.push('VRAAG VAN DE GEBRUIKER:\n' + o.question);
    return parts.join('\n\n');
  }

  /* lenient JSON reading: code fences, text around the object, comments and trailing commas are tolerated */
  function repair(t) {
    let out = '', inStr = false, esc = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (inStr) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
      if (c === '"') { inStr = true; out += c; continue; }
      if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; continue; }
      if (c === '/' && t[i + 1] === '*') { i += 2; while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++; i++; continue; }
      out += c;
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
  }
  function parse(text) {
    let t = String(text || '').trim().replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '');
    try { return JSON.parse(t); } catch (e) { /* try harder */ }
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { t = t.slice(a, b + 1); try { return JSON.parse(t); } catch (e) { return JSON.parse(repair(t)); } }
    throw new Error('geen JSON gevonden in het antwoord');
  }

  /* apply a reply to a copy of the project: {P, errors (layout), checks, uitleg, answer} */
  function apply(P0, reply) {
    if (!reply || typeof reply !== 'object') throw new Error('het antwoord is geen JSON-object');
    const uitleg = String(reply._uitleg || reply.uitleg || '');
    if (reply.answer && !reply.ops && !reply.project) return { P: P0, errors: [], checks: [], uitleg, answer: String(reply.answer), changed: false };
    const errors = [];
    let P;
    const spec = reply.project || (Array.isArray(reply.pages) ? reply : null);
    if (spec) {
      const keep = P0 && P0.info ? P0.info : {};
      const r = AU.buildProject(Object.assign({}, spec, { info: Object.assign({}, keep, spec.info || {}) }));
      if (!r.P) throw new Error(r.errors.join('; '));
      P = r.P; errors.push(...r.errors);
      if (P0 && P0.parts) P.parts = P0.parts.slice();
    } else if (Array.isArray(reply.ops)) {
      P = M.clone(P0); P.seq = P0.seq;
      reply.ops.forEach((op, i) => applyOp(P, op, errors, 'operatie ' + (i + 1)));
    } else throw new Error('het antwoord bevat geen "project" en geen "ops"');
    const checks = CK.run(P);
    return { P, errors, checks, uitleg, changed: true };
  }
  function pageOf(P, label, errors, where) {
    const pg = M.pageByLabel(P, label);
    if (!pg) errors.push(where + ': blad "' + label + '" bestaat niet (bladen: ' + P.pages.map(M.pageLabel).join(', ') + ')');
    return pg;
  }
  function applyOp(P, op, errors, where) {
    if (!op || typeof op !== 'object') { errors.push(where + ': geen object'); return; }
    const kind = op.op;
    if (kind === 'setPage') {
      const pg = pageOf(P, op.page, errors, where); if (!pg) return;
      const e0 = errors.length, saved = M.clone(pg.items);
      AU.buildPage(P, op.spec || {}, errors, { page: pg });
      if (errors.length > e0) pg.items = saved;
    } else if (kind === 'addPage') {
      const after = op.after != null ? pageOf(P, op.after, errors, where) : null;
      AU.buildPage(P, op.spec || {}, errors, { after: after ? after.id : (P.pages.length ? P.pages[P.pages.length - 1].id : undefined) });
    } else if (kind === 'deletePage') {
      const pg = pageOf(P, op.page, errors, where); if (pg) M.deletePage(P, pg.id);
    } else if (kind === 'setDevice') {
      let n = 0;
      P.pages.forEach((pg) => pg.items.forEach((it) => {
        if (it.k !== 'sym' || it.tag !== op.tag) return;
        const d = SY.get(it.s); if (d.role !== 'master' && d.role !== 'device') return;
        it.p = it.p || {}; ['desc', 'desc2', 'part', 'maker'].forEach((k) => { if (op[k] != null) it.p[k] = String(op[k]); }); n++;
      }));
      if (!n) errors.push(where + ': toestel ' + op.tag + ' niet gevonden');
    } else if (kind === 'renameDevice') {
      if (!M.renameDevice(P, String(op.from), String(op.to))) errors.push(where + ': toestel ' + op.from + ' niet gevonden');
    } else if (kind === 'setInfo') Object.assign(P.info, op.info || {});
    else if (kind === 'setSettings') Object.assign(P.settings, op.settings || {});
    else errors.push(where + ': onbekende operatie "' + kind + '"');
  }

  /* problems the AI must fix before its answer is accepted */
  function mustFix(res) { return res.errors.concat(res.checks.filter((c) => c.level === 'error').map((c) => c.msg)); }
  function shouldFix(res) { return res.checks.filter((c) => c.level === 'warn').map((c) => c.msg); }

  /* the full loop: ask, read, apply, check; up to 3 rounds of corrections. ask(prompt, {attempt}) -> Promise<string> */
  async function run(o) {
    const status = o.onStatus || (() => {});
    const base = buildPrompt(o);
    let prompt = base, last = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      status(attempt === 1 ? 'Claude ontwerpt het schema…' : 'Claude verbetert het schema (ronde ' + attempt + ')…');
      const text = await o.ask(prompt + '\n\nAntwoord met ALLEEN het JSON-object.', { attempt });
      let reply, res;
      try { reply = parse(text); res = apply(o.P, reply); }
      catch (e) {
        if (attempt === 3) throw Object.assign(new Error('Claude gaf geen bruikbaar antwoord: ' + e.message), { code: 'invalid_json' });
        prompt = base + '\n\nJE VORIGE ANTWOORD WAS NIET BRUIKBAAR (' + e.message + '). Geef nu alleen het volledige, geldige JSON-object.';
        continue;
      }
      last = res;
      const fix = mustFix(res);
      if (!fix.length || attempt === 3 || !res.changed) return Object.assign(res, { attempts: attempt, remaining: fix, warnings: shouldFix(res) });
      status('Het programma vond ' + fix.length + ' fout' + (fix.length > 1 ? 'en' : '') + '; Claude verbetert…');
      prompt = base + '\n\nJE VORIGE ANTWOORD:\n' + JSON.stringify(reply) + '\n\nHET PROGRAMMA VOND DEZE FOUTEN:\n- ' + fix.slice(0, 25).join('\n- ') +
        (shouldFix(res).length ? '\nWAARSCHUWINGEN (verbeter als het kan):\n- ' + shouldFix(res).slice(0, 10).join('\n- ') : '') + '\n\nCorrigeer ze en antwoord opnieuw met het volledige JSON-object (dezelfde vorm).';
    }
    return last;
  }

  return { buildPrompt, parse, apply, run, catalog, specText, mustFix };
})();
if (typeof module !== 'undefined') module.exports = LE;
