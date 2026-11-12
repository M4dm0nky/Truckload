import test from 'node:test';
import assert from 'node:assert/strict';
import { retainedFields } from '../js/ui/case-editor.js';

test('neues Case: nur die Firma aus dem Entwurf bleibt', () => {
  assert.deepEqual(retainedFields({ company: 'X' }, { isNew: true, fromTemplate: false, overrideBuiltin: false }),
    { company: 'X', source: undefined, note: undefined, legacy: undefined, onlyInPlan: undefined });
});
test('Kopie einer ausgeblendeten Vorlage: legacy und source weg, Firma bleibt', () => {
  const r = retainedFields({ company: 'CAB', source: 'liste', legacy: true }, { isNew: true, fromTemplate: true, overrideBuiltin: false });
  assert.equal(r.legacy, undefined);
  assert.equal(r.source, undefined);
  assert.equal(r.company, 'CAB');
});
test('Überlagerung (overrideBuiltin): Quelle und Firma bleiben, legacy unverändert', () => {
  const r = retainedFields({ company: 'CAB', source: 'liste', legacy: true }, { isNew: false, fromTemplate: false, overrideBuiltin: true });
  assert.equal(r.source, 'liste');
  assert.equal(r.company, 'CAB');
  assert.equal(r.legacy, true);
});
test('eigenes onlyInPlan-Case bearbeiten: onlyInPlan bleibt', () => {
  const r = retainedFields({ onlyInPlan: true, source: 's' }, { isNew: false, fromTemplate: false, overrideBuiltin: false });
  assert.equal(r.onlyInPlan, true);
  assert.equal(r.source, 's');
});

test('caseFields: Set bleibt Set, ohne Rollen und nicht tippbar (Rückweg des Editors)', async () => {
  const { caseFields } = await import('../js/ui/case-editor.js');
  const dim = { l: 100, w: 50, h: 60, dimsInclWheels: true };
  const set = caseFields({ kind: 'set' }, { ...dim, wheels: true, wheelH: 10, tippable: true });
  assert.equal(set.kind, 'set');
  assert.equal(set.wheels, false);
  assert.equal(set.wheelH, 0);
  assert.equal(set.tippable, false);
  const normal = caseFields({}, { ...dim, wheels: true, wheelH: 10, tippable: true });
  assert.equal(normal.kind, undefined);
  assert.equal(normal.wheels, true);
  assert.equal(normal.wheelH, 10);
  assert.equal(normal.tippable, true);
});

test('Struktursperre: der Speicherzweig für Nicht-Traversen spreizt caseFields(', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/ui/case-editor.js', import.meta.url), 'utf8');
  const zweig = src.slice(src.indexOf('} else {\n        resolve({ action: \'save\''));
  assert.match(zweig.slice(0, 400), /\.\.\.caseFields\(v,/);
  assert.ok(!/kind:\s*undefined/.test(zweig.slice(0, 600)), 'kein festes kind: undefined im Speicherzweig');
});

test('Gewerk-Auswahl: ein freies (unbekanntes) Gewerk bleibt als eigene Option erhalten, escaped', async () => {
  const { categoryOptionsHtml } = await import('../js/ui/case-editor.js');
  assert.match(categoryOptionsHtml('Pyro'), /<option value="Pyro">Pyro<\/option>/);
  assert.ok(!categoryOptionsHtml('Pyro<b>').includes('<b>'), 'esc()');
  assert.equal(categoryOptionsHtml('Licht'), categoryOptionsHtml(), 'bekanntes Gewerk: keine Zusatzoption');
});

test('Struktursperre: der Editor setzt ein unbekanntes Gewerk nicht auf Sonstiges zurück', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../js/ui/case-editor.js', import.meta.url), 'utf8');
  assert.ok(!/v\.category\s*=\s*'Sonstiges'/.test(src), 'kein Zurücksetzen von v.category');
  assert.match(src, /categoryOptionsHtml\(v\.category\)/);
});
