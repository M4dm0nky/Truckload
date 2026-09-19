import { wheelFace, wheelHOf } from './geometry.js';

// Zerlegt die Box eines platzierten Cases in Korpus und 4 Rollen (Truck-Koordinaten, cm).
export function caseShape(c, p, box) {
  const wh = wheelHOf(c);
  const face = wheelFace(p);
  if (wh <= 0) return { body: box, wheels: [], face: null };
  const body = { ...box };
  if (face === 'bottom') body.z0 += wh;
  else if (face === '+x') body.x1 -= wh;
  else if (face === '-x') body.x0 += wh;
  else if (face === '+y') body.y1 -= wh;
  else if (face === '-y') body.y0 += wh;
  const d = wh * 0.8;                  // Raddurchmesser, Rest = Gabel/Platte
  const inset = Math.max(3, d * 0.4);  // Abstand von der Case-Ecke
  // Die zwei Achsen in der Rollenfläche + Lage des Rollenstreifens entlang der Normalen
  const [a1, a2, n] = face === 'bottom' ? ['x', 'y', 'z'] : face.endsWith('x') ? ['y', 'z', 'x'] : ['x', 'z', 'y'];
  const slab0 = face === 'bottom' ? box.z0 : face[0] === '+' ? box[`${n}1`] - wh : box[`${n}0`];
  const pos = (axis, end) => (end ? box[`${axis}1`] - inset - d : box[`${axis}0`] + inset);
  const wheels = [];
  for (const e1 of [0, 1]) for (const e2 of [0, 1]) {
    const w = {};
    w[`${a1}0`] = pos(a1, e1); w[`${a1}1`] = w[`${a1}0`] + d;
    w[`${a2}0`] = pos(a2, e2); w[`${a2}1`] = w[`${a2}0`] + d;
    w[`${n}0`] = slab0; w[`${n}1`] = slab0 + wh;
    wheels.push(w);
  }
  return { body, wheels, face };
}
