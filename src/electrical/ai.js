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
    'Je bent de AI-assistent van LAZY Electrical, een elektrisch CAD-programma voor stroomschema\'s van schakelkasten (IEC 60617-symbolen, tags volgens IEC 81346).',
    'Je tekent NOOIT met coördinaten. Je beschrijft elk blad met potentialen (rails) en stroompaden; het programma plaatst alles op het raster, nummert tags en contacten, maakt kruisverwijzingen en controleert het schema. Fouten krijg je terug om te verbeteren.',
    '',
    'ANTWOORD altijd met ALLEEN één JSON-object (geen tekst ervoor of erna, geen commentaar). Twee vormen:',
    'A) Nieuw of volledig herschreven project:',
    '{ "project": { "info": {"name": "...", "desc1": "..."}, "cover": false, "devices": { "K2": {"desc": "...", "part": "..."} }, "pages": [ blad, ... ] }, "_uitleg": "2-4 zinnen in het Nederlands" }',
    'B) Wijzigingen aan het huidige project: { "ops": [ operatie, ... ], "_uitleg": "..." } met operaties:',
    '  {"op":"setPage","page":"2","spec": blad}   blad opnieuw opbouwen · {"op":"addPage","after":"2","spec": blad} · {"op":"deletePage","page":"3"}',
    '  {"op":"setDevice","tag":"2K5","desc":"...","desc2":"...","part":"..."} · {"op":"renameDevice","from":"2K5","to":"2K6"} · {"op":"setInfo","info":{...}}',
    'Gebruik vorm B voor kleine aanpassingen, vorm A voor een nieuw ontwerp. Bij vorm B gebruik je de tags zoals ze in HUIDIG PROJECT staan.',
    '',
    'BLAD: { "title": "Stuurschakeling", "top": [...], "mid": [...], "bottom": [...], "paths": [pad, ...] }',
    '  top = potentialen bovenaan (van boven naar onder); bottom = potentialen onderaan; mid (optioneel) = een verdeelrail halverwege het blad, bv. na de hoofdautomaat.',
    '  Dezelfde naam op meerdere bladen = dezelfde potentiaal; de kruisverwijzingen komen vanzelf. Paden staan van links naar rechts; past het niet, dan maakt het programma vervolgbladen.',
    '  Op een blad met "mid" moet elk pad vanaf "top" eindigen op "mid" ("to"); de andere paden vertrekken vanaf "mid".',
    'PAD 1-polig (stuurstroom): { "from": "1L1", "to": "1N", "chain": [element, ...] }  een reeks van boven naar onder.',
    '  "to" weglaten mag als de reeks op een PLC-ingang eindigt. "out": "NAAM" i.p.v. "to" eindigt het pad op een doorverwijspijl die de potentiaal NAAM voedt (op een ander blad).',
    '  element = { "s": "<symbool-id>", "tag": "S1", "desc": "START", "desc2": "tweede regel", "part": "artikelnummer" }',
    '  parallel = { "par": [ [element, ...], [element, ...] ] }  minstens 2 takken. Eindigen ALLE takken op een uitgang, dan is het een splitsing en moet de par het laatste element zijn.',
    '  Een uitgang (spoel, lamp, zoemer, ventiel, PLC-module, PLC-ingang) is altijd het laatste element van een reeks of tak.',
    'PAD meerpolig: { "from": ["L1","L2","L3"], "to": [...] of "out": [...], "pe": "PE", "chain": [ ... ] }  alle elementen hebben evenveel polen als "from".',
    '  klemmen: {"s":"term","tag":"X1"} (één klem per pool, nummers komen vanzelf; "pe": true voegt een PE-klem toe) · kabel: {"cable":"W1","type":"XVB 4G1,5"} · motor als laatste: {"s":"motor3","tag":"M1","desc":"POMP"}.',
    '  Voeding 230/24 V: { "from": ["L1.1","N.1"], "pe": "PE", "out": ["+24V","0V"], "chain": [{"s":"mcb2","tag":"F1"},{"s":"psu","tag":"T1"}] }.',
    'MOTORSTARTERS (hoofdstroom): { "macro": "dol" | "rev" | "yd", "from": ["2L1","2L2","2L3"], "pe": "PE", "breaker": false of {"s":"mpcb3","tag":"Q1"}, "pre": [{"s":"main3","tag":"Q5"}], ... , "ol": {"tag":"B1"}, "term": {"tag":"X3"}, "cable": {...}, "motor": {"tag":"M1","desc":"..."} }',
    '  dol: "contactor": "Q7" · rev (omkeer, L1/L3 gekruist): "fwd": {"tag":"Q7"}, "rev": {"tag":"Q8"} · yd (ster-driehoek): "main", "star", "delta".',
    '  "breaker": false als de motorgroep al beveiligd is op het voedingsblad; "pre" = extra 3-polige toestellen vóór de starter, bv. de hoofdcontacten van de lijncontactor van de noodstop.',
    '',
    'SYMBOLEN (gebruik exact deze id\'s):',
    '%CATALOG%',
    '',
    'BLADINDELING (de school van de gebruiker; volg ze tenzij de gebruiker iets anders vraagt):',
    '1. Voedingsblad: top ["L1","L2","L3","N","PE"], mid ["L1.1","L2.1","L3.1","N.1"]. Inkomende klemmen X1 + hoofdautomaat 4P (mcb4) van top naar mid. Vanaf mid: automaat 2P + voeding 230V/24V DC ("out": ["+24V","0V"]), automaat 2P stuurstroom 230 V ("out": ["1L1","1N"]), en per motor een automaat 3P ("out": ["2L1","2L2","2L3"], volgende motor 3L1 … ).',
    '2. Stuurschakeling: top ["+24V","1L1"], bottom ["0V","1N"]. Hier staan: de LOGO!-module {"s":"logo"} tussen +24V en 0V; de noodstopkring; en de 230 V-contactorspoelen.',
    '3. Ingangen: top ["+24V"], bottom ["0V"]. Per PLC-ingang een pad: klem X2 → drukknop/schakelaar → klem X2 → {"s":"plc_di","tag":<PLC>,"addr":"I1","desc":"..."}. Het thermisch contact (th_nc van het thermisch relais) zonder X-klemmen (zit in de kast).',
    '4. Uitgangen: top ["+24V"], bottom ["0V"]. Per PLC-uitgang: {"s":"plc_do","tag":<PLC>,"addr":"Q1"} → interfacerelais (WAGO) {"s":"coil","tag":"K6","desc":"MOTOR RECHTS","desc2":"WAGO 24V","part":"GEN-IR-24V-1CO"} naar 0V.',
    '5. Vermogenblad (één per motor): top ["2L1","2L2","2L3","PE"], de starter-macro met "breaker": false, "pre" met de lijncontactor, thermisch relais "ol", klemmen X3 en de motor.',
    'Zonder PLC (bedrade schakeling): voedingsblad, dan een stuurschakeling met de klassieke ladder (zie ONTWERPREGELS), dan het vermogenblad.',
    'Geen voorblad ("cover": false), tenzij de gebruiker erom vraagt.',
    '',
    'VEILIGHEID EN ONTWERPREGELS (verplicht):',
    '- NOODSTOP werkt altijd bedraad: noodstop (estop, tussen X2-klemmen) → 24 V-relais "NOOD" (coil, desc2 "WAGO 24V") naar 0V; een maakcontact van dat relais → spoel van de LIJNCONTACTOR "NOOD 230V" tussen 1L1 en 1N; de hoofdcontacten van die lijncontactor staan in de hoofdstroom via "pre". Een tweede contact van dezelfde noodstop (zelfde tag) mag naar een PLC-ingang.',
    '- Een LOGO! 24 / 24CE heeft 24 V-TRANSISTORUITGANGEN: die sturen NOOIT rechtstreeks een 230 V-spoel. Altijd: PLC-uitgang → interfacerelais 24 V → maakcontact van dat relais in het 230 V-stroompad van de contactor.',
    '- Elektrische vergrendeling: in het stroompad van elke contactor een verbreekcontact (nc) van de tegengestelde contactor (rechts/links, ster/driehoek).',
    '- Thermisch relais: met PLC gaat het thermisch contact (th_nc) naar een PLC-ingang; zonder PLC staat het in serie in de stuurstroom.',
    '- X-klemmen alleen voor toestellen BUITEN de kast: drukknoppen, noodstop, schakelaars, sensoren (X2 voor de bediening) en de motor (X3 via "term"). Thermische relais, relais, contactoren en automaten zitten in de kast: geen X-klemmen.',
    '- Bedrade stuurstroom: noodstop, stopknoppen en thermische contacten ÉÉN keer vooraan in serie; daarna de startknop parallel met het houdcontact (no van de eigen spoel); daarna de spoel. Meerdere spoelen: splits NA die veiligheidsketen met een "par" waarvan elke tak op een spoel eindigt. "Starten vanaf twee plaatsen" = twee startknoppen NO parallel en twee stopknoppen NC in serie.',
    '- Ster-driehoek: netcontactor + tijdrelais (coil_ton), ster via nc_ton, driehoek via no_ton, ster en driehoek onderling vergrendeld.',
    '- Een contact ("no", "nc", "main3", "th_nc", tijdcontacten, plc_di/plc_do) draagt de tag van zijn spoel/toestel. Contactnummers en kruisverwijzingen maakt het programma zelf; geef geen "pins".',
    '- Tags: gebruik eenvoudige unieke tags (K2, K5, Q5, Q7 …); het programma nummert ze daarna volgens blad en kolom (bv. 2K5). Letters: Q = contactor of hoofdautomaat, K = relais, interfacerelais en PLC, F = automaat/zekering, B = thermisch relais en sensoren, S = knop/schakelaar, T = voeding, M = motor, P = lamp/zoemer, X = klemmen, W = kabel.',
    '- PLC: Siemens LOGO! 24 (0BA5) = part "6ED1 052-1CC00-0BA5"; LOGO! 24CE = "6ED1 052-1CC08-0BA1"; beide 8 ingangen (I1-I8) en 4 transistoruitgangen (Q1-Q4). Geef de PLC-module, de ingangen en de uitgangen dezelfde tag. Zet het artikelnummer bij "devices".',
    '- Omschrijvingen kort in HOOFDLETTERS (max ±12 tekens per regel; gebruik desc2 voor een tweede regel).',
    '- Een stroompad bevat hooguit ongeveer 12 elementen onder elkaar.',
    '- Past een vraag niet in deze mogelijkheden, maak de beste versie die wel past en zeg dat in "_uitleg".'
  ].join('\n');

  function example() {
    const ex = (LE.examples || []).find((e) => e.id === 'logo_rev');
    return ex ? 'VOORBEELD (vorm A) — de correcte schooltekening voor "loopband links/rechts met LOGO!, noodstop, start rechts, start links, stop, thermische beveiliging":\n' + JSON.stringify({ project: ex.spec, _uitleg: 'Voedingsblad met hoofdautomaat, stuurschakeling met noodstopkring en lijncontactor, LOGO!-ingangen, uitgangen via interfacerelais en het vermogenblad met omkeerschakeling.' }) : '';
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
      if (!errors.length && reply.ops.some((op) => op && (op.op === 'setPage' || op.op === 'addPage' || op.op === 'deletePage'))) AU.retag(P);
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
