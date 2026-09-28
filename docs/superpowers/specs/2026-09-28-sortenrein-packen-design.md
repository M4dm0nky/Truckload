# Sortenrein packen – Design

Stand 2026-09-28, vom Nutzer freigegeben. Umsetzungsplan: `docs/superpowers/plans/2026-09-28-sortenrein-packen.md`.

## Context
Nutzer (2026-09-28), zum Beispiel-Load (10 Mac Viper x2, 16 MLT TWO 2,4 m, 30 Packcases 120×60×60 im Sattel): „Du hast den Load durcheinandergeworfen. Wir versuchen immer sauber und sortenrein zu laden … niemals wird gemischt.“

Heute ([js/model/packer.js](js/model/packer.js)) bildet `buildStacks` Stapel nach **Grundfläche** (`key = dx×dy`) und damit sortenübergreifend. `placeStacks` stellt alle Stapel nach **Gewicht** sortiert per Bottom-Left in den Truck. Dadurch liegen Viper, Packcases und MLTs abwechselnd nebeneinander.

## Regeln (vom Nutzer festgelegt)
1. **Sortenrein:** Eine Sorte ist ein Case-Typ (`caseId`). Jede Sorte wird als zusammenhängender Block geladen, von der Stirnwand zur Tür.
2. **Reihenfolge je Load umschaltbar:**
   - **„Große zuerst“:** Sorten nach Einzelvolumen L×B×H absteigend, **Traversen immer zuletzt**.
   - **„Stückzahl zuerst“:** Sorten nach Anzahl gleicher Stücke absteigend. Bei Gleichstand gilt das größere Volumen, dann der Name.
3. **Reihenende:** Macht eine Sorte ihre letzte Reihe nicht voll, darf die nächste Sorte die freien Spuren **dieser letzten Reihe** füllen. Weiter nach vorn darf sie nie.
4. **Stapeln:** Ein Stapel besteht aus einer Sorte. Nur auf den **letzten, nicht vollen Stapel** einer Sorte darf die nächste Sorte, wenn sie passt (gleiche Grundfläche, Lagen- und Gewichtsregeln wie heute, also nichts Schweres auf Leichtes, `maxTopLoad`).

## Design (Ansatz A: bestehenden Packer sortieren und begrenzen)
**Modell** ([js/model/packer.js](js/model/packer.js)):
- `orderSorts(items, mode)` ist rein und testbar. Sie gruppiert nach `caseId` und ordnet die Gruppen nach Regel 2. `mode` ist `'volume' | 'count'`. Das Volumen kommt aus `outerDims(c)`, Traversen über `isTruss(c)`.
- `buildStacks` läuft **je Sorte**:
  - Stapel nur innerhalb der Sorte (Schlüssel `caseId + Grundfläche`).
  - Danach darf die nächste Sorte zuerst ihre Stücke auf die noch offenen Stapel der **unmittelbar vorigen** Sorte setzen (Regel 4, `canAddToStack` wie bisher).
  - Die bestehenden Regeln bleiben: Lagen je Stück (`pieceLayers`), `tipped`, 4 Lagen höchstens, Stücke ohne Lage 1 kommen nur auf vorhandene Stapel.
- `placeStacks` platziert die Stapel **in Sorten-Reihenfolge** statt nach Gewicht:
  - Jede Sorte sucht per Bottom-Left nur Punkte mit `x ≥ startX`.
  - `startX` der ersten Sorte ist 0 bzw. das Ende der vorhandenen Ladung, siehe „Rest einpacken“.
  - `startX` der nächsten Sorte ist das `x0` der **letzten Reihe** der vorigen Sorte, also das kleinste `x0` unter deren Stapeln mit dem größten `x0`. So füllt sie deren Lücke (Regel 3), kommt aber nie davor.
  - Radkästen und Hindernisse bleiben Hindernisse.
- `autoPack(items, truck, { obstacles, order })`.

**Daten:** Neues Plan-Feld `packOrder: 'volume' | 'count'`. Fehlt es (Altdaten), gilt **'volume'** („Große zuerst“). Das ist eine eigene Entscheidung, weil der Nutzer diese Variante zuerst genannt hat. Der Import ([js/store/io.js](js/store/io.js), `checkPlan`) muss das Feld zulassen und fremde Werte verwerfen (Regressionstest mit Plan im alten Schema). Bestehende Platzierungen ändern sich nicht, erst beim nächsten „Alles neu packen“.

**Aktionen** ([js/model/actions.js](js/model/actions.js)):
- `packAll` und `packRest` reichen `plan.packOrder` durch.
- `setPackOrder(plan, order)`.
- „Rest einpacken“: `startX` der ersten neuen Sorte ist die Tür-Kante der vorhandenen Ladung (größtes `x1`), damit auch die Nachladung sortenrein hinten anschließt. Eigene Entscheidung.

**Oberfläche:**
- Neben „Alles neu packen“ ein Umschalter „Große zuerst / Stückzahl zuerst“ ([index.html](index.html), [js/app.js](js/app.js)). Er wirkt beim nächsten Packen.
- Der Wizard („danach automatisch packen“) nutzt die Einstellung des Loads.

**Doku:** README (Packen), [docs/architektur.md](docs/architektur.md) (Packer), CHANGELOG.

## Tests (TDD, [tests/packer.test.js](tests/packer.test.js) + actions/io)
- `orderSorts`:
  - Bei „volume“ kommt die größte Sorte zuerst, Traversen zuletzt, auch wenn sie groß sind.
  - Bei „count“ kommt die größte Stückzahl zuerst, bei Gleichstand das Volumen.
- **Beispiel-Load** des Nutzers (10 Viper, 16 MLT, 30 Packcases), in beiden Reihenfolgen:
  - Jede Sorte belegt einen zusammenhängenden x-Bereich. Eine andere Sorte kommt nur in der Grenzreihe dazwischen.
  - Kein Stapel mischt Sorten, außer dem erlaubten obersten Auffüllen.
  - „volume“: die Sorten liegen in der Reihenfolge Viper → Packcase → MLT von der Stirnwand zur Tür.
- Regel 3: Eine Sorte mit angebrochener Reihe, deren Lücke von der nächsten gefüllt wird; die nächste Sorte steht nie vor der letzten Reihe der vorigen.
- Regel 4: Nur der letzte offene Stapel wird mit leichterer, gleich großer Sorte aufgefüllt, nicht frühere Stapel.
- Bestehende Packer-Tests (Lagen, Tippen, Radkasten, Ablage bei Platzmangel, Beschriftungen bleiben erhalten) laufen weiter oder werden bewusst angepasst, jeweils mit Begründung.
- io: Plan ohne `packOrder` lädt; `packOrder: 'x'` wird abgewiesen oder entfernt.

## Verifikation
`npm test`. Den Beispiel-Load (`~/Downloads/truckload-backup-2026-09-28.json`) lokal im Browser mit beiden Reihenfolgen „Alles neu packen“ und 2D-/3D-Screenshots prüfen: sortenreine Blöcke von vorn nach hinten.

## Version

Versionsvorschlag vor dem Commit: 0.8.2 → 0.8.3.
