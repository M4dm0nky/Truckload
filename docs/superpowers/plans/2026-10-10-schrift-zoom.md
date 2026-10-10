# Schrift wächst beim Zoomen mit + robustere Mausrad-Erkennung (V 0.14.1)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** In der 2D-Ansicht darf die Beschriftung beim Hineinzoomen über die feste Obergrenze
(`LABEL_MAX` = 16 cm) hinaus wachsen, solange sie in den Case passt.

**Spec (vom Nutzer mit „1“ und „ja“ bestätigt, 2026-10-10):** Schriftgröße =
`max(LABEL_MIN, min(LABEL_MAX × zoom, kleinere Case-Seite × LABEL_RATIO))`, `zoom` = ganze
Truck-Breite / sichtbare Breite (≥ 1). Bei Zoom 1 **pixelgleich zum Stand 0.14.0**. Nach jedem
Zoomschritt werden Größe und Kürzung („…“) der Labels angepasst, ohne die Ansicht neu zu zeichnen.
Druck unverändert (nie gezoomt).

## Global Constraints
- Keine npm-Abhängigkeit, kein Build. Abhängigkeitsrichtung: `view2d.js` importiert `zoom2d.js`,
  nie umgekehrt (zoom2d meldet per `CustomEvent('truckzoom')` auf dem svg).
- Nutzertexte nur `textContent`/`esc()`. Deutsch, „tippen“. Eine Version an sechs Stellen (0.14.1),
  Patch, vom Nutzer als Reihenfolge freigegeben; kein Tag.
- Commits enden mit `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; nie `git add -f`.

## Task 1: Rechnung + Anpassung beim Zoomen
**Files:** `js/ui/view2d.js`, `js/ui/zoom2d.js`, `tests/view2d.test.js`, `tests/zoom2d.test.js`.
- [ ] Rein und getestet: `labelFontSize(w, h, zoom)` (exportiert) mit den Konstanten; Tests: Zoom 1
  ergibt exakt den alten Wert für kleine/mittlere/große Cases (Tabelle über viele w,h), Zoom 4 wächst
  nur bis `min(w,h)×0.32`, `LABEL_MIN` bleibt Untergrenze, Zoom < 1 wird auf 1 geklemmt.
- [ ] `zoom2d.js`: `zoomFactor(svg)` (ganze Breite / viewBox-Breite, ≥ 1) und nach jedem Setzen der
  viewBox ein `truckzoom`-Event auf dem svg.
- [ ] `view2d.js`: `drawLabel` nutzt `labelFontSize` mit dem aktuellen Zoom beim Zeichnen (ein neu
  gezeichneter Plan bei bestehendem Zoom stimmt also), speichert am Text-Element `data-full`,
  `data-w`, `data-h` (Beschriftung, Breite, Höhe des Label-Rechtecks); `renderView` hängt einmal je
  svg einen `truckzoom`-Listener an (per `requestAnimationFrame` gebündelt), der alle `.label`
  und `.label-seq` neu dimensioniert und neu kürzt (`truncateToWidth`, gleiche `measure`-Funktion).
- [ ] Bei Zoom 1 byte-identisches SVG-Markup wie vor der Änderung (Test gegen den Stand 0.14.0 mit
  Beispielplan, Beschriftung an und aus).
- [ ] Browserprobe `tools/cdp.mjs` (Port 8803, Szenario im Scratchpad): Plan mit großem Case, Screenshot
  bei Zoom 1, 2, 4 (Zoom-Knopf +) — Schrift wächst, bleibt im Case, kein Überstand; danach „Alles“
  zurück = Zustand wie vorher. `smokeE.mjs` unverändert grün.
- [ ] `npm test`; Commits je Schritt.

## Task 1b: Mausrad/Trackpad robuster + Umschalter (Nutzer: „3“ = beides, 2026-10-10)
**Files:** `js/ui/zoom2d.js`, `index.html`, `css/app.css`, `js/app/planView.js` (nur Verdrahtung), Tests `tests/zoom2d.test.js`.
- [ ] Reine, getestete Funktion `classifyWheel(e, state, now)` -> `'wheel' | 'pad'`: Zeilenmodus = Rad;
  `deltaX === 0` und `wheelDeltaY` ein Vielfaches von 120 (≠ 0) = Rad; bisherige Größenregel
  (`deltaX === 0 && |deltaY| >= 50`) bleibt; Entscheidung gilt für eine ganze Geste: folgt ein Ereignis
  innerhalb 150 ms auf das vorige, bleibt die Einstufung des vorigen (kein Umkippen mitten im Wischen);
  ein erstes Ereignis nach > 150 ms Pause wird neu eingestuft. Tests: Maus mit 120er-Schritten,
  Zeilenmodus, Trackpad-Strom mit kleinen Schritten und deltaX, Trägheitsausläufer nach dem Wischen
  bleibt „pad“, feines Rad (kleine Schritte, aber `wheelDeltaY` 120-Vielfach) = Rad.
- [ ] Umschalter „Scrollen: Automatisch / Zoomen / Verschieben“ (eigene Entscheidung, Standard
  Automatisch): ein kleiner Knopf neben den Zoom-Knöpfen der 2D-Ansichten, wechselt reihum, Zustand in
  `localStorage` (try/catch, funktioniert auch ohne), Tooltip erklärt. „Zoomen“ = jedes Rad-Ereignis ohne
  Strg zoomt, „Verschieben“ = jedes verschiebt (Strg/Pinch zoomt immer). Texte deutsch, `aria-label`.
- [ ] Browserprobe mit simulierten WheelEvents (Maus 120er, Trackpad-Strom) in allen drei Stellungen;
  `smokeE.mjs` grün. `npm test`; Commits je Schritt.

## Task 2: Doku + Version 0.14.1
- [ ] `docs/offene-punkte.md`: Punkt „Mausrad oder Trackpad…“ anpassen (robustere Erkennung + Umschalter; weiterhin nur mit simulierten Eingaben geprüft, nicht an echter Hardware). Punkt „Zoom: Beschriftungen und Linien wachsen mit“ anpassen (Schrift
  wächst jetzt nur, wenn sie passt; Linien bleiben) und „Stand“ → 0.14.1. README/architektur
  nur, wo die Schrift erwähnt wird. Version an sechs Stellen 0.14.1, CHANGELOG-Eintrag in
  Nutzersprache. `npm test` + Rundgang. Commit `chore: Version 0.14.1 – Schrift wächst beim Zoomen mit`.
