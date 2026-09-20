# Truckload V 0.5.0 – Cases aus „Casemaße Complete.xlsx“ übernehmen

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps mit `- [ ]`.

## Context

Der Nutzer pflegt seine Casemaße seit Jahren in einer Excel-Tabelle
(`~/Dropbox/Job/Lichtstammtisch/Licht Wiki/Tools/von Marco/Casemaße Complete.xlsx`)
und plant Ladungen dort mit einer VLOOKUP-Konstruktion. Genau diese Daten fehlen in
Truckload: Die App bringt 17 generische Vorlagen mit, der Nutzer hat aber 142 konkrete,
gemessene Cases seiner Dienstleister.

Blatt „Data Cases“, 142 Zeilen mit Typ:

| Family | Anzahl | Beispiel |
|---|---|---|
| Fixture | 66 | Mac Ultra x2 -CAB (150×60×100) |
| Rigging | 26 | D8+ 1t -BBM (80×60×60) |
| DC | 16 | Dimmer 48ch -CAB (82×60×154) |
| Rack | 12 | Rack Amp 12 HE Schieber (80×60×85) |
| Cable | 8 | Lakabaum flach -BBM (112×60×53) |
| Case | 6 | Packcase Transflex -BBM (120×60×73) |
| Desk | 5 | ChamSys MQ500 (93×66×30) |
| FOH | 3 | Gunnar Monitor -CAB (48×48×48) |

Firmen: CAB 106, BBM 22, Motion 6, RentAll 4, Jäger 2, AED 1, Kraftklub 1.

**Ziel:** Diese Cases werden einmalig in die App eingepflegt und sind dort dauerhaft
auswählbar. Ein Datei-Import zur Laufzeit ist ausdrücklich **nicht** geplant.

## Entscheidungen (vom Nutzer bestätigt)

- **Einmalige Übernahme.** Die Cases werden als mitgelieferte Daten in die App
  geschrieben, kein Excel-Import in der Oberfläche.
- **Feldbedeutung:** Spalte `Type` ist der **Name** des Cases, Spalte `Manufacturer`
  der **Hersteller des Geräts im Case** → wandert in das Feld „Inhalt“.
- **Gewerke:** Fixture + Desk → Licht, Rigging → Rigging, DC + Cable → Strom,
  Rack → Ton, FOH → Video, Case → Sonstiges.
- **Alle Cases tippbar.**
- **Gewichte:** In der Tabelle fehlen 140 von 142. Wo das Case einen bekannten
  Gerätetyp und eine Stückzahl im Namen trägt (`Mac Viper x2`, `JDC-1 x6`), wird das
  Gewicht aus recherchiertem Gerätegewicht × Stückzahl plus Case-Anteil geschätzt.
  Wo das nicht geht: **0 kg**, der Nutzer trägt nach. Gewicht ist ihm „nicht 100 %
  wichtig“.
- **Lücken:** Die sechs 19″-Racks ohne Maße werden aus der Höheneinheit gerechnet
  (1 HE = 4,45 cm). Die fünf Rigging-Zeilen ohne jedes Maß (Motorsteuerung-Koffer,
  Bolzenkoffer, FD34 x2, HOF BOLT, Dolly „Drohne“) entfallen und werden dem Nutzer
  namentlich genannt. **Ergebnis: 137 Cases.**
- **Bibliothek:** eigener Abschnitt „Cases aus deiner Liste“ unter den Vorlagen, dazu
  ein Firmenfilter.
- Version **0.5.0** überall, Tag `v0.5.0`, Deploy über GitHub Pages.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt. Reine ES-Module, Tests mit `node --test`.
- Nutzereingaben in HTML nur über `esc()` aus `js/ui/dom.js`.
- UI-Deutsch mit „…“-Anführungszeichen. Begriff „tippen“, nie „kippen“.
- `npm test` (203 grün) bleibt grün.
- Eine Versionsnummer überall (`js/version.js`), per `tests/version.test.js` erzwungen.
- Die Offline-Asset-Liste in `sw.js` muss vollständig sein (`tests/pwa.test.js`).
- Bestehende Ladepläne, Cases und die 17 vorhandenen Vorlagen bleiben unberührt.

## Architektur in einem Absatz

Die Excel-Daten werden **einmalig** außerhalb des Repos in ein Datenmodul umgewandelt
(`js/data/case-library.js`), das dieselbe Objektform liefert wie `js/data/preset-cases.js`
und über `js/store/repo.js` neben den Vorlagen geladen wird. Die Einträge sind
`builtin: true` — damit landen sie nicht im Export und überschreiben keine eigenen Cases
des Nutzers — und tragen zusätzlich `source: 'liste'` und `company`, worauf die
Bibliothek den neuen Abschnitt und den Firmenfilter aufbaut. Am Modell, am Packer und an
den Ansichten ändert sich nichts.

---

### Task 1: Datenmodul aus der Excel-Tabelle erzeugen

**Files:** `js/data/case-library.js` (neu), `js/store/repo.js`, `tests/caseLibrary.test.js` (neu)

Das Umwandlungsskript läuft **einmalig im Scratchpad** (nicht im Repo); nur das erzeugte
Modul wird eingecheckt, mit Quellenangabe im Kopfkommentar.

Abbildung je Zeile aus Blatt „Data Cases“ (Datenzeilen ab Zeile 3, Spalte F gefüllt):

| Feld | Quelle |
|---|---|
| `name` | Spalte F `Type`, getrimmt; fehlt das Firmenkürzel am Ende, wird ` -<Firma>` angehängt |
| `content` | Spalte E `Manufacturer` (leer, wenn nicht gesetzt) |
| `category` | Spalte D `Family` über die Gewerk-Abbildung oben |
| `color` | `colorFor(category)` aus `js/data/categories.js` |
| `l`, `w`, `h` | Spalten G, H, I in cm, auf 0,5 cm gerundet |
| `company` | Spalte C, normalisiert (`motion`/`Motion` → `Motion`, `RentALL`/`RentAll` → `RentAll`) |
| `id` | `lib-` + Kleinbuchstaben-Slug aus dem Namen, eindeutig |

Feste Werte je Eintrag: `builtin: true`, `source: 'liste'`, `weight: 0` (Task 2 füllt),
`tippable: true`, `stackable: true`, `maxTopLoad: null`, `stock: null`, `wheels: true`,
`wheelH: 12`, `dimsInclWheels: true`, keine `layers` (also alle vier erlaubt).
Ausnahme: Enthält der Name `no wheels`, dann `wheels: false`.

Die sechs 19″-Racks ohne Maße werden gerechnet: `h = HE × 4,45 + 14` (Deckel und Boden),
`l = 60`, `w = 60`; `16HE on wheels` zusätzlich `wheelH: 12`. Die fünf Rigging-Zeilen ohne
jedes Maß entfallen.

- `repo.js` lädt `CASE_LIBRARY` zusätzlich zu `PRESET_CASES`; Reihenfolge: eigene Cases,
  dann Vorlagen, dann Liste. Eigene Cases mit gleicher ID gewinnen wie bisher.
- Tests `tests/caseLibrary.test.js`: genau 137 Einträge; alle IDs eindeutig und mit
  `lib-` beginnend; keine ID kollidiert mit `PRESET_CASES`; jede `category` kommt in
  `CATEGORIES` vor; `l`, `w`, `h` sind endliche Zahlen > 0 und ≤ 400 bzw. ≤ 250 bzw. ≤ 250;
  jeder Eintrag besteht `checkCase` aus `js/store/io.js`; Stichproben mit exakten Werten
  (`Mac Ultra x2 -CAB` → 150×60×100, Licht, Inhalt „Martin“; `Atomic 3000 x4 no wheels -CAB`
  → `wheels: false`; `19" 6HE -CAB` → gerechnete Höhe).
- [ ] TDD, Commit `feat: 137 Cases aus der Casemaße-Tabelle als Bibliothek`

### Task 2: Gewichte recherchieren und eintragen

**Files:** `js/data/case-library.js`, `tests/caseLibrary.test.js`

Für jeden Eintrag, dessen Name einen bekannten Gerätetyp und eine Stückzahl trägt, wird
das Gewicht geschätzt: **Gerätegewicht × Stückzahl + Case-Anteil**. Der Case-Anteil wird
aus dem Volumen abgeleitet (Richtwert 40 kg je m³ Außenvolumen für Birke-Multiplex-Cases,
mindestens 15 kg). Gerätegewichte werden im Netz recherchiert (Herstellerangaben, Netto
ohne Verpackung); zu recherchieren sind unter anderem:

Martin Mac Viper / Mac Ultra / Mac Aura / Mac Axiom / Mac Quantum Wash / Atomic 3000 LED ·
Robe BMFL Spot / Robin 2500 PE Spot und Wash / Robin 100 LED Beam · GLP JDC-1 / X4 Bar 20 /
FR10 · Clay Paky Sharpy / B-Eye K10 / B-Eye K20 · Ayrton MagicBlade · ARRI SkyPanel S120 ·
Chauvet Strike Array 4 · SGM Q-7 · Astera AX5 · ETC Source Four · Robert Juliat Aramis /
Korrigan · Look Solutions Viper NT · Jem AF-1 / AF-2 / ZR44 · MDG Tourpack ·
Smoke Factory Fan Fogger / Data II / Tour Hazer II · ChamSys MagicQ MQ100 / MQ500 ·
grandMA2 full-size / light · Kettenzüge D8+ 0,25 t / 0,5 t / 1 t und D8 2 t.

Regeln:
- Gefundenes Gerätegewicht → geschätztes Case-Gewicht, auf 5 kg gerundet, und im Feld
  `content` ergänzt um ` · Gewicht geschätzt`.
- Kein belastbarer Wert gefunden → `weight: 0` bleiben lassen, nichts erfinden.
- Kabel-, Pack-, Rack- und Rigging-Cases ohne Gerätebezug bleiben bei 0 kg.
- Die zwei Zeilen mit Gewicht in der Tabelle (`FR10 x2` = 73,52 kg, `FR10 x6` = 276 kg)
  werden **unverändert** übernommen und nicht als Schätzung markiert.

Die Recherche wird in `docs/casemasse-gewichte.md` festgehalten: je Gerät der gefundene
Wert, die Quelle als URL und das daraus errechnete Case-Gewicht. Diese Datei wird
mitcommittet, damit der Nutzer die Schätzungen nachvollziehen und korrigieren kann.

- Tests: Kein Eintrag hat ein negatives Gewicht; jeder Eintrag mit Gewicht > 0 trägt
  entweder den Zusatz „Gewicht geschätzt“ oder stammt aus den zwei Originalzeilen;
  die beiden FR10-Zeilen haben exakt 73,52 und 276 kg.
- [ ] `npm test`, Commit `feat: recherchierte Gewichtsschätzungen für die Case-Bibliothek`

### Task 3: Bibliothek – eigener Abschnitt und Firmenfilter

**Files:** `js/ui/library.js`, `js/ui/load-wizard.js`, `css/app.css`

- `library.js` bekommt einen dritten Abschnitt **„Cases aus deiner Liste (N)“** unterhalb
  von „Vorlagen“. Die Aufteilung läuft über `c.source === 'liste'`; die bestehende
  Trennung „Eigene Cases“ / „Vorlagen“ bleibt unverändert.
- Neuer Firmenfilter neben dem Gewerk-Filter: `<select>` mit „Alle Firmen“ plus den in den
  Daten vorkommenden Firmen, alphabetisch. Er wirkt zusätzlich zu Suche und Gewerk und
  blendet Cases ohne `company` aus, sobald eine Firma gewählt ist.
- Die Zeile eines Listen-Cases zeigt die Firma als zusätzliche Angabe im Kleintext
  (`… · CAB`). Alles über `esc()`.
- Derselbe Abschnitt und derselbe Firmenfilter im Wizard (Schritt 2, `js/ui/load-wizard.js`),
  damit beide Listen sich gleich anfühlen.
- [ ] `node --check`, `npm test`, Commit `feat: Abschnitt und Firmenfilter für die Case-Bibliothek`

### Task 4: Version 0.5.0, Prüfung, Veröffentlichung

**Files:** `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`, `CHANGELOG.md`

- Version `0.5.0` an allen Stellen, `sw.js`-Cachename und Asset-Liste um
  `js/data/case-library.js` ergänzen, CHANGELOG-Eintrag auf Deutsch.
- README: Abschnitt „Mitgelieferte Cases“ mit Herkunft der Liste und dem Hinweis, dass
  Gewichte teils geschätzt sind.
- Browser-Prüfung mit dem CDP-Treiber im Scratchpad (siehe Verifikation).
- Merge nach `main`, Tag `v0.5.0`, push, Live-Check.
- [ ] Commit `chore: Version 0.5.0`, danach `superpowers:finishing-a-development-branch`

---

## Verifikation

**Automatisch (`npm test`):** 137 Einträge, eindeutige IDs ohne Kollision mit den
Vorlagen, gültige Gewerke, `checkCase` besteht für jeden Eintrag, Stichproben mit exakten
Maßen, Gewichtsregeln, Versions-Gleichstand, Offline-Liste.

**Im Browser (headless Chrome über `cdp.mjs`):**
1. Bibliothek: Abschnitt „Cases aus deiner Liste“ zeigt 137 Einträge; Suche nach „Viper“
   findet sowohl „Mac Viper x2 -CAB“ als auch „Look Viper NT“; Gewerk-Filter „Licht“ und
   Firmenfilter „BBM“ zusammen ergeben nur BBM-Lichtcases.
2. Wizard: ein Case aus der Liste auswählen, Stückzahl 4, Beschriftungen werden
   vorbelegt, „Fertig“ mit automatischem Packen.
3. Ein Listen-Case im Inspector prüfen: Name ist der Typ, „Inhalt“ zeigt den Hersteller,
   Maße stimmen mit der Excel-Zeile überein.
4. Ein gemischter Load aus 10 Listen-Cases wird ohne Warnung außer „einseitig“ verladen;
   Screenshots von Draufsicht, Seiten- und Rückansicht sowie 3D.
5. Druckansicht: Ladeliste enthält Hersteller in der Inhaltsspalte.
6. Export → Import in einen leeren Zustand: Die Listen-Cases sind **nicht** in der
   Exportdatei (sie sind `builtin`), die Pläne verweisen aber weiter korrekt auf sie.
