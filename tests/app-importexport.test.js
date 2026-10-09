import test from 'node:test';
import assert from 'node:assert/strict';
import { importWarnings } from '../js/app/importExport.js';

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
