import { esc } from './dom.js';
import { RULE_KINDS, POS_LABEL, addRule, moveRule, removeRule, describeRule, ruleActive } from '../model/packRules.js';

// Dialog „Pack-Regeln“ (Spec 2026-09-30). Store-unwissend wie openCaseEditor/openLoadWizard: bekommt
// Regeln, Ziele des Loads und Regelsets als Argumente, speichert Regelsets über die Rückrufe von
// app.js und liefert { rules, repack } oder null (Abbrechen/Esc).
// Eigene Entscheidung: Reihenfolge über „↑“/„↓“ statt Ziehen – per Tastatur bedienbar, ohne
// Drag-Sonderfälle im <dialog>.
export function openPackRules(dlg, { rules, targets, caseById, ruleSets = [], onSaveRuleSet, onDeleteRuleSet }) {
  let cur = [...rules];
  let sets = [...ruleSets];

  dlg.innerHTML = `
    <form method="dialog" class="editor pack-rules">
      <h2>Pack-Regeln</h2>
      <p class="hint">Oben steht die wichtigste Regel, bei Gleichstand entscheidet die nächste. Jeder Case-Typ bleibt
        ein eigener Block, Stücke mit Gruppe bilden einen eigenen Block. „zuerst“ heißt an der Stirnwand, „zuletzt“ an der Tür.</p>
      <ol class="rule-list"></ol>
      <fieldset class="rule-add">
        <legend>Regel hinzufügen</legend>
        <div class="rule-add-row">
          <select name="by">${RULE_KINDS.map(k => `<option value="${k.by}">${esc(k.label)}</option>`).join('')}</select>
          <select name="value"></select>
          <select name="pos">${Object.entries(POS_LABEL).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button type="button" data-act="add">+ Regel</button>
        </div>
      </fieldset>
      <fieldset class="rule-sets">
        <legend>Regelsets</legend>
        <div class="rule-add-row">
          <select name="set"></select>
          <button type="button" data-act="apply-set">Übernehmen</button>
          <button type="button" data-act="delete-set" class="danger">Löschen</button>
        </div>
        <div class="rule-add-row">
          <input name="setName" maxlength="80" placeholder="Name, z. B. „Tour-Standard“">
          <button type="button" data-act="save-set">Als Regelset speichern</button>
        </div>
        <small class="hint rule-set-hint" hidden></small>
      </fieldset>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save">Speichern</button>
        <button value="repack" class="primary">Speichern und neu packen</button>
      </menu>
    </form>`;

  const f = dlg.querySelector('form').elements;
  const listEl = dlg.querySelector('.rule-list');
  const addBtn = dlg.querySelector('[data-act="add"]');
  const setHint = dlg.querySelector('.rule-set-hint');

  const valueOptions = by => {
    if (by === 'group') return targets.groups.map(g => ({ value: g, label: g }));
    if (by === 'case') return targets.cases.map(c => ({ value: c.id, label: c.name }));
    if (by === 'category') return targets.categories.map(c => ({ value: c, label: c }));
    return null;
  };
  function syncAddRow() {
    const opts = valueOptions(f.by.value);
    f.value.hidden = !opts;
    f.pos.hidden = f.by.value === 'volume' || f.by.value === 'count';
    f.value.innerHTML = opts?.length
      ? opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')
      : '<option value="">(keine in diesem Load)</option>';
    addBtn.disabled = !!opts && !opts.length;
  }
  function renderList() {
    listEl.innerHTML = cur.map((r, i) => {
      const active = ruleActive(r, targets);
      return `
        <li class="rule ${active ? '' : 'inactive'}" data-i="${i}">
          <span class="rule-text">${esc(describeRule(r, caseById))}${active ? '' : ' <small>(nicht in diesem Load)</small>'}</span>
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} title="Nach oben">↑</button>
          <button type="button" data-act="down" ${i === cur.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button>
          <button type="button" data-act="remove" title="Regel entfernen">×</button>
        </li>`;
    }).join('') || '<li class="hint">Keine Regel – dann entscheidet der Name.</li>';
  }
  function renderSets() {
    f.set.innerHTML = sets.length
      ? sets.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')
      : '<option value="">(noch keine Regelsets)</option>';
    dlg.querySelector('[data-act="apply-set"]').disabled = !sets.length;
    dlg.querySelector('[data-act="delete-set"]').disabled = !sets.length;
  }
  const showSetHint = text => { setHint.textContent = text; setHint.hidden = !text; };

  f.by.addEventListener('change', syncAddRow);
  dlg.querySelector('form').addEventListener('click', async e => {
    const act = e.target.closest('button[data-act]')?.dataset.act;
    if (!act) return;
    const i = Number(e.target.closest('[data-i]')?.dataset.i);
    if (act === 'up') cur = moveRule(cur, i, -1);
    if (act === 'down') cur = moveRule(cur, i, 1);
    if (act === 'remove') cur = removeRule(cur, i);
    if (act === 'add') {
      const by = f.by.value;
      const rule = by === 'volume' || by === 'count' ? { by }
        : by === 'truss' ? { by, pos: f.pos.value }
        : { by, value: f.value.value, pos: f.pos.value };
      cur = addRule(cur, rule);
    }
    if (act === 'apply-set') {
      const s = sets.find(x => x.id === f.set.value);
      if (s) { cur = [...s.rules]; showSetHint(`Regelset „${s.name}“ übernommen.`); }
    }
    if (act === 'delete-set') {
      const s = sets.find(x => x.id === f.set.value);
      if (s && await onDeleteRuleSet?.(s.id)) { sets = sets.filter(x => x.id !== s.id); showSetHint(`Regelset „${s.name}“ gelöscht.`); }
      renderSets();
    }
    if (act === 'save-set') {
      const name = f.setName.value.trim();
      if (!name) { f.setName.focus(); return; }
      const saved = await onSaveRuleSet?.(name, cur);
      if (saved) {
        sets = [...sets.filter(x => x.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name, 'de'));
        f.setName.value = '';
        renderSets();
        f.set.value = saved.id;
        showSetHint(`Regelset „${saved.name}“ gespeichert.`);
      }
    }
    renderList();
  });

  syncAddRow();
  renderList();
  renderSets();

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const v = dlg.returnValue;
      resolve(v === 'save' || v === 'repack' ? { rules: cur, repack: v === 'repack' } : null);
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
