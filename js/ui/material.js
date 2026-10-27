import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './caseInfo.js';
import { onlyInPlanCases, isInStock, istUeberlagerung, ausgeblendeteUeberlagerungen } from '../model/material.js';
import { collectionRows, collectionIdOf, STANDARD_ID, MEINE_ID, MEINE_NAME, collectionNameError } from '../model/collections.js';
import { MAX_FIRM } from '../model/limits.js';
import { showPrompt, showAlert, showPick } from './confirmDialog.js';
import { t } from '../i18n/i18n.js';

// Materialverwaltung: eigener Bildschirm, immer erreichbar. Links der Sammlungsbaum, rechts das
// Material der gewählten Sammlung. Löschen gibt es NUR hier.
const ONLY_IN_PLAN = '__onlyInPlan__';
const HIDDEN = '__hidden__'; // ausgeblendete Listen-Cases, nur zum Wiederherstellen

// Anzeigename einer Sammlung: nur die feste „Meine Sammlung“ wird übersetzt, andere Namen sind Nutzerdaten.
const collName = c => (c.id === MEINE_ID ? t(MEINE_NAME) : c.name);

export function mountMaterial(el, h) {
  let last = null;
  let sel = STANDARD_ID;
  let tab = CASE_TABS[0].id;
  let q = '';

  const current = () => last?.collections.find(c => c.id === sel) ?? null;
  const writable = c => c && !c.readOnly;
  const isUser = c => c && c.id !== STANDARD_ID && c.id !== MEINE_ID;
  const countOf = id => last.cases.filter(c => isInStock(c) && collectionIdOf(c) === id).length;

  const shipped = () => h.shipped ?? [];
  const restoreBtn = () => `<button data-act="restore-original" title="${t('Überlagerung entfernen: es gilt wieder die mitgelieferte Fassung (und künftige Korrekturen daran)')}">${t('Original wiederherstellen')}</button>`;

  function rowHtml(c) {
    const readOnly = c.builtin && c.id.startsWith('preset-');
    if (sel === HIDDEN) {
      return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${restoreBtn()}
    </div>`;
    }
    return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${istUeberlagerung(c, shipped()) && sel !== ONLY_IN_PLAN ? restoreBtn() : ''}
      ${readOnly
        ? `<button data-act="copy" title="${t('In eine Sammlung kopieren')}">${t('Kopieren')}</button>`
        : `${sel === ONLY_IN_PLAN ? '' : `<button data-act="move-case" title="${t('In eine andere Sammlung verschieben')}">${t('Verschieben', null, 'move')}</button>`}
           <button data-act="edit" title="${t('Bearbeiten')}">${icon('pencil-simple')}</button>
           <button data-act="delete" class="danger" title="${t('Löschen')}">${icon('trash')}</button>`}
      ${sel === ONLY_IN_PLAN ? `<button data-act="adopt">${t('In Bestand übernehmen')}</button>` : ''}
    </div>`;
  }

  function renderFrame() {
    if (!last) return;
    const cur = current();
    const rows = collectionRows(last.collections);
    el.innerHTML = `
      <div class="mat-head"><h1>${t('Material')}</h1><button data-act="back">${t('Zurück')}</button></div>
      <div class="mat-body">
        <nav class="mat-firms">
          ${rows.map(({ collection, depth }) => `<button data-collection="${esc(collection.id)}" class="${sel === collection.id ? 'on' : ''}" style="padding-left:${10 + depth * 14}px">${esc(collName(collection))} <small>${countOf(collection.id)}</small></button>`).join('')}
          <button data-act="new-collection">${t('+ Sammlung')}</button>
          <button data-act="import-collection">${t('Sammlung importieren')}</button>
          <button data-collection="${ONLY_IN_PLAN}" class="${sel === ONLY_IN_PLAN ? 'on' : ''}">${t('Nur in Ladeplänen')} <small>${onlyInPlanCases(last.cases).length}</small></button>
          ${ausgeblendeteUeberlagerungen(last.cases, shipped()).length ? `<button data-collection="${HIDDEN}" class="${sel === HIDDEN ? 'on' : ''}" title="${t('Gelöschte Listen-Cases – hier lässt sich die mitgelieferte Fassung zurückholen')}">${t('Ausgeblendet')} <small>${ausgeblendeteUeberlagerungen(last.cases, shipped()).length}</small></button>` : ''}
        </nav>
        <section class="mat-list">
          <div class="row">
            <div class="seg case-tabs">${CASE_TABS.map(ct => `<button type="button" class="${ct.id === tab ? 'on' : ''}" data-tab="${ct.id}">${esc(ct.label)}</button>`).join('')}</div>
            <input type="search" class="mat-search" placeholder="${t('Suchen')}" value="${esc(q)}">
          </div>
          ${sel === ONLY_IN_PLAN || sel === HIDDEN ? '' : writable(cur) ? `<div class="row mat-actions">
            <button data-act="new-case">${t('+ Neues Case')}</button>
            <button data-act="new-truss">${t('+ Traverse')}</button>
            <button data-act="new-dolly">${t('+ Boxen-Dolly')}</button>
            <button data-act="new-sub">${t('+ Untersammlung')}</button>
            <span class="grow"></span>
            <button data-act="export-collection">${t('Sammlung exportieren')}</button>
            ${isUser(cur) ? `<button data-act="rename-collection">${t('Sammlung umbenennen')}</button><button data-act="move-collection">${t('Sammlung verschieben')}</button><button data-act="delete-collection" class="danger">${t('Sammlung löschen')}</button>` : ''}
          </div>` : `<p class="hint">${t('Mitgelieferte Vorlagen, nur lesbar. „Kopieren“ legt eine eigene Version in einer Sammlung an.')}</p>`}
          <div class="mat-rows"></div>
        </section>
      </div>`;
  }

  function renderList() {
    const rows = el.querySelector('.mat-rows');
    if (!last || !rows) return;
    const items = sel === ONLY_IN_PLAN
      ? onlyInPlanCases(last.cases)
      : sel === HIDDEN ? ausgeblendeteUeberlagerungen(last.cases, shipped())
      : last.cases.filter(c => isInStock(c) && collectionIdOf(c) === sel);
    const needle = q.trim().toLowerCase();
    const matches = items.filter(c => !needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle));
    const shown = matches.filter(c => caseKind(c) === tab).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    const empty = matches.length
      ? `<p class="hint">${t('In diesem Reiter nichts – andere Reiter prüfen.')}</p>`
      : `<p class="hint">${t('Hier ist noch nichts – „+ Neues Case“ legt etwas an.')}</p>`;
    rows.innerHTML = shown.map(rowHtml).join('') || empty;
  }

  function render() { renderFrame(); renderList(); }

  const parentChoices = (exceptId = null) => [
    { value: '', label: t('Oberste Ebene') },
    ...collectionRows(last.collections)
      .filter(({ collection }) => !collection.readOnly && collection.id !== exceptId)
      .map(({ collection, depth }) => ({ value: collection.id, label: `${'– '.repeat(depth)}${collName(collection)}` })),
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
        const name = await askName(t('Name der neuen Sammlung'));
        if (name == null) return;
        const newId = await h.onCreateCollection(name, null);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'new-sub': {
        const name = await askName(t('Neue Untersammlung in „{name}“', { name: collName(current()) }));
        if (name == null) return;
        const newId = await h.onCreateCollection(name, sel);
        if (newId) { sel = newId; render(); }
        return;
      }
      case 'rename-collection': {
        const name = await askName(t('„{name}“ umbenennen in', { name: current().name }), current().name);
        if (name == null || name === current().name) return;
        if (await h.onRenameCollection(sel, name)) render();
        return;
      }
      case 'move-collection': {
        const parent = await showPick(t('„{name}“ verschieben nach', { name: current().name }), parentChoices(sel));
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
        const to = await showPick(t('In welche Sammlung verschieben?'), parentChoices().filter(o => o.value));
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
      case 'restore-original': return h.onRestoreOriginal(id);
    }
  });

  return {
    update(state) {
      if (last && last.cases === state.cases && last.collections === state.collections) return;
      last = { cases: state.cases, collections: state.collections };
      if (sel === HIDDEN && !ausgeblendeteUeberlagerungen(last.cases, shipped()).length) sel = MEINE_ID;
      if (!last.collections.some(c => c.id === sel) && sel !== ONLY_IN_PLAN && sel !== HIDDEN) sel = STANDARD_ID;
      render();
    },
  };
}
