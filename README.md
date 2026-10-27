# LAZY Electrical

Gratis programma om elektrische schema's en schakelkasten te tekenen, met een ingebouwde AI-assistent die schema's voor je ontwerpt, controleert en verbetert.

## Installeren

### Optie 1: online gebruiken (aanbevolen)

Open **[LAZY Electrical](https://neidhart-romanee-conti.github.io/LAZY-electrical/)** in je browser (Chrome, Edge, Firefox of Safari).

Je hoeft niets te installeren en geen account aan te maken. Het programma draait volledig in je browser en je projecten blijven op je eigen computer.

### Optie 2: offline op je computer

1. Open de link hierboven.
2. Kies in het menu van je browser **Pagina opslaan als…** en bewaar de pagina als één bestand (kies **Webpagina, alleen HTML** als je die keuze krijgt).
3. Dubbelklik voortaan op dat bestand om het programma te openen, ook zonder internet.

Voor de PDF-export is wel een internetverbinding nodig.

### Optie 3: zelf bouwen

Je hebt [Node.js](https://nodejs.org) 20 of nieuwer nodig.

```bash
git clone https://github.com/Neidhart-Romanee-Conti/LAZY-electrical.git
cd LAZY-electrical
npm run build
```

Open daarna `dist/index.html` in je browser. Met `npm test` voer je de automatische tests uit.

## Aan de slag

1. **Voorbeeld bekijken:** **Bestand → Voorbeelden**.
2. **Zelf tekenen:** **Bestand → Nieuw project**. Klik rechts op een symbool om het te plaatsen en teken draden met **Ctrl+1** (één draad) of **Ctrl+3** (drie draden). Met de **hand (H)** schuif je over het blad.
3. **Laten ontwerpen:** open het tabblad **AI-assistent** en beschrijf je schakeling, bijvoorbeeld *"een pomp die start met een drukknop en stopt met een vlotter, met noodstop en signaallampen"*.
4. **Opslaan en afdrukken:** **Ctrl+S** bewaart het project als `.lazy.json`-bestand. De knop **PDF** maakt een PDF van alle bladen.

Alle sneltoetsen staan onder **Bestand → Help**.

## Wat kan het?

- **Schema's tekenen** met een bibliotheek van standaardsymbolen. Alles ligt op het raster en draden bewegen mee als je een symbool verplaatst.
- **Automatische nummering** van toestellen, contacten, draden, klemmen en PLC-adressen, met kruisverwijzingen.
- **Lijsten:** stuklijst, klemmenplan, kabel- en aderlijst, draadlijst, PLC-lijst en contactenlijst, ook als CSV.
- **Controle** op kortsluiting, contacten zonder spoel, dubbele tags, losse draden en meer.
- **Kastindeling** op schaal, met DIN-rails en kabelgoten.
- **Artikelen:** een basisset, aan te vullen met je eigen artikelen (CSV-import).
- **Uitvoer:** PDF (A3 of A4), SVG en CSV.

## AI-assistent

- **Ontwerpen:** beschrijf een schakeling en de assistent maakt het hele project.
- **Wijzigen:** vraag een aanpassing, zoals klemmen samenvoegen, een contact vervangen of een draad toevoegen.
- **Vragen stellen** over je schema.
- **Altijd gecontroleerd:** het programma controleert elk antwoord en laat fouten automatisch verbeteren. Elke wijziging kun je ongedaan maken.
- **Eigen regels:** voeg ontwerpregels toe die de assistent bij elk project volgt.

Je kunt de assistent op twee manieren gebruiken:

- **Met een API-sleutel:** vul je sleutel in bij **Bestand → Instellingen**. De sleutel blijft in je eigen browser.
- **Via een AI-chat:** zonder sleutel maakt het programma een opdracht die je in een AI-chat naar keuze plakt. Het antwoord plak je daarna terug in het programma.

## Licentie

[GPL-3.0](LICENSE). Siemens en LOGO! zijn handelsmerken van Siemens AG. Dit project is niet verbonden met Siemens of met een commerciële CAD-leverancier.
