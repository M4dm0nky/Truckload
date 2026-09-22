import { ORIENTATIONS, ROTATIONS, effectiveDims, overlaps, layersOf, wheelFace, DOOR_FACE } from './geometry.js';
import { archBoxes } from './validate.js';

export function chooseOrientation(c, truck) {
  const opts = [];
  // Bewusst `c.tippable` statt `canTip(c)` (js/model/truss.js): für Traversenwagen ist
  // `tippable` an jeder Stelle, an der ein Case entsteht oder geladen wird, bereits auf `false`
  // gezwungen (checkCase/normalizeCase in js/store/io.js, Case-Editor), `c.tippable` allein
  // liefert hier also schon dasselbe Ergebnis wie `canTip(c)`. Das beweist aber nur die
  // Gleichheit unter dieser Invariante, nicht eine identische Funktion — eine Zusammenführung
  // hier würde sich stillschweigend auf diese Invariante verlassen, statt sie (wie `canTip`)
  // selbst durchzusetzen. Bewusst nicht zusammengeführt (docs/code-review-2026-09-21.md,
  // „packer.js:7 / io.js:7“, Vorschlag zu `canTip` in `chooseOrientation`).
  for (const orientation of c.tippable ? ORIENTATIONS : ['standing']) {
    for (const rot of ROTATIONS) {
      const d = effectiveDims(c, { orientation, rot });
      if (d.dx > truck.l || d.dy > truck.w || d.dz > truck.h) continue;
      // Score-Lagenzahl auf die 4er-Grenze deckeln, die buildStacks selbst einhält
      // (stacks.items.length < 4), und auf layersOf(c) — sonst bewertet der Score
      // flache Cases mit einer Lagenzahl, die nie zustande kommt (Befund „packer.js:10-12“).
      const cap = Math.max(...layersOf(c));
      const layers = c.stackable ? Math.min(cap, Math.floor(truck.h / d.dz)) : 1;
      const cols = Math.floor(truck.w / d.dy);
      const score = (cols * d.dy / truck.w) * (layers * d.dz / truck.h);
      opts.push({ orientation, rot, d, score });
    }
  }
  const isDoorFacing = o => wheelFace({ orientation: o.orientation, rot: o.rot }) === DOOR_FACE;
  // Für getippte Kandidaten hat die Rollenrichtung zur Tür Vorrang vor dem Füllgrad:
  // Tür-taugliche Rotationen liegen oft in der anderen Grundfläche (anderer Score),
  // daher würde ein reiner Score-Tie-Break sie in vielen Fällen aus dem Rennen werfen.
  // Gibt es unter den getippten Kandidaten mindestens einen mit Rollen zur Tür,
  // werden die übrigen getippten Kandidaten verworfen, bevor sortiert wird.
  // Stehende Kandidaten sind davon nicht betroffen.
  const standing = opts.filter(o => o.orientation === 'standing');
  const tipped = opts.filter(o => o.orientation !== 'standing');
  const doorTipped = tipped.filter(isDoorFacing);
  const candidates = [...standing, ...(doorTipped.length ? doorTipped : tipped)];
  // Bei gleichem Score gewinnt zuerst „standing“, dann die Variante mit
  // Rollen zur Tür, dann rot === 0.
  const pref = o => {
    if (o.orientation === 'standing') return 0;
    if (isDoorFacing(o)) return 1;
    if (o.rot === 0) return 2;
    return 3;
  };
  candidates.sort((p, q) => q.score - p.score || pref(p) - pref(q));
  return candidates[0] ?? null;
}

function canAddToStack(stack, c, dz, truck) {
  if (stack.height + dz > truck.h + 1e-6) return false;
  if (!stack.items.at(-1).c.stackable) return false;
  if (stack.items.at(-1).c.weight < c.weight) return false;
  let above = c.weight;
  for (let i = stack.items.length - 1; i >= 0; i--) {
    const s = stack.items[i].c;
    if (s.maxTopLoad != null && above > s.maxTopLoad) return false;
    above += s.weight;
  }
  return true;
}

// itemList: Stücke { id, caseId, c, label?, color? } mit bereits aufgelöstem Case `c`.
export function buildStacks(itemList, truck) {
  const stacks = [], unplaced = [];
  const entries = itemList.map(it => ({ it, c: it.c, o: chooseOrientation(it.c, truck) }));
  for (const e of entries) if (!e.o) unplaced.push(e.it);
  const maxLayer = c => Math.max(...layersOf(c));
  const minLayer = c => Math.min(...layersOf(c));
  const ready = entries.filter(e => e.o);
  const withFloor = ready.filter(e => layersOf(e.c).includes(1)).sort((a, b) =>
    maxLayer(a.c) - maxLayer(b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);
  const withoutFloor = ready.filter(e => !layersOf(e.c).includes(1)).sort((a, b) =>
    minLayer(a.c) - minLayer(b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);

  // Gemeinsamer Rumpf: einen passenden Stapel suchen und das Stück dort anhängen. Nur der
  // Rückfall unterscheidet sich zwischen den beiden Durchläufen (neuen Stapel anlegen, weil ein
  // Stück selbst Bodenkontakt haben darf, vs. in die Ablage legen, weil ein Stück ohne Boden
  // unter ihm nirgends stehen kann) — genau der Unterschied bleibt als Parameter `onMiss`
  // erhalten, der Rest war Zeile für Zeile identisch (docs/code-review-2026-09-21.md,
  // „packer.js:65-90“).
  const addTo = (entries, onMiss) => {
    for (const { it, c, o } of entries) {
      const key = `${o.d.dx}x${o.d.dy}`;
      const allowed = layersOf(c);
      const target = stacks.find(s => s.key === key && s.items.length < 4
        && allowed.includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck));
      if (target) {
        target.items.push({ it, c, o, z: target.height });
        target.height += o.d.dz;
        target.weight += c.weight;
      } else {
        onMiss({ it, c, o });
      }
    }
  };
  addTo(withFloor, ({ it, c, o }) =>
    stacks.push({ key: `${o.d.dx}x${o.d.dy}`, dx: o.d.dx, dy: o.d.dy, height: o.d.dz, weight: c.weight, items: [{ it, c, o, z: 0 }] }));
  addTo(withoutFloor, ({ it }) => unplaced.push(it));
  return { stacks, unplaced };
}

export function placeStacks(stacks, truck, obstacles = []) {
  const blocked = [...archBoxes(truck), ...obstacles];
  const points = [{ x: 0, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  for (const s of [...stacks].sort((a, b) => b.weight - a.weight)) {
    points.sort((p, q) => p.x - q.x || p.y - q.y);
    let hit = null;
    for (const pt of points) {
      // swap dreht den Stapel im Grundriss um 90°, wenn er sonst nirgends passt.
      // Das gibt eine zuvor gewählte Rollenrichtung bewusst auf — Platz geht vor
      // Rollenrichtung, sonst wäre der Stapel gar nicht unterzubringen (siehe autoPack).
      for (const swap of s.dx === s.dy ? [false] : [false, true]) {
        const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
        const box = { x0: pt.x, y0: pt.y, z0: 0, x1: pt.x + dx, y1: pt.y + dy, z1: s.height };
        if (box.x1 > truck.l + 1e-6 || box.y1 > truck.w + 1e-6) continue;
        if (blocked.some(b => overlaps(b, box))) continue;
        hit = { box, swap };
        break;
      }
      if (hit) break;
    }
    if (!hit) { failed.push(s); continue; }
    blocked.push(hit.box);
    placed.push({ stack: s, ...hit });
    points.push({ x: hit.box.x1, y: hit.box.y0 }, { x: hit.box.x0, y: hit.box.y1 });
  }
  return { placed, failed };
}

// items: Stücke { id, caseId, c, label?, color? } mit bereits aufgelöstem Case `c`.
// Die erzeugten Placements übernehmen id/label/color des Stücks statt eine neue ID zu vergeben.
export function autoPack(items, truck, { obstacles = [] } = {}) {
  const { stacks, unplaced } = buildStacks(items, truck);
  const { placed, failed } = placeStacks(stacks, truck, obstacles);
  const placements = [];
  for (const { stack, box, swap } of placed) {
    for (const { it, o, z } of stack.items) {
      placements.push({
        id: it.id, caseId: it.caseId, x: box.x0, y: box.y0, z,
        // swap (Stapel im Grundriss um 90° platziert, siehe placeStacks) dreht rot
        // mit — die Rollenrichtung ist dann nicht mehr garantiert zur Tür.
        orientation: o.orientation, rot: swap ? (o.rot + 90) % 360 : o.rot,
        ...(it.label ? { label: it.label } : {}),
        ...(it.color ? { color: it.color } : {}),
      });
    }
  }
  const stripCase = ({ c, ...rest }) => rest;
  const left = [...unplaced, ...failed.flatMap(s => s.items.map(i => i.it))];
  return { placements, unplaced: left.map(stripCase) };
}
