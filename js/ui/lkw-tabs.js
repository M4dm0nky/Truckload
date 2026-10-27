// Reiterleiste für Pläne mit mehreren LKW (Spec 2026-10-10): je LKW ein Reiter „Name · Fahrzeug“,
// ein Reiter „Ohne LKW (n)“ nur bei nicht zugeordneten Stücken, „+ LKW“ und „LKW bearbeiten“,
// dazu eine Summenzeile. Rein darstellend: das Modell (lkwTabsModel) ist reine Berechnung, die
// Aktionen laufen über Rückrufe. Kein Zugriff auf den Store.
import { esc } from './dom.js';
import { MAX_LKW } from '../model/limits.js';
import { lkwsOf, NO_LKW, piecesOf } from '../model/lkw.js';
import { unassignedLines, stueck } from '../model/lkw-distribute.js';
import { t, num } from '../i18n/i18n.js';
const weightOf = c => (c && typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0);

// Modell der Leiste. `active` ist der gültige Reiter (activeLkwOf). Liefert null für Ein-LKW-Pläne.
// Gewicht: Summe der Case-Gewichte; Stücke ohne Gewicht zählen 0 und werden genannt (nichts erfunden).
export function lkwTabsModel({ plan, trucks, caseById, active }) {
  const lkws = lkwsOf(plan);
  if (!lkws.length) return null;
  const pieces = piecesOf(plan);
  const known = new Set(lkws.map(l => l.id));
  const truckName = id => (trucks.find(tk => tk.id === id) ?? { name: t('unbekanntes Fahrzeug') }).name;
  const tabs = lkws.map(l => ({
    id: l.id, label: `${l.name} · ${truckName(l.truckId)}`,
    count: pieces.filter(x => x.lkw === l.id).length, active: l.id === active,
  }));
  const free = pieces.filter(x => !known.has(x.lkw));
  if (free.length) tabs.push({ id: NO_LKW, label: t('Ohne LKW'), count: free.length, active: active === NO_LKW, none: true });
  let weight = 0, withoutWeight = 0;
  for (const x of pieces) {
    const w = weightOf(caseById.get(x.caseId));
    weight += w;
    if (!w) withoutWeight++;
  }
  return {
    tabs,
    canAdd: lkws.length < MAX_LKW,
    sum: { total: pieces.length, weight, withoutWeight, unassigned: free.length, unassignedLines: unassignedLines(plan, caseById) },
  };
}

const kg = n => `${num(Math.round(n))} kg`;
export function sumText(sum) {
  const parts = [t('Gesamt {stueck}', { stueck: stueck(sum.total) }), kg(sum.weight)];
  if (sum.withoutWeight) parts[1] += ` ${t('({n} ohne Gewicht)', { n: sum.withoutWeight })}`;
  if (sum.unassigned) parts.push(sum.unassignedLines.join(' · '));
  return parts.join(' · ');
}

export function tabsHtml(model) {
  const tabs = model.tabs.map(tab =>
    `<button type="button" class="lkw-tab${tab.active ? ' on' : ''}${tab.none ? ' none' : ''}" data-lkw="${esc(tab.id)}" aria-pressed="${tab.active}">${esc(tab.label)} <small>(${tab.count})</small></button>`).join('');
  const add = `<button type="button" data-act="add" ${model.canAdd ? '' : `disabled title="${t('Höchstzahl an LKW erreicht')}"`}>${t('+ LKW')}</button>`;
  const edit = `<button type="button" data-act="edit" ${model.tabs.some(tab => tab.active && !tab.none) ? '' : 'disabled'}>${t('LKW bearbeiten')}</button>`;
  return `<div class="lkw-tab-row">${tabs}<span class="grow"></span>${add}${edit}</div><p class="lkw-sum hint">${esc(sumText(model.sum))}</p>`;
}

// handlers: onSelect(id), onAdd(), onEdit(). Liefert { update(model|null) }.
export function mountLkwTabs(el, h) {
  let last = null;
  el.addEventListener('click', e => {
    const tab = e.target.closest('[data-lkw]');
    if (tab) return h.onSelect(tab.dataset.lkw);
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (act === 'add') h.onAdd();
    else if (act === 'edit') h.onEdit();
  });
  return {
    update(model) {
      el.hidden = !model;
      if (!model) { last = null; return; }
      const html = tabsHtml(model);
      if (html === last) return;
      last = html;
      el.innerHTML = html;
    },
  };
}
