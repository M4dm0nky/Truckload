import * as repo from './store/repo.js';
import { createStore } from './state.js';
import { validatePlan } from './model/validate.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { renderView, attachTopInteractions, attachSelect } from './ui/view2d.js';
import { mountLibrary } from './ui/library.js';
import { openCaseEditor } from './ui/case-editor.js';
import { stamp } from './store/repo.js';

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

const usage = (s, caseId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => [...p.placements, ...p.unplaced].some(x => x.caseId === caseId)).length;

async function editCase(caseId) {
  const s = store.get();
  const c = caseId ? s.cases.find(x => x.id === caseId) : null;
  const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteCase(caseId);
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
  } else {
    const value = stamp(res.value);
    await repo.saveCase(value);
    store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
  }
}

const library = mountLibrary($('#library'), {
  onNew: () => editCase(null),
  onEdit: id => editCase(id),
  onAdd: id => {
    const n = Number.parseInt(prompt('Wie viele Stück in die Ablage legen?', '1') ?? '', 10);
    if (n > 0 && n <= 500) edit((p) => A.addUnplaced(p, id, n, uid));
  },
  onTrayRemove: id => edit(p => A.removeUnplaced(p, id)),
});
renderHooks.push(s => library.update(s));

attachTopInteractions($('#svg-top'), {
  getTruck: () => ctx().truck,
  getItem: id => derive().result.items.find(it => it.id === id),
  onSelect: select,
  onDragStart: () => store.checkpoint(),
  onDrag: (id, x, y) => edit((p, c) => A.moveGroup(p, id, x, y, c), false),
  onDropCase: ({ caseId, unplacedId }, x, y) => {
    const c = ctx().caseById.get(caseId);
    if (!c) return;
    edit((p, cx) => A.placeCase(p, caseId, x - c.l / 2, y - c.w / 2, cx, unplacedId));
  },
});
attachSelect($('#svg-side'), select);
attachSelect($('#svg-rear'), select);

scheduleRender();
