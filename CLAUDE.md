# Arbeitsanweisungen für dieses Projekt

Truckload ist ein Ladeplaner für Flightcases im LKW, geschrieben für die Veranstaltungs-
branche. Diese Datei sagt, wie hier gearbeitet wird. Die fachliche Einführung steht in
[README.md](README.md), der Aufbau in [docs/architektur.md](docs/architektur.md), die
offenen Punkte in [docs/offene-punkte.md](docs/offene-punkte.md).

## Grundregeln, die nicht verhandelbar sind

- **Keine npm-Abhängigkeiten, kein Build-Schritt.** Reine ES-Module, die der Browser direkt
  lädt. `package.json` hat genau ein Skript: `npm test` (`node --test`). Three.js liegt
  vorgefertigt unter `vendor/`. Wer eine Abhängigkeit einführt, bricht das Projekt.
- **Nutzereingaben nur über `esc()`** aus `js/ui/dom.js`, wenn sie in HTML landen. In SVG
  gilt `textContent`, nie `innerHTML`. Case-Namen, Beschriftungen, Hersteller- und
  Firmennamen kommen teils aus fremden Importdateien.
- **Oberfläche auf Deutsch**, mit typografischen Anführungszeichen „…“.
- **Der Begriff heißt „tippen“, nie „kippen“.** Ein Case wird nach vorn auf die Seite
  getippt. Das ist die Sprache des Nutzers; „kippen“ bedeutet hier etwas anderes.
- **Eine einzige Versionsnummer überall.** Quelle ist `js/version.js`; `package.json`,
  `README.md`, `index.html`, der Cache-Name in `sw.js` und der oberste CHANGELOG-Eintrag
  müssen übereinstimmen. `tests/version.test.js` erzwingt das.
- **Die Offline-Asset-Liste in `sw.js` muss vollständig sein.** Jede neue Datei unter `js/`
  oder `css/` gehört dort hinein, sonst fehlt sie im Offline-Betrieb.
  `tests/pwa.test.js` prüft das.
- **Alte Daten müssen weiter laden.** Fehlende Felder bedeuten Vorgabewerte; bestehende
  Cases dürfen ihre Maße nicht unbemerkt ändern. Jede Änderung am Datenmodell braucht
  einen Regressionstest mit einem Datensatz im alten Schema.

## Ablauf

Für Planung, Entwurf, Features, Verhaltensänderungen und Fixes gilt die globale Vorgabe:
erst `superpowers:brainstorming`, dann `superpowers:writing-plans`, dann
`superpowers:subagent-driven-development`. Pläne liegen unter `docs/superpowers/plans/`,
das Design der ersten Version unter `docs/superpowers/specs/`.

Nach der Implementierung: `superpowers:finishing-a-development-branch`. Vor dem Commit die
nächste Versionsnummer vorschlagen und bestätigen lassen (siehe „Versionierung“ unten) —
danach ohne weitere Rückfrage committen, nach `main` pushen und veröffentlichen. Ohne
gepushten Stand kann der Nutzer das Ergebnis nicht ansehen, das Nachfragen vorm Push macht
also keinen Sinn (Nutzer-Feedback 2026-09-23) — nur die Versionsnummer selbst wird
abgestimmt, nicht das Veröffentlichen an sich.

## Prüfen

**Tests:** `npm test`. Reine Logik wird per TDD geschrieben — erst der fehlschlagende Test.
Die Testdateien liegen neben den Modulen, die sie prüfen (`tests/<modul>.test.js`).

**Im Browser:** Die Oberfläche wird nicht durch Lesen abgenommen, sondern gefahren. `tools/cdp.mjs`
ist ein kleiner Treiber für headless Chrome, fester Teil des Repos (keine npm-Abhängigkeit, läuft
nie im Browser der App selbst) – Szenarien legt man je nach Bedarf im Scratchpad der Sitzung an.
Ablauf:

```bash
python3 -m http.server 8766          # im Projektverzeichnis
node tools/cdp.mjs ./mein-szenario.mjs ./ausgabe
```

Erwartet Chrome unter `/Applications/Google Chrome.app/…` (macOS); ein anderer Pfad/Browser geht
über `TL_CHROME_BIN=/pfad/zu/chrome node tools/cdp.mjs …`.

Ein Szenario ist ein ES-Modul mit `export default async function (p)`. Zur Verfügung
stehen `p.goto`, `p.eval`, `p.shot`, `p.mouse`, `p.wheel`, `p.key`, `p.sleep` und
`p.logs`. Über `p.eval` lassen sich die Module der laufenden App importieren, also auch
der Store und die Aktionen — so baut man einen Zustand auf, ohne durch die Oberfläche zu
klicken.

**Fallstrick 3D:** Die Kamera rahmt auf das **Fahrzeug**, nicht auf das ausgewählte Case
(`js/ui/view3d.js`, `framedFor`). Wer ein einzelnes Teil beurteilen will, legt ein
Prüf-Fahrzeug an, das nur wenig größer ist als das Teil, und packt es dort hinein — sonst
steht die Kamera in der Laderaumwand und die Aufnahme zeigt nichts. Screenshots, auf denen
das geprüfte Teil nicht zu sehen ist, sind kein Beleg.

## Versionierung

Fast immer ein **Patch**-Schritt (z. B. 0.7.2 → 0.7.3) — auch für echte Verhaltens-
änderungen, nicht nur für Datenpflege. Minor/Major nur auf ausdrücklichen Wunsch des
Nutzers (z. B. ein Meilenstein wie V0.7.0). Vor dem Commit kurz die vorgeschlagene nächste
Nummer nennen und bestätigen lassen — danach wie unten beschrieben ohne weitere Rückfrage
committen und veröffentlichen.

Ist der zuletzt veröffentlichte Stand noch nicht live (lokale Commits, die noch nicht
gepusht wurden), zählt für den Vorschlag der **zuletzt veröffentlichte** Stand als
Grundlage, nicht der lokale HEAD — mehrere Aufgaben in einer Sitzung ergeben zusammen
genommen einen Patch-Schritt, nicht einen pro Commit.

## Veröffentlichen

Committen und nach `main` pushen ohne gesonderte Rückfrage (Versionsnummer wurde vorher
schon abgestimmt, s. „Versionierung“) — ein ungepushter Stand ist für den Nutzer nicht
einsehbar, das Nachfragen davor macht keinen Sinn (Nutzer-Feedback 2026-09-23). Nach
`git push origin main --tags` baut GitHub Pages neu. Das passiert nicht immer von allein;
falls kein Build startet:

```bash
gh api -X POST repos/m4dm0nky/Truckload/pages/builds
```

Danach warten, bis `https://m4dm0nky.github.io/Truckload/js/version.js` die neue Nummer
zeigt. Der Cache-Name in `sw.js` muss sich mit jeder Veröffentlichung ändern, sonst
behalten installierte Apps die alten Dateien.

## Haltung

Der Nutzer arbeitet in der Praxis mit diesen Zahlen. Eine erfundene, plausibel aussehende
Angabe ist schlimmer als eine fehlende — bei Gewichten, Maßen und Quellen gilt: lieber
0 oder „unbekannt“ als geraten. Recherchierte Werte gehören mit Quelle dokumentiert
(siehe `docs/casemasse-gewichte.md`). Eigene Entscheidungen werden als eigene benannt,
nie als Absprache mit dem Nutzer ausgegeben.
