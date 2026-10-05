import { applyViewBox } from './zoom2d.js';
import { svgEl } from './dom.js';
import { project, unproject, drawOrder, wheelStripRect } from './projection.js';
import { wheelFace } from '../model/geometry.js';
import { caseShape } from '../model/caseShape.js';
import { caseColors, weightRange, weightColor } from './caseStyle.js';
import { archBoxes, aboveLayer } from '../model/validate.js';
import { isTruss, trussShape, TUBE_R_RATIO } from '../model/truss.js';
import { estimateTextWidth } from './labelTexture.js';

// 2D ist die nüchterne Planungsansicht – „Tetris“: jedes Stück ist ein Rechteck im belegten
// Außenmaß inkl. Rollen (`it.box`, siehe docs/architektur.md, „Rollen im Maß“). Die reale
// Darstellung mit Alu-Profil, Kugelecken, Verschlüssen, Griffen und Rollen gibt es nur in 3D
// (view3d.js). Bis V 0.9.1 zeichnete 2D dieselben Details und die Rollen als Kreise mit Gabel
// AUSSERHALB des Korpus – hübsch, aber die sichtbare Form deckte sich nicht mit der Fläche, die
// das Case wirklich belegt.
const PAD = 30;
const TRADE_EDGE = 3; // cm, Innenrahmen in Gewerkfarbe im Modus „Schwarz“

// Beschriftung: Schriftgröße aus der kleineren Korpus-Rechteckseite abgeleitet, auf 6–16 cm begrenzt.
//
// 2D kürzt zu lange Beschriftungen einzeilig mit „…“ (fitLabelText() unten), 3D bricht sie
// stattdessen mehrzeilig um und verkleinert die Schrift (labelTexture.js, fitFontSize()/
// wrapText()) — zwei verschiedene Lösungen für dieselbe Aufgabe, mit unterschiedlichem Ergebnis
// auf demselben Case (docs/code-review-2026-09-21.md, „S3 — eine Textmetrik für 2D und 3D“).
// Absichtlich NICHT zusammengeführt: 2D auf Umbruch umzustellen wäre eine sichtbare
// Verhaltensänderung (mehrzeiliger statt gekürzter Text), keine reine Dopplung, und damit
// außerhalb dessen, was Task 6 zusammenführen soll. Was tatsächlich geteilt wird, ist nur die
// Zeichenbreiten-SCHÄTZUNG (`estimateTextWidth`, aus labelTexture.js importiert) als Rückfall,
// wenn `getComputedTextLength()` nicht zur Verfügung steht (s. `fitLabelText()`) — das war schon
// vor Task 6 der Fall und ist keine Änderung hier.
const LABEL_MIN = 6;
const LABEL_MAX = 16;
const LABEL_RATIO = 0.32;
const LABEL_PAD = 3;

// Gitterstruktur eines Traversenwagens im 2D-Kasten: liegt die Traversenlänge in der Ansicht,
// zwei Gurte mit Zickzack-Diagonalen („längs“); sieht man auf ihr Ende, ein Kasten mit vier
// Gurtrohr-Kreisen („stirnseitig“).

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
  // Diagonalkreuz: von der Stirn gesehen hätte der Kasten sonst nur vier Eckpunkte und läse sich
  // nicht als Traverse.
  svgEl('polyline', { points: `${pr.u0},${pr.v0} ${pr.u1},${pr.v1}`, class: 'truss-diag' }, g);
  svgEl('polyline', { points: `${pr.u1},${pr.v0} ${pr.u0},${pr.v1}`, class: 'truss-diag' }, g);
  const cr = Math.max(1.5, profileWidth * TUBE_R_RATIO);
  for (const [cx, cy] of [[pr.u0, pr.v0], [pr.u1, pr.v0], [pr.u0, pr.v1], [pr.u1, pr.v1]])
    svgEl('circle', { cx, cy, r: cr, class: 'truss-tube' }, g);
}

// Traversenwagen als Kasten im Außenmaß (Rollbretter, Rollen und Traversenstück zusammen), mit
// der Gitterstruktur über den ganzen Kasten. Keine Rollbretter, Leisten oder Rollen mehr – die
// gibt es nur in 3D. Die Markenfarbe bleibt wie bisher unabhängig vom Farbmodus und färbt die
// Kontur; sie läuft über eine CSS-Variable statt über `stroke`, damit die Auswahlfarbe
// (`.case.sel rect.body` in css/app.css) weiter greift.
// Welche Achse die Traversenlänge ist, sagt trussShape() (`lenAxis`, aus der Drehung `p.rot`) –
// nicht das Außenmaß: bei quadratischer Grundfläche (z. B. 80 cm Stück auf 80er-Wagen, oder ein
// Pre-Rig mit 62 cm Länge auf 62 cm Standfläche) wäre die „längere Seite“ unentschieden und das
// Gitter liefe quer. Ob man die Länge in einer Ansicht sieht, folgt aus der Projektion.
const LENGTH_IN_VIEW = { top: { x: 'u', y: 'v' }, side: { x: 'u' }, rear: { y: 'u' } };
function drawTruss(g, it, mode, truck) {
  const { c, p, box } = it;
  const r = project(box, mode, truck);
  svgEl('rect', {
    x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'body truss-box',
    ...(it.color ? { style: `--mark:${it.color}` } : {}),
  }, g);
  const shape = trussShape(c, p, box);
  const profileWidth = shape.profileWidth ?? c.truss.width;
  const axis = LENGTH_IN_VIEW[mode][shape.lenAxis];
  if (axis === 'u') drawChordBar(g, r, true, profileWidth);
  else if (axis === 'v') drawChordBar(g, r, false, profileWidth);
  else drawEndSquare(g, r, profileWidth);
}

// Passt den Textinhalt an eine maximale Breite an (binäre Suche); verkürzt notwendigenfalls mit
// „…“. Der volle Text bleibt im <title> des Case erhalten. Misst wo möglich über
// `getComputedTextLength()` (exakt) – ein ungerendertes SVG (z. B. `#print-root` vor
// `window.print()`, siehe I2) liefert dafür aber immer 0, was die Kürzung sonst stillschweigend
// unterließe. In dem Fall wird stattdessen mit `estimateTextWidth()` (labelTexture.js, dieselbe
// Schätzung wie in 3D) ohne DOM-Messung gekürzt.
function fitLabelText(el, full, maxWidth, fontSize) {
  if (maxWidth <= 0) { el.textContent = ''; return; }
  el.textContent = full;
  const rendered = typeof el.getComputedTextLength === 'function' && el.getComputedTextLength() > 0;
  const widthOf = rendered
    ? text => { el.textContent = text; return el.getComputedTextLength(); }
    : text => estimateTextWidth(text, fontSize);
  if (widthOf(full) <= maxWidth) { el.textContent = full; return; }
  let lo = 0, hi = full.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = mid > 0 ? `${full.slice(0, mid)}…` : '…';
    if (widthOf(candidate) <= maxWidth) lo = mid; else hi = mid - 1;
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
  fitLabelText(label, it.label, Math.max(0, w - LABEL_PAD * 2), fontSize);

  const seqSize = Math.max(LABEL_MIN, fontSize * 0.55);
  svgEl('text', {
    x: labelRect.u0 + LABEL_PAD, y: labelRect.v0 + LABEL_PAD,
    class: 'label-seq', style: `font-size:${seqSize}px`,
  }, g).textContent = it.seq;
}

function drawCase(g, it, mode, truck, { colorMode, labels, weightSpan }) {
  const r = project(it.box, mode, truck);
  svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'hit' }, g);

  let labelRect = r;
  if (isTruss(it.c)) {
    drawTruss(g, it, mode, truck);
  } else {
    const itemColor = colorMode === 'weight' ? weightColor(it.c.weight, weightSpan) : it.color;
    const colors = caseColors(it.c, colorMode, itemColor);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, fill: colors.body, class: 'body' }, g);
    // Modus „Schwarz“: dunkle Kiste, die Gewerkfarbe als dünner Innenrahmen – ein eigenes
    // Rechteck, damit die Auswahlfarbe auf `rect.body` über CSS weiter greift.
    if (colors.stripe) svgEl('rect', {
      x: r.u0 + TRADE_EDGE, y: r.v0 + TRADE_EDGE,
      width: Math.max(0, r.u1 - r.u0 - 2 * TRADE_EDGE), height: Math.max(0, r.v1 - r.v0 - 2 * TRADE_EDGE),
      stroke: colors.stripe, class: 'trade-edge',
    }, g);
    // Rollenzone als Streifen in echter Tiefe – nur, wo man die Rollen von der Kante sieht.
    const bodyRect = project(caseShape(it.c, it.p, it.box).body, mode, truck);
    const strip = wheelStripRect(r, bodyRect, mode, wheelFace(it.p));
    if (strip) svgEl('rect', { ...strip, class: 'wheel-strip' }, g);
    labelRect = bodyRect;
  }

  if (labels) drawLabel(g, labelRect, it);
  svgEl('title', {}, g).textContent = it.title;
}

export function renderView(svg, mode, { truck, result, selectedId, labels = true, colorMode = 'black', layerLimit = null }) {
  svg.replaceChildren();
  const W = mode === 'rear' ? truck.w : truck.l;
  const H = mode === 'top' ? truck.w : truck.h;
  // Ganzer Truck samt Rand – oder der gezoomte Ausschnitt dieser Ansicht (zoom2d.js).
  applyViewBox(svg, { x: -PAD, y: -PAD, w: W + 2 * PAD, h: H + 2 * PAD });
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  svgEl('rect', { x: 0, y: 0, width: W, height: H, class: 'truck' }, svg);
  const grid = svgEl('g', { class: 'grid' }, svg);
  for (let u = 100; u < W; u += 100) {
    svgEl('line', { x1: u, y1: 0, x2: u, y2: H }, grid);
    svgEl('text', { x: u, y: -10, class: 'tick' }, grid).textContent = `${u / 100} m`;
  }
  if (mode !== 'rear') svgEl('line', { x1: 0, y1: 0, x2: 0, y2: H, class: 'front-wall' }, svg);

  // Einmal je Render über alle Stücke, nicht je Case (sonst O(n²)).
  const weightSpan = colorMode === 'weight' ? weightRange(result.items) : null;
  for (const a of archBoxes(truck)) {
    if (mode === 'side' && a.y0 > 0) continue; // Seitenansicht zeigt nur den linken Radkasten
    const r = project(a, mode, truck);
    svgEl('rect', { x: r.u0, y: r.v0, width: r.u1 - r.u0, height: r.v1 - r.v0, class: 'arch' }, svg);
  }

  for (const it of drawOrder(result.items, mode)) {
    const bad = result.byPlacement.has(it.id);
    // Lagen-Durchsicht: dieselbe Regel wie in 3D (dort wird ausgeblendet statt blass gezeichnet).
    // Die Lage kommt aus dem Packergebnis (validate.js, `layerMap`) – dieselbe Zahl, die der
    // Inspektor und die Druck-Tabelle als „Lage“ zeigen.
    const faint = aboveLayer(result.layers, it.id, layerLimit, selectedId);
    const cls = ['case', bad && 'bad', it.id === selectedId && 'sel', faint && 'faint'].filter(Boolean).join(' ');
    const g = svgEl('g', { class: cls, 'data-id': it.id }, svg);
    drawCase(g, {
      ...it,
      seq: result.sequence.get(it.id),
      title: `${result.sequence.get(it.id)}. ${it.label}${it.c.content ? ` – ${it.c.content}` : ''}`,
    }, mode, truck, { colorMode, labels, weightSpan });
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
