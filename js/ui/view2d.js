import { svgEl } from './dom.js';
import { project, drawOrder, wheelStrip, stripRect } from './projection.js';
import { wheelFace } from '../model/geometry.js';
import { archBoxes } from '../model/validate.js';

const PAD = 30;

export function renderView(svg, mode, { truck, result, selectedId, labels = true }) {
  svg.replaceChildren();
  const W = mode === 'rear' ? truck.w : truck.l;
  const H = mode === 'top' ? truck.w : truck.h;
  svg.setAttribute('viewBox', `${-PAD} ${-PAD} ${W + 2 * PAD} ${H + 2 * PAD}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'truck' }, svg);
  const grid = svgEl('g', { class: 'grid' }, svg);
  for (let u = 100; u < W; u += 100) {
    svgEl('line', { x1: u, y1: 0, x2: u, y2: H }, grid);
    svgEl('text', { x: u, y: -10, class: 'tick' }, grid).textContent = `${u / 100} m`;
  }
  if (mode !== 'rear') svgEl('line', { x1: 0, y1: 0, x2: 0, y2: H, class: 'front-wall' }, svg);

  for (const a of archBoxes(truck)) {
    if (mode === 'side' && a.y0 > 0) continue; // Seitenansicht zeigt nur den linken Radkasten
    const r = project(a, mode, truck);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'arch' }, svg);
  }

  for (const it of drawOrder(result.items, mode)) {
    const r = project(it.box, mode, truck);
    const cls = ['case', result.byPlacement.has(it.id) && 'bad', it.id === selectedId && 'sel'].filter(Boolean).join(' ');
    const g = svgEl('g', { class: cls, 'data-id': it.id }, svg);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, fill: it.c.color, class: 'body' }, g);
    const side = wheelStrip(mode, wheelFace(it.p));
    if (side) svgEl('rect', { ...stripRect(r, side, 6), class: 'wheels' }, g);
    if (labels) svgEl('text', { x: (r.u0 + r.u1) / 2, y: (r.v0 + r.v1) / 2, class: 'label' }, g)
      .textContent = result.sequence.get(it.id);
    svgEl('title', {}, g).textContent =
      `${result.sequence.get(it.id)}. ${it.c.name}${it.c.content ? ` – ${it.c.content}` : ''}`;
  }

  const cog = result.totals.cog;
  if (mode === 'top' && cog) svgEl('circle', { cx: cog.x, cy: truck.w - cog.y, r: 12, class: 'cog' }, svg)
    .appendChild(svgEl('title')).textContent = 'Schwerpunkt';
}
