import { svgEl } from './dom.js';
import { project, unproject, drawOrder, wheelView } from './projection.js';
import { wheelFace } from '../model/geometry.js';
import { caseShape } from '../model/caseShape.js';
import { caseColors } from './caseStyle.js';
import { archBoxes } from '../model/validate.js';

const PAD = 30;

function drawWheel(g, box, mode, truck, fork) {
  const r = project(box, mode, truck);
  const cx = (r.u0 + r.u1) / 2, cy = (r.v0 + r.v1) / 2;
  const radius = Math.min(r.u1 - r.u0, r.v1 - r.v0) / 2;
  if (fork) svgEl('line', { x1: cx, y1: cy, x2: fork.x, y2: fork.y, class: 'fork' }, g);
  svgEl('circle', { cx, cy, r: radius, class: 'wheel' }, g);
  svgEl('circle', { cx, cy, r: radius / 3, class: 'hub' }, g);
}

// Punkt am Rand des Korpus-Rechtecks, dem die Rolle am nächsten liegt (für die Gabel-Linie).
function nearestEdgePoint(bodyRect, cx, cy) {
  const { u0, u1, v0, v1 } = bodyRect;
  const x = Math.min(Math.max(cx, u0), u1);
  const y = Math.min(Math.max(cy, v0), v1);
  const dLeft = Math.abs(x - u0), dRight = Math.abs(u1 - x), dTop = Math.abs(y - v0), dBot = Math.abs(v1 - y);
  const m = Math.min(dLeft, dRight, dTop, dBot);
  if (m === dLeft) return { x: u0, y };
  if (m === dRight) return { x: u1, y };
  if (m === dTop) return { x, y: v0 };
  return { x, y: v1 };
}

function drawCase(g, it, mode, truck, { colorMode, labels }) {
  const r = project(it.box, mode, truck);
  svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'hit' }, g);

  const face = wheelFace(it.p);
  const { body, wheels } = caseShape(it.c, it.p, it.box);
  const bodyRect = project(body, mode, truck);
  const view = wheels.length ? wheelView(mode, face) : 'hidden';

  if (view === 'edge') for (const w of wheels) {
    const wr = project(w, mode, truck);
    const fork = nearestEdgePoint(bodyRect, (wr.u0 + wr.u1) / 2, (wr.v0 + wr.v1) / 2);
    drawWheel(g, w, mode, truck, fork);
  }

  const colors = caseColors(it.c, colorMode);
  svgEl('rect', {
    x: bodyRect.u0, y: bodyRect.v0, width: bodyRect.u1 - bodyRect.u0, height: bodyRect.v1 - bodyRect.v0,
    fill: colors.body, class: 'body', rx: 2,
  }, g);

  if (view === 'facing') for (const w of wheels) drawWheel(g, w, mode, truck, null);

  if (colors.stripe) {
    const w = bodyRect.u1 - bodyRect.u0;
    svgEl('rect', {
      x: bodyRect.u0 + 6, y: bodyRect.v0 + 6, width: Math.max(0, w - 12), height: 7,
      fill: colors.stripe, class: 'stripe',
    }, g);
  }

  for (const [cx, cy] of [
    [bodyRect.u0, bodyRect.v0], [bodyRect.u1, bodyRect.v0],
    [bodyRect.u0, bodyRect.v1], [bodyRect.u1, bodyRect.v1],
  ]) svgEl('circle', { cx, cy, r: 4, class: 'corner' }, g);

  if (mode !== 'top' && face === 'bottom') {
    const h = bodyRect.v1 - bodyRect.v0, w = bodyRect.u1 - bodyRect.u0;
    const y = bodyRect.v0 + h * 0.22;
    svgEl('line', { x1: bodyRect.u0, y1: y, x2: bodyRect.u1, y2: y, class: 'seam' }, g);
    for (const cx of [bodyRect.u0 + w / 4, bodyRect.u0 + (w * 3) / 4])
      svgEl('rect', { x: cx - 3, y: y - 2.5, width: 6, height: 5, class: 'latch' }, g);
  }

  if (labels) svgEl('text', { x: (bodyRect.u0 + bodyRect.u1) / 2, y: (bodyRect.v0 + bodyRect.v1) / 2, class: 'label' }, g)
    .textContent = it.seq;
  svgEl('title', {}, g).textContent = it.title;
}

export function renderView(svg, mode, { truck, result, selectedId, labels = true, colorMode = 'black' }) {
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
    const bad = result.byPlacement.has(it.id);
    const cls = ['case', bad && 'bad', it.id === selectedId && 'sel'].filter(Boolean).join(' ');
    const g = svgEl('g', { class: cls, 'data-id': it.id }, svg);
    drawCase(g, {
      ...it,
      seq: result.sequence.get(it.id),
      title: `${result.sequence.get(it.id)}. ${it.c.name}${it.c.content ? ` – ${it.c.content}` : ''}`,
    }, mode, truck, { colorMode, labels });
    if (bad) {
      const r = project(it.box, mode, truck);
      svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'alert' }, g);
    }
  }

  const cog = result.totals.cog;
  if (mode === 'top' && cog) svgEl('circle', { cx: cog.x, cy: truck.w - cog.y, r: 12, class: 'cog' }, svg)
    .appendChild(svgEl('title')).textContent = 'Schwerpunkt';
}

function toSvg(svg, e) {
  return new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
}

export function attachSelect(svg, onSelect) {
  svg.addEventListener('pointerdown', e => onSelect(e.target.closest('g.case')?.dataset.id ?? null));
}

export function attachTopInteractions(svg, h) {
  let drag = null;
  const truckPt = e => { const p = toSvg(svg, e); return unproject(p.x, p.y, 'top', h.getTruck()); };

  svg.addEventListener('pointerdown', e => {
    const id = e.target.closest('g.case')?.dataset.id ?? null;
    h.onSelect(id);
    if (!id) return;
    const it = h.getItem(id);
    const pt = truckPt(e);
    drag = { id, offX: pt.x - it.box.x0, offY: pt.y - it.box.y0, sx: e.clientX, sy: e.clientY, moved: false };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 4) return;
      drag.moved = true;
      h.onDragStart();
    }
    const pt = truckPt(e);
    h.onDrag(drag.id, pt.x - drag.offX, pt.y - drag.offY);
  });
  const end = () => { drag = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  svg.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('text/x-case')) return;
    e.preventDefault();
    svg.classList.add('drop-target');
  });
  svg.addEventListener('dragleave', () => svg.classList.remove('drop-target'));
  svg.addEventListener('drop', e => {
    e.preventDefault();
    svg.classList.remove('drop-target');
    const raw = e.dataTransfer.getData('text/x-case');
    if (!raw) return;
    const pt = truckPt(e);
    h.onDropCase(JSON.parse(raw), pt.x, pt.y);
  });
}
