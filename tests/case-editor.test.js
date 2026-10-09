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
  const r = retainedFields({ company: 'CAB', source: 'liste', legacy: true }, { isNew: true, fromTemplate: false, overrideBuiltin: true });
  assert.equal(r.source, 'liste');
  assert.equal(r.company, 'CAB');
  assert.equal(r.legacy, true);
});
test('eigenes onlyInPlan-Case bearbeiten: onlyInPlan bleibt', () => {
  const r = retainedFields({ onlyInPlan: true, source: 's' }, { isNew: false, fromTemplate: false, overrideBuiltin: false });
  assert.equal(r.onlyInPlan, true);
  assert.equal(r.source, 's');
});
