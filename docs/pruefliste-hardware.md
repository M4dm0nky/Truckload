# Prüfliste für Hardware (Druck, Mausrad/Trackpad, Dolly-Breite)

Diese drei Punkte lassen sich nur mit echter Hardware oder einem Maß prüfen, das nur der Nutzer hat
(Issues #15, #20, #21). Jeder Abschnitt nennt die Schritte, das erwartete Ergebnis und was bei einer
Abweichung zu ändern ist. Die Issues bleiben offen, bis das Ergebnis dort gemeldet ist.

## Druck (Issue #15)

Vorbereitung: einen Plan mit mindestens zwei LKW und etwa 30 Stücken laden (zum Beispiel einen vorhandenen
Mehr-LKW-Plan). Chrome oder Edge, Druckdialog des Betriebssystems, Maßstab „100 %“ (nicht „Anpassen“).

**Mehr-LKW-Druck (A4 quer)**

1. Dokument „Ladeplan“, daneben „alle LKW“ wählen, „Drucken“. Auf einem **echten Drucker** drucken
   (nicht „Als PDF speichern“).
   *Erwartet:* je LKW ein Abschnitt, jeder beginnt auf einer neuen Seite, der LKW-Name steht im Kopf; zuletzt
   ein Abschnitt „Ohne LKW“, falls es solche Stücke gibt. Nichts wird am Rand abgeschnitten, die
   Stücktabelle bricht zwischen Zeilen um, nicht mitten in einer Zeile.
2. Dasselbe mit „Abhakliste“ und „Ausladeliste“.
   *Erwartet:* zweispaltig, rund 40 Cases pro Blatt, Unterschriftszeile unten, Spalten laufen nicht
   ineinander.
3. Ein Stück mit sehr langer Beschriftung (40 Zeichen, die Grenze) anlegen und die Abhakliste drucken.
   *Erwartet:* die Beschriftung bleibt in ihrer Spalte (gekürzt oder umgebrochen), sie überragt den Kasten
   höchstens um etwa ein Zeichen (die Breite wird geschätzt, `CHAR_ASPECT` in `js/ui/labelTexture.js`).

**Etiketten (A4 hoch, Haftpapier)**

4. Zuerst auf **normalem Papier** drucken, danach gegen einen Avery-Bogen halten. Dokument „Etiketten“,
   Größe „groß“ (Avery Zweckform 3425, 105 × 57 mm, 2 × 5 = 10 je Bogen). Seitenränder im Druckdialog auf
   „Keine“/„Standard ohne Kopf- und Fußzeilen“ stellen, **Kopf-/Fußzeilen aus**.
   *Erwartet:* Das Raster füllt die Seite in der Breite genau (2 × 105 mm = 210 mm), das Papier liegt
   deckungsgleich auf den Etiketten. In der Höhe bleiben 12 mm Spiel (297 − 5 × 57), die oben und unten je
   zur Hälfte liegen (Raster senkrecht zentriert). Es wird kein Rahmen gedruckt.
5. Dasselbe mit Größe „klein“ (Avery Zweckform 3474, 70 × 37 mm, 3 × 8 = 24 je Bogen).
   *Erwartet:* Breite genau (3 × 70 mm), in der Höhe bleibt 1 mm Spiel (297 − 8 × 37).
6. Mit mehr Stücken als auf einen Bogen passen (zum Beispiel 14 bei „groß“) einen zweiten Bogen drucken.
   *Erwartet:* Seite 1 volle 10 Etiketten deckungsgleich, Seite 2 beginnt oben (die letzte, angebrochene Seite
   darf oben statt mittig beginnen).

Sitzt der Druck auf dem echten Bogen zu hoch oder zu tief, ist die Stellschraube `align-content` in
`css/print.css` (Regel `#print-root.doc-labels .labels`, heute `center`): einen festen oberen Abstand
(`align-content: start` plus `padding-top`/`margin-top` in mm) einsetzen und den gemessenen Wert im Kommentar
über der Regel festhalten. Der senkrechte Rand der Avery-Bögen ist nicht aus Herstellerangaben belegt.

## Mausrad und Trackpad (Issue #20)

Verhalten von `classifyWheel` (`js/ui/zoom2d.js`): ein Ereignis zählt als **Rad**, wenn die Zeilen-Einheit
gesetzt ist, `deltaX` 0 ist und `wheelDeltaY` ein Vielfaches von 120 (Rastschritt) oder `|deltaY| ≥ 50` ist;
sonst als **Trackpad**. Die erste Einstufung einer Geste gilt 150 ms lang für die ganze Geste. Pinch (Strg)
zoomt immer an der Mausposition. In der Einstellung „Rad: Auto“ zoomt ein Rad, ein Trackpad verschiebt.

Vorbereitung: einen Plan mit Draufsicht öffnen, mit „Rad: Auto“ (Knopf neben den Zoomknöpfen).

1. **Mausrad (Rastschritte), ein Rastschritt nach vorn/hinten.**
   *Erwartet:* die Ansicht zoomt an der Mausposition, sie verschiebt sich nicht.
2. **Mausrad, mehrere schnelle Schritte hintereinander.**
   *Erwartet:* durchgehend Zoomen, kein Umschalten mitten in der Geste.
3. **Trackpad, Zweifinger-Scrollen (senkrecht), langsam.**
   *Erwartet:* die Ansicht verschiebt sich (Pan), sie zoomt nicht. Ist die Ansicht noch ganz herausgezoomt,
   scrollt stattdessen die Seite.
4. **Trackpad, Zweifinger-Scrollen, schnelles Wischen.**
   *Erwartet:* weiter Verschieben. **Bekannte Schwäche:** Meldet ein Trackpad `deltaX` 0 und ein `wheelDeltaY`
   als Vielfaches von 120, kann das erste Ereignis einer Geste als Rad gelten und kurz zoomen.
5. **Trackpad, Pinch (Zwei Finger spreizen/zusammenziehen).**
   *Erwartet:* Zoomen an der Mausposition, auch in „Rad: Schieben“.
6. **Umschalter** „Rad: Auto“ → „Rad: Zoom“ → „Rad: Schieben“ am selben Gerät.
   *Erwartet:* „Zoom“ zoomt mit jedem Gerät, „Schieben“ verschiebt mit jedem Gerät; die Wahl bleibt nach dem
   Neuladen erhalten.

Hilft „Auto“ bei einem Gerät nicht, ist der Ausweg „Rad: Zoom“ bzw. „Rad: Schieben“; die Knöpfe „−“/„+“
zoomen in jedem Fall. Ergebnis mit Gerät (Maus/Trackpad, Hersteller, Betriebssystem, Browser) melden, damit
die Schwellen in `classifyWheel` angepasst werden können.

## Pre-Rig-Dolly (Issue #21)

Gemessen werden muss die **Breite des Dollys neben der Traverse** an einer Pre-Rig-Einheit (MLT/S36PR):
der Abstand der **äußeren Kanten der Rollen/Rahmenholme quer zur Traverse**, an der Stelle, an der der Dolly
am breitesten ist (nicht die Traversenbreite, die ist mit 60 cm angesetzt). Zusätzlich den Unterschied zur
Traversenbreite notieren, dazu Hersteller, Modell und Länge der gemessenen Einheit.

Einzutragen ist das Ergebnis als **Einzug je Seite** = (Traversenbreite − Dolly-Breite) / 2:

- Konstante `STAND_DOLLY_INSET` in `js/model/truss.js`, zurzeit **2 cm je Seite** (also Dolly 56 cm bei
  60 cm Traverse). Die Zahl ist eine optische Annahme; das Packen rechnet unverändert mit der Standfläche
  `STAND_FOOTPRINT_W` (62 cm).
- Den Kommentar darüber anpassen („geschätzt“ → „gemessen am …, an …“) und die Quelle festhalten.
- Test: `tests/truss.test.js`, „stehende Pre-Rig – Rollen stehen um STAND_DOLLY_INSET je Seite enger als die
  Traverse“ liest die Konstante und braucht keinen neuen Zahlenwert; danach `npm test`. Gibt es je Hersteller
  verschiedene Maße, wird aus der Konstante ein Wert je Modell; das wäre eine Datenmodelländerung und mit NYX
  abzustimmen.
