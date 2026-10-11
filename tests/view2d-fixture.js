// Plan für die Beschriftungs-Tests: ein großes Case (Schrift wächst beim Zoomen), ein mittleres,
// ein kleines, dazu lange Namen zum Kürzen.
import { validatePlan } from '../js/model/validate.js';
import { mkCase, mkTruck, P, plan, byId } from './fixtures.js';

// `shortName`: das große Case trägt einen kurzen Namen, der beim Zoomen ganz hineinpasst.
export function labelFixture({ shortName = false } = {}) {
  const cases = [
    mkCase('big', 200, 120, 150, { name: 'Großes Case' }),
    mkCase('mid', 80, 60, 70),
    mkCase('small', 40, 30, 30),
  ];
  const truck = mkTruck({ l: 600, w: 248, h: 270 });
  const p = plan([
    P('p1', 'big', 0, 0, 0, { label: shortName ? 'K2' : 'Ein sehr langer Name für das große Case' }),
    P('p2', 'mid', 250, 0, 0, { label: 'L-Acoustics K2 4er (auf Dolly)' }),
    P('p3', 'small', 350, 0, 0, { label: 'Kabelkiste Nummer drei' }),
  ]);
  return { truck, result: validatePlan(p, byId(...cases), truck) };
}
