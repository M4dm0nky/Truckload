# Changelog

Versionierung: eine Nummer `Major.Minor.Patch` überall gleich – App-Anzeige, Druck, Export, `package.json`, README, Offline-Cache und Git-Tag.

## V 0.7.1 – 2026-09-23

- Die drei US-Zoll-Vorlagen „Truck Pack“ (45×22,5×30″, ½ und ¼) entfernt – die Bibliothek folgt jetzt durchgehend dem europäischen Truckmaß in cm.

## V 0.7.0 – 2026-09-23

- Import legt vor jedem Überschreiben still eine Sicherung des bisherigen Stands als Datei an und weist erkennbar fehlerhafte oder präparierte Dateien jetzt ab, statt beim nächsten Start unbenutzbar zu werden oder Fremdinhalt in die Oberfläche zu schleusen.
- Speichern meldet einen fehlgeschlagenen Schreibvorgang jetzt sichtbar (Banner „Nicht gespeichert …“) und holt ihn automatisch nach, sobald es wieder klappt; beim Schließen der Seite oder Wechseln der App wird der letzte Stand sofort gesichert, statt in den letzten 400 ms verloren zu gehen.
- Ist Truckload in einem zweiten Tab oder Fenster gleichzeitig geöffnet, erscheint in beiden ein Hinweis darauf – bisher konnte der jeweils andere Stand lautlos überschrieben werden.
- Eine Beschriftung landet jetzt zuverlässig an dem Stück, für das sie getippt wurde, auch wenn man direkt danach ein anderes Case anklickt, ohne vorher aus dem Feld zu wechseln.
- Cases ohne Gewichtsangabe werden ausgewiesen: Inspector und Druck zeigen „N Cases ohne Gewicht“ neben der Nutzlast, und die Warnung „Ladung ist einseitig“ greift jetzt auch dann, wenn kaum Gewichte bekannt sind – der Schwerpunkt wird in diesem Fall ersatzweise über das Volumen geschätzt und als solcher gekennzeichnet.
- Die Auto-Beladung packt flache, stapelbare Cases deutlich platzsparender: 24 Stück eines 120×60×30-cm-Case werden jetzt getippt statt gestellt und brauchen rund 1,20 statt vorher 2,40 Lademeter.
- Rollen überlappen sich nicht mehr bei schmalen Cases (z. B. `AF-1 -CAB`, `SF TourHazer II -CAB`).
- Das „−“ in der Ablage entfernt jetzt gezielt das angeklickte Stück, nicht mehr das erste seines Typs – die Ablage zeigt dafür jedes Stück einzeln mit seiner eigenen Farbe und Beschriftung.
- Case-Editor: Eine Rollenhöhe, die die Case-Höhe erreichen oder überschreiten würde, wird beim Speichern verhindert, statt erst beim nächsten Import auf die eigene Sicherung zu treffen.
- Zahlreiche kleinere Korrekturen aus der Meilenstein-Review V 0.6.0 an Meldungstexten, 3D-Darstellung (Stücknummer, Seitenverhältnis der Beschriftung, sauberer Abbau beim Fehler), Wizard und Bibliothek – Details siehe `docs/code-review-2026-09-21.md` und die Berichte unter `.superpowers/sdd/2026-09-21-review-fixes-v0.7/`.
- Ein Datensatz mit fehlerhaftem Zeitstempel machte die Seite beim Start unbedienbar (kein Planwähler, kein Importieren mehr erreichbar) – jetzt wird ein solcher Zeitstempel bei jedem eigenen Case, Fahrzeug und Ladeplan beim Laden entfernt und der Fehler bricht die Seite nicht mehr ab. Eine Sicherung aus V 0.5/V 0.6 mit einer zu langen Beschriftung oder einer zu hohen Rollenangabe wird jetzt eingelesen und die Anpassung gemeldet, statt die ganze Datei abzulehnen.
- Eine Sicherung aus V 0.5/V 0.6 mit einer zu langen Beschriftung oder einer Rollenhöhe, die die Case-Höhe erreicht, wurde bislang komplett abgelehnt; der Import repariert diese zwei bekannten Altwerte jetzt (Beschriftung gekürzt, Rollen abgewählt) und meldet nach dem Import, was und wie viele Datensätze angepasst wurden. Alles andere bleibt weiterhin Alles-oder-nichts.

## V 0.6.0 – 2026-09-21

- Traversenwagen-Rollwagen nach echtem Vorbild überarbeitet: statt eines massiven Alu-Blocks jetzt ein flaches Rollbrett (Kunststoff, schwarz) mit zwei Auflageleisten je Traversenspur, darunter die vier Lenkrollen – dadurch werden die Wagen 5 cm niedriger (22 → 17 cm); die Rollen selbst bleiben unverändert. Bestehende eigene Traversenwagen rechnen ihre Höhe beim nächsten Laden automatisch neu, keine manuelle Anpassung nötig.

## V 0.5.1 – 2026-09-21

- „BMFL x2 -Motion“: Variante vom Nutzer bestätigt – es sind BMFL Spot (36 kg je Gerät) statt des bisherigen Mittelwerts über Spot, WashBeam und Blade; das Case-Gewicht bleibt bei 105 kg

## V 0.5.0 – 2026-09-20

- 137 Cases aus der eigenen Casemaße-Tabelle mitgeliefert, mit Hersteller im Feld „Inhalt“ und Firma; eigener Abschnitt „Cases aus deiner Liste“ in Bibliothek und Wizard samt Firmenfilter
- Gewichtsschätzungen für 65 dieser Cases aus recherchierten Gerätegewichten, nachvollziehbar in `docs/casemasse-gewichte.md`; zwei weitere Cases (FR10 x2/x6) tragen ihr unverändertes Originalgewicht aus der Tabelle statt einer Schätzung; der Rest bleibt bei 0 kg zum Nachtragen

## V 0.4.0 – 2026-09-20

- Wizard zum Zusammenstellen eines Loads: drei Schritte – Load (Name, Truck), Cases mit Stückzahl wählen, jedes Stück beschriften und einfärben; Knöpfe für neues Case und Sonderbau
- Beschriftung und Farbe je einzelnem Stück, sichtbar auf allen Seiten in 2D, 3D und im Druck
- Rollen pro Case an- oder abwählbar mit Rollenhöhe (Vorgabe 16 cm, Blue Wheel Ø 125 mm) und Wahl, ob das eingetragene Maß die Rollen schon enthält oder sie dazugerechnet werden
- Getippt wird jetzt immer mit den Rollen zur Trucktür, mit vier Richtungsknöpfen im Inspector und der Taste W

## V 0.3.0 – 2026-09-19

- Flightcase-Look nach echtem Vorbild: breite Alu-Hybridprofile an allen Kanten, Chrom-Kugelecken, Deckelfuge mit Butterfly-Verschlüssen, versenkte Schalengriffe, Laminat-Oberfläche – in 2D, 3D und Druck
- Traversenwagen als eigener Typ: Traversenlänge, Traversenbreite (34er / 40er) und Stückzahl eingeben, Wagenbreite 60er oder 80er wird automatisch bestimmt; Darstellung als echte Traverse (Gurtrohre, Streben) auf zwei Rollwagen
- Lagen-Freigabe pro Case (Lage 1–4): Prüfung warnt bei falscher Lage und mehr als 4 Lagen, die Auto-Beladung hält sich daran; Lage im Inspector und in der Ladeliste
- Vorlagen: FOH-Pult und Rack 20 HE nur Lage 1, LED-Wall-Case Lage 1–2, drei Traversenwagen-Vorlagen

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
