import { colorFor } from '../data/categories.js';
import { CASE_LIMITS } from './validate.js';

// Recherche: Carvin DB521018 (81×75×20 cm, 18,3 kg, 4× 127-mm-Lenkrollen), SYNQ SQ-218 Dolly
// (11 kg, 4× 100-mm-Schwerlastrollen), DAS PL-EV118S (~81×71×18 cm Versandmaß, ~11 kg) –
// docs/casemasse-gewichte.md hat die volle Herleitung. Gerundet aus den drei Quellen gewählt
// (nicht der exakte Mittelwert – der läge bei 13,4 kg/19 cm, DAS-Höhe ist zudem ein
// Versandmaß, keine Arbeitshöhe), dokumentiert statt erfunden (CLAUDE.md „Haltung“).
export const DOLLY_HEIGHT_CM = 18; // Rollen + Platte
export const DOLLY_WEIGHT_KG = 15; // Dolly-Eigengewicht, gerundet gewählt

// Dolly-Tiefen-Stufen (Nutzerangabe 2026-10-06/-08): Dollys werden mit der kurzen Seite voran in
// den Truck geschoben und sind so gebaut, dass 4, 3 oder 2 nebeneinander in die 248 cm Innenbreite
// passen – je nach Boxentiefe 60, 80 oder 120 cm. Die lange Seite (Boxbreite) bleibt das Boxmaß.
// Tiefer als 120 cm kommt bei den Vorlagen nicht vor; dann gilt die Boxentiefe selbst statt eines
// erfundenen Maßes.
export const DOLLY_DEPTHS = [60, 80, 120];
export const dollyDepth = boxDepth => DOLLY_DEPTHS.find(d => d >= boxDepth) ?? boxDepth;

// Die ID darf NICHT mit „preset-“ oder „lib-“ beginnen: `js/store/io.js`s `isPreset()` filtert
// jede ID mit diesem Präfix beim Datei-Import heraus, unabhängig vom `builtin`-Feld – ein
// Dolly-Stack, dessen ID direkt aus `baseCase.id` (z. B. `preset-k2`) gebildet würde, wäre nach
// jedem Backup-Export/-Import verschwunden (Befund Final-Review Critical #1). Deshalb das
// Präfix der Basisbox-ID abschneiden und durch „dolly-“ ersetzen. Deterministische ID aus
// Basisbox + Stückzahl – getrennt exportiert, damit der Dolly-Dialog
// (js/ui/dolly-wizard.js) prüfen kann, ob dieselbe Kombination schon als Case existiert, OHNE
// erst das volle Case-Objekt neu zu bauen (und damit eine vom Nutzer im Case-Editor bearbeitete
// Zeile unbemerkt mit den Formel-Werten zu überschreiben, Befund Final-Review Important #2).
export function dollyStackId(baseCase, n) {
  const baseId = baseCase.id.replace(/^(preset-|lib-)/, '');
  return `dolly-${baseId}-${n}`;
}

// Größte Stückzahl, bei der sowohl Höhe als auch Gewicht der Dolly-Stack-Vorlage innerhalb der
// CASE_LIMITS bleiben (js/model/validate.js) – für das „max“-Attribut im Dolly-Dialog, nach
// demselben Muster wie case-editor.js es für seine eigenen Zahlenfelder schon tut (Befund
// Final-Review Important #3: ohne Grenze hätte ein Tippfehler ein Case erzeugt, das beim
// nächsten Export/Import an checkCase() scheitert, ohne dass der Nutzer das beim Anlegen merkt).
export function maxDollyCount(baseCase) {
  const byHeight = Math.floor(CASE_LIMITS.h / baseCase.h);
  const byWeight = Math.floor((CASE_LIMITS.weight - DOLLY_WEIGHT_KG) / baseCase.weight);
  return Math.max(1, Math.min(byHeight, byWeight));
}

// Baut den Case-Typ für „<Basisbox> N er (auf Dolly)“ – Länge = Boxbreite, Tiefe = Dolly-Tiefe
// (dollyDepth(), seit V 0.12.2 Teil der Stellfläche), echte Boxentiefe in `unitD` für die
// 3D-Darstellung (s. docs/casemasse-gewichte.md). Die Dolly-Höhe steckt
// in `wheelH`/`dimsInclWheels: false`, nicht in `h` – dadurch zeichnet die bereits vorhandene
// 4-Rollen-Zeichnung in js/model/caseShape.js den Dolly automatisch mit, ohne neuen Zeichencode
// (bei 18 cm Rollenhöhe sichtbar größer/wuchtiger als die case-üblichen 12–16-cm-Blue-Wheels).
// `h` ist reine Stückzahl × Boxhöhe (Boxen stehen direkt aufeinander). `layers: [1]` heißt nur:
// ein zweiter solcher Stack darf nicht automatisch oben auf diesen gestapelt werden, der Turm
// selbst ist schon die volle Höhe. `stackable: true` bleibt trotzdem stehen (wie bei den alten
// Presets) – andere, leichtere Cases dürfen weiterhin oben drauf, dafür gibt es `maxTopLoad`.
// `kind: 'speaker'` gibt js/ui/view3d.js einen eigenen Render-Zweig (wie `kind: 'truss'` für
// Traversenwagen) – Nutzer-Feedback 2026-10-08: ohne den Zweig sieht ein Dolly-Stack in 3D wie
// ein normales Flightcase aus (Kugelecken, Deckelfuge, Griffe), nicht wie PA-Lautsprecher.
// `unitH` ist die Höhe einer einzelnen Box im Stack, damit dieser Zweig die Trennlinien
// zwischen den gestapelten Boxen zeichnen kann, ohne sie aus `h`/Stückzahl zurückrechnen zu
// müssen. 2D (js/ui/view2d.js) liest `kind` nicht und bleibt unverändert.
export function dollyStackCase(baseCase, n) {
  return {
    id: dollyStackId(baseCase, n),
    builtin: false,
    name: `${baseCase.name} ${n}er (auf Dolly)`,
    content: '',
    category: baseCase.category,
    color: colorFor(baseCase.category),
    l: baseCase.l,
    w: dollyDepth(baseCase.w),
    h: n * baseCase.h,
    weight: DOLLY_WEIGHT_KG + n * baseCase.weight,
    tippable: false,
    stackable: true,
    maxTopLoad: null,
    wheelH: DOLLY_HEIGHT_CM,
    dimsInclWheels: false,
    layers: [1],
    kind: 'speaker',
    unitH: baseCase.h,
    unitD: baseCase.w,
    speakerType: baseCase.speakerType,
    cabinetColor: baseCase.cabinetColor,
  };
}

// Ergänzt einen in einer früheren Version gespeicherten Dolly-Stack um die Darstellungsfelder,
// die er damals noch nicht hatte (Nutzer-Screenshot 2026-10-08: K2-2er-Stacks aus der eigenen
// Bibliothek liefen ohne `kind` weiter durch die Flightcase-Darstellung). Erkennt die aktuelle ID
// `dolly-<basis>-<n>` und die alte Form `preset-<basis>-dolly-<n>` (vor dem ID-Fix – die trifft ein
// erneuter Dialog-Lauf nie, weil der die neue ID erzeugt). Nur fehlende Felder werden ergänzt;
// Länge, Höhe, Gewicht, Rollenhöhe und ID bleiben, wie sie sind (CLAUDE.md: Cases dürfen ihre
// Maße nicht unbemerkt ändern, Platzierungen verweisen auf die ID). Einzige Ausnahme ist die Tiefe
// (s. unten, ausdrücklicher Nutzerwunsch). `unitH` aus der gespeicherten Höhe statt
// aus der Vorlage, damit die Einheiten zur tatsächlich gespeicherten Gesamthöhe passen.
export function upgradeDollyStack(c, presets) {
  if (c.kind === 'speaker' && c.unitH > 0 && c.unitD > 0 && c.speakerType && c.cabinetColor) return c;
  const m = /^dolly-(.+)-(\d+)$/.exec(c.id) ?? /^preset-(.+)-dolly-(\d+)$/.exec(c.id);
  if (!m) return c;
  const base = presets.find(p => p.id === `preset-${m[1]}` && p.dollyPrompt);
  const n = Number(m[2]);
  if (!base || !(n > 0)) return c;
  return {
    ...c,
    kind: 'speaker',
    unitH: c.unitH > 0 ? c.unitH : c.h / n,
    // Ausnahme von „Maße bleiben unverändert“ auf ausdrücklichen Nutzerwunsch (2026-10-08): alte
    // Stacks belegten nur die nackte Boxentiefe; jetzt die Dolly-Stufe, Boxentiefe in unitD.
    w: c.unitD > 0 ? c.w : dollyDepth(c.w),
    unitD: c.unitD > 0 ? c.unitD : c.w,
    speakerType: c.speakerType ?? base.speakerType,
    cabinetColor: c.cabinetColor ?? base.cabinetColor,
  };
}
