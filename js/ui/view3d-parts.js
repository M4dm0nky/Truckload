// Reine Bauteil-Geometrie der 3D-Ansicht: nur Zahlen und Boxen, kein Three.js – damit ohne WebGL
// testbar (tests/view3d-parts.test.js). Die Ansicht selbst (view3d.js) macht daraus Meshes.

// Zerlegt den Korpus eines Lautsprecher-Stacks (kind: 'speaker') in `unitH`-hohe Einzelboxen
// (z-Bereiche) – Grundlage für die Trennlinien und die Grille-Andeutung je Einzelbox. Ohne
// `unitH` (z. B. eine einzelne Box ohne Dolly, falls ein alter Ladeplan sie noch lose
// referenziert) bleibt es bei einer einzigen Einheit über die volle Höhe.
export function speakerUnits(body, unitH) {
  const total = body.z1 - body.z0;
  const n = unitH > 0 ? Math.max(1, Math.round(total / unitH)) : 1;
  const h = total / n;
  return Array.from({ length: n }, (_, i) => ({ z0: body.z0 + i * h, z1: body.z0 + (i + 1) * h }));
}
// Offener Rahmen im Dolly-Bereich (zwischen Boden und Korpus-Unterkante `dollyZ1`) – echtes
// Vorbild: L-Acoustics K2-CHARIOT (offizielles Produktfoto), ein offener Rechteckrahmen aus
// Vierkantrohr, keine durchgehende Platte. Reicht über den vollen Fußabdruck `box` (nicht nur
// `body`), damit er unter dem Korpus sichtbar hervorsteht wie beim echten Dolly.
export function speakerDollyFrame(box, dollyZ1) {
  const t = 2.2;
  const z1 = Math.max(box.z0 + 0.1, dollyZ1 - 1);
  const z0 = Math.max(box.z0, z1 - t);
  return [
    { x0: box.x0, x1: box.x1, y0: box.y0, y1: box.y0 + t, z0, z1 },
    { x0: box.x0, x1: box.x1, y0: box.y1 - t, y1: box.y1, z0, z1 },
    { x0: box.x0, x1: box.x0 + t, y0: box.y0, y1: box.y1, z0, z1 },
    { x0: box.x1 - t, x1: box.x1, y0: box.y0, y1: box.y1, z0, z1 },
  ];
}
// Anbauteile EINER Lautsprecher-Box in lokalen cm-Koordinaten (Breite W entlang x, Tiefe D
// entlang y mit der Front bei y = −D/2, Höhe H entlang z, alles um den Nullpunkt). Jedes Teil
// trägt statt eines Materials einen Schlüssel `matKey` (grille, mullion, badge, rig), den die
// 3D-Ansicht ihrem Material zuordnet. Vorbild:
// Nutzer-Foto L-Acoustics K2. Alles bleibt (bis auf wenige mm) innerhalb der Bounding-Box.
// - Front: helleres Grillefeld, eingerückt im Gehäuserahmen; ab 100 cm Breite zwei Felder mit
//   dunklem Mittelsteg (K2/KS28) und je ein Marken-Badge auf dem unteren Rahmen.
// - Seiten: Rigging-Platte im vorderen Bereich + waagrechte Griffstange.
export function speakerUnitParts(W, D, H) {
  const out = [];
  const mX = Math.min(4, W * 0.06), mZ = Math.min(3, H * 0.12);
  const fy = -D / 2;
  out.push({ b: { x0: -W / 2 + mX, x1: W / 2 - mX, y0: fy - 0.3, y1: fy + 0.3, z0: -H / 2 + mZ, z1: H / 2 - mZ }, matKey: 'grille' });
  const wide = W >= 100;
  if (wide) {
    const mw = Math.min(8, W * 0.06);
    out.push({ b: { x0: -mw / 2, x1: mw / 2, y0: fy - 0.6, y1: fy + 0.2, z0: -H / 2 + mZ, z1: H / 2 - mZ }, matKey: 'mullion' });
  }
  const bw = Math.min(3, W * 0.04), bh = Math.min(1.6, mZ * 0.7);
  for (const bx of wide ? [-W / 4, W / 4] : [0]) {
    out.push({ b: { x0: bx - bw / 2, x1: bx + bw / 2, y0: fy - 0.5, y1: fy + 0.1, z0: -H / 2 + mZ / 2 - bh / 2, z1: -H / 2 + mZ / 2 + bh / 2 }, matKey: 'badge' });
  }
  const hz = Math.min(1.2, H * 0.06);
  for (const sx of [-1, 1]) {
    const edge = sx * W / 2;
    out.push({ b: { x0: Math.min(edge - sx * 1.2, edge + sx * 0.2), x1: Math.max(edge - sx * 1.2, edge + sx * 0.2), y0: fy, y1: fy + D * 0.55, z0: -H * 0.42, z1: H * 0.42 }, matKey: 'rig' });
    out.push({ b: { x0: Math.min(edge + sx * 0.2, edge + sx * 1.1), x1: Math.max(edge + sx * 0.2, edge + sx * 1.1), y0: -D * 0.05, y1: D * 0.3, z0: -hz, z1: hz }, matKey: 'mullion' });
  }
  return out;
}

// Die 12 Kanten eines Korpus als Alu-Profilstäbe (3×3 cm, leicht über die Flächen hinausstehend).
export function edgeBars(b, out) {
  const t = 1.5, ext = 0.3;
  for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1])
    out.push({ x0: b.x0 - ext, x1: b.x1 + ext, y0: y - t, y1: y + t, z0: z - t, z1: z + t });
  for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1])
    out.push({ x0: x - t, x1: x + t, y0: b.y0 - ext, y1: b.y1 + ext, z0: z - t, z1: z + t });
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1])
    out.push({ x0: x - t, x1: x + t, y0: y - t, y1: y + t, z0: b.z0 - ext, z1: b.z1 + ext });
}

// Butterfly-Verschlüsse auf dem Deckelfuge-Band: 2 auf den Längsseiten (y0/y1), 1 auf jeder
// Stirnseite (x0/x1) – analog zur 2D-Darstellung (Ansicht 'side'/'rear').
export function latchBoxes(b, zSeam, out) {
  const hw = 2, d = 0.9, hh = 1.5;
  for (const fx of [0.25, 0.75]) {
    const cx = b.x0 + (b.x1 - b.x0) * fx;
    out.push({ x0: cx - hw, x1: cx + hw, y0: b.y0 - d, y1: b.y0 + 0.3, z0: zSeam - hh, z1: zSeam + hh });
    out.push({ x0: cx - hw, x1: cx + hw, y0: b.y1 - 0.3, y1: b.y1 + d, z0: zSeam - hh, z1: zSeam + hh });
  }
  const cy = (b.y0 + b.y1) / 2;
  out.push({ x0: b.x0 - d, x1: b.x0 + 0.3, y0: cy - hw, y1: cy + hw, z0: zSeam - hh, z1: zSeam + hh });
  out.push({ x0: b.x1 - 0.3, x1: b.x1 + d, y0: cy - hw, y1: cy + hw, z0: zSeam - hh, z1: zSeam + hh });
}

export function trussPoint(lenAxis, widAxis, lenVal, widVal, z) {
  const p = { x: 0, y: 0, z };
  p[lenAxis] = lenVal;
  p[widAxis] = widVal;
  return p;
}
export function faceZigzag(lenAxis, widAxis, len0, len1, cornerA, cornerB, profileWidth, r, out) {
  const length = len1 - len0;
  const segs = Math.max(1, Math.round(length / Math.max(profileWidth, 1)));
  const step = length / segs;
  const at = (chord, i) => trussPoint(lenAxis, widAxis, len0 + i * step, chord.w, chord.z);
  for (let i = 0; i < segs; i++) {
    const [from, to] = i % 2 === 0 ? [cornerA, cornerB] : [cornerB, cornerA];
    out.push({ p1: at(from, i), p2: at(to, i + 1), r });
  }
}
