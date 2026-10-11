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
function renderAll(labels, opts) {
  installFakeDom();
  const { truck, result } = labelFixture(opts);
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

test('labelFontSize mit Messung: wächst nur, solange der ganze Name hineinpasst', () => {
  const width = len => size => len * size * 0.6;               // 0,6 × Größe je Zeichen
  // Kurzer Name (2 Zeichen) in 200×120: wächst bis zur Case-Grenze bzw. 16 × Zoom.
  assert.equal(labelFontSize(200, 120, 2, width(2)), 32);
  assert.equal(labelFontSize(200, 120, 4, width(2)), 120 * 0.32);
  // Mittlerer Name: Grenze durch die Breite, (200 − 6) / (20 × 0,6) × 0,995.
  const mid = labelFontSize(200, 120, 4, width(20));
  assert.ok(Math.abs(mid - (194 / 12) * 0.995) < 1e-9 && mid > 16 && mid < 38.4, String(mid));
  // Langer Name (40 Zeichen): passt schon bei Grundgröße nicht → bleibt auf der Grundgröße.
  assert.equal(labelFontSize(200, 120, 4, width(40)), 16);
  // Zoom 1 fragt nicht einmal nach der Breite.
  assert.equal(labelFontSize(200, 120, 1, () => { throw new Error('nicht messen'); }), 16);
});

test('refitLabels: langer Name bleibt auf Grundgröße und gekürzt, kurzer Name wächst mit dem Zoom', () => {
  // Langer Name (Standard-Fixture): Größe und Text ändern sich beim Zoomen nicht.
  const long = renderAll(true).out.top.svg;
  const f1 = fontsOf(long), t1 = textsOf(long);
  assert.ok(t1[0].endsWith('…') && f1[0] === 16);
  zoomBy(long, 4); refitLabels(long);
  assert.equal(fontsOf(long)[0], 16);
  assert.equal(textsOf(long)[0], t1[0]);
  // Kurzer Name: wächst; Text ungekürzt, Sequenznummer folgt (0,55 ×, mindestens 6).
  const short = renderAll(true, { shortName: true }).out.top.svg;
  const s1 = fontsOf(short)[0];
  zoomBy(short, 2); refitLabels(short);
  const s2 = fontsOf(short)[0];
  zoomBy(short, 2); refitLabels(short);
  const s4 = fontsOf(short)[0];
  assert.ok(s1 === 16 && s2 > s1 && s4 > s2 && s4 <= 120 * 0.32 + 1e-9, `${s1} ${s2} ${s4}`);
  assert.equal(textsOf(short)[0], 'K2');
  const seq = short.querySelectorAll('.label-seq').map(e => parseFloat(/font-size:([\d.]+)px/.exec(e.getAttribute('style'))[1]));
  assert.equal(seq[0], Math.max(6, s4 * 0.55));
  assert.match(short.querySelectorAll('.label')[0].getAttribute('style'), /;fill:.+;stroke:/);
});

test('refitLabels nach resetZoom: Zustand wie vorher (Markup identisch zum Zoom-1-Stand)', () => {
  const { out } = renderAll(true);
  const svg = out.side.svg;
  zoomBy(svg, 4); refitLabels(svg);
  resetZoom(svg); refitLabels(svg);
  assert.equal(serialize(svg), BASE['side-labels']);
});

test('renderView bei bestehendem Zoom zeichnet die gewachsene Schrift gleich mit (z. B. Auswahl bei Zoom 4)', () => {
  const { out, truck, result } = renderAll(true, { shortName: true });
  const svg = out.top.svg;
  zoomBy(svg, 4); refitLabels(svg);
  const grown = fontsOf(svg);
  renderView(svg, 'top', { truck, result, selectedId: 'p1', labels: true });
  assert.deepEqual(fontsOf(svg), grown);
  assert.ok(grown.some(f => f > 16));
});

test('renderView hängt den truckzoom-Listener je svg nur einmal an; das Ereignis passt die Labels an', () => {
  const { out, truck, result } = renderAll(true, { shortName: true });
  const svg = out.top.svg;
  renderView(svg, 'top', { truck, result, selectedId: null, labels: true });
  renderView(svg, 'top', { truck, result, selectedId: 'p1', labels: true });
  assert.equal(svg._on.get('truckzoom').length, 1);
  zoomBy(svg, 4);      // löst truckzoom aus
  svg.dispatchEvent({ type: 'truckzoom' }); // (ohne rAF läuft die Anpassung sofort)
  assert.ok(fontsOf(svg).some(f => f > 16));
});
