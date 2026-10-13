# Sammlungen: was NYX wissen muss

Gilt seit V 0.17.0. Diese Datei ergänzt [nyx-host.md](nyx-host.md) und richtet sich an die
NYX-Entwicklung bzw. -Administration, die Truckload als Submodul einbindet. Sie beschreibt den
neuen Store `collections`. Truckload ändert nichts an NYX; die Punkte unter „Was NYX tun muss“
sind Aufgaben auf NYX-Seite, und sie müssen **vor** der Übernahme dieser Version erledigt sein.

## Zuerst: was NYX tun muss

0. **Mindestversion der Laufzeit: Chromium ≥ 123, also Electron ≥ 30.** Ab V 0.17.0 lädt Truckload
   `data/standard.json` und `data/meine.json` über JSON-Module (`import … with { type: 'json' }`,
   „Import Attributes“). Ältere Chromium-Versionen (Electron ≤ 29) lesen diese Syntax nicht; die
   App startet dort **nicht** (statt einer Oberfläche erscheint nur der Ladefehler-Hinweis). Für
   andere Browser gilt: Safari ≥ 17.2, Firefox ≥ 138. Die Zahlen stammen aus den
   Herstellerangaben, hier nicht geprüft. Vor der Übernahme die Chromium-Version des
   ausgelieferten NYX-Electron prüfen (`process.versions.chrome`).
1. **Den Store `collections` freigeben.** NYX lehnt unbekannte Stores ab (siehe
   [nyx-host.md](nyx-host.md), „Ein neuer Store braucht eine Absprache mit NYX“). `collections`
   gehört wie `cases`, `trucks` und `ruleSets` zu den **projektübergreifenden** Stores
   (`~/.lpm/lpm_types.db`), nicht in die Projektdatei wie `plans`. Alle vier Funktionen des
   Hosts (`getAll`, `put`, `del`, `writeMany`) müssen den Namen `collections` annehmen.
2. **Den Store `cases` weiter freigeben und lesbar halten.** Truckload liest ihn bei jedem Start
   (Migration, siehe unten) und löscht ihn nie. Schreibt Truckload ab V 0.17.0 Cases, dann nur noch
   in `collections`.
3. **Zusammenführen je Datensatz, nicht je Case.** Eine Sammlung ist **ein** Datensatz; ihre Cases
   stehen als Liste darin. Wer in NYX Sammlungen aus mehreren Quellen vereint, entscheidet je
   Datensatz nach `id` (gleiche Sammlung), `name` (gleicher Anzeigename unter anderer `id`) und
   `updatedAt` (der neuere Stand gewinnt). Innerhalb eines Datensatzes kennt NYX keine Cases
   einzeln; ein Datensatz wird als Ganzes genommen oder verworfen.
4. **Hersteller-Bibliotheken** lassen sich auf NYX-Seite als Datensatz (`put`) einspielen oder
   vom Nutzer in Truckload über die Sammlungsdatei (unten).

### Was passiert, wenn NYX den Store nicht kennt

Lehnt der Host `getAll('collections')` ab, scheitert `loadAll()`. Truckload zeigt dann die
Ersatzansicht (`loadAllFallback()`: nur die mitgelieferten Vorlagen und Fahrzeuge, keine eigenen
Daten) und **sperrt jeden Schreibzugriff bis zum Neuladen** („Laden aus NYX fehlgeschlagen –
Truckload bitte neu laden.“, siehe [nyx-host.md](nyx-host.md)). Es gehen keine Daten verloren,
aber der Nutzer sieht seinen Bestand nicht und kann nichts speichern, bis NYX den Store kennt.
Wird nur der Schreibzugriff abgelehnt (Lesen geht), meldet jeder Speichervorgang einen Fehler und
der Store bleibt unverändert.

Weitere Folgen für NYX:

- **Eine Sammlung ist ein größerer Datensatz.** Jede Änderung an einem Case schreibt den ganzen
  Datensatz der betreffenden Sammlung (Lesen, ändern, `put`). Bei einer großen Sammlung („Meine
  Sammlung“ mit mehreren hundert Cases) sind das bei etwa 350 Byte je Case und einigen hundert Cases rund 100–200 KB je Speichern.
- **Zwei Clients gleichzeitig** (zwei Fenster, zwei NYX-Instanzen auf demselben Bestand): gewinnt
  der zuletzt schreibende Datensatz ganz; Cases, die der andere Client im selben Datensatz
  geändert hat, gehen damit verloren. Je Case gibt es kein Zusammenführen auf NYX-Seite.
- **`writeMany` ist über beide Dateien nicht atomar** (zuerst die projektübergreifenden Stores,
  dann die Pläne, siehe [nyx-host.md](nyx-host.md)). Der Import einer Sicherung mischt jetzt
  `collections` (projektübergreifend) mit `plans` (Projektdatei) in einem Aufruf. Bricht er
  zwischen den Dateien ab, sind die Sammlungen geschrieben und die Pläne nicht. Truckload meldet
  den Fehler; ein erneuter Import holt es nach (gleiche IDs, der neuere Stand gewinnt).
  Alle übrigen Sammlungs-Vorgänge (Case speichern, Sammlung anlegen, umbenennen, verschieben,
  löschen, Sammlungsdatei importieren) berühren nur `collections` und sind damit ein
  `writeMany` in **einer** Datei, also atomar.
- **JSON-Module:** `data/standard.json` und `data/meine.json` werden zur Laufzeit als
  JSON-Module geladen (`import … with { type: 'json' }` in `js/data/preset-cases.js` und
  `js/data/case-library.js`). Das Protokoll `truckload://app/` muss `.json` deshalb mit
  `Content-Type: application/json` ausliefern.

## Datensatz im Store `collections`

```json
{
  "id": "3f6c1c0a-8d1e-4a58-9d7e-0f2d5b1c9a11",
  "name": "Robe",
  "parentId": "b7e2c9a4-0c53-4f0e-8a31-5d0f6f7a2b10",
  "updatedAt": "2026-10-13T09:30:00.000Z",
  "cases": [
    { "id": "6a1d…", "name": "Robe Pointe", "company": "Robe", "category": "Licht",
      "l": 120, "w": 60, "h": 80, "weight": 100, "updatedAt": "2026-10-13T09:30:00.000Z" }
  ]
}
```

| Feld | Bedeutung |
|---|---|
| `id` | nicht leerer String (in Dateien höchstens 64 Zeichen), Primärschlüssel. `meine` ist fest vergeben („Meine Sammlung“); `standard` wird **nie** gespeichert (und ein Datensatz mit dieser `id` wird beim Laden ignoriert). Sonst eine UUID. Die Grenze von 64 Zeichen gilt für Dateien; gespeicherte Datensätze werden dagegen nicht geprüft, NYX darf längere IDs also nicht ablehnen |
| `name` | Anzeigename, höchstens 80 Zeichen, nicht leer, nicht `__…__` (reserviert), innerhalb eines Bestands eindeutig ohne Beachtung der Groß-/Kleinschreibung (auch gegen „Standard“ und „Meine Sammlung“). Der Datensatz `meine` trägt seinen Namen, die App nimmt ihn aber immer aus dem Code |
| `parentId` | optional, `id` der Oberebene; fehlt bei Sammlungen der obersten Ebene. Höchstens 4 Ebenen, keine Schleifen. Das erzwingt die App beim Anlegen und Verschieben; gespeicherte Datensätze werden beim Laden nicht darauf geprüft, NYX-Zusammenführcode darf tiefere Bäume nicht ablehnen |
| `updatedAt` | ISO-Zeitstempel (String). Truckload setzt ihn bei jedem Schreiben; ein Wert, der kein String ist, wird beim Laden entfernt |
| `cases` | die Cases der Sammlung in der Form, in der sie bisher im Store `cases` lagen. Das Feld `collectionId` steht dort **nicht**; es wird beim Laden aus der Zugehörigkeit gesetzt |

Das Feld `company` am Case ist der Name der Sammlung, in die das Case zuletzt verschoben oder
gespeichert wurde; bei eigenen benannten Sammlungen entspricht es dem Namen der Sammlung. Bei
nicht verschobenen mitgelieferten Listen-Cases (alle 137 Einträge von `data/meine.json` tragen
eines, z. B. „CAB“, „BBM“) und bei migrierten alten Cases steht dort der frühere Firmenname, obwohl
der Datensatz `meine` ist. `company` ist eine Anzeige- und Zuordnungshilfe (Dolly-IDs,
Traversen-Treffer, „· Name“ in Listen), keine Verknüpfung; **maßgeblich ist der Datensatz, in dem
das Case steht**, nicht `company`.

Der Datensatz `meine` kann außer eigenen Cases auch **Überlagerungen** mitgelieferter Listen-Cases
enthalten: ein Case mit einer `lib-…`-ID und `builtin: false`, das ein bearbeitetes, verschobenes
oder ausgeblendetes (`legacy: true`) Listen-Case ersetzt. Solche Cases dürfen beim Zusammenführen
nicht verloren gehen, sonst taucht die mitgelieferte Version wieder auf.

## Was Truckload selbst tut

- **Migration:** Gibt es im Store `cases` Datensätze, aber keinen Datensatz `meine`, schreibt
  Truckload beim Start alle eigenen Cases des alten Stores als Datensatz `meine` nach `collections`
  (ein `writeMany`, nichts wird gelöscht). Der alte Store bleibt als Sicherheitsnetz liegen, wird
  danach inhaltlich nicht mehr verwendet, sobald `meine` existiert (gelesen wird er weiter,
  deshalb muss `cases` freigegeben bleiben). Scheitert das Schreiben, läuft die App
  mit dem berechneten Stand weiter; der nächste Speichervorgang baut den Datensatz aus dem alten
  Store auf, es geht nichts verloren.
- **Mitgeliefert** werden zwei Sammlungen als Dateien in der App, nicht im Store:
  `data/standard.json` (Standardvorlagen, nur lesbar) und `data/meine.json` (Listen-Cases). Sie
  werden bei jedem Start neu gelesen und hinter die eigenen Cases gemischt; gleiche `id` gewinnt
  das eigene Case. Bearbeiten, Verschieben oder Ausblenden eines Listen-Cases schreibt eine
  Überlagerung gleicher `id` in den Datensatz der Sammlung.
- **Sammlung löschen** entfernt den Datensatz samt Untersammlungen. Mitgelieferte Listen-Cases
  darin werden als ausgeblendete Überlagerung (`legacy: true`, `company` bleibt) in `meine`
  abgelegt, damit alte Ladepläne ihr Stück behalten. Alles andere fällt mit dem Datensatz weg.
  Pläne verweisen weiter nur per `caseId`; ein Plan behält sein Stück nur, solange das Case in der
  App bekannt ist.
- **Sammlungsdatei:** „Sammlung exportieren“ und „Sammlung importieren“ in der Materialverwaltung.
  Format `truckload-collection`, Version 1:

  ```json
  { "format": "truckload-collection", "version": 1, "appVersion": "0.17.0",
    "exportedAt": "2026-10-13T09:30:00.000Z",
    "collection": { "id": "3f6c1c0a-…", "name": "Robe" },
    "cases": [ { "id": "6a1d…", "name": "Robe Pointe", "l": 120, "w": 60, "h": 80, "weight": 100 } ] }
  ```

  Die Datei enthält nur Bestand dieser einen Sammlung, ohne mitgelieferte Cases (`builtin: true`)
  und ohne `collectionId`. Beim Import mischt eine gleiche `id` in die vorhandene eigene Sammlung
  (je Case gewinnt der neuere `updatedAt`; ohne Zeitstempel oder gegen ein mitgeliefertes Case
  gewinnt die Datei); ein gleicher Name unter anderer `id` bekommt das Suffix „ (2)“, „ (3)“ …;
  die Sammlung landet auf der obersten Ebene. Die Datei braucht auf NYX-Seite nichts: sie läuft
  über den normalen „Importieren“-Dialog des Browsers.
- **Sicherung („Sichern“):** trägt zusätzlich das Feld `collections` mit den eigenen Sammlungen,
  je `{ id, name, parentId?, updatedAt? }` (ohne Cases, ohne „Standard“ und „Meine Sammlung“).
  Die Cases stehen weiter flach in `cases`, jedes mit `collectionId`. Alte Sicherungen ohne dieses
  Feld laden weiter: neue Cases kommen nach „Meine Sammlung“, ein Case, das lokal schon in einer
  Sammlung liegt, bleibt dort. Beim Einlesen werden doppelte oder
  reservierte Namen umbenannt, unbekannte Oberebenen und Schleifen auf die oberste Ebene gesetzt
  und Cases mit unbekannter `collectionId` wie Cases ohne Angabe behandelt (neue nach „Meine
  Sammlung“, lokal schon zugeordnete bleiben in ihrer Sammlung); das meldet Truckload
  unter „Beim Import angepasst“. Höchstens 200 Sammlungen je Datei.
- **Schreibreihenfolge:** Alle Case-Schreibvorgänge laufen in der App nacheinander durch eine
  Warteschlange, damit zwei Vorgänge nicht denselben Datensatz überschreiben. Für den Host heißt
  das: höchstens ein Sammlungs-`writeMany` ist gleichzeitig unterwegs.

## Nicht Teil dieser Version

- Die Listen-Cases (CAB, BBM, Motion …) liegen zusammen in „Meine Sammlung“; eine Aufteilung je
  Firma in eigene Datensätze ist nicht erfolgt (siehe [offene-punkte.md](offene-punkte.md)).
- Truckload ordnet Cases nicht automatisch einer Sammlung zu; das macht der Nutzer („Verschieben“).
- NYX-seitige Änderungen (Store freigeben, Zusammenführen auswählbar machen) sind hier nur
  beschrieben, nicht umgesetzt.
