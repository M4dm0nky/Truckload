export const mkCase = (id, l, w, h, extra = {}) => ({
  id, name: id, content: '', category: 'Sonstiges', color: '#999999',
  l, w, h, weight: 100, tippable: false, stackable: true, maxTopLoad: null, ...extra,
});
export const mkTruck = (extra = {}) => ({
  id: 't', name: 'T', l: 1360, w: 248, h: 270, payload: 24000, wheelArches: [], ...extra,
});
export const SPRINTER = mkTruck({ l: 430, w: 178, h: 194, payload: 1000,
  wheelArches: [{ x: 215, l: 100, w: 22, h: 30, side: 'both' }] });
export const P = (id, caseId, x, y, z, extra = {}) =>
  ({ id, caseId, x, y, z, orientation: 'standing', rot: 0, ...extra });
export const plan = (placements, unplaced = []) =>
  ({ id: 'plan', name: 'Test', truckId: 't', placements, unplaced, notes: '' });
export const byId = (...cases) => new Map(cases.map(c => [c.id, c]));
export const counter = (prefix = 'n') => { let i = 0; return () => `${prefix}${++i}`; };
