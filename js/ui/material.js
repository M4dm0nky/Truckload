import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './caseInfo.js';
import { onlyInPlanCases, isInStock } from '../model/material.js';
import { collectionRows, collectionIdOf, STANDARD_ID, MEINE_ID, collectionNameError } from '../model/collections.js';
import { MAX_FIRM } from '../model/limits.js';
import { showPrompt, showAlert, showPick } from './confirmDialog.js';

// Materialverwaltung: eigener Bildschirm, immer erreichbar. Links der Sammlungsbaum, rechts das
// Material der gewählten Sammlung. Löschen gibt es NUR hier.
const ONLY_IN_PLAN = '__onlyInPlan__';

export function mountMaterial(el, h) {
  let last = null;
  let sel = STANDARD_ID;
  let tab = CASE_TABS[0].id;
  let q = '';

  const current = () => last?.collections.find(c => c.id === sel) ?? null;
  const writable = c => c && !c.readOnly;
  const isUser = c => c && c.id !== STANDARD_ID && c.id !== MEINE_ID;
  const countOf = id => last.cases.filter(c => isInStock(c) && collectionIdOf(c) === id).length;

  function rowHtml(c) {
    const readOnly = c.builtin && c.id.startsWith('preset-');
    return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${readOnly
        ? `<button data-act="copy" title="In eine Sammlung kopieren">Kopieren</button>`
        : `<button data-act="move-case" title="In eine andere Sammlung verschieben">Verschieben</button>
           <button data-act="edit" title="Bearbeiten">${icon('pencil-simple')}</button>
           <button data-act="delete" class="danger" title="Löschen">${icon('trash')}</button>`}
      ${sel === ONLY_IN_PLAN ? '<button data-act="adopt">In Bestand übernehmen</button>' : ''}
    </div>`;
  }

  function renderFrame() {
    if (!last) return;
    const cur = current();
    const rows = collectionRows(last.collections);
    el.innerHTML = `
      <div class="mat-head"><h1>Material</h1><button data-act="back">Zurück</button></div>
      <div class="mat-body">
        <nav class="mat-firms">
          ${rows.map(({ collection, depth }) => `<button data-collection="${esc(collection.id)}" class="${sel === collection.id ? 'on' : ''}" style="padding-left:${10 + depth * 14}px">${esc(collection.name)} <small>${countOf(collection.id)}</small></button>`).join('')}
          <button data-act="new-collection">+ Sammlung</button>
          <button data-act="import-collection">Sammlung importieren</button>
          <button data-collection="${ONLY_IN_PLAN}" class="${sel === ONLY_IN_PLAN ? 'on' : ''}">Nur in Ladeplänen <small>${onlyInPlanCases(last.cases).length}</small></button>
        </nav>
        <section class="mat-list">
          <div class="row">
            <div class="seg case-tabs">${CASE_TABS.map(t => `<button type="button" class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
            <input type="search" class="mat-search" placeholder="Suchen" value="${esc(q)}">
          </div>
          ${sel === ONLY_IN_PLAN ? '' : writable(cur) ? `<div class="row mat-actions">
            <button data-act="new-case">+ Neues Case</button>
            <button data-act="new-truss">+ Traverse</button>
            <button data-act="new-dolly">+ Boxen-Dolly</button>
            <button data-act="new-sub">+ Untersammlung</button>
            <span class="grow"></span>
            <button data-act="export-collection">Sammlung exportieren</button>
            ${isUser(cur) ? '<button data-act="rename-collection">Sammlung umbenennen</button><button data-act="move-collection">Sammlung verschieben</button><button data-act="delete-collection" class="danger">Sammlung löschen</button>' : ''}
          </div>` : '<p class="hint">Mitgelieferte Vorlagen, nur lesbar. „Kopieren“ legt eine eigene Version in einer Sammlung an.</p>'}
          <div class="mat-rows"></div>
        </section>
      </div>`;
  }

  function renderList() {
    const rows = el.querySelector('.mat-rows');
    if (!last || !rows) return;
    const items = sel === ONLY_IN_PLAN
      ? onlyInPlanCases(last.cases)
      : last.cases.filter(c => isInStock(c) && collectionIdOf(c) === sel);
    const needle = q.trim().toLowerCase();
    const matches = items.filter(c => !needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle));
    const shown = matches.filter(c => caseKind(c) === tab).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const empty = matches.length
      ? '<p class="hint">In diesem Reiter nichts – andere Reiter prüfen.</p>'
      : '<p class="hint">Hier ist noch nichts – „+ Neues Case“ legt etwas an.</p>';
    rows.innerHTML = shown.map(rowHtml).join('') || empty;
  }

  function render() { renderFrame(); renderList(); }

  const parentChoices = (exceptId = null) => [
    { value: '', label: 'Oberste Ebene' },
    ...collectionRows(last.collections)
      .filter(({ collection }) => !collection.readOnly && collection.id !== exceptId)
      .map(({ collection, depth }) => ({ value: collection.id, label: `${'– '.repeat(depth)}${collection.name}` })),
  ];
  async function askName(title, initial = '') {
    const raw = await showPrompt(title, initial, { maxlength: MAX_FIRM });
    if (raw == null) return null;
    const err = collectionNameError(raw, last.collections, initial ? sel : null);
    if (err) { await showAlert(err); return null; }
    return raw.trim();
  }

  el.addEventListener('input', e => {
    if (!e.target.matches('.mat-search')) return;
    q = e.target.value; renderList();
  });
  el.addEventListener('click', async e => {
    const colBtn = e.target.closest('[data-collection]');
    if (colBtn) { sel = colBtn.dataset.collection; render(); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    // Neues Material kommt nie in „Standard“ (nur lesbar) und nicht in „Nur in Ladeplänen“.
    const target = sel === ONLY_IN_PLAN || sel === STANDARD_ID ? MEINE_ID : sel;
    switch (btn.dataset.act) {
      case 'back': return h.onBack();
      case 'new-collection': {
        const name = await askName('Name der neuen Sammlung');
        if (name == null) return;
        const newId = await h.onCreateCollection(name, null);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'new-sub': {
        const name = await askName(`Neue Untersammlung in „${current().name}“`);
        if (name == null) return;
        const newId = await h.onCreateCollection(name, sel);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'rename-collection': {
        const name = await askName(`„${current().name}“ umbenennen in`, current().name);
        if (name == null || name === current().name) return;
        if (await h.onRenameCollection(sel, name)) render();
        return;
      }
      case 'move-collection': {
        const parent = await showPick(`„${current().name}“ verschieben nach`, parentChoices(sel));
        if (parent == null) return;
        if (await h.onMoveCollection(sel, parent || null)) render();
        return;
      }
      case 'delete-collection': {
        if (await h.onDeleteCollection(sel)) { sel = MEINE_ID; render(); }
        return;
      }
      case 'export-collection': return h.onExportCollection(sel);
      case 'import-collection': {
        const meta = await h.onImportCollection();
        if (meta) { sel = meta.id; render(); }
        return;
      }
      case 'move-case': {
        const to = await showPick('In welche Sammlung verschieben?', parentChoices().filter(o => o.value));
        if (to != null) await h.onMoveCase(id, to);
        return;
      }
      case 'new-case': return h.onNewCase(target);
      case 'new-truss': return h.onNewTruss(target);
      case 'new-dolly': return h.onNewDolly(target);
      case 'edit': return h.onEdit(id);
      case 'delete': return h.onDelete(id);
      case 'copy': return h.onCopy(id);
      case 'adopt': return h.onAdopt(id);
    }
  });

  return {
    update(state) {
      if (last && last.cases === state.cases && last.collections === state.collections) return;
      last = { cases: state.cases, collections: state.collections };
      if (!last.collections.some(c => c.id === sel) && sel !== ONLY_IN_PLAN) sel = STANDARD_ID;
      render();
    },
  };
}
