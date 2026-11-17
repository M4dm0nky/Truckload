// Reihenplaner („Reihen planen“, Spec 2026-11-17-dicht-laden-design.md): stellt fertige Stapel
// Reihe für Reihe auf den Boden und füllt die Restbreite jeder Reihe mit Stapeln späterer Sorten
// desselben Gewerks (belongsTogether). Gleiche Rückgabeform wie placeStacks.
import { isTruss, archBoxes, overlaps } from './geometry.js';
import { belongsTogether } from './packer.js';

const EPS = 1e-6;
const hasTruss = s => s.items.some(i => isTruss(i.c));
const sortOf = s => s.sort ?? 0;
const better = (a, b) => !b || a.area > b.area || (a.area === b.area && (a.dist < b.dist || (a.dist === b.dist && a.n < b.n)));

export function planRows(stacks, truck, obstacles = [], { startX = 0 } = {}) {
  const blocked = [...archBoxes(truck), ...obstacles];
  const placed = [], failed = [];
  // Rangliste, je Sorte nach ownWeight absteigend, `mixed` zuletzt (wie placeStacks).
  let pool = [...stacks].sort((a, b) => sortOf(a) - sortOf(b) || (a.mixed ? 1 : 0) - (b.mixed ? 1 : 0)
    || (b.ownWeight ?? b.weight) - (a.ownWeight ?? a.weight));
  let failedShapes = [];

  // Kleinstes y ≥ yMin, an dem ein Kasten dx × dy bei x frei steht (Spurraster an Hindernis-Kanten).
  const scan = (x, dx, dy, yMin, h) => {
    if (x + dx > truck.l + EPS) return null;
    const local = blocked.filter(b => b.x0 < x + dx - EPS && b.x1 > x + EPS);
    const ys = [...new Set([yMin, ...local.map(b => b.y1).filter(y => y > yMin)])].sort((a, b) => a - b);
    for (const y of ys) {
      if (y + dy > truck.w + EPS) break;
      const box = { x0: x, y0: y, z0: 0, x1: x + dx, y1: y + dy, z1: h };
      if (!local.some(b => overlaps(b, box))) return box;
    }
    return null;
  };
  const place = (s, x, yMin) => {
    let hit = null;
    for (const swap of s.dx === s.dy ? [false] : [false, true]) {
      const box = scan(x, swap ? s.dy : s.dx, swap ? s.dx : s.dy, yMin, s.height);
      if (box && (!hit || box.y0 < hit.box.y0 - EPS)) hit = { box, swap };
    }
    return hit;
  };
  // Rückfall (Hindernisse): freie Eckensuche ab x0, wie placeStacks.
  const corner = (s, x0) => {
    const pts = [{ x: x0, y: 0 }, ...blocked.flatMap(b => [
      { x: b.x1, y: b.y0 }, { x: b.x0, y: b.y1 }, { x: b.x1, y: 0 }, { x: x0, y: b.y1 }])]
      .map(p => (p.x < x0 ? { x: x0, y: p.y } : p)).sort((p, q) => p.x - q.x || p.y - q.y);
    for (const p of pts) for (const swap of s.dx === s.dy ? [false] : [false, true]) {
      const dx = swap ? s.dy : s.dx, dy = swap ? s.dx : s.dy;
      const box = { x0: p.x, y0: p.y, z0: 0, x1: p.x + dx, y1: p.y + dy, z1: s.height };
      if (box.x1 <= truck.l + EPS && box.y1 <= truck.w + EPS && !blocked.some(b => overlaps(b, box))) return { box, swap };
    }
    return null;
  };
  const take = (s, hit, rowBoxes) => {
    blocked.push(hit.box);
    rowBoxes.push(hit.box);
    placed.push({ stack: s, ...hit });
    pool = pool.filter(p => p !== s);
    failedShapes = [];
  };
  const drop = s => { failed.push(s); pool = pool.filter(p => p !== s); };

  // Beste Füllung der Restbreite: Rucksack über ganzzahlige cm-Breiten, Kandidaten je Grundfläche
  // gebündelt (höchstens so viele Stapel je Grundfläche, wie in die Restbreite passen). Je Reihentiefe D
  // (größte Tiefe der Reihe) maximiert er die belegte Fläche; Bewertung = freie Fläche der Reihe,
  // Gleichstand: kleinere Ranglisten-Distanz, dann weniger Stapel.
  const pickFillers = (cands, wRem, leadDepth, leadArea, leadSort) => {
    const groups = new Map();
    for (const s of cands) {
      const key = [s.dx, s.dy].sort((a, b) => a - b).join('x');
      const g = groups.get(key) ?? [];
      if (g.length < Math.floor(wRem / Math.min(s.dx, s.dy) + EPS)) groups.set(key, [...g, s]);
    }
    const units = [...groups.values()].flat().map(s => ({
      s, dist: sortOf(s) - leadSort,
      opts: (s.dx === s.dy ? [false] : [false, true]).map(swap => ({
        swap, dx: swap ? s.dy : s.dx, dy: swap ? s.dx : s.dy, wd: Math.ceil((swap ? s.dx : s.dy) - EPS) })),
    }));
    const W = Math.floor(wRem + EPS);
    const depths = [...new Set([leadDepth, ...units.flatMap(u => u.opts.map(o => o.dx)).filter(d => d > leadDepth)])];
    let best = null;
    for (const D of depths) {
      const dp = new Array(W + 1).fill(null);
      dp[0] = { area: 0, dist: 0, n: 0, picks: [] };
      for (const u of units) {
        const opts = u.opts.filter(o => o.dx <= D + EPS && o.wd <= W);
        if (!opts.length) continue;
        for (let w = W; w >= 1; w--) for (const o of opts) {
          const prev = o.wd <= w ? dp[w - o.wd] : null;
          if (!prev) continue;
          const cand = { area: prev.area + o.dx * o.dy, dist: prev.dist + u.dist, n: prev.n + 1, picks: [...prev.picks, { s: u.s, o }] };
          if (better(cand, dp[w])) dp[w] = cand;
        }
      }
      for (const c of dp) {
        if (!c || !c.n) continue;
        const depth = Math.max(leadDepth, ...c.picks.map(p => p.o.dx));
        const cand = { picks: c.picks, free: depth * truck.w - leadArea - c.area, dist: c.dist, n: c.n };
        if (!best || cand.free < best.free - EPS || (Math.abs(cand.free - best.free) <= EPS
          && (cand.dist < best.dist || (cand.dist === best.dist && cand.n < best.n)))) best = cand;
      }
    }
    return best && best.free < leadDepth * truck.w - leadArea - EPS ? best.picks : [];
  };

  let rowEnd = startX;
  while (pool.length) {
    const x0 = Math.max(startX, rowEnd);
    if (x0 >= truck.l - EPS) { failed.push(...pool); break; }
    const leadSort = sortOf(pool[0]);
    const rowBoxes = [], rowStacks = [];
    for (const s of pool.filter(p => sortOf(p) === leadSort)) {
      if (failedShapes.some(f => f.h <= s.height + EPS && ((f.dx === s.dx && f.dy === s.dy) || (f.dx === s.dy && f.dy === s.dx)))) {
        drop(s); continue;
      }
      const hit = place(s, x0, 0) ?? (rowBoxes.length ? null : corner(s, x0));
      if (hit) { take(s, hit, rowBoxes); rowStacks.push(s); continue; }
      if (rowBoxes.length) break;                       // Reihe voll: Rest der Sorte kommt in die nächste
      drop(s);
      failedShapes.push({ dx: s.dx, dy: s.dy, h: s.height });
    }
    if (rowBoxes.length && rowBoxes.every(b => b.x0 <= x0 + EPS) && !rowStacks.some(hasTruss)) {
      const rep = rowStacks[0].items[0];
      const cands = pool.filter(s => sortOf(s) > leadSort && !hasTruss(s) && belongsTogether(rep.it, rep.c, s.items[0].it, s.items[0].c));
      const yStart = Math.max(...rowBoxes.map(b => b.y1));
      if (cands.length && truck.w - yStart > EPS) {
        const leadDepth = Math.max(...rowBoxes.map(b => b.x1 - x0));
        const leadArea = rowBoxes.reduce((a, b) => a + (b.x1 - b.x0) * (b.y1 - b.y0), 0);
        let cursor = yStart;
        for (const { s, o } of pickFillers(cands, truck.w - yStart, leadDepth, leadArea, leadSort)) {
          const box = scan(x0, o.dx, o.dy, cursor, s.height);
          if (!box) continue;                           // Hindernis: Stapel bleibt offen für spätere Reihen
          take(s, { box, swap: o.swap }, rowBoxes);
          cursor = box.y1;
        }
      }
    }
    if (rowBoxes.length) rowEnd = Math.max(...rowBoxes.map(b => b.x1));
  }
  return { placed, failed };
}
