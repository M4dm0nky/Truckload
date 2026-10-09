import test from 'node:test';
import assert from 'node:assert/strict';
import { importWarnings, limitWarnings } from '../js/app/importExport.js';

const refs = [{ planId: 'p1', plan: 'Tour A', cases: ['mein-case', 'weg', 'weg'], truck: 'mein-truck' }];

test('importWarnings: Verweise auf lokal vorhandene Cases/Fahrzeuge erzeugen keine Warnung', () => {
  const warnings = importWarnings(refs, { cases: [{ id: 'mein-case' }, { id: 'weg' }], trucks: [{ id: 'mein-truck' }] });
  assert.deepEqual(warnings, []);
});

test('importWarnings: ein Verweis auf ein eigenes lokales Case (nicht in der Datei) ist keine Warnung', () => {
  const warnings = importWarnings([{ planId: 'p1', plan: 'Tour A', cases: ['mein-case'], truck: null }],
    { cases: [{ id: 'mein-case' }], trucks: [] });
  assert.deepEqual(warnings, []);
});

test('importWarnings: nirgends vorhandenes Case und Fahrzeug werden gemeldet, Wortlaut unverändert', () => {
  const warnings = importWarnings(refs, { cases: [{ id: 'mein-case' }], trucks: [] });
  assert.deepEqual(warnings, [
    'Ladeplan „Tour A“: 2 Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist.',
    'Ladeplan „Tour A“ verweist auf ein unbekanntes Fahrzeug.',
  ]);
});

test('limitWarnings: nennt Case, Feld und Wert, kurz und deutsch', () => {
  const w = limitWarnings([
    { id: 'a', name: 'Schwer', field: 'weight', value: 60000, max: 50000 },
    { id: 'a', name: 'Schwer', field: 'maxTopLoad', value: 70000, max: 50000 },
    { id: 'b', name: 'Viel', field: 'stock', value: 10000, max: 9999 },
  ]);
  assert.deepEqual(w, [
    'Case „Schwer“: Gewicht 60000 kg liegt über der Grenze von 50000 kg – unverändert übernommen.',
    'Case „Schwer“: Auflast 70000 kg liegt über der Grenze von 50000 kg – unverändert übernommen.',
    'Case „Viel“: Bestand 10000 Stück liegt über der Grenze von 9999 Stück – unverändert übernommen.',
  ]);
  assert.deepEqual(limitWarnings([]), []);
});
