import { boxOf } from './geometry.js';

// Lagen-Durchsicht: liegt dieses Stück oberhalb der gewählten Lage? `limit === null` heißt
// „alle“ und damit nie. Das AUSGEWÄHLTE Stück ist immer ausgenommen — in 3D verschwände es
// sonst ganz, während der Inspector es weiter als ausgewählt führt, in 2D verblasste sein
// Auswahlrahmen auf 18 %. Eine Regel für beide Ansichten, damit sie nicht auseinanderlaufen
// (die Lagen selbst kommen aus `layerMap` in js/model/validate.js).
export const aboveLayer = (layers, id, limit, selectedId) =>
  limit != null && id !== selectedId && (layers.get(id) ?? 1) > limit;

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
