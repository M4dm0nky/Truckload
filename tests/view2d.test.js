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
