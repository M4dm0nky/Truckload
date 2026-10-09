import { EPS, archBoxes, boxOf, overlaps, footprintOverlapArea, footprintArea, supportersOf, pieceLayers, isTruss, canTip } from './geometry.js';
import { buildItems } from './items.js';

const SUPPORT_MIN = 0.8;
const IMBALANCE_RATIO = 0.1;

function loadSequence(items) {
  const sorted = [...items].sort((a, b) =>
    a.box.x0 - b.box.x0 || a.box.y0 - b.box.y0 || a.box.z0 - b.box.z0);
  return new Map(sorted.map((it, i) => [it.id, i + 1]));
}

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

  // Fehlende Case-Typen haben keine bekannten Maße (das Placement speichert nur x/y/z) und können
  // nicht in die Kollisionsprüfung. Die Meldung macht das offen, statt eine geprüfte Position
  // vorzutäuschen.
  for (const p of missing)
    add(p.id, 'missingCase',
      `„${p.label ?? p.caseId}“ hat keinen bekannten Case-Typ mehr – die Position wird nicht auf Kollisionen geprüft.`);

  for (const it of items) {
    const b = it.box, n = it.label;
    if (b.x0 < -EPS || b.y0 < -EPS || b.z0 < -EPS
      || b.x1 > truck.l + EPS || b.y1 > truck.w + EPS || b.z1 > truck.h + EPS)
      add(it.id, 'outOfBounds', `„${n}“ ragt über den Laderaum hinaus.`);
    if (arches.some(a => overlaps(a, b))) add(it.id, 'arch', `„${n}“ kollidiert mit einem Radkasten.`);
    // Traversenwagen sind geometrisch immer „standing“ (effectiveDims); ihre p.orientation bleibt unbeachtet.
    if (!isTruss(it.c) && it.p.orientation !== 'standing' && !canTip(it.c))
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

  // Cases ohne recherchiertes Gewicht tragen 0 kg ein (bewusst, statt geraten – CLAUDE.md
  // „Haltung“). Der ANGEZEIGTE Schwerpunkt schaltet für die ganze Ladung auf eine Volumen-Näherung
  // um, sobald ein Stück ohne Gewicht dabei ist; sonst sähe ein gewichtsbasierter Wert, der solche
  // Stücke mit 0 zählt, wie ein vollständiger aus.
  //
  // Die EINSEITIGKEITSPRÜFUNG läuft davon unabhängig: ein aus den bekannten Gewichten bereits
  // nachweisbares Ungleichgewicht darf nicht verschwinden, weil ein gewichtsloses Case auf der
  // anderen Seite die Volumen-Schätzung Richtung Mitte zieht (Beispiel: 1000 kg auf einer Seite,
  // dazu ein 210×220×190-Case ohne Gewicht gegenüber). Fehlen Gewichte, genügt, dass eine der
  // beiden Prüfungen anschlägt. Bewusst in Kauf genommen: eine Warnung, die sich nach dem
  // Nachtragen der Gewichte als unbegründet erweist – eine verschwiegene Schieflage wiegt schwerer.
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
  // `cog.x` mitberechnet wird. Eine Stütz-/Achslastprüfung in x bräuchte den Achsabstand des
  // Trucks, den das Fahrzeug-Datenmodell (`js/data/preset-trucks.js`: l/w/h/payload) nicht kennt;
  // eine Warnung ohne belastbare Referenz wäre geraten statt geprüft (CLAUDE.md „Haltung“).
  // `cog.x` dient dem Inspector nur zur Anzeige.
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
  // `!= null` statt Truthy-Check: eine leere Zeichenkette als Placement-ID (aus einer Fremddatei,
  // io.js prüft nur `typeof === 'string'`) fiele sonst aus der Map, und die Meldung verschwände
  // im Inspector.
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
