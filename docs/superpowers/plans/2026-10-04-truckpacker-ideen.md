# Vier Ideen aus der Wettbewerbsrecherche (truckpacker.com)

## Context

Der Nutzer hat truckpacker.com als Wettbewerber im selben Feld (Touring, AV, Theater)
geprüft haben wollen. Ausgewertet wurden Startseite, `/docs`, `/changelog`, `/faq`,
`/roadmap` und die Gratis-Tools (`/tools/case-labels`, `/tools/case-checklist`). Die
Demo-Videos selbst liegen auf YouTube und konnten nicht angesehen werden – Changelog und
Doku waren ergiebiger.

**Abgrenzung:** Übernommen werden nur Funktionsideen, die in der Logistik Allgemeingut
sind (Abhaklisten, Etiketten, Gewichts-Heatmap, Lagen-Durchsicht). Layout, Wortlaut,
Grafiken und Code des Wettbewerbers werden nicht übernommen; alle vier Umsetzungen
entstehen eigenständig in Truckloads Sprache und Datenmodell.

**Bereits vorhanden, also nichts zu holen:** Radkästen als Sperrzonen, Stapelregeln mit
`maxTopLoad`/Lagen, Packgruppen, Gewicht/Schwerpunkt/Nutzlast, Ladereihenfolge
(`result.sequence`), Undo/Redo, Maßband in den 2D-Ansichten, Kollisionsmarkierung in der
Ansicht (`view2d.js:348`), Herstellermaße in der Bibliothek, metrische Einheiten,
Import/Export.

**Bewusst nicht übernommen:** QR-Codes auf dem Ausdruck (Truckload ist offline, es gibt
keinen Server, auf den ein Code zeigen könnte), Mehrbenutzer/Kollaboration/API/SSO (kein
Backend), AR/LiDAR-Vermessung, Mehr-Truck-Planung (steht schon als eigene Idee in
`docs/offene-punkte.md`, ist aber ein großes Feature und nicht Teil dieses Plans).

## Die vier Features

### 1. Abhakliste zum Ausdrucken

Heute erzeugt `buildPrint()` (`js/ui/print.js`, 30 Zeilen) genau ein Dokument: Kopf +
Draufsicht + Seitenansicht + 9-spaltige Tabelle. Das ist ein Planungsdokument, nichts, was
man auf der Rampe abhakt.

Neu: ein zweites Druckdokument mit je Stück einer Zeile in Ladereihenfolge –
Ladenummer, Farbpunkt (Gewerk-/Stückfarbe), Beschriftung, Kästchen zum Abhaken. Dazu im
Kopf Loadname/Fahrzeug/Datum und „N Cases“, am Fuß eine Unterschriftszeile. Zweispaltig,
damit ein normaler Load auf ein Blatt passt.

### 2. Case-Etiketten drucken

Drittes Druckdokument: ein Bogen Etiketten, je Stück eines – Ladenummer groß, darunter
die Beschriftung, farbiger Balken nach Stückfarbe, klein der Loadname und „3 von 17“.
Zweck: beim Abladen sortiert man nach Farbe und Nummer schneller als nach Namen.

Zwei Rastergrößen zur Wahl (metrisch, A4-Bogen – nicht die US-Avery-Maße des
Wettbewerbers): groß ca. 105×57 mm (10 je Bogen) und klein ca. 70×37 mm (24 je Bogen).

### 3. Farbmodus „Gewicht“

Dritter Knopf neben „Schwarz“/„Gewerk“ in der Werkzeugleiste. Schwer = rot, leicht =
blau, über die Spanne der Stücke **mit** Gewicht im aktuellen Load normiert.

Wichtig und bewusst: Ein Case mit `weight: 0` heißt „unbekannt“, nicht „am leichtesten“
(dieselbe Regel wie bei der Deckschicht, V 0.8.6) – es bekommt einen neutralen Grauton
statt der kältesten Farbe.

Umsetzung ohne Bruch des bestehenden Vertrags von `caseColors(c, mode, itemColor)`
(`js/ui/caseStyle.js` – die Signatur ist dort ausdrücklich als getesteter Vertrag
kommentiert): Der Modus `'weight'` verhält sich wie `'trade'` (Körper in der übergebenen
Farbe, kein Streifen); die Farbe selbst rechnet eine neue, eigen getestete Funktion
`weightColor(kg, min, max)` in `caseStyle.js` aus, die der Aufrufer als `itemColor`
durchreicht – genau wie heute schon die Stückfarbe.

### 4. Lagen-Durchsicht

In der Draufsicht verdeckt Lage 2 die Lage 1 vollständig. Neu: eine Auswahl „Lagen: alle /
bis 1 / bis 2 / bis 3“, die Stücke oberhalb der gewählten Lage blass zeichnet (nicht
versteckt – der Kontext bleibt sichtbar).

**Bewusst nur 2D.** In der 3D-Ansicht kann man ohnehin umherfahren, und die geteilten
Materialien/InstancedMeshes (`js/ui/view3d.js`, `userData.shared`) machen eine
Pro-Stück-Transparenz dort zu einem deutlich größeren Eingriff. Eigene Entscheidung,
im Code und in `docs/offene-punkte.md` als solche vermerkt.

## Betroffene Dateien

- `js/ui/print.js` – zwei weitere Export-Funktionen neben `buildPrint()`; gemeinsamer
  Kopf-Baustein. Keine neue Datei, damit `sw.js` unverändert bleibt.
- `css/print.css` – Regeln für Abhakliste (zweispaltig, Kästchen, Unterschriftszeile) und
  Etikettenraster. **`@page` bleibt A4 quer für alle drei Dokumente** – benannte Seiten
  (`@page x { … }` + `page:`) wären nötig, um je Dokument zwischen quer und hoch zu
  wechseln, und deren Browser-Unterstützung ist uneinheitlich. Quer funktioniert für alle
  drei; Hochformat nur, falls der Nutzer es ausdrücklich will.
- `index.html` – Auswahl neben „Drucken“ (Plan / Abhakliste / Etiketten), Knopf
  „Gewicht“ in der Farbmodus-Gruppe, Auswahl „Lagen“ bei den 2D-Ansichten.
- `js/app.js` – Verdrahtung: Druckart an `buildPrint`/die neuen Builder, `caseColors`-Modus
  `'weight'` in `s.caseColors` (inkl. `localStorage`, s. `CASE_COLORS_KEY`), Lagen-Auswahl
  in den Render-Hook.
- `js/ui/caseStyle.js` – `weightColor()`, Modus `'weight'` in `caseColors`.
- `js/ui/view2d.js` – Lagen-Durchsicht (Opazität je Stück aus `result.layers`).
- Tests: `tests/caseStyle.test.js` (weightColor inkl. 0-kg-Fall und Einzelstück-Load, wo
  min = max), ggf. ein kleiner Test für die Lagen-Opazitätsregel als reine Funktion.
- Doku: `README.md` (Druckarten, Farbmodus, Lagen), `docs/architektur.md`,
  `docs/offene-punkte.md` (3D-Lagen-Durchsicht als bewusst offen), `CHANGELOG.md`.

## Ablauf

Nach CLAUDE.md: Plan unter `docs/superpowers/plans/` ablegen, dann
`superpowers:subagent-driven-development` – vier Tasks, je Feature einer, jeweils mit
eigenem Test und Review. Branch `feature/truckpacker-ideen`.

Version am Ende: Patch-Vorschlag **0.8.12**. (Nach CLAUDE.md nur auf ausdrücklichen Wunsch
Minor – bei vier sichtbaren Features wäre 0.9.0 aber vertretbar, wenn der Nutzer das will.)

## Verifikation

- `npm test` grün, inklusive der neuen Tests zu `weightColor` (0 kg → neutral, min = max →
  kein Division-durch-null-Fehler).
- Browser über `tools/cdp.mjs`, Server auf 8766, mit einem gepackten Load (gemischte
  Gewichte, mindestens zwei Lagen, ein Case mit 0 kg):
  - Farbmodus „Gewicht“: Screenshot Draufsicht + Rückansicht, schweres Case sichtbar rot,
    leichtes blau, 0-kg-Case grau.
  - Lagen-Durchsicht: Screenshot „alle“ gegen „bis 1“ – in „bis 1“ sind die Stücke der
    Lage 2 blass und die darunterliegenden erkennbar.
  - Abhakliste und Etiketten: Druckvorschau je als Screenshot (`Emulation.setEmulatedMedia`
    auf `print` oder direkt `#print-root` sichtbar schalten), prüfen, dass Nummerierung
    der Ladereihenfolge entspricht, Farbpunkte stimmen und nichts über den Seitenrand läuft.
- Screenshots selbst ansehen; nur Aufnahmen zählen, auf denen das Geprüfte zu sehen ist.
