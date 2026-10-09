# Truckload – Ladeplaner für Event-Cases

Version: **V 0.13.2** – siehe [CHANGELOG.md](CHANGELOG.md).

Lokale Vanilla-JavaScript-App zur Planung und Visualisierung von Laderaum-Aufteilungen im LKW. Cases (auf Rollen, stehend oder getippt) werden interaktiv in den Laderaum positioniert, Kollisionen und Grenzen werden live geprüft.

## Start

**Einfach öffnen:** https://m4dm0nky.github.io/Truckload/

Nichts installieren, kein Terminal. Nach dem ersten Öffnen läuft die App auch offline.

**Als App ins Dock (empfohlen):**
- Safari: Seite öffnen → Menü *Ablage → Zum Dock hinzufügen*
- Chrome: Seite öffnen → Installieren-Symbol rechts in der Adressleiste

Updates kommen automatisch: Mit Netz lädt die App immer den aktuellen Stand vom Server; nur ohne Netz (oder wenn der Server länger als 3 Sekunden braucht) nimmt sie die zuletzt gespeicherte Kopie.

**Lokal ohne Internet-Adresse (für Entwicklung):** Doppelklick auf `start.command` bzw. `python3 -m http.server 8765` und `http://localhost:8765` öffnen. Achtung: Jede Adresse hat ihren eigenen Browser-Speicher – Daten zwischen `localhost` und der GitHub-Adresse mit „Sichern“ / „Importieren“ übertragen.

## Tests

```bash
npm test
```

## Weiterentwickeln

- [CLAUDE.md](CLAUDE.md) – wie in diesem Projekt gearbeitet wird: Regeln, Prüfablauf, Veröffentlichung
- [docs/architektur.md](docs/architektur.md) – Datenmodell, Schichten und die Invarianten, die man vorher kennen muss
- [docs/offene-punkte.md](docs/offene-punkte.md) – bekannte Schwächen und Ideen, nach Nützlichkeit sortiert
- [docs/code-review-2026-09-21.md](docs/code-review-2026-09-21.md) – vollständige Code-Review zum Meilenstein V 0.6.0
- [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md) – Herleitung und Quellen der geschätzten Case-Gewichte
- [docs/mlt-truss-gewichte.md](docs/mlt-truss-gewichte.md) – Maße, Gewichte und Quellen der Pre-Rig-Traversen (MLT/S36PR)
- [docs/superpowers/plans/](docs/superpowers/plans/) – die Pläne aller bisherigen Versionen

## Wichtig: Datensicherung

**Alle Daten liegen im Browser (IndexedDB)!** Es gibt keine Sicherung auf dem Server. Regelmäßig Daten exportieren:

1. In der App auf „Sichern“ klicken – die JSON-Datei wird heruntergeladen
2. **In Dropbox ablegen** (z. B. in `/Dropbox/truckload-backups/`)
3. Wiederherstellen oder auf einen anderen Rechner übertragen: „Importieren“

So hast du immer ein Backup für den Fall, dass der lokale Browser-Speicher gelöscht wird.

## Neuen Load anlegen

„Neu“ (oben links) öffnet einen Wizard mit drei Schritten. „+ Material hinzufügen“ in der
Seitenleiste öffnet denselben Wizard für den aktuellen Load, dann ohne den ersten Schritt.

1. **Load** – Name und Fahrzeug (Truck) wählen.
2. **Cases** – aus der Bibliothek Cases mit Stückzahl auswählen, oder über „+ Neues Case“ bzw. „⬛ Sonderbau“ direkt neue Cases anlegen. „+ Traverse hinzufügen“ legt mengenbasiert klassische F34/F40-Wagen (Wagenbreite einstellbar) oder Pre-Rig-Traversen (MLT/S36PR) an.
   - „Suchen in“ bestimmt, woraus die Liste gespeist wird: **Standardkatalog** (Vorgabe: nur Vorlagen und Cases ohne Firma), **Kompletter Bestand** oder „nur <Firma>“.
   - Neue Cases, Traversen und Boxen-Dollys haben das Häkchen **„Im Materialbestand ablegen“** mit dem Ziel „Standardliste“ oder einer Firma (vorbelegt mit der gewählten Firma). Ohne Häkchen gilt das Case nur für diesen Load.
3. **Beschriften** – jedes einzelne Stück bekommt eine vorbelegte Beschriftung (z. B. „Kabelcase 1“ … „6“), die sich überschreiben lässt, sowie optional eine Gruppenfarbe. Dazu je Stück Häkchen für Lage (1–4) und „getippt“:
   - Vorbelegt sind Lage 1 und 2 sowie „getippt“. Lage 3 und 4 sind nie vorab angehakt, sie werden immer von Hand geklickt.
   - Die Zeile „Alle Stücke“ oben setzt oder entfernt ein Häkchen bei allen Stücken auf einmal, z. B. Lage 4 für alle. Sind die Stücke unterschiedlich eingestellt, zeigt das Häkchen einen Strich.
   - Nicht erlaubte Lagen und „getippt“ bei nicht tippbaren Cases sind ausgegraut und bleiben auch beim Klick in „Alle Stücke“ unberührt.
   - Die letzte angehakte Lage eines Stücks lässt sich nicht abwählen. Erlaubt ein Case-Typ weder Lage 1 noch 2, startet sein Stück ohne Lage, und „Fertig“ geht erst, wenn dort eine angehakt ist.
   - Ein Häkchen steuert, ob danach automatisch gepackt wird.

„Fertig“ legt den Load an und packt ihn bei aktiviertem Häkchen automatisch in den Truck.
Gefällt das Ergebnis nicht, legt „Truck entladen“ alle Cases zurück nach „Noch nicht
geladen“, um sie von Hand zu laden (rückgängig mit ⌘Z).

Automatisch gepackt wird **sortenrein**: Jeder Case-Typ kommt als eigener Block von der Stirnwand
zur Tür, Stücke mit eigener Gruppe bilden dabei einen eigenen Block. Die Reihenfolge legt man über
„Pack-Regeln …“ neben „Alles neu packen“ fest: eine Rangliste von Regeln – oben steht die
wichtigste, bei Gleichstand entscheidet die nächste.

Eine Regel spricht Traversen, eine Gruppe, einen Case-Typ oder ein Gewerk an und schiebt den
passenden Block „zuerst“ (an die Stirnwand) oder „zuletzt“ (an die Tür), zum Beispiel „Gruppe
„Motoren“: zuletzt“ oder „Traversen: zuerst“. Dazu kommen zwei Maßregeln ohne eigenes Ziel:
**Große zuerst** (nach Einzelvolumen) und **Stückzahl zuerst** (der Case-Typ mit den meisten
gleichen Stücken zuerst).

Eine eigene Gruppe je Stück (z. B. „Motoren“) vergibt man im Wizard, Schritt „Beschriften“ – dort
mit „Gruppe auf alle übernehmen“ für alle Stücke eines Case-Typs auf einmal –, oder nachträglich
im Inspector.

Eine Rangliste lässt sich als **Regelset** unter einem Namen sichern und über „Übernehmen“ im
Regelsets-Abschnitt des Dialogs in jedem anderen Load wieder einsetzen.

### Deckschicht mischen

Der Schalter „Deckschicht mischen“ im Dialog „Pack-Regeln …“ füllt freie Höhe auf den Stapeln
mit leichteren, kleineren Cases aus einem späteren Block, statt für sie eine eigene Bodenfläche
zu belegen – „schwer nach unten, leicht und klein nach oben“. Sortenrein bleibt dabei der Boden:
Nur was oben auf einem Stapel noch Platz hat, wird gemischt.

Die Reihenfolge bleibt dieselbe wie bisher: Erst versucht jedes Stück, den letzten offenen Stapel
des vorigen Blocks aufzufüllen (gleiche Grundfläche), dann einen eigenen Bodenstapel zu beginnen –
diese beiden Schritte ändert der Schalter nicht. Erst wenn beides nicht greift, kommt die
Deckschicht ins Spiel, und nur für sie gilt: Ein Stück darf auf ein Case seiner eigenen Sorte, oder
auf ein anderes, wenn beide dieselbe Gruppe tragen, oder – haben beide keine Gruppe – dasselbe
Gewerk. Dazu muss es leichter oder gleich schwer sein als das oberste Stück des Stapels und mit
seiner Grundfläche (ungedreht oder um 90° gedreht) vollständig darauf passen. Cases ohne Gewicht
(0 kg) mischen nicht – weder als Deckschicht auf ein fremdes Case, noch tragen sie eine fremde
Deckschicht, weil dort das Gewicht unbekannt ist.

Die Lagen je Stück gelten dabei weiter: Mit der Wizard-Vorgabe Lage 1 und 2 ist ein Stapel aus
zwei gleichen Cases schon voll, eine Deckschicht bräuchte dann Lage 3. Die Regel greift also vor
allem dort, wo ein Stapel niedriger bleibt als die Truckhöhe – bei nicht stapelbaren Sorten auf
nur einer Lage, bei einer ungeraden letzten Reihe, oder wenn die kleinen Cases Lage 3 bzw. 4
erlauben. Auch mit Deckschicht bleiben die Pack-Regeln gewahrt (eine Deckschicht wandert nie vor
einen Block, der laut Rangliste eigentlich zuletzt kommen soll), trägt eine Ebene nur ein Stück
(keine kleinen Cases nebeneinander auf einem großen), und Traversenwagen tragen nie etwas Fremdes
und stehen nie auf einer Deckschicht. Da es dabei immer der erste passende Stapel gewinnt, kann es
vorkommen, dass sich mehrere kleine Cases auf demselben großen Case stapeln, statt sich auf
mehrere große Cases zu verteilen.

Der Schalter gilt je Load und wandert, wie die Rangliste selbst, mit einem gespeicherten
Regelset mit.

Alte Loads ohne eigene Rangliste packen unverändert weiter: Fehlt sie, gilt automatisch die
bisherige Reihenfolge – bei ehemals „Große zuerst“ Traversen zuletzt, dann nach Einzelvolumen,
dann nach Stückzahl; bei ehemals „Stückzahl zuerst“ nach Stückzahl, dann nach Einzelvolumen.

Füllt eine Sorte ihre letzte Reihe nicht, darf die nächste die freien Spuren dieser Reihe
belegen und den letzten, nicht vollen Stapel auffüllen – weiter vorn wird nie gemischt.
„Rest einpacken“ setzt neue Cases an die letzte Reihe der vorhandenen Ladung an, weiter vorn füllt es keine Lücken.

Lage und „getippt“ eines einzelnen Stücks lassen sich auch nachträglich im Inspector ändern
– sowohl für ein Stück im Truck als auch für eines in „Noch nicht geladen“ (dort einfach die
Zeile in der Seitenleiste anklicken).

## Materialverwaltung

Die Materialverwaltung ist ein eigener Bereich für den Bestand an Cases, Traversen und
Boxen-Dollys. Sie ist immer erreichbar: über „Material“ auf dem Startbildschirm und über
„Material“ in der Kopfleiste, auch mitten in einem Load, und über „Material“ unten im Wizard
„Load zusammenstellen“. „Zurück“ führt dorthin zurück, wo man herkam – in den Wizard mit
unveränderter Auswahl. Solange sie offen ist, ruhen die Tastenkürzel des Ladeplans.

Links stehen der **Standardkatalog**, darunter alle Firmen mit der Zahl ihrer Cases, „+ Firma“
und „Nur in Ladeplänen“. Rechts liegt das Material der gewählten Stelle, aufgeteilt in die
Reiter Cases, Lautsprecher (Line-Array-Boxen, Subs, Boxen-Dollys), Traversen und Sonderbau, mit Suche.

- **Standardkatalog** – die mitgelieferten Vorlagen, nur lesbar. „Kopieren“ legt eine eigene
  Version in einer Firma an (oder in der Standardliste); die Vorlage selbst bleibt unverändert.
- **Firmen** – „+ Firma“ legt eine an (sie erscheint in der Liste, sobald ihr erstes Case
  gespeichert ist), „Firma umbenennen“ ändert den Namen an allen ihren Cases, „Firma löschen“
  entfernt sie samt ihren Cases nach Rückfrage.
- **Anlegen** – je Firma „+ Neues Case“, „+ Traverse“ und „+ Boxen-Dolly“. Die Firma ist dabei
  fest vorgegeben. Dollys sind firmenabhängig, weil die Wagenmaße es sind.
- **Bearbeiten und Löschen** – jede Zeile hat „Bearbeiten“ und „Löschen“. Gelöscht wird
  ausschließlich hier, nicht mehr in der Seitenleiste oder im Wizard. Eine gelöschte
  mitgelieferte Firmen-Vorlage wird nur ausgeblendet: Sie fehlt in allen Auswahllisten, alte
  Ladepläne behalten das Stück. Wird ein Case in Ladeplänen benutzt, fragt die App vorher nach.
- **Nur in Ladeplänen** – Cases, die im Wizard ohne Häkchen „Im Materialbestand ablegen“
  angelegt wurden. Sie tauchen in keiner Auswahl auf. Hier lassen sie sich mit „In Bestand
  übernehmen“ nachträglich in den Bestand holen oder löschen.

## 2D und 3D: zwei Ansichten, zwei Aufgaben

Die **2D-Ansichten** sind zum Planen da – nüchtern wie Tetris. Jedes Case ist ein Rechteck in
seinem echten Außenmaß **mit** Rollen, also genau die Fläche, die es im LKW belegt. Ein
dunkler Streifen an einer Kante zeigt, wo die Rollen sitzen (bei getippten Cases z. B. zur
Tür). Traversenwagen sind Kästen mit Gitterstruktur. Die **3D-Ansicht** ist die reale
Ansicht: Flightcases mit Alu-Profil, Ecken, Verschlüssen und Rollen, Traversen mit
Rollbrettern.

## 2D-Ansicht: Zoomen und Verschieben

Draufsicht, Seitenansicht und Rückansicht lassen sich jede für sich vergrößern, z. B. um
genau zu prüfen, wie die Cases stehen:

- **Zoomen:** Mausrad oder zwei Finger auf dem Trackpad auseinanderziehen, jeweils an der
  Mausposition. Oder die Knöpfe „−“ und „+“ oben rechts in jeder Ansicht.
- **Verschieben:** mit zwei Fingern wischen oder auf freier Fläche ziehen. Ziehen auf einem
  Case verschiebt weiterhin das Case.
- **Ganzer Truck:** Doppelklick auf freie Fläche oder der Knopf „Alles“.

Cases lassen sich auch gezoomt verschieben und aus der Liste hineinziehen. Beim
Hineinziehen rastet ein Case, wie beim Verschieben, an den Kanten der Nachbarn und an den
Wänden ein. Der Ausdruck zeigt immer den ganzen Truck.

## Case-Farbe: Schwarz, Gewerk, Gewicht

Oben in der Werkzeugleiste steht, wonach die Cases eingefärbt werden:

- **Schwarz** – wie im echten Leben: schwarzer Korpus, die Gewerk-Farbe nur als Streifen.
- **Gewerk** – der ganze Korpus in der Farbe des Stücks. Gut, um auf einen Blick zu sehen,
  wo Licht, Ton und Rigging stehen.
- **Gewicht** – schwer rot, leicht blau, abgestuft über die Spanne der Stücke **mit**
  bekanntem Gewicht in dieser Ladung. Damit sieht man sofort, ob die schweren Teile unten
  und gleichmäßig verteilt stehen.

Ein Case mit 0 kg heißt „unbekannt“, nicht „am leichtesten“. Es bleibt deshalb im
Gewichtsmodus neutral grau, statt als das leichteste Teil dazustehen. Traversenwagen behalten
ihre Markenfarbe, in jedem Modus.

## Lagen-Durchsicht

In der Draufsicht verdeckt die obere Lage die untere vollständig. Die Auswahl **Lagen** in der
Werkzeugleiste zeichnet alles oberhalb der gewählten Lage blass — die darunterliegenden Cases
werden lesbar, der Zusammenhang bleibt aber sichtbar, weil nichts verschwindet. In den
2D-Ansichten werden höhere Lagen blass gezeichnet, in der 3D-Ansicht ganz ausgeblendet — dort
ergibt das einen sauberen Schnitt durch die Ladung. Das ausgewählte Case bleibt in beiden
Fällen sichtbar. Der Ausdruck zeigt immer alle Lagen.

## Drucken: Ladeplan, Abhakliste, Etiketten

Neben dem Knopf „Drucken“ steht, was gedruckt wird:

- **Ladeplan** – das Planungsdokument: Draufsicht, Seitenansicht und eine Tabelle mit allen
  Stücken, Positionen und Gewichten.
- **Abhakliste** – für die Rampe: je geladenem Stück eine Zeile in Ladereihenfolge mit Nummer,
  Farbpunkt, Beschriftung und einem Kästchen zum Abhaken, unten eine Unterschriftszeile.
  Zweispaltig; rund 40 Cases passen auf ein Blatt. Liegt noch etwas in „Noch nicht geladen“,
  sagt der Kopf das ausdrücklich — eine abgehakte Liste heißt sonst, alles sei verladen,
  obwohl Cases in der Halle stehen. Warnungen aus dem Packergebnis stehen ebenfalls darauf.
- **Etiketten** – ein Bogen zum Ausdrucken und Zerschneiden, je Stück ein Etikett mit großer
  Ladenummer, Beschriftung, Farbbalken und „3 von 17“. Zwei Größen zur Wahl, beide auf
  gängiges Haftpapier abgestimmt: **Avery Zweckform 3425** (105 × 57 mm, 10 je Bogen) und
  **Avery Zweckform 3474** (70 × 37 mm, 24 je Bogen).

Etiketten drucken auf A4 hoch und randlos, Ladeplan und Abhakliste auf A4 quer. Vor dem ersten
Etikettenbogen einen Testdruck auf normalem Papier machen und gegen einen Bogen halten — der
senkrechte Rand der Avery-Bögen ist nicht aus Herstellerangaben belegt (siehe
[docs/offene-punkte.md](docs/offene-punkte.md)).

## Mitgelieferte Cases

In der Bibliothek und im Wizard gibt es neben „Eigene Cases“ und den Vorlagen einen
eigenen Abschnitt „Cases aus deiner Liste“ mit 122 Cases – übernommen aus der privaten
Excel-Tabelle „Casemaße Complete.xlsx“ (Blatt „Data Cases“), in der die Maße über Jahre
gepflegt wurden. Jeder Eintrag zeigt den Hersteller im Feld „Inhalt“ sowie die Firma, und
beide Listen lassen sich zusätzlich nach Firma filtern.

Leere Standard-Pack- und Kabelcases gibt es je Maß nur einmal, als „Packcase L×B×H“ mit
einem Standardgewicht (120×60×80, das Standard-Packcase 120×60×60 plus Rollen, = 100 kg,
die übrigen nach Volumen, z. B. 60×60×60 = 38 kg, 120×80×80 = 133 kg) unter den Vorlagen
(60×60×60, 60×60×73, 80×60×60, 120×60×60, 120×60×73, 120×60×80, 120×80×80). Ob später
Kabel oder etwas anderes hineinkommt, spielt fürs Laden keine Rolle.
Cases mit konkretem Inhalt (z. B. Powerlocksatz, Multicore, Laka Loom) bleiben eigene
Einträge. Traversenwagen stehen nicht mehr in der Liste; die baut man über
„+ Traverse hinzufügen“.

Im Gewerk „Ton“ gibt es seit V 0.10.0 Line-Array- und Sub-Vorlagen von sechs Herstellern
(L-Acoustics, d&b, Meyer Sound, Martin Audio, RCF, Nexo), recherchiert mit Quelle
(siehe [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)). Beim Einladen fragt ein
Dialog, wie viele Boxen auf dem Dolly übereinanderstehen; daraus entsteht ein eigener
Dolly-Stack (z. B. „L-Acoustics K2 4er (auf Dolly)“), der in 3D als gestapelte
Lautsprecher-Gehäuse mit Grille-Front gezeigt wird.

Die früheren Einträge (9 leere Pack-/Kabelcases, 5 Traversen)
sind nur ausgeblendet: Alte Ladepläne zeigen sie weiter unverändert. Sechs weitere Einträge
(Lakabaum flach/Transflex, 63A VT Haube, Rigpack, FD34 2m CUSTOMIZE, Slick) sind seit
2026-09-30 auf Nutzerwunsch ebenso ausgeblendet – die beiden Traversen-Reste-Cases baut man
stattdessen über „+ Traverse hinzufügen“.

Für 89 dieser Cases gibt es ein recherchiertes oder mit dem Nutzer abgestimmtes Schätzgewicht
(Netto-Gerätegewicht plus Case-Anteil, bei leeren Rack-/Dolly-Gehäusen ein Standardwert nach
Volumen, nachvollziehbar mit Quellen in [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)).
Zwei weitere Cases (die beiden FR10-Zeilen) tragen ihr unverändertes Originalgewicht aus
der Tabelle und zählen ausdrücklich nicht als Schätzung. Die restlichen 31 stehen bewusst
bei 0 kg – lieber ehrlich 0 kg als eine erfundene Zahl – und lassen sich im Inspector
jederzeit nachtragen.

## Tastenkürzel

| Taste | Aktion |
|-------|--------|
| **R** | Gedrehte Case um 90° drehen |
| **T** | Case tippen (tipLong / tipShort wechseln) |
| **W** | Rollenseite (Richtung) wechseln |
| **D** | Case duplizieren |
| **Entf** | Case löschen |
| **Pfeile (↑↓←→)** | Case in 5-cm-Schritten verschieben |
| **Shift + Pfeile** | Case in 1-cm-Schritten verschieben |
| **Cmd/Strg + Z** | Rückgängig |
| **Cmd/Strg + Shift + Z** | Wiederherstellen |
