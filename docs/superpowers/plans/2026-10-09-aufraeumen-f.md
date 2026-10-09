# Aufräumen Phase F – Kommentare, Doku, Tests (V 0.13.10)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Der Code liest sich ohne Ballast. Kommentare erklären das „Warum“ in wenigen Zeilen
statt Verlauf und Review-Kennungen. Die Doku beschreibt den Stand 0.13.x. Die Tests sind von
Altlasten befreit. Am Programmverhalten ändert sich **nichts**.

**Architecture:** Reine Kommentar-Commits, maschinell geprüft: Ein Gate lässt nur geänderte
Kommentar- und Leerzeilen durch. Doku und Tests werden getrennt davon angepasst.

**Tech Stack:** `node --test`, Gate-Skript
`/private/tmp/claude-501/-Users-marcohoch-Library-CloudStorage-Dropbox-Privat-Incomming-github-Truckload/1d41c3e7-6ff5-420d-9d8c-00affc425a71/scratchpad/comment-gate.sh`.

**Spec:** `/Users/marcohoch/.claude/plans/ich-h-tte-gern-eine-stateful-melody.md`, „Phase F“;
Kommentar-Befunde aller drei Reviews.

## Global Constraints

- **Task 1 und 2 ändern ausschließlich Kommentare.** Nach jedem Commit muss
  `bash <scratchpad>/comment-gate.sh <commit>~1 <commit>` „OK“ melden. Zeilen mit Code und
  angehängtem `// …` bleiben unangetastet. Ist dort ein Kommentar falsch, wird er im Report
  gelistet statt geändert.
- `npm test` bleibt grün und zählt gleich viele Tests.
- Deutsch; typografische Anführungszeichen „…“ (schließend U+201C); „tippen“, nie „kippen“.
- Commits enden mit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; nie `git add -f`.
- Version **0.13.10** (bestätigt) erst in Task 4.

## Regeln für die Kommentar-Diät

1. **Raus:** Verlauf und Herkunft wie „Befund …“, „Fix-Runde …“, „Task N“, „Final-Review“,
   „Ruling …“, „(docs/code-review-2026-09-21.md, …)“, „nicht mehr exportiert“,
   „bis Task 6 …“, „vorher …, jetzt …“, Zeilennummern-Verweise und Versionsgeschichte.
   Das steht in git und in den Docs.
2. **Bleibt, gekürzt auf 1–4 Zeilen:** jede nicht offensichtliche Begründung, also warum etwas
   so ist und welche Invariante gilt. Nutzerentscheidungen bleiben mit Datum, z. B.
   „Nutzerwunsch 2026-10-06“, weil sie fachliche Vorgaben sind, nicht Verlauf.
3. **Quellen bleiben:** Recherchequellen zu Maßen und Gewichten (CLAUDE.md „Haltung“), z. B. in
   `js/data/*` und `audioDolly.js`.
4. **Falsche Kommentare** werden korrigiert, z. B. `view3d.js` „jedes Material ist ein eigenes
   Shader-Programm“, `io.js` „bis 80 cm“, die Floating-Kommentare in `case-library.js`.
5. Jede Datei bekommt höchstens einen kurzen Kopfkommentar zu Zweck und Invarianten, wenn sie
   keinen hat und er hilft.

---

### Task 1: Kommentar-Diät Logik und Speicher

**Files:** `js/model/*.js`, `js/store/*.js`, `js/data/*.js`, `js/version.js`, `sw.js`.

- [ ] Je Datei die Regeln anwenden. Commit je Ordner. Nach jedem Commit das Gate laufen lassen,
  Ausgabe in den Report.
- [ ] Im Report: Kommentarzeilen vorher/nachher je Datei, z. B. per
  `grep -cE '^\s*(//|\*)' <file>`, und die Liste der korrigierten falschen Kommentare.
- [ ] `npm test`.

### Task 2: Kommentar-Diät Oberfläche und App

**Files:** `js/ui/*.js`, `js/app.js`, `js/app/*.js`.

- [ ] Wie Task 1, Commit je Ordner, Gate nach jedem Commit.
- [ ] `npm test`.

### Task 3: Doku und Tests

**Files:** `docs/architektur.md`, `docs/offene-punkte.md`, `README.md` (falls nötig),
`tests/smoke.test.js`, `tests/pwa.test.js`, `tests/print.test.js`, `tests/load-wizard.test.js`,
`tests/io.test.js`, `tests/repo.test.js`.

- [ ] `docs/architektur.md`:
  - Kopf „Stand V 0.8.6“ auf den aktuellen Stand.
  - Zahlen prüfen und korrigieren: Anzahl Vorlagen, keine festen Traversenwagen-Vorlagen mehr,
    Legacy-Einträge.
  - Abschnitte zu Startbildschirm, Service Worker (Netz zuerst, ein Stand pro Seitenaufruf,
    Ladefehler-Hinweis), Materialverwaltung und `js/app/` gegen den Code prüfen.
  - Nichts erfinden: Was nicht im Code steht, kommt nicht in die Doku.
- [ ] `docs/offene-punkte.md`:
  - Kopf „Stand V 0.8.0“ aktualisieren.
  - Erledigte Punkte entfernen. Prüfen, ob sie im Code wirklich erledigt sind.
  - Die bewusst offen gelassenen Punkte aus diesem Aufräumen eintragen:
    - Packer bei sehr überfüllter Ladung (Phase G)
    - Slug-Kollision bei Firmennamen
    - Firma-Löschen nicht in einer Transaktion
    - Restrisiko Service-Worker-Mischstand
    - Zahlenformate in Case-Texten (`caseLine` vs. `caseDetail`)
- [ ] Tests:
  - `tests/smoke.test.js` entfernen, falls redundant. Vorher prüfen, was er testet.
  - Versions-Regex mit `replaceAll('.', '\\.')` in `tests/pwa.test.js` und
    `tests/print.test.js`.
  - Starre Markup-Vergleiche (`tests/load-wizard.test.js` ~l.136, `tests/print.test.js`
    ~l.148) über einzelne Eigenschaften prüfen statt über ganze Strings.
  - Veraltete Zeilenverweise in Testtiteln („app.js:30“, „app.js:41“) entfernen.
  - Danach muss die Testanzahl erklärbar gleich sein bzw. nur um den entfernten Smoke-Test
    sinken.
- [ ] `npm test`; Commit `docs/test: Architektur und offene Punkte aktualisiert, Tests entrümpelt`.

### Task 4: Version 0.13.10

- [ ] Version an allen sechs Stellen auf 0.13.10. Achtung: Prüfen, dass die Versionstests mit
  zweistelligem Patch umgehen.
- [ ] CHANGELOG: „Aufräumen Teil 6 – Kommentare gekürzt (Verlauf steht in git), Doku auf den
  aktuellen Stand gebracht, Tests entrümpelt. Am Programm ändert sich nichts.“
- [ ] `npm test` + Browser-Rundgang `smokeE.mjs` (ver „V 0.13.10“). Commit
  `chore: Version 0.13.10 – Aufräumen Phase F`.
