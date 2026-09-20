# Truckload – Ladeplaner für Event-Cases

Version: **V 0.5.0** – siehe [CHANGELOG.md](CHANGELOG.md).

Lokale Vanilla-JavaScript-App zur Planung und Visualisierung von Laderaum-Aufteilungen im LKW. Cases (auf Rollen, stehend oder getippt) werden interaktiv in den Laderaum positioniert, Kollisionen und Grenzen werden live geprüft.

## Start

**Einfach öffnen:** https://m4dm0nky.github.io/Truckload/

Nichts installieren, kein Terminal. Nach dem ersten Öffnen läuft die App auch offline.

**Als App ins Dock (empfohlen):**
- Safari: Seite öffnen → Menü *Ablage → Zum Dock hinzufügen*
- Chrome: Seite öffnen → Installieren-Symbol rechts in der Adressleiste

Updates kommen automatisch: Die neue Version ist beim übernächsten Öffnen aktiv.

**Lokal ohne Internet-Adresse (für Entwicklung):** Doppelklick auf `start.command` bzw. `python3 -m http.server 8765` und `http://localhost:8765` öffnen. Achtung: Jede Adresse hat ihren eigenen Browser-Speicher – Daten zwischen `localhost` und der GitHub-Adresse mit „Sichern“ / „Importieren“ übertragen.

## Tests

```bash
npm test
```

## Wichtig: Datensicherung

**Alle Daten liegen im Browser (IndexedDB)!** Es gibt keine Sicherung auf dem Server. Regelmäßig Daten exportieren:

1. In der App auf „Sichern“ klicken – die JSON-Datei wird heruntergeladen
2. **In Dropbox ablegen** (z. B. in `/Dropbox/truckload-backups/`)
3. Wiederherstellen oder auf einen anderen Rechner übertragen: „Importieren“

So hast du immer ein Backup für den Fall, dass der lokale Browser-Speicher gelöscht wird.

## Neuen Load anlegen

„Neuer Ladeplan“ öffnet einen Wizard mit drei Schritten:

1. **Load** – Name und Fahrzeug (Truck) wählen.
2. **Cases** – aus der Bibliothek Cases mit Stückzahl auswählen, oder über „+ Neues Case“ bzw. „⬛ Sonderbau“ direkt neue Cases anlegen.
3. **Beschriften** – jedes einzelne Stück bekommt eine vorbelegte Beschriftung (z. B. „Kabelcase 1“ … „6“), die sich überschreiben lässt, sowie optional eine Gruppenfarbe. Ein Häkchen steuert, ob danach automatisch gepackt wird.

„Fertig“ legt den Load an und packt ihn bei aktiviertem Häkchen automatisch in den Truck.

## Mitgelieferte Cases

In der Bibliothek und im Wizard gibt es neben „Eigene Cases“ und den Vorlagen einen
eigenen Abschnitt „Cases aus deiner Liste“ mit 137 Cases – übernommen aus der privaten
Excel-Tabelle „Casemaße Complete.xlsx“ (Blatt „Data Cases“), in der die Maße über Jahre
gepflegt wurden. Jeder Eintrag zeigt den Hersteller im Feld „Inhalt“ sowie die Firma, und
beide Listen lassen sich zusätzlich nach Firma filtern.

Für 67 dieser Cases gibt es ein recherchiertes Schätzgewicht (Netto-Gerätegewicht plus
Case-Anteil, nachvollziehbar mit Quellen in [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)).
Die restlichen 70 stehen bewusst bei 0 kg – lieber ehrlich 0 kg als eine erfundene Zahl –
und lassen sich im Inspector jederzeit nachtragen.

## Tastenkürzel

| Taste | Aktion |
|-------|--------|
| **R** | Gedrehte Case um 90° drehen |
| **T** | Case tippen (tipLong / tipShort wechseln) |
| **W** | Rollenseite (Richtung) wechseln |
| **D** | Case duplizieren |
| **Entf** | Case löschen |
| **Pfeile (↑↓←→)** | Case in 5-cm-Schritten verschieben |
| **Shift + Pfeile** | Case in 1-cm-Schritten verschieben |
| **Cmd/Strg + Z** | Rückgängig |
| **Cmd/Strg + Shift + Z** | Wiederherstellen |
