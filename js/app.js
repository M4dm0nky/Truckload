import { APP_VERSION } from './version.js';
import * as repo from './store/repo.js';
import { createStore } from './state.js';
import { validatePlan } from './model/validate.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { WHEEL_FACES, wheelFace } from './model/geometry.js';
import { renderView, attachTopInteractions, attachSelect } from './ui/view2d.js';
import { mountLibrary } from './ui/library.js';
import { openCaseEditor } from './ui/case-editor.js';
import { openLoadWizard } from './ui/load-wizard.js';
import { stamp } from './store/repo.js';
import { renderInspector } from './ui/inspector.js';
import { openTruckEditor } from './ui/truck-editor.js';
import { esc } from './ui/dom.js';
import { createView3d } from './ui/view3d.js';
import { buildPrint } from './ui/print.js';
import { exportBundle, parseBundle, backupFileName, preImportBackupFileName } from './store/io.js';

const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

const CASE_COLORS_KEY = 'truckload.caseColors';
function loadCaseColors() {
  try { return localStorage.getItem(CASE_COLORS_KEY) === 'trade' ? 'trade' : 'black'; }
  catch { return 'black'; }
}

// Ein abgelehntes loadAll() (privates Fenster mit blockiertem Speicher, korrupte
// Datenbank, deaktivierte Site-Daten) darf die Modulauswertung nicht abbrechen – sonst
// bleibt die Seite weiß, ohne jede Bedienmöglichkeit (Befund Daten-11).
let storageError = null;
let data;
try {
  data = await repo.loadAll();
} catch (err) {
  storageError = err;
  data = repo.loadAllFallback();
}
const latest = [...data.plans].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
const initialPlan = latest ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);

export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans,
  plan: initialPlan, selectedId: null, mode: '2d', caseColors: loadCaseColors(),
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
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors };
  if (s.mode === '2d') {
    renderView($('#svg-top'), 'top', opts);
    renderView($('#svg-side'), 'side', opts);
    renderView($('#svg-rear'), 'rear', opts);
  }
  for (const fn of renderHooks) fn(s, d);
}
export const renderHooks = []; // Task 10–13 hängen hier Bibliothek, Inspector, Toolbar, 3D an

let saveTimer = null;
let lastSaved = store.get().plan;
let savePending = Promise.resolve();

function setSaveStatus(status, err) {
  const el = $('#save-status');
  if (!el) return;
  if (status === 'saving') {
    el.hidden = false;
    el.classList.remove('error');
    el.textContent = 'Speichert …';
  } else if (status === 'error') {
    el.hidden = false;
    el.classList.add('error');
    el.textContent = `Nicht gespeichert – ${err?.message ?? 'Fehler beim Speichern'}. Bitte über „Sichern“ exportieren.`;
  } else {
    el.hidden = true;
    el.classList.remove('error');
    el.textContent = '';
  }
}

// lastSaved wird erst NACH einem erfolgreichen Schreibvorgang gesetzt, nie vorher (Befund
// Daten-2) – sonst hält die App einen fehlgeschlagenen Schreibvorgang für gesichert und
// verwirft lautlos alles Folgende. savePending verkettet aufeinanderfolgende Aufrufe, damit
// zwei schnell hintereinander ausgelöste Flushes (z. B. pagehide direkt nach einer Änderung)
// nicht gleichzeitig in IndexedDB schreiben.
function flushSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const plan = store.get().plan;
  if (plan === lastSaved) return savePending;
  setSaveStatus('saving');
  savePending = savePending.catch(() => {}).then(() => repo.savePlan(plan)).then(() => {
    lastSaved = plan;
    setSaveStatus('idle');
  }).catch(err => {
    setSaveStatus('error', err);
  });
  return savePending;
}
// Ausstehendes Speichern verwerfen, ohne es auszuführen – für den Fall, dass der Plan
// gerade gelöscht wird und ein Autosave ihn sonst gleich wieder anlegen würde.
function cancelSave() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
}

store.subscribe(s => {
  scheduleRender();
  if (s.plan === lastSaved) return;
  cancelSave();
  saveTimer = setTimeout(flushSave, 400);
});

// Flush beim Verlassen der Seite (Befund Daten-3): ein reiner Debounce ohne das hier würde
// die letzten <400 ms an Änderungen beim Schließen des Tabs oder beim Wegwechseln auf dem
// Tablet verwerfen. visibilitychange ist der verlässliche Haken (beforeunload wird auf
// Mobilgeräten oft nicht gefeuert), pagehide zusätzlich für den Fall eines echten Unloads.
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSave();
});

const usage = (s, caseId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => [...p.placements, ...p.unplaced].some(x => x.caseId === caseId)).length;

async function saveCaseValue(rawValue) {
  const value = stamp(rawValue);
  await repo.saveCase(value);
  store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
  return value;
}

async function editCase(caseId) {
  const s = store.get();
  const c = caseId ? s.cases.find(x => x.id === caseId) : null;
  const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteCase(caseId);
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
  } else {
    await saveCaseValue(res.value);
  }
}

// Für den Load-Wizard: legt ein neues Case über den Case-Editor an (optional mit Vorbelegung,
// z. B. für den „Sonderbau“-Schnellentwurf) und liefert es zurück, ohne den Wizard zu schließen.
async function newCaseForWizard(draft) {
  const res = await openCaseEditor($('#dlg-case'), null, { draft });
  return res?.action === 'save' ? saveCaseValue(res.value) : null;
}

async function runLoadWizard(mode, presetCaseId = null) {
  const s = store.get();
  const res = await openLoadWizard($('#dlg-wizard'), {
    mode,
    cases: s.cases,
    trucks: s.trucks,
    defaultTruckId: ctx().truck.id,
    defaultName: `Load ${new Date().toLocaleDateString('de-DE')}`,
    presetCaseId,
    onNewCase: newCaseForWizard,
  });
  if (!res) return;
  if (mode === 'new') switchPlan(A.emptyPlan(uid(), res.name, res.truckId));
  edit((p, c) => {
    let next = res.items.reduce((pl, it) =>
      A.addUnplaced(pl, it.caseId, 1, uid, { labels: it.label ? [it.label] : [], color: it.color ?? null }), p);
    if (res.autoPack) next = A.packRest(next, c);
    return next;
  });
}

const library = mountLibrary($('#library'), {
  onNew: () => editCase(null),
  onEdit: id => editCase(id),
  onAdd: id => runLoadWizard('add', id),
  onAddLoad: () => runLoadWizard('add'),
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

// Inspector
renderHooks.push((s, d) => {
  const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
  renderInspector($('#inspector'), { selected, result: d.result, truck: d.truck });
});
const withSel = fn => { const id = store.get().selectedId; if (id) fn(id); };
const ACTIONS = {
  rotate: id => edit((p, c) => A.rotate(p, id, c)),
  tip: id => edit((p, c) => A.cycleTip(p, id, c)),
  dup: id => edit((p, c) => A.duplicate(p, id, c)),
  tray: id => { edit(p => A.toTray(p, id)); select(null); },
  delete: id => { edit(p => A.removePlacement(p, id)); select(null); },
  'edit-case': id => editCase(store.get().plan.placements.find(p => p.id === id)?.caseId),
  wheelFace: id => {
    const p = store.get().plan.placements.find(q => q.id === id);
    if (!p) return;
    const next = WHEEL_FACES[(WHEEL_FACES.indexOf(wheelFace(p)) + 1) % WHEEL_FACES.length];
    edit((pl, c) => A.setWheelFace(pl, id, next, c));
  },
};
$('#inspector').addEventListener('click', e => {
  const wheelBtn = e.target.closest('[data-act="wheel-face"]');
  if (wheelBtn) return withSel(id => edit((p, c) => A.setWheelFace(p, id, wheelBtn.dataset.face, c)));
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) return withSel(ACTIONS[act]);
  const target = e.target.closest('[data-select]')?.dataset.select;
  if (target) select(target);
});
$('#inspector').addEventListener('change', e => {
  const name = e.target.name;
  if (name === 'label') return withSel(id => edit((p, c) => A.setItemLabel(p, id, { label: e.target.value.trim() })));
  if (name === 'color') return withSel(id => edit((p, c) => A.setItemLabel(p, id, { color: e.target.value })));
});

// Tastatur
document.addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || document.querySelector('dialog[open]')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (e.key === 'Escape') return select(null);
  const key = { r: 'rotate', t: 'tip', w: 'wheelFace', d: 'dup', Delete: 'delete', Backspace: 'delete' }[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (key && !mod) { e.preventDefault(); return withSel(ACTIONS[key]); }
  const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (arrow) withSel(id => {
    e.preventDefault();
    const step = e.shiftKey ? 1 : 5;
    const p = store.get().plan.placements.find(q => q.id === id);
    edit((pl, c) => A.moveGroup(pl, id, p.x + arrow[0] * step, p.y + arrow[1] * step, c, { grid: step, edges: false }));
  });
});

// Undo/Redo, Modus, Auto-Pack
$('#undo').onclick = () => store.undo();
$('#redo').onclick = () => store.redo();
$('#pack-all').onclick = () => {
  const s = store.get();
  if (s.plan.placements.length && !confirm('Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)')) return;
  edit((p, c) => A.packAll(p, c));
};
$('#pack-rest').onclick = () => edit((p, c) => A.packRest(p, c));
function setMode(mode) {
  store.update(s => ({ ...s, mode }));
  $('#views2d').hidden = mode !== '2d';
  $('#view3d').hidden = mode !== '3d';
  $('#mode-2d').classList.toggle('on', mode === '2d');
  $('#mode-3d').classList.toggle('on', mode === '3d');
}
$('#mode-2d').onclick = () => setMode('2d');
$('#mode-3d').onclick = () => setMode('3d');
function setCaseColors(mode) {
  store.update(s => ({ ...s, caseColors: mode }));
  try { localStorage.setItem(CASE_COLORS_KEY, mode); } catch { /* kein Speicher verfügbar */ }
  $('#colors-black').classList.toggle('on', mode === 'black');
  $('#colors-trade').classList.toggle('on', mode === 'trade');
}
$('#colors-black').onclick = () => setCaseColors('black');
$('#colors-trade').onclick = () => setCaseColors('trade');
$('#colors-black').classList.toggle('on', store.get().caseColors === 'black');
$('#colors-trade').classList.toggle('on', store.get().caseColors === 'trade');

// Toolbar-Zustand: Planliste, Fahrzeugliste, Undo-Buttons
const allPlans = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
renderHooks.push((s, d) => {
  $('#plan-select').innerHTML = allPlans(s).map(p =>
    `<option value="${esc(p.id)}" ${p.id === s.plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  $('#truck-select').innerHTML = s.trucks.map(t =>
    `<option value="${esc(t.id)}" ${t.id === d.truck.id ? 'selected' : ''}>${esc(t.name)}${t.builtin ? '' : ' ★'} – ${t.l}×${t.w}×${t.h}</option>`).join('');
  $('#undo').disabled = !store.canUndo();
  $('#redo').disabled = !store.canRedo();
});

// Ladepläne
function switchPlan(plan) {
  flushSave(); // ausstehende Änderungen des bisherigen Plans sofort sichern
  store.update(s => ({ ...s, plans: [s.plan, ...s.plans.filter(p => p.id !== s.plan.id && p.id !== plan.id)], plan, selectedId: null }));
  store.resetHistory();
}
$('#plan-select').onchange = e => {
  const next = store.get().plans.find(p => p.id === e.target.value);
  if (next) switchPlan(next);
};
$('#plan-new').onclick = () => runLoadWizard('new');
$('#plan-rename').onclick = () => {
  const name = prompt('Neuer Name:', store.get().plan.name);
  if (name?.trim()) edit(p => stamp({ ...p, name: name.trim() }));
};
$('#plan-dup').onclick = () => {
  const p = store.get().plan;
  switchPlan(stamp({ ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)` }));
};
$('#plan-del').onclick = async () => {
  const s = store.get();
  if (!confirm(`Ladeplan „${s.plan.name}“ löschen?`)) return;
  cancelSave(); // sonst speichert der Autosave den gelöschten Plan erneut
  await repo.deletePlan(s.plan.id);
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  const next = rest[0] ?? A.emptyPlan(uid(), 'Neuer Ladeplan', DEFAULT_TRUCK_ID);
  store.update(st => ({ ...st, plans: rest.filter(p => p.id !== next.id), plan: next, selectedId: null }));
  store.resetHistory();
};

// Fahrzeuge
$('#truck-select').onchange = e => edit(p => stamp({ ...p, truckId: e.target.value }));
const truckUsage = (s, truckId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => p.truckId === truckId).length;

async function editTruck(truck) {
  const s0 = store.get();
  const res = await openTruckEditor($('#dlg-truck'), truck, { usedIn: truck ? truckUsage(s0, truck.id) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    await repo.deleteTruck(truck.id);
    // Nicht nur den aktuellen Plan umbiegen (Befund Daten-22): jeder Plan, der das
    // gelöschte Fahrzeug referenziert, bekäme sonst über ctx()s Fallback still den
    // Sattelauflieger untergeschoben, ohne dass sich sein Ladeergebnis sichtbar ändert.
    const s1 = store.get();
    const fixPlan = p => (p.truckId === truck.id ? stamp({ ...p, truckId: DEFAULT_TRUCK_ID }) : p);
    const fixedOthers = s1.plans.map(fixPlan);
    const changedOthers = fixedOthers.filter((p, i) => p !== s1.plans[i]);
    store.update(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== truck.id), plans: fixedOthers }));
    if (changedOthers.length) await Promise.all(changedOthers.map(repo.savePlan));
    if (s1.plan.truckId === truck.id) edit(p => stamp({ ...p, truckId: DEFAULT_TRUCK_ID }));
    return;
  }
  const value = stamp(res.value);
  await repo.saveTruck(value);
  store.update(s => ({ ...s, trucks: [...s.trucks.filter(t => t.id !== value.id), value] }));
  edit(p => stamp({ ...p, truckId: value.id }));
}
$('#truck-new').onclick = () => editTruck(null);
$('#truck-edit').onclick = () => editTruck(ctx().truck);

// 3D-Ansicht
// Laden und Aktualisieren getrennt fangen (Befund Daten-16): ein Fehler beim Aktualisieren
// (z. B. kaputte Geometrie durch ein Case mit absurden Maßen) darf nicht wie ein fehlendes
// vendor/ aussehen und nicht bei jedem folgenden Frame das Laden neu versuchen.
let view3d = null, view3dLoading = null, view3dFailed = false;
renderHooks.push(async (s, d) => {
  if (s.mode !== '3d' || view3dFailed) return;
  if (!view3d) {
    try {
      view3d = await (view3dLoading ??= createView3d($('#view3d')));
    } catch {
      $('#view3d').textContent = '3D-Ansicht konnte nicht geladen werden (vendor/ fehlt?).';
      view3dFailed = true;
      view3d = null;
      view3dLoading = null;
      return;
    }
  }
  try {
    view3d.update({ truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors });
  } catch (err) {
    console.error('3D-Ansicht: Aktualisierung fehlgeschlagen', err);
  }
});

// Drucken, Sichern, Importieren
$('#print').onclick = () => {
  const s = store.get(), d = derive(s);
  buildPrint($('#print-root'), { plan: s.plan, truck: d.truck, result: d.result, colorMode: s.caseColors });
  window.print();
};

function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$('#export').onclick = () => {
  const s = store.get();
  const plans = [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)];
  downloadJSON(backupFileName(), exportBundle({ cases: s.cases, trucks: s.trucks, plans }));
};

$('#import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let bundle;
  try {
    bundle = parseBundle(await file.text());
  } catch (err) {
    alert(`Import fehlgeschlagen: ${err.message}`);
    return;
  }

  // Still eine Sicherung des aktuellen Stands anlegen, BEVOR irgendetwas überschrieben
  // wird (Befund Daten-10) – das einzige Netz, falls der Import den falschen Stand bringt.
  const s0 = store.get();
  downloadJSON(preImportBackupFileName(), exportBundle({ cases: s0.cases, trucks: s0.trucks, plans: [s0.plan, ...s0.plans] }));

  // Das Mischen passiert synchron im Store-Updater, auf dem Zustand zum Zeitpunkt des
  // Updates – nicht auf einem vor den beiden obigen await-Grenzen genommenen Schnappschuss
  // (Befund Daten-5). Zwischenzeitliche Änderungen des Nutzers gehen so nicht verloren.
  let merge;
  store.update(s => {
    merge = repo.mergeImportedBundle(s, bundle);
    return { ...s, cases: merge.cases, trucks: merge.trucks, plans: merge.plans, plan: merge.plan };
  });
  if (merge.planChanged) {
    lastSaved = merge.plan; // kommt gleich unten in die Datenbank, der Autosave muss es nicht erneut tun
    store.resetHistory();
  }

  try {
    await Promise.all([
      ...merge.winners.cases.map(repo.saveCase),
      ...merge.winners.trucks.map(repo.saveTruck),
      ...merge.winners.plans.map(repo.savePlan),
    ]);
  } catch (err) {
    alert(`Import: Schreiben in die Datenbank fehlgeschlagen (${err.message}). Die eben heruntergeladene Sicherung enthält den Stand von vorher.`);
    return;
  }
  alert(`Importiert: ${merge.winners.cases.length} Cases, ${merge.winners.trucks.length} Fahrzeuge, ${merge.winners.plans.length} Ladepläne (neuere lokale Stände behalten).`);
};

// Version sichtbar machen (einzige Quelle: js/version.js)
$('#app-version').textContent = `V ${APP_VERSION}`;
document.title = `Truckload V ${APP_VERSION}`;

// Startfehler sichtbar machen (Befund Daten-11): loadAll() ist oben schon abgefangen,
// die App läuft mit den Vorlagen weiter – aber der Nutzer muss erfahren, dass eigene Daten
// fehlen und Änderungen nicht gesichert werden, sonst wundert er sich über eine leere
// Bibliothek.
if (storageError) {
  const el = $('#storage-warning');
  el.hidden = false;
  el.textContent = 'Speicher nicht verfügbar — eigene Cases, Fahrzeuge und Ladepläne konnten nicht geladen werden, Änderungen werden nicht gesichert. Über „Importieren“ lässt sich eine Sicherungsdatei laden.';
}

// Zweiter Tab (Befund Daten-7, Nutzerentscheidung): nur erkennen und melden, kein Abgleich
// der Stände. Jeder Tab meldet sich beim Start einmal über den Kanal; ein Tab, der schon
// länger offen ist, antwortet darauf einmal selbst – so sehen am Ende beide Seiten den
// Hinweis, unabhängig davon, wer zuerst da war.
if ('BroadcastChannel' in window) {
  const tabChannel = new BroadcastChannel('truckload');
  let announced = false;
  tabChannel.onmessage = () => {
    $('#tab-warning').hidden = false;
    if (!announced) { announced = true; tabChannel.postMessage('hallo'); }
  };
  tabChannel.postMessage('hallo');
}

// Offline-Betrieb (nur über http/https, nicht über file://)
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline-Modus nicht verfügbar:', err));
}

scheduleRender();
