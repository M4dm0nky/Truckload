# Anhang: Wortlaut der offenen Issues (Stand 2026-10-21)

Zur Anleitung [2026-10-21-issues-null.md](2026-10-21-issues-null.md). Falls `gh` nicht verfügbar ist,
gilt dieser Wortlaut; sonst gilt der aktuelle Stand des Issues auf GitHub. Die Zeile „--- Kommentare: n“
zeigt die Zahl der Kommentare, #32 hat zwei (mit `gh issue view 32 --comments` lesen).

# #3 Daten: fehlende Casemaße nachtragen [enhancement]
**Fünf Zeilen fehlen ganz.** Motorsteuerung-Koffer, Bolzenkoffer, FD34 x2, HOF BOLT und
Dolly „Drohne“ hatten kein oder nur ein einzelnes Maß. Bei dreien steht in der Quelle eine
einzelne Zahl, aus der sich kein Case bauen lässt. Der Nutzer wollte sie selbst nachtragen.

**Sechs 19″-Racks ohne echte Maße sind aus der Auswahl genommen.** Bei 1, 4, 5 und 16 HE war auch die
Höhe aus der Höheneinheit gerechnet, bei 2 und 6 HE nur Breite und Tiefe (60 × 60) geschätzt. Auf
Nutzerwunsch (2026-10-10) sind alle sechs `legacy`: nicht mehr wählbar, alte Pläne laden sie weiter.
Mit echten Maßen ließen sie sich wieder freigeben. Nur 3 HE (komplett gemessen) ist wählbar.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Daten aus der Casemaße-Tabelle“.
--- Kommentare: 0

# #4 Gewichte: Richtwerte für Case-Anteil und Packcases überprüfen [question]
**Der Mindest-Case-Anteil von 15 kg überzeichnet kleine Cases.** Bei `SF TourHazer II`
ergibt das rechnerisch 552 kg/m³. Der Richtwert ist in `docs/casemasse-gewichte.md`
offengelegt, aber für kleine Cases zu konservativ.

**Die Packcase-Gewichte sind eine Auslegung der Nutzerangabe**, kein recherchierter Wert:
  100 kg fürs Standard-Packcase 120×60×80 (mit Rollen), die übrigen linear nach Volumen. Siehe
  `docs/casemasse-gewichte.md`.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus den Pack-Regeln (2026-09-30) offen“; „Daten aus der Casemaße-Tabelle“.
--- Kommentare: 0

# #5 Sammlungen: Listen-Cases je Firma in eigene Sammlungen aufteilen [enhancement]
**Die Listen-Cases liegen noch gemeinsam in „Meine Sammlung“.** CAB, BBM, Motion … sind nicht je
  Firma in eigene Sammlungen aufgeteilt (Entscheidung: erst Struktur, dann Sortierung). Der Nutzer
  verschiebt sie selbst („Verschieben“).

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #6 Sammlungen: Marke („company“) und Sammlung sauber trennen [bug]
**`company` ist nur der Name einer einzelnen Sammlung, nicht des Baums.** Es ist der Name der
  Sammlung, in die das Case zuletzt verschoben wurde (bei unverschobenen Listen-Cases und
  migrierten Cases der alte Firmenname, während der Datensatz `meine` ist). Eine Oberfirma kennt der Case nicht; wer
  nach Oberfirma filtern will, nimmt den Sammlungsfilter. Das Verschieben einer Sammlung ändert
  die `company` ihrer Cases nicht (sie ändert nur der Name).

**Wizard-Filter „Standardkatalog“ = Cases ohne `company`.** Eigene Cases in „Meine Sammlung“
  ohne `company` erscheinen dort also mit, nicht nur die Vorlagen aus „Standard“. Das entspricht
  der alten Regel, ist aber nach der Umbenennung zu „Sammlung“ schwerer zu erklären.

**Ein Listen-Case, das in eine benannte Sammlung und zurück nach „Meine Sammlung“ wandert,
  verliert `company`.** Beim Verschieben nach „Meine Sammlung“ wird `company` entfernt
  (`moveCase`); die ursprüngliche Firma (z. B. „CAB“) ist an dieser Stelle nicht mehr
  rekonstruierbar, weil sie am Case nicht gesondert gemerkt wird. Das Case erscheint danach im
  Wizard-Filter „Standardkatalog“ (Cases ohne `company`) und nicht mehr unter seiner Marke.
  Eigene Entscheidung: nicht geraten oder aus dem Namen abgeleitet; der Nutzer kann es per
  „Verschieben“ in eine Sammlung gleichen Namens zurücklegen.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #7 Sammlungen: Elternsammlung zeigt nur eigene Cases [enhancement]
**Elternsammlungen listen nur eigene Cases.** In der Materialverwaltung zeigt eine Oberebene nur
  die Cases, die direkt in ihr liegen (und die Zahl dazu), der Wizard-Filter „Suchen in“ schließt
  dagegen die Untersammlungen ein. Beides ist gewollt, aber nicht einheitlich.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #8 Sammlungen: Überlagerungen von Listen-Cases wiederherstellen, Katalog-Updates [enhancement]
**`meine.json` wird nicht gesät, Überlagerungen frieren ein.** Neue Einträge der mitgelieferten
  Liste erscheinen bei jedem Start von selbst. Ein Listen-Case, das bearbeitet, verschoben,
  gelöscht (ausgeblendet) oder mit seiner Sammlung gelöscht wurde, liegt als Überlagerung im
  Datensatz und bekommt spätere Korrekturen an `meine.json` nicht mehr; ein Wiederherstellen der
  mitgelieferten Version gibt es nicht.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #9 Sammlungen: alten Store „cases“ aufräumen [enhancement]
**Der alte Store `cases` wird nicht aufgeräumt.** Er bleibt nach der Migration als
  Sicherheitsnetz liegen und muss in NYX freigegeben bleiben. Gelesen wird er nur, solange der
  Datensatz `meine` fehlt (Migration, `readRecords`); danach nicht mehr. Seine Datensätze
  veralten still (Änderungen landen nur in `collections`), werden nie bereinigt und nie
  geleert. Eine spätere Aufräumfunktion müsste das berücksichtigen (eigene Entscheidung: kein
  automatisches Löschen, solange nicht klar ist, dass keine ältere App-Version mehr darauf liest).

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #11 Sammlungen: kleine Härtungen (Dateidialog, Schreib-Warteschlange, Sammlungsdatei) [enhancement]
**Dateiauswahl „Sammlung importieren“:** sehr alte Browser lösen das `cancel`-Ereignis des
  Dateiauswählers nicht aus; ein Abbruch hält dort den Import-Knopf bis zum nächsten Klick
  (er teilt sich die laufende Promise).

**Die Schreib-Warteschlange wartet auf offene Meldungen.** Zeigt ein Vorgang in der Warteschlange
  eine Meldung (`showAlert`), laufen spätere Schreibvorgänge erst nach dem Schließen weiter.

**Sammlungsdatei ohne Altschema-Reparaturen.** Eine Datei mit Beschriftungen über
  `MAX_LABEL` oder alter Rollenhöhe wird abgelehnt statt repariert (eigene Entscheidung, das
  Format ist neu).

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus Sammlungen (V 0.17.0) offen“.
--- Kommentare: 0

# #13 Mehrere LKW: Verteilung nur bei „Alles neu packen“ [enhancement]
**Verteilt wird nur bei „Alles neu packen“.** Neues Material (Wizard, Ablage) und manuelle
  Änderungen werden nicht automatisch auf die LKW umverteilt; sie bleiben nicht zugeordnet bzw.
  im gewählten LKW, bis der Nutzer neu packt oder im Inspector zuweist.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus „Mehrere LKW“ (V 0.14.0) offen“.
--- Kommentare: 0

# #14 Mehrere LKW: Verteil-Heuristik prüfen und verbessern [enhancement]
**Die Gewerkegrenzen werden nicht optimiert.** Wie viele Stücke eines Gewerks auf welchen LKW
  gehen, hängt allein von der Reihenfolge (größte zuerst) und der Auslastung ab; ob ein
  anderer Zuschnitt weniger LKW oder weniger Rest bräuchte, wird nicht gesucht.

**Das Verteilmaß ist eine Heuristik (eigene Entscheidung).** Auslastung = größerer Wert aus
  Grundfläche/Bodenfläche und Gewicht/Nutzlast; Höhe, Stapeln und Pack-Regeln gehen nicht ein. Die
  Weitergabe nicht passender Reste läuft nur einmal, ein dritter LKW wird dabei unter Umständen nicht
  mehr erreicht. Gegen den Praxisfall mit echten Plänen ist das nicht geprüft.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus „Mehrere LKW“ (V 0.14.0) offen“.
--- Kommentare: 0

# #15 Druck: am echten Drucker prüfen (Mehr-LKW-Druck, Etikettenrand) [question]
**Seitenumbruch und Spalten des Mehr-LKW-Drucks** sind per PDF-Ausgabe des Browsers
  (Print-Medium) geprüft, nicht an einem echten Drucker.

Der senkrechte Rand der Avery-Bögen 3425 und 3474 ist nicht aus Herstellerangaben belegt —
  eine Websuche in Shopseiten (Post-Shop, alltron) fand nur das Format, keinen senkrechten
  Rand; die eine Quelle mit Zahlen widerspricht sich selbst. Das Etikettenraster wird deshalb senkrecht zentriert. Waagerecht ist es
  eindeutig (2 × 105 = 3 × 70 = 210 mm = A4-Breite). Sitzt der Druck auf einem echten Bogen
  daneben, ist `align-content` in `css/print.css` die Stellschraube.
  Recherche 2026-10-10: Webquellen nennen nur Format (3425: 105 × 57 mm, 3474: 70 × 37 mm),
  keinen senkrechten Rand; Annahme „zentriert“ bleibt.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus „Mehrere LKW“ (V 0.14.0) offen“; „Kleinigkeiten“.
--- Kommentare: 0

# #16 2D und 3D: eine Textmetrik für Beschriftungen [enhancement]
**Eine Textmetrik für 2D und 3D** (UI-S3). 2D kürzt Beschriftungen einzeilig mit „…“, 3D
  bricht sie mehrzeilig um und verkleinert die Schrift — zwei sichtbar unterschiedliche
  Ergebnisse für denselben Text. Eine Zusammenführung des eigentlichen Verfahrens (Kürzung vs.
  Umbruch) wäre eine sichtbare Verhaltensänderung, keine reine Aufräumarbeit, und deshalb
  bewusst nicht angefasst (Kommentare an beiden Stellen verweisen aufeinander).

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen“.
--- Kommentare: 0

# #17 Inspector wird bei jedem Bild neu aufgebaut [enhancement]
**Inspector wird bei jedem Bild neu aufgebaut** (Rest von UI-S5). Der Teil, der ohne Risiko
  zu entschärfen war – die Ablage –, ist gefixt (`js/ui/library.js`, `update()` baut die Ablage
  nur noch bei geänderter `plan.unplaced`-Referenz oder geänderten Cases neu). Der Inspector
  selbst bleibt unverändert: er hängt von sehr vielen Feldern gleichzeitig ab (Position, Lage,
  Warnungen, Ladungs-Kennzahlen), die sich während eines Drags des ausgewählten Cases
  tatsächlich bei jedem Bild ändern – ein Diffing wäre entweder grobmaschig (verpasst echte
  Änderungen, genau die Fehlerklasse von UI-B1) oder so fein, dass der Gewinn gegenüber dem
  heutigen `innerHTML`-Aufbau klein wird. Ohne Performance-Beschwerde aus der Praxis nicht
  angefasst.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen“.
--- Kommentare: 0

# #18 Technische Schulden in der Modellschicht [enhancement]
**Modellschicht — `caseShape(c, p, box)`/`trussShape(c, p, box)` erzwingen `box === boxOf(c,
  p)` nicht.** Ein Vorgabewert (`box = boxOf(c, p)`) würde die Zusage in die Signatur schreiben,
  ohne die heutigen Aufrufer (die die Box schon haben) zu verlangsamen. Bisher hat kein
  Aufrufer eine andere Box übergeben.

**Modellschicht — `buildStacks` (`packer.js`) macht drei Dinge in einer Funktion**
  (Orientierung wählen, sortieren, stapeln). Eine eigene `orderForStacking(itemList, truck)`
  wäre für sich testbar, ist aber ein Umbau ohne Verhaltensänderung und deshalb zurückgestellt,
  solange kein konkreter Fehler daran hängt.

**Modellschicht — Traversen-Maße `l/w/h` werden abgeleitet, aber trotzdem gespeichert.**
  `trussDims()` berechnet die Außenmaße aus `truss: {length, width, count}`; die berechneten
  Werte landen zusätzlich als `l/w/h` am Case und müssen deshalb an zwei Stellen
  nachnormalisiert werden (`normalizeCase` beim Import, `normalizeOwnCases` beim Laden) — ein
  Duplikat, das auseinanderlaufen kann, auch wenn beide Stellen dieselbe Funktion teilen.
  `outerDims(c)` könnte für `isTruss(c)` stattdessen direkt `trussDims(c.truss)` liefern und
  `l/w/h` für Traversenwagen gar nicht persistieren — das ist ein Umbau am Datenmodell mit
  Migrationsbedarf für bestehende eigene Traversenwagen, nicht für diese Version.

**Modellschicht — `validatePlan` läuft komplett bei jeder Planänderung** (`deriveOf` in
  `js/app/core.js`, nur für denselben Zustand zwischengespeichert). Bei
  den heutigen Plangrößen unkritisch; falls die Placement-Zahl dreistellig wird, ist die
  Kollisionsprüfung (O(n²)) die Stelle, die zuerst spürbar wird. Kein Gitter/Index gebaut,
  solange kein realer Plan das braucht.

`toPiece` in `js/model/actions.js` listet die Stück-Felder einzeln auf. Ein künftiges
  neues Feld muss dort nachgezogen werden, sonst geht es beim „Alles neu packen“ verloren.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus der Meilenstein-Review V 0.6.0 (2026-09-21) bewusst offen gelassen“; „Kleinigkeiten“.
--- Kommentare: 0

# #19 Traversen-Dialog: zwei Randfälle [bug]
**Stiller `preventDefault()` im Truss-Dialog, falls `splitWagons` wirft**
  (`js/ui/truss-wizard.js`). Heute nicht erreichbar, weil die nativen `required`/`min="1"`-
  Formularprüfungen vorher greifen — falls diese Grenzen je gelockert werden, sähe der
  blockierte Knopf ohne Meldung wie ein Fehler aus.

**Ein abgebrochener Traversen-Dialog hinterlässt seinen Wagen-Typ.** Ein passender vorhandener
  Typ wird inzwischen wiederverwendet (`findMatchingWagon`), neu angelegt bleibt der Typ aber
  auch bei Abbruch in „Eigene Cases“ — wie bei „+ Neues Case“, Aufräumen über 🗑.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus dem Leerer-Start/Truss-Wizard-Branch (2026-09-23) offen gelassen“.
--- Kommentare: 0

# #20 Mausrad und Trackpad an echter Hardware prüfen [question]
**Mausrad oder Trackpad wird an der Schrittgröße erkannt** (`classifyWheel`, `js/ui/zoom2d.js`).
  Seit V 0.14.1 robuster (Zeilenmodus, 120er-Rastschritte, 150-ms-Geste, Strg/Pinch zählt nicht
  mit). Als Ausweg gibt es neben den Zoomknöpfen den Umschalter „Rad: Auto/Zoom/Schieben“. Geprüft
  ist das weiterhin nur mit simulierten Eingaben, nicht an echter Hardware; ein Trackpad-Ereignis
  mit `deltaX` 0 und `wheelDeltaY` als Vielfaches von 120 kann als erstes einer Geste noch als
  Rad gelten. Die Knöpfe „−“/„+“ funktionieren in jedem Fall.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus V 0.7.15 bis V 0.8.0 (2026-09-25 bis 2026-09-27) offen gelassen“.
--- Kommentare: 0

# #21 Pre-Rig-Traversen: echtes Maß für die Dolly-Breite [question]
**Die Dolly-Breite der Pre-Rig-Traversen ist geschätzt.** Belegt ist nur, dass die Traverse
  das breiteste Teil ist (Nutzerangabe). Der Einzug von 2 cm je Seite (`STAND_DOLLY_INSET`) ist
  eine optische Annahme ohne Einfluss aufs Packen. Ein echtes Maß würde ihn ersetzen.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus V 0.7.15 bis V 0.8.0 (2026-09-25 bis 2026-09-27) offen gelassen“.
--- Kommentare: 0

# #22 Wizard-Stücke tragen layers [1, 2] als gespeicherte Einschränkung [enhancement]
**Wizard-Stücke tragen `layers: [1, 2]` als gespeicherte Einschränkung**, weil die Vorbelegung
  seit V 0.7.15 nicht mehr alle erlaubten Lagen umfasst. Erlaubt ein Case-Typ später mehr oder
  weniger Lagen, kommt das bei diesen Stücken nicht an; die Schnittmengenregel
  (`pieceLayers`) verhindert nur, dass ein Stück mehr darf als sein Typ.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus V 0.7.15 bis V 0.8.0 (2026-09-25 bis 2026-09-27) offen gelassen“.
--- Kommentare: 0

# #23 Zoom: Linien wachsen mit [enhancement]
**Zoom: Linien wachsen mit, die Schrift nur, wenn sie ins Case passt.** Linien sind in
  Truck-Einheiten gezeichnet und werden beim Hineinzoomen dicker. Die Schrift wächst seit
  V 0.14.1 mit, solange der ganze Name noch in die Breite des Cases passt (Obergrenze: kleinere
  Case-Seite × 0,32); passt er nicht, bleibt sie auf der Grundgröße und der Name wird wie
  bisher mit „…“ gekürzt.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus V 0.7.15 bis V 0.8.0 (2026-09-25 bis 2026-09-27) offen gelassen“.
--- Kommentare: 0

# #24 Deckschicht: Regalverfahren und 0-kg-Cases [enhancement]
**Das Regalverfahren der Deckschicht ist keine optimale Packung.** Mehrere kleine Cases stehen
  seit V 0.13.12 nebeneinander auf einem großen (Reihen in Ankunftsreihenfolge, eigene
  Entscheidung). Das ist eine Heuristik: Sie probiert „nebeneinander“ zuerst und fällt nur bei einem
  einzelnen Deckstück auf „Deckstück auf Deckstück“ zurück. In einem Vergleich mit dem alten Packer
  an 20.000 synthetischen, für die Deckschicht günstigen Fällen (Abschlussprüfung, kein Teil der
  Testsuite) wich das Ergebnis in 2.787 ab: 423-mal blieb mehr unverladen, 382-mal weniger; bei
  gleicher Ablage wurden in 145 Fällen weniger, in 21 mehr Lademeter gebraucht. Eine volle
  Deckschicht aus mehreren Stücken trägt nichts mehr, wo senkrechtes Stapeln Fläche gespart hätte.
  Deshalb bleibt der Schalter „Deckschicht mischen“ optional; ein Vergleich von Fläche und Höhe
  statt der festen Reihenfolge wäre denkbar; eigene Entscheidung: nicht umgesetzt.

**0-kg-Cases mischen nicht.** Ein Case ohne Gewichtsangabe kommt weder als Deckschicht auf ein
  fremdes Case, noch trägt es eine fremde Deckschicht — 0 kg heißt unbekannt, nicht leicht.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus den Pack-Regeln (2026-09-30) offen“.
--- Kommentare: 0

# #25 Deckschicht: Lagen-Vorgabe 1+2 begrenzt das Mischen [enhancement]
**Die Lagen-Vorgabe 1+2 begrenzt die Deckschicht.** Der Wizard hakt Lage 1 und 2 vor; ein
  Stapel aus zwei gleichen Cases ist damit schon voll, eine Deckschicht bräuchte Lage 3. Das wird
  in der README erklärt, nicht automatisch umgangen — eine Lagen-Einschränkung ist eine bewusste
  Nutzerangabe.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus den Pack-Regeln (2026-09-30) offen“.
--- Kommentare: 0

# #26 Pack-Regeln: Motor-Erkennung und Namensbezug von Gruppen- und Gewerk-Regeln [enhancement]
**Keine automatische Motor-Erkennung.** Eine Regel auf „Motoren“ trifft nur, was der Nutzer
  selbst über die Gruppe oder den Case-Typ als Motor kennzeichnet — es gibt keine Erkennung
  über Gewicht, Name oder Gewerk.

**Gruppen- und Gewerk-Regeln verweisen über den Wert auf den Namen**, nicht über eine feste
  ID (Case-Typ-Regeln dagegen speichern die `caseId` — ein umbenannter Case-Typ bricht sie
  nicht). Benennt man eine Gruppe oder ein Gewerk danach um, greift die Regel nicht mehr — der
  Dialog zeigt sie dann ausgegraut mit „(nicht in diesem Load)“, löscht sie aber nicht
  automatisch.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus den Pack-Regeln (2026-09-30) offen“.
--- Kommentare: 0

# #27 Service-Worker: Versionsmix bei langsamem Netz [bug]
**Restrisiko Service-Worker-Mischstand.** Siehe unter „Kleinigkeiten“ (Versionsmix bei langsamem
  Netz); der Schutz „ein Stand pro Seitenaufruf“ (`docs/architektur.md`, „Service Worker und
  Ladefehler“) schließt ihn nicht aus. Bewusst akzeptiert, der Ladefehler-Hinweis fängt den Rest.

Service-Worker, Versionsmix bei langsamem Netz: Dateien, die ein Seitenaufruf schon frisch vom
  Netz bekommen hat, bleiben frisch, auch wenn spätere Dateien nach einem Timeout aus dem Cache
  kommen. Ein Mix aus neuem und altem Stand ist dadurch nicht ganz ausgeschlossen; in dem Fall
  zeigt index.html den „Bitte neu laden“-Hinweis. Bewusst akzeptiert.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Aus dem Aufräumen vor V 0.13.10 bewusst offen gelassen“; „Kleinigkeiten“.
--- Kommentare: 0

# #28 Oberfläche: Kleinigkeiten (Filter, Farbe, 180°, Tippen, Wizard-Reste, Lagenwahl) [enhancement]
Der Firmenfilter springt still auf „Standardkatalog“, wenn die gewählte Firma aus den Daten
  verschwindet. Praktisch nur erreichbar, wenn man das letzte eigene Case einer Firma
  löscht.

Der Wizard schreibt jedem Stück eine ausdrückliche Farbe, auch wenn sie der Gewerkfarbe
  entspricht. Ändert man später das Gewerk oder die Case-Farbe, bleiben die Stücke auf dem
  alten Wert.

Der Inspector kann bei stehenden Cases „Stehend, 180°“ anzeigen — richtig, aber für den
  Nutzer verwirrend.

Tippen kann Nachbarn überlappen, weil nur `z` nachgeführt wird, nicht `x`/`y`. Das
  verhält sich seit jeher wie „Drehen“, und die Prüfung meldet es.

Im Wizard neu angelegte Cases bleiben in der Bibliothek, auch wenn man den Wizard danach
  abbricht. Entspricht dem Verhalten des Case-Editors.

Die Lagen-Auswahl endet bei „bis 3“. Für den vorgesehenen Bereich reicht das (ab Lage 5 warnt
  `validate.js`), aber in einem Load mit 5 Lagen – der gewarnt, nicht verhindert wird – lassen
  sich die Lagen 1–4 nicht gemeinsam freistellen.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Kleinigkeiten“.
--- Kommentare: 0

# #29 Beschriftungen: Messung im Druck, Verzerrung in 3D, Etikettenformate [enhancement]
Das Druckspalten-Layout bei sehr langen Beschriftungen ist nie geprüft worden. Durch die
  40-Zeichen-Grenze entschärft.

Der Sicherheitsfaktor bei `CHAR_ASPECT` im Druckpfad (`estimateTextWidth`,
  `js/ui/labelTexture.js`) ist eine grobe Schätzung ohne echte DOM-Messung im Druckmodus –
  gedruckte Beschriftungen können ihren Kasten um rund ein Zeichen überragen.

Die 3D-Beschriftung rundet das Seitenverhältnis auf 0,25-Schritte (Cache-Schlüssel), damit
  bleibt eine Restverzerrung von bis zu 33 % auf schmalen Flächen.

Andere Haftpapier-Formate als 3425 und 3474 gibt es nicht. Ein weiteres Format braucht einen
  Eintrag in `#print-label-size`, eine Rasterregel in `css/print.css` und dessen Maße.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Kleinigkeiten“.
--- Kommentare: 0

# #30 Idee: Gewicht von Standardvorlagen direkt überschreibbar [enhancement]
Das Gewicht im Inspector lässt sich nur für eigene Cases und Firmen-Vorlagen ändern; bei
  Standardvorlagen und Traversenwagen bleibt es lesbar (Vorlage: „Kopieren“ in der Material-
  verwaltung). Ob Standardvorlagen direkt überschreibbar sein sollen, ist nicht entschieden.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Ideen, die noch niemand beauftragt hat“.
--- Kommentare: 0

# #31 Idee: Grund in der Ablage vollständiger nennen [enhancement]
Der Grund in der Ablage nennt nur, was aus den Maßen folgt („zu groß für den Laderaum“, „auf
  getippt/nicht tippen gesetzt, passt aber nur …“). Nutzlast, Lagen-Einschränkung und
  Pack-Regeln benennt er nicht — „kein Platz“ wäre geraten, deshalb steht dann kein Grund da.

---
Quelle: `docs/offene-punkte.md` (Stand V 0.17.0), Abschnitt: „Ideen, die noch niemand beauftragt hat“.
--- Kommentare: 0

# #32 Ladefehler-Hinweis für zu alte Browser/Electron (JSON-Module) [bug]
Seit V 0.17.0 sind die mitgelieferten Sammlungen JSON-Module (`import … with { type: 'json' }`). Das braucht Chrome/Electron ≥ 123 (Electron ≥ 30), Safari ≥ 17.2 oder Firefox ≥ 138 (Herstellerangaben, hier nicht geprüft).

Auf älteren Laufzeiten scheitert der Modulgraph mit einem SyntaxError, und der Ladefehler-Hinweis aus `index.html` zeigt „Die App konnte nicht vollständig geladen werden. Bitte neu laden.“ mit „Neu laden“. Das hilft dort nicht, weil ein erneutes Laden denselben Fehler liefert.

**Vorschlag:** Bei einem SyntaxError den Text ändern („Dieser Browser ist zu alt, Truckload braucht …“) und den Knopf weglassen. Zusätzlich die tatsächlich in NYX ausgelieferte Electron-Version prüfen und hier eintragen.

Quelle: finale Review der Sammlungen (0.17.0), siehe `docs/nyx-sammlungen.md`.
--- Kommentare: 2

# #35 Rest aus „Projektdatei vollständig“ (0.17.1): Kennzeichnung, Tests, Wiederholung [enhancement]
Rest aus der Umsetzung von #33 (PR #34, V 0.17.1). Nichts davon ist dringend; alles ist bei der Abschlussprüfung bewusst liegen geblieben.

**Kopierte Fahrzeuge sehen in der Fahrzeugauswahl aus wie eigene.** Ein Fahrzeug, das nur aus `plan.mitgefuehrt` kommt, trägt im `#truck-select` denselben Stern (★) wie ein eigenes (`js/app/planView.js`, Aufbau von `sortedTrucks`, unterscheidet nur `builtin`). Im Inspector steht der Hinweis „Aus der Projektdatei – nicht in deiner Bibliothek“, in der Auswahl nicht. Vorschlag: Kopien über `d.ausProjekt.trucks` erkennen und anders kennzeichnen.

**Die Sperren für Kopien in der Oberfläche haben keine eigenen Tests.** Geprüft sind sie nur im Browser (CDP-Szenario): `#truck-edit` gesperrt und `editTruck` mit Guard, der Stift in der Ablage (`onEdit`) als No-op, der LKW-Editor mit dem ergänzten Bestand (`bestandOf(s).trucks`). Den LKW-Editor hat auch das Szenario nicht geöffnet. Getestet ist nur `wizardTruckId` und `brauchtAuswahl`. Vorschlag: die Entscheidungen als kleine reine Helfer herausziehen, wie es bei `brauchtAuswahl` schon geschehen ist.

**Neuspeichern nach einer Bibliotheksänderung wird nicht wiederholt.** Schlägt in `createBestandsSync` (`js/app/core.js`) das `savePlanMitKopie` für einen nicht offenen Plan fehl, setzt Truckload nur den Fehlerstatus. Anders als der Autosave gibt es keinen zweiten Versuch; die Kopie im gespeicherten Plan bleibt bis zur nächsten Änderung am Plan alt. Der offene Plan läuft über `autosave.markDirty` und ist nicht betroffen.

**Kleinere Testlücken.**
- Kein Verdrahtungstest in `tests/app-importexport.test.js`, dass ein gescheiterter Import `projectRuleSets` auf den Stand vor dem Import zurücksetzt. Für `ruleSets` fehlt derselbe Test.
- `checkPlan` (`js/store/io.js`) prüft `mitgefuehrt.version` nur auf „ist eine Zahl“, nicht gegen `MITGEFUEHRT_VERSION`. Heute gibt es nur Version 1; relevant erst, wenn das Format sich ändert.
- Kein Test mit einem `null`-Eintrag in `mitgefuehrt.cases`/`trucks` (das Verhalten — Ablehnung mit Plan-Namen — ist nur per Lesen bestätigt).

--- Kommentare: 0

# #38 Import: null in gespeicherten Datensätzen, Grenzen der Maße-Nachfrage [enhancement]
Rest aus #10 (PR #37, V 0.17.2). Nichts davon ist dringend.

**Verschachteltes `null` in gespeicherten Datensätzen wird nicht bereinigt.** `cleanCases`
(`js/store/repo.js`) filtert nur null-Cases und ein fehlerhaftes `updatedAt` am Case; ein `null`
tief im Datensatz (etwa in `cases[].…`) bleibt stehen. Seit 0.17.2 fragt der Import fehlende Maße
nach, das gilt aber nur für Dateien, nicht für das, was schon in IndexedDB liegt.

**Die Nachfrage nach Maßen beim Import hat Grenzen.**
- Sie gilt nur für Cases der Sicherung (`parseBundle(text, { dims })`). Traversenwagen leiten ihre
  Maße aus `truss` ab und werden nicht nachgefragt; Sammlungsdateien (`parseCollectionFile`)
  lehnen ein Case ohne Maße weiter ab.
- Die mitgeführte Kopie im Plan (`plan.mitgefuehrt`) lehnt ein Case ohne Maße weiter ab, der ganze
  Import scheitert dann wie vor 0.17.2.
- Eine Ergänzung gilt je Case-ID; hat dieselbe ID in Plan-Kopie und Top-Level-Liste unterschiedliche
  Fehler, wird nur der Top-Level-Eintrag nachgefragt.

**Bewusst belassen:** `MAX_DEPTH` (4) gilt nur in der Oberfläche; eine tiefere Kette aus einer
fremden Datei lädt (Entscheidung des Nutzers zu #10).

Quelle: ehemals `docs/offene-punkte.md` (Abschnitt „Aus Sammlungen“), die Datei ist aufgelöst; alle
Punkte stehen als Issues.

--- Kommentare: 0

# #40 0.18.0: Traversen-Katalog – Hinweis für NYX (neue Datei, optionale Eigenschaft) [enhancement]
**Zur Kenntnis für NYX, vor der Veröffentlichung von V 0.18.0.** Es ist nichts zu tun; Einzelheiten in `docs/nyx-traversen.md`.

- **Neue mitgelieferte Datei `data/traversen.json`** (Traversen-Katalog), gelesen wie `data/standard.json` per JSON-Modul-Import (Chromium ≥ 123 wie bisher). Sie steht in der Offline-Liste von `sw.js`; wer das Submodul mit eigener Dateiliste einbindet, nimmt `data/traversen.json` und `js/model/trussCatalog.js` mit auf.
- **Neue optionale Eigenschaft `truss.profileId`** (String bis 64 Zeichen) an Traversenwagen-Cases. Alte Wagen ohne sie laden unverändert; sie wandert wie jede Case-Eigenschaft durch `collections`, `plans` (Kopie `mitgefuehrt`) und die Sicherung.
- **Kein neuer Store**, keine Änderung an `js/store/db.js`, Formatversion der Sicherung bleibt 1.
- Oberfläche: Der Dialog „Traverse hinzufügen“ bekommt eine Profilsuche (z. B. „FD34“) mit Längen und Gewicht.

Außerdem in 0.17.3 und 0.18.0 nur Inhalt in `data/standard.json` (144 Hersteller-Vorlagen für Licht, Pulte und Racks, danach Lampengewichte); ebenfalls ohne Auswirkung auf den Speicher.
--- Kommentare: 0
