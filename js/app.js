// Einstieg: lädt die Daten, erzeugt den Store und verdrahtet die Module unter js/app/.
// Die Module importieren diese Datei nie; alles, was sie brauchen, bekommen sie als Parameter.
// Exportiert werden store, derive, edit, select, scheduleRender und renderHooks: die
// CDP-Browser-Szenarien (CLAUDE.md, „Prüfen“) importieren js/app.js im laufenden Browser und
// bauen damit Zustand auf, ohne durch die Oberfläche zu klicken.
import * as repo from './store/repo.js';
import { stamp } from './model/stamp.js';
import { createStore } from './store/state.js';
import { createAutosave } from './store/autosave.js';
import { screenOf, showScreen, renderStartScreen } from './app/screens.js';
import { attachKeyboard } from './app/keyboard.js';
import { createPersistence } from './app/persistence.js';
import { wirePlans } from './app/plans.js';
import { mountMaterialScreen } from './app/materialScreen.js';
import { wireImportExport } from './app/importExport.js';
import { mountPlanView, renderPlanViews, loadCaseColors } from './app/planView.js';
import { installEarlyHandlers, setSaveStatus, wirePrint, showVersion, showStorageError, wireBanners, registerServiceWorker } from './app/chrome.js';
import { ctxOf, deriveOf } from './app/core.js';
import * as A from './model/actions.js';
import { showAlert, showConfirm, showPrompt } from './ui/confirmDialog.js';

installEarlyHandlers(repo);

const $ = sel => document.querySelector(sel);
const uid = () => crypto.randomUUID();

// Ein abgelehntes loadAll() (privates Fenster mit blockiertem Speicher, korrupte Datenbank,
// deaktivierte Site-Daten) darf die Modulauswertung nicht abbrechen, sonst bliebe die Seite
// weiß, ohne jede Bedienmöglichkeit.
let storageError = null;
let data;
try {
  data = await repo.loadAll();
} catch (err) {
  storageError = err;
  data = repo.loadAllFallback();
}

// `plan` ist null, solange kein Plan gewählt ist (Startbildschirm); `plans` enthält die übrigen
// geladenen Pläne. layerLimit ist bewusst keine localStorage-Einstellung wie caseColors: die
// Lagen-Durchsicht ist eine Momentaufnahme.
export const store = createStore({
  cases: data.cases, trucks: data.trucks, plans: data.plans, ruleSets: data.ruleSets ?? [],
  plan: null, selectedId: null, materialOpen: false, mode: '2d', caseColors: loadCaseColors(), layerLimit: null,
});

const ctx = (s = store.get()) => ctxOf(s, uid);
export const derive = (s = store.get()) => deriveOf(s, uid);
export function edit(fn, history = true) {
  store.update(s => {
    const next = fn(s.plan, ctx(s));
    return next === s.plan ? s : { ...s, plan: next };
  }, { history });
}
export const select = id => store.update(s => (s.selectedId === id ? s : { ...s, selectedId: id }));

// Nach „Alles neu packen“, „Rest einpacken“ und dem Wizard-Autopack: bleiben Stücke in der
// Ablage, meldet sich die App, sonst fiele die Lücke nur beim Aufklappen der Ablage auf.
// edit() ist synchron, store.get() liefert direkt danach den frischen Stand.
async function warnIfUnplaced() {
  const n = store.get().plan.unplaced.length;
  if (!n) return;
  const msg = n === 1
    ? '1 Case passt nicht in den Truck und bleibt in „Noch nicht geladen“.'
    : `${n} Cases passen nicht in den Truck und bleiben in „Noch nicht geladen“.`;
  await showAlert(msg);
}

// Weitere Render-Schritte hängen die Module hier ein (Seitenleiste, Inspector, Werkzeugleiste, 3D).
export const renderHooks = [];

let frame = 0;
export function scheduleRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => { frame = 0; render(); });
}

const startScreenEl = $('#start-screen');
const materialEl = $('#material-screen');
const screenEls = {
  start: startScreenEl, header: document.querySelector('header.topbar'),
  layout: document.querySelector('main.layout'), material: materialEl,
};

function render() {
  const s = store.get();
  const screen = screenOf(s);
  showScreen(screen, screenEls);
  if (screen === 'material') { material.update(s); return; }
  if (screen === 'start') {
    renderStartScreen(startScreenEl, s, {
      onMaterial: openMaterial,
      onNew: () => runLoadWizard('new'),
      // Dieselbe Eingabe wie #import-btn im (hier verborgenen) Header: auf einem frischen
      // Rechner ohne Pläne ist das der einzige Weg zum Wiederherstellen.
      onImport: () => $('#import').click(),
      onPlan: id => {
        const plan = store.get().plans.find(p => p.id === id);
        if (plan) switchPlan(plan);
      },
    });
    return;
  }
  const d = derive(s);
  renderPlanViews(s, d);
  for (const fn of renderHooks) fn(s, d);
}

// Speichern: die Buchhaltung (ausstehender Plan, Debounce, Wiederholung) steckt in
// js/store/autosave.js. Hier wird nur verdrahtet.
const autosave = createAutosave({ savePlan: repo.savePlan, onStatus: setSaveStatus });

store.subscribe(s => {
  scheduleRender();
  if (s.plan) autosave.noticeChange(s.plan);
});

// Flush beim Verlassen der Seite: ein reiner Debounce verwürfe sonst die letzten 400 ms an
// Änderungen. visibilitychange ist der verlässliche Haken (beforeunload feuert auf
// Mobilgeräten oft nicht), pagehide deckt einen echten Unload ab.
window.addEventListener('pagehide', () => autosave.flush());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') autosave.flush();
});

const persistence = createPersistence({ repo, store, showAlert, showConfirm, stamp, uid });

const { material, openMaterial, openMaterialFromWizard, editCase, newCaseForWizard } =
  mountMaterialScreen({ el: materialEl, store, uid, persistence });

const { switchPlan, runLoadWizard } = wirePlans({
  store, edit, ctx, autosave, repo, stamp, uid, showAlert, showConfirm, showPrompt,
  warnIfUnplaced, saveCase: persistence.saveCase, newCaseForWizard, openMaterialFromWizard,
});

const { ACTIONS } = mountPlanView({
  store, edit, select, ctx, derive, renderHooks, persistence, stamp, showConfirm,
  editCase, runLoadWizard, warnIfUnplaced,
});

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

wirePrint({ store, derive });
wireImportExport({ store, autosave, repo, showAlert, showConfirm });

showVersion();
showStorageError(storageError);
wireBanners();
registerServiceWorker();

scheduleRender();

// Marker für den Ladefehler-Hinweis in index.html: ab hier ist das Modul-Skript vollständig gelaufen.
window.__tlBooted = true;
