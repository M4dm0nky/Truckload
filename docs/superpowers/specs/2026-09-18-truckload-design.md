# Truckload – Design

## Spec

### Zweck
Veranstaltungstechnik wird größtenteils in Cases auf Rollen transportiert. Cases werden im LKW gestapelt und oft **gekippt** („getippt": nach vorne auf die Seite gelegt). Das Tool plant und visualisiert die Ladung und prüft sie.

### Datenmodell
- **Case** `{ id, builtin, name, content, category, color, l, w, h, weight, tippable, stackable, maxTopLoad|null, stock|null, note?, updatedAt }` – `l ≥ w` nicht erzwungen; `l,w,h` = Maße **stehend inkl. Rollen**.
- **Truck** `{ id, builtin, name, l, w, h, payload, wheelArches: [{x, l, w, h, side:'left'|'right'|'both'}], note?, updatedAt }` – Innenmaße.
- **Plan** `{ id, name, truckId, placements: [Placement], unplaced: [{id, caseId}], notes, updatedAt }`.
- **Placement** `{ id, caseId, x, y, z, orientation: 'standing'|'tipLong'|'tipShort', rot: 0|90|180|270 }`.

### Lage/Kippen
Lokale Maße (a entlang x, b entlang y, c Höhe) je Lage:
- `standing`: a=l, b=w, c=h – Rollen unten.
- `tipLong` (auf die lange Seite gekippt): a=l, b=h, c=w – Rollen zeigen Richtung +y.
- `tipShort` (auf die Stirnseite gekippt): a=h, b=w, c=l – Rollen zeigen Richtung +x.
`rot` 90/270 tauscht a und b; die Rollenseite dreht mit (+x → +y → −x → −y).

### Prüfungen (live)
`outOfBounds`, `collision`, `arch` (Radkasten), `notTippable`, `unsupported` (< 80 % Auflagefläche), `notStackable`, `overload` (Last obendrauf > maxTopLoad, Last wird flächenanteilig nach unten verteilt), `missingCase`, planweit `tooHeavy` (> Nutzlast) und `imbalance` (Schwerpunkt seitlich > 10 % der Breite aus der Mitte). Kennzahlen: Gewicht, Lademeter, Volumenauslastung, Schwerpunkt, Ladereihenfolge (nach x, dann y, dann z).

### Auto-Vorschlag
Pro Case beste Lage wählen (Füllgrad Breite × Füllgrad Höhe; bei Gleichstand stehend, dann 0°). Gleiche Grundfläche → Stapel (schwer unten, Stapelbarkeit und maxTopLoad beachten). Stapel per Extreme-Point-Heuristik von der Stirnwand aus platzieren (Radkästen sind Hindernisse). „Alles neu packen" oder „Rest einpacken" (bestehende Platzierungen bleiben).

### UI
Topbar (Ladeplan, Fahrzeug, Auto-Pack, 2D/3D, Undo/Redo, Sichern/Importieren, Drucken) · links Bibliothek (Suche, Gewerk-Filter, eigene + Vorlagen, „Noch nicht verladen"-Ablage) · Mitte Draufsicht (Drag & Drop, Raster 5 cm, Kanten-Snap 8 cm, Schwerkraft-Stapeln, Stapel wandern mit) + Seitenansicht (von links) + Rückansicht (von der Tür) bzw. 3D (OrbitControls) · rechts Inspector (Auswahl, Aktionen, Warnungen, Kennzahlen). Tasten: R drehen, T kippen, D duplizieren, Entf löschen, Pfeile schieben (Shift = 1 cm), Cmd/Strg+Z / +Shift+Z.

### Speicherung
IndexedDB (`cases`, `trucks`, `plans`), Autosave 400 ms. Export = JSON-Datei (nur eigene Cases/Fahrzeuge + alle Pläne), Import = Zusammenführen nach `id` (neueres `updatedAt` gewinnt).

### Druck
A4 quer: Kopf (Plan, Fahrzeug, Datum, Gewicht/Nutzlast, Lademeter), Draufsicht + Seitenansicht mit Nummern, Ladeliste in Reihenfolge (Nr, Case, Inhalt, Lage, Position, Gewicht), Warnungen.

### Vorlagen (Richtwerte, recherchiert)
„Truckmaß" = Case-Breiten 60/80/120 cm, die in 240 cm Innenbreite aufgehen (Megacase, Gäng-Case). US-„Truck Pack": 22,5″ Raster, 45×22,5×30″ / 30×22,5×30″ / 22,5×22,5×30″ inkl. Rollen (OSP, Gator, Brady).
