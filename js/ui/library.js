import { esc, swatch } from './dom.js';
import { CATEGORIES } from '../data/categories.js';
import { layersOf, outerDims } from '../model/geometry.js';
import { TRUSS_PROFILES, isTruss } from '../model/truss.js';
import { companiesOf, groupCases, renderGroupList } from './caseGroups.js';

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

export function mountLibrary(el, h) {
  el.innerHTML = `
    <div class="lib-head">
      <h2>Cases</h2>
      <div class="lib-head-btns">
        <button data-act="load" class="primary">+ Cases hinzufügen</button>
        <button data-act="new">+ Neues Case</button>
      </div>
    </div>
    <input type="search" class="lib-search" placeholder="Suchen (Name oder Inhalt)">
    <select class="lib-filter lib-filter-cat"><option value="">Alle Gewerke</option>${CATEGORIES.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
    <select class="lib-filter lib-filter-company"><option value="">Alle Firmen</option></select>
    <div class="lib-list"></div>
    <h3>Noch nicht verladen</h3>
    <div class="tray"></div>`;
  const search = el.querySelector('.lib-search');
  const filter = el.querySelector('.lib-filter-cat');
  const companyFilter = el.querySelector('.lib-filter-company');
  const list = el.querySelector('.lib-list');
  const tray = el.querySelector('.tray');
  let last = null;

  const row = c => {
    const { l, w, h } = outerDims(c);
    const companySuffix = c.company ? ` · ${esc(c.company)}` : '';
    return `
    <div class="lib-item" draggable="true" data-case="${esc(c.id)}" title="${esc([c.content, c.note].filter(Boolean).join(' · '))}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b>
        <small>${isTruss(c)
          ? esc(trussLabel(c))
          : `${l}×${w}×${h} cm · ${c.weight} kg${c.tippable ? ' · tippbar' : ''}${c.stackable ? '' : ' · nicht stapelbar'}${layerLabel(c) ? ` · ${esc(layerLabel(c))}` : ''}`}${companySuffix}</small></span>
      <button data-act="add" title="Über den Wizard hinzufügen (packt direkt, Häkchen abwählbar)">+</button>
      <button data-act="edit" title="${c.builtin ? 'Als eigenes Case kopieren' : 'Bearbeiten'}">✎</button>
    </div>`;
  };

  function renderCompanyOptions() {
    const prev = companyFilter.value;
    const companies = companiesOf(last.cases);
    companyFilter.innerHTML = `<option value="">Alle Firmen</option>${companies.map(name => `<option${name === prev ? ' selected' : ''}>${esc(name)}</option>`).join('')}`;
    if (!companies.includes(prev)) companyFilter.value = '';
  }

  function renderList() {
    if (!last) return;
    const groups = groupCases(last.cases, { q: search.value, cat: filter.value, company: companyFilter.value });
    renderGroupList(list, groups, row, {
      own: '<p class="hint">Noch keine eigenen Cases – „+ Neues Case“ oder eine Vorlage kopieren.</p>',
      presetsHeading: ' <small>(Richtwerte)</small>',
      presets: '<p class="hint">Keine Treffer für diese Filter.</p>',
      list: '<p class="hint">Keine Treffer für diese Filter.</p>',
    });
  }

  // Bis Task 8 eine Zeile je Case-Typ mit der Farbe des ERSTEN Stücks für die ganze Gruppe und
  // einem „−“, das `removeUnplaced(plan, caseId)` traf – also das erste Vorkommen dieses Typs,
  // nicht das vom Nutzer gemeinte (docs/code-review-2026-09-21.md, Nachtrag Controller: „Die
  // Ablage zeigt … die Farbe des ersten Stücks als Aussage über alle“; Task-8-Brief: „removeUnplaced
  // trifft das erste Stück eines Case-Typs, nicht ein bestimmtes … das ist spürbar und gehört
  // behoben“). Jetzt eine Zeile JE STÜCK: eigene Farbe, eigene Beschriftung, eigenes „−“ über die
  // Stück-`id` (nicht mehr über `caseId`) – ehrlich für gemischte Farben und gezielt entfernbar.
  // Gleiche Case-Typen bleiben optisch unter einer schmalen Zählzeile gruppiert, damit eine Ablage
  // mit vielen gleichen Cases nicht unübersichtlich wird.
  function renderTray() {
    const byId = new Map(last.cases.map(c => [c.id, c]));
    const groups = new Map(); // caseId -> unplaced-Einträge
    for (const u of last.plan.unplaced) groups.set(u.caseId, [...(groups.get(u.caseId) ?? []), u]);
    tray.innerHTML = [...groups].map(([caseId, items]) => {
      const c = byId.get(caseId);
      const heading = items.length > 1
        ? `<p class="hint tray-count">${items.length}× ${esc(c?.name ?? 'Unbekanntes Case')}</p>` : '';
      const rows = items.map(u => {
        const color = u.color ?? c?.color ?? '#888';
        const label = u.label ?? c?.name ?? 'Unbekanntes Case';
        return `<div class="lib-item" draggable="true" data-case="${esc(caseId)}" data-unplaced="${esc(u.id)}">
          ${swatch(color)}
          <span class="lib-text"><b>${esc(label)}</b></span>
          <button data-act="tray-remove" title="Entfernen">−</button></div>`;
      }).join('');
      return heading + rows;
    }).join('') || '<p class="hint">Leer. Mit „+“ Cases hierher legen, dann ziehen oder „Rest einpacken“.</p>';
  }

  search.addEventListener('input', renderList);
  filter.addEventListener('change', renderList);
  companyFilter.addEventListener('change', renderList);
  el.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const caseId = btn.closest('[data-case]')?.dataset.case;
    // tray-remove zielt auf die eigene Stück-id (nicht den Case-Typ) – s. renderTray().
    const unplacedId = btn.closest('[data-unplaced]')?.dataset.unplaced;
    ({ new: () => h.onNew(), add: () => h.onAdd(caseId), edit: () => h.onEdit(caseId),
       load: () => h.onAddLoad(), 'tray-remove': () => h.onTrayRemove(unplacedId) })[btn.dataset.act]?.();
  });
  el.addEventListener('dragstart', e => {
    const item = e.target.closest('[data-case]');
    if (!item) return;
    e.dataTransfer.setData('text/x-case', JSON.stringify({ caseId: item.dataset.case, unplacedId: item.dataset.unplaced ?? null }));
    e.dataTransfer.effectAllowed = 'copy';
  });

  return {
    update(state) {
      const casesChanged = !last || last.cases !== state.cases;
      // `plan.unplaced` ist nur eine von mehreren Referenzen in `state.plan` – Aktionen, die nur
      // Placements ändern (z. B. moveGroup während eines Drags), geben ein neues `plan`-Objekt
      // zurück, lassen `plan.unplaced` dabei aber unverändert stehen (kein Spread dieses Felds).
      // Ein Vergleich der Referenz reicht also, um echte Änderungen der Ablage von den bis zu 60
      // Renderaufrufen pro Sekunde während eines Drags zu unterscheiden, ohne die Ablage jedes Mal
      // neu aus dem DOM aufzubauen (docs/code-review-2026-09-21.md, „S5 — Inspector und Ablage
      // nicht bei jedem Bild neu bauen“, hier nur der risikolose Teil: die Ablage).
      const trayChanged = !last || last.plan.unplaced !== state.plan.unplaced;
      last = state;
      if (casesChanged) renderCompanyOptions();
      if (casesChanged) renderList();
      // casesChanged auch hier: ein bearbeitetes Case (Name/Farbe) muss sich in der Ablage
      // spiegeln, auch wenn plan.unplaced selbst unverändert blieb.
      if (casesChanged || trayChanged) renderTray();
    },
  };
}
