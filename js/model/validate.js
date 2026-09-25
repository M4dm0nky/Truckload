import { EPS, boxOf, overlaps, footprintOverlapArea, footprintArea, supportersOf, pieceLayers } from './geometry.js';
import { isTruss } from './truss.js';

// SUPPORT_MIN/IMBALANCE_RATIO nur in dieser Datei benutzt — nicht mehr exportiert
// (docs/code-review-2026-09-21.md, „zehn zu weit offene Exporte“).
const SUPPORT_MIN = 0.8;
const IMBALANCE_RATIO = 0.1;

// Gültige Seitenwerte eines Radkastens. Lag vorher in js/store/io.js (Speicherschicht), obwohl
// nur die Modellschicht (hier, `archBoxes`) etwas mit der Seite anfängt — io.js benutzt die Liste
// nur zur Import-Prüfung (docs/code-review-2026-09-21.md, „validate.js:9“).
export const ARCH_SIDES = ['left', 'right', 'both'];
const [ARCH_LEFT, ARCH_RIGHT, ARCH_BOTH] = ARCH_SIDES;

// Obergrenzen für Case-Werte aus fremden Dateien. Großzügig, aber so, dass Unsinn
// (ein 100 m langes, 100 t schweres Case) auffällt. Auch für die `max=`-Attribute
// im Case-Editor benutzt, damit Oberfläche und Import nicht auseinanderlaufen.
export const CASE_LIMITS = {
  l: 2000, w: 2000, h: 2000, // cm
  weight: 50000, // kg
  wheelH: 200, // cm
  maxTopLoad: 50000, // kg
  stock: 9999, // Stück
};

export function archBoxes(truck) {
  return (truck.wheelArches ?? []).flatMap(a => {
    const sides = a.side === ARCH_BOTH ? [ARCH_LEFT, ARCH_RIGHT] : [a.side];
    return sides.map(s => ({
      x0: a.x, x1: a.x + a.l,
      y0: s === ARCH_LEFT ? 0 : truck.w - a.w,
      y1: s === ARCH_LEFT ? a.w : truck.w,
      z0: 0, z1: a.h,
    }));
  });
}

export function buildItems(plan, caseById) {
  const items = [], missing = [];
  for (const p of plan.placements) {
    const c = caseById.get(p.caseId);
    if (!c) { missing.push(p); continue; }
    items.push({
      id: p.id, p, c, box: boxOf(c, p), label: p.label ?? c.name, color: p.color ?? c.color,
      layers: p.layers, tipped: p.tipped,
    });
  }
  return { items, missing };
}

// Nur in dieser Datei benutzt — nicht mehr exportiert (docs/code-review-2026-09-21.md,
// „zehn zu weit offene Exporte“).
function loadSequence(items) {
  const sorted = [...items].sort((a, b) =>
    a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0 || a.box.z0 - b.box.z0);
  return new Map(sorted.map((it, i) => [it.id, i + 1]));
}

// Nur in dieser Datei benutzt — nicht mehr exportiert (docs/code-review-2026-09-21.md,
// „zehn zu weit offene Exporte“).
function layerMap(items) {
  const layers = new Map();
  const sorted = [...items].sort((a, b) => a.box.z0 - b.box.z0);
  for (const it of sorted) {
    if (it.box.z0 <= EPS) { layers.set(it.id, 1); continue; }
    const sup = supportersOf(it, items);
    const maxSup = sup.length ? Math.max(...sup.map(s => layers.get(s.id) ?? 1)) : 0;
    layers.set(it.id, 1 + maxSup);
  }
  return layers;
}

export function validatePlan(plan, caseById, truck) {
  const { items, missing } = buildItems(plan, caseById);
  const issues = [];
  const add = (placementId, code, message) => issues.push({ placementId, code, message });
  const arches = archBoxes(truck);

  // Fehlende Case-Typen haben keine bekannten Maße mehr (das Placement speichert nur x/y/z,
  // keine l/w/h) und können deshalb geometrisch nicht in die Kollisionsprüfung einbezogen
  // werden. Die Meldung macht das offen, statt eine geprüfte Position vorzutäuschen
  // (docs/code-review-2026-09-21.md, „validate.js:52,63-67“).
  for (const p of missing)
    add(p.id, 'missingCase',
      `„${p.label ?? p.caseId}“ hat keinen bekannten Case-Typ mehr – die Position wird nicht auf Kollisionen geprüft.`);

  for (const it of items) {
    const b = it.box, n = it.label;
    if (b.x0 < -EPS || b.y0 < -EPS || b.z0 < -EPS
      || b.x1 > truck.l + EPS || b.y1 > truck.w + EPS || b.z1 > truck.h + EPS)
      add(it.id, 'outOfBounds', `„${n}“ ragt über den Laderaum hinaus.`);
    if (arches.some(a => overlaps(a, b))) add(it.id, 'arch', `„${n}“ kollidiert mit einem Radkasten.`);
    // Ein Traversenwagen ist geometrisch immer „standing“ (effectiveDims erzwingt das),
    // p.orientation kann bei importierten Plänen trotzdem andere Werte tragen — die
    // notTippable-Prüfung darf sich davon nicht täuschen lassen.
    //
    // Bewusst NICHT über `canTip(it.c)` (js/model/truss.js) geschrieben: `canTip` ist
    // `tippable === true && !isTruss(c)`, dessen Verneinung wäre `tippable !== true ||
    // isTruss(c)` (ODER) — hier steht aber ein UND (`!isTruss(...) && ... && !tippable`), das
    // Traversenwagen von dieser Prüfung komplett ausnimmt, egal welche Orientierung sie tragen.
    // Mit `!canTip(it.c)` bekäme ein importierter Traversenwagen mit falscher `p.orientation`
    // fälschlich eine notTippable-Meldung statt gar keine — genau der Fehler, den der Kommentar
    // oben beschreibt (docs/code-review-2026-09-21.md, „geometry.js:35“, Vorschlag zu `canTip`).
    if (!isTruss(it.c) && it.p.orientation !== 'standing' && !it.c.tippable)
      add(it.id, 'notTippable', `„${n}“ darf nicht getippt werden.`);
  }

  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (!overlaps(items[i].box, items[j].box)) continue;
    add(items[i].id, 'collision', `„${items[i].label}“ überschneidet sich mit „${items[j].label}“.`);
    add(items[j].id, 'collision', `„${items[j].label}“ überschneidet sich mit „${items[i].label}“.`);
  }

  const supporters = new Map();
  for (const it of items) {
    if (it.box.z0 <= EPS) continue;
    const sup = supportersOf(it, items);
    supporters.set(it.id, sup);
    const archSup = arches.filter(a => Math.abs(a.z1 - it.box.z0) <= EPS);
    const area = [...sup.map(s => s.box), ...archSup]
      .reduce((s, bx) => s + footprintOverlapArea(bx, it.box), 0);
    // fa <= 0 explizit behandeln: area / 0 wäre NaN, und `NaN < SUPPORT_MIN` ist false —
    // ein Case mit Grundfläche 0 würde sonst stillschweigend als „sicher“ durchgehen.
    const fa = footprintArea(it.box);
    if (fa <= 0 || area / fa < SUPPORT_MIN)
      add(it.id, 'unsupported', `„${it.label}“ steht nicht sicher (unter ${SUPPORT_MIN * 100} % Auflage).`);
    for (const s of sup) if (!s.c.stackable)
      add(it.id, 'notStackable', `„${it.label}“ steht auf „${s.label}“, das nicht stapelbar ist.`);
  }

  const load = new Map(items.map(it => [it.id, 0]));
  for (const it of [...items].sort((a, b) => b.box.z0 - a.box.z0)) {
    const sup = supporters.get(it.id) ?? [];
    const areas = sup.map(s => footprintOverlapArea(s.box, it.box));
    const sum = areas.reduce((a, b) => a + b, 0);
    if (!sum) continue;
    const total = it.c.weight + load.get(it.id);
    sup.forEach((s, k) => load.set(s.id, load.get(s.id) + total * areas[k] / sum));
  }
  for (const it of items) {
    const max = it.c.maxTopLoad;
    if (max != null && load.get(it.id) > max + 1e-6)
      add(it.id, 'overload', `Auf „${it.label}“ lasten ${Math.round(load.get(it.id))} kg (max. ${max} kg).`);
  }

  const layers = layerMap(items);
  for (const it of items) {
    const n = layers.get(it.id);
    if (n > 4) add(it.id, 'tooManyLayers', `„${it.label}“ steht in Lage ${n} – mehr als 4 Lagen sind nicht vorgesehen.`);
    else {
      const allowed = pieceLayers(it.p, it.c);
      if (!allowed.includes(n)) add(it.id, 'layer', `„${it.label}“ darf nicht in Lage ${n} stehen (erlaubt: ${[...allowed].sort((a, b) => a - b).join(', ')}).`);
    }
  }

  const weight = items.reduce((s, it) => s + it.c.weight, 0);
  if (weight > truck.payload)
    add(null, 'tooHeavy', `Gesamtgewicht ${Math.round(weight)} kg überschreitet die Nutzlast von ${truck.payload} kg.`);

  // Cases ohne recherchiertes Gewicht tragen 0 kg ein (bewusst, statt geraten – siehe
  // CLAUDE.md „Haltung“). Der ANGEZEIGTE Schwerpunkt schaltet für die ganze Ladung auf eine
  // Volumen-Näherung um, sobald mindestens ein Stück ohne Gewicht dabei ist – ein
  // gewichtsbasierter Schwerpunkt würde solche Stücke sonst mit 0 gewichten und aussehen wie
  // ein echter, vollständiger Wert.
  //
  // Die EINSEITIGKEITSPRÜFUNG ist davon getrennt zu betrachten (Fix-Runde 1, Befund
  // Koordinator): Ein aus den bekannten Gewichten bereits nachweisbares Ungleichgewicht darf
  // nicht dadurch verschwinden, dass irgendwo ein zusätzliches, gewichtsloses Case dazukommt
  // – dessen Volumen würde die Volumen-Schätzung sonst unbemerkt Richtung Mitte ziehen, obwohl
  // die echte Masse weiterhin einseitig steht (reales Beispiel: 1000 kg auf einer Seite, dazu
  // ein 210×220×190-Case ohne Gewicht auf der anderen – die alte Volumen-Ersatzrechnung allein
  // hätte hier geschwiegen). Deshalb laufen beide Prüfungen unabhängig nebeneinander, sobald
  // Gewichte fehlen, und es reicht, wenn eine von beiden anschlägt. Kosten, falls das im
  // Einzelfall zu vorsichtig ist: Bei wenig bekanntem Gewicht, das zufällig einseitig liegt,
  // kann eine Warnung erscheinen, die sich nach dem Nachtragen der fehlenden Gewichte als
  // unbegründet erweist – das ist bewusst in Kauf genommen, das Gegenteil (eine verschwiegene
  // echte Schieflage) wiegt schwerer.
  const withoutWeight = items.filter(it => !it.c.weight).length;
  const vol = b => (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0);
  const volume = items.reduce((s, { box: b }) => s + vol(b), 0);

  const cogFrom = (weightOf, total) => total > 0 ? {
    x: items.reduce((s, it) => s + weightOf(it) * (it.box.x0 + it.box.x1) / 2, 0) / total,
    y: items.reduce((s, it) => s + weightOf(it) * (it.box.y0 + it.box.y1) / 2, 0) / total,
  } : null;
  const cogWeight = cogFrom(it => it.c.weight, weight);
  const cogVolume = cogFrom(it => vol(it.box), volume);

  const cog = withoutWeight === 0
    ? (cogWeight ? { ...cogWeight, source: 'weight' } : null)
    : (cogVolume ? { ...cogVolume, source: 'volume' } : null);

  // Geprüft wird bewusst nur die Seitenlage (y), nicht die Verteilung in Fahrtrichtung (x), obwohl
  // `cog.x` oben bereits mitberechnet wird (docs/code-review-2026-09-21.md, „validate.js:112-117
  // — der Schwerpunkt wird in x berechnet, aber nur in y geprüft“). Eine Stützlast-/Achslast-
  // Prüfung in x bräuchte den Radstand bzw. Achsabstand des Trucks – ein Feld, das es am
  // Fahrzeug-Datenmodell heute nicht gibt (`js/data/preset-trucks.js` kennt nur l/w/h/payload).
  // `cog.x` steht dem Inspector trotzdem zur Anzeige zur Verfügung ("… ab Stirnwand"); eine
  // Warnung ohne belastbare Referenzgröße wäre geraten statt geprüft, und genau das lehnt
  // `CLAUDE.md` unter „Haltung“ ab.
  const deviation = c => Math.abs(c.y - truck.w / 2);
  const isImbalanced = c => !!c && deviation(c) > IMBALANCE_RATIO * truck.w;

  if (withoutWeight === 0) {
    if (isImbalanced(cogWeight))
      add(null, 'imbalance', `Ladung ist einseitig: Schwerpunkt ${Math.round(deviation(cogWeight))} cm aus der Mitte.`);
  } else {
    const weightHit = isImbalanced(cogWeight);
    const volumeHit = isImbalanced(cogVolume);
    if (weightHit || volumeHit) {
      const parts = [];
      if (weightHit) parts.push(`${Math.round(deviation(cogWeight))} cm aus der Mitte (aus den bekannten Gewichten)`);
      if (volumeHit) parts.push(`${Math.round(deviation(cogVolume))} cm aus der Mitte (Volumen-Schätzung, Cases ohne Gewicht zählen dabei wie voll beladen)`);
      add(null, 'imbalance', `Ladung ist einseitig: Schwerpunkt ${parts.join(' bzw. ')}.`);
    }
  }

  const byPlacement = new Map();
  // `!= null` statt eines reinen Truthy-Checks: eine leere Zeichenkette als Placement-ID (aus
  // einer Fremddatei – io.js prüft für Placements nur `typeof === 'string'`, nicht die Länge)
  // fiele sonst stillschweigend aus dieser Map heraus, und die zugehörige Meldung verschwände im
  // Inspector (docs/code-review-2026-09-21.md, „validate.js:122 — if (is.placementId) filtert
  // statt auf null zu prüfen“).
  for (const is of issues) if (is.placementId != null) {
    if (!byPlacement.has(is.placementId)) byPlacement.set(is.placementId, []);
    byPlacement.get(is.placementId).push(is);
  }

  return {
    issues, byPlacement, load, items, layers, sequence: loadSequence(items),
    totals: {
      weight, payload: truck.payload, cog, withoutWeight,
      loadMeters: items.length ? Math.max(...items.map(it => it.box.x1)) / 100 : 0,
      volumeRatio: truck.l > 0 && truck.w > 0 && truck.h > 0 ? volume / (truck.l * truck.w * truck.h) : 0,
      count: items.length,
    },
  };
}
