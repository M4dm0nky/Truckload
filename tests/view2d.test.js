import test from 'node:test';
import assert from 'node:assert/strict';
import { truncateToWidth } from '../js/ui/view2d.js';

// Breite = 1 je Zeichen – macht die erwarteten Kürzungen von Hand nachrechenbar.
const perChar = () => { let calls = 0; const f = t => { calls++; return t.length; }; f.calls = () => calls; return f; };

test('truncateToWidth: passt der Text, bleibt er unverändert (eine Messung)', () => {
  const w = perChar();
  assert.equal(truncateToWidth('K2 4er', 10, w), 'K2 4er');
  assert.equal(w.calls(), 1);
});
test('truncateToWidth: kürzt mit „…“ auf die größte passende Länge', () => {
  assert.equal(truncateToWidth('L-Acoustics K2 4er (auf Dolly) 3', 10, perChar()), 'L-Acousti…');
});
test('truncateToWidth: kein Platz → leer, zu wenig für ein Zeichen → nur „…“', () => {
  assert.equal(truncateToWidth('K2', 0, perChar()), '');
  assert.equal(truncateToWidth('K2 Stack', 1, perChar()), '…');
});
test('truncateToWidth: binäre Suche – höchstens log2(Länge)+2 Messungen', () => {
  const w = perChar();
  const full = 'x'.repeat(64);
  truncateToWidth(full, 20, w);
  assert.ok(w.calls() <= 8, `zu viele Messungen: ${w.calls()}`);
});

// --- Schrift wächst beim Zoomen mit, wenn sie passt (0.14.1) ---------------------------------
import { readFileSync } from 'node:fs';
import { labelFontSize, renderView, refitLabels } from '../js/ui/view2d.js';
import { zoomBy, resetZoom } from '../js/ui/zoom2d.js';
import { installFakeDom, newSvg, serialize } from './fake-svg.js';
import { labelFixture } from './view2d-fixture.js';

// Formel des Stands 0.14.0, Wort für Wort.
const OLD = (w, h) => Math.max(6, Math.min(16, Math.min(w, h) * 0.32));

test('labelFontSize: bei Zoom 1 exakt der Wert des Stands 0.14.0 (kleine, mittlere, große Cases)', () => {
  for (let w = 5; w <= 400; w += 7) for (let h = 5; h <= 300; h += 11) {
    assert.equal(labelFontSize(w, h, 1), OLD(w, h), `${w}x${h}`);
  }
});
test('labelFontSize: Zoom 4 wächst nur bis kleinere Seite × 0,32', () => {
  assert.equal(labelFontSize(120, 200, 4), 120 * 0.32);   // Case begrenzt (38,4 < 64)
  assert.equal(labelFontSize(300, 400, 4), 64);           // Zoom begrenzt (96 > 64)
  assert.equal(labelFontSize(300, 400, 2), 32);
});
test('labelFontSize: LABEL_MIN bleibt Untergrenze, Zoom < 1 wird auf 1 geklemmt', () => {
  assert.equal(labelFontSize(10, 10, 8), 6);
  assert.equal(labelFontSize(300, 400, 0.5), 16);
  assert.equal(labelFontSize(300, 400, 0), 16);
  assert.equal(labelFontSize(300, 400, NaN), 16);
});

const BASE = JSON.parse(readFileSync(new URL('./baselines/view2d-zoom1.json', import.meta.url), 'utf8'));
const MODES = ['top', 'side', 'rear'];
function renderAll(labels) {
  installFakeDom();
  const { truck, result } = labelFixture();
  const out = {};
  for (const mode of MODES) {
    const svg = newSvg();
    renderView(svg, mode, { truck, result, selectedId: 'p2', labels });
    out[mode] = { svg, markup: serialize(svg) };
  }
  return { out, truck, result };
}

test('renderView: bei Zoom 1 byte-identisches Markup wie 0.14.0 (Beschriftung an und aus)', () => {
  for (const labels of [true, false]) {
    const { out } = renderAll(labels);
    for (const mode of MODES) {
      assert.equal(out[mode].markup, BASE[`${mode}-${labels ? 'labels' : 'nolabels'}`], `${mode} labels=${labels}`);
    }
  }
});

const fontsOf = svg => svg.querySelectorAll('.label').map(e => parseFloat(/font-size:([\d.]+)px/.exec(e.getAttribute('style'))[1]));
const textsOf = svg => svg.querySelectorAll('.label').map(e => e.textContent);

test('refitLabels: nach dem Hineinzoomen wächst die Schrift bis zur Case-Grenze und der Text wird weniger gekürzt', () => {
  const { out } = renderAll(true);
  const svg = out.top.svg;
  const f1 = fontsOf(svg), t1 = textsOf(svg);
  zoomBy(svg, 4);
  refitLabels(svg);
  const f4 = fontsOf(svg), t4 = textsOf(svg);
  assert.ok(f4.some((f, i) => f > f1[i]), 'mindestens eine Schrift wächst');
  assert.ok(f4.every((f, i) => f >= f1[i]));
  assert.ok(f4.every(f => f <= 64 + 1e-9));
  // Sequenznummer folgt: 0,55 × Label, mindestens 6.
  const seq = svg.querySelectorAll('.label-seq').map(e => parseFloat(/font-size:([\d.]+)px/.exec(e.getAttribute('style'))[1]));
  seq.forEach((s, i) => assert.equal(s, Math.max(6, f4[i] * 0.55)));
  // Farbe/Kontur im style bleiben erhalten.
  assert.match(svg.querySelectorAll('.label')[0].getAttribute('style'), /;fill:.+;stroke:/);
  // Kürzung wird neu berechnet – nie länger als der Volltext, und mit größerer Schrift nicht plötzlich mehr Text.
  assert.ok(t4.every(t => t.length > 0));
  assert.notDeepEqual(t4, t1.map(() => '')); // Smoke
});

test('refitLabels nach resetZoom: Zustand wie vorher (Markup identisch zum Zoom-1-Stand)', () => {
  const { out } = renderAll(true);
  const svg = out.side.svg;
  zoomBy(svg, 4); refitLabels(svg);
  resetZoom(svg); refitLabels(svg);
  assert.equal(serialize(svg), BASE['side-labels']);
});

test('renderView bei bestehendem Zoom zeichnet die gewachsene Schrift gleich mit (z. B. Auswahl bei Zoom 4)', () => {
  const { out, truck, result } = renderAll(true);
  const svg = out.top.svg;
  zoomBy(svg, 4); refitLabels(svg);
  const grown = fontsOf(svg);
  renderView(svg, 'top', { truck, result, selectedId: 'p1', labels: true });
  assert.deepEqual(fontsOf(svg), grown);
  assert.ok(grown.some(f => f > 16));
});

test('renderView hängt den truckzoom-Listener je svg nur einmal an; das Ereignis passt die Labels an', () => {
  const { out, truck, result } = renderAll(true);
  const svg = out.top.svg;
  renderView(svg, 'top', { truck, result, selectedId: null, labels: true });
  renderView(svg, 'top', { truck, result, selectedId: 'p1', labels: true });
  assert.equal(svg._on.get('truckzoom').length, 1);
  zoomBy(svg, 4);      // löst truckzoom aus
  svg.dispatchEvent({ type: 'truckzoom' }); // (ohne rAF läuft die Anpassung sofort)
  assert.ok(fontsOf(svg).some(f => f > 16));
});
