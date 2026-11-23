# Design: „Anders geladen“ und Case-Suche im NYX-Geräte-Abgleich

Stand: 23.11.2026 · Ergänzt [2026-11-17-nyx-projektgeraete-design.md](2026-11-17-nyx-projektgeraete-design.md)

## Warum

Auf einer Konzerttour hängen die meisten Scheinwerfer fest in MLTs (Motorised Lighting Trusses)
oder sind in einem Sonderbau verbaut. Von 100 übernommenen Lampen bekommen dann z. B. nur 4
eigene Cases. Die übrigen 96 fahren mit den MLTs mit. „Nicht laden“ ist für sie falsch, denn sie
werden geladen, nur eben nicht in Cases.

Außerdem ist „Anderes Case suchen …“ heute eine Klappliste, die man alphabetisch durchscrollen muss.
Der Nutzer will z. B. „robe“ tippen und nur die passenden Cases sehen.

## Ziele

- Je Gerätetyp eine Zahl **„anders geladen“** (0 … Anzahl). Diese Geräte zählen im Abgleich als
  verladen, bekommen kein Case, und nur der Rest wird Cases zugeordnet.
- Ein Suchfeld im Case-Auswahldialog, das beim Tippen filtert.

## Nicht-Ziele

- Ort oder Notiz zu „anders geladen“ (MLT 3, Sonderbau …). Entscheidung des Nutzers: nur die Zahl.
- MLTs als Behälter-Cases, die Lampen enthalten.
- „Nicht laden“ ändert sich nicht. Es bleibt für Hausbestand und Fremdfirma.

## Anti-Ziele

- Bestehende Pläne ändern ihren Stand nicht. Ohne das Feld gilt 0.
- Kein neuer Store, nichts wird an NYX zurückgeschrieben.

## Ansätze

1. **Zahl je Typ am Plan**: `nyxAbgleich.andersGeladen = { [key]: n }`, gewählt. Das ist klein,
   liegt neben `nichtLaden`, und der Abgleich rechnet es einfach ab.
2. Platzhalter-Stücke ohne Case im Plan. Verworfen: Stücke setzen überall ein Case voraus
   (Laden, 3D, Druck, Gewicht).
3. Ein MLT als Case, das Lampen enthält. Verworfen: weit größer, und so nicht gewünscht.

## Datenmodell

`plan.nyxAbgleich.andersGeladen`: optionales Objekt `{ [nyx-key]: Ganzzahl 1…9999 }` mit höchstens
500 Schlüsseln, wobei jeder Schlüssel `nyxStr` erfüllt. Fehlt es, gilt `{}`. Ein Eintrag mit 0 wird
nicht gespeichert. Die Prüfung steht in `js/store/io.js` (`nyxAbgleichOk`).

## Rechnung (`js/model/nyxAbgleich.js`)

- `stand()`: Je Zeile kommt `anders = min(andersGeladen[key] ?? 0, anzahl)` dazu, und es gilt
  `diff = anzahl − verladen − anders`. (Meine Entscheidung: Liefert NYX weniger Geräte als
  „anders geladen“, wird auf die Anzahl gekappt. Eine Reduktion betrifft weiter nur Stücke mit Case.)
- `uebernimmGeraete()`: schreibt `andersGeladen` aus `res.andersGeladen`. Die Schlüssel werden
  über `alias` umgehängt, Werte ≤ 0 fallen weg. Für Schlüssel, die NYX nicht mehr liefert, bleibt
  der Wert unverändert erhalten.

## Dialog (`js/ui/geraete-schritt.js`, `js/ui/tabellen-import.js`)

- Zustand: `anders` (Objekt key → n, vorbelegt aus `stand`) und `andersVor` (für `geraeteAenderung`).
- Aktion `anders {key, wert}`: wert wird auf 0 … `anzahl − verladen` begrenzt (bei `diff < 0` auf
  `anzahl`). Danach wird der Bedarf neu berechnet. Zuordnungen, die über den neuen Bedarf
  hinausgehen, fallen von hinten weg. Ist der Typ „nicht laden“, hebt die Aktion das auf.
  Umgekehrt löscht „nicht laden“ den Wert von `anders`.
- Bedarf = `max(diff_live, 0)` mit `diff_live = anzahl − verladen − anders_live`.
- Rechte Spalte beim gewählten Typ: Unter dem Kopf steht immer, auch wenn alles zugeordnet ist, das
  Feld „Anders geladen (ohne Case)“ mit `<input type=number data-role="g-anders">` und einem Knopf
  „Alle“ (`data-act="g-anders-alle"`). Der Knopf setzt den Wert so, dass der Bedarf 0 wird. Ist
  `anders > 0`, steht im Kopf „· {n} anders geladen“. Bei „nicht laden“ und bei der
  Reduktionsansicht erscheint das Feld nicht.
- Links ist der Zustandstext „anders geladen“, wenn der Bedarf 0 ist und `anders > 0` ohne
  Zuordnung im Dialog. Sonst gelten die bisherigen Texte.
- `geraeteErgebnis()`: `andersGeladen: { key: n }` (nur n > 0). `geraeteAenderung()` zählt eine
  geänderte `anders`-Menge als Änderung.

## Case-Suche (`js/ui/confirmDialog.js`, `js/app/projektGeraeteImport.js`)

- `showPick(title, options, { suche: true })`: Über der Liste steht ein Suchfeld mit Fokus, die Liste
  ist offen (`<select size="10">`) statt einer Klappliste. Beim Tippen wird gefiltert: Alle Wörter
  müssen im Label vorkommen, Groß- und Kleinschreibung zählt nicht. Der erste Treffer ist gewählt.
  Enter im Suchfeld übernimmt ihn. Ohne Treffer erscheint der Hinweis „Kein Treffer.“, und OK ist
  gesperrt. Ein Doppelklick auf einen Eintrag übernimmt ihn ebenfalls.
- Die Filterfunktion `pickFilter(options, text)` ist rein und exportiert.
- Nur `sucheCase` nutzt die Suche. Das Suchfeld startet leer, und die bisherige Reihenfolge
  (Treffer zum Gerätenamen zuerst) bleibt.

## Prüfung

TDD in `tests/nyxAbgleich.test.js`, `tests/geraete-schritt.test.js`, `tests/io*.test.js` (alter
Plan ohne Feld, ungültige Werte) und ein neuer Test für `pickFilter`. Dazu kommt der Browserlauf
per `tools/cdp.mjs`.
