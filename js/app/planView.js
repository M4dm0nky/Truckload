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
import { renderInspector, weightEditable } from '../ui/inspector.js';
import { CASE_LIMITS } from '../model/limits.js';
import { openTruckEditor } from '../ui/truck-editor.js';
import { esc } from '../ui/dom.js';
import { COLOR_MODES } from '../ui/caseStyle.js';
import { createView3d } from '../ui/view3d.js';
import { attachZoom, zoomIn, zoomOut, resetZoom, getScrollMode, setScrollMode, nextScrollMode, SCROLL_LABELS, SCROLL_SHORT } from '../ui/zoom2d.js';
import { allPlansOf, piecesOf, truckUsage, NO_LKW, activeLkwOf, packAllOf, repointTruck, distributionNotices } from './core.js';
import { lkwsOf, isMultiLkw, addLkw, updateLkw, removeLkw, moveToLkw } from '../model/lkw.js';
import { mountLkwTabs, lkwTabsModel } from '../ui/lkw-tabs.js';
import { openLkwEditor } from '../ui/lkw-editor.js';

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
  if (s.mode !== '2d' || d.activeLkw === NO_LKW) return;
  const opts = { truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors, layerLimit: s.layerLimit };
  renderView($('#svg-top'), 'top', opts);
  renderView($('#svg-side'), 'side', opts);
  renderView($('#svg-rear'), 'rear', opts);
}

// deps: store, edit, editWhole, select, ctx, derive, renderHooks, persistence, stamp, uid, showAlert,
// showConfirm, editCase, runLoadWizard, warnIfUnplaced. Liefert { ACTIONS } (für die Tastatur).
export function mountPlanView(deps) {
  const { store, edit, editWhole, select, ctx, derive, renderHooks, persistence, stamp, uid, showAlert,
    showConfirm, editCase, runLoadWizard, warnIfUnplaced } = deps;

  // Der gewählte, echte LKW (null bei Ein-LKW-Plänen und im Reiter „Ohne LKW“).
  const realLkw = (s = store.get()) => {
    const id = activeLkwOf(s.plan, s.activeLkw);
    return id === NO_LKW ? null : id;
  };
  // Fahrzeug des gewählten LKW ändern (Ein-LKW-Plan: das Fahrzeug des Plans wie bisher).
  const withTruck = (p, truckId) => {
    if (!isMultiLkw(p)) return stamp({ ...p, truckId });
    const id = realLkw();
    return id ? updateLkw(p, id, { truckId }) : p;
  };
  const setActive = id => store.update(s => (s.activeLkw === id ? s : { ...s, activeLkw: id, selectedId: null }));

  // --- Reiterleiste und LKW-Dialog ---
  async function addLkwFlow() {
    const s = store.get();
    const res = await openLkwEditor($('#dlg-lkw'), null, { trucks: s.trucks, defaultTruckId: ctx(s).truck.id });
    if (res?.action !== 'save') return;
    const before = new Set(lkwsOf(store.get().plan).map(l => l.id));
    editWhole(p => addLkw(p, res.value, uid));
    const added = lkwsOf(store.get().plan).find(l => !before.has(l.id));
    if (added) setActive(added.id);
  }
  async function editLkwFlow() {
    const s = store.get();
    const id = realLkw(s);
    if (!id) return;
    const lkw = lkwsOf(s.plan).find(l => l.id === id);
    const res = await openLkwEditor($('#dlg-lkw'), lkw, {
      trucks: s.trucks, isLast: lkwsOf(s.plan).length === 1,
      pieces: piecesOf(s.plan).filter(x => x.lkw === id).length,
    });
    if (!res) return;
    if (res.action === 'delete') {
      editWhole(p => removeLkw(p, id));
      setActive(null); // fällt auf den ersten LKW zurück (activeLkwOf)
      return;
    }
    editWhole(p => updateLkw(p, id, res.value));
  }
  const tabs = mountLkwTabs($('#lkw-tabs'), { onSelect: setActive, onAdd: addLkwFlow, onEdit: editLkwFlow });
  $('#lkw-multi').onclick = addLkwFlow;
  renderHooks.push((s, d) => {
    const multi = d.activeLkw !== null;
    tabs.update(multi ? lkwTabsModel({ plan: s.plan, trucks: s.trucks, caseById: d.caseById, active: d.activeLkw }) : null);
    $('#lkw-multi').hidden = multi;
    const none = d.activeLkw === NO_LKW;
    $('#lkw-none-hint').hidden = !none;
    // Im Reiter „Ohne LKW“ gibt es kein Fahrzeug und keine Platzierung: diese Knöpfe ruhen.
    for (const id of ['truck-select', 'truck-edit', 'pack-rest']) $(`#${id}`).disabled = none;
  });

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
  // Seitenleiste: Stücke des gewählten LKW (Reiter „Ohne LKW“: die nicht zugeordneten, ohne Fahrzeug).
  renderHooks.push((s, d) => library.update({ ...s, plan: d.view }, d.activeLkw === NO_LKW ? null : d.truck));

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
    else if (z === 'scroll') { setScrollMode(nextScrollMode(getScrollMode())); syncScrollButtons(); }
  }));
  // Beschriftung der Umschalter in allen drei Ansichten angleichen.
  function syncScrollButtons() {
    const mode = getScrollMode();
    document.querySelectorAll('.zoom [data-z="scroll"]').forEach(b => {
      b.textContent = SCROLL_SHORT[mode];
      b.setAttribute('aria-label', `Scrollen: ${SCROLL_LABELS[mode]} – Klick wechselt`);
    });
  }
  syncScrollButtons();

  // --- Inspector ---
  renderHooks.push((s, d) => {
    const selected = d.result.items.find(it => it.id === s.selectedId) ?? null;
    // Keine Platzierung, aber eine Auswahl: das Stück liegt noch in der Ablage – Label und
    // Farbe mit demselben Rückfall auf Case-Name/Gewerkfarbe wie buildItems() (js/model/items.js).
    let selectedUnplaced = null;
    if (!selected && s.selectedId) {
      const u = d.view.unplaced.find(x => x.id === s.selectedId);
      const c = u && d.caseById.get(u.caseId);
      if (u && c) selectedUnplaced = { id: u.id, item: u, c, label: u.label ?? c.name, color: u.color ?? c.color };
    }
    renderInspector($('#inspector'), {
      selected,
      selectedUnplaced,
      result: d.result,
      truck: d.truck,
      groups: ruleTargets(piecesOf(s.plan), d.caseById).groups,
      lkw: d.activeLkw === null ? null : {
        options: lkwsOf(s.plan).map(l => ({ id: l.id, name: l.name })),
        current: d.activeLkw === NO_LKW ? null : d.activeLkw,
        name: lkwsOf(s.plan).find(l => l.id === d.activeLkw)?.name,
        none: d.activeLkw === NO_LKW,
      },
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
    tip: id => edit((p, c) => A.toggleTipPiece(p, id, c)),
    dup: id => edit((p, c) => A.duplicate(p, id, c)),
    tray: id => { edit(p => A.toTray(p, id)); select(null); },
    // Entf auf einem Ablage-Stück muss A.removeUnplaced treffen: A.removePlacement liefe für
    // eine unbekannte Placement-id ins Leere und ließe das Stück in der Ablage stehen.
    delete: id => {
      // Ansicht des gewählten Reiters, nicht der ganze Plan: im Reiter „Ohne LKW“ liegt auch eine
      // Platzierung ohne gültigen LKW als Ablage-Zeile vor.
      const isPlaced = derive().view.placements.some(p => p.id === id);
      edit(p => (isPlaced ? A.removePlacement(p, id) : A.removeUnplaced(p, id)));
      select(null);
    },
    'edit-case': id => editCase(findCaseIdForPiece(id)),
    // Mit `face` setzt die Aktion genau diese Radseite (Inspector-Knopf), ohne reihum weiter.
    'wheel-face': (id, face) => {
      const p = derive().view.placements.find(q => q.id === id);
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
  // Gewicht des Case-Typs ändern (Inspector): speichert den Typ (bei `lib-` als Überlagerung mit
  // gleicher ID) – alle Stücke dieses Typs folgen über den Store. Ungültig (leer, negativ, über der
  // Grenze): Feld zurücksetzen, nichts speichern.
  async function changeWeight(input, id) {
    const c = ctx().caseById.get(findCaseIdForPiece(id));
    if (!c || !weightEditable(c)) return;
    const value = input.value.trim() === '' ? NaN : Number(input.value);
    if (!(value >= 0 && value <= CASE_LIMITS.weight)) { input.value = c.weight; return; }
    if (value === c.weight) return;
    const saved = await persistence.saveCase({ ...c, builtin: false, weight: value });
    invalidateInspector();
    if (!saved) input.value = c.weight;
  }
  $('#inspector').addEventListener('change', e => {
    invalidateInspector();
    const name = e.target.name;
    const sectionEl = e.target.closest('[data-id]');
    const id = sectionEl?.dataset.id;
    if (!id) return;
    if (name === 'lkw') {
      // Stück einem LKW (oder „Ohne LKW“) zuordnen; der Reiter folgt, die Auswahl bleibt.
      const target = e.target.value || null;
      editWhole(p => moveToLkw(p, id, target));
      store.update(st => ({ ...st, activeLkw: target ?? NO_LKW }));
      return;
    }
    if (name === 'label') return edit((p, c) => A.setItemLabel(p, id, { label: e.target.value.trim() }));
    if (name === 'color') return edit((p, c) => A.setItemLabel(p, id, { color: e.target.value }));
    if (name === 'tipped') return edit((p, c) => A.setPieceTipped(p, id, e.target.checked, c));
    if (name === 'group') return edit(p => A.setPieceGroup(p, id, e.target.value));
    if (name === 'weight') return changeWeight(e.target, id);
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
  // Nach dem Verteilen: Stücke ohne LKW (je Gewerk) und Stücke, die in ihrem LKW keinen Platz fanden.
  async function warnAfterDistribution() {
    const s = store.get();
    const lines = distributionNotices(s.plan, ctx(s).caseById);
    if (lines.length) await showAlert(lines.join(' · '));
  }
  $('#pack-all').onclick = async () => {
    const s = store.get();
    const multi = isMultiLkw(s.plan);
    // Bei mehreren LKW ordnet „Alles neu packen“ auch die Zuordnung neu: Rückfrage, sobald es Stücke gibt.
    const needsAsk = multi && lkwsOf(s.plan).length >= 2 ? piecesOf(s.plan).length > 0 : s.plan.placements.length > 0;
    const question = multi && lkwsOf(s.plan).length >= 2
      ? 'Alle Cases neu auf die LKW verteilen und anordnen? (Rückgängig mit ⌘Z möglich)'
      : 'Alle Cases neu anordnen? (Rückgängig mit ⌘Z möglich)';
    if (needsAsk && !await showConfirm(question)) return;
    editWhole((p, c) => packAllOf(p, c));
    if (multi) await warnAfterDistribution();
    else await warnIfUnplaced();
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
    const multi = isMultiLkw(s.plan);
    editWhole((p, cx) => { const next = A.setMixTop(A.setPackRules(p, res.rules), res.mixTop); return res.repack ? packAllOf(next, cx) : next; });
    if (res.repack) await (multi ? warnAfterDistribution() : warnIfUnplaced());
  };
  $('#unload-all').onclick = async () => {
    const s = store.get();
    if (!derive(s).view.placements.length) return;
    const where = isMultiLkw(s.plan) ? 'diesem LKW' : 'dem Truck';
    if (!await showConfirm(`Alle Cases aus ${where} zurück nach „Noch nicht geladen“ legen? (Rückgängig mit ⌘Z möglich)`)) return;
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
  renderHooks.push((s, d) => {
    // Im Reiter „Ohne LKW“ gibt es nichts zu zeichnen (Hinweis statt Fahrzeugansicht).
    const none = d.activeLkw === NO_LKW;
    $('#views2d').hidden = s.mode !== '2d' || none;
    $('#view3d').hidden = s.mode !== '3d' || none;
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
    $('#unload-all').disabled = !d.view.placements.length;
    $('#pack-rules').title = `Reihenfolge beim automatischen Packen: ${rulesFor(s.plan).map(r => describeRule(r, d.caseById)).join(' · ') || 'nach Name'}${mixTopFor(s.plan) ? ' · Deckschicht an' : ''}`;
  });

  // --- Fahrzeuge ---
  $('#truck-select').onchange = e => editWhole(p => withTruck(p, e.target.value));

  async function editTruck(truck) {
    const s0 = store.get();
    const res = await openTruckEditor($('#dlg-truck'), truck, { usedIn: truck ? truckUsage(s0, truck.id) : 0 });
    if (!res) return;
    if (res.action === 'delete') {
      if (!await persistence.deleteTruck(truck.id)) return;
      editWhole(p => repointTruck(p, truck.id, DEFAULT_TRUCK_ID), false); // ändert nur, was auf das Fahrzeug zeigt
      store.resetHistory(); // Undo darf den gelöschten truckId nicht zurückholen
      return;
    }
    const value = await persistence.saveTruck(res.value);
    if (!value) return;
    editWhole(p => withTruck(p, value.id));
  }
  $('#truck-new').onclick = () => editTruck(null);
  $('#truck-edit').onclick = () => editTruck(ctx().truck);

  // --- 3D-Ansicht ---
  // Laden und Aktualisieren getrennt fangen: ein Fehler beim Aktualisieren (z. B. kaputte
  // Geometrie durch ein Case mit absurden Maßen) soll nicht wie ein fehlendes vendor/ aussehen
  // und nicht bei jedem Frame das Laden neu versuchen.
  let view3d = null, view3dLoading = null, view3dFailed = false;
  renderHooks.push(async (s, d) => {
    const stale = $('#view3d-stale');
    if (s.mode !== '3d' || d.activeLkw === NO_LKW) { if (stale) stale.hidden = true; return; }
    if (view3dFailed) return;
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
      if (stale) stale.hidden = true;
    } catch (err) {
      console.error('3D-Ansicht: Aktualisierung fehlgeschlagen', err);
      // Die Szene zeigt den Stand vor dem Fehler: kleiner Hinweis (eigenes Element, nur textContent),
      // verschwindet beim nächsten erfolgreichen update() oder im Wechsel auf 2D.
      if (stale) { stale.textContent = '3D-Ansicht nicht aktuell – bitte Ansicht wechseln'; stale.hidden = false; }
    }
  });

  return { ACTIONS };
}
