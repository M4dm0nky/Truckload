import { svgEl } from './dom.js';
import { project, unproject, drawOrder, wheelView } from './projection.js';
import { wheelFace } from '../model/geometry.js';
import { caseShape } from '../model/caseShape.js';
import { caseColors } from './caseStyle.js';
import { archBoxes } from '../model/validate.js';
import { isTruss, trussShape } from '../model/truss.js';

const PAD = 30;
const FRAME_W = 3.5;      // cm, Breite des Alu-Hybridprofils
const DETAIL_MIN = 40;    // cm, ab dieser Korpus-Kantenlänge werden Details gezeichnet

// Beschriftung: Schriftgröße aus der kleineren Korpus-Rechteckseite abgeleitet, auf 6–16 cm begrenzt.
const LABEL_MIN = 6;
const LABEL_MAX = 16;
const LABEL_RATIO = 0.32;
const LABEL_PAD = 3;

// Verlaufs-/Musterdefinitionen einmal pro <svg>-Element anlegen (IDs an das Element gebunden,
// damit mehrere gleichzeitig sichtbare Ansichten – App + Druck – sich nicht überschreiben).
let uidSeq = 0;
function svgUid(svg) {
  if (!svg.dataset.tlUid) svg.dataset.tlUid = `tl${uidSeq++}`;
  return svg.dataset.tlUid;
}
function addDefs(svg, uid) {
  const defs = svgEl('defs', {}, svg);
  const alu = svgEl('linearGradient', { id: `${uid}-alu`, x1: '0%', y1: '0%', x2: '100%', y2: '100%' }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#eef1f4' }, alu);
  svgEl('stop', { offset: '55%', 'stop-color': '#aeb6bf' }, alu);
  svgEl('stop', { offset: '100%', 'stop-color': '#7b838f' }, alu);

  const ball = svgEl('radialGradient', { id: `${uid}-corner`, cx: '35%', cy: '30%', r: '70%' }, defs);
  svgEl('stop', { offset: '0%', 'stop-color': '#ffffff' }, ball);
  svgEl('stop', { offset: '35%', 'stop-color': '#cfd4da' }, ball);
  svgEl('stop', { offset: '100%', 'stop-color': '#787f88' }, ball);

  const lam = svgEl('pattern', { id: `${uid}-lam`, width: 5, height: 5, patternUnits: 'userSpaceOnUse' }, defs);
  svgEl('circle', { cx: 1.2, cy: 1.2, r: 0.5, fill: '#ffffff', 'fill-opacity': 0.06 }, lam);
  svgEl('circle', { cx: 3.6, cy: 3.6, r: 0.5, fill: '#ffffff', 'fill-opacity': 0.06 }, lam);
}

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

// Traversenwagen: zwei Rollwagen an den Enden + gestapelte Traversenstücke. In jeder Ansicht wird
// pro Stück anhand der projizierten Seitenlängen entschieden, ob es „längs“ (Ober-/Untergurt-Linien
// mit Zickzack-Diagonalen) oder „stirnseitig“ (Quadrat mit 4 Gurtrohr-Kreisen) erscheint – dadurch
// funktioniert dieselbe Logik in allen drei Ansichten und für beide Rotationen (Länge entlang x oder y).
const TUBE_R_RATIO = 0.085; // Gurtrohr-Radius = Traversenbreite × Faktor (siehe js/model/truss.js)

function drawChordBar(g, pr, horizontal, profileWidth) {
  const inset = Math.max(1.5, Math.min(profileWidth * TUBE_R_RATIO, (horizontal ? pr.v1 - pr.v0 : pr.u1 - pr.u0) / 2));
  if (horizontal) {
    const y0 = pr.v0 + inset, y1 = pr.v1 - inset;
    svgEl('line', { x1: pr.u0, y1: y0, x2: pr.u1, y2: y0, class: 'truss-chord' }, g);
    svgEl('line', { x1: pr.u0, y1: y1, x2: pr.u1, y2: y1, class: 'truss-chord' }, g);
    const len = pr.u1 - pr.u0;
    const segs = Math.max(1, Math.round(len / Math.max(profileWidth, 1)));
    const step = len / segs;
    const pts = [];
    for (let i = 0; i <= segs; i++) pts.push(`${pr.u0 + i * step},${i % 2 === 0 ? y0 : y1}`);
    svgEl('polyline', { points: pts.join(' '), class: 'truss-diag' }, g);
  } else {
    const x0 = pr.u0 + inset, x1 = pr.u1 - inset;
    svgEl('line', { x1: x0, y1: pr.v0, x2: x0, y2: pr.v1, class: 'truss-chord' }, g);
    svgEl('line', { x1: x1, y1: pr.v0, x2: x1, y2: pr.v1, class: 'truss-chord' }, g);
    const len = pr.v1 - pr.v0;
    const segs = Math.max(1, Math.round(len / Math.max(profileWidth, 1)));
    const step = len / segs;
    const pts = [];
    for (let i = 0; i <= segs; i++) pts.push(`${i % 2 === 0 ? x0 : x1},${pr.v0 + i * step}`);
    svgEl('polyline', { points: pts.join(' '), class: 'truss-diag' }, g);
  }
}

function drawEndSquare(g, pr, profileWidth) {
  svgEl('rect', { x: pr.u0, y: pr.v0, width: pr.u1 - pr.u0, height: pr.v1 - pr.v0, class: 'truss-end' }, g);
  const cr = Math.max(1.5, profileWidth * TUBE_R_RATIO);
  for (const [cx, cy] of [[pr.u0, pr.v0], [pr.u1, pr.v0], [pr.u0, pr.v1], [pr.u1, pr.v1]])
    svgEl('circle', { cx, cy, r: cr, class: 'truss-tube' }, g);
}

function drawTruss(g, it, mode, truck, colorMode) {
  const { c, p, box } = it;
  const shape = trussShape(c, p, box);
  const markColor = it.color ?? c.color;

  const outline = project(box, mode, truck);
  svgEl('rect', {
    x: outline.u0, y: outline.v0, width: outline.u1 - outline.u0, height: outline.v1 - outline.v0,
    class: 'body truss-frame', fill: 'none', rx: 2,
  }, g);

  for (const d of shape.dollies) {
    const dr = project(d, mode, truck);
    svgEl('rect', { x: dr.u0, y: dr.v0, width: dr.u1 - dr.u0, height: dr.v1 - dr.v0, class: 'truss-dolly' }, g);
    if (markColor) svgEl('rect', {
      x: dr.u0 + 2, y: dr.v0 + 2, width: Math.max(0, dr.u1 - dr.u0 - 4), height: 3,
      class: 'truss-mark', style: `fill:${markColor}`,
    }, g);
  }
  for (const w of shape.wheels) drawWheel(g, w, mode, truck, null);

  const profileWidth = c.truss.width;
  for (const pc of shape.pieces) {
    const pr = project(pc, mode, truck);
    const uSpan = pr.u1 - pr.u0, vSpan = pr.v1 - pr.v0;
    if (uSpan >= vSpan * 1.3) drawChordBar(g, pr, true, profileWidth);
    else if (vSpan >= uSpan * 1.3) drawChordBar(g, pr, false, profileWidth);
    else drawEndSquare(g, pr, profileWidth);
  }
  return shape;
}

// Fallback-Form für Cases, deren Korpusfläche für Details zu klein ist.
function drawSimpleBody(g, bodyRect, colors) {
  svgEl('rect', {
    x: bodyRect.u0, y: bodyRect.v0, width: bodyRect.u1 - bodyRect.u0, height: bodyRect.v1 - bodyRect.v0,
    fill: colors.body, class: 'body', rx: 2,
  }, g);
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
}

// Flightcase-Look: Alu-Hybridprofil, Laminat-Korpus, Kugelecken, Deckelfuge mit Butterfly-
// Verschlüssen und Schalengriffen. Details nur ab Korpusbreite ≥ DETAIL_MIN, sonst wie drawSimpleBody.
function drawFlightcaseBody(g, bodyRect, colors, mode, face, colorMode, uid, detailed) {
  const bw = bodyRect.u1 - bodyRect.u0, bh = bodyRect.v1 - bodyRect.v0;
  if (!detailed) return drawSimpleBody(g, bodyRect, colors);

  svgEl('rect', {
    x: bodyRect.u0, y: bodyRect.v0, width: bw, height: bh,
    class: 'body framed', style: `fill:url(#${uid}-alu)`, rx: 2,
  }, g);
  const iw = Math.max(0, bw - 2 * FRAME_W), ih = Math.max(0, bh - 2 * FRAME_W);
  svgEl('rect', {
    x: bodyRect.u0 + FRAME_W, y: bodyRect.v0 + FRAME_W, width: iw, height: ih,
    fill: colors.body, class: 'corpus', rx: 1,
  }, g);
  if (colorMode === 'black') svgEl('rect', {
    x: bodyRect.u0 + FRAME_W, y: bodyRect.v0 + FRAME_W, width: iw, height: ih,
    class: 'lam', style: `fill:url(#${uid}-lam)`, rx: 1,
  }, g);

  if (colors.stripe) svgEl('rect', {
    x: bodyRect.u0 + FRAME_W + 6, y: bodyRect.v0 + FRAME_W + 6, width: Math.max(0, iw - 12), height: 7,
    fill: colors.stripe, class: 'stripe',
  }, g);

  for (const [cx, cy] of [
    [bodyRect.u0, bodyRect.v0], [bodyRect.u1, bodyRect.v0],
    [bodyRect.u0, bodyRect.v1], [bodyRect.u1, bodyRect.v1],
  ]) svgEl('circle', { cx, cy, r: 6, class: 'corner ball', style: `fill:url(#${uid}-corner)` }, g);

  if (mode === 'top' || face !== 'bottom') return;

  // Deckelfuge bei 25 % Höhe: doppelte Alu-Leiste + Butterfly-Verschlüsse (2 auf der Längsseite,
  // 1 auf der Stirnseite – Ansicht 'side' zeigt die Längsseite, 'rear' die Stirnseite).
  const y = bodyRect.v0 + bh * 0.25;
  svgEl('line', { x1: bodyRect.u0, y1: y - 1.2, x2: bodyRect.u1, y2: y - 1.2, class: 'seam' }, g);
  svgEl('line', { x1: bodyRect.u0, y1: y + 1.2, x2: bodyRect.u1, y2: y + 1.2, class: 'seam' }, g);
  const latchXs = mode === 'side' ? [bodyRect.u0 + bw / 4, bodyRect.u0 + (bw * 3) / 4] : [bodyRect.u0 + bw / 2];
  for (const lx of latchXs) {
    svgEl('rect', { x: lx - 4.5, y: y - 3.5, width: 9, height: 7, rx: 1.5, class: 'latch' }, g);
    svgEl('rect', { x: lx - 2.5, y: y - 1, width: 5, height: 2, rx: 1, class: 'latch-wing' }, g);
  }

  // Versenkte Schalengriffe: mittig auf der Stirnseite, ab 100 cm Länge zusätzlich 2 auf der Längsseite.
  const hy = bodyRect.v0 + bh * 0.58;
  const drawHandle = hx => {
    svgEl('rect', { x: hx - 6, y: hy - 3.5, width: 12, height: 7, rx: 2, class: 'handle' }, g);
    svgEl('rect', { x: hx - 3.5, y: hy - 1.5, width: 7, height: 3, rx: 1.5, class: 'handle-bracket' }, g);
  };
  if (mode === 'rear') drawHandle(bodyRect.u0 + bw / 2);
  else if (bw >= 100) { drawHandle(bodyRect.u0 + bw / 4); drawHandle(bodyRect.u0 + (bw * 3) / 4); }
}

// Passt den Textinhalt an eine maximale Breite an (binäre Suche über getComputedTextLength);
// verkürzt notwendigenfalls mit „…“. Der volle Text bleibt im <title> des Case erhalten.
function fitLabelText(el, full, maxWidth) {
  if (maxWidth <= 0) { el.textContent = ''; return; }
  el.textContent = full;
  if (typeof el.getComputedTextLength !== 'function') return;
  if (el.getComputedTextLength() <= maxWidth) return;
  let lo = 0, hi = full.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    el.textContent = mid > 0 ? `${full.slice(0, mid)}…` : '…';
    if (el.getComputedTextLength() <= maxWidth) lo = mid; else hi = mid - 1;
  }
  el.textContent = lo > 0 ? `${full.slice(0, lo)}…` : '…';
}

function drawLabel(g, labelRect, it) {
  const w = labelRect.u1 - labelRect.u0, h = labelRect.v1 - labelRect.v0;
  const fontSize = Math.max(LABEL_MIN, Math.min(LABEL_MAX, Math.min(w, h) * LABEL_RATIO));
  const label = svgEl('text', {
    x: (labelRect.u0 + labelRect.u1) / 2, y: (labelRect.v0 + labelRect.v1) / 2,
    class: 'label', style: `font-size:${fontSize}px`,
  }, g);
  fitLabelText(label, it.label, Math.max(0, w - LABEL_PAD * 2));

  const seqSize = Math.max(LABEL_MIN, fontSize * 0.55);
  svgEl('text', {
    x: labelRect.u0 + LABEL_PAD, y: labelRect.v0 + LABEL_PAD,
    class: 'label-seq', style: `font-size:${seqSize}px`,
  }, g).textContent = it.seq;
}

function drawCase(g, it, mode, truck, { colorMode, labels, uid }) {
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

  let labelRect = bodyRect;
  if (isTruss(it.c)) {
    const shape = drawTruss(g, it, mode, truck, colorMode);
    // Zahl auf dem Wagen (Wagenende), nicht mitten im Gurtrohr-/Diagonalen-Muster.
    labelRect = project(shape.dollies[0], mode, truck);
  } else {
    const colors = caseColors(it.c, colorMode, it.color);
    // Detailgrad anhand der echten 3D-Korpusmaße (nicht der projizierten Ansicht), damit ein Case
    // in allen Ansichten (oben/seitlich/hinten) gleich detailliert dargestellt wird.
    const detailed = Math.min(body.x1 - body.x0, body.y1 - body.y0, body.z1 - body.z0) >= DETAIL_MIN;
    drawFlightcaseBody(g, bodyRect, colors, mode, face, colorMode, uid, detailed);
  }

  if (view === 'facing') for (const w of wheels) drawWheel(g, w, mode, truck, null);

  if (labels) drawLabel(g, labelRect, it);
  svgEl('title', {}, g).textContent = it.title;
}

export function renderView(svg, mode, { truck, result, selectedId, labels = true, colorMode = 'black' }) {
  svg.replaceChildren();
  const uid = svgUid(svg);
  addDefs(svg, uid);
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
      title: `${result.sequence.get(it.id)}. ${it.label}${it.c.content ? ` – ${it.c.content}` : ''}`,
    }, mode, truck, { colorMode, labels, uid });
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
