# Truckload zweisprachig (Deutsch/Englisch) – Design

Stand 2026-10-27. Anlass: [Issue #42](https://github.com/M4dm0nky/Truckload/issues/42) (Aniflu, NYX).

## Warum

NYX ist zweisprachig (Deutsch, britisches Englisch). Eine NYX-**Vollversion** bietet Englisch erst
an, wenn Truckload es auch kann. Truckload soll deshalb eine englische Oberfläche bekommen. Deutsch
bleibt die Ausgangssprache und der Normalfall außerhalb von NYX.

## Entscheidungen des Nutzers (2026-10-27)

1. Truckload wird zweisprachig. Die Regel „Oberfläche auf Deutsch“ in `CLAUDE.md` wird zu
   „Oberfläche auf Deutsch und Englisch, Deutsch ist die Ausgangssprache“.
2. Die Namen der mitgelieferten Bibliothek (`data/standard.json`, `meine.json`, `traversen.json`)
   werden **nicht** übersetzt.
3. Tests: Die deutschen Tests bleiben unverändert deutsch. Für Englisch kommen eigene Tests dazu
   („kein deutsches Wort, kein roher Schlüssel“).
4. Umgesetzt wird auf Truckload-Seite (Claude), nicht von Aniflu.
5. Aniflus Glossar wird übernommen und ergänzt (unten). Aniflu sieht die Ergänzungen vor der
   Veröffentlichung durch.

## Ziele

- `?lang=en` im Start-URL ergibt eine vollständig englische Oberfläche: Bildschirme, Dialoge,
  Meldungen, Import-/Exportfehler, Prüfhinweise (Validierung), Druck, Titel/`aria-label`/Platzhalter,
  Zahlen- und Datumsformat.
- `?lang=de`, ein anderer Wert oder kein Parameter: Deutsch, genau wie heute.
- `<html lang>` wird auf die gewählte Sprache gesetzt.
- `sprachen.json` im Wurzelverzeichnis mit `["de","en"]` meldet NYX die Sprachen.

## Nicht-Ziele

- Kein Sprachumschalter in Truckload selbst und keine Auswertung von `navigator.language`
  (eigene Entscheidung: außerhalb von NYX bleibt alles wie heute; ein Umschalter kann später kommen).
- Keine Übersetzung von Nutzerdaten und Bibliotheksnamen (Case-Namen, Firmen, Hersteller,
  Plan-/Sammlungs-/Fahrzeugnamen).
- Keine Übersetzung der Dokumentation, des CHANGELOG oder von Code-Kommentaren.
- Kein Wechsel der Sprache zur Laufzeit (NYX lädt bei Sprachwechsel das Fenster neu).

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es „läuft“)

- Gespeicherte Daten ändern sich mit der Sprache: ein auf Englisch angelegter Plan lädt auf Deutsch
  anders, oder eine Sicherung enthält englische Feldwerte, die Code vergleicht.
- Deutsche Oberfläche verändert sich sichtbar (anderer Text, andere Zahlenformate).
- Gemischte Oberfläche auf Englisch (vergessene deutsche Texte) oder rohe Schlüssel sichtbar.
- Eine neue npm-Abhängigkeit oder ein Build-Schritt.
- `sprachen.json` wird veröffentlicht, bevor die Übersetzung vollständig und geprüft ist.

## Rahmen (aus `CLAUDE.md`, gilt weiter)

Keine Abhängigkeiten, kein Build; Nutzereingaben in HTML nur über `esc()`, in SVG `textContent`;
alte Daten laden weiter; vollständige Asset-Liste in `sw.js`; eine Versionsnummer; NYX-Vorgaben aus
`docs/nyx-host.md` (relative Pfade, kein Netz zur Laufzeit, keine nativen Dialoge). „tippen“, nie
„kippen“ – im Englischen „tip (onto its side)“.

## Entwurf

### Sprachmodul `js/i18n/i18n.js`

- `lang` – die aktive Sprache (`'de'` oder `'en'`), einmal beim Modulladen bestimmt: im Browser aus
  `new URLSearchParams(location.search).get('lang')`, nur `'en'` ergibt Englisch. In Node (Tests,
  kein `location`) ist es Deutsch. NYX lädt Truckload laut Issue #42 als
  `truckload://app/index.html?g=N&lang=de|en` und lädt bei Sprachwechsel das ganze Fenster neu;
  der Query-Parameter ist also der vereinbarte Weg.
- `setLang(l)` – nur für Tests (Englisch-Tests schalten um und am Ende zurück).
- `t(text, params?)` – **Der deutsche Text ist der Schlüssel** (eigene Entscheidung, Stil wie
  gettext). Beispiel: `t('„{name}“ ragt über den Laderaum hinaus.', { name: n })`. Auf Deutsch wird
  nur `{…}` ersetzt; auf Englisch wird der Text im englischen Wörterbuch nachgeschlagen und dann
  ersetzt. Fehlt ein Eintrag, kommt der deutsche Text zurück (keine rohen Schlüssel, nie ein
  Absturz); die Tests sorgen dafür, dass das nicht vorkommt.
  Begründung gegen Kennungs-Schlüssel (`warn.outOfBounds`): Der Code bleibt so lesbar wie heute,
  die rund 300 deutschen Testvergleiche bleiben unverändert gültig, und es gibt kein zweites,
  deutsches Wörterbuch, das mit dem Code auseinanderlaufen kann.
- Mehrdeutige deutsche Texte (gleicher Text, im Englischen verschieden) bekommen einen Kontext:
  `t('Lage', null, 'Stapel')` → Schlüssel `Stapel|Lage`. Nur wo nötig.
- **Immer ganze Sätze in `t()`, nie Bruchstücke** (ausnahmslos): Template-Strings wie
  `` `Sammlung: ${esc(name)}` `` werden zu `t('Sammlung: {name}', { name: esc(name) })`;
  mit `+` zusammengesetzte Sätze und deutsche Werte in Nachschlagetabellen (`{ standing: 'stehend' }`)
  ebenso – Tabellen halten dann den deutschen Text und die Anzeige geht über `t()`, oder die Tabelle
  ruft `t()` beim Zugriff. Escaping bleibt, wo es heute ist: Parameter werden vor `t()` escaped,
  `t()` selbst escaped nichts; die Texte im Wörterbuch enthalten kein Nutzer-HTML.
- Mehrzahl: Die heutigen Ternäre (`n === 1 ? 'Case' : 'Cases'`) werden zu zwei vollständigen
  `t()`-Texten je Zweig, keine Pluralregel-Engine.
- `num(v, opts)` und `date(d)` – Zahlen- und Datumsformat nach Sprache (`de-DE` bzw. `en-GB`);
  ersetzen alle `toLocaleString('de-DE')`/`toLocaleDateString('de-DE')`. Sortierungen von
  Nutzerdaten (`localeCompare(…, 'de')`) bleiben deutsch und damit in beiden Sprachen gleich
  (eigene Entscheidung). Listen übersetzter Texte (z. B. Gewerke) werden nach dem angezeigten Text
  sortiert, sofern sie heute alphabetisch sortiert sind; feste Reihenfolgen bleiben fest.
- `trade(name)` – Anzeige eines Gewerks (siehe unten).

### Wörterbuch `js/i18n/en.js`

Ein ES-Modul `export default { 'deutscher Text': 'English text', … }` (eigene Entscheidung: JS statt
JSON wie in NYX, weil es synchron lädt, in Node-Tests ohne `fetch` funktioniert und keinen
Import-Attribut-Support im Browser voraussetzt). Platzhalter `{name}` müssen in beiden Texten
gleich vorkommen. Ein deutsches Wörterbuch gibt es nicht.

### Was übersetzt wird, was nicht

| Bereich | Behandlung |
|---|---|
| Texte in `js/ui`, `js/app`, `index.html` | `t()` |
| Meldungen aus `js/model` (Validierung, Packer-Gründe, Lastgrenzen …) und `js/store` (Importfehler, Speicherfehler) | `t()` direkt an der Erzeugung; die Sprache steht beim Start fest, deshalb reicht das |
| `index.html` (statische Texte, `title`, `aria-label`, Platzhalter, `<option>`) | Elemente mit `data-t` (Text) bzw. `data-t-title`, `data-t-aria-label`, `data-t-placeholder`; beim Start ersetzt ein Durchlauf auf Englisch den Inhalt über `t()` des vorhandenen deutschen Textes |
| Druck (`js/ui/print.js`, `css/print.css`-Inhalte) | `t()`, Datum/Zahlen über `date()`/`num()`; Kopf/Fußzeile in NYX übersetzt NYX selbst |
| Gewerke (`Licht`, `Ton`, …) | Gespeicherter Wert bleibt deutsch; nur die Anzeige über `trade()` |
| Fest gespeicherte, vom Code verglichene Namen (z. B. `MEINE_NAME = 'Meine Sammlung'`, Kennungen, Format-/Store-Namen) | bleiben im Datensatz deutsch; wird so ein Name angezeigt, geht er über `t()` |
| Vom Code erzeugte Namen, die danach Nutzerdaten sind (neuer Plan, „LKW 2“, Dolly-Namen aus `dollyName`) | in der aktiven Sprache erzeugt; danach Nutzerdaten, keine Rückübersetzung. Vorher prüfen, ob irgendein Code den Namen vergleicht – dann gilt die Zeile darüber |
| Mitgelieferte Bibliothek, Fahrzeugvorlagen-Namen, Nutzerdaten | nicht übersetzt (Namen, `content`, `layers`, Firmen) |
| Wiederkehrende Standard-Hinweise mitgelieferter Datensätze (`note` bei `builtin`: „Gewicht geschätzt“, „Gewicht berechnet“, „Richtwert – Maße und Gewicht an dein Case anpassen“, „Gewicht geschätzt: leeres Rack, Standard 75 kg/m³“, `NOTE` in `preset-trucks.js`) | Daten bleiben unverändert; nur die **Anzeige** bei mitgelieferten Datensätzen schlägt den Text im Wörterbuch nach (`t(note)`); einmalige Hinweise und Hinweise eigener Cases bleiben wie gespeichert (eigene Entscheidung: das sind Bedienhinweise, kein Name, und es sind nur eine Handvoll fester Sätze) |
| `MEINE_NAME` („Meine Sammlung“) | bleibt gespeichert; Anzeige der Sammlung mit `MEINE_ID` über `t()` („My collection“). Der Abgleich in `collections.js`/`io.js` (Firmenname = Meine Sammlung) erkennt zusätzlich den englischen Namen |
| Vom Code erzeugte LKW-Namen (`'LKW 1'`, `` `LKW ${n}` `` in `js/model/lkw.js`) | in der aktiven Sprache („Truck 1“); kein Code zählt oder vergleicht diese Namen (geprüft 2026-10-27), gemischte Folgen nach Sprachwechsel sind hinnehmbar, es sind Nutzerdaten |
| Konsolen-Ausgaben, Code-Kommentare, Docs | nicht übersetzt |

Fehlertexte, die als `Error.message` aus `js/store/io.js` kommen und in der Oberfläche landen,
werden an der Erzeugung übersetzt; verschachtelte Meldungen (ein Wrapper hängt `e.message` an einen
eigenen Satz, z. B. `io.js` um Zeile 170) werden als Satz mit Platzhalter `{detail}` übersetzt.
Code, der heute auf deutsche Texte prüft (Textvergleich statt Kennung), wird beim Inventar gefunden
und **auf eine Kennung umgestellt** (`err.code` o. ä.), auch wenn das Fehlerklassen und Tests
berührt (Entscheidung, nicht nur melden). Eine Suche am 2026-10-27 fand keinen solchen Vergleich auf
`.message`; das Inventar wiederholt sie gründlich. Fehlertexte werden nirgends gespeichert; findet
das Inventar doch eine Stelle, gilt Anti-Ziel 1 und sie wird auf eine Kennung umgestellt.

### Gewerke

`js/data/categories.js` behält die deutschen Namen als gespeicherte Werte. `trade(name)` liefert die
Anzeige: `Licht → Lighting`, `Ton → Sound`, `Video → Video`, `Rigging → Rigging`, `Strom → Power`,
`Bühne → Staging`, `Backline → Backline`, `Sonderbau → Scenic`, `Sonstiges → Other`. Unbekannte
(importierte) Gewerke werden unverändert angezeigt. Auswahllisten zeigen die Übersetzung, speichern
aber den deutschen Wert.

### Glossar (verbindlich für `en.js`)

Britisches Englisch, Sentence case, Anrede „you“ (wie NYX).

Aus Aniflus Vorschlag übernommen:

| Deutsch | Englisch |
|---|---|
| Ladeplan / Load | Load plan |
| Case | Case |
| Fahrzeug, LKW | Truck |
| Sammlung | Collection |
| Regelset | Rule set |
| Material, Bibliothek | Stock, Library |
| Sichern / Importieren | Back up / Import |
| Ladefläche, Laderaum | Load space |
| tippen (auf die Seite) | tip (onto its side) |
| stapelbar | Stackable |
| Traverse, Traversenwagen | Truss, truss dolly |

Ergänzt (eigene Entscheidung, Aniflu sieht durch):

| Deutsch | Englisch | Hinweis |
|---|---|---|
| Gewerk | Department | Branchenüblich (lighting department …) |
| Bestand | Quantity in stock | „Stock“ ist schon „Material“ |
| Nutzlast | Payload | |
| Achslast | Axle load | |
| Auflast / max. Auflast | Load on top / max. load on top | |
| Lage (Stapelebene) | Layer | |
| Radkasten | Wheel arch | britisch |
| Rest einpacken | Pack the rest | |
| Alles neu packen | Repack all | |
| Truck entladen | Unload truck | |
| Noch nicht geladen | Not loaded yet | |
| Pack-Regeln | Packing rules | |
| Ladereihenfolge | Loading order | |
| Mitgeführt (Kopie im Plan) | Carried in plan | Gesperrte Kopie bis zur Übernahme |
| Übernehmen | Adopt into library | im Zusammenhang „mitgeführt“ |
| Lade-Assistent | Load wizard | |
| Traversen-Assistent | Truss wizard | |
| Pre-Rig-Traverse | Pre-rig truss | |
| Dolly | Dolly | |
| Hersteller / Firma | Manufacturer / Company | |
| Projekt-Regelset | Project rule set | |
| Sicherung | Backup | |
| Packliste / Checkliste | Packing list / Checklist | |

Weitere Begriffe, die beim Übersetzen auftauchen, kommen in diese Tabelle (Spec mitpflegen), damit
derselbe deutsche Begriff überall gleich übersetzt wird.

### `sprachen.json` und Veröffentlichung in zwei Stufen

`["de","en"]` im Wurzelverzeichnis, Eintrag in der Asset-Liste von `sw.js`.

Eigene Entscheidung, damit die englischen Texte gegengelesen werden, ohne dass NYX zu früh freischaltet:

1. **Stufe 1:** Übersetzung komplett, alle Tests und die Browser-Abnahme grün, veröffentlicht
   **ohne** `sprachen.json`. NYX bleibt bei „nur Deutsch“, nichts ändert sich für Nutzer.
   Im Issue #42 bekommt Aniflu den Hinweis zum Gegenlesen (`?lang=en` auf GitHub Pages, `en.js`,
   Glossar-Ergänzungen). Claude übersetzt; die Tests prüfen Vollständigkeit, Aniflu die Sprache.
2. **Stufe 2:** Korrekturen aus dem Gegenlesen einarbeiten, dann `sprachen.json` anlegen und
   veröffentlichen. Das ist ein eigener Patch-Schritt.

## Prüfung

Messbar, nicht per Augenschein. Jede dieser Prüfungen wird einmal mit einem absichtlich eingebauten
Fehler rot gezeigt.

1. **Deutsche Tests** laufen unverändert (`npm test`). Ein deutscher Test, der sich wegen der
   Umstellung ändern müsste, ist ein Hinweis auf einen Fehler, nicht auf einen veralteten Test.
2. **Wörterbuch vollständig** (`tests/i18n.test.js`): Ein Test liest alle Quelldateien unter `js/`
   und `index.html`, sammelt jedes `t('…')`-Literal (erstes Argument muss ein einfaches
   String-Literal sein – ein Test verbietet `t(variable)` und `t(`…${x}…`)` außerhalb einer kleinen
   Erlaubnisliste für Datennachschlag wie `t(note)`, `trade()`) und jeden `data-t`-Text und verlangt
   einen Eintrag in `en.js` mit denselben Platzhaltern. Umgekehrt: kein verwaister Eintrag in `en.js`.
3. **Kein deutscher Text außerhalb von `t()`**: Ein Test sucht in `js/ui`, `js/app`, `js/model`,
   `js/store` nach String- **und Template-Literalen** (auch den festen Teilen eines Templates) mit
   deutschen Merkmalen (Umlaute, ß, „“, häufige deutsche Wörter), die nicht erstes Argument von
   `t()` sind und nicht Kommentar sind. Ausnahmen (gespeicherte Werte wie Gewerke, `MEINE_NAME`,
   Konsolentexte) stehen in einer kurzen, begründeten Erlaubnisliste. Texte aus CSS (`content:`)
   werden einmal per Suche geprüft; gibt es welche, wandern sie in JS/HTML.
4. **Englische Ausgabe**: Tests für die reinen Funktionen mit Meldungen (Validierung, Import,
   Packer-Gründe, Druck-HTML) laufen mit `setLang('en')` und prüfen: kein deutsches Merkmal, kein
   `{platzhalter}` übrig.
5. **Gespeicherte Daten sprachfrei**: Plan auf Englisch anlegen und exportieren, Datei auf Deutsch
   importieren – identisch; Gewerk bleibt `Licht`. Dazu ein Regressionstest mit einer Sicherung im
   alten Schema, die auf Englisch geladen wird.
6. **Browser-Abnahme** mit `tools/cdp.mjs`: `index.html?lang=en` – Startbildschirm, Planansicht,
   Material, Lade-Assistent, Traversen-Assistent, Pack-Regeln, Inspector, Druckvorschau, ein
   Importfehler. Der DOM-Text aller sichtbaren Elemente wird auf deutsche Merkmale geprüft
   (Nutzerdaten und Bibliotheksnamen ausgenommen); Screenshots als Beleg. Dasselbe ohne Parameter:
   Deutsch wie vorher, Screenshots stichprobenartig gegen den alten Stand.
7. `tests/pwa.test.js` und `tests/version.test.js` grün (neue Dateien in `sw.js`, Version überall).

## Was dem Umsetzer überlassen ist

- Reihenfolge der Dateien und Aufteilung in Aufgaben (Plan).
- Genaue Liste deutscher Merkmale für Test 3 und Test 6, solange sie ohne Falschalarm auf der
  heutigen deutschen Oberfläche anschlägt und auf der englischen schweigt.
- Englische Formulierungen im Rahmen des Glossars.
- Ob `data-t` die vorhandenen deutschen Texte in `index.html` als Schlüssel nimmt (Vorgabe) oder sie
  ausdrücklich als Attributwert trägt.

## Abschluss

- `CLAUDE.md`: Regel „Oberfläche auf Deutsch“ erweitern; neue Regel „Neue Texte nur über `t()`,
  englischer Eintrag in `js/i18n/en.js` gehört dazu“.
- `docs/architektur.md` und `docs/nyx-host.md`: Abschnitt Sprache (`lang`, `sprachen.json`).
- Version: je Stufe ein Patch-Schritt, vorher mit dem Nutzer abstimmen. Vor jeder Veröffentlichung
  NYX im Issue #42 Bescheid geben (Stufe 1: Gegenlesen; Stufe 2: `sprachen.json` kommt).
