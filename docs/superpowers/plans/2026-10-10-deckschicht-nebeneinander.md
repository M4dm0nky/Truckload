# Deckschicht nebeneinander – Spec und Plan (V 0.13.12)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Mit dem Schalter „Deckschicht mischen“ dürfen mehrere kleine Cases **nebeneinander** oben
auf ein großes (Teilprojekt 2 der Spec `docs/superpowers/specs/2026-10-09-abschluss-design.md`).
Heute trägt ein Stapel höchstens ein Deckstück (`capped`).

**Spec dieses Teilprojekts (Nutzerentscheidung 2026-10-09: „Deckschicht nebeneinander“; die
Einzelheiten unten sind eigene Entscheidungen):**

- Die oberste Lage eines Stapels („Deckschicht“) darf mehrere Stücke tragen. Sie stehen
  nebeneinander **auf der Fläche des obersten Hauptstücks**, jedes mit Versatz `(ox, oy)` gegen
  die Stapelecke. Ein Stapel mit Deckschicht trägt weiterhin nichts mehr obendrauf und nimmt kein
  Stück der eigenen Sorte mehr an (`capped`).
- **Anordnung:** Regalverfahren (Reihen) auf der Fläche des obersten Hauptstücks, deterministisch in
  Ankunftsreihenfolge: Ein Deckstück wird in der aktuellen Reihe rechts an das letzte angesetzt
  (Orientierung wie bisher, sonst um 90° gedreht), passt es dort nicht, beginnt eine neue Reihe
  (Versatz in `y` um die Tiefe der tiefsten Stücke der Reihe), passt auch das nicht, ist der
  Stapel für dieses Stück ungeeignet und die Suche geht – wie bisher – zum nächsten früheren
  Stapel weiter.
- **Bleibt, wie es ist:** Gruppe/Gewerk-Regel (`belongsTogether`), Auswahl-Rang
  (`sameSelectorRank`), keine Traversen, Gewichte bekannt (> 0), je Deckstück nicht schwerer als das
  oberste Hauptstück, Lagen-Einschränkung je Stück (`pieceLayers`), höchstens 4 Lagen, Fahrzeughöhe,
  100 % Auflage jedes Deckstücks auf dem obersten Hauptstück.
- **Neu bei mehreren:** Die **Summe** der Deckgewichte darf die Auflast (`maxTopLoad`) des obersten
  Hauptstücks und der Stücke darunter nicht überschreiten (wie beim Stapeln, nur mit der Summe).
  Eigene Entscheidung zusätzlich: Die Summe der Deckgewichte darf das Gewicht des obersten
  Hauptstücks nicht überschreiten („nichts Schweres auf Leichtes“ gilt für die Lage als Ganzes).
- Stapelhöhe = Oberkante des Hauptstapels + höchstes Deckstück, höchstens Fahrzeughöhe.
- Das Verhalten **ohne** `mixTop` ist byte-identisch zu vorher (Differenzlauf gegen den alten
  Packer, auch mit Hindernissen, Radkästen, `startX`, Gruppen). **Mit** `mixTop` ändert sich das
  Ergebnis nur dort, wo vorher ein zweites Stück neben dem ersten Deckstück Platz gehabt hätte; in
  Plänen, in denen jeder Stapel höchstens ein Deckstück bekam, bleibt alles gleich.

## Global Constraints

- Keine npm-Abhängigkeit, kein Build. Neue Dateien in `sw.js` ASSETS **und** `modulepreload`.
- Alte Pläne laden weiter; **gespeicherte Platzierungen bleiben unverändert** – ein bestehender
  Plan ändert sich erst beim nächsten „Alles neu packen“ (CHANGELOG nennt das).
- Keine erfundenen Zahlen. Eigene Entscheidungen im Code und in der Doku als „eigene Entscheidung“.
- Deutsch mit „…“ (schließend U+201C); „tippen“, nie „kippen“.
- Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.12** erst in Task 3; sie gilt mit der Freigabe der Teilprojekt-Reihenfolge durch
  den Nutzer („ja los“, 2026-10-09) als bestätigt.

## Prüfung je Task

`npm test` und der Browser-Rundgang `scratchpad/smokeE.mjs`
(`/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/smokeE.mjs`,
`(python3 -m http.server $P &); TL_PORT=$P node tools/cdp.mjs <smokeE.mjs> <out>`, Ports 8796–8799):
alle Flags wahr, `keys:{before:0,after:90,undone:0}`, `logs:[]`, `ver` = aktuelle Version.

## Review Focus

1. **Ohne `mixTop` identisch:** Differenzlauf alter (Merge-Base) gegen neuen Packer, ≥ 50.000 Fälle
   mit Hindernissen, Radkästen, `startX`, Gruppen, `tipped`/`layers`-Variation: 0 Abweichungen.
2. **Mit `mixTop` korrekt:** Eigenschaftstest (≥ 500 Mischungen, fester Seed): `validatePlan`
   meldet nach `packAll` mit `mixTop` weder Kollision noch Überstand noch Nutzlast-/Auflastfehler
   durch die Deckschicht; Platziert + Ablage = Eingabe; jedes Deckstück liegt vollständig auf der
   Fläche des obersten Hauptstücks (geometrisch geprüft).
3. **Regeln der Deckschicht bleiben:** Tests je Regel (Gruppe, Gewerk, 0 kg, Traverse, Lagen,
   `maxTopLoad` mit Summe, Gewichtssumme, vierte Lage, Fahrzeughöhe).
4. **Alte Plätze:** `placeStacks`/Platzierungen ohne Versatz bleiben exakt wie bisher
   (`ox`/`oy` fehlen = 0).

---

### Task 1: Packer – Deckschicht mit mehreren Stücken

**Files:** `js/model/packer.js`, Tests `tests/packer.test.js`, `tests/packer-golden.test.js`,
`tests/packer-golden.fixtures.js`.

- [ ] **Vorlauf (vor jeder Codeänderung):** Ausgabe des **aktuellen** Packers festhalten für
  bestehende Deckschicht-Fixtures (Golden-Test mit `mixTop`) und mindestens fünf neue feste
  Fixtures **ohne** `mixTop` (gemischt, überfüllt, Gruppen, Traversen, Dollys) als literale
  Erwartungen – sie müssen nach der Änderung unverändert grün bleiben. Die bestehenden
  `mixTop`-Fixtures prüfen, ob sie vom neuen Verhalten betroffen sind (mehr als ein Deckstück je
  Stapel möglich?); betroffene Erwartungen werden **bewusst** angepasst und im Report mit
  alt/neu gegenübergestellt.
- [ ] **Datenmodell im Packer:** Stapelstücke bekommen optional `ox`, `oy` (cm Versatz in der
  Stapelfläche, fehlend = 0). Ein Stapel mit Deckschicht hat `s.cap = { z, items:[…], rows… }`
  oder gleichwertig (Name der Implementierung frei, im Code erklärt) mit dem Regalzustand.
  `autoPack` addiert `ox`/`oy` auf `x`/`y` der Platzierung (bei `swap` des Stapels im Grundriss
  um 90° gedreht: Versatz entsprechend vertauschen, **prüfen und testen**, dass ein im Grundriss
  gedrehter Stapel die Deckstücke weiterhin vollständig auf dem obersten Stück trägt).
- [ ] **Regelsatz `capFits` erweitern:** Ein Deckstück passt auf Stapel `s`, wenn (a) die bisherigen
  Regeln gelten (ohne die Annahme „es gibt noch keine Deckschicht“), (b) es nach dem
  Regalverfahren Platz auf der Fläche des obersten Hauptstücks gibt, (c) Summe der Deckgewichte
  inklusive dieses Stücks ≤ Gewicht des obersten Hauptstücks und die `maxTopLoad`-Kette
  (oberstes Hauptstück und darunter) mit der Summe eingehalten ist, (d) `capZ + dz` ≤
  Fahrzeughöhe. Liefert Orientierung **und** Versatz.
- [ ] **`buildStacks`:** bei Treffer ein weiteres Deckstück in die Deckschicht einfügen
  (`s.height = max(s.height, capZ + dz)`, `s.weight += c.weight`, `s.mixed = true`,
  `s.capped = true`).
- [ ] **Tests (zuerst, rot):** drei kleine Cases passen nebeneinander auf ein großes (Versätze
  literal geprüft); das vierte, das nicht mehr passt, geht auf den nächsten Stapel; zwei
  Reihen; 90°-gedrehtes Deckstück; Summe > `maxTopLoad` → letztes Stück abgelehnt;
  Summe > Gewicht des obersten Stücks → abgelehnt; je Regel aus Review Focus 3 ein Fall;
  Stapel im Grundriss gedreht (swap) trägt die Deckstücke korrekt; ohne `mixTop` unverändert.
- [ ] `npm test` + Rundgang (Port 8796); Commit je Schritt.

### Task 2: Absicherung

**Files:** `tests/packer-property.test.js`, `tests/packer-diff.md`-ähnliche Notiz nur im Report,
`js/model/validate.js` (nur falls die Prüfung Deckstücke falsch bewertet), Doku.

- [ ] **Differenzlauf ohne `mixTop`:** Merge-Base-Packer (`git show <Basis>:js/model/packer.js` und
  Importe per `git archive` in das Scratchpad, **nie ins Repo**) gegen den neuen: ≥ 50.000
  Zufallsfälle mit Hindernissen, Radkästen, `startX`, Gruppen, `tipped`/`layers`-Variation,
  Dollys/Traversen, verschiedene Regeln. Erwartung: 0 Abweichungen. Report: Anzahl und Ergebnis.
- [ ] **Eigenschaftstest mit `mixTop`:** im bestehenden `tests/packer-property.test.js` zusätzliche
  Läufe (≥ 500 Mischungen, fester Seed, eigener Zufallsgenerator): keine Kollision, kein
  Überstand, Platziert + Ablage = Eingabe, jedes Deckstück vollständig auf dem obersten
  Hauptstück (geometrisch), keine Fahrzeughöhe-Überschreitung, Auflast-/Gewichtsregeln der
  Deckschicht eingehalten. Findet der Test eine echte Verletzung, wird sie mit Seed gemeldet und
  – wenn klein und sicher – behoben, sonst dokumentiert.
- [ ] **Validierung:** `validatePlan` bewertet Deckstücke nebeneinander korrekt (Auflage über
  Geometrie, Lagen, Last auf dem obersten Hauptstück = Summe); kein falscher Alarm. Test mit
  einem gepackten Plan.
- [ ] **Browser:** Wizard mit „Deckschicht mischen“ an: ein großes Case (z. B. Packcase 120×60×80)
  plus vier kleine Cases gleicher Gruppe, packen, 2D-Draufsicht und 3D ansehen (Screenshots
  prüfen: die kleinen stehen nebeneinander auf dem großen, nichts hängt über).
- [ ] **Doku:** `README.md` Abschnitt „Deckschicht mischen“ (mehrere nebeneinander), `docs/
  architektur.md` Abschnitt „Deckschicht“ (Regalverfahren, Summenregeln, Versatz im Stapel,
  eigene Entscheidungen markiert), `docs/offene-punkte.md`: Punkt „Eine Ebene trägt nur ein
  Stück“ entfernen und durch den Rest ersetzen (Regalverfahren ist keine optimale Packung).
- [ ] `npm test` + Rundgang (Port 8797); Commit je Schritt.

### Task 3: Version 0.13.12

- [ ] Version an den sechs Stellen auf 0.13.12; CHANGELOG in Nutzersprache („Deckschicht: mehrere
  kleine Cases nebeneinander auf einem großen. **Bestehende Pläne ändern sich nicht von selbst;
  erst beim nächsten ‚Alles neu packen‘ greift die Regel.**“). Docs-Köpfe „Stand“ aktualisieren.
  `npm test` + Rundgang. Commit `chore: Version 0.13.12 – Deckschicht nebeneinander`.
