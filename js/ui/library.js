import { esc, swatch } from './dom.js';
import { layersOf, outerDims } from '../model/geometry.js';
import { TRUSS_PROFILES, isTruss } from '../model/truss.js';

function trussProfileLabel(width) {
  const p = TRUSS_PROFILES.find(p => p.width === width);
  return p ? p.name.split(' ')[0] : `${width} cm`;
}
function trussLabel(c) {
  const lengthM = (c.truss.length / 100).toFixed(2).replace('.', ',');
  return `Traverse ${trussProfileLabel(c.truss.width)} · ${lengthM} m · ${c.truss.count} Stück · Wagen ${c.w}er`;
}
function layerLabel(c) {
  const layers = [...layersOf(c)].sort((a, b) => a - b);
  if (layers.length === 4) return '';
  if (layers.length === 1) return `nur Lage ${layers[0]}`;
  const contiguous = layers.every((n, i) => i === 0 || n === layers[i - 1] + 1);
  return contiguous ? `Lage ${layers[0]}–${layers.at(-1)}` : `Lage ${layers.join(', ')}`;
}
function caseDetail(c) {
  const { l, w, h } = outerDims(c);
  return isTruss(c)
    ? trussLabel(c)
    : `${l}×${w}×${h} cm · ${c.weight} kg${c.tippable ? ' · tippbar' : ''}${c.stackable ? '' : ' · nicht stapelbar'}${layerLabel(c) ? ` · ${layerLabel(c)}` : ''}`;
}

const VIEWS = [
  { id: 'unplaced', label: 'Noch nicht geladen' },
  { id: 'all', label: 'Alles Material' },
];

// Seitenleiste zeigt NUR den Inhalt des aktuellen Loads (platzierte + unplatzierte Stücke),
// nicht mehr den ganzen Case-Katalog (Nutzer-Feedback 2026-09-24: „ich möchte da nur Sachen
// sehen die ich vorher im Wizard der Tour/Load hinzugefügt habe“). Einen neuen Case-Typ zum
// laufenden Load hinzufügen läuft über „+ Material hinzufügen“ (öffnet den Wizard-Katalog mit
// Suche/Filtern/Reitern, `js/ui/load-wizard.js`), das Browsing des vollen Katalogs lebt also
// dort weiter – hier nicht dupliziert.
export function mountLibrary(el, h) {
  el.innerHTML = `
    <div class="lib-head">
      <h2>Load</h2>
      <div class="lib-head-btns">
        <button data-act="load" class="primary">+ Material hinzufügen</button>
      </div>
    </div>
    <div class="seg case-tabs lib-view-toggle">${VIEWS.map((v, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-view="${v.id}">${esc(v.label)}</button>`).join('')}</div>
    <div class="lib-content"></div>`;
  const viewBtns = [...el.querySelectorAll('.lib-view-toggle button')];
  const content = el.querySelector('.lib-content');
  let view = VIEWS[0].id; // 'unplaced'
  let last = null;

  for (const btn of viewBtns) btn.addEventListener('click', () => {
    view = btn.dataset.view;
    viewBtns.forEach(b => b.classList.toggle('on', b.dataset.view === view));
    renderContent();
  });

  function groupHeading(c, caseId, count) {
    const name = c?.name ?? 'Unbekanntes Case';
    return `
      <div class="lib-group-head">
        ${swatch(c?.color)}
        <span class="lib-text"><b>${esc(name)}</b><small>${count}× ${esc(c ? caseDetail(c) : '')}</small></span>
        <button data-act="edit" data-case="${esc(caseId)}" title="${c?.builtin ? 'Als eigenes Case kopieren' : 'Bearbeiten'}">✎</button>
        ${c?.builtin ? '' : `<button data-act="delete" data-case="${esc(caseId)}" title="Löschen">🗑</button>`}
      </div>`;
  }

  function pieceRow(caseId, u, placed) {
    const c = last.byId.get(caseId);
    const color = u.color ?? c?.color ?? '#888';
    const label = u.label ?? c?.name ?? 'Unbekanntes Case';
    if (placed) {
      return `<div class="lib-item" data-case="${esc(caseId)}" data-placed="${esc(u.id)}">
        ${swatch(color)}
        <span class="lib-text">${esc(label)}</span></div>`;
    }
    return `<div class="lib-item" draggable="true" data-case="${esc(caseId)}" data-unplaced="${esc(u.id)}">
      ${swatch(color)}
      <span class="lib-text">${esc(label)}</span>
      <button data-act="tray-remove" title="Entfernen">−</button></div>`;
  }

  function renderContent() {
    if (!last) return;
    const items = view === 'all'
      ? [...last.plan.placements.map(p => ({ ...p, placed: true })), ...last.plan.unplaced.map(u => ({ ...u, placed: false }))]
      : last.plan.unplaced.map(u => ({ ...u, placed: false }));
    const groups = new Map(); // caseId -> Einträge
    for (const it of items) groups.set(it.caseId, [...(groups.get(it.caseId) ?? []), it]);
    if (groups.size === 0) {
      content.innerHTML = view === 'all'
        ? '<p class="hint">Noch kein Material in diesem Load. „+ Material hinzufügen“ öffnet den Katalog.</p>'
        : '<p class="hint">Leer. Mit „+ Material hinzufügen“ Cases anlegen, dann ziehen oder „Rest einpacken“.</p>';
      return;
    }
    content.innerHTML = [...groups].map(([caseId, entries]) => {
      const c = last.byId.get(caseId);
      const rows = entries.map(it => pieceRow(caseId, it, it.placed)).join('');
      return groupHeading(c, caseId, entries.length) + rows;
    }).join('');
  }

  el.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const caseId = btn.dataset.case ?? btn.closest('[data-case]')?.dataset.case;
    const unplacedId = btn.closest('[data-unplaced]')?.dataset.unplaced;
    ({ edit: () => h.onEdit(caseId), delete: () => h.onDelete(caseId),
       load: () => h.onAddLoad(), 'tray-remove': () => h.onTrayRemove(unplacedId) })[btn.dataset.act]?.();
  });
  content.addEventListener('click', e => {
    const placed = e.target.closest('[data-placed]');
    if (!placed || e.target.closest('button')) return;
    h.onSelectPlaced(placed.dataset.placed);
  });
  el.addEventListener('dragstart', e => {
    const item = e.target.closest('[data-unplaced]');
    if (!item) return;
    e.dataTransfer.setData('text/x-case', JSON.stringify({ caseId: item.dataset.case, unplacedId: item.dataset.unplaced }));
    e.dataTransfer.effectAllowed = 'copy';
  });

  return {
    update(state) {
      const casesChanged = !last || last.cases !== state.cases;
      const planChanged = !last || last.plan.unplaced !== state.plan.unplaced || last.plan.placements !== state.plan.placements;
      last = { cases: state.cases, plan: state.plan, byId: new Map(state.cases.map(c => [c.id, c])) };
      if (casesChanged || planChanged) renderContent();
    },
  };
}
