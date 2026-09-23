# Aufbau der Anwendung

Stand V 0.6.0. Diese Datei beschreibt das Datenmodell, die Schichten und die Invarianten,
die man kennen muss, bevor man etwas ändert.

## Schichten

```
js/data/     reine Datentabellen (Vorlagen, Bibliothek, Gewerke, Fahrzeuge)
js/model/    reine Logik ohne DOM — Geometrie, Prüfung, Aktionen, Packer, Traversen
js/store/    Speicherung (IndexedDB) und Datei-Austausch (JSON)
js/ui/       Darstellung und Bedienung (SVG, Three.js, Dialoge)
js/app.js    der einzige Ort, der den Zustand kennt und alles verdrahtet
```

Die Richtung ist strikt: `ui` benutzt `model`, nie umgekehrt. Module unter `model/` haben
keinen DOM-Zugriff und sind damit vollständig testbar. Wo aus einem UI-Modul rechenbare
Geometrie herausfällt, wandert sie in ein reines Modul — so entstanden
`js/ui/instanceMatrix.js`, `js/ui/labelTexture.js` und `js/ui/caseGroups.js`, die trotz
ihres Ordners keine Three.js- oder DOM-Abhängigkeit haben und eigene Tests besitzen.

`js/app.js` ist bewusst der einzige Ort mit Store-Wissen. Dialoge und Listen bekommen ihre
Daten als Argumente und liefern reine Ergebnisobjekte zurück (`openCaseEditor`,
`openTruckEditor`, `openLoadWizard`).

## Zwei Datenebenen: Case-Typ und Stück

Das ist der wichtigste Unterschied im Modell.

**Case-Typ** — ein Eintrag in der Bibliothek. Maße, Gewicht, Gewerk, Farbe, Rollen,
erlaubte Lagen. Lebt in `plan`-unabhängigen Listen und in IndexedDB.

**Stück** — ein konkretes Exemplar in einem Ladeplan, in `plan.placements[]` (im Truck)
oder `plan.unplaced[]` (Ablage). Trägt `id`, `caseId` und — seit V 0.4.0 — eine eigene
`label` (Beschriftung, höchstens 40 Zeichen) und `color`. Platzierte Stücke haben
zusätzlich `x`, `y`, `z`, `orientation` und `rot`.

`buildItems()` in `js/model/validate.js` führt beides zu `items` zusammen und legt
`it.label` und `it.color` mit Rückfall auf Case-Name und Gewerkfarbe frei. **Alle**
Ansichten, der Inspector und der Druck lesen von dort — nicht selbst aus dem Case.

Der Packer arbeitet auf Stück-Objekten, nicht auf Case-Typen, und übernimmt `id`, `label`
und `color` in die erzeugten Platzierungen. Wer das ändert, verliert beim „Alles neu
packen“ alle Beschriftungen (genau dieser Fehler war bis V 0.4.0 drin).

## Koordinaten und Einheiten

Alles in Zentimetern und Kilogramm.

- `x` = Länge ab Stirnwand, wächst zur **Trucktür** (Heck)
- `y` = Breite ab der linken Wand
- `z` = Höhe ab Ladefläche

`EPS = 0.5` cm ist die Toleranz für alle Überlappungs- und Auflageprüfungen.

## Ausrichtung und Rollenrichtung

`orientation` ist `standing`, `tipLong` oder `tipShort`; `rot` ist 0, 90, 180 oder 270.

`wheelFace(p)` sagt, zu welcher Seite die Rollen zeigen: `bottom` bei stehenden Cases,
sonst `+x`, `+y`, `-x` oder `-y`. `DOOR_FACE` ist `+x`, also die Trucktür.
`rotForWheelFace(orientation, face)` ist die Umkehrung und liefert `null`, wenn die
Richtung für diese Ausrichtung nicht erreichbar ist.

**Fachliche Regel:** Getippt wird immer mit den Rollen zur Tür. `cycleTip` setzt `rot`
entsprechend bei **jedem** Übergang in eine getippte Lage, und `chooseOrientation` im
Packer verwirft getippte Kandidaten ohne Tür-Ausrichtung, sobald es einen mit gibt — die
Rollenrichtung hat Vorrang vor dem Füllgrad.

## Rollen im Maß

Drei Felder am Case-Typ:

| Feld | Bedeutung |
|---|---|
| `wheels` | Rollen vorhanden (fehlt = ja) |
| `wheelH` | Rollenhöhe in cm (fehlt = 12, Vorgabe für neue Cases 16) |
| `dimsInclWheels` | Enthält das eingetragene Maß die Rollen schon? (fehlt = ja) |

`outerDims(c)` liefert das Außenmaß und addiert `wheelH` **nur** bei
`dimsInclWheels === false`. Diese Funktion sitzt in `localDims()`, also in der einzigen
Stelle, an der aus einem Case Maße werden — dadurch ziehen Kollisionsprüfung, Auflage,
Lagen, Schwerpunkt, Packer, 2D, 3D und Druck ohne Sonderfall mit. Anzeigen (Bibliothek,
Inspector, Wizard) müssen ebenfalls `outerDims` verwenden, nicht `c.l/c.w/c.h`.

## Lagen

Ein Case trägt `layers`, eine Teilmenge von 1 bis 4 (fehlt = alle). Lage 1 ist der Boden.
`layerMap()` in `validate.js` berechnet die tatsächliche Lage als 1 plus die höchste Lage
der tragenden Cases. Mehr als vier Lagen sind nicht vorgesehen und werden als Warnung
gemeldet. Der Packer hält sich daran und stapelt nichts Schweres auf Leichteres.

## Traversenwagen

Ein eigener Case-Typ mit `kind: 'truss'` und `truss: { length, width, count }`.

Die Außenmaße werden **immer** aus diesen Parametern gerechnet (`trussDims`), nie von Hand
gepflegt: Länge = Traversenlänge, Breite = 60 oder 80 (je nachdem, ob zwei Traversen in
60 cm passen), Höhe = `DOLLY_H` plus Lagenzahl mal Traversenbreite. Deshalb normalisiert
`normalizeCase()` sie beim Import **und** beim Laden (`normalizeOwnCases` in `repo.js`) —
sonst behält ein vor einer Maßänderung angelegtes Case einen veralteten Wert.

Der Wagen selbst besteht seit V 0.6.0 aus (von unten):

| Bereich | Höhe |
|---|---|
| Rollen (`DOLLY_WHEEL_H`) | 12 cm |
| Rollbrett (`DOLLY_BOARD_H`) | 3 cm |
| Auflageleisten (`DOLLY_RAIL_H`) | 2 cm |
| **Summe `DOLLY_H`** | **17 cm** |

Die Traverse liegt **auf** den Leisten; die unterste Lage beginnt bei `z0 + DOLLY_H`. Bei
zwei Traversen nebeneinander ist neben ihnen kein Platz — deshalb tragen die Leisten, statt
seitlich zu führen. `trussShape()` liefert `dollies` (das volle Wagenvolumen, gebraucht für
die Beschriftungsfläche), `boards`, `rails`, `wheels` und `pieces`. Traversenwagen sind nie
tippbar.

## Speicherung und Austausch

Alles liegt in IndexedDB im Browser. `loadAll()` mischt eigene Cases mit den mitgelieferten:
Bei gleicher ID gewinnt immer das eigene Case, und jede ID kommt genau einmal vor
(`mergeOwnWithBuiltins`) — die Verbraucher bauen daraus eine `Map`, bei der sonst der letzte
gewänne.

Export und Import laufen über ein JSON-Bundle (`js/store/io.js`). Mitgelieferte Cases
(`builtin: true`) landen **nicht** in der Datei; Pläne verweisen weiter per `caseId` darauf.
`parseBundle` prüft streng, weil die Datei von außen kommt. Beim Zusammenführen gewinnt der
neuere `updatedAt`-Stand (`mergeById`).

## Mitgelieferte Daten

| Datei | Inhalt |
|---|---|
| `js/data/preset-cases.js` | 17 generische Vorlagen (Richtwerte) |
| `js/data/case-library.js` | 137 Cases aus der Excel-Tabelle des Nutzers, `source: 'liste'` plus `company` |
| `js/data/categories.js` | Gewerke und ihre Farben |
| `js/data/preset-trucks.js` | Fahrzeugvorlagen |

Die Bibliothek und der Wizard teilen sich die Filterlogik über `js/ui/caseGroups.js`
(`groupCases`, `companiesOf`) und zeigen dieselben drei Abschnitte: eigene Cases,
Vorlagen, Cases aus der Liste.

## Darstellung

`js/ui/projection.js` bildet eine 3D-Box auf die drei 2D-Ansichten ab (Draufsicht, Seite
von links, Rückansicht von der Tür). `js/ui/view2d.js` zeichnet daraus SVG — Flightcase mit
Alu-Profil, Kugelecken, Deckelfuge, Griffen und Rollen, Traversenwagen mit Rollbrett und
Gurtrohren. `js/ui/view3d.js` macht dasselbe in Three.js, mit geteilten Geometrien und
Materialien (`userData.shared` — diese werden beim Aufräumen **nicht** verworfen; alles
selbst Erzeugte muss freigegeben werden).

Beschriftungen stehen auf allen Seiten: in 2D auf jeder sichtbaren Fläche, in 3D als
Canvas-Textur auf vier Seiten plus Deckel (`js/ui/labelTexture.js` liefert die Flächen und
die Schriftgröße, ohne Three.js zu kennen). Die Schriftfarbe wird aus dem **tatsächlichen
Hintergrund** abgeleitet, nicht aus der Stückfarbe — sonst steht dunkle Schrift auf
schwarzem Case.

## Was leicht übersehen wird

- `caseColors(c, mode, itemColor)` braucht den dritten Parameter, sonst kommt die
  Stückfarbe nicht an. Genau das ist in V 0.4.0 in der 3D-Ansicht passiert.
- `setItemLabel` hat Teil-Änderungs-Semantik: ein fehlendes Feld bleibt unverändert, `null`
  oder leerer String entfernt es. Wer beide Felder immer mitgibt, löscht ungewollt.
- `maxlength` in der Oberfläche und die Grenze in `checkPlan` müssen zusammenpassen, sonst
  erzeugt die App Daten, die ihr eigener Import ablehnt.
- Der Packer lässt Stücke in der Ablage, die er nicht unterbringt — sie gehen nicht
  verloren, auch nicht bei fehlendem Case-Typ (`orphans`).
- `issue.code` (`validate.js`) ist ein bewusster Erweiterungspunkt, heute aber nur von den Tests
  gelesen — kein UI-Modul wertet ihn aus, Inspector und Druck zeigen ausschließlich `issue.message`.
  Wer eine Meldung UI-seitig unterscheiden will (Symbol, Filter, Sortierung), findet den Code dafür
  schon vor; ein Tippfehler in einem neuen `add(...)`-Aufruf fällt dabei nur über die Tests auf, es
  gibt keine benannte Konstantenliste.
