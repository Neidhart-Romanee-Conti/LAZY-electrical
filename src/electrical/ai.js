/* LAZY Electrical AI assistant core (no DOM): the prompt, reading Claude's answer, applying it to the project,
   and the check-and-retry loop. The app supplies an ask(prompt) function (claude.ai, own API key, or copy-paste).
   The AI designs with descriptions (standard projects, page descriptions in auto.js) that the layout engine draws, and
   changes an existing drawing with edit operations (ops.js), addressed by tag, terminal or grid point. */
var LE = typeof LE !== 'undefined' ? LE : {};
LE.ai = (function () {
  'use strict';
  const M = LE.model, SY = LE.symbols, AU = LE.auto, CK = LE.checks, OP = LE.ops;

  function catalog() {
    const rows = [];
    SY.CATS.forEach((cat) => {
      rows.push('# ' + cat);
      SY.list().filter((s) => s.cat === cat).forEach((s) => {
        const poles = AU.LOAD_POLES[s.id] || s.poles || 1;
        const role = s.role === 'slave' ? 'contact van een spoel/toestel (tag = tag van dat toestel)' : s.role === 'terminal' ? 'klem (tag = klemmenstrook, bv. X1; "no" = klemnummer)' : s.role === 'ref' ? 'draadverwijzing (eindelement, "name")' : s.end ? 'eindtoestel' : AU.isOut({ s: s.id }) ? 'uitgang (laatste element van een reeks)' : 'toestel';
        rows.push('- ' + s.id + ': ' + s.name + ' — ' + role + (poles > 1 ? ', ' + poles + ' polen' : '') + (s.letter ? ', letter ' + s.letter : '') + ' [' + s.pins.map((p) => p.x + ',' + p.y).join(' ') + ']');
      });
    });
    return rows.join('\n');
  }

  const FORMAT = [
    'Je bent de AI-assistent van LAZY Electrical, een elektrisch CAD-programma voor stroomschema\'s van schakelkasten (IEC 60617, tags volgens IEC 81346).',
    'Een nieuw ontwerp teken je niet zelf: je beschrijft WAT er in de installatie zit en het programma maakt daar de standaard bladenset van. Een bestaande tekening pas je precies aan met bewerkingen (vorm B).',
    'De standaard bladenset:',
    '  1 Voedingsblad (hoofdautomaat, automaten, 24V-voeding) · 2 Stuurschakeling · 3 Ingangen · 4 Uitgangen (met PLC) · 5 Vermogenblad per motor.',
    'Het programma voegt zelf toe: noodstopkring met lijncontactor, interfacerelais per PLC-uitgang, vergrendelingen bij omkeer en ster-driehoek, X-klemmen, thermische relais, contactnummers, tags per blad en kolom en kruisverwijzingen. Het controleert alles; fouten krijg je terug om te verbeteren.',
    '',
    'ANTWOORD met ALLEEN één JSON-object (geen tekst ervoor of erna, geen commentaar), in één van deze vormen:',
    '  A. { "standard": standaardproject, "_uitleg": "2-4 korte zinnen in het Nederlands" }   een nieuw ontwerp, of een wijziging van WAT er in de installatie zit (motoren, ingangen, uitgangen, sporen): geef dan het VOLLEDIGE aangepaste standaardproject terug.',
    '  B. { "ops": [bewerking, ...], "_uitleg": "..." }   een wijziging AAN DE TEKENING: klemmen samenvoegen of hernummeren, tags, omschrijvingen, een contact of symbool vervangen, iets verplaatsen, verwijderen, een draad of symbool toevoegen, een blad aanpassen. Werkt voor ELK project. Bij een standaardproject onthoudt het programma de bewerkingen (in "edits") en voert ze opnieuw uit als het project opnieuw wordt opgebouwd.',
    '  C. { "project": ... }   de vrije vorm (zie onderaan), alleen als A en B niet passen.',
    'Kies de kleinste vorm die de vraag volledig uitvoert. Zeg NOOIT dat iets niet kan zolang het met bewerkingen (B) te tekenen is.',
    '',
    'STANDAARDPROJECT:',
    '{ "info": {"name": "korte projectnaam", "desc1": "omschrijving"},',
    '  "plc": "0BA5" | "24CE" | "24RCE" | "1224RCE" | "none",   (LOGO! 24 0BA5 / 24CE: transistoruitgangen; "none" = bedrade sturing zonder PLC)',
    '  "estop": true | false,   (noodstop aanwezig)',
    '  "mainBreaker": "C20A", "b24": "C6A", "b230": "C10A",   (hoofdautomaat 4P, automaat 24V-voeding, automaat stuurstroom 230V)',
    '  "terminalStrip": "X1",   (optioneel) ALLE klemmen op deze ene klemmenstrook, doorlopend genummerd 1, 2, 3 … in bladvolgorde. Zonder: X1 voeding, X2 bediening/sensoren, X3… per motor.',
    '  "edits": [bewerking, ...],   (optioneel) bewerkingen die na het opbouwen worden uitgevoerd. Neem de "edits" van het huidige standaardproject over zolang ze nog kloppen.',
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
    '%OPS%',
    '',
    'VRIJE VORM (alleen als het standaardformaat niet past): { "project": { "info": {...}, "cover": false, "pages": [ blad, ... ] }, "_uitleg": "..." }',
    '  blad = { "title": "...", "top": ["1L1"], "mid": [...], "bottom": ["1N"], "paths": [pad, ...] }',
    '  1-polig pad: { "from": "1L1", "to": "1N" (of "out": "NAAM" = doorverwijspijl), "chain": [ {"s": "<symbool-id>", "tag": "S1", "desc": "START"}, {"par": [[...],[...]]}, ... ] }',
    '  meerpolig pad: { "from": ["L1","L2","L3"], "to": [...] of "out": [...], "pe": "PE", "chain": [ ... ] }; motorstarters: { "macro": "dol"|"rev"|"yd", "from": [...], "pe": "PE", "breaker": false, "pre": [...], "ol": {...}, "term": {...}, "motor": {...} }',
    '  symbolen:',
    '%CATALOG%'
  ].join('\n');

  const OPS = [
    'BEWERKINGEN (vorm B), in volgorde uitgevoerd; een mislukte bewerking verandert niets en je krijgt de fout terug.',
    'Symbolen kiezen ("keuze"): "tag": "2K3" (alle symbolen van dat toestel, ook zijn contacten) | "term": "X2:5" (één klem) | "page": "3" + "at": [x, y] (het symbool met een aansluiting of invoegpunt op dat punt). "only": "<symbool-id>" houdt alleen dat symbool over (bv. alleen het NC-contact van 2K3); "page" beperkt tot één blad.',
    'Toestellen en teksten:',
    '  { "op": "set", keuze, "desc": "...", "desc2": "...", "part": "...", "maker": "...", "addr": "I3", "name": "...", "no": "7", "strip": "X1", "s": "<ander symbool-id>", "pins": ["13","14"] | null, "lock": true }   (null wist een veld; "no"/"strip" alleen voor klemmen; "s" vervangt het symbool op dezelfde plaats, bv. no → nc)',
    '  { "op": "renameDevice", "from": "2K3", "to": "2K4" } · { "op": "renumberDevices" } · { "op": "replaceText", "find": "POMP", "replace": "POMP 1" }',
    '  { "op": "delete", keuze }   verwijdert symbolen; een contact in een rechte draad wordt overbrugd ("heal": false om de draad open te laten)',
    'Klemmen:',
    '  { "op": "mergeStrips", "from": ["X2","X3"], "into": "X1" }   klemmen van die stroken naar "into", daarna doorlopend genummerd 1, 2, 3 … (bladvolgorde, links naar rechts). Zonder "from": alle stroken.',
    '  { "op": "renumberTerminals", "strip": "X1" }   (zonder "strip": elke strook)',
    'Bladen:',
    '  { "op": "setPage", "page": "3", "spec": blad } (blad opnieuw opbouwen in de vrije vorm) · { "op": "addPage", "after": "3", "spec": blad } · { "op": "deletePage", "page": "4" }',
    '  { "op": "pageProps", "page": "2", "title": "...", "fn": "...", "loc": "..." } · { "op": "movePage", "page": "5", "after": "2" | "begin" } · { "op": "renumberPages" }',
    '  { "op": "setInfo", "info": {"name": "...", "desc1": "...", "customer": "...", "author": "..."} } · { "op": "setSettings", "settings": {"tagMode": "pagecol" | "consecutive" | "pagecons", "wireNo": "seq" | "pagecol" | "none", "template": "A4" | "A3"} }',
    'Met de hand tekenen (rastereenheden, gehele getallen; de huidige coördinaten staan onder TEKENING; de pinnen per symbool staan in de catalogus als [x,y ...] bij r=0):',
    '  { "op": "place", "page": "2", "s": "<symbool-id>", "at": [x, y], "r": 0 | 90 | 180 | 270, "mirror": false, "tag": "S5", "desc": "...", "desc2": "...", "no": "3", "addr": "I5", "name": "..." }   eerste pin op "at". Op een bestaande draad wordt de draad aan de pinnen geknipt (contact tussenvoegen).',
    '  { "op": "wire", "page": "2", "pts": [[x,y], [x,y], ...] }   alleen horizontaal/verticaal. Verbindt alleen met zijn eindpunten of hoeken: op een pin, op een potentiaal of op een andere draad (T-splitsing). Kruisende draden zijn niet verbonden. Evenwijdige draden minstens 1 raster uit elkaar.',
    '  { "op": "deleteWire", "page": "2", "at": [x, y] }   de draad door dat punt · { "op": "wireNo", "page": "2", "at": [x, y], "no": "12" }   vast draadnummer',
    '  { "op": "move", keuze, "by": [dx, dy] } (draden volgen) · { "op": "rotate", keuze } · { "op": "mirror", keuze }',
    '  { "op": "pot", "page": "2", "name": "24V", "y": 5 } · { "op": "deletePot", "page": "2", "name": "24V" } · { "op": "text", "page": "2", "at": [x, y], "text": "..." } · { "op": "cable", "page": "5", "from": [x, y], "to": [x, y], "tag": "W1", "type": "4G1,5" }'
  ].join('\\n');

  function example() {
    const ex = (id) => (LE.examples || []).find((e) => e.id === id);
    const a = ex('std_rev'), b = ex('std_dol');
    return (a ? 'VOORBEELD 1 — "loopband links/rechts met LOGO!, noodstop, start rechts, start links, stop, thermische beveiliging":\n' + JSON.stringify({ standard: a.standard, _uitleg: 'Omkeerschakeling met LOGO! 24: vijf ingangen, twee uitgangen naar de contactoren rechts en links.' }) + '\n\n' : '') +
      (b ? 'VOORBEELD 2 — "loopband direct starten zonder PLC, met noodstop, lampen aan/uit en een bewegingsmelder met lamp":\n' + JSON.stringify({ standard: b.standard, _uitleg: 'Bedrade start/stop met houdcontact en signaallampen.' }) : '');
  }
  function specText() { return FORMAT.replace('%OPS%', () => OPS).replace('%CATALOG%', () => catalog()); }

  /* the current project as the AI sees it: its description (standard project or page descriptions), the drawing
     itself with grid coordinates (for edit operations) and the open errors */
  function projectText(P) {
    if (!P || !P.pages.some((p) => p.kind !== 'cover')) return '(leeg project)';
    const std = P.standard || P.school; // projects saved before the rename keep their description under "school"
    const out = [];
    if (std) {
      const hand = P.pages.filter((p) => p.edited).map(M.pageLabel);
      out.push('STANDAARDPROJECT: ' + JSON.stringify(std) + (hand.length ? '\nLET OP: blad ' + hand.join(', ') + ' werd met de hand aangepast; een nieuw standaardproject tekent alles opnieuw (bewerkingen in "edits" blijven).' : ''));
    } else out.push('BLADBESCHRIJVINGEN: ' + JSON.stringify(AU.projectSpec(P)));
    out.push('TEKENING (symbool tag "omschrijving" @invoegpunt | pin(x,y) ...):\n' + OP.describe(P));
    const ck = CK.run(P), errs = ck.filter((c) => c.level === 'error').map((c) => c.msg), warns = ck.filter((c) => c.level === 'warn').map((c) => c.msg);
    if (errs.length) out.push('OPEN FOUTEN: ' + errs.slice(0, 15).join(' | '));
    if (warns.length) out.push('WAARSCHUWINGEN: ' + warns.slice(0, 15).join(' | '));
    return out.join('\n\n');
  }
  function buildPrompt(o) {
    const parts = [specText(), example()];
    if (o.rules && o.rules.length) parts.push('EXTRA ONTWERPREGELS VAN DE GEBRUIKER (altijd volgen, ze gaan voor):\n- ' + o.rules.join('\n- '));
    parts.push('HUIDIG PROJECT:\n' + projectText(o.P));
    if (o.mode === 'ask') parts.push('De gebruiker stelt een vraag over het schema. Antwoord dan met { "answer": "je antwoord in het Nederlands" } en verander niets (tenzij de gebruiker uitdrukkelijk om een wijziging vraagt; antwoord dan zoals hierboven, met vorm A, B of C).');
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
    if (reply.answer && !reply.ops && !reply.project && !reply.standard) return { P: P0, errors: [], checks: [], uitleg, answer: String(reply.answer), changed: false };
    const errors = [];
    let P;
    const spec = reply.project || (Array.isArray(reply.pages) ? reply : null);
    const std = reply.standard || reply.school; // "school" is the key's old name; still accepted
    const old = P0 && (P0.standard || P0.school);
    if (std) {
      const sp = Object.assign({}, std, { info: Object.assign({}, (P0 && P0.info) || {}, std.info || {}) });
      /* edits made earlier stay unless the answer sets "edits" itself; ops next to a standard project are added to them */
      if (!('edits' in std) && old && Array.isArray(old.edits) && old.edits.length) sp.edits = old.edits.slice();
      if (Array.isArray(reply.ops) && reply.ops.length) sp.edits = (Array.isArray(sp.edits) ? sp.edits : []).concat(reply.ops);
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
      if (!P0) throw new Error('er is nog geen project om te bewerken');
      P = M.clone(P0);
      const done = OP.apply(P, reply.ops, errors);
      /* a standard project remembers the edits, so they survive when it is rebuilt from its description */
      const sp = P.standard || P.school;
      if (sp && done.length) sp.edits = (Array.isArray(sp.edits) ? sp.edits : []).concat(done);
    } else throw new Error('het antwoord bevat geen "standard", geen "project" en geen "ops"');
    const checks = CK.run(P);
    return { P, errors, checks, uitleg, changed: true };
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
        (shouldFix(res).length ? '\nWAARSCHUWINGEN (verbeter als het kan):\n- ' + shouldFix(res).slice(0, 10).join('\n- ') : '') + '\n\nCorrigeer ze en antwoord opnieuw met het volledige JSON-object (dezelfde vorm; bewerkingen worden opnieuw op het oorspronkelijke project uitgevoerd, geef dus de VOLLEDIGE lijst).';
    }
    return last;
  }

  return { buildPrompt, parse, apply, run, catalog, specText, mustFix };
})();
if (typeof module !== 'undefined') module.exports = LE;
