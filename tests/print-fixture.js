// Fester Datensatz für die Druck-Tests (Ein-LKW-Baseline und Mehr-LKW-Markup).
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, P, plan, byId } from './fixtures.js';

export function singleFixture() {
  const cases = [mkCase('c1', 50, 50, 50, { name: 'Rack <A>', content: 'Kabel & Co', color: '#ff0000' }), mkCase('c2', 100, 60, 80, { weight: 0 })];
  const truck = mkTruck({ name: 'Sprinter "XL"' });
  const base = plan(
    [P('p1', 'c1', 0, 0, 0, { label: 'Rack <1>' }), P('p2', 'c2', 60, 0, 0, { label: 'Zwei' }), P('p3', 'c1', 0, 0, 50, { label: 'Drei' })],
    [{ id: 'u1', caseId: 'c1', label: 'Offen', color: '#00ff00' }]);
  const p = { ...base, name: 'Show <b>&</b> Tour' };
  return { plan: p, truck, result: validatePlan(p, byId(...cases), truck), cases };
}
