# Truckload – Ladeplaner für Event-Cases

Version: **V 0.8.4** – siehe [CHANGELOG.md](CHANGELOG.md).

Lokale Vanilla-JavaScript-App zur Planung und Visualisierung von Laderaum-Aufteilungen im LKW. Cases (auf Rollen, stehend oder getippt) werden interaktiv in den Laderaum positioniert, Kollisionen und Grenzen werden live geprüft.

## Start

**Einfach öffnen:** https://m4dm0nky.github.io/Truckload/

Nichts installieren, kein Terminal. Nach dem ersten Öffnen läuft die App auch offline.

**Als App ins Dock (empfohlen):**
- Safari: Seite öffnen → Menü *Ablage → Zum Dock hinzufügen*
- Chrome: Seite öffnen → Installieren-Symbol rechts in der Adressleiste

Updates kommen automatisch: Die neue Version ist beim übernächsten Öffnen aktiv.

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
2. **Cases** – aus der Bibliothek Cases mit Stückzahl auswählen, oder über „+ Neues Case“ bzw. „⬛ Sonderbau“ direkt neue Cases anlegen. „+ Traverse hinzufügen“ legt mengenbasiert klassische F34/F40-Wagen oder Pre-Rig-Traversen (MLT/S36PR) an.
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

Alte Loads ohne eigene Rangliste packen unverändert weiter: Fehlt sie, gilt automatisch die
bisherige Reihenfolge – bei ehemals „Große zuerst“ Traversen zuletzt, dann nach Einzelvolumen,
dann nach Stückzahl; bei ehemals „Stückzahl zuerst“ nach Stückzahl, dann nach Einzelvolumen.

Füllt eine Sorte ihre letzte Reihe nicht, darf die nächste die freien Spuren dieser Reihe
belegen und den letzten, nicht vollen Stapel auffüllen – weiter vorn wird nie gemischt.
„Rest einpacken“ setzt neue Cases an die letzte Reihe der vorhandenen Ladung an, weiter vorn füllt es keine Lücken.

Lage und „getippt“ eines einzelnen Stücks lassen sich auch nachträglich im Inspector ändern
– sowohl für ein Stück im Truck als auch für eines in „Noch nicht geladen“ (dort einfach die
Zeile in der Seitenleiste anklicken).

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

## Mitgelieferte Cases

In der Bibliothek und im Wizard gibt es neben „Eigene Cases“ und den Vorlagen einen
eigenen Abschnitt „Cases aus deiner Liste“ mit 128 Cases – übernommen aus der privaten
Excel-Tabelle „Casemaße Complete.xlsx“ (Blatt „Data Cases“), in der die Maße über Jahre
gepflegt wurden. Jeder Eintrag zeigt den Hersteller im Feld „Inhalt“ sowie die Firma, und
beide Listen lassen sich zusätzlich nach Firma filtern.

Leere Standard-Pack- und Kabelcases gibt es je Maß nur einmal, als „Packcase L×B×H“ mit
0 kg unter den Vorlagen (60×60×60, 60×60×73, 80×60×60, 120×60×60, 120×60×73, 120×60×80,
120×80×80). Ob später Kabel oder etwas anderes hineinkommt, spielt fürs Laden keine Rolle.
Cases mit konkretem Inhalt (z. B. Powerlocksatz, Multicore, Laka Loom) bleiben eigene
Einträge. Traversenwagen stehen nicht mehr in der Liste; die baut man über
„+ Traverse hinzufügen“. Die früheren Einträge (9 leere Pack-/Kabelcases, 5 Traversen)
sind nur ausgeblendet: Alte Ladepläne zeigen sie weiter unverändert.

Für 65 dieser Cases gibt es ein recherchiertes Schätzgewicht (Netto-Gerätegewicht plus
Case-Anteil, nachvollziehbar mit Quellen in [docs/casemasse-gewichte.md](docs/casemasse-gewichte.md)).
Zwei weitere Cases (die beiden FR10-Zeilen) tragen ihr unverändertes Originalgewicht aus
der Tabelle und zählen ausdrücklich nicht als Schätzung. Die restlichen 61 stehen bewusst
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
