import { esc, swatch, icon } from './dom.js';
import { CASE_TABS, caseKind } from './caseGroups.js';
import { caseLine } from './load-wizard.js';
import { companyList, casesOf, onlyInPlanCases } from '../model/material.js';
import { showPrompt, showConfirm } from './confirmDialog.js';

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

  function render() {
    if (!last) return;
    const companies = companyList(last.cases, [...extra]);
    const items = sel === ONLY_IN_PLAN ? onlyInPlanCases(last.cases) : casesOf(last.cases, sel);
    const needle = q.trim().toLowerCase();
    const shown = items.filter(c => caseKind(c) === tab && (!needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
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
          ${shown.map(rowHtml).join('') || '<p class="hint">Hier ist noch nichts – „+ Neues Case“ legt etwas an.</p>'}
        </section>
      </div>`;
  }

  el.addEventListener('input', e => {
    if (!e.target.matches('.mat-search')) return;
    q = e.target.value; render();
    const s = el.querySelector('.mat-search'); s.focus(); s.setSelectionRange(q.length, q.length);
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
        const name = (await showPrompt('Name der neuen Firma', ''))?.trim();
        if (!name) return;
        extra.add(name); sel = name; return render();
      }
      case 'rename-firm': {
        const to = (await showPrompt(`„${sel}“ umbenennen in`, sel))?.trim();
        if (!to || to === sel) return;
        await h.onRename(sel, to); extra.delete(sel); sel = to; return render();
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
