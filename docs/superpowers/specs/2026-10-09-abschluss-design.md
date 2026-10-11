# Abschluss der offenen Punkte – Design (ab V 0.13.11)

Stand 2026-10-09, mit dem Nutzer abgestimmt. Auftrag: „Schließe alles sauber ab, Truckload muss
fertig sein.“ Es geht ausschließlich um die offenen Punkte aus `docs/offene-punkte.md`; um die
spätere Einbindung in eine andere Software kümmert sich dieses Vorhaben nicht.

## Entscheidungen des Nutzers

- **Datenlücken:** Nur die zwei offensichtlichen Vertauschungen korrigieren – D8+ x4/x8/x12
  (Länge ↔ Breite) und JDC-1 Cube (die beiden Zeilen tauschen). Alles andere (fünf fehlende Zeilen,
  vier gerechnete Racks, Dolly-Breite Pre-Rig, Avery-Ränder) bleibt als Datenlücke dokumentiert.
- **Verhalten ändern:** Taste T sauber · Regelsets mit Rückfrage · Zahlen einheitlich ·
  Deckschicht nebeneinander · Schriftfarbe in 2D wie in 3D · Traversenwagen wiederverwenden ·
  Abhakliste mit Lage.
- **Ideen aufnehmen:** Grund in der Ablage · Gewicht im Inspector · Mehrere Trucks je Show ·
  Ausladereihenfolge als **Liste umdrehen** (kein neues Packen).
- **Nicht gewählt, bleibt offen dokumentiert:** Schrift beim Zoom konstant, Mausrad-Erkennung
  (Hardware), Datenlücken ohne Nutzerwerte.
- **Mehrere Trucks:** ein Ladeplan mit **Reitern je LKW**. Der Nutzer legt die LKW an und hakt je
  LKW an, welche **Gewerke** hineindürfen. „Alles neu packen“ verteilt die Cases je Gewerk
  **gleichmäßig** (Gewicht und Lademeter) auf die zugelassenen LKW.

## Teilprojekt 1 – Abschluss (V 0.13.11)

Technisch, ohne sichtbare Änderung:

1. **Import-Warnungen nach dem Zusammenführen:** `parseBundle` meldet fehlende Verweise erst, wenn
   sie auch im lokalen Zustand fehlen (Prüfung in `js/app/importExport.js`); `warnings` wird dort
   angezeigt.
2. **Grenzen beim Import:** Obergrenzen für Namenslängen und Platzierungskoordinaten, Prüfung
   doppelter IDs je Liste. Die Gewicht/Bestand/Auflast-Obergrenzen werden beim Import zu einer
   Warnung statt zum Abbruch der ganzen Datei, ohne Zahlen zu erfinden (Wert bleibt, Warnung nennt
   ihn).
3. **`repairWheelH`:** Die Meldung nennt auch die `wheels`-Korrektur, wenn sie greift.
4. **Kaputtes `updatedAt`:** wird auch in IndexedDB bereinigt, nicht nur in der Kopie im Store.
5. **Datenbank:** eine abgelehnte `dbPromise` wird beim nächsten Zugriff neu versucht.
6. **3D:** `disposed`-Schutz gegen doppeltes `dispose()`; „3D-Ansicht veraltet“-Hinweis, wenn
   `update()` fehlschlägt.
7. **Plan löschen:** vorher `autosave.flush()` abwarten.
8. **`touch()`/`stamp()`** zu einer Funktion zusammenlegen.
9. **Modell/Packer:** `supportersOf` je Validierung nur einmal; Packer bei überfüllter Ladung
   schneller (gescheiterte Grundfläche je Sortierung merken, Punkte einmal sortieren) mit
   Vergleichstest auf identische Ergebnisse; Eigenschaftstest über 50 zufällige Case-Mischungen
   („kein Placement-Fehler, Platziert + Ablage = Eingabe“); der `layerMap`-Rückfall wird
   belegt oder entfernt.
10. **Firmen:** Dolly-ID-Kollision bei gleichem Slug verhindern (kein stilles Überschreiben einer
    anderen Firma); „Firma löschen“ in **einer** Transaktion.
11. **Wizard:** „Gestapelt“ überschreibt eine abgewählte „danach automatisch packen“-Checkbox
    nicht mehr.

Sichtbar:

12. **Taste T** schaltet zuverlässig zwischen „stehend“ und „getippt“ um, auch bei vom Packer
    getippten Cases.
13. **Regelsets:** Rückfrage beim Speichern unter vorhandenem Namen und beim Löschen.
14. **Zahlen einheitlich:** `caseLine` und `caseDetail` zeigen Maße und Gewichte deutsch
    formatiert (Komma, gerundet) und dieselben Angaben; Traversen „kg/Wagen“ statt „kg/Stück“.
15. **Traversenwagen** (Profil, Länge, Stückzahl je Wagen, Wagenbreite, Firma) werden
    wiederverwendet, statt doppelt angelegt.
16. **Abhakliste** zeigt die Lage je Stück.
17. **Ausladeliste:** zusätzliches Druckdokument, dieselbe Liste in umgekehrter Reihenfolge.
18. **Schriftfarbe 2D:** auf hellen Cases dunkle Schrift (gleiche Regel wie 3D, `textColorFor`
    nach `caseStyle.js`), auch im Druck; Kontur bleibt zur Lesbarkeit.
19. **Ablage nennt den Grund**, warum ein Case nicht platziert wurde (zu groß für den Laderaum,
    passt nur stehend, Lagen-Einschränkung, kein Platz mehr, Nutzlast).
20. **Gewicht im Inspector:** bei eigenen und Firmen-Cases direkt änderbar; bei Standardvorlagen
    ein Hinweis auf „Kopieren“ (Vorlagen bleiben nur lesbar).

Daten:

21. D8+ x4/x8/x12: Länge ↔ Breite; JDC-1 Cube (4) ↔ JDC-1 Cube: Namen/Stückzahlen tauschen.
    Gewichte werden **nicht** neu geschätzt, Quelle bleibt „Nutzerangabe/Tabelle, vertauscht
    korrigiert“. Alte Pläne verweisen per ID, die IDs bleiben.

Doku: `docs/offene-punkte.md` abgleichen (Erledigtes streichen, Rest ehrlich benennen),
`docs/architektur.md` ergänzen, CHANGELOG.

## Teilprojekt 2 – Deckschicht nebeneinander (V 0.13.12)

Mehrere kleine Cases dürfen nebeneinander oben auf ein großes. Es gelten die bisherigen Regeln:
Lagen-Einschränkungen, `maxTopLoad`, 0-kg-Cases mischen nicht, Lagen-Vorgabe. Anordnung der
Deckschicht-Stücke auf der Fläche des tragenden Cases über ein einfaches Regalverfahren
(Reihen). Test mit alten Plänen: Ergebnisse ohne Deckschicht bleiben identisch.

## Teilprojekt 3 – Mehrere LKW in einem Plan (V 0.14.0)

Kurzfassung der Entscheidungen oben. Datenmodell und Oberfläche werden vor der Umsetzung in einem
eigenen Entwurf festgelegt und dem Nutzer vorgelegt (Datenmodell: Plan bekommt eine Liste von
LKW mit zugelassenen Gewerken; alte Pläne laden als Plan mit einem LKW; Stücke gehören zu einem
LKW; Export/Import und Autosave bleiben abwärtskompatibel).

## Grenzen

- Keine npm-Abhängigkeiten, kein Build; Zahlen und Quellen nicht erfinden (CLAUDE.md „Haltung“).
- Alte Daten laden weiter; Regressionstest im alten Schema je Modelländerung.
- Versionsnummern sind Vorschläge (0.13.11, 0.13.12 als Patch; Teilprojekt 3 als Kandidat für
  0.14.0). Jede wird vor dem Commit mit dem Nutzer abgestimmt, Minor/Major nur auf seinen
  ausdrücklichen Wunsch (dann mit annotiertem Git-Tag).
