import { ROTATIONS, isTruss, archBoxes, effectiveDims, overlaps, wheelFace, DOOR_FACE, pieceLayers, pieceOrientations, outerDims } from './geometry.js';
import { pickPieceFields } from './pieceFields.js';
import { legacyRules, blockComparator, volumeOf, sameSelectorRank } from './packRules.js';

export function chooseOrientation(c, truck, piece = {}) {
  const opts = [];
  for (const orientation of pieceOrientations(piece, c)) {
    for (const rot of ROTATIONS) {
      const d = effectiveDims(c, { orientation, rot });
      if (d.dx > truck.l || d.dy > truck.w || d.dz > truck.h) continue;
      // Score-Lagenzahl auf die 4er-Grenze von buildStacks und auf pieceLayers(piece, c) deckeln,
      // sonst bewertet der Score flache Cases mit einer Lagenzahl, die nie zustande kommt.
      const cap = Math.max(...pieceLayers(piece, c));
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

// Deckschicht (Spec 2026-09-30-deckschicht-design.md): gehören zwei Stücke zusammen? Beide mit
// Gruppe → gleiche Gruppe; beide ohne → gleiches Gewerk; eins mit, eins ohne → nein.
const belongsTogether = (a, ca, b, cb) =>
  (a.group || b.group) ? a.group === b.group : ca.category === cb.category;

// Passt das Stück als Deckschicht auf den Stapel `s` eines früheren Blocks? Liefert die (evtl. im
// Grundriss um 90° gedrehte) Orientierung oder null. Grundfläche ganz auf dem obersten Stück
// (100 % Auflage), Gewichte bekannt (> 0, 0 kg = unbekannt, eigene Entscheidung) und nicht
// schwerer als oben, keine Traversen, sonst dieselben Grenzen wie beim Stapeln (canAddToStack,
// 4 Lagen, Lagen je Stück).
function capFits(s, it, c, o, truck) {
  const base = s.items[0], top = s.items.at(-1);
  // Nicht nur das Fundament prüfen: ein Traversenwagen kann per prevLast-Auffüllen mittig in einen
  // fremden Stapel geraten (gleiche Grundfläche); dann trägt der Stapel nichts Fremdes.
  if (isTruss(c) || s.items.some(x => isTruss(x.c))) return null;
  if (!(c.weight > 0) || !s.items.every(x => x.c.weight > 0)) return null;
  if (!belongsTogether(it, c, base.it, base.c)) return null;
  if (s.items.length >= 4 || !pieceLayers(it, c).includes(s.items.length + 1)) return null;
  // Wie beim Stapel-Swap in placeStacks: ein um 90° gedrehter Deckel kann die Rollenrichtung zur
  // Tür verlieren; hier geht Grundfläche vor Rollenrichtung.
  const swapped = { ...o, rot: (o.rot + 90) % 360, d: { dx: o.d.dy, dy: o.d.dx, dz: o.d.dz } };
  for (const cand of [o, swapped]) {
    if (cand.d.dx > top.o.d.dx + 1e-6 || cand.d.dy > top.o.d.dy + 1e-6) continue;
    if (canAddToStack(s, c, cand.d.dz, truck)) return cand;
  }
  return null;
}

// Sortenrein packen: ein Block ist ein Case-Typ (caseId) PLUS Gruppe (Stück-Feld `group`, Spec
// 2026-09-30) – so lassen sich z. B. 20 von 30 gleichen Cases als „Motoren“ an die Tür schieben.
// `rules` ist die Rangliste des Loads (js/model/packRules.js).
export function orderSorts(itemList, rules) {
  rules ??= legacyRules('volume');
  const groups = new Map();
  for (const it of itemList) {
    const key = `${it.caseId}\u0000${it.group ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.values()].sort(blockComparator(rules));
}

// itemList: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Stapel entstehen je Sorte (orderSorts). Einzige Ausnahme vom „nur Gleiches auf Gleichem“: die
// nächste Sorte darf zuerst den LETZTEN noch offenen Stapel der unmittelbar vorigen Sorte
// auffüllen (Nutzerregel „Letzter Stapel darf aufgefüllt werden“) – mit denselben Grenzen wie
// immer (gleiche Grundfläche, Lagen je Stück, höchstens 4 Lagen, nichts Schweres auf Leichtes,
// maxTopLoad). Jeder Stapel trägt `sort` = Index der Sorte, die ihn begonnen hat.
export function buildStacks(itemList, truck, { rules, mixTop = false } = {}) {
  rules ??= legacyRules('volume');
  const stacks = [], unplaced = [];
  const maxLayer = (it, c) => Math.max(...pieceLayers(it, c));
  const minLayer = (it, c) => Math.min(...pieceLayers(it, c));
  const fits = (s, it, c, o) => !s.capped && s.key === `${o.d.dx}x${o.d.dy}` && s.items.length < 4
    && pieceLayers(it, c).includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck);
  // `weight` ist das Gesamtgewicht des Stapels (für canAddToStack/maxTopLoad), `ownWeight` nur das
  // der Stücke der Sorte, die ihn begonnen hat – damit placeStacks nicht nach dem Gewicht sortiert,
  // das eine SPÄTERE Sorte obendrauf gesetzt hat. `mixed` markiert einen Stapel mit Stücken einer
  // späteren Sorte; er steht innerhalb seiner Sorte immer zuletzt.
  const push = (s, it, c, o, own) => {
    s.items.push({ it, c, o, z: s.height });
    s.height += o.d.dz;
    s.weight += c.weight;
    if (own) s.ownWeight += c.weight; else s.mixed = true;
  };
  let prevLast = null; // letzter Stapel, in dem die vorige Sorte zuletzt etwas abgelegt hat

  orderSorts(itemList, rules).forEach((group, sort) => {
    const entries = group.map(it => ({ it, c: it.c, o: chooseOrientation(it.c, truck, it) }));
    for (const e of entries) if (!e.o) unplaced.push(e.it);
    const ready = entries.filter(e => e.o);
    const withFloor = ready.filter(e => pieceLayers(e.it, e.c).includes(1)).sort((a, b) =>
      maxLayer(a.it, a.c) - maxLayer(b.it, b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);
    const withoutFloor = ready.filter(e => !pieceLayers(e.it, e.c).includes(1)).sort((a, b) =>
      minLayer(a.it, a.c) - minLayer(b.it, b.c) || b.c.weight - a.c.weight || b.o.d.dx * b.o.d.dy - a.o.d.dx * a.o.d.dy);

    const own = [];
    let last = null;
    const addTo = (list, onMiss) => {
      for (const { it, c, o } of list) {
        const usePrev = prevLast && fits(prevLast, it, c, o);
        const target = usePrev ? prevLast : own.find(s => fits(s, it, c, o));
        if (target) { push(target, it, c, o, !usePrev); last = target; continue; }
        // Deckschicht: erst wenn weder Auffüllen noch ein eigener Stapel geht, auf den ersten
        // passenden Stapel eines FRÜHEREN Blocks (näher an der Stirnwand). `last` bleibt dabei
        // unverändert – prevLast gehört weiter dem Stapel, den diese Sorte selbst zuletzt belegt hat.
        if (mixTop) {
          let cap = null, capO = null;
          for (const s of stacks) {
            if (s.sort >= sort || !sameSelectorRank(rules, s.block, group)) continue;
            capO = capFits(s, it, c, o, truck);
            if (capO) { cap = s; break; }
          }
          if (cap) { push(cap, it, c, capO, false); cap.capped = true; continue; }
        }
        onMiss({ it, c, o });
      }
    };
    addTo(withFloor, ({ it, c, o }) => {
      const s = { key: `${o.d.dx}x${o.d.dy}`, dx: o.d.dx, dy: o.d.dy, height: o.d.dz, weight: c.weight, ownWeight: c.weight, sort, block: group, items: [{ it, c, o, z: 0 }] };
      own.push(s);
      stacks.push(s);
      last = s;
    });
    addTo(withoutFloor, ({ it }) => unplaced.push(it));
    // prevLast ist der Stapel, den DIESE Sorte begonnen oder zuletzt aufgefüllt hat. Nur wenn `last`
    // von dieser Sorte begonnen wurde (`stack.sort === sort`), darf die nächste Sorte ihn auffüllen;
    // sonst verfällt prevLast, damit eine übernächste Sorte keine dazwischenliegende überspringt.
    prevLast = (last && last.sort === sort) ? last : null;
  });
  return { stacks, unplaced };
}

// Stellt die Stapel Sorte für Sorte (stack.sort, Reihenfolge wie von buildStacks geliefert) per
// Bottom-Left in den Truck. Jede Sorte sucht nur Punkte mit x ≥ minX: für die erste Sorte ist das
// `startX` (0 bzw. hinter einer vorhandenen Ladung), für jede weitere das x0 der letzten Reihe der
// vorigen Sorte – so füllt sie deren freie Spuren (Nutzerregel „Lücke auffüllen“), kommt aber nie
// weiter nach vorn. Innerhalb einer Sorte stehen die nach `ownWeight` schwereren Stapel weiter
// vorn, ein von der nächsten Sorte aufgefüllter (`mixed`) Stapel immer zuletzt.
export function placeStacks(stacks, truck, obstacles = [], { startX = 0 } = {}) {
  const blocked = [...archBoxes(truck), ...obstacles];
  // Startpunkt { x: startX, y: 0 } genügt; ein zusätzlicher Nullpunkt wäre bei startX > 0 nie
  // ein gültiger Kandidat.
  const points = [{ x: startX, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  let minX = startX;
  const sorts = [...new Set(stacks.map(s => s.sort ?? 0))];
  for (const sort of sorts) {
    // NUR nach `ownWeight` sortieren, nicht nach dem Gesamtgewicht, sonst rutschte ein von der
    // NÄCHSTEN Sorte aufgefüllter Stapel nach vorn; ein `mixed` Stapel steht zuletzt.
    const group = stacks.filter(s => (s.sort ?? 0) === sort)
      .sort((a, b) => (a.mixed ? 1 : 0) - (b.mixed ? 1 : 0) || (b.ownWeight ?? b.weight) - (a.ownWeight ?? a.weight));
    const boxesHere = [];
    for (const s of group) {
      points.sort((p, q) => p.x - q.x || p.y - q.y);
      const fits = box => box.x1 <= truck.l + 1e-6 && box.y1 <= truck.w + 1e-6 && !blocked.some(b => overlaps(b, box));
      const swaps = s.dx === s.dy ? [false] : [false, true];
      let hit = null;
      // Zuerst im Spurraster der Sorte ab der linken Wand (y = k · Stapelbreite): sonst setzt
      // Bottom-Left die Sorte in die Ecke neben der letzten Reihe der vorigen Sorte, deren Spuren
      // eine andere Breite haben – 62er-Wagen landeten so bei y = 60/122/184, an der Wand blieben
      // 60 cm übrig und es passten nur 3 statt 4 nebeneinander (Nutzer-Befund 2026-09-28).
      const xs = [...new Set(points.map(p => Math.max(p.x, minX)))].sort((a, b) => a - b);
      // Je x gewinnt die kleinste freie Spur-y über beide Grundriss-Drehungen, bei Gleichstand
      // ungedreht – dieselbe Vorrangfolge wie die Eckensuche unten (Punkt vor Drehung).
      for (const x of xs) {
        for (const swap of swaps) {
          const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
          for (let y = 0; y + dy <= truck.w + 1e-6; y += dy) {
            const box = { x0: x, y0: y, z0: 0, x1: x + dx, y1: y + dy, z1: s.height };
            if (!fits(box)) continue;
            if (!hit || y < hit.box.y0 - 1e-6) hit = { box, swap };
            break;
          }
        }
        if (hit) break;
      }
      // Rückfall, wenn im Raster nichts passt (z. B. Radkästen im Transporter): freie Eckensuche.
      if (!hit) for (const rawPt of points) {
        // Ein Punkt mit x < minX wird auf minX geklemmt geprüft statt verworfen: seine y-Koordinate
        // (z. B. Ecke eines weiter vorn liegenden Hindernisses) bleibt als Kandidat für eine freie
        // Spur der aktuellen Reihe erhalten. Duplikate durch die Klemmung sind unschädlich.
        const pt = rawPt.x < minX - 1e-6 ? { x: minX, y: rawPt.y } : rawPt;
        // swap dreht den Stapel im Grundriss um 90°, wenn er sonst nirgends passt.
        // Das gibt eine zuvor gewählte Rollenrichtung bewusst auf — Platz geht vor
        // Rollenrichtung, sonst wäre der Stapel gar nicht unterzubringen (siehe autoPack).
        for (const swap of swaps) {
          const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
          const box = { x0: pt.x, y0: pt.y, z0: 0, x1: pt.x + dx, y1: pt.y + dy, z1: s.height };
          if (!fits(box)) continue;
          hit = { box, swap };
          break;
        }
        if (hit) break;
      }
      if (!hit) { failed.push(s); continue; }
      blocked.push(hit.box);
      boxesHere.push(hit.box);
      placed.push({ stack: s, ...hit });
      points.push({ x: hit.box.x1, y: hit.box.y0 }, { x: hit.box.x0, y: hit.box.y1 });
    }
    if (boxesHere.length) minX = Math.max(...boxesHere.map(b => b.x0));
  }
  return { placed, failed };
}

// items: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Die erzeugten Placements übernehmen id/label/color/layers/tipped des Stücks statt eine neue ID zu vergeben.
// order: 'volume' | 'count' (Altdaten), rules: Rangliste (packRules.js, hat Vorrang), startX: frühestes x der ersten Sorte (Rest einpacken).
export function autoPack(items, truck, { obstacles = [], order = 'volume', rules, mixTop = false, startX = 0 } = {}) {
  // Der String `order` (Altdaten) wird hier einmal in Regeln übersetzt; darunter gibt es nur Regel-Arrays.
  const { stacks, unplaced } = buildStacks(items, truck, { rules: rules ?? legacyRules(order), mixTop });
  const { placed, failed } = placeStacks(stacks, truck, obstacles, { startX });
  const placements = [];
  for (const { stack, box, swap } of placed) {
    for (const { it, o, z } of stack.items) {
      placements.push({
        id: it.id, caseId: it.caseId, x: box.x0, y: box.y0, z,
        // swap (Stapel im Grundriss um 90° platziert, siehe placeStacks) dreht rot
        // mit — die Rollenrichtung ist dann nicht mehr garantiert zur Tür.
        orientation: o.orientation, rot: swap ? (o.rot + 90) % 360 : o.rot,
        ...pickPieceFields(it),
        // Die Gruppe bleibt hier unverändert (Stücke aus toPiece() haben sie schon bereinigt).
        ...(it.group ? { group: it.group } : {}),
      });
    }
  }
  const stripCase = ({ c, ...rest }) => rest;
  const left = [...unplaced, ...failed.flatMap(s => s.items.map(i => i.it))];
  return { placements, unplaced: left.map(stripCase) };
}
