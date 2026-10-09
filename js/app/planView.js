// Plan-Bildschirm: Render-Hooks für Seitenleiste, Inspector, Werkzeugleiste und 3D-Ansicht,
// die 2D-Interaktionen, die Auswahl-Aktionen (ACTIONS), Packen, Fahrzeuge sowie Lagen- und
// Farbmodus. Kein Import von js/app.js; Store und Hüllen kommen als Parameter.
import * as A from '../model/actions.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { WHEEL_FACES, wheelFace } from '../model/geometry.js';
import { rulesFor, ruleTargets, describeRule, mixTopFor } from '../model/packRules.js';
import { renderView, attachTopInteractions, attachSelect } from '../ui/view2d.js';
import { mountLibrary } from '../ui/library.js';
import { openPackRules } from '../ui/pack-rules.js';
import { renderInspector } from '../ui/inspector.js';
import { openTruckEditor } from '../ui/truck-editor.js';
import { esc } from '../ui/dom.js';
import { COLOR_MODES } from '../ui/caseStyle.js';
import { createView3d } from '../ui/view3d.js';
import { attachZoom, zoomIn, zoomOut, resetZoom } from '../ui/zoom2d.js';
import { allPlansOf, piecesOf, truckUsage } from './core.js';

const $ = sel => document.querySelector(sel);

const CASE_COLORS_KEY = 'truckload.caseColors';

// Gespeicherter Farbmodus; unbekannte Werte fallen auf „Schwarz“ zurück. Geprüft wird gegen
// COLOR_MODES, damit ein künftiger weiterer Modus nicht still verloren geht.
export function loadCaseColors() {
  try {
    const v = localStorage.getItem(CASE_COLORS_KEY);
    return COLOR_MODES.includes(v) ? v : 'black';
  } catch { return 'black'; }
}

// Zeichnet die 2D-Ansichten (nur im 2D-Modus). Der Rest hängt als renderHooks an.
export function renderPlanViews(s, d) {
  if (s.mode !== '2d') return;
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors, layerLimit: s.layerLimit };
  renderView($('#svg-top'), 'top', opts);
  renderView($('#svg-side'), 'side', opts);
  renderView($('#svg-rear'), 'rear', opts);
}

// deps: store, edit, select, ctx, derive, renderHooks, persistence, stamp, showConfirm,
// editCase, runLoadWizard, warnIfUnplaced. Liefert { ACTIONS } (für die Tastatur).
export function mountPlanView(deps) {
  const { store, edit, select, ctx, derive, renderHooks, persistence, stamp, showConfirm,
    editCase, runLoadWizard, warnIfUnplaced } = deps;

  // --- Seitenleiste und 2D-Ansichten ---
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
  attachSelect($('#svg-rear'), select);
  // Zoom/Verschieben je 2D-Ansicht (Mausrad, Trackpad, Ziehen auf freier Fläche, Knöpfe − / + / Alles).
  for (const id of ['svg-top', 'svg-side', 'svg-rear']) attachZoom($(`#${id}`));
  document.querySelectorAll('.zoom').forEach(el => el.addEventListener('click', e => {
    const z = e.target.closest('button')?.dataset.z;
    const svg = $(`#${el.dataset.zoom}`);
    if (z === 'in') zoomIn(svg); else if (z === 'out') zoomOut(svg); else if (z === 'all') resetZoom(svg);
  }));

  // --- Inspector ---
  renderHooks.push((s, d) => {
    const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
    // Keine Platzierung, aber eine Auswahl: das Stück liegt noch in der Ablage – Label und
    // Farbe mit demselben Rückfall auf Case-Name/Gewerkfarbe wie buildItems() (js/model/items.js).
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
  // Case-Typ eines Stücks finden, egal ob platziert oder in der Ablage – „Case bearbeiten“
  // muss für beide funktionieren.
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
    // Entf auf einem Ablage-Stück muss A.removeUnplaced treffen: A.removePlacement liefe für
    // eine unbekannte Placement-id ins Leere und ließe das Stück in der Ablage stehen.
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
  // Jede Nutzeraktion im Inspector erzwingt genau einen echten Neuaufbau: renderInspector
  // überspringt sonst identisches HTML, obwohl das Feld nach Trimmen/Leeren noch den
  // getippten Text zeigt.
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
      // Wie im Wizard (js/ui/load-wizard.js): die letzte angehakte Lage lässt sich nicht
      // abwählen – Häkchen wieder setzen, Hinweis zeigen, keine Aktion.
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

  // --- Werkzeugleiste: Undo/Redo, Packen, Entladen ---
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
  // Pack-Regeln je Load: Rangliste im eigenen Dialog, Regelsets als Vorlage.
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

  // --- Modus, Farbmodus, Lagen ---
  // Die Handler setzen nur den Store; der Render-Hook unten leitet Sichtbarkeit und
  // Schalterstellung einheitlich aus `s.mode`/`s.caseColors` ab (auch beim ersten Render).
  $('#mode-2d').onclick = () => store.update(s => ({ ...s, mode: '2d' }));
  $('#mode-3d').onclick = () => store.update(s => ({ ...s, mode: '3d' }));
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
  });

  // Plan- und Fahrzeugliste sowie Undo-Knöpfe. Die beiden <select> würden bei jedem Render
  // neu gebaut, auch während eines Drags (bis zu 60× pro Sekunde); ein aufgeklapptes <select>
  // schlösse sich dabei. Deshalb wird das erzeugte Markup gemerkt und nur bei Änderung gesetzt.
  let lastPlanHtml = null, lastTruckHtml = null;
  renderHooks.push((s, d) => {
    const planHtml = allPlansOf(s).sort((a, b) => a.name.localeCompare(b.name, 'de')).map(p =>
      `<option value="${esc(p.id)}" ${p.id === s.plan.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    if (planHtml !== lastPlanHtml) $('#plan-select').innerHTML = lastPlanHtml = planHtml;
    // Vorlagen bleiben vorn in fester Reihenfolge (Array.prototype.sort ist stabil), eigene
    // Fahrzeuge folgen alphabetisch.
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

  // --- Fahrzeuge ---
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

  // --- 3D-Ansicht ---
  // Laden und Aktualisieren getrennt fangen: ein Fehler beim Aktualisieren (z. B. kaputte
  // Geometrie durch ein Case mit absurden Maßen) soll nicht wie ein fehlendes vendor/ aussehen
  // und nicht bei jedem Frame das Laden neu versuchen.
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
        // createView3d() räumt bei einem Fehler im eigenen Aufbau den WebGL-Kontext selbst auf,
        // bevor es wirft; hier gibt es deshalb nie ein view3d-Objekt, das freizugeben wäre.
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

  return { ACTIONS };
}
