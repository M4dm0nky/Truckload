# Changelog

Versionierung: eine Nummer `Major.Minor.Patch` überall gleich – App-Anzeige, Druck, Export, `package.json`, README, Offline-Cache und Git-Tag.

## V 0.12.4 – 2026-10-09

Fahrzeugliste nach den Begriffen aus der Praxis: Sprinter kurz/lang, 3,5-t-, 7,5-t-, 12-t- und
18-t-Koffer sowie drei Trailer – „Trailer 40 t Koffer“, „Trailer 40 t Koffer extra hoch“ und
„Trailer 40 t Gardine“ (Curtainsider).

- Innenmaße und Nutzlast von 7,5 t, 12 t und 18 t aus Verleiherangeboten, die Trailer auf
  13,62 × 2,48 m (Herleitung und Quellen: `docs/fahrzeugmasse.md`). Richtwerte, mit dem echten
  Fahrzeug abgleichen.
- Neu: Sprinter kurz, 18-t-Koffer, Trailer Gardine. Die bisherigen Fahrzeuge behalten ihre IDs,
  gespeicherte Pläne laden weiter.

## V 0.12.3 – 2026-10-09

Wagengrößen sind von Firma zu Firma verschieden – deshalb jetzt im Dialog sichtbar und änderbar.

- **Dolly-Dialog (Boxen):** „Wagen Breite“ und „Wagen Tiefe“ in cm, vorbelegt mit Boxbreite und der
  bisherigen Stufe 60/80/120; darunter steht „Wagen: B × T“. Die Wagenhöhe bleibt fest. In der
  Case-Liste zeigt jeder Dolly-Stack seine Wagengröße.
- **Traversen-Dialog:** „Wagenbreite (cm)“, vorbelegt mit der bisherigen Automatik (60 für 34er,
  80 für 40er). Nur die Breite zählt; die Länge bestimmt die Traverse. Gespeichert als
  `truss.wagonW`; Wagen ohne diesen Wert laden unverändert.
- Die drei festen Traversenwagen-Vorlagen (34er 3 m/2 m, 40er 3 m) sind entfernt. Ladepläne, die
  genau diese Vorlagen enthalten, zeigen die Stücke danach als fehlendes Case. Die Pre-Rig-Wagen
  (MLT/Prolyte) bleiben.

## V 0.12.2 – 2026-10-08

Dolly-Stacks belegen im Truck jetzt die echte Dolly-Tiefe: 60, 80 oder 120 cm, je nachdem, was
die Boxentiefe aufnimmt (so passen 4, 3 bzw. 2 Dollys nebeneinander in den Trailer). Vorher
zählte nur die nackte Boxentiefe – sechs K2-Stacks nebeneinander, in echt unmöglich. In 3D sitzen
die Boxen vorn bündig auf dem Dolly, hinten bleibt er frei.

- Bereits gespeicherte Dolly-Stacks werden beim Laden auf die neue Tiefe umgestellt. Bestehende
  Ladepläne danach einmal „Alles neu packen“ – sonst überlappen die breiteren Stacks.

## V 0.12.1 – 2026-10-08

Die 8 alten festen Vorlagen „…4er/6er (auf Dolly)“ aus V 0.10.0 sind entfernt. Dolly-Stacks
entstehen nur noch über den Dolly-Dialog beim Einladen. Ladepläne, die genau diese alten
Vorlagen enthalten, zeigen die Stücke als fehlendes Case.

## V 0.12.0 – 2026-10-08

Line-Array-Boxen und Subs sehen in der 3D-Ansicht jetzt wie Lautsprecher aus, nicht mehr wie
Cases:

- Jede Box eines Dolly-Stacks ist ein eigenes Gehäuse: vorn ein helleres Grillefeld im Rahmen
  (bei breiten Boxen wie K2/KS28 zwei Felder mit Mittelsteg) und ein Marken-Badge, an den Seiten
  Rigging-Platte und Griffstange, hinten schlicht.
- Array-Tops haben das typische Keilprofil – gestapelt vorn eine gerade Front, hinten die
  Keil-Lücken zwischen den Elementen. Subs bleiben quaderförmig.
- Gehäusefarbe je Hersteller (L-Acoustics dunkles Graubraun laut Herstellerangabe, sonst
  schwarz). Die Gewerk-/Stückfarbe sitzt als dünne Marke am Dolly-Rahmen, die Beschriftung
  hinten unten und klein oben – nicht mehr groß auf allen Seiten.
- Mit „R“ gedreht zeigt die Front in die gewünschte Richtung.
- Bereits gespeicherte Dolly-Stacks aus früheren Versionen werden beim Laden automatisch
  umgestellt (auch solche mit der ganz alten ID) – Maße und Gewichte bleiben unverändert.

## V 0.11.4 – 2026-10-08

Anhand eines Nutzer-Fotos nachgebessert: die Front einer Lautsprecher-Box ist jetzt eine
texturierte Lochgrille in dunklem Anthrazit statt einer glatten Fläche, dazu ein kleines
goldfarbenes Marken-Badge je Einzelbox. Außerdem behoben: ein bereits gespeicherter Dolly-Stack
(z. B. aus einem früheren Test) bekam bei erneutem Dialog-Lauf nie die neuesten Felder/die
neue Darstellung – der Case-Typ wird jetzt bei jedem Lauf frisch berechnet.

## V 0.11.3 – 2026-10-08

Die Fuge zwischen gestapelten Lautsprecher-Boxen (V 0.11.2) war bei normaler Kamera-Distanz im
Truck praktisch unsichtbar – ein paar Zentimeter Tiefe verschwinden aus ein paar Metern
Entfernung. Ersetzt durch ein helles, umlaufendes Nahtband, das über Farbkontrast statt Tiefe
sichtbar bleibt, wie am echten Vorbild.

## V 0.11.2 – 2026-10-08

Der erste 3D-Lautsprecher-Look (V 0.11.1) sah noch wie ein einzelnes großes Case aus. Anhand
echter Produktfotos (L-Acoustics K2-CHARIOT) nachgebessert: jede Einzelbox im Stack ist jetzt
eine eigene Box mit sichtbarem Spalt zur nächsten (statt einer Linie) – die Stückzahl lässt
sich auf einen Blick abzählen. Der Dolly ist ein offener Rahmen mit auffällig gelben Rollen
statt der unauffälligen Case-Rollen.

## V 0.11.1 – 2026-10-08

Die neuen Audio-Dolly-Stacks sahen in der 3D-Ansicht wie ein normales Flightcase aus (Kugel-
ecken, Deckelfuge, Griffe), nicht wie PA-Lautsprecher. Eigener 3D-Look: keine Flightcase-
Details mehr, stattdessen Trennbänder zwischen den gestapelten Einzelboxen und eine Grille-
Andeutung auf allen Seitenflächen. Die Dolly-Rollen bleiben unverändert korrekt, die 2D-Ansicht
ist nicht betroffen.

## V 0.11.0 – 2026-10-07

Line-Array-Elemente und Subwoofer stehen in der Praxis immer auf einem Dolly mit
Schwerlastrollen – nie lose auf dem Boden. Die 13 Audio-Einzelbox-Vorlagen (Gewerk „Ton“)
bekommen beim Hinzufügen im Lade-Wizard jetzt immer einen Dolly-Dialog, der nur die Stückzahl
übereinander abfragt (siehe [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)).

- Jede Stückzahl ist möglich, statt nur fester 4er-/6er-Pakete – der Dialog baut daraus einen
  eigenen Case-Typ, der danach wie gewohnt per „+“/„−“ weiter bearbeitet werden kann.
- Die 8 bisherigen festen „…4er/6er (auf Dolly)“-Vorlagen sind dafür zu `legacy` geworden:
  alte Ladepläne laden unverändert weiter, tauchen im Katalog aber nicht mehr auf.

## V 0.10.0 – 2026-10-06

Neues Gewerk „Ton“: 21 neutrale Vorlagen für Line-Array- und Sub-Lautsprecher von sechs
Herstellern (L-Acoustics, d&b, Meyer Sound, Martin Audio, RCF, Nexo), recherchiert mit Quelle
(siehe [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)).

- 13 Einzelbox-Vorlagen (Array-Tops stehend wie geflogen, Subs liegend) sowie 8 fertige
  4er-/6er-Stacks „auf Dolly“ für die Array-Tops – die reale Transporteinheit, keine
  Einzelboxen, die man selbst stapelt.
- Subwoofer bekommen bewusst keine feste Stack-Vorlage: Sie liegen flach und werden beim
  Laden ganz normal gestapelt, wie viele passen richtet sich nach Platz und Gewicht im Truck.
- Alle Vorlagen sind neutral (kein `company`-Feld) und erscheinen im Lade-Wizard daher auch
  im Standardfilter „Neutral“ aus V 0.9.3.

## V 0.9.3 – 2026-10-06

Der Firmen-Filter im Lade-Wizard steht standardmäßig auf „Neutral (Standard)“, nicht mehr auf
„Alle Firmen“.

- Firmen-gebrandete Cases (z. B. die „-CAB“-Geräte aus deiner Liste) tauchen damit nie von
  selbst in der Auswahl auf – nur noch „Eigene Cases“ und die neutralen Vorlagen. Die Gruppe
  „Cases aus deiner Liste“ bleibt leer, bis du gezielt eine Firma wählst.

## V 0.9.2 – 2026-10-05

2D und 3D haben jetzt getrennte Aufgaben.

- **2D ist die nüchterne Planungsansicht – „Tetris“.** Jedes Case ist ein Rechteck in
  seinem echten Außenmaß **mit** Rollen, also genau die Fläche, die es im LKW belegt. Vorher
  zeichnete 2D Alu-Profil, Kugelecken, Verschlüsse und Griffe und die Rollen als Kreise
  außerhalb der Kiste – man sah Lücken, die in Wahrheit belegt waren.
- Ein dunkler Streifen an einer Kante zeigt die Rollenzone in echter Tiefe, z. B. bei
  getippten Cases zur Tür. Der Farbumschalter Schwarz / Gewerk / Gewicht wirkt weiter; im
  Modus Schwarz trägt ein dünner Rahmen die Gewerkfarbe.
- Traversenwagen sind in 2D Kästen mit Gitterstruktur: längs mit Gurten und Zickzack, von
  der Stirn mit Diagonalkreuz.
- **3D bleibt die reale Ansicht** – unverändert.
- Der gedruckte Ladeplan zeigt dieselbe nüchterne Darstellung.

## V 0.9.1 – 2026-10-04

Zwei Entscheidungen aus V 0.9.0 nachgezogen, die ich dort eigenmächtig getroffen hatte.

- **Lagen-Durchsicht jetzt auch in 3D:** höhere Lagen werden dort ausgeblendet statt blass
  gezeichnet – ein sauberer Schnitt durch die Ladung. Das ausgewählte Case bleibt sichtbar.
  Welche Stücke betroffen sind, entscheidet in 2D und 3D dieselbe Regel.
- **Etiketten passen auf Haftpapier:** Avery Zweckform 3425 (105 × 57 mm, 10 je Bogen) und
  3474 (70 × 37 mm, 24 je Bogen). Diese Druckart geht dafür auf A4 hoch und randlos, der
  Schnittrahmen entfällt. Ladeplan und Abhakliste bleiben A4 quer. Der senkrechte Rand ist
  nicht aus Herstellerangaben belegt und deshalb zentriert – vor dem ersten Bogen einen
  Testdruck gegen einen Etikettenbogen halten.

## V 0.9.0 – 2026-10-04

Vier Funktionen aus der Wettbewerbsrecherche (truckpacker.com). Übernommen wurden nur Ideen,
die in der Logistik Allgemeingut sind; Layout, Wortlaut und Code des Wettbewerbers nicht.

- **Farbmodus „Gewicht“** neben „Schwarz“ und „Gewerk“: schwer rot, leicht blau, abgestuft
  über die Spanne der Stücke MIT bekanntem Gewicht in dieser Ladung. Ein Case mit 0 kg heißt
  „unbekannt“, nicht „am leichtesten“, und bleibt neutral grau. Traversenwagen behalten in
  jedem Modus ihre Markenfarbe.
- **Lagen-Durchsicht:** die Auswahl „Lagen“ zeichnet alles oberhalb der gewählten Lage blass,
  so dass die darunterliegenden Cases lesbar werden, ohne dass der Zusammenhang verschwindet.
  Bewusst nur in den 2D-Ansichten – in 3D kann man umherfahren. Der Ausdruck zeigt weiter
  alle Lagen.
- **Abhakliste** als zweite Druckart: je Stück eine Zeile in Ladereihenfolge mit Nummer,
  Farbpunkt, Beschriftung und Kästchen, unten eine Unterschriftszeile. Zweispaltig; rund
  40 Cases passen auf ein Blatt.
- **Case-Etiketten** als dritte Druckart: ein Bogen zum Zerschneiden, je Stück ein Etikett mit
  großer Ladenummer, Beschriftung, Farbbalken und „3 von 17“. Zwei Größen: 105 × 57 mm
  (6 je Bogen) und 70 × 37 mm (15 je Bogen). Metrisch gewählt, auf kein bestimmtes Haftpapier
  abgestimmt.

Alle drei Druckarten drucken auf A4 quer.

## V 0.8.11 – 2026-10-02

- Neue Farbpalette: Dunkelmodus jetzt in „Amber + Indigo“ statt dem bisherigen Grauton
  mit Bernstein-Akzent. Der Hellmodus ist entsprechend angepasst. Cases bleiben wie bisher
  schwarz mit Alu-Kanten, unabhängig vom Modus.

## V 0.8.10 – 2026-10-02

- Die Bearbeiten-/Löschen-Symbole in der Materialliste sind jetzt echte Symbole statt Emoji
  (✎/🗑) – die sahen je nach Betriebssystem unterschiedlich aus und passten nicht zum
  sonst einheitlich dunklen bzw. hellen Design. Der Löschen-Knopf ist jetzt zusätzlich rot
  markiert, wie der entsprechende Knopf im Inspector.

## V 0.8.9 – 2026-10-01

- Kleine interne Aufräumarbeit nach einem Code-Review der letzten Case-Gewichte-Recherche:
  keine sichtbare Änderung an Maßen, Gewichten oder Bedienung.

## V 0.8.8 – 2026-09-30

- Korrektur: „FD34 2m CUSTOMIZE“ und „Slick“ sind aus deiner Liste entfernt. Beide
  waren Traversen-Reste-Cases mit 0 kg – die falsche Begründung dafür war, du würdest die
  enthaltene Traverse beim Aufbau selbst wägen. Tatsächlich baust du Traversen über
  „+ Traverse hinzufügen“, dort ist das Gewicht je Profil längst hinterlegt. Alte
  Ladepläne mit diesen beiden Cases laden unverändert weiter.

## V 0.8.7 – 2026-09-30

- 24 Cases aus deiner Liste, die bisher 0 kg trugen (u. a. Powerlock-Verteiler, Dimmerracks,
  MLVT-Verteiler, Laka-Loom-Kabelsätze, ChamSys Wing Compact, Intellipix), haben jetzt ein
  recherchiertes oder mit dir abgestimmtes Gewicht. Quellen und Herleitung stehen in
  „docs/casemasse-gewichte.md“.
- Vier Einträge („Lakabaum (flach)“, „Lakabaum (Transflex)“, „63A VT Haube“,
  „Rigpack“) sind auf deinen Wunsch aus der Auswahl entfernt. Alte Ladepläne zeigen sie
  unverändert weiter.
- Bestehende Loads mit diesen Cases zeigen das neue Gewicht sofort in Nutzlast und Schwerpunkt.
  Die Platzierung ändert sich erst beim nächsten „Alles neu packen“.

## V 0.8.6 – 2026-09-30

- Neuer Schalter „Deckschicht mischen“ im Dialog „Pack-Regeln …“: Leichtere, kleinere Cases derselben Gruppe (oder, wenn beide keine Gruppe haben, desselben Gewerks) steigen auf die freie Höhe eines Stapels weiter vorn, statt eigene Bodenfläche zu belegen. Der Boden bleibt sortenrein, die Pack-Regeln bleiben gewahrt, die Lagen je Stück gelten weiter. Cases ohne Gewicht (0 kg) und Traversen mischen nicht. Der Schalter gilt je Load und wird im Regelset mitgespeichert.
- Die leeren Packcases haben jetzt ein Standardgewicht statt 0 kg: Das Standard-Packcase 120×60×60 ohne bzw. 120×60×80 mit Rollen wiegt 100 kg, die übrigen Maße nach Volumen (60×60×60 = 38 kg bis 120×80×80 = 133 kg).
- Bestehende Loads mit Packcases zeigen das neue Gewicht sofort, Nutzlast und Schwerpunkt ändern sich entsprechend. Die Platzierung ändert sich erst beim nächsten „Alles neu packen“. Dabei kann ein Load anders gepackt werden als vorher, weil nie Schweres auf Leichtes kommt, und in seltenen Fällen bleibt ein Stück mehr in „Noch nicht geladen“.

## V 0.8.5 – 2026-09-30

- Neben „Alles neu packen“ gibt es jetzt „Pack-Regeln …“: eine Rangliste, mit der man selbst festlegt, in welcher Reihenfolge die sortenreinen Blöcke von der Stirnwand zur Tür stehen. Oben steht die wichtigste Regel, bei Gleichstand entscheidet die nächste.
- Eine Regel spricht Traversen, eine Gruppe, einen Case-Typ oder ein Gewerk an und schiebt den passenden Block „zuerst“ (Stirnwand) oder „zuletzt“ (Tür), zum Beispiel „Gruppe Motoren: zuletzt“. Dazu kommen „Große zuerst“ und „Stückzahl zuerst“, jetzt als Regeln in derselben Liste.
- Jedes Stück kann eine eigene Gruppe bekommen (z. B. „Motoren“): im Wizard-Schritt „Beschriften“, mit „Gruppe auf alle übernehmen“ für alle Stücke eines Case-Typs auf einmal, oder nachträglich im Inspector. Stücke mit unterschiedlicher Gruppe bilden beim Packen eigene Blöcke, auch wenn sie vom selben Case-Typ sind.
- Eine Rangliste lässt sich als Regelset unter einem Namen sichern und in jedem anderen Load im Abschnitt „Regelsets“ mit „Übernehmen“ wieder einsetzen. Regelsets kommen mit in „Sichern“ und „Importieren“. Speichern unter einem vorhandenen Namen überschreibt das Regelset ohne Rückfrage.
- Alte Loads ohne eigene Rangliste packen unverändert weiter: Es gilt automatisch die bisherige Reihenfolge aus „Große zuerst“ bzw. „Stückzahl zuerst“.
- Ist Truckload beim Update noch in einem anderen Fenster in der alten Version offen, sagt die App jetzt, dass man es dort schließen soll, statt still hängenzubleiben.

## V 0.8.4 – 2026-09-28

- Beim sortenreinen Packen steht jede Sorte jetzt in eigenen Spuren ab der Wand. Vorher setzte der Packer den ersten MLT-Wagen neben die letzte Reihe der vorigen Sorte (z. B. neben Packcases mit 60 cm Breite). Dadurch passten nur 3 statt 4 MLTs nebeneinander. Jetzt stehen 4 × 62 cm nebeneinander im 248-cm-Auflieger. Der Beispiel-Load braucht damit bei „Große zuerst“ 8,6 m statt 10,6 m.
- Passt eine Sorte nirgends in ihre Spuren, etwa neben den Radkästen im Transporter, sucht der Packer wie bisher frei nach einem Platz.

## V 0.8.3 – 2026-09-28

- Automatisch gepackt wird jetzt sortenrein: Jeder Case-Typ kommt als eigener Block, von der Stirnwand zur Tür, statt dass verschiedene Cases durcheinander nebeneinander und übereinander stehen.
- Neben „Alles neu packen“ wählt man je Load die Reihenfolge:
  - „Große zuerst“ (Vorgabe): nach Größe des einzelnen Cases, Traversen immer zuletzt.
  - „Stückzahl zuerst“: der Case-Typ mit den meisten gleichen Stücken zuerst.
- Gemischt wird nur an der Grenze zweier Blöcke: Füllt eine Sorte ihre letzte Reihe nicht, darf die nächste die freien Plätze dieser Reihe belegen und den letzten, nicht vollen Stapel auffüllen. Weiter vorn nie.
- „Rest einpacken“ setzt neue Cases an die letzte Reihe der vorhandenen Ladung an und füllt keine Lücken weiter vorn.
- Bleiben nach dem Packen Cases übrig, sagt die App jetzt, wie viele nicht in den Truck passen und in „Noch nicht geladen“ bleiben. Das gilt auch beim Packen aus dem Wizard.
- Sortenrein braucht oft etwas mehr Ladelänge als gemischt. Bestehende Loads ändern sich erst beim nächsten „Alles neu packen“.

## V 0.8.2 – 2026-09-28

- Die Kugelecken der Cases sind jetzt klein und sitzen innerhalb des Cases, in 2D, in 3D und im Ausdruck. Vorher saßen sie mittig auf der Ecke und standen bis zu 6 cm über das Case hinaus, bei aneinanderstehenden Cases sogar in den Nachbarn. Am Packen ändert das nichts, gerechnet wurde schon immer mit dem echten Außenmaß.
- Die mitgelieferten Cases haben jetzt 13 cm hohe Rollen (Blue Wheel Ø 100 mm) statt 12 cm. Weil ihre Maße inklusive Rollen gemessen sind, belegt kein Case dadurch mehr oder weniger Platz im Truck. Es ändert sich nur, wie hoch Rollen und Korpus gezeichnet werden.
- Kleine Cases unter ca. 45 cm Höhe haben keine Rollen mehr: MLVT 63A 19″, ChamSys MQ100/MQ500/Wing Compact, ZR44, Look Viper NT, SF Data II und SF TourHazer II. Ihr Maß bleibt gleich.
- Geprüft: Im Truck belegt jedes Case genau sein Außenmaß, auch getippt. Rollen werden nur dazugerechnet, wenn beim Case „Maß ist ohne Rollen“ gewählt ist.

## V 0.8.1 – 2026-09-28

- Case-Datenbank aufgeräumt: Leere Standard-Pack- und Kabelcases gibt es je Maß nur noch einmal, als „Packcase L×B×H“ mit 0 kg unter den Vorlagen. Es sind 7 Größen: 60×60×60, 60×60×73, 80×60×60, 120×60×60, 120×60×73, 120×60×80 und 120×80×80. Sie ersetzen die Vorlagen „Kabelcase/Packcase Truckmaß“ sowie „Packcase (Transflex)“, „Packwürfel“, „Transflex gross“ und „Transflex klein“ aus der Liste. Cases mit konkretem Inhalt (z. B. Powerlocksatz, Multicore, Laka Loom) bleiben.
- Die Traversen aus der Liste sind aus der Auswahl verschwunden: MLT 120/160/240 x2, Trussdolly 40er und Truss lose 40er. Traversenwagen baut man über „+ Traverse hinzufügen“.
- Bestehende Loads laden unverändert: Die früheren Einträge sind nur ausgeblendet und behalten in alten Plänen Namen, Maß und Gewicht.

## V 0.8.0 – 2026-09-27

- In den 2D-Ansichten (Draufsicht, Seitenansicht, Rückansicht) lässt sich jetzt zoomen, jede Ansicht für sich, zum Beispiel um genau zu prüfen, wie die Cases stehen.
  - Mausrad oder Trackpad (zwei Finger auseinander) zoomt an der Mausposition.
  - Wischen mit zwei Fingern oder Ziehen auf freier Fläche verschiebt den Ausschnitt.
  - Doppelklick auf freie Fläche zeigt wieder den ganzen Truck.
  - In jeder Überschrift gibt es die Knöpfe „−“, „+“ und „Alles“.
- Cases lassen sich auch gezoomt verschieben und aus der Liste hineinziehen. Der Ausdruck zeigt immer den ganzen Truck.

## V 0.7.18 – 2026-09-26

- Zieht man ein Case aus der Liste in den Truck, rastet es jetzt an den Kanten der Nachbarn und an den Wänden ein, genau wie beim Verschieben im Truck. Vorher wurde nur auf 5 cm gerundet: Ein 62 cm breiter MLT-Wagen landete so 2 cm im Nachbarn und wurde obendrauf gestellt, deshalb passten beim Hineinziehen keine 4 Wagen nebeneinander in den Sattelauflieger (248 cm). Jetzt stehen sie sauber nebeneinander.
- MLT- und Prolyte-Traversen: Der Dolly ist jetzt schmaler gezeichnet als die Traverse, denn die Traverse ist immer das breiteste Teil. Das ist nur Optik, am Packen ändert sich nichts.

## V 0.7.17 – 2026-09-26

- MLT ONE steht jetzt 115 cm hoch, genauso hoch wie die anderen MLT- und Prolyte-Dollys (vorher 75 cm, geschätzt). Das gilt auch in bestehenden Loads: Steht über einer MLT ONE schon etwas, kann es nun als Überschneidung angezeigt werden.
- Die Dollys von MLT TWO, THREE, FOUR und Prolyte S36PR (fest und flexibel) sind jetzt ein geschlossener Rahmen: An den kurzen Seiten verbinden Querholme die Längsholme. In 3D ist der ganze Wagen silbern. MLT ONE behält die einfache, dunkle Version mit offenen kurzen Seiten.

## V 0.7.16 – 2026-09-25

- Wizard: Lage 3 und 4 sind nie mehr vorab angehakt, auch nicht bei Case-Typen, die weder Lage 1 noch 2 erlauben. Ein solches Stück startet ohne Lage; „Fertig“ geht erst, wenn bei jedem Stück eine Lage angehakt ist, mit Hinweis. Vorgabe bleibt: Lage 1, Lage 2 und „getippt“ angehakt.

## V 0.7.15 – 2026-09-25

- Im Wizard (Schritt „Beschriften“) gibt es über allen Stücken die Zeile „Alle Stücke“ mit je einem Häkchen für Lage 1–4 und „getippt“. Ein Klick setzt oder entfernt die Einstellung bei allen Stücken auf einmal, z. B. Lage 4 für alle abwählen. Stücke, deren Case-Typ die Lage oder das Tippen nicht erlaubt, bleiben unberührt. Sind die Stücke unterschiedlich eingestellt, zeigt das Häkchen einen Strich. Wäre eine Lage bei einem Stück die letzte, bleibt sie stehen, mit Hinweis.
- Neue Vorgabe im Wizard: „getippt“ sowie Lage 1 und 2 sind angehakt, Lage 3 und 4 nicht. Erlaubt ein Case-Typ weder Lage 1 noch 2, sind seine eigenen Lagen vorbelegt.

## V 0.7.14 – 2026-09-25

- Neuer Knopf „Truck entladen“ (neben „Rest einpacken“): legt alle Cases aus dem Truck zurück nach „Noch nicht geladen“, z. B. wenn einem das Ergebnis des automatischen Packens nicht gefällt und man von Hand laden will. Beschriftung, Farbe, Lage und „getippt“ bleiben erhalten. Mit Rückfrage, rückgängig mit ⌘Z; bei leerem Truck ausgegraut.
- Lage (1–4) und „getippt“ lassen sich nach dem Wizard im Inspector ändern. Für ein Case im Truck gibt es dafür den neuen Block „Laden“; „getippt“ wirkt dort sofort (Häkchen raus stellt das Case auf, Häkchen rein tippt es). Stücke in „Noch nicht geladen“ lassen sich jetzt links anklicken; der Inspector zeigt dann Beschriftung, Farbe, Lage, „getippt“, „Case bearbeiten“ und „Entfernen“. Entf entfernt ein so ausgewähltes Stück.

## V 0.7.13 – 2026-09-25

- Im Wizard (Schritt „Beschriften“) lässt sich jetzt für jedes einzelne Stück festlegen, wie es geladen wird: in welchen Lagen es stehen darf (Lage 1 = Boden bis Lage 4) und ob es getippt wird oder stehend fährt. Standard ist „getippt“, man hakt nur die Ausnahmen ab. Lagen, die der Case-Typ nicht erlaubt, und „getippt“ bei nicht tippbaren Cases (z. B. Traversen) sind ausgegraut.
- Der automatische Packer hält sich an diese Einstellungen: getippte Stücke packt er nur getippt, stehende nur stehend. Passt ein Stück so nicht in den Truck, bleibt es in „Noch nicht geladen“. Wer ein Stück im Truck von Hand tippt oder aufstellt, ändert damit auch seine Einstellung, sodass „Alles neu packen“ die Handänderung nicht rückgängig macht.
- Bestehende Loads laden und packen unverändert: Stücke ohne diese Einstellung verhalten sich wie bisher.

## V 0.7.12 – 2026-09-24

- In der Seitenleiste gibt es nur noch den Knopf „+ Material hinzufügen“ (startet den Wizard). „+ Neues Case“, „⬛ Sonderbau“ und „+ Traverse hinzufügen“ sind dort entfernt: Die ersten beiden legten nur einen Case-Typ an, ohne ihn in den Load zu packen, sodass das Neue links nicht auftauchte. Alle drei gibt es weiterhin im Wizard, und dort landet das Neue direkt im Load.

## V 0.7.11 – 2026-09-24

- Die Bibliothek (linke Seitenleiste) zeigte immer den ganzen Case-Katalog (eigene Cases, alle Presets, die 137 Listen-Cases) statt nur den Inhalt des aktuellen Loads. Jetzt zeigt sie ausschließlich das Material dieses Loads, umschaltbar zwischen „Noch nicht geladen“ (wird beim Verladen leerer) und „Alles Material“ (Gesamtüberblick, platziert + unplatziert). Neue Case-Typen zum Load hinzufügen läuft weiterhin über „+ Material hinzufügen“ (öffnet den vollen Katalog-Wizard).

## V 0.7.10 – 2026-09-24

- MLT TWO/THREE/FOUR und Prolyte S36PR (fest+flexibel) hatten eine geschätzte Standhöhe von 103 cm (H.O.F.-Produktseite „Gesamthöhe mit Dolly“). Nach der originalen Bemaßungszeichnung des Dolly-Rahmens korrigiert: Gesamthöhe 115 cm (1150,9 mm), Unterteil (Rollen mit Befestigung) 17 cm (172 mm). MLT ONE (eigene, niedrigere Konstruktion ohne Rollwagen-Tisch) bleibt unverändert bei 75 cm.

## V 0.7.9 – 2026-09-24

- Codequalität aufgeräumt: `CASE_LIMITS` und `MAX_LABEL` wurden von drei Oberflächen-Modulen (Case-Editor, Inspector, Load-Wizard) bisher direkt aus der Speicherschicht (`js/store/io.js`) importiert statt aus der Modellschicht – ein Verstoß gegen die eigene Architekturregel. `CASE_LIMITS` ist jetzt in `js/model/validate.js` definiert, alle drei Module importieren die Grenzwerte von dort bzw. `MAX_LABEL` direkt aus `js/model/geometry.js`. Keine Verhaltensänderung.

## V 0.7.8 – 2026-09-23

- MLT-/Pre-Rig-Traversen standen optisch auf einem durchgehenden Rollbrett wie beim F34/F40-Wagen – tatsächlich ist der Unterbau ein Dolly (offener Rahmen mit Füßen/Rollen). Nach Fotoabgleich (H.O.F.-MLT-Katalog) korrigiert: zwei schmale Holme an den Rändern der Standfläche statt einer durchgehenden Platte, Rollen sitzen an den echten Rahmenecken.

## V 0.7.7 – 2026-09-23

- MLT-/Pre-Rig-Traversen waren mit 80 cm Standfläche zu breit angelegt (reine Fotoschätzung). Korrigiert auf 62 cm nach Nutzerangabe: genau 4 Stück passen nebeneinander in einen normalen 40-Tonner (248 cm Innenbreite).

## V 0.7.6 – 2026-09-23

- Die Artikelauswahl (Bibliothek und Wizard) hat jetzt 3 Reiter: „Cases“, „Traversen“, „Sonderbau“. Traversen-Vorlagen (klassische F34/F40 und MLT/S36PR) sind wieder direkt wählbar – nur eben im eigenen Reiter statt vermischt mit den normalen Cases. „+ Traverse hinzufügen“ und „⬛ Sonderbau“ sind jetzt auch direkt aus der Bibliothek heraus erreichbar, nicht mehr nur im Wizard.

## V 0.7.5 – 2026-09-23

- Traversenwagen (klassische F34/F40-Vorlagen und alle MLT-/S36PR-Pre-Rig-Presets) erscheinen nicht mehr in der normalen Case-Auswahl (Bibliothek und Wizard) – Traversen kommen jetzt ausschließlich über „+ Traverse hinzufügen“ in einen Load. Selbst darüber erzeugte Wagen bleiben unter „Eigene Cases“ sichtbar und lassen sich dort umbenennen oder löschen.

## V 0.7.4 – 2026-09-23

- Neuer Knopf „+ Traverse hinzufügen“ im Load-Wizard: klassische F34/F40-Wagen mengenbasiert anlegen (Profil, Länge, Gesamtstückzahl, Stück je Wagen – teilt automatisch auf mehrere Wagen auf) oder eine Pre-Rig-Traverse (H.O.F. MLT/Prolyte S36PR) aus der Bibliothek in Stückzahl hinzufügen, statt jedes Stück einzeln über den Stepper zu klicken.

## V 0.7.3 – 2026-09-23

- Nach einer Veröffentlichung lädt sich eine schon offene Seite jetzt automatisch einmal neu, sobald der neue Stand bereitsteht – bisher blieb sie auf der alten Version stehen bzw. sprang kurz auf die neue und dann zurück, bis man von Hand zweimal neu geladen hat.
- Sämtliche Bestätigungs- und Meldungsfenster (Case/Fahrzeug/Ladeplan löschen, Ladeplan umbenennen, Import-Meldungen) laufen jetzt über eigene Popups im Truckload-Design statt über die nativen Browser-Dialoge.
- Cases lassen sich jetzt direkt in der Bibliotheksliste löschen (🗑 neben „+“/„✎“), ohne den Umweg über „Bearbeiten“.
- Die grafische Darstellung der MLT-/S36PR-Traversenwagen war falsch (quadratischer Querschnitt, 4 Stück gestapelt auf einem gemeinsamen Wagen wie bei F34/F40). Nach Herstellerfotos korrigiert: Rechteck-Querschnitt, ein Stück ist immer EINE einzelne, stehende Traverse auf 4 Beinen über einer eigenen Grundplatte mit Rollen – so wie sie in echt fertig montiert in den Truck gerollt wird.
- Tippen kippte ein Case bisher immer so, dass die Rollen zur Trucktür zeigen – stand die lange Seite in Fahrtrichtung, kippte das Case dadurch sichtbar zur Seite statt nach vorn. Tippen kippt jetzt relativ zur aktuellen Lage immer nach vorn/hinten in Fahrtrichtung, unabhängig davon, ob gerade die lange oder die schmale Seite vorn steht. Die Rollenrichtung danach ist nicht mehr garantiert zur Tür – bei Bedarf über die Rollenrichtungs-Tasten gezielt einstellbar.

## V 0.7.2 – 2026-09-23

- 24 MLT-Traversenwagen (Moving-Light-Truss) neu in der Bibliothek: H.O.F. MLT ONE/TWO/THREE/FOUR und Prolyte S36PRF/S36PRA, jeweils mit den vom Hersteller geführten Längen. Stückgewichte recherchiert, siehe `docs/mlt-truss-gewichte.md`.

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
