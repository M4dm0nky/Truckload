# Übergabe: „Issues auf null“ (PR #41) an den Nutzer-Assistenten

Stand 2026-10-21, Branch `claude/eager-ritchie-ropqzq`, PR [#41](https://github.com/M4dm0nky/Truckload/pull/41).
`npm test` grün (1432). Version, CHANGELOG und Issue-Status sind **nicht** angefasst. Die Begründung je Issue
steht in `docs/entscheidungen.md`.

## 1. Im Browser fahren (`tools/cdp.mjs`, nichts davon ist bisher gefahren)

Pro Punkt: Zustand per `p.eval` aufbauen, Aufnahme als Beleg. Bei 3D-Aufnahmen auf das Prüf-Fahrzeug achten (CLAUDE.md).

1. **#8 Original wiederherstellen** (`js/ui/material.js`, `persistence.restoreOriginal`): ein Listen-Case (`lib-…`)
   bearbeiten → Zeile zeigt „Original wiederherstellen“ → Rückfrage → danach mitgelieferte Fassung, Knopf weg.
   Ein Listen-Case löschen → links erscheint „Ausgeblendet <n>“ → dort wiederherstellen → Eintrag verschwindet,
   Case steht wieder in „Meine Sammlung“. Ein Plan, der das Case nutzt, behält das Stück.
2. **#6** Listen-Case mit Marke in eine benannte Sammlung verschieben und zurück → Marke wie in `data/meine.json`.
   Hinweistext (`title`) am Wizard-Filter „Standardkatalog“ lesen.
3. **#19** Traversen-Dialog: „Stück pro Wagen“ auf 0 (oder Wagenbreite < 2 × Profilbreite) → „Hinzufügen“ sperrt
   **mit** sichtbarer Meldung unter „Stück pro Wagen“; gültige Eingabe → Meldung weg, Hinzufügen geht.
4. **#32** index.html mit simuliertem `SyntaxError` ohne „export“ im Text → „Dieser Browser ist zu alt …“ ohne
   Knopf; mit „does not provide an export named“ → „Bitte neu laden“ mit Knopf.
5. **#11** Sammlung importieren, Dateidialog abbrechen (Chrome: `cancel`); Fokus-Ersatz nur in altem Browser
   prüfbar. Sammlungsdatei mit Rollenhöhe ≥ Case-Höhe und 200-Zeichen-Name importieren → Meldung „Beim Import
   repariert: …“.
6. **#35** Plan mit Fahrzeug nur aus `mitgefuehrt`: `#truck-select` zeigt ◇ statt ★ mit Tooltip, Stift gesperrt;
   Stift an einem Ablage-Stück einer Kopie ist ohne Wirkung; „LKW hinzufügen“ listet das Kopie-Fahrzeug.
7. **#28** Inspector: gedrehtes Stück zeigt „stehend, um 180° gedreht“, ungedreht nur „stehend“. Wizard: gewählte
   Sammlung löschen, solange der Wizard offen ist → Filter springt auf Standardkatalog **mit** Hinweis.
8. **#31** Ablage: Stück schwerer als Nutzlast → „zu schwer für die Nutzlast des Fahrzeugs (X kg, erlaubt Y kg)“;
   Stück mit Lagen 2, 3 → „erlaubte Lagen 2, 3: darf nur auf anderen Stücken stehen“; unauffälliges Stück ohne Text.
9. **#38** Datensatz mit `null` in `tippable`/`content`/`truss.wagonW` in IndexedDB legen, App neu laden → lädt,
   Maße unverändert, „Sichern“ danach importierbar.

## 2. Nach der Abnahme

- **Version** vorschlagen (Patch nach dem zuletzt veröffentlichten Stand 0.19.0 → 0.19.1), vom Nutzer bestätigen
  lassen; an allen Stellen setzen (`js/version.js`, `package.json`, `README.md`, `index.html`, Cache-Name in
  `sw.js`, oberster CHANGELOG-Eintrag). `tests/version.test.js` prüft den Gleichstand.
- **CHANGELOG-Eintrag** aus der Zusammenfassung im PR-Text.
- **Mischen** nach `main`, danach Pages-Build abwarten (`js/version.js` auf der Seite zeigt die neue Nummer).
- **Issues schließen** (die „Closes #N“-Zeilen im PR erledigen das beim Mischen); je Issue einen
  Abschlusskommentar (Schritte mit Datum, Entscheidungen, Rest → neues Issue), Text aus `docs/entscheidungen.md`.
  Bei **#40** den Kommentar „Zur Kenntnis genommen, nichts zu tun“.
- **Offen lassen:** #15, #20, #21 (Prüfliste `docs/pruefliste-hardware.md`, als Kommentar gepostet). Nach den
  Antworten des Nutzers schließen bzw. `align-content` / `classifyWheel` / `STAND_DOLLY_INSET` anpassen.
- **NYX benachrichtigen**, falls gewünscht: Es gibt keine Änderung an `js/store/db.js`/`STORES`, am Datenmodell
  oder an der Projektdatei. Berührt sind nur `js/store/repo.js` (null-Bereinigung beim Laden) und `js/store/io.js`
  (Sammlungsdatei repariert, `mitgefuehrt.version` strikt = 1).

## 3. Worauf zu achten ist

- `checkPlan` lehnt jetzt jede `mitgefuehrt.version` ≠ 1 ab (laut Plan). Eine künftige Version braucht Migration.
- #27 ist bewusst nicht geändert; der Versionsmix bleibt Restrisiko (Begründung in `entscheidungen.md`).
- #28 Lagenwahl: Abweichung (schon 1–4, Lage 5 nicht ergänzt), siehe PR-Text.
- Die ◇-Kennzeichnung ist eine eigene Entscheidung, nicht mit dem Nutzer abgesprochen.
