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

## Ausblick

Stufe 2 (Traversen- und Boxen-Schritt) und Stufe 3 (LKW-Schritt) folgen. Ändert sich dabei das
Datenmodell oder die Projektdatei, kommt hier ein neuer Abschnitt, bevor es veröffentlicht wird.
