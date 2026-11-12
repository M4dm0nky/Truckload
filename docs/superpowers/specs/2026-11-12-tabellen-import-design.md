# Tabellen-Import: Ladeliste aus Excel/CSV

Stand 2026-11-12. Entwurf aus dem Brainstorming mit dem Nutzer. Was der Nutzer entschieden hat, steht
ohne Zusatz; **eigene Entscheidung** markiert, was Claude festgelegt hat (änderbar).

## Wozu

Wer nur den LKW lädt, aber sonst nichts mit den Cases zu tun hat (Produktionsleitung, Tour-Logistik),
bekommt von den Gewerken Listen: „Licht hat 60 Kisten“, eine Tourproduktion liefert 350 Kisten nach
Gewerk oder Farbe sortiert. Diese Leute sollen nicht erst eine Case-Datenbank pflegen. Sie geben eine
von uns vorgegebene Tabelle aus, bekommen sie ausgefüllt zurück, importieren sie und laden.

Die eigene Case-Datenbank (Materialbestand) bleibt für den, der selbst lädt. Der Tabellen-Import
schaut **nicht** in die Datenbank und schreibt nicht hinein. Grund (Nutzer): sonst wird es ein
„Kuddelmuddel“ aus gleichen Namen, abweichenden Maßen und Überlagerungen.

## Ziele

- Vorlage mit vier Reitern (Cases, Traversen, Boxen, Set) als Excel-Datei zum Download aus der App.
- Import von `.xlsx` und von CSV (auch mehrere CSV-Dateien auf einmal, je Reiter eine).
- Übersicht „Das habe ich gefunden“ (Entwurf A), dann Schritte: Liste → Prüfen → Traversen → Boxen →
  Set → LKWs.
- Jede Zeile wird ein **neues, projekteigenes Case**, im Ladeplan bearbeitbar.
- LKW-Zuordnung je Gewerk, inklusive „so wenige LKWs wie möglich“.
- Farbe ist **nur Optik**: Sie unterscheidet die Cases beim Laden in 2D/3D, auf den Aufklebern und in
  den Drucklisten, gerade wenn Gewerke gemischt geladen werden. Sie steuert **keine** Zuordnung.

## Nicht-Ziele

- Kein Abgleich mit der Bibliothek, kein „ist das dasselbe Case wie …“.
- Traversenwagen und Lautsprecher-Dollys werden **nicht** automatisch aus der Tabelle gebaut
  (Nutzer: „glaube nicht, dass man das fehlerfrei kann“). Die Tabelle liefert nur Hinweise.
- Keine eigene Google-Tabelle von uns. Google-Nutzer öffnen die Excel-Vorlage in Google Sheets und
  exportieren CSV; ein Hilfetext erklärt das.
- Kein Export zurück in die Tabelle (nicht besprochen).

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Ein Import ändert still Cases der eigenen Datenbank oder legt dort etwas an.
- Unklare Zeilen werden geraten statt angezeigt (fehlende Höhe → Fantasiewert). Projektregel: lieber
  0/„unbekannt“ als erfunden.
- Bei 350 Kisten muss man sich durch 350 Rückfragen klicken. Die Übersicht fasst zusammen, Korrektur
  läuft in einer Liste.
- Was nicht geladen werden konnte, verschwindet ohne Meldung.

## Rahmen (Projektregeln, nicht verhandelbar)

Keine npm-Abhängigkeit, kein Build. Nutzereingaben nur über `esc()` bzw. `textContent` (die Tabelle
ist fremde Eingabe!). Alle Texte über `t()` mit englischem Eintrag. Neue Dateien in `sw.js`-`ASSETS`.
Alte Daten laden weiter. Läuft auch in NYX (kein Netz zur Laufzeit, keine nativen Dialoge, Speicher
nur über `js/store/db.js`). Änderungen, die NYX betreffen, kommen als `docs/nyx-tabellenimport.md`
ins Repo; der NYX-Admin setzt sie um (Nutzer). Kein neuer Store vorgesehen.

## Die Vorlage

Eine Datei `Truckload-Ladeliste.xlsx` (Name: eigene Entscheidung), ausgeliefert unter `data/` und
offline verfügbar, Download-Knopf neben dem Import. Vier Reiter; die erste Zeile jedes Reiters ist
die Kopfzeile, an der der Import den Reiter erkennt (auch bei CSV). Jede Kopfzelle trägt einen
eindeutigen Schlüssel, z. B. „Höhe inkl. Rollen (cm)“; der Import erkennt die deutschen und die
englischen Kopfzeilen. Eine Hinweiszeile/Notiz in der Vorlage sagt: **Höhe immer inklusive Rollen,
so wie das Case auf den Rollen steht.** Rollengröße wird nicht abgefragt.

Auswahllisten (Datenüberprüfung) für Gewerk, Farbe, Ja/Nein, höchste Lage, damit nicht „orange“,
„Orange“ und „orang“ ankommen. Der Import akzeptiert trotzdem Groß/Klein und führende/folgende
Leerzeichen.

### Reiter 1: Cases

| Spalte | Pflicht | Bedeutung im Import |
|---|---|---|
| Name | ja | Case-Name (≤ `NAME_MAX`). |
| Menge | nein | Anzahl Stücke. Eine Zeile = **ein** Case-Typ mit Menge Stücken (auch beim Set). Leer → 1, als gelb markiert (**eigene Entscheidung**). |
| Breite (cm), Tiefe (cm), Höhe inkl. Rollen (cm) | ja | Außenmaße im Stehen. Fehlt eins → rot, Zeile wird nicht übernommen, bis korrigiert. |
| Rollen (ja/nein) | nein | `wheels`; Maß gilt immer inkl. Rollen (`dimsInclWheels: true`). Leer → ja. |
| Gewicht (kg) | nein | je Stück; leer → 0 = unbekannt. |
| Höchste Lage (1/2/3) | nein | 1 → `layers [1]`, 2 → `[1,2]`, 3 → `[1,2,3]`. Leer → `[1,2]` wie die Wizard-Vorgabe (**eigene Entscheidung**), gelb. |
| Tippen (Häkchen) | nein | Angehakt → das Stück **wird getippt** geladen (`tipped: true`, Case `tippable: true`). Leer → steht genau wie angegeben (`tipped: false`). |
| Gewerk | nein | `category`. Liste aus `CATEGORIES`; freie Namen sind erlaubt (gelb, „unbekanntes Gewerk“). Leer → „Sonstiges“. |
| Farbe | nein | Benannte Farben aus einer festen Liste (Orange, Blau, …), im Import auf `#rrggbb` abgebildet (Case-Feld `color`). Nur Optik: 2D, 3D, Aufkleber, Druck. Leer → Gewerkfarbe. |

**Keine LKW-Spalte.** Der Nutzer hat sie verworfen: Welche Kiste in welchen LKW kommt, entscheidet
der Schritt „LKWs“, nicht die Liste.

### Reiter 2: Traversen, Reiter 3: Boxen

Freie Hinweisspalten, z. B. Traversen: Profil, Länge, Stückzahl, Gewerk; Boxen: Typ, Anzahl,
Gewerk. Der Import baut daraus **nichts**, sondern zeigt die Zeilen im jeweiligen Schritt als
Merkliste neben dem Bau-Dialog. Genaue Spalten: dem Bauenden überlassen.

### Reiter 4: Set

Bühnenteile/Kulissen, die sich in den Maßen deutlich von Cases unterscheiden. Spalten: Name, Menge,
Breite, Tiefe, Höhe, Gewicht, Höchste Lage, Gewerk, Farbe. Keine Rollen, nie getippt
(**eigene Entscheidung**). Wird wie ein Case automatisch erzeugt, aber in 2D **und** 3D als
**schlichter Kasten** dargestellt, ohne Case-Optik (keine Rollen, Kanten, Griffe); in 3D so wie in 2D.

## Dateien lesen

- **xlsx** ist ein ZIP mit XML. Entpacken ohne Bibliothek über `DecompressionStream('deflate-raw')`,
  dann `xl/workbook.xml`, `xl/sharedStrings.xml`, `xl/worksheets/sheetN.xml` lesen. Zahlen, Text,
  geteilte Strings, Wahrheitswerte; Formeln werden mit ihrem zwischengespeicherten Wert gelesen.
- **CSV:** Trennzeichen `;` oder `,` automatisch (deutsches Excel schreibt `;`), Anführungszeichen,
  Zeilenumbrüche in Feldern, UTF-8 mit/ohne BOM, Dezimalkomma und -punkt.
- **Mehrere Dateien** auf einmal im Dateiauswahl-Dialog; jede wird per Kopfzeile einem Reiter
  zugeordnet. Zwei Dateien für denselben Reiter → Meldung, nicht still zusammenführen.
- Die Auswertung (Zellen → Zeilen → Case-Entwürfe mit Befunden) ist reine Logik unter `js/model/`
  bzw. `js/store/` und mit `node --test` prüfbar. Grenzen gegen Missbrauch (Dateigröße, Zeilenzahl):
  dem Bauenden überlassen, aber vorhanden.
- Leere Zeilen werden übersprungen. Zeilennummern der Tabelle bleiben für Meldungen erhalten.

### Hilfe „?“

Neben dem Import-Knopf ein kleines Fragezeichen. Es erklärt (in der App, kein Netz):
Vorlage herunterladen → ausfüllen → in Excel speichern **oder** in Google Sheets: Datei → Importieren
der Vorlage, ausfüllen, dann **je Reiter** Datei → Herunterladen → CSV. Google exportiert nur den
gerade offenen Reiter, also bis zu vier CSV-Dateien, alle zusammen auswählen. Höhe inklusive Rollen.
Kopfzeile nicht ändern.

## Ablauf

Einstieg: Knopf „Tabelle importieren“ (mit „?“ und „Vorlage herunterladen“) auf dem Startbildschirm
und im Plan (**eigene Entscheidung**, wo genau: dem Bauenden überlassen). Der Ablauf ist ein Dialog
mit Schritten; wird ein Reiter nicht geliefert, entfällt sein Schritt.

### 1. Übersicht „Das habe ich gefunden“ (Entwurf A, vom Nutzer so abgenommen)

Mockup: `.superpowers/brainstorm/…/uebersicht.html`, Variante A. Inhalt:

- Dateiname, Gesamtzahl, Kacheln: Cases, Traversen, Boxen, Set.
- Auffälligkeiten als gelbe/rote Bänder mit „ansehen / korrigieren“ (springt in die Liste, gefiltert).
  Beispiel: „4 Cases sind orange, aber dem Gewerk Ton zugeordnet (orange ist sonst Licht)“. Regel:
  Hat eine Farbe überwiegend ein Gewerk, sind Abweichler auffällig (Schwelle: dem Bauenden
  überlassen).
- Tabelle je Gewerk: Farbpunkt, Anzahl, Vorschau der LKW-Wahl (die Mockup-Spalte „LKW aus Tabelle“
  entfällt mit der LKW-Spalte).
- **Ziel:** ins aktuelle Projekt (Ladeplan; vorhandene Stücke bleiben, das Neue kommt dazu) oder neues
  Projekt (öffnet den normalen „Neuer Load“-Dialog).
- **Ziel-Projekt hat schon geladene LKW:** Es wird gefragt, wie sich der Import verhalten soll:
  1. **Alles neu laden** – die LKW werden mit **allen** Cases (alte und neue) neu geladen, nach den
     Einstellungen des Schritts „LKWs“.
  2. **Nur hinzufügen** – die neuen Cases werden in den freien Platz der vorhandenen LKW nachgeladen
     (passend zum Gewerk, wie „Rest einpacken“), Vorhandenes bleibt stehen; was nicht passt, landet in
     der Ablage und in der Meldung „nicht geladen“ (**Annahme**, wie „nur hinzufügen“ gemeint ist).
  3. **Neue zusätzliche LKW** – vorhandene LKW bleiben unberührt, die neuen Cases kommen in neu
     angelegte LKW.

  `MAX_LKW` (12) zählt die vorhandenen LKW mit.
- Knöpfe: Abbrechen · Nur übernehmen · Übernehmen und laden.
- Die Kachel „unbekannte Case-Typen / in Datenbank übernehmen“ aus dem ersten Mockup **entfällt**
  (kein Abgleich mehr).

„Nur übernehmen“ und „Übernehmen und laden“ führen beide durch die folgenden Schritte; „Nur
übernehmen“ lässt den Schritt LKWs weg und legt alles ungeladen in die Ablage (**Annahme**, vom
Nutzer nicht widersprochen, nicht ausdrücklich bestätigt).

### 2. Liste

Die ganze Tabelle „stumpf wie Excel“, Reiter Cases/Set umschaltbar. Filter „Alle“ / „Nur fehlerhafte
und auffällige“, Suche. Jede Zelle änderbar, Zeilen hinzufügen und löschen. Fehlerhafte Zellen rot
umrandet, auffällige Zeilen gelb. Bei 350+ Zeilen flüssig.

### 3. Prüfen

Zusammenfassung, was noch rot (blockiert) oder gelb (geht, aber ansehen) ist. Weiter nur ohne rot;
rote Zeilen lassen sich auch bewusst „nicht übernehmen“.

### 4. Traversen und 5. Boxen

Merkliste aus dem Reiter links, rechts der vorhandene Traversen- bzw. Dolly-Dialog
(`js/ui/truss-wizard.js`, `js/ui/dolly-wizard.js`). Gebautes wird dem Load hinzugefügt. Die dabei
entstehenden Case-Typen sind ebenfalls projekteigen und bearbeitbar wie Import-Cases (**eigene
Entscheidung**, folgt aus „nicht in die Datenbank“). Die Dialoge bekommen dafür eine Betriebsart
„nur fürs Projekt“, die einen Case-Entwurf zurückgibt statt in die Bibliothek zu schreiben; der Haken
„Im Materialbestand ablegen“ ist dort ausgeblendet.

### 6. Set

Vorschau der erzeugten Set-Teile; nichts zu bauen, nur bestätigen. (Kann mit Schritt 3 zusammenfallen,
wenn das besser trägt: dem Bauenden überlassen.)

### 7. LKWs

Gruppiert wird **nur nach Gewerk** (Farbe ist Optik, siehe oben).

- Fahrzeugtyp für neu angelegte LKW: eine Auswahl für alle, Vorgabe Standardfahrzeug (**eigene
  Entscheidung**).
- Je Gewerk: **auf N LKWs verteilen** · **zusammen mit Gewerk …** in denselben LKW(s) · **offen**
  (so viele wie nötig).
- Knopf **„So wenige LKWs wie möglich“**. Hauptregel: so wenig Platz wie möglich. Lagen, Tippen,
  Gewicht, Stapeln, Pack-Regeln gelten immer. Ohne Häkchen: Gewerke werden beliebig gemischt. Mit
  Häkchen **„nach Gewerk getrennt“**: jedes Gewerk bekommt so viele **volle** LKW, wie es füllt;
  die Reste aller Gewerke kommen zusammen in möglichst wenige Rest-LKW. Beispiel des Nutzers: Licht
  und Ton brauchen je etwas mehr als einen LKW → ein voller Licht-, ein voller Ton-LKW, ein dritter
  mit beiden Resten. Im gemischten Rest-LKW stehen die Gewerke als Blöcke (**Annahme**); die Farben
  machen sie dort optisch unterscheidbar.
- **Keine feste Anzahl** („offen“, „so wenige wie möglich“): ist der LKW voll, wird ein neuer
  angefangen, bis alles geladen ist. Grenze `MAX_LKW` (12, inklusive vorhandener LKW); wird sie
  erreicht, gilt der Rest als nicht geladen.
- **Feste Anzahl** („auf N verteilen“): was nicht passt, bleibt in der Ablage. Am Ende **eine**
  Meldung: „Achtung: 4 Cases nicht geladen, kein Platz“ mit Liste (Name, Gewerk).
- Ergebnis ist ein normaler Mehr-LKW-Plan (`plan.lkws`, Stücke mit `lkw`). Die LKW tragen ihre
  Gewerke in `categories` (Rest-LKW mit mehreren Gewerken: alle seine Gewerke), damit ein späteres
  „Alles neu packen“ zur Zuordnung passt. Kein neues LKW-Feld.

Danach arbeitet man im Plan ganz normal weiter.

## Datenmodell

- **Projekteigene Cases** liegen in `plan.mitgefuehrt.cases` mit neuer UUID-ID (nie eine
  Bibliotheks-ID, also nie von der Bibliothek überstimmt) und einer Kennzeichnung, dass sie aus dem
  Import stammen (Feldname dem Bauenden überlassen, z. B. `herkunft: 'import'`). Sie gelangen nur über
  `bestandOf(s)` in die Ansicht (Projektregel).
- **Unterschied zu Kopien aus der Bibliothek:** Import-Cases sind im Plan **bearbeitbar** (Seitenleiste,
  Inspector, Case-Editor: Maße, Gewicht, Lagen, Tippen, Gewerk, Farbe). Gespeichert wird in die
  Kopie des Plans, nie in die Bibliothek. Kopien aus der Bibliothek bleiben gesperrt wie in 0.17.1
  entschieden. „In meine Bibliothek übernehmen“ bleibt für Import-Cases möglich (Nutzer: man kann
  einen Case anklicken und übernehmen). Danach ist es ein normales Bibliotheks-Case, im Plan gelten
  die üblichen Regeln (**eigene Entscheidung**).
- `mitfuehren` (Neuberechnung beim Speichern) muss benutzte Import-Cases erhalten. Kommt ein
  Import-Case in keinem Stück mehr vor, fällt es wie heute weg (**eigene Entscheidung**).
- **Set-Teile:** eine neue Art, z. B. `kind: 'set'` in `CASE_KINDS` (`js/store/io.js`), mit Darstellung
  als schlichter Kasten in `view2d.js`/`view3d.js` und im Druck. Ältere Truckload-Stände lehnen eine
  unbekannte `kind` beim Prüfen ab; das ist in `docs/nyx-tabellenimport.md` zu nennen.
- **Alte Daten:** Pläne ohne die neuen Felder laden unverändert; Regressionstest mit altem Schema.
- Farbe: Case-Feld `color` (`#rrggbb`), schon heute erlaubt.

## NYX

`docs/nyx-tabellenimport.md` für den NYX-Admin: neue Felder (Import-Kennzeichen, `kind: 'set'`),
dass Import-Cases nur in der Projektdatei (im Plan) liegen und kein neuer Store nötig ist, die neue
Vorlagendatei unter `data/`, Folgen für ältere Submodul-Stände. Vor dem Veröffentlichen.

## Prüfen

- Reine Logik per TDD: xlsx-Lesen, CSV-Varianten, Kopfzeilenerkennung, Zeile → Case-Entwurf,
  Befunde, LKW-Logik („volle LKW je Gewerk + Rest“, offene vs. feste Anzahl, drei Verhaltensweisen bei
  vorhandenen LKW, Meldung „nicht geladen“). Testdateien: xlsx und CSV erzeugt Claude selbst (echte
  Dateien, z. B. per LibreOffice/Python, keine erfundenen Strukturen); einen echten CSV-Export aus
  Google Sheets liefert der Nutzer nach, Claude sagt rechtzeitig an, wann.
- Browser-Abnahme mit `tools/cdp.mjs`: 350-Zeilen-Liste, Set-Kasten in 3D (Prüf-Fahrzeug, siehe
  Fallstrick in CLAUDE.md), Englisch.

## Reihenfolge der Umsetzung (Vorschlag)

1. Vorlage + Lesen (xlsx/CSV) + Übersicht A + Liste/Prüfen + Cases und Set in den Plan (ohne
   LKW-Schritt: die Stücke landen ungeladen in der Ablage, bei Mehr-LKW-Plänen „Ohne LKW“).
2. Traversen- und Boxen-Schritt.
3. LKW-Schritt mit allen Modi.

Jede Stufe ist für sich nutzbar und wird als eigener Patch veröffentlicht.

## Offen / dem Bauenden überlassen

- Genaue Spalten der Reiter Traversen/Boxen, Farbliste und Abbildung auf Hex-Werte.
- Platz der Knöpfe, Gestaltung von Liste und Schritten (UI-Grundsätze: dunkel, farbig, Symbole).
- Verfahren für „so wenige LKW wie möglich“ (Heuristik; muss deterministisch sein).
