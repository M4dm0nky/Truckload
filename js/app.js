import * as repo from './store/repo.js';
import { createStore } from './state.js';
import { validatePlan } from './model/validate.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { renderView } from './ui/view2d.js';

const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

const data = await repo.loadAll();
const latest = [...data.plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
const initialPlan = latest ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);

export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans,
  plan: initialPlan, selectedId: null, mode: '2d',
});

export function ctx(s = store.get()) {
  return {
    caseById: new Map(s.cases.map(c => [c.id, c])),
    truck: s.trucks.find(t => t.id === s.plan.truckId) ?? s.trucks.find(t => t.id === DEFAULT_TRUCK_ID),
    newId: uid,
  };
}
export function derive(s = store.get()) {
  const c = ctx(s);
  return { ...c, result: validatePlan(s.plan, c.caseById, c.truck) };
}
export function edit(fn, history = true) {
  store.update(s => {
    const next = fn(s.plan, ctx(s));
    return next === s.plan ? s : { ...s, plan: next };
  }, { history });
}
export const select = id => store.update(s => (s.selectedId === id ? s : { ...s, selectedId: id }));

let frame = 0;
export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}

function render() {
  const s = store.get();
  const d = derive(s);
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId };
  if (s.mode === '2d') {
    renderView($('#svg-top'), 'top', opts);
    renderView($('#svg-side'), 'side', opts);
    renderView($('#svg-rear'), 'rear', opts);
  }
  for (const fn of renderHooks) fn(s, d);
}
export const renderHooks = []; // Task 10–13 hängen hier Bibliothek, Inspector, Toolbar, 3D an

let saveTimer;
let lastSaved = store.get().plan;
store.subscribe(s => {
  scheduleRender();
  if (s.plan === lastSaved) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { lastSaved = s.plan; repo.savePlan(s.plan); }, 400);
});

scheduleRender();
