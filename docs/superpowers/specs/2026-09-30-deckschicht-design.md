# Pack-Regeln Teil B: Deckschicht mischen – Design

Stand 2026-09-30. Folgt auf `docs/superpowers/specs/2026-09-30-pack-regeln-design.md` (Teil A).
Umsetzungsplan: `docs/superpowers/plans/2026-09-30-deckschicht.md`.

## Context

Seit V 0.8.3 packt der Packer sortenrein: Jeder Block (Case-Typ + Gruppe) bekommt eigene Stapel,
nur Gleiches auf Gleichem. Über den Blöcken bleibt oft Höhe frei, während kleine, leichte Cases
eigene Bodenfläche belegen und Lademeter kosten. Der Nutzer wünscht sich „schwer nach unten, leicht
und klein nach oben“, als zuschaltbare Regel, damit sortenrein die Vorgabe bleibt.

Nutzerentscheidungen (2026-09-30):
- **Umfang:** nur eine **Deckschicht**. Die Blöcke bleiben sortenrein am Boden, in der Reihenfolge
  der Pack-Regeln. Nur der freie Platz **oben** auf den Stapeln wird mit leichteren/kleineren Cases
  aus späteren Blöcken gefüllt.
- **Wer auf wen darf:** Haben beide Stücke eine Gruppe, nur bei gleicher Gruppe. Hat keins eine
  Gruppe, nur bei gleichem Gewerk. Hat eins eine Gruppe und das andere nicht, dann nicht.
- **Gewichte:** „Jedes Case wird ein Gewicht bekommen.“ Die Packcases bekommen sofort ein
  Standardgewicht: das Standard-Packcase 120×60×80 (mit Rollen) 100 kg, die übrigen nach Volumen.

## Packcase-Gewichte (Nutzerangabe)

Vorgabe des Nutzers (2026-09-30): Das Standard-Packcase ist 120×60×60 ohne Rollen, also 120×60×80
hoch mit Rollen. Es wiegt als Standard 100 kg (änderbar), alle anderen Packcases werden danach nach
Volumen ab- bzw. aufgestuft. Die mitgelieferten Packcases sind inklusive Rollen gemessen, die
Referenz ist deshalb der Eintrag „Packcase 120×60×80“. Formel: `round(100 × l·w·h / (120·60·80))`.

| Packcase | Volumen | Gewicht |
|---|---|---|
| 60×60×60 | 0,216 m³ | 38 kg |
| 60×60×73 | 0,263 m³ | 46 kg |
| 80×60×60 | 0,288 m³ | 50 kg |
| 120×60×60 | 0,432 m³ | 75 kg |
| 120×60×73 | 0,526 m³ | 91 kg |
| 120×60×80 | 0,576 m³ | 100 kg (Standard) |
| 120×80×80 | 0,768 m³ | 133 kg |

- Standardwert des Nutzers, kein recherchierter Wert, dokumentiert in `docs/casemasse-gewichte.md`.
- Im Code steht die Formel (`PACK` in `js/data/preset-cases.js`), nicht die einzelnen Zahlen.
  „Änderbar“: Ein anderer Standard ist eine Zeile im Code; für ein einzelnes Case geht es über
  „Case bearbeiten“ (eigene Kopie).
- Mitgelieferte Cases werden bei jedem Start neu erzeugt: Bestehende Loads mit Packcases zeigen das
  neue Gewicht sofort (Nutzlast, Schwerpunkt), die Platzierung ändert sich erst beim nächsten „Alles
  neu packen“ (CHANGELOG).
- Die `legacy`-Einträge („Packcase Truckmaß …“) behalten ihre alten Gewichte.

## Deckschicht

### Daten
- **Load:** neues Feld `mixTop?: boolean`. Fehlt es, gilt `false`, und es wird gepackt wie bisher
  (Regressionstest).
- **Regelset:** optional `mixTop?: boolean` (eigene Entscheidung). Übernimmt man ein Regelset,
  kommt der Schalter mit. Regelsets ohne das Feld setzen ihn auf aus.

### Regel (Packer, `buildStacks`)
Die Blöcke werden weiter in der Reihenfolge der Pack-Regeln gestapelt. Für jedes Stück gilt:
1. wie bisher: den letzten offenen Stapel des vorigen Blocks auffüllen (`prevLast`),
2. wie bisher: auf einen eigenen Stapel mit gleicher Grundfläche,
3. **neu, nur bei `mixTop`:** als **Deckschicht** auf einen Stapel eines **früheren** Blocks,
4. sonst: neuer Stapel am Boden.

Ein Stück darf als Deckschicht auf einen fremden Stapel, wenn alles davon gilt:
- **Zusammengehörig:** Stück und Gründungsstück des Stapels haben beide dieselbe Gruppe, oder
  beide keine Gruppe und dasselbe Gewerk.
- **Pack-Regeln bleiben gewahrt:** Für jede Auswahlregel (Gruppe, Case-Typ, Gewerk, Traversen)
  haben beide Blöcke denselben Rang. Eigene Entscheidung: Eine Deckschicht darf nie dazu führen,
  dass etwas mit „zuletzt“ nach vorn wandert.
- **Kleiner oder gleich:** Die Grundfläche des Stücks passt vollständig auf das oberste Stück des
  Stapels, ungedreht oder um 90° gedreht. Damit liegt es zu 100 % auf, die Auflageprüfung verlangt
  80 %.
- **Leichter oder gleich:** Beide Gewichte sind bekannt (> 0), und das Stück ist höchstens so schwer
  wie das oberste Stück. 0 kg heißt unbekannt: Solche Stücke kommen weder als Deckschicht auf ein
  fremdes Case, noch tragen sie eine fremde Deckschicht (eigene Entscheidung).
- **Wie beim Stapeln bisher:** Das oberste Stück ist stapelbar, `maxTopLoad` wird in der ganzen
  Kette geachtet, die Truckhöhe wird nicht überschritten, höchstens 4 Lagen, und die Lage ist für
  das Stück erlaubt (`pieceLayers`).
- **Keine Traversen**, weder oben noch unten (eigene Entscheidung). Traversenwagen tragen nichts
  Fremdes.

Kandidaten sind die Stapel früherer Blöcke in der Reihenfolge, in der sie entstanden sind. Es
gewinnt der erste passende, also der näher an der Stirnwand. Eine Ebene trägt genau ein Stück,
kleine Cases werden nicht nebeneinander auf einen großen gestellt (eigene Entscheidung, YAGNI).
Das Stück sitzt bündig an der Ecke des Stapels (x0/y0) und dreht sich mit, wenn der Stapel im
Grundriss gedreht wird.

Hat ein Stapel eine Deckschicht, kommt kein Stück seiner eigenen Sorte mehr darauf. Er gilt wie
ein aufgefüllter Stapel als `mixed` und steht innerhalb seines Blocks zuletzt, wie heute beim
Auffüllen.

Folge: Ein Block, dessen Stücke alle als Deckschicht untergekommen sind, belegt keine Bodenfläche.
Das ist gewollt und spart Lademeter.

**Zusammenspiel mit den Lagen:** Die Lagen je Stück gelten unverändert. Der Wizard hakt Lage 1 und
2 vor, ein Stapel aus zwei gleichen Cases ist dann schon voll, und eine Deckschicht bräuchte Lage 3.
Die Deckschicht greift also vor allem dort, wo ein Stapel niedriger bleibt: bei nicht stapelbaren
Sorten auf nur einer Lage, bei einer ungeraden letzten Reihe, oder wenn die kleinen Cases Lage 3
bzw. 4 erlauben. Das wird in der README erklärt, nicht automatisch umgangen (eigene Entscheidung:
eine Lagen-Einschränkung ist eine bewusste Nutzerangabe).

### Oberfläche
- Im Dialog „Pack-Regeln“ unter der Liste steht die Checkbox „Deckschicht mischen: leichtere,
  kleinere Cases derselben Gruppe bzw. desselben Gewerks obendrauf“, dazu der Hinweis „Cases ohne
  Gewicht (0 kg) werden nicht gemischt.“
- Der Schalter wird wie die Regeln mit „Speichern“ bzw. „Speichern und neu packen“ übernommen, in
  einem Undo-Schritt.

### Import/Export
- `checkPlan`: `mixTop` ist optional und muss boolean sein.
- `checkRuleSet`: `mixTop` ist optional und muss boolean sein.
- Alte Dateien ohne das Feld werden angenommen.

## Verifikation
- `npm test` grün.
- Regressionstests:
  - `autoPack` ohne `mixTop` liefert exakt dasselbe wie mit `mixTop: false`.
  - Die bestehenden Packer-Tests bleiben unverändert grün. Wo die neuen Packcase-Gewichte ein
    erwartetes Ergebnis ändern, wird die Änderung begründet und im Test kommentiert.
- Eigenschaftstest: Für zufällige Mischungen mit `mixTop` erzeugt `autoPack` keinen Plan mit
  Placement-Fehlern (`validatePlan`). Die Summe aus Placements und Ablage entspricht der Eingabe.
- Browser: Load im Sattelauflieger, alles ohne Gruppe, im Gewerk „Sonstiges“ und mit `tipped: false`:
  - 12 × Packcase 120×60×80 mit `layers: [1]`: 12 einlagige Stapel in 4 Spuren, also 3 Reihen × 120 cm.
  - 12 × Packcase 60×60×60 mit `layers: [1, 2]`.
  - Ohne Deckschicht bilden die kleinen einen eigenen Block dahinter, 6 Stapel à 2. Mit
    Deckschicht liegen sie in Lage 2 auf den großen, und die Lademeter sinken von 4,80 m auf 3,60 m.
  - Screenshot von Seitenansicht und Draufsicht, dazu `validatePlan` ohne Placement-Fehler.
