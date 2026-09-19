# Truckload V 0.3.0 – echte Flightcases, Traversenwagen, Lagen-Freigabe

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps mit `- [ ]`.

## Context

Nutzer-Feedback zu V 0.2.0:
1. Cases sollen **realer wie ein Flightcase** aussehen – Vorbild Thomann „Flyht Pro Case Universal 2 120 cm“: schwarzes Sperrholz mit Laminat, breite Alu-Hybridprofile an allen Kanten, große Kugelecken, versenkte Butterfly-Verschlüsse an der Deckelfuge, versenkte Schalen-/Federgriffe, 4 Lenkrollen auf Rollenbrett.
2. **Traversenwagen** sieht aus wie ein Case – falsch. Wichtig ist die **Traversenlänge** (2 m, 2,40 m, 3 m …) und die **Traversenbreite** (34er = F34 29 cm, 40er = F44 40 cm). Wagen gibt es nur im **60er oder 80er Maß** (Breite).
3. **Lagen-Freigabe** pro Case: Häkchen „Lage 1 / 2 / 3 / 4“ (1 = Boden). Nur Lage 1 = zu schwer/groß zum Stapeln; 1+2 = unten oder eine Lage drauf. Die Auto-Beladung muss das beachten. Maximal 4 Lagen.

Recherche: F34 = 29 cm, F44 = 40 cm Kantenmaß (Global Truss); Transportwagen = Paar kleiner Rollwagen unter den Traversenenden, z. B. 80 × 60 × 20 cm (Dragon Stage).

## Entscheidungen

- **Lagen:** Case-Feld `layers: number[]` ⊆ {1,2,3,4}, mind. 1 Eintrag, Default `[1,2,3,4]` (auch für alte Daten). Die Lage eines platzierten Cases = 1 + höchste Lage seiner Auflage-Cases (Boden/Radkasten = Lage 1). „Stapelbar“ (darf etwas oben drauf) bleibt eigenständig.
- **Traversenwagen** = eigener Typ `kind: 'truss'` mit `truss: { length, width, count }` (cm, cm, Stück). Maße werden berechnet (`trussDims`), damit Prüfung/Packer unverändert funktionieren:
  - Wagenbreite `w` = 60, wenn 2 × Traversenbreite ≤ 60, sonst 80 (2 Stück nebeneinander).
  - `l` = Traversenlänge; `h` = 22 (Wagen inkl. Rollen) + ⌈count / 2⌉ × Traversenbreite.
  - `tippable: false`, `wheelH: 22` wird nicht als Case-Rolle gezeichnet (eigene Darstellung).
- **Flightcase-Look** in 2D, 3D und Druck; Farbmodus (Schwarz/Gewerk) bleibt.
- Version **0.3.0** überall, Tag `v0.3.0`, Deploy über GitHub Pages.

## Global Constraints
- Keine npm-Abhängigkeiten, kein Build. Nutzereingaben in HTML nur über `esc()`. UI-Deutsch mit „…“.
- `npm test` (101 grün) bleibt grün; neue reine Logik per TDD.

---

### Task 1: Lagen-Freigabe (Logik)

**Files:** `js/model/geometry.js` (`DEFAULT_LAYERS = [1,2,3,4]`, `layersOf(c)`), `js/model/validate.js`, `js/model/packer.js`, `js/store/io.js`, `js/data/preset-cases.js`, Tests.
- `validate.js`: `layerMap(items)` (von unten nach oben: Boden → 1, sonst 1 + max Lage der `supportersOf`); Rückgabe `result.layers: Map<id, n>`. Neue Codes:
  - `layer`: `„<Name>“ darf nicht in Lage <n> stehen (erlaubt: 1, 2).`
  - `tooManyLayers`: Lage > 4 → `„<Name>“ steht in Lage <n> – mehr als 4 Lagen sind nicht vorgesehen.`
- `packer.js` `buildStacks`: Case darf nur an Stapelposition k (Lage k+1) kommen, wenn `layersOf(c).includes(k+1)`; Stapel max. 4 Lagen; Sortierung vor dem Stapeln: zuerst Cases mit kleinster höchster erlaubter Lage (nur-Lage-1 zuerst), dann Gewicht absteigend. Cases, die Lage 1 nicht erlauben (z. B. nur Lage 2), kommen nur auf bestehende Stapel; sonst `unplaced`.
- `io.js checkCase`: `layers` fehlt → ok; sonst Array aus 1–4, nicht leer, ohne Duplikate.
- Presets: FOH-Pult `[1]`, Rack 20 HE `[1]`, LED-Wall-Case `[1,2]`, Rest Default.
- Tests: Lage 1/2/3 im Stapel korrekt; `layer`-Issue bei Rack-20 in Lage 2; `tooManyLayers` bei 5er-Stapel flacher Cases; Packer stellt ein `[1]`-Case immer auf den Boden (nie auf ein anderes Case); Packer stapelt nie > 4; Import lehnt `layers: []`, `[5]` ab.
- [ ] TDD, Commit `feat: Lagen-Freigabe pro Case (Prüfung + Auto-Beladung)`.

### Task 2: Lagen-Freigabe (Oberfläche)

- Case-Editor: Zeile „Erlaubte Lagen“ mit 4 Checkboxen `Lage 1 … Lage 4`; mind. eine muss gewählt sein (Hinweis sonst, Speichern gesperrt).
- Bibliothek-Zeile: Zusatz „· nur Lage 1“ bzw. „· Lage 1–2“, wenn eingeschränkt.
- Inspector: „Lage“ zeigt `getippt (Längsseite), 0° · Lage 2`; Druck-Ladeliste: Spalte „Lage“ (Zahl) zusätzlich zu „Höhe“.
- [ ] `node --check`, Commit `feat: Lagen-Freigabe im Editor, Inspector und Druck`.

### Task 3: Traversenwagen als eigener Typ (Logik + Editor)

**Files:** `js/model/truss.js` (neu), `js/data/preset-cases.js`, `js/ui/case-editor.js`, `js/store/io.js`, Tests.
```js
export const DOLLY_H = 22;       // Wagen inkl. Rollen (cm)
export const DOLLY_WIDTHS = [60, 80];
export const TRUSS_PROFILES = [{ name: '34er (F34)', width: 29 }, { name: '40er (F44)', width: 40 }];
export function trussDims({ length, width, count }) {
  const perRow = 2;
  const w = perRow * width <= 60 ? 60 : 80;
  const h = DOLLY_H + Math.ceil(count / perRow) * width;
  return { l: length, w, h };
}
export const isTruss = c => c.kind === 'truss';
```
- Presets (ersetzen „Traverse 29er 3 m“ und „Traversen-Dolly“): „Traversenwagen 34er 3 m (4 Stück)“, „… 34er 2 m (4 Stück)“, „… 40er 3 m (4 Stück)“ – `kind:'truss'`, `category:'Rigging'`, Gewicht Richtwert (F34 ≈ 6 kg/m, F44 ≈ 8 kg/m + Wagen 2 × 12 kg), `layers:[1,2]`, `tippable:false`.
- Case-Editor: oben Umschalter „Case | Traversenwagen“. Traversenwagen-Felder: Traversenlänge (cm, Schnellwahl-Buttons 100/200/240/250/300/400), Traversenbreite (Auswahl 34er 29 cm / 40er 40 cm / eigene cm), Anzahl Stück (1–12), Gewicht. Maße werden live angezeigt („→ im Truck 300 × 60 × 80 cm“) und beim Speichern aus `trussDims` gesetzt; L/B/H-Felder, Rollenhöhe und „tippbar“ ausgeblendet.
- Bibliothek-Zeile Traversenwagen: „Traverse 34er · 3,00 m · 4 Stück · Wagen 60er“.
- `io.js`: `kind` ∈ {'case','truss'} (fehlt = case); bei truss `truss.length/width/count` endliche Zahlen > 0.
- Tests: `trussDims` (29 → 60er, 40 → 80er, count 4 → h = 22 + 2×Breite, count 3 → aufgerundet), Presets gültig, Import-Validierung.
- [ ] TDD, Commit `feat: Traversenwagen mit Länge, Breite und Stückzahl`.

### Task 4: Flightcase-Look 2D (`js/ui/view2d.js`, `css/app.css`)

Bestehende Struktur (`caseShape`, `caseColors`, `.hit`, `.alert`, `.sel`) bleibt; Ausbau je sichtbarer Fläche:
- **Alu-Hybridprofil**: statt dünnem Rand ein 3,5 cm breiter Alu-Rahmen (Verlauf hell→dunkel via `linearGradient`), innen der Laminat-Korpus.
- **Laminat**: feines SVG-Muster (Punktraster, 6 % Deckkraft) über dem Korpus – nur im Schwarz-Modus.
- **Kugelecken**: Kreis r 6 mit Glanzpunkt (radialGradient), leicht über den Rahmen hinaus.
- **Deckelfuge** (Seiten-/Rückansicht, stehend): doppelte Alu-Leiste bei 25 % Höhe; **Butterfly-Verschlüsse** als versenkte Schale (dunkles abgerundetes Rechteck 9 × 7 cm) mit Chrom-Flügel – 2 auf Längsseiten, 1 auf Stirnseiten.
- **Griffe**: versenkte Schalengriffe (dunkle Schale 12 × 7 cm mit Bügel) mittig auf den Stirnseiten, bei Länge ≥ 100 cm zusätzlich 2 auf der Längsseite.
- **Draufsicht**: Deckel mit umlaufendem Alu-Rahmen, Kugelecken, Gewerk-Streifen (Schwarz-Modus).
- Alles skaliert mit der Case-Größe (Mindestgrößen, damit kleine Cases nicht überladen: Details ab Korpusbreite ≥ 40 cm).
- [ ] `node --check`, `npm test`, Commit `feat: Flightcase-Look in 2D`.

### Task 5: Flightcase-Look 3D (`js/ui/view3d.js`)
- 12 Kanten als Alu-Profilstäbe (Box 3 × 3 cm, leicht über den Korpus stehend, `metalness .7 roughness .35`); Kugelecken r 4 Chrom; Deckelfuge als umlaufendes Alu-Band (2 cm) bei 25 % Höhe; Butterfly-Verschlüsse (kleine Chrom-Boxen auf dem Band, 2 längs, 1 stirnseitig); Schalengriffe (dunkle, leicht vertiefte Box + Chrom-Bügel) auf den Stirnseiten.
- Korpus-Material: Laminat-Look über `MeshStandardMaterial` mit prozeduraler Canvas-Textur (feine Körnung, einmal erzeugt, geteilt).
- Performance: geteilte Geometrien/Materialien, `InstancedMesh` für Kugelecken, Verschlüsse und Profilstäbe (je Sorte ein InstancedMesh pro Update).
- [ ] `node --check`, Commit `feat: Flightcase-Look in 3D`.

### Task 6: Traversenwagen-Darstellung (2D + 3D)
Reine Geometrie `trussShape(c, p, box)` in `js/model/truss.js` (getestet): zwei Rollwagen (je 60 cm lang, Wagenbreite, Höhe 22, 4 Rollen) an den Enden, darauf `count` Traversenstücke (2 nebeneinander, Lagen übereinander) als Boxen `{ x0…z1 }`.
- 2D: Rollwagen als Rahmen mit Rollen; jedes Traversenstück je Ansicht – Längsansicht: Rechteck aus Ober-/Untergurt (Rohr-Linien) + Zickzack-Diagonalen (Abstand = Traversenbreite); Stirnansicht (Rückansicht): Quadrat mit 4 Gurtrohr-Kreisen an den Ecken; Draufsicht: Gurtlinien + Zickzack. Kein Case-Rahmen, keine Kugelecken. Gewerk-Farbe nur als dünne Kennzeichnung am Wagen.
- 3D: Gurtrohre als Zylinder (r = Breite × 0,085), Diagonalen als Zylinder auf allen 4 Seiten (InstancedMesh), Rollwagen als Alu-Rahmen + 4 Rollen.
- Tests `tests/truss.test.js`: 4 Stück → 2 Lagen × 2 Spalten, alle Stücke innerhalb der Box, Wagen an beiden Enden.
- [ ] TDD, `node --check`, Commit `feat: Traversenwagen realistisch dargestellt`.

### Task 7: Version 0.3.0, Prüfung, Veröffentlichung
- Version 0.3.0 an allen Stellen (Test erzwingt), `sw.js`-Assets um `js/model/truss.js` ergänzen, CHANGELOG-Eintrag.
- Browser-Test (headless Chrome/CDP, Scratchpad-Skript): Plan mit Flightcases, FOH-Pult (nur Lage 1), LED-Cases (Lage 1–2), Racks, 2 Traversenwagen 3 m + 2 m packen → FOH steht am Boden mit nichts darunter, keine Lage > erlaubt, max 4 Lagen, keine Warnungen außer ggf. „einseitig“. Screenshots aller Ansichten, beide Farbmodi, 3D-Nahaufnahme, Druck – mit dem Thomann-Vorbild vergleichen.
- Merge `main`, Tag `v0.3.0`, push, Live-Check.

## Verifikation (Kurz)
- `npm test`: Lagen (Prüfung + Packer), trussDims/trussShape, Import, Presets, Versions-Gleichstand, Offline-Liste.
- Visuell: Screenshots aus headless Chrome in allen Ansichten, beiden Farbmodi, Druck; Live-Check.
