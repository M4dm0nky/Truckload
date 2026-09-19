export function project(b, mode, truck) {
  switch (mode) {
    case 'top':  return { u0: b.x0, u1: b.x1, v0: truck.w - b.y1, v1: truck.w - b.y0 };
    case 'side': return { u0: b.x0, u1: b.x1, v0: truck.h - b.z1, v1: truck.h - b.z0 };
    case 'rear': return { u0: b.y0, u1: b.y1, v0: truck.h - b.z1, v1: truck.h - b.z0 };
    default: throw new Error(`Unbekannte Ansicht: ${mode}`);
  }
}

export function unproject(u, v, mode, truck) {
  if (mode !== 'top') throw new Error('unproject nur für die Draufsicht');
  return { x: u, y: truck.w - v };
}

const ORDER_KEY = {
  top: it => it.box.z0,     // obere Lagen zuletzt
  side: it => -it.box.y0,   // Betrachter bei y<0: kleine y zuletzt
  rear: it => it.box.x0,    // Betrachter an der Tür: große x zuletzt
};
export const drawOrder = (items, mode) => [...items].sort((a, b) => ORDER_KEY[mode](a) - ORDER_KEY[mode](b));

const STRIP = {
  top:  { '+x': 'u1', '-x': 'u0', '+y': 'v0', '-y': 'v1' },
  side: { '+x': 'u1', '-x': 'u0', bottom: 'v1' },
  rear: { '+y': 'u1', '-y': 'u0', bottom: 'v1' },
};
export const wheelStrip = (mode, face) => STRIP[mode][face] ?? null;

export function stripRect(r, side, t) {
  const w = r.u1 - r.u0, h = r.v1 - r.v0;
  switch (side) {
    case 'u0': return { x: r.u0, y: r.v0, width: t, height: h };
    case 'u1': return { x: r.u1 - t, y: r.v0, width: t, height: h };
    case 'v0': return { x: r.u0, y: r.v0, width: w, height: t };
    case 'v1': return { x: r.u0, y: r.v1 - t, width: w, height: t };
    default: throw new Error(`Unbekannte Seite: ${side}`);
  }
}
