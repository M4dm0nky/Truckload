# Tabellen-Import: was NYX wissen muss

## Für den Admin: zu tun vor dem Heben des Submoduls auf 0.30.0

- Dateiauswahl `<input type="file" multiple>` zulassen.
- Download-Link `<a href="data/…" download>` zulassen.
- Kein neuer Store, keine Freigabe nötig.
- Nach Einsatz von Set-Teilen das Submodul nicht auf einen Stand vor 0.30.0 zurückdrehen.

Gilt seit V 0.30.0 (Stufe 1). Richtet sich an den NYX-Admin, der Truckload als Submodul einbindet.
Ergänzt [nyx-projektdatei.md](nyx-projektdatei.md) und [nyx-host.md](nyx-host.md).

## Zuerst: was NYX prüfen muss

1. **Dateiauswahl.** Der Import öffnet die Dateiauswahl über `<input type="file" multiple>`, wie schon
   der JSON-Import. NYX muss das im Host zulassen. Ohne das ist der Import in NYX nicht nutzbar.
2. **Vorlagen-Download.** „Vorlage herunterladen“ ist ein gewöhnlicher Link
   `<a href="data/…" download>` auf die beiden Vorlagen unter `data/`. NYX muss den Download zulassen.
3. **Kein neuer Store.** `STORES` in `js/store/db.js` ist unverändert. Eine Freigabe in NYX ist nicht nötig.
4. **Keine Änderung an der Projektdatei nötig.** Import-Cases liegen nur im Plan
   (`plan.mitgefuehrt.cases`) und reisen mit ihm in der Projektdatei mit.

## Neue Case-Felder

- **`herkunft: 'import'`**: kennzeichnet ein Case aus dem Tabellen-Import. Es steht in
  `plan.mitgefuehrt.cases`, nie in der Bibliothek. Ältere Stände kennen das Feld nicht und sperren
  diese Cases wie andere Kopien aus der Bibliothek.
- **`kind: 'set'`**: Set-Teile (Bühnenteile, Kulissen). Zusätzlich gilt für sie: keine Rollen, nicht
  tippbar; so prüft es `checkCase` (`js/store/io.js`). Set-Teile werden in 2D und 3D als schlichter
  Kasten gezeichnet.
  - **Achtung:** Ältere Truckload-Stände lehnen eine unbekannte `kind` beim Prüfen ab. Sobald eine
    Projektdatei Set-Teile enthält, darf das Submodul **nicht** auf einen älteren Stand
    zurückgedreht werden. Sonst scheitert das Laden dieser Datei.
- Import-Cases tragen außerdem `stackable: true`, `maxTopLoad: null`, `dimsInclWheels: true`, und
  die Farbe als `color` (`#rrggbb`). Das Feld `color` ist schon länger erlaubt.

## Wo die Daten liegen

- Import-Cases sind im Plan **bearbeitbar** (Seitenleiste, Inspector, Case-Editor). Gespeichert wird
  über `editWhole` in den Plan, nie in die Bibliothek.
- „In meine Bibliothek übernehmen“ macht aus einem Import-Case ein normales Bibliotheks-Case
  (`alsEigenesCase` entfernt `herkunft`). Erst dann erscheint es in der Materialverwaltung.
- Obergrenze: höchstens `MAX_MITGEFUEHRT_CASES` (1000) Case-Typen je Plan, beim Übernehmen
  ebenso wie beim Prüfen der Projektdatei.

## Neue Dateien

- `data/Truckload-Ladeliste.xlsx` (deutsche Vorlage) und `data/Truckload-Loadlist.xlsx` (englische
  Vorlage). Beide stehen in `sw.js` (`ASSETS`), damit sie offline verfügbar sind.
- `tools/make-ladeliste.py` erzeugt die Vorlagen und Testdateien. Das ist ein Entwicklungswerkzeug
  (braucht openpyxl) und wird in NYX nicht benötigt.

## Was NYX nicht tun muss

- Keine Netzverbindung zur Laufzeit. Das Lesen von xlsx und CSV passiert im Browser
  (`DecompressionStream('deflate-raw')`, kein `DOMParser`).
- Keine nativen Dialoge: Der Dialog „Tabelle importieren“ ist HTML.

## Stufe 2 und 3: Traversen, Boxen, LKW (seit V 0.31.0)

- **Weitere Case-Arten im Import:** Import-Cases können jetzt auch Traversenwagen (`kind: 'truss'`) und
  Dolly-Stacks (`kind: 'speaker'`) sein. Die Felder sind dieselben wie bisher (`herkunft: 'import'`).
  Es kommt kein neues Feld und kein neuer Store hinzu.
- **Grundboxen und Pre-Rig nur per ID:** Grundboxen aus der Bibliothek werden im Plan nur über ihre
  Bibliotheks-ID referenziert. „Mitführen“ nimmt sie als Kopie mit, wie sonst auch.
- **Mehr-LKW-Pläne:** „Übernehmen und laden“ erzeugt `plan.lkws` im bestehenden Format
  (siehe [architektur.md](architektur.md)).
- **Vorlagen:** Die Vorlagen unter `data/` haben im Reiter Boxen neue optionale Spalten (Breite, Tiefe,
  Höhe, Gewicht). Alte Tabellen ohne sie werden weiter gelesen.

## Ausblick

Ändert sich das Datenmodell oder die Projektdatei künftig, kommt hier ein neuer Abschnitt, bevor es
veröffentlicht wird.
