import { ROTATIONS, effectiveDims, overlaps, wheelFace, DOOR_FACE, pieceLayers, pieceOrientations, outerDims } from './geometry.js';
import { archBoxes } from './validate.js';
import { isTruss } from './truss.js';
import { legacyRules, blockComparator, volumeOf, sameSelectorRank } from './packRules.js';

export function chooseOrientation(c, truck, piece = {}) {
  const opts = [];
  // Bewusst `c.tippable` statt `canTip(c)` (js/model/truss.js): für Traversenwagen ist
  // `tippable` an jeder Stelle, an der ein Case entsteht oder geladen wird, bereits auf `false`
  // gezwungen (checkCase/normalizeCase in js/store/io.js, Case-Editor), `c.tippable` allein
  // liefert hier also schon dasselbe Ergebnis wie `canTip(c)`. Das beweist aber nur die
  // Gleichheit unter dieser Invariante, nicht eine identische Funktion — eine Zusammenführung
  // hier würde sich stillschweigend auf diese Invariante verlassen, statt sie (wie `canTip`)
  // selbst durchzusetzen. Bewusst nicht zusammengeführt (docs/code-review-2026-09-21.md,
  // „packer.js:7 / io.js:7“, Vorschlag zu `canTip` in `chooseOrientation`).
  for (const orientation of pieceOrientations(piece, c)) {
    for (const rot of ROTATIONS) {
      const d = effectiveDims(c, { orientation, rot });
      if (d.dx > truck.l || d.dy > truck.w || d.dz > truck.h) continue;
      // Score-Lagenzahl auf die 4er-Grenze deckeln, die buildStacks selbst einhält
      // (stacks.items.length < 4), und auf pieceLayers(piece, c) — sonst bewertet der Score
      // flache Cases mit einer Lagenzahl, die nie zustande kommt (Befund „packer.js:10-12“).
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
// (100 % Auflage), Gewichte bekannt (> 0, 0 kg = unbekannt, eigene Entscheidung) und nicht schwerer
// als oben, keine Traversen, sonst dieselben Grenzen wie beim Stapeln (canAddToStack, 4 Lagen,
// Lagen je Stück).
function capFits(s, it, c, o, truck) {
  const base = s.items[0], top = s.items.at(-1);
  // F1 (Review 2026-09-30): nicht nur das Fundament prüfen – ein Traversenwagen kann per prevLast-
  // Auffüllen mittig in einen fremden Stapel geraten (gleiche Grundfläche); dann trägt keiner der
  // Blöcke im Stapel etwas Fremdes, auch nicht der, der oben liegt.
  if (isTruss(c) || s.items.some(x => isTruss(x.c))) return null;
  if (!(c.weight > 0) || !s.items.every(x => x.c.weight > 0)) return null;
  if (!belongsTogether(it, c, base.it, base.c)) return null;
  if (s.items.length >= 4 || !pieceLayers(it, c).includes(s.items.length + 1)) return null;
  // F5 (Review 2026-09-30): wie beim Stapel-Swap in placeStacks – ein um 90° gedrehter Deckel
  // kann die Rollenrichtung zur Tür verlieren; hier geht Grundfläche vor Rollenrichtung.
  const swapped = { ...o, rot: (o.rot + 90) % 360, d: { dx: o.d.dy, dy: o.d.dx, dz: o.d.dz } };
  for (const cand of [o, swapped]) {
    if (cand.d.dx > top.o.d.dx + 1e-6 || cand.d.dy > top.o.d.dy + 1e-6) continue;
    if (canAddToStack(s, c, cand.d.dz, truck)) return cand;
  }
  return null;
}

// Sortenrein packen: ein Block ist ein Case-Typ (caseId) PLUS Gruppe (Stück-Feld `group`, Spec
// 2026-09-30) – so lassen sich z. B. 20 von 30 gleichen Cases als „Motoren“ an die Tür schieben.
// `rules` ist die Rangliste des Loads (js/model/packRules.js); ein String 'volume'/'count' (Altdaten,
// alte Aufrufer) wird über legacyRules übersetzt und ergibt exakt die frühere Reihenfolge.
// Seit V 0.8.5 nur noch für Altdaten; neue Loads tragen `packRules`.
export const PACK_ORDERS = ['volume', 'count'];

export function orderSorts(itemList, rules = 'volume') {
  const list = typeof rules === 'string' ? legacyRules(rules) : rules;
  const groups = new Map();
  for (const it of itemList) {
    const key = `${it.caseId}\u0000${it.group ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  return [...groups.values()].sort(blockComparator(list));
}

// itemList: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Stapel entstehen je Sorte (orderSorts). Einzige Ausnahme vom „nur Gleiches auf Gleichem“: die
// nächste Sorte darf zuerst den LETZTEN noch offenen Stapel der unmittelbar vorigen Sorte
// auffüllen (Nutzerregel „Letzter Stapel darf aufgefüllt werden“) – mit denselben Grenzen wie
// immer (gleiche Grundfläche, Lagen je Stück, höchstens 4 Lagen, nichts Schweres auf Leichtes,
// maxTopLoad). Jeder Stapel trägt `sort` = Index der Sorte, die ihn begonnen hat.
export function buildStacks(itemList, truck, { order = 'volume', rules, mixTop = false } = {}) {
  const stacks = [], unplaced = [];
  const ruleList = typeof (rules ?? order) === 'string' ? legacyRules(rules ?? order) : (rules ?? order);
  const maxLayer = (it, c) => Math.max(...pieceLayers(it, c));
  const minLayer = (it, c) => Math.min(...pieceLayers(it, c));
  const fits = (s, it, c, o) => !s.capped && s.key === `${o.d.dx}x${o.d.dy}` && s.items.length < 4
    && pieceLayers(it, c).includes(s.items.length + 1) && canAddToStack(s, c, o.d.dz, truck);
  // `weight` bleibt das Gesamtgewicht des Stapels (für canAddToStack/maxTopLoad), `ownWeight`
  // zählt NUR das Gewicht der Stücke der Sorte, die den Stapel begonnen hat (Ruling F1) – so
  // sortiert placeStacks Stapel einer Sorte nicht fälschlich nach dem Gewicht, das eine SPÄTERE
  // Sorte beim Auffüllen obendrauf gesetzt hat. `mixed` markiert einen Stapel, der Stücke einer
  // späteren Sorte trägt; ein solcher Stapel steht innerhalb seiner Sorte immer zuletzt.
  const push = (s, it, c, o, own) => {
    s.items.push({ it, c, o, z: s.height });
    s.height += o.d.dz;
    s.weight += c.weight;
    if (own) s.ownWeight += c.weight; else s.mixed = true;
  };
  let prevLast = null; // letzter Stapel, in dem die vorige Sorte zuletzt etwas abgelegt hat

  orderSorts(itemList, ruleList).forEach((group, sort) => {
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
            if (s.sort >= sort || !sameSelectorRank(ruleList, s.block, group)) continue;
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
    // Ruling F4: prevLast ist wörtlich der Stapel, den DIESE Sorte begonnen oder zuletzt
    // aufgefüllt hat – nur wenn `last` tatsächlich von dieser Sorte begonnen wurde
    // (`stack.sort === sort`), darf die nächste Sorte ihn weiter auffüllen. Eine Sorte, die
    // komplett in der Ablage landet (last bleibt null) oder nur den Stapel der VORIGEN Sorte
    // aufgefüllt hat (last.sort !== sort), lässt prevLast verfallen statt es unverändert
    // weiterzureichen – sonst könnte eine übernächste Sorte eine dazwischenliegende
    // überspringen.
    prevLast = (last && last.sort === sort) ? last : null;
  });
  return { stacks, unplaced };
}

// Stellt die Stapel Sorte für Sorte (stack.sort, Reihenfolge wie von buildStacks geliefert) per
// Bottom-Left in den Truck. Jede Sorte sucht nur Punkte mit x ≥ minX: für die erste Sorte ist das
// `startX` (0 bzw. hinter einer vorhandenen Ladung), für jede weitere das x0 der letzten Reihe der
// vorigen Sorte – so füllt sie deren freie Spuren (Nutzerregel „Lücke auffüllen“), kommt aber nie
// weiter nach vorn. Innerhalb einer Sorte stehen die nach `ownWeight` schwereren Stapel weiter
// vorn, ein von der nächsten Sorte aufgefüllter (`mixed`) Stapel immer zuletzt (Ruling F1).
export function placeStacks(stacks, truck, obstacles = [], { startX = 0 } = {}) {
  const blocked = [...archBoxes(truck), ...obstacles];
  // Kein eigener Seed { x: 0, y: 0 } mehr (Ruling F5): { x: startX, y: 0 } reicht als Startpunkt,
  // ein zusätzlicher Nullpunkt war bei startX > 0 ohnehin nie ein gültiger Kandidat.
  const points = [{ x: startX, y: 0 }, ...blocked.flatMap(b => [
    { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: 0, y: b.y1 },
  ])];
  const placed = [], failed = [];
  let minX = startX;
  const sorts = [...new Set(stacks.map(s => s.sort ?? 0))];
  for (const sort of sorts) {
    // Ruling F1: NUR nach `ownWeight` (Gewicht der eigenen Sorte) sortieren, nicht nach dem
    // Gesamtgewicht – sonst würde ein von der NÄCHSTEN Sorte aufgefüllter Stapel durch das
    // zusätzliche Gewicht fälschlich nach vorn rutschen. Ein aufgefüllter (`mixed`) Stapel
    // steht innerhalb seiner Sorte außerdem immer zuletzt, unabhängig vom Gewicht.
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
        // Ruling F5: ein Punkt mit x < minX wird nicht verworfen, sondern auf minX geklemmt
        // geprüft – seine y-Koordinate (z. B. die Ecke eines weiter vorn liegenden Hindernisses)
        // bleibt so als Kandidat für eine freie Spur der aktuellen Reihe erhalten. Duplikate
        // durch die Klemmung sind unschädlich.
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

// Toleranz für „liegt auf“ (z-Versatz Oberkante Träger / Unterkante Stück), in cm.
const LAYER_EPS = 1;

// Lagen-Durchsicht (Task 2, 2026-10-04): die Lage eines Stücks steht nirgends im Packergebnis
// (result.items hat nur Boxen) – sie wird hier aus den Boxen abgeleitet statt gespeichert, damit
// kein neues Feld ins Datenmodell muss. `items`: result.items (jedes mit `id` und `box`
// {x0,y0,z0,x1,y1,z1} in cm). Von unten nach oben (nach z0 sortiert): ein Stück auf dem Boden
// (z0 < LAYER_EPS) ist Lage 1, sonst eins über der höchsten Lage seiner Träger (Oberkante des
// Trägers liegt auf LAYER_EPS genau an der eigenen Unterkante UND die Grundrisse überlappen).
// Ohne Träger (sollte nicht vorkommen, z. B. nach Verschieben von Hand) zählt es als Lage 1.
export function layersOf(items) {
  const layers = new Map();
  const sorted = [...items].sort((a, b) => a.box.z0 - b.box.z0);
  const overlapsXY = (a, b) => a.x0 < b.x1 - LAYER_EPS && b.x0 < a.x1 - LAYER_EPS
    && a.y0 < b.y1 - LAYER_EPS && b.y0 < a.y1 - LAYER_EPS;
  for (const it of sorted) {
    if (it.box.z0 < LAYER_EPS) { layers.set(it.id, 1); continue; }
    let supportLayer = 0;
    for (const other of sorted) {
      if (other === it) continue;
      if (Math.abs(other.box.z1 - it.box.z0) > LAYER_EPS) continue;
      if (!overlapsXY(other.box, it.box)) continue;
      supportLayer = Math.max(supportLayer, layers.get(other.id) ?? 0);
    }
    layers.set(it.id, supportLayer > 0 ? supportLayer + 1 : 1);
  }
  return layers;
}

// items: Stücke { id, caseId, c, label?, color?, layers?, tipped? } mit bereits aufgelöstem Case `c`.
// Die erzeugten Placements übernehmen id/label/color/layers/tipped des Stücks statt eine neue ID zu vergeben.
// order: 'volume' | 'count' (Altdaten), rules: Rangliste (packRules.js, hat Vorrang), startX: frühestes x der ersten Sorte (Rest einpacken).
export function autoPack(items, truck, { obstacles = [], order = 'volume', rules, mixTop = false, startX = 0 } = {}) {
  const { stacks, unplaced } = buildStacks(items, truck, { order, rules, mixTop });
  const { placed, failed } = placeStacks(stacks, truck, obstacles, { startX });
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
        ...(it.layers ? { layers: it.layers } : {}),
        ...(it.tipped != null ? { tipped: it.tipped } : {}),
        ...(it.group ? { group: it.group } : {}),
      });
    }
  }
  const stripCase = ({ c, ...rest }) => rest;
  const left = [...unplaced, ...failed.flatMap(s => s.items.map(i => i.it))];
  return { placements, unplaced: left.map(stripCase) };
}
