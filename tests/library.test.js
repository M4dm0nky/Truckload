import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryRenderMode } from '../js/ui/library.js';

const cases = [];
const mk = (over = {}) => ({ cases, plan: { placements: [], unplaced: [] }, selectedId: null, ...over });

test('Erster Aufruf baut immer', () => {
  assert.equal(libraryRenderMode(null, mk(), 'unplaced'), 'full');
});

test('Unverändert: nichts tun', () => {
  const a = mk();
  assert.equal(libraryRenderMode(a, { ...a }, 'unplaced'), 'none');
  assert.equal(libraryRenderMode(a, { ...a }, 'all'), 'none');
});

test('Ansicht „Noch nicht geladen“ ignoriert placements', () => {
  const a = mk();
  const b = mk({ plan: { placements: [{}], unplaced: a.plan.unplaced } });
  assert.equal(libraryRenderMode(a, b, 'unplaced'), 'none');
  assert.equal(libraryRenderMode(a, b, 'all'), 'full');
});

test('unplaced-Änderung baut in beiden Ansichten', () => {
  const a = mk();
  const b = mk({ plan: { placements: a.plan.placements, unplaced: [{}] } });
  assert.equal(libraryRenderMode(a, b, 'unplaced'), 'full');
  assert.equal(libraryRenderMode(a, b, 'all'), 'full');
});

test('Case-Liste neu: baut', () => {
  const a = mk();
  assert.equal(libraryRenderMode(a, { ...a, cases: [] }, 'unplaced'), 'full');
});

test('Reiner Auswahlwechsel: nur Klasse umschalten', () => {
  const a = mk();
  assert.equal(libraryRenderMode(a, { ...a, selectedId: 'x' }, 'unplaced'), 'sel');
  assert.equal(libraryRenderMode(a, { ...a, selectedId: 'x' }, 'all'), 'sel');
});

test('Auswahlwechsel plus Planänderung: baut', () => {
  const a = mk();
  const b = mk({ selectedId: 'x', plan: { placements: a.plan.placements, unplaced: [{}] } });
  assert.equal(libraryRenderMode(a, b, 'unplaced'), 'full');
});

test('Fahrzeugwechsel baut neu (Gründe der Ablage hängen am Fahrzeug)', () => {
  const a = { ...mk(), truck: { id: 'a' } };
  assert.equal(libraryRenderMode(a, { ...a, truck: { id: 'b' } }, 'unplaced'), 'full');
  assert.equal(libraryRenderMode(a, { ...a }, 'unplaced'), 'none');
});
