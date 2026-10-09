// Zoom und Verschieben der 2D-Ansichten (Draufsicht, Seiten-, Rückansicht – jede für sich).
// Gezoomt wird allein über die viewBox des SVG; alles, was Bildschirm- in Truck-Koordinaten
// umrechnet (toSvg unten über getScreenCTM), bleibt dadurch ohne Änderung richtig –
// auch Case verschieben und Hineinziehen aus der Liste.
//
// Eine viewBox ist hier { x, y, w, h }. `full` ist der ganze Truck samt Rand (wie renderView sie
// ohne Zoom setzt) – weiter heraus geht es nicht, der Ausschnitt bleibt immer darin.
import { caseIdAt } from './view2d.js';

export const MIN_VIEW_W = 40; // cm – engster Ausschnitt (eigene Festlegung)
const STEP = 1.5;              // Faktor je Knopfdruck

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

function fit(vb, full) {
  if (vb.w >= full.w - 1e-9) return { ...full };
  return {
    ...vb,
    x: clamp(vb.x, full.x, full.x + full.w - vb.w),
    y: clamp(vb.y, full.y, full.y + full.h - vb.h),
  };
}

// Zoomt um den Punkt (px, py) in viewBox-Koordinaten; er bleibt dabei an derselben Stelle im Bild.
// factor > 1 vergrößert (Ausschnitt wird kleiner).
export function zoomAt(vb, factor, px, py, full) {
  const w = clamp(vb.w / factor, Math.min(MIN_VIEW_W, full.w), full.w);
  const s = w / vb.w;
  return fit({ x: px - (px - vb.x) * s, y: py - (py - vb.y) * s, w, h: vb.h * s }, full);
}

export const panBy = (vb, dx, dy, full) => fit({ ...vb, x: vb.x + dx, y: vb.y + dy }, full);

// Gespeicherter Zoom gilt nur für denselben Truck-Rahmen; bei anderem Truck wieder alles zeigen.
export function resolveViewBox(state, full) {
  if (!state) return { ...full };
  const same = ['x', 'y', 'w', 'h'].every(k => Math.abs(state.full[k] - full[k]) < 1e-9);
  return same ? { ...state.vb } : { ...full };
}

const states = new WeakMap(); // svg -> { full, vb }
const vbAttr = vb => `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;

// Von renderView aufgerufen statt einer festen viewBox.
export function applyViewBox(svg, full) {
  const vb = resolveViewBox(states.get(svg), full);
  if (states.has(svg) && vb.w >= full.w - 1e-9) states.delete(svg);
  else if (states.has(svg)) states.set(svg, { full: { ...full }, vb });
  svg.dataset.fullVb = vbAttr(full);
  svg.setAttribute('viewBox', vbAttr(vb));
}

function current(svg) {
  const [x, y, w, h] = (svg.dataset.fullVb ?? '0 0 1 1').split(' ').map(Number);
  const full = { x, y, w, h };
  return { full, vb: resolveViewBox(states.get(svg), full) };
}
function set(svg, vb, full) {
  if (vb.w >= full.w - 1e-9) states.delete(svg); else states.set(svg, { full, vb });
  svg.setAttribute('viewBox', vbAttr(vb));
}
export const toSvg = (svg, x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
// Maßstab Bildschirm-Pixel -> viewBox-Einheiten (für Verschieben um Pixel-Beträge).
const unitsPerPx = svg => { const m = svg.getScreenCTM(); return 1 / (m?.a || 1); };

export function zoomBy(svg, factor) {
  const { full, vb } = current(svg);
  set(svg, zoomAt(vb, factor, vb.x + vb.w / 2, vb.y + vb.h / 2, full), full);
}
export const zoomIn = svg => zoomBy(svg, STEP);
export const zoomOut = svg => zoomBy(svg, 1 / STEP);
export function resetZoom(svg) {
  const { full } = current(svg);
  set(svg, full, full);
}

// Mausrad oder Trackpad: Pinch (ctrlKey) und Mausrad zoomen an der Mausposition, Wischen mit zwei
// Fingern verschiebt. Ein Mausrad erkennt man am Zeilen-Modus oder an großen, rein senkrechten
// Schritten; Trackpad-Wischen liefert kleine Schritte und oft auch deltaX.
// Ziehen auf freier Fläche (nicht auf einem Case) verschiebt, Doppelklick dort zeigt wieder alles.
export function attachZoom(svg) {
  svg.addEventListener('wheel', e => {
    const { full, vb } = current(svg);
    const isWheel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50);
    if (e.ctrlKey || isWheel) {
      e.preventDefault();
      const p = toSvg(svg, e.clientX, e.clientY);
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      set(svg, zoomAt(vb, Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.002)), p.x, p.y, full), full);
    } else {
      if (vb.w >= full.w - 1e-9) return; // nichts zu verschieben – Seite normal scrollen lassen
      e.preventDefault();
      const k = unitsPerPx(svg);
      set(svg, panBy(vb, e.deltaX * k, e.deltaY * k, full), full);
    }
  }, { passive: false });

  let pan = null;
  svg.addEventListener('pointerdown', e => {
    if (e.button !== 0 || caseIdAt(e)) return;
    pan = { sx: e.clientX, sy: e.clientY, vb: current(svg).vb };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!pan) return;
    const { full } = current(svg);
    const k = unitsPerPx(svg);
    set(svg, panBy(pan.vb, -(e.clientX - pan.sx) * k, -(e.clientY - pan.sy) * k, full), full);
  });
  const end = () => { pan = null; };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('dblclick', e => { if (!caseIdAt(e)) resetZoom(svg); });
}
