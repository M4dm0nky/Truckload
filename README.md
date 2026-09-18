# Truckload – Ladeplaner für Event-Cases

Lokale Vanilla-JavaScript-App zur Planung und Visualisierung von Laderaum-Aufteilungen im LKW. Cases (auf Rollen, stehend oder gekippt) werden interaktiv in den Laderaum positioniert, Kollisionen und Grenzen werden live geprüft.

## Start

**Unter macOS:**
Doppelklick auf `start.command` – öffnet einen lokalen HTTP-Server auf Port 8765 und startet den Browser automatisch.

**Manuell:**
```bash
python3 -m http.server 8765
```
Dann im Browser öffnen: `http://localhost:8765`

## Tests

```bash
npm test
```

## Wichtig: Datensicherung

**Alle Daten liegen im Browser (IndexedDB)!** Es gibt keine Sicherung auf dem Server. Regelmäßig Daten exportieren:

1. In der App auf „Sichern/Importieren" klicken
2. JSON-Export herunterladen
3. **In Dropbox ablegen** (z. B. in `/Dropbox/truckload-backups/`)

So hast du immer ein Backup für den Fall, dass der lokale Browser-Speicher gelöscht wird.

## Tastenkürzel

| Taste | Aktion |
|-------|--------|
| **R** | Gedrehte Case um 90° drehen |
| **T** | Case kippen (tipLong / tipShort wechseln) |
| **D** | Case duplizieren |
| **Entf** | Case löschen |
| **Pfeile (↑↓←→)** | Case in 5-cm-Schritten verschieben |
| **Shift + Pfeile** | Case in 1-cm-Schritten verschieben |
| **Cmd/Strg + Z** | Rückgängig |
| **Cmd/Strg + Shift + Z** | Wiederherstellen |
