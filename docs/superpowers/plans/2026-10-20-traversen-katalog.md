# Traversen-Katalog (Hersteller, Längen, Gewicht) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Im Traversen-Dialog tippt der Nutzer „FD34“, sieht die lieferbaren Längen mit Gewicht, klickt eine an, und der Wagen bekommt das Gewicht des echten Profils statt der Pauschale 6 bzw. 8 kg/m.

**Architecture:** Neue mitgelieferte Datei `data/traversen.json` (Profile je Hersteller mit Längenliste und Gewichten samt Herkunft), gelesen per JSON-Modul-Import wie `data/standard.json`. Ein neues Modell `js/model/trussCatalog.js` sucht und rechnet. Der klassische Zweig von `openTrussDialog` bekommt ein Suchfeld mit Längen-Tasten. Der Wagen-Case trägt zusätzlich die optionale Angabe `truss.profileId`, damit `findMatchingWagon` zwei Profile gleicher Breite nicht verwechselt. Alte Wagen ohne `profileId` laden unverändert. Die Pre-Rig-Traversen (MLT/S36PR) bleiben unberührt.

**Tech Stack:** Reine ES-Module, `node --test`, JSON; Python 3 (`-I`) nur im Scratchpad für den Datenbau.

**Spec:** Abgestimmt im Chat am 2026-10-20 (kein Spec-Dokument). Vorgaben des Nutzers: Eingabe „FD34“ zeigt die möglichen Längen zum Anklicken, das Gewicht kommt aus den Daten; Bezeichnung **2-Punkt / 3-Punkt / 4-Punkt** (nicht Ladder/Tri/Box); Hersteller Eurotruss, Prolyte, Global Truss; Prolyte-Gewichte als gekennzeichnete Schätzung aus dem vergleichbaren Profil; keine Sonderteile (Ecken, Bögen, Kreise); der Name der Quellseite steht nirgends im Repo.

## Global Constraints

- Keine npm-Abhängigkeiten, kein Build-Schritt, Oberfläche deutsch mit „…“-Anführungszeichen. Nutzereingaben nur über `esc()`.
- Der Name der Quellseite der Listen steht nirgends im Repo (Daten, Doku, Tests, Commits, CHANGELOG). Die Herkunft einer Zahl steht nur als `hersteller`, `berechnet` oder `geschaetzt`.
- Alte Daten müssen weiter laden: Wagen ohne `truss.profileId` bleiben gültig, ihr Gewicht und ihre Maße ändern sich nicht. Ein Regressionstest mit einem Wagen im alten Schema ist Pflicht.
- Jede neue Datei unter `js/` oder `data/` gehört in die Offline-Liste in `sw.js` (`tests/pwa.test.js` prüft das).
- Eine Versionsnummer überall; Patch-Schritt (0.17.4), vom Nutzer zu bestätigen.
- Änderungen an Datenmodell und mitgelieferten Dateien: NYX vor der Veröffentlichung benachrichtigen (Nutzer entscheidet über den Versand).
- Subagenten starten die App nicht; die Abnahme im Browser macht die Hauptsession.
- Gewicht unbekannt ist 0, nie geraten. Eine Schätzung ist erlaubt, wenn sie als `geschaetzt` mit Vergleichsprofil gekennzeichnet ist.

## Datenformat `data/traversen.json`

```json
{
  "format": "truckload-truss-catalog",
  "version": 1,
  "profiles": [
    {
      "id": "eurotruss-fd34",
      "hersteller": "Eurotruss",
      "name": "FD34",
      "punkte": 4,
      "width": 29,
      "lengths": [
        { "cm": 50, "kg": 3.3, "art": "berechnet" }
      ]
    }
  ]
}
```

`punkte` ist 2, 3 oder 4. `width` ist der Querschnitt in cm (aus den Daten, auf ganze cm gerundet). `art` je Länge: `hersteller`, `berechnet` (aus kg/m × Länge) oder `geschaetzt`; bei `geschaetzt` steht zusätzlich `"vergleich": "<Profil-ID>"`. `id` = `<hersteller-slug>-<name-slug>`, Kleinbuchstaben, `[a-z0-9-]`.

## Review Focus

- Ein Profil mit `width` über 40 cm (zwei Stück passen sonst nicht auf den 80-cm-Wagen, `MAX_TRUSS_WIDTH`): darf nicht im Katalog stehen, sonst wirft `trussDims` beim Anlegen.
- Zwei Hersteller mit gleicher Breite (FD34 und F34): Wagen mit unterschiedlichem Gewicht dürfen nicht über `findMatchingWagon` zusammenfallen.
- Eine Länge, die im Katalog fehlt (Nutzer tippt 337 cm): der Dialog darf nicht abstürzen, sondern rechnet aus dem Metergewicht des Profils und kennzeichnet es als berechnet.
- Suchtext ohne Treffer, mit Großbuchstaben, mit Leerzeichen („fd 34“), mit Sonderzeichen: kein Fehler, leere Trefferliste.
- Ein gespeicherter Wagen mit `profileId`, dessen Profil später aus dem Katalog verschwindet: lädt weiter, Gewicht bleibt.

---

### Task 1: Katalogdaten bauen (Scratchpad)

**Files:**
- Create (Scratchpad, nicht ins Repo): `<scratchpad>/traversen/bauen.py`, `<scratchpad>/traversen/traversen.json`
- Read: `<scratchpad>/hersteller/rohdaten/eurotruss.json`, `<scratchpad>/hersteller/rohdaten/global-truss.json` (Felder `name`, `l_in`, `w_in`, `h_in`, `weight_lb`), `<scratchpad>/prolyte/k.txt` (Prolyte-Katalog als Text)

**Interfaces:**
- Produces: `traversen.json` im Format oben, Profile sortiert nach Hersteller, dann Name; Längen aufsteigend.

- [ ] **Step 1: Eurotruss und Global Truss.** Aus den Rohdaten nur gerade Stücke mit Namen nach dem Muster `<Hersteller> <Typ> (Box|Tri|Ladder) <Breite> x <Länge> [<Code>]` übernehmen. Ausgeschlossen werden Namen mit `Circle`, `Corner`, `Rectangle`, `Pre-Rig`, `Mini`, `Bag`, `Tube`, `GS Box`, `ST Box`, `TT`, `XD`, `JT20` und alle Profile mit Breite über 40 cm. `punkte`: Box = 4, Tri = 3, Ladder = 2. Profil = Hersteller + Typ (z. B. `FD34`, `HD34`, `F34`, `DT34P`). Länge = größtes der drei Maße in cm (aus `l_in`), `kg` = `weight_lb` × 0,45359237 auf eine Stelle. `art`: Eurotruss `berechnet`, Global Truss `hersteller`. Doppelte Längen innerhalb eines Profils: die erste behalten, abweichende Gewichte melden.
- [ ] **Step 2: Prolyte.** Aus `k.txt` die Typen H30 (L/D/V), X30 (L/D/V), H40 (L/D/V) und S36 (V) mit ihren Standardlängen (Meter-Spalte der Tabelle „Standard available Lengths“) übernehmen: `name` = Typ + Variante (z. B. `H30V`), `punkte`: L = 2, D = 3, V = 4. `width` aus dem Datenblatt (H30 = 29, X30 = 29, H40 = 40, S36 = 36; falls ein Wert abweicht, den aus dem Katalog nehmen und melden), `art` = `geschaetzt` mit `vergleich` = ID des Profils von Eurotruss oder Global Truss mit gleicher `punkte` und gleicher gerundeter `width`, bevorzugt Eurotruss. Das Gewicht je Länge = Länge in m × Median der kg/m des Vergleichsprofils, auf eine Stelle. Gibt es kein Vergleichsprofil, erscheint die Länge mit `kg: 0` und `art: "geschaetzt"` ohne `vergleich`, und das Skript meldet es.
- [ ] **Step 3: Ausführen und melden.** Das Skript bricht ab bei doppelten Profil-IDs, `width` über 40 oder fehlendem Maß. Es gibt die Anzahl der Profile je Hersteller aus. Kontrolle: `eurotruss-fd34` hat die Längen 25, 50, 75, 100, 150, 200, 250, 300, 350, 400 cm (soweit in den Rohdaten), 4 Punkte, 29 cm; `eurotruss-fd33` hat 3 Punkte; `eurotruss-fd32` hat 2 Punkte. Der Bericht listet alle Profile mit Punkte, Breite, Längenzahl und `art` und nennt jede Abweichung von diesen Kontrollwerten.

(Kein Commit.)

### Task 2: Modell `trussCatalog.js`, Datei einfügen, Modelltests

**Files:**
- Create: `data/traversen.json` (Inhalt aus Task 1, unverändert kopiert)
- Create: `js/model/trussCatalog.js`
- Create: `tests/trussCatalog.test.js`
- Modify: `js/model/truss.js` (`findMatchingWagon`, neue Funktion `wagonWeightFor`)
- Modify: `js/store/io.js` (`checkCase`: optionales `truss.profileId`)
- Modify: `sw.js` (Offline-Liste: `data/traversen.json`, `js/model/trussCatalog.js`)
- Test: `tests/truss.test.js`, `tests/io.test.js` (Regression alter Wagen)

**Interfaces:**
- Produces in `js/model/trussCatalog.js`:
  - `export const TRUSS_CATALOG` = `{ profiles: Profile[] }` aus `data/traversen.json`
  - `export function searchProfiles(query: string): Profile[]` — Großschreibung und Leerzeichen egal, trifft auf `name` und `hersteller + name`, höchstens 12 Treffer, sortiert nach `name`; leerer Suchtext liefert `[]`
  - `export function profileById(id: string): Profile | undefined`
  - `export function pieceKg(profile: Profile, lengthCm: number): { kg: number, art: 'hersteller'|'berechnet'|'geschaetzt' }` — liegt die Länge im Katalog, deren Wert; sonst `kgPerM(profile) * lengthCm / 100` (Median der kg/m über alle Längen), Art `berechnet`; ein Profil ohne Länge mit kg > 0 liefert `{ kg: 0, art: 'geschaetzt' }`
  - `export function kgPerM(profile: Profile): number`
- Produces in `js/model/truss.js`: `export function wagonWeightFor(profile, lengthCm, count): number` = `Math.round(pieceKg(profile, lengthCm).kg * count + TRUSS_DOLLY_KG)`; `findMatchingWagon` vergleicht zusätzlich `c.truss.profileId === spec.profileId` (beide `undefined` bei alten Wagen).
- `checkCase` akzeptiert `truss.profileId` als String bis 64 Zeichen oder fehlend.

- [ ] **Step 1: Tests zuerst (rot).** `tests/trussCatalog.test.js`: `searchProfiles('fd34')` und `searchProfiles('FD 34')` liefern dasselbe, enthalten `eurotruss-fd34`, höchstens 12; `searchProfiles('')` ist `[]`; `searchProfiles('zzzz')` ist `[]`; `pieceKg(profileById('eurotruss-fd34'), 300)` liefert den Katalogwert der 300-cm-Zeile; `pieceKg` für 337 cm liefert `art: 'berechnet'` und `kg` = `kgPerM × 3,37` auf eine Stelle; kein Profil im Katalog hat `width > 40` oder doppelte ID; jedes Profil mit `art: 'geschaetzt'` hat ein `vergleich`, das als Profil existiert, oder `kg === 0`. `tests/truss.test.js`: `wagonWeightFor(profil, 300, 8)` = `Math.round(kg300 * 8 + 24)`; `findMatchingWagon` trennt zwei Wagen gleicher Breite mit verschiedener `profileId`; ein Wagen **ohne** `profileId` wird weiter von einer Spec ohne `profileId` gefunden. `tests/io.test.js`: ein Wagen im alten Schema (ohne `profileId`) besteht `checkCase` und lädt unverändert; ein Wagen mit `profileId` als Zahl wird abgelehnt.
- [ ] **Step 2: `npm test`.** Erwartet: die neuen Tests schlagen fehl.
- [ ] **Step 3: Implementieren** (Signaturen oben), `data/traversen.json` aus dem Scratchpad kopieren, `sw.js` ergänzen.
- [ ] **Step 4: `npm test`.** Erwartet: alles grün (`tests/pwa.test.js` prüft die Offline-Liste).
- [ ] **Step 5: Commit.** `feat(traversen): Katalog mit Längen und Gewichten, Modell und Prüfung` mit der Co-Author-Zeile der Sitzung.

### Task 3: Dialog „Traverse hinzufügen“

**Files:**
- Modify: `js/ui/truss-wizard.js` (klassischer Zweig, `buildWagonCaseType`)
- Modify: `css/` (nur falls nötig; vorhandene Klassen `quick-lengths`, `quick-len` wiederverwenden)
- Test: `tests/truss-wizard.test.js`

**Interfaces:**
- Consumes: `searchProfiles`, `profileById`, `pieceKg` aus `js/model/trussCatalog.js`; `wagonWeightFor`, `trussDims`, `findMatchingWagon` aus `js/model/truss.js`.
- Produces: `buildWagonCaseType(id, profileName, length, width, count, wagonW, profile?)` — mit `profile` (Katalogprofil) gilt `weight = wagonWeightFor(profile, length, count)`, `truss.profileId = profile.id`, Name `Traversenwagen <Hersteller> <Name> <Länge> m (<n> Stück)`; ohne `profile` verhält sich die Funktion exakt wie bisher.

- [ ] **Step 1: Tests zuerst (rot).** `tests/truss-wizard.test.js`: `buildWagonCaseType` mit Profil `eurotruss-fd34`, 300 cm, 8 Stück liefert `truss.profileId === 'eurotruss-fd34'`, das Gewicht `wagonWeightFor(...)`, den Namen `Traversenwagen Eurotruss FD34 3 m (8 Stück)` und besteht `checkCase`; ohne Profil: Ergebnis gleich dem Ergebnis vor der Änderung (Name `Traversenwagen 34er (F34) 3 m (8 Stück)`, Gewicht über `wagonWeight`). Dialogtest nach dem Muster der vorhandenen Tests: Eintippen von `fd34` in das neue Suchfeld zeigt die Längen-Tasten des Profils (jede mit Label `3,5 m · 23 kg`-Form), Klick auf eine Taste setzt das Längenfeld; ein Suchtext ohne Treffer zeigt `Kein Profil gefunden.`, ohne dass die Felder darunter verschwinden; die manuelle Länge funktioniert weiter.
- [ ] **Step 2: `npm test`.** Erwartet: die neuen Dialog- und Bautests schlagen fehl.
- [ ] **Step 3: Implementieren.** Im klassischen Zweig steht oben ein Suchfeld „Profil suchen (z. B. FD34)“ mit Trefferliste (Name, Hersteller, „2-Punkt“/„3-Punkt“/„4-Punkt“, Breite). Die Auswahl setzt Profil, Breite und die Längen-Tasten (Beschriftung `<Länge> · <kg> kg`, mit dem Zusatz „berechnet“ bzw. „geschätzt“ im `title`), ersetzt `QUICK_LENGTHS` für dieses Profil und zeigt unter den Tasten die Herkunft des Gewichts. Ohne Auswahl bleiben die bisherigen Profile (34er F34, 40er F44) und die bisherigen Schnelltasten unverändert. Das Gewicht des neuen Wagens kommt über `buildWagonCaseType(..., profile)`. Der Treffer-Eintrag und alle Katalogtexte laufen über `esc()`.
- [ ] **Step 4: `npm test`.** Erwartet: alles grün.
- [ ] **Step 5: Commit.** `feat(traversen): Profilsuche mit Längen und Gewicht im Dialog`.

### Task 4: Doku, NYX-Notiz, Version (Hauptsession)

**Files:**
- Modify: `docs/architektur.md` (Abschnitt „Traversenwagen“), `docs/nyx-host.md` oder neue Datei `docs/nyx-traversen.md` (Notiz zu `data/traversen.json` und `truss.profileId`), `CHANGELOG.md`, `README.md`, `js/version.js`, `package.json`, `index.html`, `sw.js` (Cache-Name, falls nicht schon in Task 2 geändert)

- [ ] **Step 1:** Abschnitt „Traversenwagen“ um den Katalog ergänzen (Dateiformat, Herkunftsarten, Suchlogik, `profileId`, Rückfall auf die Pauschale). Neue Datei `docs/nyx-traversen.md` für NYX (neue mitgelieferte Datei, kein neuer Store, optionale Case-Eigenschaft, nichts zu tun außer Kenntnisnahme und Offline-Liste prüfen). Falls Task 2 eine neue Datei unter `docs/` anlegt, gilt dasselbe wie sonst.
- [ ] **Step 2:** Version 0.17.4 an den sechs Stellen, CHANGELOG-Eintrag.
- [ ] **Step 3:** `npm test` grün, Commit `docs: Traversen-Katalog, Version 0.17.4`.

### Task 5: Abnahme im Browser (Hauptsession)

- [ ] **Step 1:** `tools/cdp.mjs`: im Lade-Assistenten „Traverse hinzufügen“ öffnen, `fd34` eintippen, Screenshot mit Trefferliste und Längen-Tasten. Erwartet: FD34 mit 4-Punkt, 29 cm, Längen mit kg.
- [ ] **Step 2:** Länge anklicken, Wagen hinzufügen, packen; Screenshot des Plans (Gewicht des Wagens steht im Inspector).
- [ ] **Step 3:** Prüfen, dass ein bestehender Plan mit altem F34-Wagen unverändert lädt (Gewicht gleich).
