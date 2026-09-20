import { esc } from './dom.js';
import { CATEGORIES, colorFor } from '../data/categories.js';
import { outerDims } from '../model/geometry.js';
import { isTruss } from '../model/truss.js';
import { companiesOf, groupCases } from './caseGroups.js';

const MAX_ITEMS = 500;

function caseLine(c) {
  const company = c.company ? ` · ${c.company}` : '';
  if (isTruss(c)) return `Traverse · ${c.truss.count} Stück · ${c.weight} kg/Stück${company}`;
  const { l, w, h } = outerDims(c);
  return `${l}×${w}×${h} cm · ${c.weight} kg${company}`;
}

// opts: { mode: 'new'|'add', cases, trucks, defaultTruckId, defaultName, presetCaseId, onNewCase(draft) }
// Ergebnis: { name, truckId, items: [{ caseId, label, color }], autoPack } oder null bei Abbruch.
export function openLoadWizard(dlg, opts = {}) {
  const mode = opts.mode ?? 'new';
  const trucks = opts.trucks ?? [];
  let cases = [...(opts.cases ?? [])];
  const counts = new Map(); // caseId -> Anzahl
  if (opts.presetCaseId) counts.set(opts.presetCaseId, 1);
  const itemsState = new Map(); // caseId -> [{ label, color }]
  const total = () => [...counts.values()].reduce((a, b) => a + b, 0);

  const steps = mode === 'add' ? ['cases', 'labels'] : ['load', 'cases', 'labels'];
  let stepIdx = 0;

  dlg.innerHTML = `
    <form method="dialog" class="editor wizard">
      <h2>Load zusammenstellen</h2>
      <div class="wiz-progress">${steps.map(() => '<span class="wiz-dot"></span>').join('')}</div>
      <section class="wiz-step" data-step="load">
        <label>Name<input name="loadName" required maxlength="80"></label>
        <label>Fahrzeug<select name="truckId">${trucks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
      </section>
      <section class="wiz-step" data-step="cases" hidden>
        <div class="wiz-cases-head">
          <input type="search" class="wiz-search" placeholder="Suchen (Name oder Inhalt)">
          <select class="wiz-filter"><option value="">Alle Gewerke</option>${CATEGORIES.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
          <select class="wiz-filter-company"><option value="">Alle Firmen</option>${companiesOf(cases).map(name => `<option>${esc(name)}</option>`).join('')}</select>
        </div>
        <p class="hint wiz-totals">0 Stück · 0 kg</p>
        <div class="wiz-case-list"></div>
        <div class="row">
          <button type="button" data-act="new-case">+ Neues Case</button>
          <button type="button" data-act="sonderbau">⬛ Sonderbau</button>
        </div>
        <p class="hint wiz-limit-hint" hidden></p>
      </section>
      <section class="wiz-step" data-step="labels" hidden>
        <div class="wiz-groups"></div>
        <label class="check"><input type="checkbox" name="autoPack" checked> danach automatisch packen</label>
      </section>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button type="button" data-act="back" hidden>Zurück</button>
        <button type="button" data-act="next" class="primary">Weiter</button>
        <button value="finish" class="primary" formnovalidate hidden>Fertig</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;
  const sections = new Map([...dlg.querySelectorAll('.wiz-step')].map(el => [el.dataset.step, el]));
  const dots = [...dlg.querySelectorAll('.wiz-dot')];
  const search = dlg.querySelector('.wiz-search');
  const filterSel = dlg.querySelector('.wiz-filter');
  const companyFilterSel = dlg.querySelector('.wiz-filter-company');
  const totalsEl = dlg.querySelector('.wiz-totals');
  const list = dlg.querySelector('.wiz-case-list');
  const limitHint = dlg.querySelector('.wiz-limit-hint');
  const groupsEl = dlg.querySelector('.wiz-groups');
  const backBtn = dlg.querySelector('[data-act="back"]');
  const nextBtn = dlg.querySelector('[data-act="next"]');
  const finishBtn = dlg.querySelector('[value="finish"]');

  f.loadName.value = opts.defaultName ?? '';
  f.truckId.value = opts.defaultTruckId ?? trucks[0]?.id ?? '';

  function updateTotals() {
    const n = total();
    const kg = cases.reduce((sum, c) => sum + (counts.get(c.id) ?? 0) * c.weight, 0);
    totalsEl.textContent = `${n} Stück · ${Math.round(kg).toLocaleString('de-DE')} kg`;
    if (n >= MAX_ITEMS) {
      limitHint.hidden = false;
      limitHint.textContent = 'Maximal 500 Stück je Wizard-Durchlauf.';
    } else {
      limitHint.hidden = true;
    }
  }

  function caseRow(c) {
    const n = counts.get(c.id) ?? 0;
    return `
      <div class="wiz-case-row" data-case="${esc(c.id)}">
        <span class="swatch" style="background:${esc(c.color)}"></span>
        <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
        <div class="stepper">
          <button type="button" data-act="dec" ${n <= 0 ? 'disabled' : ''}>−</button>
          <span class="qty">${n}</span>
          <button type="button" data-act="inc" ${total() >= MAX_ITEMS ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }

  function renderCaseList() {
    const { own, presets, list: fromList } = groupCases(cases, {
      q: search.value, cat: filterSel.value, company: companyFilterSel.value,
    });
    list.innerHTML = `
      <h3>Eigene Cases (${own.length})</h3>${own.map(caseRow).join('') || '<p class="hint">Keine Treffer.</p>'}
      <h3>Vorlagen</h3>${presets.map(caseRow).join('')}
      <h3>Cases aus deiner Liste (${fromList.length})</h3>${fromList.map(caseRow).join('')}`;
    updateTotals();
  }
  list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    if (!id) return;
    const cur = counts.get(id) ?? 0;
    if (btn.dataset.act === 'inc' && total() < MAX_ITEMS) counts.set(id, cur + 1);
    if (btn.dataset.act === 'dec' && cur > 0) {
      const nv = cur - 1;
      if (nv <= 0) counts.delete(id); else counts.set(id, nv);
    }
    renderCaseList();
  });
  search.addEventListener('input', renderCaseList);
  filterSel.addEventListener('change', renderCaseList);
  companyFilterSel.addEventListener('change', renderCaseList);

  async function addNewCase(draft) {
    const c = await opts.onNewCase?.(draft);
    if (!c) return;
    cases = [...cases.filter(x => x.id !== c.id), c];
    counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    renderCaseList();
  }
  dlg.querySelector('[data-act="new-case"]').addEventListener('click', () => addNewCase());
  dlg.querySelector('[data-act="sonderbau"]').addEventListener('click', () =>
    addNewCase({ category: 'Sonderbau', wheels: true, dimsInclWheels: false }));

  function buildItemsState() {
    for (const c of cases) {
      const n = counts.get(c.id) ?? 0;
      if (n <= 0) { itemsState.delete(c.id); continue; }
      const prev = itemsState.get(c.id) ?? [];
      const next = Array.from({ length: n }, (_, i) => prev[i] ?? { label: `${c.name} ${i + 1}`, color: colorFor(c.category) });
      itemsState.set(c.id, next);
    }
  }
  function renderGroups() {
    buildItemsState();
    const ids = cases.filter(c => (counts.get(c.id) ?? 0) > 0).map(c => c.id);
    groupsEl.innerHTML = ids.map(id => {
      const c = cases.find(x => x.id === id);
      const arr = itemsState.get(id);
      return `
        <fieldset class="wiz-group" data-case="${esc(id)}">
          <legend>${esc(c.name)} <button type="button" data-act="color-all">Farbe auf alle übernehmen</button></legend>
          ${arr.map((it, i) => `
            <div class="row wiz-item" data-i="${i}">
              <input name="label" value="${esc(it.label)}" maxlength="40">
              <input type="color" name="color" value="${esc(it.color)}">
            </div>`).join('')}
        </fieldset>`;
    }).join('') || '<p class="hint">Keine Cases ausgewählt.</p>';
  }
  groupsEl.addEventListener('input', e => {
    const rowEl = e.target.closest('.wiz-item');
    const groupEl = e.target.closest('.wiz-group');
    if (!rowEl || !groupEl) return;
    const arr = itemsState.get(groupEl.dataset.case);
    const it = arr?.[Number(rowEl.dataset.i)];
    if (!it) return;
    if (e.target.name === 'label') it.label = e.target.value;
    if (e.target.name === 'color') it.color = e.target.value;
  });
  groupsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-act="color-all"]');
    if (!btn) return;
    const groupEl = e.target.closest('.wiz-group');
    const arr = itemsState.get(groupEl.dataset.case);
    const firstColor = groupEl.querySelector('.wiz-item input[type="color"]').value;
    for (const it of arr) it.color = firstColor;
    renderGroups();
  });

  function showStep(i) {
    stepIdx = i;
    for (const [name, el] of sections) el.hidden = name !== steps[i];
    dots.forEach((d, idx) => d.classList.toggle('on', idx === i));
    backBtn.hidden = i === 0;
    const isLast = i === steps.length - 1;
    nextBtn.hidden = isLast;
    finishBtn.hidden = !isLast;
    if (steps[i] === 'cases') renderCaseList();
    if (steps[i] === 'labels') renderGroups();
  }
  function validateStep() {
    const s = steps[stepIdx];
    if (s === 'load') {
      if (!f.loadName.value.trim()) { f.loadName.focus(); return false; }
      return true;
    }
    if (s === 'cases') {
      if (total() <= 0) {
        limitHint.hidden = false;
        limitHint.textContent = 'Mindestens ein Case auswählen.';
        return false;
      }
      if (total() > MAX_ITEMS) {
        limitHint.hidden = false;
        limitHint.textContent = 'Maximal 500 Stück je Wizard-Durchlauf.';
        return false;
      }
      return true;
    }
    return true;
  }
  nextBtn.addEventListener('click', () => { if (validateStep()) showStep(stepIdx + 1); });
  backBtn.addEventListener('click', () => showStep(stepIdx - 1));
  showStep(0);

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act !== 'finish') return resolve(null);
      buildItemsState();
      const items = [];
      for (const c of cases) {
        const n = counts.get(c.id) ?? 0;
        if (n <= 0) continue;
        const arr = itemsState.get(c.id) ?? [];
        for (let i = 0; i < n; i++) {
          const it = arr[i] ?? { label: '', color: colorFor(c.category) };
          items.push({ caseId: c.id, label: it.label.trim(), color: it.color });
        }
      }
      resolve({
        name: mode === 'add' ? undefined : f.loadName.value.trim(),
        truckId: mode === 'add' ? undefined : f.truckId.value,
        items,
        autoPack: f.autoPack.checked,
      });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
