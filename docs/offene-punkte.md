# Offene Punkte

Stand V 0.13.12. Gesammelt aus den Code-Reviews der Versionen 0.3.0 bis 0.7.0, aus den
Änderungen bis 0.8.0, aus dem Aufräumen vor V 0.13.10, aus „Abschluss Teil 1“ und aus Hinweisen
des Nutzers. Nichts davon blockiert den Betrieb; die Reihenfolge ist meine Einschätzung der
Nützlichkeit. Erledigtes ist raus. Die Befunde der Meilenstein-Review V 0.6.0 stehen in
`docs/code-review-2026-09-21.md`.

## Teilprojekte

Ein größeres Vorhaben ist geplant, aber noch nicht begonnen (Teilprojekt 2, „Deckschicht
nebeneinander“, ist umgesetzt, siehe „Aus den Pack-Regeln“):

- **Teilprojekt 3: Mehrere LKW in einem Plan.** Ein Plan mit mehreren Fahrzeugen und einer
  Verteilung der Cases darauf.

## Daten aus der Casemaße-Tabelle

**Fünf Zeilen fehlen ganz.** Motorsteuerung-Koffer, Bolzenkoffer, FD34 x2, HOF BOLT und
Dolly „Drohne“ hatten kein oder nur ein einzelnes Maß. Bei dreien steht in der Quelle eine
einzelne Zahl, aus der sich kein Case bauen lässt. Der Nutzer wollte sie selbst nachtragen.

**Vier 19″-Racks sind gerechnet.** 1, 4, 5 und 16 HE hatten keine Maße; die Höhe kommt aus
der Höheneinheit (4,45 cm je HE plus 5,68 cm Aufschlag, abgeleitet aus den drei gemessenen
Racks), Breite und Tiefe mit 60 × 60 geschätzt. Echte Maße würden das ersetzen.

**Der Mindest-Case-Anteil von 15 kg überzeichnet kleine Cases.** Bei `SF TourHazer II`
ergibt das rechnerisch 552 kg/m³. Der Richtwert ist in `docs/casemasse-gewichte.md`
offengelegt, aber für kleine Cases zu konservativ.

## Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen

Die Befunde aus `docs/code-review-2026-09-21.md` sind abgearbeitet. Was davon bewusst offen
geblieben ist, mit Begründung:

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

## Aus dem Leerer-Start/Truss-Wizard-Branch (2026-09-23) offen gelassen

- **Stiller `preventDefault()` im Truss-Dialog, falls `splitWagons` wirft**
  (`js/ui/truss-wizard.js`). Heute nicht erreichbar, weil die nativen `required`/`min="1"`-
  Formularprüfungen vorher greifen — falls diese Grenzen je gelockert werden, sähe der
  blockierte Knopf ohne Meldung wie ein Fehler aus.
- **Ein abgebrochener Traversen-Dialog hinterlässt seinen Wagen-Typ.** Ein passender vorhandener
  Typ wird inzwischen wiederverwendet (`findMatchingWagon`), neu angelegt bleibt der Typ aber
  auch bei Abbruch in „Eigene Cases“ — wie bei „+ Neues Case“, Aufräumen über 🗑.

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

- **Das Regalverfahren der Deckschicht ist keine optimale Packung.** Mehrere kleine Cases stehen
  seit V 0.13.12 nebeneinander auf einem großen (Reihen in Ankunftsreihenfolge, eigene
  Entscheidung). Das ist eine Heuristik: Sie probiert „nebeneinander“ zuerst und fällt nur bei einem
  einzelnen Deckstück auf „Deckstück auf Deckstück“ zurück. In einem Vergleich mit dem alten Packer
  an 20.000 synthetischen, für die Deckschicht günstigen Fällen (Abschlussprüfung, kein Teil der
  Testsuite) wich das Ergebnis in 2.787 ab: 423-mal blieb mehr unverladen, 382-mal weniger; bei
  gleicher Ablage wurden in 145 Fällen weniger, in 21 mehr Lademeter gebraucht. Eine volle
  Deckschicht aus mehreren Stücken trägt nichts mehr, wo senkrechtes Stapeln Fläche gespart hätte.
  Deshalb bleibt der Schalter „Deckschicht mischen“ optional; ein Vergleich von Fläche und Höhe
  statt der festen Reihenfolge wäre denkbar; eigene Entscheidung: nicht umgesetzt.
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

## Aus dem Aufräumen vor V 0.13.10 bewusst offen gelassen

- **Restrisiko Service-Worker-Mischstand.** Siehe unter „Kleinigkeiten“ (Versionsmix bei langsamem
  Netz); der Schutz „ein Stand pro Seitenaufruf“ (`docs/architektur.md`, „Service Worker und
  Ladefehler“) schließt ihn nicht aus. Bewusst akzeptiert, der Ladefehler-Hinweis fängt den Rest.

## Kleinigkeiten

- Der Firmenfilter springt still auf „Standardkatalog“, wenn die gewählte Firma aus den Daten
  verschwindet. Praktisch nur erreichbar, wenn man das letzte eigene Case einer Firma
  löscht.
- Der Wizard schreibt jedem Stück eine ausdrückliche Farbe, auch wenn sie der Gewerkfarbe
  entspricht. Ändert man später das Gewerk oder die Case-Farbe, bleiben die Stücke auf dem
  alten Wert.
- Der Inspector kann bei stehenden Cases „Stehend, 180°“ anzeigen — richtig, aber für den
  Nutzer verwirrend.
- Tippen kann Nachbarn überlappen, weil nur `z` nachgeführt wird, nicht `x`/`y`. Das
  verhält sich seit jeher wie „Drehen“, und die Prüfung meldet es.
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
- Der senkrechte Rand der Avery-Bögen 3425 und 3474 ist nicht aus Herstellerangaben belegt —
  die öffentlich auffindbaren Quellen nennen ihn nicht, und die eine mit Zahlen widerspricht
  sich selbst. Das Etikettenraster wird deshalb senkrecht zentriert. Waagerecht ist es
  eindeutig (2 × 105 = 3 × 70 = 210 mm = A4-Breite). Sitzt der Druck auf einem echten Bogen
  daneben, ist `align-content` in `css/print.css` die Stellschraube.
- Andere Haftpapier-Formate als 3425 und 3474 gibt es nicht. Ein weiteres Format braucht einen
  Eintrag in `#print-label-size`, eine Rasterregel in `css/print.css` und dessen Maße.
- Die Lagen-Auswahl endet bei „bis 3“. Für den vorgesehenen Bereich reicht das (ab Lage 5 warnt
  `validate.js`), aber in einem Load mit 5 Lagen – der gewarnt, nicht verhindert wird – lassen
  sich die Lagen 1–4 nicht gemeinsam freistellen.
- Service-Worker, Versionsmix bei langsamem Netz: Dateien, die ein Seitenaufruf schon frisch vom
  Netz bekommen hat, bleiben frisch, auch wenn spätere Dateien nach einem Timeout aus dem Cache
  kommen. Ein Mix aus neuem und altem Stand ist dadurch nicht ganz ausgeschlossen; in dem Fall
  zeigt index.html den „Bitte neu laden“-Hinweis. Bewusst akzeptiert.

## Ideen, die noch niemand beauftragt hat

- Das Gewicht im Inspector lässt sich nur für eigene Cases und Firmen-Vorlagen ändern; bei
  Standardvorlagen und Traversenwagen bleibt es lesbar (Vorlage: „Kopieren“ in der Material-
  verwaltung). Ob Standardvorlagen direkt überschreibbar sein sollen, ist nicht entschieden.
- Der Grund in der Ablage nennt nur, was aus den Maßen folgt („zu groß für den Laderaum“, „auf
  getippt/nicht tippen gesetzt, passt aber nur …“). Nutzlast, Lagen-Einschränkung und
  Pack-Regeln benennt er nicht — „kein Platz“ wäre geraten, deshalb steht dann kein Grund da.
