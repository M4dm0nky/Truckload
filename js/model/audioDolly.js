import { colorFor } from '../data/categories.js';
import { CASE_LIMITS, NAME_MAX } from './limits.js';
import { slug } from './slug.js';

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

// Die ID darf NICHT mit „preset-“ beginnen: `isPreset()` in js/store/io.js filtert solche IDs beim
// Datei-Import heraus – ein Dolly-Stack mit ID aus `baseCase.id` (z. B. `preset-k2`) wäre nach
// einem Backup-Export/-Import weg. Daher werden „preset-“ und „lib-“ abgeschnitten und „dolly-“
// vorangestellt. Deterministisch aus Basisbox + Stückzahl (+ Firma: eigener ID-Raum je Firma,
// weil die Wagenmaße firmenabhängig sind); getrennt exportiert, damit der Dolly-Dialog prüfen
// kann, ob die Kombination schon existiert, ohne das Case neu zu bauen und eine im Case-Editor
// bearbeitete Zeile zu überschreiben.
export function dollyStackId(baseCase, n, company = '') {
  const baseId = baseCase.id.replace(/^(preset-|lib-)/, '');
  return company ? `dolly-${slug(company)}-${baseId}-${n}` : `dolly-${baseId}-${n}`;
}

// Größte Stückzahl, bei der Höhe und Gewicht der Vorlage innerhalb der CASE_LIMITS bleiben
// (js/model/limits.js) – für das „max“-Attribut im Dolly-Dialog; sonst könnte ein Tippfehler ein
// Case erzeugen, das beim nächsten Import an checkCase() scheitert.
export function maxDollyCount(baseCase) {
  const byHeight = Math.floor(CASE_LIMITS.h / baseCase.h);
  const byWeight = Math.floor((CASE_LIMITS.weight - DOLLY_WEIGHT_KG) / baseCase.weight);
  return Math.max(1, Math.min(byHeight, byWeight));
}

// Baut den Case-Typ für „<Basisbox> N er (auf Dolly)“: Länge = Boxbreite, Tiefe = Dolly-Tiefe
// (dollyDepth()), echte Boxentiefe in `unitD` für die 3D-Darstellung (docs/casemasse-gewichte.md).
// Die Dolly-Höhe steckt in `wheelH`/`dimsInclWheels: false`, nicht in `h`, damit die vorhandene
// 4-Rollen-Zeichnung in js/model/caseShape.js den Dolly mitzeichnet. `h` = Stückzahl × Boxhöhe.
// `layers: [1]`: der Turm ist schon volle Höhe, ein zweiter Stack wird nicht automatisch obenauf
// gestapelt; `stackable: true` bleibt, leichtere Cases dürfen drauf (`maxTopLoad`).
// `kind: 'speaker'` gibt view3d.js einen eigenen Render-Zweig (Nutzer-Feedback 2026-10-08: sonst
// sieht ein Dolly-Stack wie ein normales Flightcase aus); `unitH` ist die Höhe einer Box für die
// Trennlinien. 2D liest `kind` nicht.
// `wagen` (optional): { l, w } = Wagengröße der Firma in cm; ohne gilt Boxbreite × Dolly-Stufe.
// `company` (optional): Firma des Materialbestands, eigener ID-Raum je Firma.
// Firmen-Stacks entstehen vollständig; upgradeDollyStack lässt sie unverändert.
// „<Basis> N er (auf Dolly)“ höchstens NAME_MAX lang: ein zu langer Basisname wird mit „…“
// gekürzt, der Zusatz bleibt vollständig (sonst lehnte der Import das Case ab).
export function dollyName(baseName, n) {
  const suffix = ` ${n}er (auf Dolly)`;
  const room = NAME_MAX - suffix.length;
  return `${baseName.length > room ? `${baseName.slice(0, room - 1)}…` : baseName}${suffix}`;
}

export function dollyStackCase(baseCase, n, wagen = {}, company = '') {
  return {
    id: dollyStackId(baseCase, n, company),
    company: company || undefined,
    builtin: false,
    name: dollyName(baseCase.name, n),
    content: '',
    category: baseCase.category,
    color: colorFor(baseCase.category),
    l: wagen.l ?? baseCase.l,
    w: wagen.w ?? dollyDepth(baseCase.w),
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

// Ergänzt einen früher gespeicherten Dolly-Stack um die Darstellungsfelder, die er noch nicht
// hatte (Nutzer-Screenshot 2026-10-08: K2-2er-Stacks liefen ohne `kind` durch die Flightcase-
// Darstellung). Erkennt `dolly-<basis>-<n>` und die alte Form `preset-<basis>-dolly-<n>`. Nur
// fehlende Felder werden ergänzt; Länge, Höhe, Gewicht, Rollenhöhe und ID bleiben (Platzierungen
// verweisen auf die ID), einzige Ausnahme ist die Tiefe (s. unten). `unitH` aus der gespeicherten
// Höhe, damit die Einheiten zur gespeicherten Gesamthöhe passen.
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
