# Truckload – Ladeplaner für Event-Cases

Version: **V 0.2.0** – siehe [CHANGELOG.md](CHANGELOG.md).

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

## Tastenkürzel

| Taste | Aktion |
|-------|--------|
| **R** | Gedrehte Case um 90° drehen |
| **T** | Case tippen (tipLong / tipShort wechseln) |
| **D** | Case duplizieren |
| **Entf** | Case löschen |
| **Pfeile (↑↓←→)** | Case in 5-cm-Schritten verschieben |
| **Shift + Pfeile** | Case in 1-cm-Schritten verschieben |
| **Cmd/Strg + Z** | Rückgängig |
| **Cmd/Strg + Shift + Z** | Wiederherstellen |
