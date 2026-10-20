# Lampengewichte für Robe- und Chauvet-Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die 79 Lampencases von Robe (72) und Chauvet (7 von 9) bekommen ein Beladungsgewicht statt 0 kg: Case-Gewicht plus Anzahl der Lampen mal Einzelgewicht der Lampe.

**Architecture:** Reine Daten in `data/standard.json`. Die Rechnung läuft einmalig im Scratchpad (`lampen/rechnen.py`, nicht im Repo) und liefert `lampen/gewichte.json` = `{ "<preset-id>": { "weight": number, "note": string } }`. Ein Task schreibt diese Werte in die vorhandenen Einträge und passt die Tests an. Kein neuer Code, kein neues Feld.

**Tech Stack:** `node --test`, JSON.

**Spec:** Chat 2026-10-20: „Lampencases lassen sich ggfs doch halbwegs gut schätzen, weil du das Gewicht pro Lampe im Internet findest und dann mal und das Case dazu.“ Der Name der Quellseite der Case-Listen steht nirgends im Repo.

## Rechenregel (Entscheidungen der Hauptsession, keine Herstellerangaben)

- **Lampe:** Netto-Gewicht der Lampe laut Datenblatt des Herstellers. Steht ein Case für mehrere Varianten (z. B. „BMFL“ = Spot, Wash, Blade, WashBeam), gilt die schwerste. Bei PATT 2017 und pixelPATT kommt die Treiber-Box (3,0 kg) je Lampe dazu.
- **Robe-Case (leer, geschätzt):** 13,2 kg je m² Außenfläche (Median der leeren Elation- und Chauvet-Cases, Spanne 10,0 bis 14,7), Fläche = 2·(l·w + l·h + w·h) aus den Maßen des Presets. `note` = `Gewicht geschätzt`.
- **Chauvet-Case:** Das Leergewicht des Cases ist bekannt (aus der Case-Liste, in kg umgerechnet); Gewicht = Leergewicht + Lampenzahl × schwerste Lampe des Cases. `note` = `Gewicht berechnet`.
- **Bleibt 0 mit `Gewicht unbekannt`:** `Chauvet Professional Rogue R1 Hybrid (2) Roadcase` (kein Einzelgewicht der Lampe gefunden) und `Chauvet Professional CP Rack` (kein Lampencase).
- **Unverändert:** `Chauvet Professional Epix Line 10 IP 10er Roadcase` (79,8 kg, beladen) und alle Elation-, DiGiCo- und d&b-Einträge.
- Zubehör im Case (Klemmen, Kabel, Treiber ohne Angabe) ist nicht eingerechnet.

## Global Constraints

- Der Name der Quellseite der Case-Listen und der Lampendaten-Quellen steht nirgends im Repo (Daten, Doku, Tests, Commits, CHANGELOG); `note` bleibt bei den vier Texten oben.
- Bestehende Einträge behalten alle Felder außer `weight` und `note`; Reihenfolge und IDs bleiben.
- Eine Versionsnummer überall; die Version wird gemeinsam mit dem Traversen-Katalog angehoben (Patch 0.17.4, vom Nutzer zu bestätigen).
- Subagenten starten die App nicht.

## Review Focus

- Ein Case, dessen Name keine Lampenzahl hergibt oder dessen Modell kein Gewicht hat, darf nicht mit einem geratenen Wert enden: bleibt 0 mit `Gewicht unbekannt`.
- Die Hinweis-Regel „Gewicht 0 genau dann mit `Gewicht unbekannt`“ muss nach der Änderung weiter für alle neuen Vorlagen gelten.
- Rundung: einmal am Ende auf eine Nachkommastelle, nicht über Zwischenwerte.

---

### Task 1: Gewichte in `standard.json` schreiben, Tests anpassen

**Files:**
- Modify: `data/standard.json` (nur `weight` und `note` der 79 Einträge)
- Modify: `tests/dataJson.test.js`
- Read: `<scratchpad>/lampen/gewichte.json`

**Interfaces:**
- Consumes: `gewichte.json` (Schlüssel = Preset-ID, Werte `{ weight, note }`; 79 Einträge, davon 1 mit `weight: 0`).

- [ ] **Step 1: Tests zuerst (rot).** In `tests/dataJson.test.js`: (a) der Test „alle 72 Robe-Vorlagen haben Gewicht 0“ wird ersetzt durch „alle 72 Robe-Vorlagen haben ein geschätztes Gewicht“: jede hat `weight > 0` und `note === 'Gewicht geschätzt'`; (b) neuer Test `Beispielwerte Lampengewichte`: `Robe Doppel-Toploader-Case BMFL` = 147.4 kg, `Robe Einzel-Toploader-Case Pointe` = 34.8 kg, `Chauvet Professional Rogue R3 Wash (4) Roadcase` = 127.4 kg mit `note` `Gewicht berechnet`; (c) neuer Test: `Chauvet Professional Rogue R1 Hybrid (2) Roadcase` und `Chauvet Professional CP Rack` haben `weight === 0` und `note === 'Gewicht unbekannt'`, `Chauvet Professional Epix Line 10 IP 10er Roadcase` hat 79.8; (d) der bestehende Test „Gewicht unbekannt ist 0, und 0 trägt die Notiz“ bleibt unverändert und muss weiter bestehen; (e) neuer Test: jede `note` der neuen Vorlagen ist einer der Werte `''`, `Gewicht unbekannt`, `Gewicht geschätzt`, `Gewicht berechnet`.
- [ ] **Step 2: `npm test`.** Erwartet: die neuen Tests schlagen fehl.
- [ ] **Step 3: Daten schreiben.** Per Node-Skript (Scratchpad) `standard.json` laden, bei den 79 IDs `weight` und `note` aus `gewichte.json` setzen, Datei mit derselben Einrückung und Zeichenkodierung zurückschreiben. `git diff --stat data/standard.json` zeigt nur geänderte `weight`- und `note`-Zeilen (genau 2 × 79 geänderte Zeilen).
- [ ] **Step 4: `npm test`.** Erwartet: alles grün.
- [ ] **Step 5: Prüfung auf Quellennamen.** `grep -rniE "truck ?packer|truckpacker|backline ?logic" data tests js docs/casemasse-gewichte.md docs/architektur.md README.md` bleibt leer.
- [ ] **Step 6: Commit.** `feat(daten): Lampengewichte für Robe- und Chauvet-Cases` mit der Co-Author-Zeile der Sitzung.
