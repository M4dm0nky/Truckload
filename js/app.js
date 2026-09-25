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
import { showAlert, showConfirm, showPrompt } from './ui/confirmDialog.js';
import { createView3d } from './ui/view3d.js';
import { buildPrint } from './ui/print.js';
import { exportBundle, parseBundle, backupFileName, preImportBackupFileName } from './store/io.js';
import { createAutosave } from './store/autosave.js';

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

// store/edit/select bleiben exportiert (nicht nur intern gebraucht): die CDP-Browser-Szenarien
// unter „Prüfen“ (CLAUDE.md) importieren `js/app.js` im laufenden Browser und rufen sie direkt
// auf, um Zustand aufzubauen, ohne durch die Oberfläche zu klicken (`app.store.get()`,
// `app.edit(...)`, `app.select(id)`) — geprüft anhand vorhandener Szenarien aus vorigen Tasks.
// `ctx` wird dort nirgends direkt gebraucht (Aufrufer holen sich `derive(...).truck`/`.caseById`
// bzw. übergeben `ctx` intern) und ist deshalb nicht mehr exportiert
// (docs/code-review-2026-09-21.md, „zehn zu weit offene Exporte“).
// `plan` ist jetzt nullable: null heißt „kein Plan gewählt“, der Startbildschirm ist aktiv.
// `plans` enthält weiterhin ALLE geladenen Pläne (für die Liste im Startbildschirm), ohne
// Sonderbehandlung.
export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans,
  plan: null, selectedId: null, mode: '2d', caseColors: loadCaseColors(),
});

function ctx(s = store.get()) {
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

const startScreenEl = $('#start-screen');
const headerEl = document.querySelector('header.topbar');
const layoutEl = document.querySelector('main.layout');

// Startbildschirm: kein Plan gewählt. Eigener, viel einfacherer Render-Pfad statt der
// vollen Pipeline unten (renderHooks setzen durchgehend einen vorhandenen s.plan voraus).
// Header und Hauptbereich bleiben `hidden`, solange kein Plan aktiv ist – dieselbe
// Umschaltung, mit der render() unten wieder zurückwechselt.
function renderStartScreen(s) {
  headerEl.hidden = true;
  layoutEl.hidden = true;
  startScreenEl.hidden = false;

  const plans = [...s.plans].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const listHtml = plans.length
    ? `<ul class="start-plans">${plans.map(p => `
        <li><button class="start-plan-item" type="button" data-plan-id="${esc(p.id)}">${esc(p.name)}</button></li>
      `).join('')}</ul>`
    : `<p class="start-hint">Noch keine gespeicherten Ladepläne.</p>`;
  $('#start-actions').innerHTML = `
    <button id="start-new" class="primary" type="button">Neuen Load erstellen</button>
    ${listHtml}
    <button id="start-import" type="button" title="JSON-Sicherung einlesen">Sicherung importieren</button>
  `;
  $('#start-new').onclick = () => runLoadWizard('new');
  // Dieselbe Eingabe wie #import-btn im (hier verborgenen) Header – Wiederherstellen auf
  // einem frischen Rechner ohne gespeicherte Pläne war sonst nur über einen Umweg-Plan
  // möglich (README: „Wiederherstellen … Importieren“).
  $('#start-import').onclick = () => $('#import').click();
  for (const btn of startScreenEl.querySelectorAll('.start-plan-item')) {
    btn.onclick = () => {
      const plan = store.get().plans.find(p => p.id === btn.dataset.planId);
      if (plan) switchPlan(plan);
    };
  }
}

function render() {
  const s = store.get();
  if (!s.plan) { renderStartScreen(s); return; }
  startScreenEl.hidden = true;
  headerEl.hidden = false;
  layoutEl.hidden = false;

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

// --- Speichern -------------------------------------------------------------------------
//
// Die Buchhaltung selbst (welcher Plan ist ausstehend, Debounce mit Obergrenze,
// Wiederholung nach Fehlschlag) steckt jetzt in js/store/autosave.js – reine Logik ohne
// DOM/IndexedDB, mit node --test prüfbar (Fix-Runde 2: sechs gezielte Rückbauten dieser
// Regeln blieben bei 275/275 grün, solange sie nur hier in app.js lagen). Hier wird nur
// noch verdrahtet: die Statusanzeige, wann ein Plan als "bekannt" statt "geändert" gilt,
// und wann der Autosave für einen Plan stillgelegt wird (Import).
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

const autosave = createAutosave({ savePlan: repo.savePlan, onStatus: setSaveStatus });

store.subscribe(s => {
  scheduleRender();
  if (s.plan) autosave.noticeChange(s.plan);
});

// Flush beim Verlassen der Seite (Befund Daten-3): ein reiner Debounce ohne das hier würde
// die letzten <400 ms an Änderungen beim Schließen des Tabs oder beim Wegwechseln auf dem
// Tablet verwerfen. visibilitychange ist der verlässliche Haken (beforeunload wird auf
// Mobilgeräten oft nicht gefeuert), pagehide zusätzlich für den Fall eines echten Unloads.
window.addEventListener('pagehide', () => autosave.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave.flush();
});

const usage = (s, caseId) => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .filter(p => [...p.placements, ...p.unplaced].some(x => x.caseId === caseId)).length;

// Bug F (nit, Fix-Runde 2): dieselbe Klasse wie die schon behobenen Löschzweige - eine
// abgelehnte repo.saveCase() darf nicht unbehandelt bleiben, sonst zeigt die Oberfläche im
// Erfolgsfall stillschweigend nichts an und im Fehlerfall gar nichts.
async function saveCaseValue(rawValue) {
  const value = stamp(rawValue);
  try {
    await repo.saveCase(value);
  } catch (err) {
    await showAlert(`Case konnte nicht gespeichert werden: ${err?.message ?? 'unbekannter Fehler'}`);
    return undefined;
  }
  store.update(st => ({ ...st, cases: [...st.cases.filter(x => x.id !== value.id), value] }));
  return value;
}

async function editCase(caseId) {
  const s = store.get();
  const c = caseId ? s.cases.find(x => x.id === caseId) : null;
  const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    try {
      await repo.deleteCase(caseId);
    } catch (err) {
      await showAlert(`Case konnte nicht gelöscht werden: ${err?.message ?? 'unbekannter Fehler'}`);
      return;
    }
    store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
  } else {
    await saveCaseValue(res.value);
  }
}

// Direkt-Löschen aus der Bibliotheksliste (ohne den Umweg über „Bearbeiten“ → Löschen im
// Editor-Dialog) – gleiche Logik wie der Löschzweig in editCase() oben, nur ohne Dialog-Öffnen.
async function deleteCaseDirect(caseId) {
  const s = store.get();
  const c = s.cases.find(x => x.id === caseId);
  if (!c) return;
  const used = usage(s, caseId);
  const msg = used ? `„${c.name}“ wird in ${used} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${c.name}“ löschen?`;
  if (!await showConfirm(msg, { okLabel: 'Löschen', danger: true })) return;
  try {
    await repo.deleteCase(caseId);
  } catch (err) {
    await showAlert(`Case konnte nicht gelöscht werden: ${err?.message ?? 'unbekannter Fehler'}`);
    return;
  }
  store.update(st => ({ ...st, cases: st.cases.filter(x => x.id !== caseId) }));
}

// Für den Load-Wizard: legt ein neues Case über den Case-Editor an (optional mit Vorbelegung,
// z. B. für den „Sonderbau“-Schnellentwurf) und liefert es zurück, ohne den Wizard zu schließen.
async function newCaseForWizard(draft) {
  const res = await openCaseEditor($('#dlg-case'), null, { draft });
  return res?.action === 'save' ? saveCaseValue(res.value) : null;
}

async function runLoadWizard(mode) {
  const s = store.get();
  // ctx() setzt einen aktiven Plan voraus (s.plan.truckId) – im Startbildschirm (mode
  // 'new', noch kein Plan gewählt) fehlt der, deshalb hier auf das Standardfahrzeug
  // ausweichen statt ctx() blind aufzurufen.
  const res = await openLoadWizard($('#dlg-wizard'), {
    mode,
    cases: s.cases,
    trucks: s.trucks,
    defaultTruckId: s.plan ? ctx().truck.id : DEFAULT_TRUCK_ID,
    defaultName: `Load ${new Date().toLocaleDateString('de-DE')}`,
    onNewCase: newCaseForWizard,
    trussDlg: $('#dlg-truss'),
    onNewTruss: saveCaseValue,
  });
  if (!res) return;
  if (mode === 'new') switchPlan(A.emptyPlan(uid(), res.name, res.truckId));
  edit((p, c) => {
    let next = res.items.reduce((pl, it) =>
      A.addUnplaced(pl, it.caseId, 1, uid, {
        labels: it.label ? [it.label] : [],
        color: it.color ?? null,
        layers: it.layers,
        tipped: it.tipped,
      }), p);
    if (res.autoPack) next = A.packRest(next, c);
    return next;
  });
}

const library = mountLibrary($('#library'), {
  onEdit: id => editCase(id),
  onDelete: id => deleteCaseDirect(id),
  onAddLoad: () => runLoadWizard('add'),
  onTrayRemove: id => edit(p => A.removeUnplaced(p, id)),
  onSelectPlaced: id => select(id),
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
    edit((p, cx) => A.placeCase(p, caseId, { x: x - c.l / 2, y: y - c.w / 2 }, cx, { fromUnplacedId: unplacedId }));
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
  const id = e.target.closest('[data-id]')?.dataset.id;
  if (!id) return;
  if (name === 'label') return edit((p, c) => A.setItemLabel(p, id, { label: e.target.value.trim() }));
  if (name === 'color') return edit((p, c) => A.setItemLabel(p, id, { color: e.target.value }));
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
$('#pack-all').onclick = async () => {
  const s = store.get();
  if (s.plan.placements.length && !await showConfirm('Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)')) return;
  edit((p, c) => A.packAll(p, c));
};
$('#pack-rest').onclick = () => edit((p, c) => A.packRest(p, c));
$('#unload-all').onclick = async () => {
  if (!store.get().plan.placements.length) return;
  if (!await showConfirm('Alle Cases aus dem Truck zurück nach „Noch nicht geladen“ legen? (Rückgängig mit ⌘Z möglich)')) return;
  edit(p => A.unloadAll(p));
  select(null);
};
// setMode/setCaseColors schrieben DOM-Zustand (hidden/classList) bisher direkt UND an den
// renderHooks vorbei, zusätzlich verdoppelt durch zwei manuelle Startzeilen für caseColors (die
// für mode ganz fehlten) – abgeleiteter Zustand an drei Stellen statt an einer
// (docs/code-review-2026-09-21.md, „19. setMode/setCaseColors schreiben DOM-Zustand an den
// Render-Hooks vorbei“). Die Funktionen setzen jetzt nur noch den Store; ein renderHook unten
// leitet die Toolbar-Klassen/-Sichtbarkeit einheitlich aus `s.mode`/`s.caseColors` ab – auch beim
// allerersten Render, was die beiden Startzeilen überflüssig macht.
function setMode(mode) { store.update(s => ({ ...s, mode })); }
$('#mode-2d').onclick = () => setMode('2d');
$('#mode-3d').onclick = () => setMode('3d');
function setCaseColors(mode) {
  store.update(s => ({ ...s, caseColors: mode }));
  try { localStorage.setItem(CASE_COLORS_KEY, mode); } catch { /* kein Speicher verfügbar */ }
}
$('#colors-black').onclick = () => setCaseColors('black');
$('#colors-trade').onclick = () => setCaseColors('trade');
renderHooks.push(s => {
  $('#views2d').hidden = s.mode !== '2d';
  $('#view3d').hidden = s.mode !== '3d';
  $('#mode-2d').classList.toggle('on', s.mode === '2d');
  $('#mode-3d').classList.toggle('on', s.mode === '3d');
  $('#colors-black').classList.toggle('on', s.caseColors === 'black');
  $('#colors-trade').classList.toggle('on', s.caseColors === 'trade');
});

// Toolbar-Zustand: Planliste, Fahrzeugliste, Undo-Buttons. Die beiden <select> wurden bisher bei
// JEDEM Render neu aus Strings gebaut – auch während eines Drags, wo scheduleRender() bis zu 60×
// pro Sekunde läuft (docs/code-review-2026-09-21.md, „12. Die Toolbar baut beide <select> bei
// jedem Frame neu“). Ein aufgeklapptes <select> mit Tastaturauswahl schließt sich dabei und die
// Auswahl geht verloren. Die erzeugte Markup-Zeichenkette wird jetzt gemerkt und nur bei
// tatsächlicher Änderung zugewiesen.
const allPlans = s => [s.plan, ...s.plans.filter(p => p.id !== s.plan.id)]
  .sort((a, b) => a.name.localeCompare(b.name, 'de'));
let lastPlanHtml = null, lastTruckHtml = null;
renderHooks.push((s, d) => {
  const planHtml = allPlans(s).map(p =>
    `<option value="${esc(p.id)}" ${p.id === s.plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  if (planHtml !== lastPlanHtml) $('#plan-select').innerHTML = lastPlanHtml = planHtml;
  // Eigene Fahrzeuge kamen (wie eigene Cases, s. js/ui/caseGroups.js) sonst in
  // IndexedDB-Schlüsselreihenfolge (docs/code-review-2026-09-21.md, „9. … Dasselbe gilt für
  // trucks“) – Vorlagen bleiben vorn in ihrer festen Reihenfolge (Array.prototype.sort ist
  // stabil), eigene Fahrzeuge werden untereinander alphabetisch sortiert.
  const sortedTrucks = [...s.trucks].sort((a, b) =>
    a.builtin === b.builtin ? a.name.localeCompare(b.name, 'de') : a.builtin ? -1 : 1);
  const truckHtml = sortedTrucks.map(t =>
    `<option value="${esc(t.id)}" ${t.id === d.truck.id ? 'selected' : ''}>${esc(t.name)}${t.builtin ? '' : ' ★'} – ${t.l}×${t.w}×${t.h}</option>`).join('');
  if (truckHtml !== lastTruckHtml) $('#truck-select').innerHTML = lastTruckHtml = truckHtml;
  $('#undo').disabled = !store.canUndo();
  $('#redo').disabled = !store.canRedo();
});

// Ladepläne
// Ein reiner Wechsel zu einem schon bekannten Plan ist keine Änderung AN ihm:
// autosave.markKnown() wird deshalb VOR dem store.update() aufgerufen, damit die
// Änderungserkennung im subscribe-Hook den Wechsel nicht selbst als "geändert" wertet.
// Ohne das schreibt der Autosave 400 ms später den lokal zwischengespeicherten (u. U.
// veralteten) Plan zurück – mit einem zweiten Tab wird daraus echter Datenverlust: Tab 2
// speichert eine Änderung, Tab 1 wechselt nur auf denselben Plan aus seinem eigenen,
// älteren `s.plans`-Cache und überschreibt sie wieder (Befund: „ein reiner Planwechsel
// überschreibt den neueren Stand eines zweiten Tabs“).
// Ein wirklich NEUER, nie gespeicherter Plan (Duplikat, Wizard „Neu“, Ersatzplan nach dem
// Löschen des letzten) ist dagegen nicht bekannt – markKnown() bleibt dann aus, und er
// bekommt sein erstes Speichern automatisch über den normalen Mechanismus (Befund: „ein
// nie geschriebener Plan gilt sonst fälschlich als sauber, solange dirty nicht explizit an
// jeder Aufrufstelle gesetzt wird“).
// `plan` kann jetzt auch dann übergeben werden, wenn store.get().plan noch null ist (Wechsel
// aus dem Startbildschirm heraus, sowohl „Neuen Load erstellen“ als auch das Öffnen eines
// vorhandenen Plans aus der Liste) – der bisherige Plan wird dann einfach nicht mit in
// `plans` zurückgelegt, statt fälschlich `null` dort einzutragen.
function switchPlan(plan) {
  autosave.flush(); // ausstehende Änderungen des bisherigen Plans sofort sichern (auch mehrfach ausstehende)
  const cur = store.get().plan;
  const known = cur?.id === plan.id || store.get().plans.some(p => p.id === plan.id);
  if (known) autosave.markKnown(plan);
  store.update(s => ({
    ...s,
    plans: [...(s.plan ? [s.plan] : []), ...s.plans.filter(p => p.id !== s.plan?.id && p.id !== plan.id)],
    plan,
    selectedId: null,
  }));
  store.resetHistory();
}
$('#plan-select').onchange = e => {
  const next = store.get().plans.find(p => p.id === e.target.value);
  if (next) switchPlan(next);
};
$('#plan-new').onclick = () => runLoadWizard('new');
$('#plan-rename').onclick = async () => {
  const name = await showPrompt('Neuer Name:', store.get().plan.name);
  if (name?.trim()) edit(p => stamp({ ...p, name: name.trim() }));
};
$('#plan-dup').onclick = () => {
  const p = store.get().plan;
  switchPlan(stamp({ ...structuredClone(p), id: uid(), name: `${p.name} (Kopie)` }));
};
$('#plan-del').onclick = async () => {
  const s = store.get();
  if (!await showConfirm(`Ladeplan „${s.plan.name}“ löschen?`, { okLabel: 'Löschen', danger: true })) return;
  try {
    await repo.deletePlan(s.plan.id);
  } catch (err) {
    await showAlert(`Löschen fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`);
    return;
  }
  // Erst NACH dem erfolgreichen Löschen die ausstehende Speicherung dieses Plans
  // verwerfen (Befund: vorher hätte ein fehlgeschlagenes deletePlan einen echten
  // ausstehenden Stand ersatzlos verworfen, obwohl der Plan weiter existiert).
  autosave.forget(s.plan.id);
  const rest = s.plans.filter(p => p.id !== s.plan.id);
  // Bleiben noch andere Pläne übrig, wechselt die Oberfläche wie bisher direkt zu einem davon
  // (Plankontinuität während der Arbeit – ein eigenes, bestehendes Verhalten). Ist das der
  // LETZTE Plan, führt „Löschen“ jetzt zurück zum Startbildschirm (plan: null) statt
  // automatisch einen neuen leeren Plan zu erzeugen.
  const next = rest[0] ?? null;
  if (next && rest.some(p => p.id === next.id)) autosave.markKnown(next); // sonst: neu, braucht sein erstes Speichern
  store.update(st => ({ ...st, plans: rest.filter(p => p.id !== next?.id), plan: next, selectedId: null }));
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
    try {
      await repo.deleteTruck(truck.id);
    } catch (err) {
      await showAlert(`Fahrzeug konnte nicht gelöscht werden: ${err?.message ?? 'unbekannter Fehler'}`);
      return;
    }
    // Nicht nur den aktuellen Plan umbiegen (Befund Daten-22): jeder Plan, der das
    // gelöschte Fahrzeug referenziert, bekäme sonst über ctx()s Fallback still den
    // Sattelauflieger untergeschoben, ohne dass sich sein Ladeergebnis sichtbar ändert.
    const s1 = store.get();
    const fixPlan = p => (p.truckId === truck.id ? stamp({ ...p, truckId: DEFAULT_TRUCK_ID }) : p);
    const fixedOthers = s1.plans.map(fixPlan);
    const changedOthers = fixedOthers.filter((p, i) => p !== s1.plans[i]);
    store.update(s => ({ ...s, trucks: s.trucks.filter(t => t.id !== truck.id), plans: fixedOthers }));
    if (changedOthers.length) {
      try {
        await Promise.all(changedOthers.map(repo.savePlan));
      } catch (err) {
        // Unbehandelt hätte das eine tote Rejection UND einen toten truckId-Verweis
        // hinterlassen, der stehen bleibt, weil niemand davon erfährt (Befund:
        // „Löschzweige ohne Fehlerbehandlung“).
        await showAlert(`Fahrzeug gelöscht, aber ${changedOthers.length} Plan(e) konnten nicht aktualisiert werden: ${err?.message ?? 'unbekannter Fehler'}. Bitte prüfen und ggf. erneut speichern.`);
      }
    }
    if (s1.plan.truckId === truck.id) edit(p => stamp({ ...p, truckId: DEFAULT_TRUCK_ID }));
    return;
  }
  const value = stamp(res.value);
  try {
    await repo.saveTruck(value);
  } catch (err) {
    await showAlert(`Fahrzeug konnte nicht gespeichert werden: ${err?.message ?? 'unbekannter Fehler'}`);
    return;
  }
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
    } catch (err) {
      console.error('3D-Ansicht: Laden fehlgeschlagen', err);
      $('#view3d').textContent = '3D-Ansicht konnte nicht geladen werden (vendor/ fehlt?).';
      view3dFailed = true;
      // `createView3d()` räumt bei einem Fehler während des eigenen Aufbaus (OrbitControls,
      // Texturen, ResizeObserver, …) den bereits erzeugten WebGL-Kontext selbst auf, bevor es
      // wirft (js/ui/view3d.js, Befund I6) – hier gibt es dafür nie ein `view3d`-Objekt: entweder
      // ist `createView3d()` schon vor dem `return` gescheitert (dann wurde nie zugewiesen), oder
      // ein früherer Durchlauf hat `view3d` bereits auf `null` gesetzt (dieser Zweig läuft nur
      // innerhalb von `if (!view3d)`).
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

// Inhalt der zuletzt heruntergeladenen Vor-Import-Sicherung, damit sie sich bei Bedarf
// erneut anbieten lässt (Befund: downloadJSON weiß nicht, ob die Datei je ankommt, z. B.
// wenn der Nutzer den Speicherdialog des Browsers abbricht).
let lastPreImportBackup = null;

// Vorher ein <label class="btn"> um das versteckte <input type="file">: ein <label> ist kein
// fokussierbares Bedienelement, „Importieren“ war per Tastatur nicht erreichbar, während alle
// Nachbarn <button> sind (docs/code-review-2026-09-21.md, „N11 — Kleinigkeiten in index.html“).
$('#import-btn').onclick = () => $('#import').click();
$('#import').onchange = async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  let bundle;
  try {
    bundle = parseBundle(await file.text());
  } catch (err) {
    await showAlert(`Import fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`);
    return;
  }

  // Still eine Sicherung des aktuellen Stands anlegen, BEVOR irgendetwas überschrieben
  // wird (Befund Daten-10) – das einzige Netz, falls der Import den falschen Stand bringt.
  const s0 = store.get();
  const backupName = preImportBackupFileName();
  // s0.plan ist null, wenn der Import vom Startbildschirm ausgelöst wird (Task 1: kein Plan
  // automatisch angelegt) – dann gibt es keinen aktuellen Plan, der in die Sicherung
  // gehört, nur die schon gespeicherten.
  const backupText = exportBundle({ cases: s0.cases, trucks: s0.trucks, plans: s0.plan ? [s0.plan, ...s0.plans] : s0.plans });
  lastPreImportBackup = { name: backupName, text: backupText };
  downloadJSON(backupName, backupText);

  // Den Autosave für den aktuellen Plan für die Dauer des Imports stilllegen (Befund: „der
  // Import läuft gegen den eigenen Autosave“). exclude() nimmt einen schon wartenden oder
  // gerade fehlschlagenden Eintrag vollständig aus der Buchhaltung heraus (parkt ihn) –
  // sonst könnte sein Timer (oder ein pagehide/visibilitychange-Flush) währenddessen den
  // alten, ungesicherten Stand über den frisch importierten schreiben, ohne dass jemand es
  // bemerkt. saveImportWinners() schreibt diesen Plan (falls die Datei ihn gewinnt) selbst.
  // Ohne aktuellen Plan (Startbildschirm) gibt es nichts stillzulegen.
  if (s0.plan) autosave.exclude(s0.plan.id);
  let merge;
  let importFailed = false;
  let importErr = null;
  try {
    // Das Mischen passiert synchron im Store-Updater, auf dem Zustand zum Zeitpunkt des
    // Updates – nicht auf einem vor den beiden obigen await-Grenzen genommenen Schnappschuss
    // (Befund Daten-5). Zwischenzeitliche Änderungen des Nutzers gehen so nicht verloren.
    store.update(s => {
      merge = repo.mergeImportedBundle(s, bundle);
      return { ...s, cases: merge.cases, trucks: merge.trucks, plans: merge.plans, plan: merge.plan };
    });
    // Eine einzige Transaktion statt unabhängiger Promise.all-Schreibvorgänge (Befund:
    // „Teil-Import lässt Store und Datenbank auseinanderlaufen“ ging tiefer, als es zuerst
    // aussah – unabhängige db.put()-Aufrufe je Datensatz können TEILWEISE erfolgreich sein,
    // bevor Promise.all insgesamt ablehnt, sodass ein Rollback der Oberfläche auf s0 nicht
    // mehr zur Datenbank passt. saveImportWinners() schreibt alles oder nichts.)
    await repo.saveImportWinners(merge.winners);
  } catch (err) {
    importFailed = true;
    importErr = err;
    // Teilfehlschlag: Store und Datenbank sind jetzt auseinandergelaufen, die Oberfläche
    // zeigt möglicherweise Daten, die nicht (vollständig) geschrieben wurden. Zurück auf
    // den Stand vor dem Import – der ist noch da (s0) und stimmt mit der Datenbank überein
    // (Befund: „Teil-Import lässt Store und Datenbank auseinanderlaufen“).
    store.update(s => ({ ...s, cases: s0.cases, trucks: s0.trucks, plans: s0.plans, plan: s0.plan }));
  } finally {
    // include() gehört in ein finally: würfe irgendetwas zwischen exclude() und hier, bliebe
    // der Autosave für diesen Plan sonst den Rest der Sitzung stumm tot. restore:true, wenn
    // entweder der Import fehlschlug ODER der lokale Stand gewonnen hat (merge.planChanged
    // === false) – in beiden Fällen wurde ein vorher geparkter, ausstehender eigener Stand
    // NICHT mitgeschrieben und muss weiter als ausstehend gelten. `merge` kann bei einem
    // Fehler vor der Zuweisung undefined geblieben sein, daher der sichere Optional-Chain.
    if (s0.plan) autosave.include(s0.plan.id, { restore: importFailed || !merge?.planChanged });
  }

  if (importFailed) {
    const retry = await showConfirm(
      `Import: Schreiben in die Datenbank fehlgeschlagen (${importErr?.message ?? 'unbekannter Fehler'}). ` +
      'Der Stand von vorher ist wiederhergestellt. Sicherung von eben erneut herunterladen?',
    );
    if (retry) downloadJSON(lastPreImportBackup.name, lastPreImportBackup.text);
    return;
  }

  if (merge.planChanged) store.resetHistory();
  // Reparaturen an reparierbaren Altwerten (zu lange Beschriftung, Rollenhöhe ≥ Case-Höhe –
  // beide bis V0.6 durch Wizard/Editor entstanden) werden gemeldet, statt stillschweigend zu
  // passieren, damit der Nutzer erkennt, was und wie viele Datensätze angepasst wurden
  // (Befund „eine Sicherung aus V 0.5 oder V 0.6 kann heute komplett unlesbar sein“).
  const repairNote = bundle.repairs.length ? `\n\nBeim Import angepasst:\n– ${bundle.repairs.join('\n– ')}` : '';
  await showAlert(`Importiert: ${merge.winners.cases.length} Cases, ${merge.winners.trucks.length} Fahrzeuge, ${merge.winners.plans.length} Ladepläne (neuere lokale Stände behalten).${repairNote}`);
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
// Kleinigkeit aus der Review: ohne Schließen-Knopf steht der Hinweis den Rest der Sitzung
// falsch da, sobald der andere Tab längst zu ist.
$('#tab-warning-close').onclick = () => { $('#tab-warning').hidden = true; };

if ('BroadcastChannel' in window) {
  const tabChannel = new BroadcastChannel('truckload');
  let announced = false;
  tabChannel.onmessage = () => {
    $('#tab-warning').hidden = false;
    if (!announced) { announced = true; tabChannel.postMessage('hallo'); }
  };
  tabChannel.postMessage('hallo');
}

// Offline-Betrieb (nur über http/https, nicht über file://). sw.js selbst bleibt cache-first
// (Offline-Fähigkeit bleibt erhalten) – hier nur der fehlende Teil: sobald ein neuer Service
// Worker übernimmt (skipWaiting/clients.claim in sw.js sorgen dafür), lädt die offene Seite sich
// einmal automatisch neu, statt dass der Nutzer bis zum nächsten manuellen Reload eine Mischung
// aus altem und neuem Stand sieht (kurz neue Version, dann Rücksprung auf die alte). hadController
// verhindert einen sinnlosen Reload beim allerersten Besuch, bei dem der erste Worker die noch
// unkontrollierte Seite ganz normal übernimmt.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('Offline-Modus nicht verfügbar:', err));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

scheduleRender();
