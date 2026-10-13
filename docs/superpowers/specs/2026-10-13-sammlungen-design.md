# Sammlungen – jede Case-Sammlung ein eigenes JSON

Stand: Entwurf vom 2026-10-13, Grundlage ist V 0.16.0. Freigegeben im Gespräch am 2026-10-13.

## Ziel

Heute ist eine „Firma“ nur ein `company`-String an jedem Case. Alle Cases liegen gemischt im
Store `cases` (in NYX `~/.lpm/lpm_types.db`). Beim Zusammenführen nach NYX lässt sich so nichts
einzeln mitnehmen, und Hersteller-Bibliotheken lassen sich nicht nachträglich einbauen oder
verteilen.

**Eine Sammlung ist ein Datensatz und damit ein JSON** – im Speicher, im Export und im Repo.
In der Oberfläche heißt „Firma“ künftig „Sammlung“.

Ein neuer Nutzer legt Cases an und sortiert sie später: Oberfirma (z. B. TSE, CAB, BBM) →
Hersteller (z. B. Robe) → einzelne Geräte oder neutrale Packkisten. Das ist ein Baum von
Sammlungen.

Entschieden vom Nutzer: Baum statt flach; die Listen-Cases (CAB, BBM, Motion …) gehen in „Meine
Sammlung“; mitgeliefert werden genau zwei JSON-Dateien, `standard.json` und `meine.json`.

## Datenmodell

```
Sammlung = { id, name, parentId?, updatedAt, cases: [Case, …] }
```

- Neuer Object Store `collections` neben `cases`, `trucks`, `plans`, `ruleSets`.
- Feste IDs: `standard` (mitgeliefert, nur lesbar) und `meine` („Meine Sammlung“, beschreibbar).
  Eigene Sammlungen bekommen eine UUID.
- Im Speicher bleibt die **flache Case-Liste**; UI und Packer ändern sich nicht. `loadAll()` setzt
  sie aus allen Sammlungen zusammen und ergänzt je Case `collectionId` (nicht gespeichert, aus der
  Zugehörigkeit abgeleitet).
- `company` bleibt ein gewöhnliches Case-Feld (CAB, BBM …) und wird von der Oberfläche nicht mehr
  verwaltet. Sammlung und Firma sind getrennte Begriffe. *(eigene Entscheidung)*
- Sammlungsnamen sind global eindeutig, Baumtiefe höchstens 4, kein Zyklus über `parentId`.
  *(eigene Entscheidung)*

## Mitgelieferte Daten

- `js/data/standard.json`: die 57 Vorlagen aus `preset-cases.js` (IDs `preset-…`,
  `builtin: true`), endgültig ausgerechnet.
- `js/data/meine.json`: die Cases aus `case-library.js` (IDs `lib-…`) einschließlich der
  `legacy`-Einträge; die Firma bleibt am Case.
- Erzeugt einmalig aus den heutigen Modulen und per Test gegen sie abgeglichen (Anzahl, IDs, Maße,
  Gewichte).
- Geladen per `fetch` mit relativen Pfaden, damit es auch unter `truckload://app/` läuft. Beide
  Dateien stehen in `sw.js` `ASSETS`.
- **Standard** wird bei jedem Start neu gelesen. **Meine Sammlung** wird beim ersten Start einmalig
  angelegt, liegt danach im Store und wird nie nachgesät, sonst kämen gelöschte Cases zurück.
  *(eigene Entscheidung)*

## Migration

- Existiert der Datensatz `meine` nicht, entsteht er aus `meine.json` plus allen eigenen Cases des
  alten Stores `cases` (die eigene Version gewinnt je ID; Überlagerungen und `legacy` bleiben).
  Alles in **einem** `writeMany`.
- Der alte Store `cases` wird nicht gelöscht, nur nicht mehr gelesen.
- Alte Sicherungen mit flacher `cases`-Liste importieren weiter; die Cases landen in „Meine
  Sammlung“. Neue Bundles tragen `collections`, `parseBundle` nimmt beide Formen.
- Pläne bleiben unverändert (Verweis per `caseId`).

## Schichten

- `js/model/collections.js` (neu, rein, ohne DOM): Zusammensetzen und Aufteilen, Baum,
  Nachfahren, Verschieben, Namensprüfung, Löschen.
- `js/store/db.js`: `STORES` um `collections`, `DB_VERSION` 2 → 3.
- `js/store/repo.js`: Laden setzt aus Sammlungen zusammen; Speichern liest-ändert-schreibt den
  betroffenen Sammlungs-Datensatz; „Sammlung löschen“ ist ein einziger Datensatz.
- `js/store/io.js`: Export und Import je Sammlung als `sammlung-<name>.json`.
- Vorgabeziel neuer Cases: „Meine Sammlung“ statt Standardliste.

## Oberfläche

- „Firma“ → „Sammlung“ in allen sichtbaren Texten (Materialverwaltung, Wizard, Rückfragen,
  README). Code-Namen und das Feld `company` bleiben.
- Materialverwaltung: links ein Baum, „+ Sammlung“ mit Eltern-Auswahl, Umbenennen, Verschieben,
  Löschen, Exportieren, Importieren, je Case „In Sammlung verschieben“.
- Wizard-Filter „Suchen in“ listet Sammlungen, eine Eltern-Sammlung schließt Untersammlungen ein.
  Vorgabe bleibt der Standardkatalog (Cases ohne `company`); firmen-gebrandete Cases erscheinen nie
  von selbst.

## Dokumentation

`docs/nyx-sammlungen.md` für den NYX-Admin (Store, Datensatzform, was NYX tun muss), dazu
`docs/architektur.md`, `README.md`, `docs/offene-punkte.md`, CHANGELOG.

## Version

Vorschlag Patch 0.16.1 nach Projektregel. Minor 0.17.0 wäre vertretbar, nur auf Wunsch.

## Nicht Teil davon

NYX-seitige Änderungen (Store freigeben, Zusammenführen auswählbar machen) – beschrieben, nicht
umgesetzt.
