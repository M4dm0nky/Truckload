# „Anders geladen“ und Case-Suche – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Je NYX-Gerätetyp eine Zahl „anders geladen“ (zählt als verladen, ohne Case) und ein Suchfeld in der Case-Auswahl.

**Architecture:** Neues optionales Planfeld `nyxAbgleich.andersGeladen`, eingerechnet in `stand()`; Dialogzustand in `geraete-schritt.js` (rein, node-testbar), Klicks in `tabellen-import.js`; `showPick` bekommt eine Option `suche`.

**Tech Stack:** Reine ES-Module, `node --test`, keine Abhängigkeiten.

**Spec:** `docs/superpowers/specs/2026-11-23-nyx-anders-geladen-design.md`

## Global Constraints

- Keine npm-Abhängigkeit, kein Build-Schritt.
- Nutzereingaben in HTML nur über `esc()` (`js/ui/dom.js`).
- Neue Texte nur über `t()`, dazu ein englischer Eintrag in `js/i18n/en.js` (britisch, Satzanfang groß). `tests/i18n.test.js` muss grün bleiben.
- Keine nativen Dialoge (`alert`/`confirm`/`prompt`).
- Alte Pläne ohne `andersGeladen` laden unverändert, und ihr `stand()` bleibt gleich.
- Neue Texte (DE → EN): „Anders geladen (ohne Case)“ → „Loaded otherwise (no case)“; „anders geladen“ → „loaded otherwise“; „{n} anders geladen“ → „{n} loaded otherwise“; „Alle“ → „All“ (falls nicht schon vorhanden); „Suchen …“ → „Search …“; „Kein Treffer.“ → „No match.“

## Review Focus

- Wert im Zahlenfeld leer, negativ, Komma oder größer als die Anzahl: wird begrenzt, nie NaN im Zustand.
- „anders“ erhöht, während schon Cases zugeordnet sind: Überzählige Zuordnungen fallen weg, der Rest stimmt.
- NYX liefert später weniger als „anders geladen“: `stand()` kappt auf die Anzahl, `diff` ist dann nicht negativ wegen `anders`.
- vw:→gdtf:-Umhängen: Ein unter `vw:X` gespeichertes `anders` gilt nach der Verknüpfung für `gdtf:…`.
- Suche mit Sonderzeichen oder HTML im Case-Namen: Es wird maskiert, und der Filter wirft nicht.

---

### Task 1: Datenmodell und Rechnung

**Files:**
- Modify: `js/store/io.js` (`nyxAbgleichOk`, ~Z. 146)
- Modify: `js/model/nyxAbgleich.js` (`stand`, `uebernimmGeraete`)
- Test: `tests/nyxAbgleich.test.js` und die io-Testdatei mit `Import NYX: Plan mit nyxAbgleich ok` (~Z. 1070)

**Interfaces:**
- Produces: `stand()` hat je Zeile zusätzlich `anders: number`, und es gilt `diff = anzahl − verladen − anders`. `uebernimmGeraete(plan, res, …)` liest `res.andersGeladen` (`{key:n}`).

- [ ] Tests schreiben:
  - `stand` mit `nyxAbgleich.andersGeladen = {V: 96}` und 100 Geräten ohne Stücke ergibt `anders 96, diff 4`.
  - `stand` mit 90 Geräten bei `{V: 96}` ergibt `anders 90, diff 0`.
  - Mit `{V: 90}`, 90 Geräten und einem Case-Stück (`nyxStueck 2`) ist `diff −2`.
  - Alter Plan ohne Feld: `anders 0`, `diff` wie bisher.
  - `uebernimmGeraete` mit `res.andersGeladen {'vw:Viper': 5, X: 0}` und `alias vw:Viper→gdtf:v` ergibt `nyxAbgleich.andersGeladen = {'gdtf:v': 5}`.
  - Schlüssel im Plan, die nicht in `res` stehen, bleiben erhalten (`plan {Z: 3}`, `res {V: 2}` ergibt `{Z:3, V:2}`). Ein Schlüssel in `res` mit 0 löscht ihn.
  - io: `andersGeladen {a: 3}` ist ok. Abgelehnt werden `{a: 0}`, `{a: -1}`, `{a: 1.5}`, `{a: 10000}`, `[]`, `null` und mehr als 500 Schlüssel, jeweils mit einer Meldung /NYX/. Ein Plan ohne das Feld ist ok.
- [ ] Rot sehen: `node --test tests/nyxAbgleich.test.js`
- [ ] Umsetzen.
- [ ] Grün: `npm test 2>&1 | grep -E "^# (pass|fail)"`
- [ ] Commit `feat(nyx): andersGeladen im Abgleich`

### Task 2: Dialogschritt „anders geladen“

**Files:**
- Modify: `js/ui/geraete-schritt.js`
- Modify: `js/ui/tabellen-import.js` (geraeteKlick ~Z. 563, dlg.onchange ~Z. 619)
- Modify: `js/i18n/en.js`, ggf. `css/app.css` (`.ge-anders`, nahe Z. 318)
- Test: `tests/geraete-schritt.test.js`

**Interfaces:**
- Consumes: `stand()`-Zeilen mit `anders` (Task 1).
- Produces: `geraeteAktion(st,'anders',{key, wert})`. Den Wert für „Alle“ berechnet `tabellen-import` als `andersMax(st,key)` (exportiert): Das ist der Wert, bei dem der Bedarf 0 wird. `geraeteErgebnis(st).andersGeladen` (`{key:n}`, nur n>0, aber Schlüssel, die vorher >0 waren und jetzt 0 sind, als 0 mitliefern, damit `uebernimmGeraete` sie löscht).

- [ ] Tests schreiben (Fixtures wie in der Datei: `liste` mit VIPER 25):
  - `anders` 21 ergibt `offenVon` 4. Ein Klick auf x2 ergibt `2× Viper x2`, offen 0.
  - Ist `anders` 25, gilt: `offenVon` 0, links steht „anders geladen“, und ein `case`-Aufruf ändert nichts.
  - Erst x2 zuordnen (12× +1 Rest), dann `anders` 20: Es bleibt `2× x2`, und der Rest-Eintrag fällt weg oder hat n 0.
  - Werte −3, NaN und 99 werden auf 0 bzw. das Maximum begrenzt.
  - Nach „nicht laden“ ist `anders` gelöscht. Danach `anders` 5 setzen: `nichtLaden` ist aufgehoben.
  - `geraeteAenderung`: Nur `anders` geändert ergibt true. Ein unveränderter Wert aus dem Plan ergibt false.
  - HTML des gewählten Typs enthält `data-role="g-anders"` und `data-act="g-anders-alle"`, im Kopf steht „21 anders geladen“. Bei „nicht laden“ und in der Reduktionsansicht fehlt das Feld.
  - `geraeteErgebnis().andersGeladen` ergibt `{[VIPER]: 21}`.
- [ ] Rot, umsetzen, grün (wie Task 1). In `tabellen-import.js` kommt `g-anders-alle` in geraeteKlick, und `data-role="g-anders"` in onchange ruft `geraeteAktion(ge,'anders',{key: el.dataset.key, wert: Number(el.value)})` und danach `render()`. In der Ergebnis-Doku (~Z. 343) wird `andersGeladen` ergänzt. Das Ergebnis muss über den bestehenden Weg bis `uebernimmGeraete` reichen, dazu die Weitergabe von `geraeteErgebnis` prüfen.
- [ ] Commit `feat(nyx): „anders geladen“ im Geräte-Dialog`

### Task 3: Suchfeld in showPick

**Files:**
- Modify: `js/ui/confirmDialog.js`, `js/app/projektGeraeteImport.js` (`sucheCase`, `showPick(..., { suche: true })`), `js/i18n/en.js`, ggf. `css/app.css`
- Test: `tests/confirmDialog.test.js` (neu, nur `pickFilter`), und `tests/pwa.test.js` muss grün bleiben (keine neue Datei unter js/)

**Interfaces:**
- Produces: `export function pickFilter(options, text) → options[]`: Alle Wörter (Trennung an Leerraum) müssen im `label` vorkommen, Groß- und Kleinschreibung zählt nicht, die Reihenfolge bleibt. Leerer Text liefert alle.

- [ ] Tests: `pickFilter` mit den Labels ['Robe BMFL x2','MAC Viper x2','robe spiider x4']: 'robe' ergibt 2 Treffer, 'ROBE x4' ergibt 1, '' ergibt 3, 'zzz' ergibt 0, '<b>' wirft nicht.
- [ ] Umsetzen: Mit `{ suche: true }` steht `<input type="search" data-role="pick-suche">` über `<select size="10">`. `input` filtert neu (Optionen über `esc`) und wählt den ersten Treffer. Enter im Feld übernimmt ihn (preventDefault, dann `d.close('ok')`, wenn ein Treffer da ist), Doppelklick auf eine Option ebenso. Ohne Treffer erscheinen ein Hinweis und ein gesperrter OK-Knopf. Der Fokus liegt im Suchfeld. Ohne die Option bleibt das Verhalten unverändert.
- [ ] Grün: `npm test`
- [ ] Commit `feat(ui): Suche in der Case-Auswahl`

### Task 4 (Hauptsitzung): Browserprüfung, Doku, Version

- [ ] Szenario per `tools/cdp.mjs`: `globalThis.truckloadHost.projektGeraete` liefert 100 × Viper. `anders` auf 96 setzen, „Viper x2“ über die Suche „viper“ finden, übernehmen, den Dialog neu öffnen. Erwartet „Alles verladen“ bzw. „anders geladen“. Dazu Screenshots und am Ende den Server beenden.
- [ ] `docs/nyx-projektgeraete.md`: das Feld und den Admin-Schritt ergänzen. Außerdem CHANGELOG, README und architektur.md per grep nachziehen.
- [ ] Version 0.33.1 nach Rückfrage, Issue anlegen und schließen, NYX im Issue benachrichtigen.
