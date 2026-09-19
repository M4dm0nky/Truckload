# Changelog

Versionierung: eine Nummer `Major.Minor.Patch` überall gleich – App-Anzeige, Druck, Export, `package.json`, README, Offline-Cache und Git-Tag.

## V 0.2.0 – 2026-09-19

- Cases sehen aus wie echte Cases: Alu-Kanten, Kugelecken, Deckelfuge mit Verschlüssen – in Draufsicht, Seiten-, Rückansicht, 3D und Druck
- Case-Farbe umschaltbar: „Schwarz“ (mit Gewerk-Farbstreifen) oder komplett in „Gewerk“-Farbe; Auswahl wird gemerkt
- Rollen sichtbar: 4 Lenkrollen pro Case (bei getippten Cases an der Seite); neues Feld „Rollenhöhe“ pro Case (0 = ohne Rollen, z. B. Traverse)
- Begriff „Tippen“ statt „Kippen“ (tippbar, getippt)

## V 0.1.1 – 2026-09-19

- Einfacher Start: App läuft über GitHub Pages (https://m4dm0nky.github.io/Truckload/), kein Terminal nötig
- Installierbar als App (Dock), App-Symbol, läuft nach dem ersten Öffnen offline (Service-Worker)
- Einheitliche Versionsnummer überall (App zeigt jetzt „V 0.1.1“), per Test abgesichert

## V 0.1 – 2026-09-19

Erste Version.

- Case-Bibliothek: eigene Cases anlegen, benennen (Inhalt), speichern; Vorlagen mit Richtwerten (Truckmaß EU, Truck Pack US, Racks, Moving Heads, LED, FOH, Traversen)
- Fahrzeuge: Vorlagen (Sprinter bis Megatrailer) und eigene, inkl. Radkästen
- Ladeplan: Draufsicht (Drag & Drop, Raster, Kanten-Snap, Stapeln), Seiten- und Rückansicht, 3D-Ansicht
- Kippen (Längs-/Stirnseite) und Drehen, Rollenseite markiert
- Prüfungen: Kollision, Überstand, Radkasten, Auflage, Stapelbarkeit, Überlast, Nutzlast, einseitige Ladung
- Auto-Beladung („Alles neu packen“, „Rest einpacken“)
- Undo/Redo, Autosave im Browser, Sichern/Importieren als JSON, Druck A4 quer mit Ladeliste
