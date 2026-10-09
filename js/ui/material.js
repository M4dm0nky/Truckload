import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './caseInfo.js';
import { companyList, casesOf, onlyInPlanCases, firmNameError } from '../model/material.js';
import { MAX_FIRM } from '../model/limits.js';
import { showPrompt, showAlert } from './confirmDialog.js';

// Materialverwaltung (V 0.12.5, Spec 2026-10-09-materialverwaltung-design.md): eigener Bildschirm,
// immer erreichbar. Links Standardkatalog + Firmen, rechts deren Material. Löschen gibt es NUR hier.
const STANDARD = '';
const ONLY_IN_PLAN = '__onlyInPlan__';

export function mountMaterial(el, h) {
  let last = null;
  let sel = STANDARD;
  let tab = CASE_TABS[0].id;
  let q = '';
  const extra = new Set(); // frisch angelegte, noch leere Firmen (nur UI-Zustand, Spec)

  function rowHtml(c) {
    const readOnly = c.builtin && c.id.startsWith('preset-');
    return `<div class="mat-row" data-case="${esc(c.id)}">
      ${swatch(c.color)}
      <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
      ${readOnly
        ? `<button data-act="copy" title="In eine Firma kopieren">Kopieren</button>`
        : `<button data-act="edit" title="Bearbeiten">${icon('pencil-simple')}</button>
           <button data-act="delete" class="danger" title="Löschen">${icon('trash')}</button>`}
      ${sel === ONLY_IN_PLAN ? '<button data-act="adopt">In Bestand übernehmen</button>' : ''}
    </div>`;
  }

  // Kopf, Firmenliste, Reiter, Suchfeld und Aktionen. Die Zeilen selbst baut renderList().
  function renderFrame() {
    if (!last) return;
    const companies = companyList(last.cases, [...extra]);
    const isFirm = sel !== STANDARD && sel !== ONLY_IN_PLAN;
    el.innerHTML = `
      <div class="mat-head"><h1>Material</h1><button data-act="back">Zurück</button></div>
      <div class="mat-body">
        <nav class="mat-firms">
          <button data-firm="${STANDARD}" class="${sel === STANDARD ? 'on' : ''}">Standardkatalog</button>
          ${companies.map(f => `<button data-firm="${esc(f.name)}" class="${sel === f.name ? 'on' : ''}">${esc(f.name)} <small>${f.count}</small></button>`).join('')}
          <button data-act="new-firm">+ Firma</button>
          <button data-firm="${ONLY_IN_PLAN}" class="${sel === ONLY_IN_PLAN ? 'on' : ''}">Nur in Ladeplänen <small>${onlyInPlanCases(last.cases).length}</small></button>
        </nav>
        <section class="mat-list">
          <div class="row">
            <div class="seg case-tabs">${CASE_TABS.map(t => `<button type="button" class="${t.id === tab ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
            <input type="search" class="mat-search" placeholder="Suchen" value="${esc(q)}">
          </div>
          ${sel === ONLY_IN_PLAN ? '' : `<div class="row mat-actions">
            <button data-act="new-case">+ Neues Case</button>
            <button data-act="new-truss">+ Traverse</button>
            <button data-act="new-dolly">+ Boxen-Dolly</button>
            ${isFirm ? '<span class="grow"></span><button data-act="rename-firm">Firma umbenennen</button><button data-act="delete-firm" class="danger">Firma löschen</button>' : ''}
          </div>`}
          <div class="mat-rows"></div>
        </section>
      </div>`;
  }

  // Nur die Zeilen (bzw. der Leerhinweis): beim Tippen in der Suche bleibt der Rest samt
  // Fokus, Cursor und Scrollposition unberührt.
  function renderList() {
    const rows = el.querySelector('.mat-rows');
    if (!last || !rows) return;
    const items = sel === ONLY_IN_PLAN ? onlyInPlanCases(last.cases) : casesOf(last.cases, sel);
    const needle = q.trim().toLowerCase();
    const matches = items.filter(c => !needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle));
    const shown = matches.filter(c => caseKind(c) === tab).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    // Zähler links zählen alle Reiter – ist dieser Reiter leer, aber ein anderer nicht, sagen wir das.
    const empty = matches.length
      ? '<p class="hint">In diesem Reiter nichts – andere Reiter prüfen.</p>'
      : '<p class="hint">Hier ist noch nichts – „+ Neues Case“ legt etwas an.</p>';
    rows.innerHTML = shown.map(rowHtml).join('') || empty;
  }

  function render() { renderFrame(); renderList(); }

  el.addEventListener('input', e => {
    if (!e.target.matches('.mat-search')) return;
    q = e.target.value; renderList();
  });
  el.addEventListener('click', async e => {
    const firmBtn = e.target.closest('[data-firm]');
    if (firmBtn) { sel = firmBtn.dataset.firm; render(); return; }
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    const target = sel === ONLY_IN_PLAN ? STANDARD : sel;
    switch (btn.dataset.act) {
      case 'back': return h.onBack();
      case 'new-firm': {
        const raw = await showPrompt('Name der neuen Firma', '', { maxlength: MAX_FIRM });
        if (raw == null) return;
        const err = firmNameError(raw);
        if (err) return showAlert(err);
        const name = raw.trim();
        extra.add(name); sel = name; return render();
      }
      case 'rename-firm': {
        const raw = await showPrompt(`„${sel}“ umbenennen in`, sel, { maxlength: MAX_FIRM });
        if (raw == null) return;
        const err = firmNameError(raw);
        if (err) return showAlert(err);
        const to = raw.trim();
        if (to === sel) return;
        if (!await h.onRename(sel, to)) return;
        if (extra.delete(sel)) extra.add(to);
        sel = to; return render();
      }
      case 'delete-firm': {
        if (await h.onDeleteCompany(sel)) { extra.delete(sel); sel = STANDARD; render(); }
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
      if (last && last.cases === state.cases) return;
      last = { cases: state.cases };
      for (const n of [...extra]) if (state.cases.some(c => c.company === n)) extra.delete(n);
      render();
    },
  };
}
