import { APP_VERSION } from './version.js';
import * as repo from './store/repo.js';
import { stamp } from './store/repo.js';
import { createStore } from './store/state.js';
import { screenOf, showScreen, renderStartScreen } from './app/screens.js';
import { attachKeyboard } from './app/keyboard.js';
import { createPersistence } from './app/persistence.js';
import { wirePlans } from './app/plans.js';
import { mountMaterialScreen } from './app/materialScreen.js';
import { wireImportExport } from './app/importExport.js';
import { ctxOf, deriveOf, allPlansOf, piecesOf, usage, truckUsage } from './app/core.js';
import * as A from './model/actions.js';
import { DEFAULT_TRUCK_ID } from './data/preset-trucks.js';
import { WHEEL_FACES, wheelFace } from './model/geometry.js';
import { renderView, attachTopInteractions, attachSelect } from './ui/view2d.js';
import { mountLibrary } from './ui/library.js';
import { openPackRules } from './ui/pack-rules.js';
import { rulesFor, ruleTargets, describeRule, mixTopFor } from './model/packRules.js';
import { renderInspector } from './ui/inspector.js';
import { openTruckEditor } from './ui/truck-editor.js';
import { esc } from './ui/dom.js';
import { COLOR_MODES } from './ui/caseStyle.js';
import { showAlert, showConfirm, showPrompt } from './ui/confirmDialog.js';
import { createView3d } from './ui/view3d.js';
import { attachZoom, zoomIn, zoomOut, resetZoom } from './ui/zoom2d.js';
import { buildPrint, buildChecklist, buildLabels, pageRuleFor } from './ui/print.js';
import { createAutosave } from './store/autosave.js';

// Globaler Auffangnetz-Hinweis (eigenes Element, damit er keinen wichtigeren Speicher-Hinweis in
// #storage-warning überschreibt). Früh registriert, damit auch Startfehler vor dem ersten
// await erfasst werden. Fehler, die schon per showAlert gemeldet werden, sind gefangen.
window.addEventListener('unhandledrejection', e => {
  console.error('Unbehandelte Ablehnung', e.reason);
  const el = document.getElementById('error-banner');
  const text = document.getElementById('error-banner-text');
  if (!el || !text) return;
  el.hidden = false;
  text.textContent = `Unerwarteter Fehler: ${e.reason?.message || String(e.reason)}`;
});


const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

const CASE_COLORS_KEY = 'truckload.caseColors';
function loadCaseColors() {
  try {
    const v = localStorage.getItem(CASE_COLORS_KEY);
    // Gegen COLOR_MODES prüfen statt die Liste hier ein zweites Mal von Hand zu führen – sonst
    // fällt ein künftiger vierter Modus aus localStorage still auf „Schwarz“ zurück.
    return COLOR_MODES.includes(v) ? v : 'black';
  }
  catch { return 'black'; }
}

// Ein abgelehntes loadAll() (privates Fenster mit blockiertem Speicher, korrupte
// Datenbank, deaktivierte Site-Daten) darf die Modulauswertung nicht abbrechen – sonst
// bleibt die Seite weiß, ohne jede Bedienmöglichkeit (Befund Daten-11).
let storageError = null;
let data;

// Blockierte/veraltete Verbindung sichtbar machen (Befund F1): ein DB_VERSION-Bump (wie
// 1→2 in V 0.8.5) bleibt PENDING, solange ein anderes Fenster/Tab noch eine ältere Version
// offen hält — ohne Hinweis stünde die Seite ohne Erklärung. Muss VOR repo.loadAll()
// registriert sein, damit der erste indexedDB.open() die Rückrufe schon kennt.
const blockedBannerText = 'Truckload ist in einem anderen Fenster noch in einer älteren Version geöffnet – bitte dort schließen, dann lädt diese Seite weiter.';
const versionChangeBannerText = 'Neue Version in einem anderen Fenster – bitte neu laden.';
repo.setBlockedHandler(() => {
  const el = $('#storage-warning');
  el.hidden = false;
  el.textContent = blockedBannerText;
});
repo.setUnblockedHandler(() => {
  const el = $('#storage-warning');
  if (el.textContent === blockedBannerText) el.hidden = true;
});
repo.setVersionChangeHandler(() => {
  const el = $('#storage-warning');
  el.hidden = false;
  el.textContent = versionChangeBannerText;
});

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
  cases: data.cases, trucks: data.trucks, plans: data.plans, ruleSets: data.ruleSets ?? [],
  // layerLimit ist bewusst keine localStorage-Einstellung wie caseColors: die Lagen-Durchsicht
  // ist eine Momentaufnahme, kein dauerhafter Zustand.
  plan: null, selectedId: null, materialOpen: false, mode: '2d', caseColors: loadCaseColors(), layerLimit: null,
});

function ctx(s = store.get()) {
  return ctxOf(s, uid);
}
export function derive(s = store.get()) {
  return deriveOf(s, uid);
}
export function edit(fn, history = true) {
  store.update(s => {
    const next = fn(s.plan, ctx(s));
    return next === s.plan ? s : { ...s, plan: next };
  }, { history });
}
export const select = id => store.update(s => (s.selectedId === id ? s : { ...s, selectedId: id }));

// F2+F6 (Fix-Welle 2026-09-28): nach „Alles neu packen“, „Rest einpacken“ und dem Wizard-
// Autopack meldet sich die App, wenn danach noch Stücke in der Ablage liegen – sonst merkt der
// Nutzer die Lücke nur, wenn er die Ablage zufällig aufklappt. `edit()` ist synchron, store.get()
// liefert direkt danach den frischen Stand.
async function warnIfUnplaced() {
  const n = store.get().plan.unplaced.length;
  if (!n) return;
  const msg = n === 1
    ? '1 Case passt nicht in den Truck und bleibt in „Noch nicht geladen“.'
    : `${n} Cases passen nicht in den Truck und bleiben in „Noch nicht geladen“.`;
  await showAlert(msg);
}

let frame = 0;
export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}

const startScreenEl = $('#start-screen');
const headerEl = document.querySelector('header.topbar');
const layoutEl = document.querySelector('main.layout');
const materialEl = $('#material-screen');
const screenEls = { start: startScreenEl, header: headerEl, layout: layoutEl, material: materialEl };

function render() {
  const s = store.get();
  const screen = screenOf(s);
  showScreen(screen, screenEls);
  if (screen === 'material') { material.update(s); return; }
  if (screen === 'start') {
    renderStartScreen(startScreenEl, s, {
      onMaterial: openMaterial,
      onNew: () => runLoadWizard('new'),
      // Dieselbe Eingabe wie #import-btn im (hier verborgenen) Header – Wiederherstellen auf
      // einem frischen Rechner ohne gespeicherte Pläne war sonst nur über einen Umweg-Plan
      // möglich (README: „Wiederherstellen … Importieren“).
      onImport: () => $('#import').click(),
      onPlan: id => {
        const plan = store.get().plans.find(p => p.id === id);
        if (plan) switchPlan(plan);
      },
    });
    return;
  }

  const d = derive(s);
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors, layerLimit: s.layerLimit };
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

// Speicherpfade (Case, Firma, Regelset, Fahrzeug): js/app/persistence.js
const persistence = createPersistence({ repo, store, showAlert, showConfirm, stamp, uid });

const { material, openMaterial, openMaterialFromWizard, editCase, newCaseForWizard } =
  mountMaterialScreen({ el: materialEl, store, uid, persistence });

const { switchPlan, runLoadWizard } = wirePlans({
  store, edit, ctx, autosave, repo, stamp, uid, showAlert, showConfirm, showPrompt,
  warnIfUnplaced, saveCase: persistence.saveCase, newCaseForWizard, openMaterialFromWizard,
});

const library = mountLibrary($('#library'), {
  onEdit: id => editCase(id),
  onAddLoad: () => runLoadWizard('add'),
  onTrayRemove: id => {
    edit(p => A.removeUnplaced(p, id));
    if (store.get().selectedId === id) select(null);
  },
  onSelectPlaced: id => select(id),
  onSelectUnplaced: id => select(id),
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
// Zoom/Verschieben je 2D-Ansicht (Mausrad, Trackpad, Ziehen auf freier Fläche, Knöpfe − / + / Alles).
for (const id of ['svg-top', 'svg-side', 'svg-rear']) attachZoom($(`#${id}`));
document.querySelectorAll('.zoom').forEach(el => el.addEventListener('click', e => {
  const z = e.target.closest('button')?.dataset.z;
  const svg = $(`#${el.dataset.zoom}`);
  if (z === 'in') zoomIn(svg); else if (z === 'out') zoomOut(svg); else if (z === 'all') resetZoom(svg);
}));
attachSelect($('#svg-rear'), select);

// Inspector
renderHooks.push((s, d) => {
  const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
  // Kein Placement gefunden, aber eine Auswahl gesetzt: das Stück liegt noch in der Ablage
  // (Task 2) – Label/Farbe mit demselben Rückfall auf Case-Name/Gewerkfarbe wie buildItems()
  // (js/model/items.js) es für Placements schon macht.
  let selectedUnplaced = null;
  if (!selected && s.selectedId) {
    const u = s.plan.unplaced.find(x => x.id === s.selectedId);
    const c = u && d.caseById.get(u.caseId);
    if (u && c) selectedUnplaced = { id: u.id, item: u, c, label: u.label ?? c.name, color: u.color ?? c.color };
  }
  renderInspector($('#inspector'), {
    selected,
    selectedUnplaced,
    result: d.result,
    truck: d.truck,
    groups: ruleTargets(piecesOf(s.plan), d.caseById).groups,
  });
});
const withSel = fn => { const id = store.get().selectedId; if (id) fn(id); };
// Case-Typ eines Stücks unabhängig davon finden, ob es gerade platziert oder in der Ablage
// liegt – „Case bearbeiten“ muss für beide funktionieren.
const findCaseIdForPiece = id => {
  const s = store.get();
  return s.plan.placements.find(p => p.id === id)?.caseId
    ?? s.plan.unplaced.find(u => u.id === id)?.caseId;
};
const ACTIONS = {
  rotate: id => edit((p, c) => A.rotate(p, id, c)),
  tip: id => edit((p, c) => A.cycleTip(p, id, c)),
  dup: id => edit((p, c) => A.duplicate(p, id, c)),
  tray: id => { edit(p => A.toTray(p, id)); select(null); },
  // Entf auf einem Ablage-Stück muss A.removeUnplaced treffen, nicht A.removePlacement (das
  // liefe für eine unbekannte Placement-id ins Leere und ließe das Stück in der Ablage stehen).
  delete: id => {
    const isPlaced = store.get().plan.placements.some(p => p.id === id);
    edit(p => (isPlaced ? A.removePlacement(p, id) : A.removeUnplaced(p, id)));
    select(null);
  },
  'edit-case': id => editCase(findCaseIdForPiece(id)),
  // Mit `face` setzt die Aktion genau diese Radseite (Inspector-Knopf), ohne reihum weiter.
  'wheel-face': (id, face) => {
    const p = store.get().plan.placements.find(q => q.id === id);
    if (!p) return;
    const next = face ?? WHEEL_FACES[(WHEEL_FACES.indexOf(wheelFace(p)) + 1) % WHEEL_FACES.length];
    edit((pl, c) => A.setWheelFace(pl, id, next, c));
  },
};
// Jede Nutzeraktion im Inspector erzwingt genau einen echten Neuaufbau (renderInspector überspringt
// sonst identisches HTML, obwohl das Feld z. B. nach Trimmen/Leeren noch den getippten Text zeigt).
const invalidateInspector = () => { $('#inspector').__lastHtml = null; };
$('#inspector').addEventListener('click', e => {
  invalidateInspector();
  const actEl = e.target.closest('[data-act]');
  if (actEl) return withSel(id => ACTIONS[actEl.dataset.act](id, actEl.dataset.face));
  const target = e.target.closest('[data-select]')?.dataset.select;
  if (target) select(target);
});
$('#inspector').addEventListener('change', e => {
  invalidateInspector();
  const name = e.target.name;
  const sectionEl = e.target.closest('[data-id]');
  const id = sectionEl?.dataset.id;
  if (!id) return;
  if (name === 'label') return edit((p, c) => A.setItemLabel(p, id, { label: e.target.value.trim() }));
  if (name === 'color') return edit((p, c) => A.setItemLabel(p, id, { color: e.target.value }));
  if (name === 'tipped') return edit((p, c) => A.setPieceTipped(p, id, e.target.checked, c));
  if (name === 'group') return edit(p => A.setPieceGroup(p, id, e.target.value));
  if (e.target.dataset.layer) {
    // Wie im Wizard (js/ui/load-wizard.js): letzte angehakte Lage lässt sich nicht abwählen –
    // Häkchen wieder setzen, Hinweis zeigen, keine Aktion.
    const checked = [...sectionEl.querySelectorAll('[data-layer]:checked')].map(cb => Number(cb.dataset.layer));
    const hint = sectionEl.querySelector('.wiz-layer-hint');
    if (!checked.length) {
      e.target.checked = true;
      if (hint) hint.hidden = false;
      return;
    }
    if (hint) hint.hidden = true;
    edit((p, c) => A.setPieceLayers(p, id, checked, c));
  }
});

// Tastatur: die Zuordnung Taste -> Aktion steht in js/app/keyboard.js.
attachKeyboard({
  getState: store.get,
  screenOf,
  actions: {
    ...ACTIONS,
    undo: () => store.undo(),
    redo: () => store.redo(),
    deselect: () => select(null),
    move: (id, dx, dy, step) => {
      const p = store.get().plan.placements.find(q => q.id === id);
      if (!p) return; // Ablage-Stück ausgewählt: hat kein x/y, hier nichts zu verschieben
      edit((pl, c) => A.moveGroup(pl, id, p.x + dx * step, p.y + dy * step, c, { grid: step, edges: false }));
    },
  },
});

// Undo/Redo, Modus, Auto-Pack
$('#undo').onclick = () => store.undo();
$('#redo').onclick = () => store.redo();
$('#pack-all').onclick = async () => {
  const s = store.get();
  if (s.plan.placements.length && !await showConfirm('Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)')) return;
  edit((p, c) => A.packAll(p, c));
  await warnIfUnplaced();
};
$('#pack-rest').onclick = async () => {
  edit((p, c) => A.packRest(p, c));
  await warnIfUnplaced();
};
// Pack-Regeln je Load (Spec 2026-09-30): Rangliste im eigenen Dialog, Regelsets als Vorlage.
$('#pack-rules').onclick = async () => {
  const s = store.get(), c = ctx(s);
  const res = await openPackRules($('#dlg-rules'), {
    rules: rulesFor(s.plan),
    mixTop: mixTopFor(s.plan),
    targets: ruleTargets(piecesOf(s.plan), c.caseById),
    caseById: c.caseById,
    ruleSets: [...s.ruleSets].sort((a, b) => a.name.localeCompare(b.name, 'de')),
    onSaveRuleSet: persistence.saveRuleSet,
    onDeleteRuleSet: persistence.deleteRuleSet,
  });
  if (!res) return;
  // Ein einziger Undo-Schritt für „Regeln setzen und neu packen“.
  edit((p, cx) => { const next = A.setMixTop(A.setPackRules(p, res.rules), res.mixTop); return res.repack ? A.packAll(next, cx) : next; });
  if (res.repack) await warnIfUnplaced();
};
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
$('#colors-weight').onclick = () => setCaseColors('weight');
$('#layer-limit').onchange = e => store.update(s => ({ ...s, layerLimit: e.target.value ? Number(e.target.value) : null }));
renderHooks.push(s => {
  $('#views2d').hidden = s.mode !== '2d';
  $('#view3d').hidden = s.mode !== '3d';
  $('#mode-2d').classList.toggle('on', s.mode === '2d');
  $('#mode-3d').classList.toggle('on', s.mode === '3d');
  $('#colors-black').classList.toggle('on', s.caseColors === 'black');
  $('#colors-trade').classList.toggle('on', s.caseColors === 'trade');
  $('#colors-weight').classList.toggle('on', s.caseColors === 'weight');
  // Lagen-Durchsicht wirkt in beiden Ansichten: 2D zeichnet höhere Lagen blass, 3D blendet sie
  // aus (js/ui/view3d.js). Die Auswahl bleibt deshalb immer sichtbar.
});

// Toolbar-Zustand: Planliste, Fahrzeugliste, Undo-Buttons. Die beiden <select> wurden bisher bei
// JEDEM Render neu aus Strings gebaut – auch während eines Drags, wo scheduleRender() bis zu 60×
// pro Sekunde läuft (docs/code-review-2026-09-21.md, „12. Die Toolbar baut beide <select> bei
// jedem Frame neu“). Ein aufgeklapptes <select> mit Tastaturauswahl schließt sich dabei und die
// Auswahl geht verloren. Die erzeugte Markup-Zeichenkette wird jetzt gemerkt und nur bei
// tatsächlicher Änderung zugewiesen.
let lastPlanHtml = null, lastTruckHtml = null;
renderHooks.push((s, d) => {
  const planHtml = allPlansOf(s).sort((a, b) => a.name.localeCompare(b.name, 'de')).map(p =>
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
  $('#unload-all').disabled = !s.plan.placements.length;
  $('#pack-rules').title = `Reihenfolge beim automatischen Packen: ${rulesFor(s.plan).map(r => describeRule(r, d.caseById)).join(' · ') || 'nach Name'}${mixTopFor(s.plan) ? ' · Deckschicht an' : ''}`;
});

// Fahrzeuge
$('#truck-select').onchange = e => edit(p => stamp({ ...p, truckId: e.target.value }));

async function editTruck(truck) {
  const s0 = store.get();
  const res = await openTruckEditor($('#dlg-truck'), truck, { usedIn: truck ? truckUsage(s0, truck.id) : 0 });
  if (!res) return;
  if (res.action === 'delete') {
    if (!await persistence.deleteTruck(truck.id)) return;
    if (store.get().plan.truckId === truck.id) edit(p => stamp({ ...p, truckId: DEFAULT_TRUCK_ID }), false);
    store.resetHistory(); // Undo darf den gelöschten truckId nicht zurückholen
    return;
  }
  const value = await persistence.saveTruck(res.value);
  if (!value) return;
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
    view3d.update({ truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors, layerLimit: s.layerLimit });
  } catch (err) {
    console.error('3D-Ansicht: Aktualisierung fehlgeschlagen', err);
  }
});

// Drucken, Sichern, Importieren
// Die Etikettengröße steht nicht im Store (reine Druckoptik, kein Teil des Plans) – deshalb
// hier über ein eigenes onchange ein-/ausgeblendet statt über einen Render-Hook (Task-4-Brief).
$('#print-doc').onchange = () => {
  $('#print-label-size').hidden = $('#print-doc').value !== 'labels';
};

// Die Seitenvorschrift hängt an der Druckart (pageRuleFor in js/ui/print.js): Etiketten wollen
// A4 hoch und randlos, Ladeplan und Abhakliste A4 quer. Die Regel wird NACH dem Druck wieder
// entfernt – bliebe sie stehen, druckte der nächste Ladeplan im Hochformat.
function setPrintPage(doc) {
  clearPrintPage();
  const rule = pageRuleFor(doc);
  if (!rule) return;
  const el = document.createElement('style');
  el.id = 'print-page';
  el.textContent = rule;
  document.head.appendChild(el);
}
function clearPrintPage() {
  document.getElementById('print-page')?.remove();
}
window.addEventListener('afterprint', clearPrintPage);
$('#print').onclick = () => {
  const s = store.get(), d = derive(s);
  const root = $('#print-root');
  const doc = $('#print-doc').value;
  if (doc === 'checklist') {
    root.className = 'print-root doc-checklist';
    buildChecklist(root, { plan: s.plan, truck: d.truck, result: d.result });
  } else if (doc === 'labels') {
    const size = $('#print-label-size').value;
    root.className = `print-root doc-labels size-${size}`;
    buildLabels(root, { plan: s.plan, truck: d.truck, result: d.result, size });
  } else {
    root.className = 'print-root doc-plan';
    buildPrint(root, { plan: s.plan, truck: d.truck, result: d.result, colorMode: s.caseColors });
  }
  setPrintPage(doc);
  window.print();
};

wireImportExport({ store, autosave, repo, showAlert, showConfirm });

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
$('#error-banner-close').onclick = () => { $('#error-banner').hidden = true; };
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

// Offline-Betrieb (nur über http/https, nicht über file://). sw.js lädt seit V 0.13.1 Netz zuerst
// und nimmt den Offline-Cache nur ohne Netz. `updateViaCache: 'none'` holt auch sw.js selbst nie
// aus dem HTTP-Cache, damit eine neue Version sofort erkannt wird. Sobald ein neuer Service
// Worker übernimmt (skipWaiting/clients.claim in sw.js sorgen dafür), lädt die offene Seite sich
// einmal automatisch neu, statt dass der Nutzer bis zum nächsten manuellen Reload eine Mischung
// aus altem und neuem Stand sieht (kurz neue Version, dann Rücksprung auf die alte). hadController
// verhindert einen sinnlosen Reload beim allerersten Besuch, bei dem der erste Worker die noch
// unkontrollierte Seite ganz normal übernimmt.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(err => console.warn('Offline-Modus nicht verfügbar:', err));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
}

scheduleRender();

// Marker für den Ladefehler-Hinweis in index.html: ab hier ist das Modul-Skript vollständig gelaufen.
window.__tlBooted = true;
