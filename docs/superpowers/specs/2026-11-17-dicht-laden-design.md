# Dicht laden: Tippen, Reihen planen, Lücken-Warnung

Stand: 2026-11-17 · Status: Design zur Freigabe

## Warum

Beim echten Laden wird fast alles getippt (rund 95 % der Cases), weil es Platz spart. Vor der
letzten Reihe gibt es keine Lücken, sonst verschiebt sich die Ladung bei der Fahrt. Truckload
bildet beides heute nur teilweise ab:

- „Getippt“ ist im Lade-Wizard für tippbare Cases vorbelegt (`js/ui/load-wizard.js:289`). Drei
  neutrale Vorlagen sind aber fälschlich als nicht tippbar markiert.
- Der Packer stellt die Stapel sortenrein auf. Füllt eine Sorte die Truckbreite nicht, bleibt der
  Rest jeder Reihe frei. Nur die letzte Reihe einer Sorte darf die nächste Sorte auffüllen
  (`placeStacks`, `minX`). Eine Warnung zu Lücken gibt es nicht.

Ziel: Der Nutzer kann dicht laden lassen, und die App sagt, wo noch Luft ist.

## Ziele

1. Datenkorrektur: `preset-mh-2er`, `preset-led-8er` und `preset-distro-63a` werden tippbar.
2. Neue Lade-Option **„Reihen planen“** im Dialog „Pack-Regeln“: Der Packer stellt Reihe für Reihe
   die Mischung von Stapeln auf, die die Truckbreite am besten füllt.
3. **Lücken-Warnung** in beiden Modi: freie Bodenfläche vor der letzten Reihe wird gemeldet.

## Nicht-Ziele

- Keine Änderung an der Stapelbildung (`buildStacks`): Tippen, Lagen, Gewicht, „nichts Schweres
  auf Leichtes“, Deckschicht und maxTopLoad bleiben, wie sie sind.
- Höhenunterschiede zwischen Stapeln zählen nicht als Lücke.
- Kein automatisches Tippen von Stücken, die der Nutzer auf „stehend“ gesetzt hat.
- „Rest einpacken“ bekommt keine Lückenfüllung weiter vorn (bleibt wie heute).

## Anti-Ziele

- Pläne ohne die Option ändern sich nicht. Die Golden-Tests (`tests/packer-golden.test.js`)
  bleiben unverändert grün.
- „Reihen planen“ darf keine bestehende Pack-Regel brechen: Traversenwagen tragen nichts und
  stehen laut Rangliste zuletzt, Gewicht und Lagen gelten weiter.
- Keine Warnflut: Reste, in die kein Stück der Ladung passen könnte, sind keine Lücke.

## Ansätze (entschieden)

- A · Reihe zumachen: zuerst die Sorte stellen, dann die Restbreite mit einem passenden Stück
  füllen. Einfacher, reagiert aber nur auf den Rest.
- B · Nachlauf-Stopfen: Lücken nach dem Packen mit Stücken aus der letzten Reihe füllen. Wenig
  Umbau, hinterlässt hinten neue Löcher, Längslücken bleiben.
- **C · Reihen vorab planen (gewählt, als anklickbare Option):** Je Reihe die Mischung suchen, die
  die Breite am besten füllt. Am dichtesten und so, wie eine Crew denkt.

Die Wahl des Nutzers: C, aber als Option, nicht als neues Standardverhalten.

## Verhalten

### 1. Datenkorrektur

In `data/standard.json` bekommen `preset-mh-2er`, `preset-led-8er` und `preset-distro-63a`
`tippable: true`. Nicht tippbar bleiben `preset-rack-*` und `preset-foh-pult` (Nutzer). Weitere
nicht tippbare Vorlagen (Traversenwagen, Lautsprecher-Dollys) bleiben unverändert.

### 2. Option „Reihen planen“

- **Ort:** Dialog „Pack-Regeln“, direkt unter „Deckschicht mischen“, als Häkchen mit Erklärung
  („Füllt jede Reihe vor dem Stellen so dicht wie möglich, auch mit Cases späterer Sorten.“).
- **Speicherung:** wie `mixTop`. Feld `rowPlan: true` am Plan, fehlt = aus. Es wandert mit
  Regelsets (gespeichert und übernommen), wird in `js/store/io.js` wie `mixTop` geprüft (Boolean
  oder fehlend) und reist mit der Projektdatei. Vorgabe: aus (meine Entscheidung, damit bestehende
  Pläne gleich bleiben).
- **Wirkung beim Packen** („Alles neu packen“, Wizard mit automatischem Packen):
  - Die Stapel entstehen wie heute in `buildStacks`. Nur das Aufstellen ändert sich: statt
    `placeStacks` läuft ein Reihenplaner.
  - Eine Reihe beginnt an der Stirnwand bzw. hinter der vorigen Reihe. Die **führende Sorte** ist
    die erste Sorte laut Rangliste, die noch Stapel hat. Ihre Stapel kommen zuerst in die Reihe.
  - Bleibt Breite übrig, sucht der Planer aus den Stapeln der **späteren** Sorten die Kombination,
    die die Restbreite am besten füllt. Dabei darf ein Stapel im Grundriss um 90° gedreht stehen
    (wie heute `swap`).
  - **Bewertung einer Reihe:** möglichst wenig freie Bodenfläche innerhalb der Reihe. Die
    Reihentiefe ist die größte Tiefe ihrer Stapel; ein flacherer Stapel lässt eine Längslücke,
    die als freie Fläche zählt. Bei Gleichstand gewinnt die Kombination mit Stapeln aus Sorten,
    die in der Rangliste näher an der führenden Sorte stehen, dann die mit weniger Stapeln.
  - **Grenzen der Mischung (Nutzer: nur gleiches Gewerk):** Ein Füllstapel muss zur führenden
    Sorte gehören wie bei der Deckschicht (`belongsTogether`): beide mit Gruppe → gleiche Gruppe;
    beide ohne → gleiches Gewerk (`category`); eins mit, eins ohne → nein. Passt aus dem gleichen
    Gewerk nichts, bleibt der Rest frei und die Lücken-Warnung meldet ihn. Traversenwagen
    (`isTruss`) füllen nie Reihen anderer Sorten und werden nie als Füllstück gewählt; sie
    behalten ihre Rangliste-Position. Gewicht: Wo ein Stapel innerhalb einer Reihe steht, schreibt
    das Design nicht vor. Die bestehende Regel „schwerere Stapel einer Sorte weiter vorn“ gilt
    weiter für die Reihenfolge, in der die Stapel einer Sorte auf die Reihen verteilt werden.
  - Hindernisse (Radkästen, `archBoxes`) und `obstacles` gelten wie heute; passt eine Reihe wegen
    eines Hindernisses nicht, fällt der Planer für diese Stelle auf die heutige Eckensuche zurück.
  - Was am Ende keinen Platz findet, bleibt wie heute in „Noch nicht geladen“.
- **Rechenaufwand:** Die Suche je Reihe ist begrenzt (Builder entscheidet die Methode, z. B.
  Rucksack über die Breite mit Kandidaten je Grundfläche statt je Stapel). Ziel: Ladungen bis
  300 Stücke packen in unter 1 s auf einem normalen Laptop.

### 3. Lücken-Warnung

- **Was zählt:** freie Bodenfläche **quer** in einer Reihe (die Reihe füllt die Breite nicht) und
  **längs** zwischen Reihen (unterschiedliche Tiefen) – jeweils vor der letzten Reihe. Die letzte
  Reihe an der Tür ist ausgenommen. Höhenunterschiede zählen nicht.
- **Ab welcher Größe:** Eine freie Fläche ist eine Lücke ab 25 × 25 cm (feste Mindestgröße,
  Entscheidung der Projektleitung). Ursprünglich war „kleinste Grundfläche eines Stücks der Ladung,
  mindestens 25 × 25 cm“ vorgesehen. Gelten bleibt nur die feste Größe: Eine Lücke lässt die Ladung
  verrutschen, egal ob dort noch ein Stück hineinpassen würde. So warnt 3 × 80 cm in 245 cm Breite nicht.
- **Anzeige:** im vorhandenen Warnungsbereich, wie die anderen Warnungen aus `derive()`:
  „Lücke 45 × 120 cm in Reihe 3“ (Reihe = von der Stirnwand gezählt). Gilt für alle Pläne, auch
  für von Hand platzierte.
- **Radkästen und Hindernisse** zählen nicht als Lücke.
- In Mehr-LKW-Plänen gilt die Warnung je LKW.

### 4. NYX

Neues Feld `rowPlan` an Plan und Regelset. Kein neuer Store. Admin-Schritte kommen oben in
`docs/nyx-*.md` (eigener Abschnitt) und als Kommentar ins NYX-Issue, wie bei früheren Releases.
Ältere Truckload-Stände ignorieren das Feld (prüfen beim Bau, ob `checkCase`/Plan-Prüfung
unbekannte Felder ablehnt; wenn ja, gilt wie bei Set-Teilen: Submodul nicht zurückdrehen).
Ergebnis der Prüfung: `checkPlan`/`checkRuleSet` des Stands 0.31.0 lehnen unbekannte Felder nicht ab.

## Festlegungen aus der Prüfung (meine Entscheidungen, korrigierbar)

1. **„Auffüllen“ in `buildStacks` bleibt:** Das Aufstocken des letzten Stapels einer Sorte mit der
   nächsten (`prevLast`/`mixed`) ist Stapelbildung, nicht Bodenbelegung, und bleibt auch mit
   „Reihen planen“. Ein `mixed`-Stapel zählt für den Planer zu der Sorte, die ihn begonnen hat
   (`stack.sort`).
2. **Gewicht:** Innerhalb einer Sorte werden ihre Stapel nach `ownWeight` absteigend auf die Reihen
   verteilt (schwerere weiter vorn), wie heute. Füllstapel unterliegen keiner Gewichts-Reihenfolge.
3. **Ein Reihenmodell für Planer und Warnung:** Eine Reihe ist eine Gruppe von Stapeln, deren
   x-Bereiche sich überschneiden (Kette: A überschneidet B, B überschneidet C → eine Reihe). Reihen
   werden nach kleinstem x0 von der Stirnwand an nummeriert. Die letzte Reihe ist die mit dem
   größten x0, je LKW.
4. **Messgröße „freie Bodenfläche“:** je Reihe vor der letzten: (Reihentiefe × Truckbreite) −
   belegte Grundfläche − Hindernisfläche, Reihentiefe = x1max − x0min. Summe über die Reihen.
   Grundfläche unter Stapeln zählt immer als belegt, Höhe spielt keine Rolle. Der Test fordert,
   dass die Summe mit „an“ kleiner ist als mit „aus“ (Beispielladung mit festem Erwartungswert).
5. **Mindestgröße einer Lücke:** fest 25 × 25 cm, unabhängig von den Stücken des LKW (geändert
   gegenüber dem ersten Entwurf „kleinste Grundfläche, mindestens 25“): Lücken lassen die Ladung
   verrutschen, ob noch ein Stück hineinpasst oder nicht.
6. **„Rest einpacken“:** Ist „Reihen planen“ an, plant es ab `startX` Reihen wie oben; vor
   `startX` wird nichts gefüllt (wie heute).
7. **Hindernisse:** Rückfall je Stapel: Findet ein Stapel in der geplanten Reihe wegen eines
   Hindernisses keinen Platz, sucht er wie heute per Eckensuche ab dem x0 der Reihe; der Planer
   macht danach mit der nächsten Reihe hinter dem größten belegten x1 weiter.

## Was der Builder entscheidet

- Algorithmus des Reihenplaners (Rucksack, gierig mit Nachbesserung …), solange Bewertung,
  Grenzen und Rechenzeit eingehalten werden.
- Genauer Wortlaut von Option und Warnung (Deutsch und Englisch über `js/i18n/en.js`).
- Wie Reihen bei von Hand platzierten Plänen erkannt werden (z. B. Gruppierung nach x-Bereichen).

## Abnahme

- Datenkorrektur: Test, dass die drei Presets tippbar sind, Racks und FOH-Pult nicht.
- Lücken-Warnung mit Treffer und Nicht-Treffer: 2 × 100 cm Stapel in 245 cm Breite mit einer
  weiteren Reihe dahinter → Warnung „Lücke 45 × …“; 3 × 80 cm → keine Warnung; Lücke nur in der
  letzten Reihe → keine Warnung; Radkasten → keine Warnung.
- Reihen planen: Für eine Mischladung sinkt die freie Bodenfläche vor der letzten Reihe gegenüber
  „aus“ messbar (Kennzahl im Test, nicht per Augenschein). Property-Tests: Gewicht, Lagen,
  Traversen, keine Überlappung, nichts über die Truckgrenzen – mit „an“ genauso wie mit „aus“.
- „Aus“: Golden-Tests unverändert.
- Regelset- und Projektdatei-Rundreise mit `rowPlan`.
- Browser (headless `tools/cdp.mjs`): Option im Dialog, Umschalten + „Alles neu packen“ ändert
  die Ladung, Warnungen erscheinen bzw. verschwinden.
