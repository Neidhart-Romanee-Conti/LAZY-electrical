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
    'Je bent de AI-assistent van LAZY Electrical, een elektrisch CAD-programma voor stroomschema\'s van schakelkasten (IEC 60617, tags volgens IEC 81346).',
    'Je tekent NOOIT zelf. Je beschrijft WAT er in de installatie zit; het programma maakt daar de standaard bladenset van:',
    '  1 Voedingsblad (hoofdautomaat, automaten, 24V-voeding) · 2 Stuurschakeling · 3 Ingangen · 4 Uitgangen (met PLC) · 5 Vermogenblad per motor.',
    'Het programma voegt zelf toe: noodstopkring met lijncontactor, interfacerelais per PLC-uitgang, vergrendelingen bij omkeer en ster-driehoek, X-klemmen, thermische relais, contactnummers, tags per blad en kolom en kruisverwijzingen. Het controleert alles; fouten krijg je terug om te verbeteren.',
    '',
    'ANTWOORD met ALLEEN één JSON-object (geen tekst ervoor of erna, geen commentaar):',
    '{ "standard": standaardproject, "_uitleg": "2-4 korte zinnen in het Nederlands" }',
    'Bij een wijziging geef je het VOLLEDIGE aangepaste standaardproject terug (het huidige staat onderaan).',
    '',
    'STANDAARDPROJECT:',
    '{ "info": {"name": "korte projectnaam", "desc1": "omschrijving"},',
    '  "plc": "0BA5" | "24CE" | "24RCE" | "1224RCE" | "none",   (LOGO! 24 0BA5 / 24CE: transistoruitgangen; "none" = bedrade sturing zonder PLC)',
    '  "estop": true | false,   (noodstop aanwezig)',
    '  "mainBreaker": "C20A", "b24": "C6A", "b230": "C10A",   (hoofdautomaat 4P, automaat 24V-voeding, automaat stuurstroom 230V)',
    '  "motors": [ { "name": "LOOPBAND", "type": "DOL" | "REV" | "YD", "breaker": "C10A", "power": "1,5 kW", "thermal": true } ],',
    '     DOL = direct starten (rol "run"), REV = omkeer rechts/links (rollen "right", "left"), YD = ster-driehoek (rollen "main", "star", "delta").',
    '  MET PLC ("plc" ≠ "none"):',
    '  "inputs": [ { "n": 1-8, "desc": "STOP", "kind": "NO" | "NC" | "ESTOP" | "THERMAL" | "LIMIT_NO" | "LIMIT_NC" | "SENSOR" | "SWITCH" | "FLOAT", "m": motorindex (alleen bij THERMAL) } ],',
    '  "outputs": [ { "n": 1-4, "desc": "MOTOR RECHTS", "load": "M:<motorindex>:<rol>" | "LAMP" | "BUZZER" } ]',
    '  ZONDER PLC ("plc": "none"):',
    '  "extraPages": [ blad, ... ]   (optioneel) eigen extra bladen in de vrije vorm, na de vaste bladen.',
    '  "ladder": { "rungs": [ sport, ... ] }   de stuurschakeling (230 V, tussen 1L1 en 1N), een sport = lijst elementen in SERIE:',
    '     contact: { "t": "NO" | "NC", "kind": "push" | "estop" | "limit" | "switch" | "sensor" | "float" | "aux" | "timer" | "thermal", "dev": "S1", "name": "START", "m": motorindex (thermal) }',
    '       push/estop/limit/switch/sensor/float = bediening of sensor met eigen tag (S… voor knoppen/schakelaars, B… voor sensoren); hetzelfde "dev" opnieuw = hetzelfde toestel (bv. NO + NC van één knop).',
    '       aux = hulpcontact van een spoel ("dev" = tag van die spoel); timer = contact van een tijdrelais ("dev" = tag van het tijdrelais); thermal = contact van het thermisch relais van motor "m".',
    '     parallel: { "par": [ [element, ...], [element, ...] ] }   bv. startknop parallel met houdcontact. Eindigen alle takken op een uitgang, dan is het een splitsing: zet ze als laatste element.',
    '     uitgang (altijd LAATSTE element): { "coil": "Q1", "type": "contactor" | "relay" | "timer_on" | "timer_off", "name": "LOOPBAND", "time": "5 s", "drives": "<motorindex>:<rol>" } of { "lamp": "P1", "name": "..." } of { "buzzer": "P2", "name": "..." }',
    '     Elke rol van elke motor krijgt precies één contactor met "drives". Tags: Q = contactor, K = relais/tijdrelais, S = knop, B = sensor, P = lamp/zoemer.',
    '',
    'ONTWERPREGELS:',
    '- Met PLC: elke drukknop, schakelaar en sensor is een EIGEN ingang (twee startknoppen = twee ingangen). Stopknoppen en de noodstop zijn NC. Is "estop" true, geef dan een ingang met kind "ESTOP" (tweede contact van de noodstop); de bedrade noodstopkring maakt het programma zelf.',
    '- Met PLC: per motor met thermisch relais een ingang "THERMAL" met de juiste "m". Elke motorrol krijgt precies één uitgang "M:i:rol". Vrije uitgangen mag je gebruiken voor lampen ("LAMP") of een zoemer ("BUZZER"). LOGO! heeft I1-I8 en Q1-Q4: gebruik elk nummer maar één keer.',
    '- Zonder PLC: noodstop, stopknoppen en thermische contacten ÉÉN keer vooraan in serie, dan de startknop(pen) NO parallel met het houdcontact (aux NO van de eigen contactor), dan de spoel. Meerdere spoelen: splits NA die veiligheidsketen met een "par" waarvan elke tak op een spoel eindigt; herhaal de beveiliging nooit per spoel.',
    '- Omkeer zonder PLC: vergrendel elke tak met het NC-hulpcontact van de andere contactor. Ster-driehoek zonder PLC: netcontactor + tijdrelais (timer_on), ster via NC-tijdcontact, driehoek via NO-tijdcontact, ster en driehoek onderling vergrendeld.',
    '- "Starten vanaf twee plaatsen" = twee startknoppen NO parallel en twee stopknoppen NC in serie (met PLC: als aparte ingangen).',
    '- Signaallampen zonder PLC: een sport met een aux-contact van de contactor en een lamp; storing via het NO-thermisch contact.',
    '- Omschrijvingen kort in HOOFDLETTERS (max ±12 tekens). Maximaal 3 motoren.',
    '- EXTRA BLADEN: wil de gebruiker iets dat niet in de vaste bladen past (bv. een extra verbruiker, een verlichtingskring, een tweede bedieningspost), voeg dan zelf bladen toe met "extraPages": [blad, ...] in het standaardproject. Een blad in "extraPages" volgt de VRIJE VORM hieronder en komt na de vaste bladen; het mag de potentialen van de vaste bladen gebruiken (+24V, 0V, 1L1, 1N …).',
    '- Past de hele vraag niet in het standaardformaat (bv. een heel andere bladindeling), gebruik dan alleen de VRIJE VORM en zeg dat in "_uitleg".',
    '',
    'VRIJE VORM (alleen als het standaardformaat niet past): { "project": { "info": {...}, "cover": false, "pages": [ blad, ... ] }, "_uitleg": "..." }',
    '  blad = { "title": "...", "top": ["1L1"], "mid": [...], "bottom": ["1N"], "paths": [pad, ...] }',
    '  1-polig pad: { "from": "1L1", "to": "1N" (of "out": "NAAM" = doorverwijspijl), "chain": [ {"s": "<symbool-id>", "tag": "S1", "desc": "START"}, {"par": [[...],[...]]}, ... ] }',
    '  meerpolig pad: { "from": ["L1","L2","L3"], "to": [...] of "out": [...], "pe": "PE", "chain": [ ... ] }; motorstarters: { "macro": "dol"|"rev"|"yd", "from": [...], "pe": "PE", "breaker": false, "pre": [...], "ol": {...}, "term": {...}, "motor": {...} }',
    '  symbolen:',
    '%CATALOG%'
  ].join('\n');

  function example() {
    const ex = (id) => (LE.examples || []).find((e) => e.id === id);
    const a = ex('std_rev'), b = ex('std_dol');
    return (a ? 'VOORBEELD 1 — "loopband links/rechts met LOGO!, noodstop, start rechts, start links, stop, thermische beveiliging":\n' + JSON.stringify({ standard: a.standard, _uitleg: 'Omkeerschakeling met LOGO! 24: vijf ingangen, twee uitgangen naar de contactoren rechts en links.' }) + '\n\n' : '') +
      (b ? 'VOORBEELD 2 — "loopband direct starten zonder PLC, met noodstop, lampen aan/uit en een bewegingsmelder met lamp":\n' + JSON.stringify({ standard: b.standard, _uitleg: 'Bedrade start/stop met houdcontact en signaallampen.' }) : '');
  }
  function specText() { return FORMAT.replace('%CATALOG%', catalog()); }

  /* the current project as the AI sees it: page descriptions (or a summary of hand-drawn pages) and the open errors */
  function projectText(P) {
    if (!P || !P.pages.some((p) => p.kind !== 'cover')) return '(leeg project)';
    const std = P.standard || P.school; // projects saved before the rename keep their description under "school"
    if (std) {
      const hand = P.pages.filter((p) => p.edited).map(M.pageLabel);
      return 'STANDAARDPROJECT: ' + JSON.stringify(std) + (hand.length ? '\nLET OP: blad ' + hand.join(', ') + ' werd met de hand aangepast; een nieuw standaardproject tekent alles opnieuw.' : '');
    }
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
    const std = reply.standard || reply.school; // "school" is the key's old name; still accepted
    if (std) {
      const sp = Object.assign({}, std, { info: Object.assign({}, (P0 && P0.info) || {}, std.info || {}) });
      const r = LE.standard.buildProject(sp);
      if (!r.P) throw new Error(r.errors.join('; '));
      P = r.P; errors.push(...r.errors);
      if (P0 && P0.parts) P.parts = P0.parts.slice();
    } else if (spec) {
      const keep = P0 && P0.info ? P0.info : {};
      const r = AU.buildProject(Object.assign({}, spec, { info: Object.assign({}, keep, spec.info || {}) }));
      if (!r.P) throw new Error(r.errors.join('; '));
      P = r.P; errors.push(...r.errors);
      if (P0 && P0.parts) P.parts = P0.parts.slice();
    } else if (Array.isArray(reply.ops)) {
      P = M.clone(P0); P.seq = P0.seq;
      reply.ops.forEach((op, i) => applyOp(P, op, errors, 'operatie ' + (i + 1)));
      if (!errors.length && reply.ops.some((op) => op && (op.op === 'setPage' || op.op === 'addPage' || op.op === 'deletePage'))) AU.retag(P);
    } else throw new Error('het antwoord bevat geen "standard", geen "project" en geen "ops"');
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
