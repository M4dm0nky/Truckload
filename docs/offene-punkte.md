# Offene Punkte

Stand V 0.13.10. Gesammelt aus den Code-Reviews der Versionen 0.3.0 bis 0.7.0, aus den
Änderungen bis 0.8.0, aus dem Aufräumen vor V 0.13.10 und aus Hinweisen des Nutzers. Nichts davon
blockiert den Betrieb; die Reihenfolge ist meine Einschätzung der Nützlichkeit. Erledigtes ist raus.
Die Befunde der Meilenstein-Review V 0.6.0 stehen in `docs/code-review-2026-09-21.md`.

## Daten aus der Casemaße-Tabelle

**Fünf Zeilen fehlen ganz.** Motorsteuerung-Koffer, Bolzenkoffer, FD34 x2, HOF BOLT und
Dolly „Drohne“ hatten kein oder nur ein einzelnes Maß. Bei dreien steht in der Quelle eine
einzelne Zahl, aus der sich kein Case bauen lässt. Der Nutzer wollte sie selbst nachtragen.

**Vier 19″-Racks sind gerechnet.** 1, 4, 5 und 16 HE hatten keine Maße; die Höhe kommt aus
der Höheneinheit (4,45 cm je HE plus 5,68 cm Aufschlag, abgeleitet aus den drei gemessenen
Racks), Breite und Tiefe mit 60 × 60 geschätzt. Echte Maße würden das ersetzen.

**`JDC-1 Cube (4)` und `JDC-1 Cube` sehen nach vertauschten Stückzahlen aus.** Das Case mit
„(4)“ im Namen ist mit 60 × 60 × 58 kleiner als das mit einem Gerät (99 × 60 × 58). Die
Stückzahl kommt allein aus dem Namen; das Gewicht der beiden Zeilen ist entsprechend
fraglich.

**Drei Motorcases sind 240 cm breit** (`D8+ 0,5t CAB x4/x8/x12`). Sie passen nur in die
großen Fahrzeuge und erzeugen anderswo zwangsläufig eine Überstand-Warnung. In der Quelle
sehen Länge und Breite vertauscht aus.

**Der Mindest-Case-Anteil von 15 kg überzeichnet kleine Cases.** Bei `SF TourHazer II`
ergibt das rechnerisch 552 kg/m³. Der Richtwert ist in `docs/casemasse-gewichte.md`
offengelegt, aber für kleine Cases zu konservativ.

## Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen

Die Befunde aus `docs/code-review-2026-09-21.md` sind abgearbeitet. Was davon bewusst offen
geblieben ist, mit Begründung:

- **2D/3D: Schriftfarbe der Beschriftung** (UI-N1). 2D ist fest weiß mit schwarzer Kontur
  (`css/app.css`), 3D leitet sie aus dem Hintergrund ab (`textColorFor` in `view3d.js`). Auf
  einem hellen Case (z. B. Gewerkfarbe Gelb) sieht das unterschiedlich aus; die Kontur rettet
  die Lesbarkeit in beiden Fällen. Der Vorschlag (`textColorFor` nach `caseStyle.js`, in 2D als
  `style`-Attribut setzen) berührt sowohl die Bildschirm- als auch die Druckdarstellung –
  zusammen mit der Kontur-Wechselwirkung ist das mehr als eine Zeile und bräuchte eine eigene
  Browser-Abnahme auf mehreren Case-Farben und im Ausdruck. Nutzen (Konsistenz zwischen
  Ansichten) gegen Risiko (Lesbarkeitsregression im Ausdruck) abgewogen: zurückgestellt.
- **Eine Textmetrik für 2D und 3D** (UI-S3). 2D kürzt Beschriftungen einzeilig mit „…“, 3D
  bricht sie mehrzeilig um und verkleinert die Schrift — zwei sichtbar unterschiedliche
  Ergebnisse für denselben Text. Eine Zusammenführung des eigentlichen Verfahrens (Kürzung vs.
  Umbruch) wäre eine sichtbare Verhaltensänderung, keine reine Aufräumarbeit, und deshalb
  bewusst nicht angefasst (Kommentare an beiden Stellen verweisen aufeinander).
- **Inspector wird bei jedem Bild neu aufgebaut** (Rest von UI-S5). Der Teil, der ohne Risiko
  zu entschärfen war – die Ablage –, ist gefixt (`js/ui/library.js`, `update()` baut die Ablage
  nur noch bei geänderter `plan.unplaced`-Referenz oder geänderten Cases neu). Der Inspector
  selbst bleibt unverändert: er hängt von sehr vielen Feldern gleichzeitig ab (Position, Lage,
  Warnungen, Ladungs-Kennzahlen), die sich während eines Drags des ausgewählten Cases
  tatsächlich bei jedem Bild ändern – ein Diffing wäre entweder grobmaschig (verpasst echte
  Änderungen, genau die Fehlerklasse von UI-B1) oder so fein, dass der Gewinn gegenüber dem
  heutigen `innerHTML`-Aufbau klein wird. Ohne Performance-Beschwerde aus der Praxis nicht
  angefasst.
- **Keine „3D-Ansicht veraltet“-Markierung**, wenn die 3D-Ansicht nach einem Fehler in
  `update()` einfach stehen bleibt, statt neu aufgebaut zu werden — der Nutzer sieht dann
  einen möglicherweise nicht mehr aktuellen Stand, ohne Hinweis.
- **Modellschicht — `caseShape(c, p, box)`/`trussShape(c, p, box)` erzwingen `box === boxOf(c,
  p)` nicht.** Ein Vorgabewert (`box = boxOf(c, p)`) würde die Zusage in die Signatur schreiben,
  ohne die heutigen Aufrufer (die die Box schon haben) zu verlangsamen. Bisher hat kein
  Aufrufer eine andere Box übergeben.
- **Modellschicht — `buildStacks` (`packer.js`) macht drei Dinge in einer Funktion**
  (Orientierung wählen, sortieren, stapeln). Eine eigene `orderForStacking(itemList, truck)`
  wäre für sich testbar, ist aber ein Umbau ohne Verhaltensänderung und deshalb zurückgestellt,
  solange kein konkreter Fehler daran hängt.
- **Modellschicht — Traversen-Maße `l/w/h` werden abgeleitet, aber trotzdem gespeichert.**
  `trussDims()` berechnet die Außenmaße aus `truss: {length, width, count}`; die berechneten
  Werte landen zusätzlich als `l/w/h` am Case und müssen deshalb an zwei Stellen
  nachnormalisiert werden (`normalizeCase` beim Import, `normalizeOwnCases` beim Laden) — ein
  Duplikat, das auseinanderlaufen kann, auch wenn beide Stellen dieselbe Funktion teilen.
  `outerDims(c)` könnte für `isTruss(c)` stattdessen direkt `trussDims(c.truss)` liefern und
  `l/w/h` für Traversenwagen gar nicht persistieren — das ist ein Umbau am Datenmodell mit
  Migrationsbedarf für bestehende eigene Traversenwagen, nicht für diese Version.
- **Modellschicht — `validatePlan` läuft komplett bei jeder Planänderung** (`deriveOf` in
  `js/app/core.js`, nur für denselben Zustand zwischengespeichert). Bei
  den heutigen Plangrößen unkritisch; falls die Placement-Zahl dreistellig wird, ist die
  Kollisionsprüfung (O(n²)) die Stelle, die zuerst spürbar wird. Kein Gitter/Index gebaut,
  solange kein realer Plan das braucht.

## Aus der Gesamt-Review vor dem Merge (2026-09-23) offen gelassen


## Aus dem Leerer-Start/Truss-Wizard-Branch (2026-09-23) offen gelassen

- **„Gestapelt“-Häkchen im Truss-hinzufügen-Dialog überschreibt eine bewusste
  Nutzer-Entscheidung.** Ist die „danach automatisch packen“-Checkbox im Wizard-Schritt
  „Beschriften“ vom Nutzer absichtlich abgewählt, setzt „gestapelt“ sie beim Bestätigen
  trotzdem wieder auf an (`js/ui/load-wizard.js`). Da Auto-Pack ohnehin per Vorgabe an ist,
  gewinnt man dadurch nichts, verliert aber eine getroffene Entscheidung.
- **Stiller `preventDefault()` im Truss-Dialog, falls `splitWagons` wirft**
  (`js/ui/truss-wizard.js`). Heute nicht erreichbar, weil die nativen `required`/`min="1"`-
  Formularprüfungen vorher greifen — falls diese Grenzen je gelockert werden, sähe der
  blockierte Knopf ohne Meldung wie ein Fehler aus.
- **Traversenwagen-Case-Typen aus dem Truss-Dialog werden nicht dedupliziert.** Zweimal
  identisch angelegt (gleiches Profil/Länge/Stückzahl je Wagen) erzeugt zwei separate
  Case-Typen mit demselben Namen in „Eigene Cases“ — auch ein abgebrochener Durchlauf
  hinterlässt seinen Typ dauerhaft. Entspricht dem Verhalten von „+ Neues Case“ (sofort
  speichern, Aufräumen über 🗑), ist hier aber wahrscheinlicher, weil der Dialog auf
  wiederholte Nutzung über mehrere Loads hinweg ausgelegt ist. Eine Wiederverwendung
  vorhandener, exakt passender Case-Typen wäre eine sinnvolle Folge-Aufgabe.

## Aus V 0.7.15 bis V 0.8.0 (2026-09-25 bis 2026-09-27) offen gelassen

- **Mausrad oder Trackpad wird an der Schrittgröße erkannt** (`attachZoom`, `js/ui/zoom2d.js`).
  Zeilen-Modus oder große, rein senkrechte Schritte gelten als Mausrad (zoomen), alles andere
  als Trackpad-Wischen (verschieben). Mäuse mit sehr feinem Scrollen würden den Ausschnitt
  deshalb verschieben statt zoomen. Geprüft ist das nur mit simulierten Eingaben, nicht an
  echter Hardware. Die Knöpfe „−“/„+“ funktionieren in jedem Fall.
- **Die Dolly-Breite der Pre-Rig-Traversen ist geschätzt.** Belegt ist nur, dass die Traverse
  das breiteste Teil ist (Nutzerangabe). Der Einzug von 2 cm je Seite (`STAND_DOLLY_INSET`) ist
  eine optische Annahme ohne Einfluss aufs Packen. Ein echtes Maß würde ihn ersetzen.
- **Wizard-Stücke tragen `layers: [1, 2]` als gespeicherte Einschränkung**, weil die Vorbelegung
  seit V 0.7.15 nicht mehr alle erlaubten Lagen umfasst. Erlaubt ein Case-Typ später mehr oder
  weniger Lagen, kommt das bei diesen Stücken nicht an; die Schnittmengenregel
  (`pieceLayers`) verhindert nur, dass ein Stück mehr darf als sein Typ.
- **Zoom: Beschriftungen und Linien wachsen mit.** Sie sind in Truck-Einheiten gezeichnet und
  werden beim Hineinzoomen entsprechend größer bzw. dicker. Beim Prüfen der Abstände hilft das
  eher, bei sehr starkem Zoom verdeckt die Schrift aber mehr vom Case.

## Aus den Pack-Regeln (2026-09-30) offen

- **Eine Ebene trägt nur ein Stück.** Die Deckschicht (seit V 0.8.6) stellt kleine Cases nie
  nebeneinander auf ein großes, auch wenn nebeneinander noch Platz wäre (eigene Entscheidung,
  YAGNI) — Nutzen gegen Aufwand einer echten Bin-Packing-Lösung innerhalb einer Lage abgewogen.
- **0-kg-Cases mischen nicht.** Ein Case ohne Gewichtsangabe kommt weder als Deckschicht auf ein
  fremdes Case, noch trägt es eine fremde Deckschicht — 0 kg heißt unbekannt, nicht leicht.
- **Die Lagen-Vorgabe 1+2 begrenzt die Deckschicht.** Der Wizard hakt Lage 1 und 2 vor; ein
  Stapel aus zwei gleichen Cases ist damit schon voll, eine Deckschicht bräuchte Lage 3. Das wird
  in der README erklärt, nicht automatisch umgangen — eine Lagen-Einschränkung ist eine bewusste
  Nutzerangabe.
- **Die Packcase-Gewichte sind eine Auslegung der Nutzerangabe**, kein recherchierter Wert:
  100 kg fürs Standard-Packcase 120×60×80 (mit Rollen), die übrigen linear nach Volumen. Siehe
  `docs/casemasse-gewichte.md`.
- **Keine automatische Motor-Erkennung.** Eine Regel auf „Motoren“ trifft nur, was der Nutzer
  selbst über die Gruppe oder den Case-Typ als Motor kennzeichnet — es gibt keine Erkennung
  über Gewicht, Name oder Gewerk.
- **Gruppen- und Gewerk-Regeln verweisen über den Wert auf den Namen**, nicht über eine feste
  ID (Case-Typ-Regeln dagegen speichern die `caseId` — ein umbenannter Case-Typ bricht sie
  nicht). Benennt man eine Gruppe oder ein Gewerk danach um, greift die Regel nicht mehr — der
  Dialog zeigt sie dann ausgegraut mit „(nicht in diesem Load)“, löscht sie aber nicht
  automatisch.
- *Erledigt (Abschluss Teil 1):* Regelset überschreiben und löschen fragen nun per `showConfirm`
  nach (`persistence.saveRuleSet`/`deleteRuleSet`). Rückgängig machen lässt sich ein Löschen weiterhin nicht.

## Aus dem Aufräumen vor V 0.13.10 bewusst offen gelassen

- **Restrisiko Service-Worker-Mischstand.** Siehe unter „Kleinigkeiten“ (Versionsmix bei langsamem
  Netz); der Schutz „ein Stand pro Seitenaufruf“ (`docs/architektur.md`, „Service Worker und
  Ladefehler“) schließt ihn nicht aus. Bewusst akzeptiert, der Ladefehler-Hinweis fängt den Rest.
- **Zahlenformate in Case-Texten.** `caseLine` (Wizard, Materialseite) und `caseDetail` (Seitenleiste)
  in `js/ui/caseInfo.js` geben Zahlen unformatiert aus (kein Runden, Punkt als Dezimaltrennzeichen), `trussLabel` schreibt die Länge dagegen mit Komma („2,40 m“). Auch inhaltlich weichen die
  beiden Zeilen für dasselbe Case ab (Traverse: `kg/Stück` und Wagenbreite hier, Profil und Länge dort).
  Vereinheitlichen wäre eine sichtbare Textänderung.

## Kleinigkeiten

- Der Firmenfilter springt still auf „Standardkatalog“, wenn die gewählte Firma aus den Daten
  verschwindet. Praktisch nur erreichbar, wenn man das letzte eigene Case einer Firma
  löscht.
- Der Wizard schreibt jedem Stück eine ausdrückliche Farbe, auch wenn sie der Gewerkfarbe
  entspricht. Ändert man später das Gewerk oder die Case-Farbe, bleiben die Stücke auf dem
  alten Wert.
- Die Truss-Zeile im Wizard schreibt „X kg/Stück“, obwohl `c.weight` das Gesamtgewicht des
  Wagens ist.
- Der Inspector kann bei stehenden Cases „Stehend, 180°“ anzeigen — richtig, aber für den
  Nutzer verwirrend.
- Tippen kann Nachbarn überlappen, weil nur `z` nachgeführt wird, nicht `x`/`y`. Das
  verhält sich seit jeher wie „Drehen“, und die Prüfung meldet es.
- *Erledigt (Abschluss Teil 1):* Die Taste T schaltet um (`toggleTip`, `js/model/geometry.js`):
  getippt (auch vom Packer) -> `standing`, stehend -> erste getippte Lage. Den Schritt-Weiter
  `cycleTip` gibt es nicht mehr.
- Im Wizard neu angelegte Cases bleiben in der Bibliothek, auch wenn man den Wizard danach
  abbricht. Entspricht dem Verhalten des Case-Editors.
- `toPiece` in `js/model/actions.js` listet die Stück-Felder einzeln auf. Ein künftiges
  neues Feld muss dort nachgezogen werden, sonst geht es beim „Alles neu packen“ verloren.
- Das Druckspalten-Layout bei sehr langen Beschriftungen ist nie geprüft worden. Durch die
  40-Zeichen-Grenze entschärft.
- Der Sicherheitsfaktor bei `CHAR_ASPECT` im Druckpfad (`estimateTextWidth`,
  `js/ui/labelTexture.js`) ist eine grobe Schätzung ohne echte DOM-Messung im Druckmodus –
  gedruckte Beschriftungen können ihren Kasten um rund ein Zeichen überragen.
- Die 3D-Beschriftung rundet das Seitenverhältnis auf 0,25-Schritte (Cache-Schlüssel), damit
  bleibt eine Restverzerrung von bis zu 33 % auf schmalen Flächen.
- Der 3D-Ansicht fehlt ein `disposed`-Flag; ein doppelter `dispose()`-Aufruf ist nicht
  gesondert abgesichert (heute nicht erreichbar, weil unter `js/app/` nichts `dispose()` der
  3D-Ansicht aufruft).
- Der senkrechte Rand der Avery-Bögen 3425 und 3474 ist nicht aus Herstellerangaben belegt —
  die öffentlich auffindbaren Quellen nennen ihn nicht, und die eine mit Zahlen widerspricht
  sich selbst. Das Etikettenraster wird deshalb senkrecht zentriert. Waagerecht ist es
  eindeutig (2 × 105 = 3 × 70 = 210 mm = A4-Breite). Sitzt der Druck auf einem echten Bogen
  daneben, ist `align-content` in `css/print.css` die Stellschraube.
- Andere Haftpapier-Formate als 3425 und 3474 gibt es nicht. Ein weiteres Format braucht einen
  Eintrag in `#print-label-size`, eine Rasterregel in `css/print.css` und dessen Maße.
- Die Abhakliste nennt keine Lage und keine Position. Auf der Rampe reicht die Ladereihenfolge;
  ob jemand dort zusätzlich die Lage sehen will, ist nicht geklärt.
- Die Lagen-Auswahl endet bei „bis 3“. Für den vorgesehenen Bereich reicht das (ab Lage 5 warnt
  `validate.js`), aber in einem Load mit 5 Lagen – der gewarnt, nicht verhindert wird – lassen
  sich die Lagen 1–4 nicht gemeinsam freistellen.
- Service-Worker, Versionsmix bei langsamem Netz: Dateien, die ein Seitenaufruf schon frisch vom
  Netz bekommen hat, bleiben frisch, auch wenn spätere Dateien nach einem Timeout aus dem Cache
  kommen. Ein Mix aus neuem und altem Stand ist dadurch nicht ganz ausgeschlossen; in dem Fall
  zeigt index.html den „Bitte neu laden“-Hinweis. Bewusst akzeptiert.

## Ideen, die noch niemand beauftragt hat

- Gewichte im Inspector schnell nachtragen können, ohne den Case-Editor zu öffnen.
- Mehrere Trucks je Show, mit Verteilung der Cases auf die Fahrzeuge.
- Ladereihenfolge nach Ausladereihenfolge statt nach Position.
- Grund fürs Liegenbleiben in der Ablage anzeigen. Mit der Vorgabe „getippt“ landet ein
  tippbares Case, das nur stehend passt, nach „Alles neu packen“ ohne erkennbaren Grund in
  der Ablage (`piece.tipped:true` erzwingt tipLong/tipShort, `chooseOrientation` liefert dann
  `null`, obwohl „stehend“ gepasst hätte) — der Nutzer sieht nur, dass es nicht platziert
  wurde, nicht warum. Die Ablage könnte den Grund benennen.
