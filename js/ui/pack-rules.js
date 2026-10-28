import { esc } from './dom.js';
import { MAX_RULESET_NAME } from '../model/limits.js';
import { t } from '../i18n/i18n.js';
import { RULE_KINDS, POS_LABEL, addRule, moveRule, removeRule, describeRule, ruleActive } from '../model/packRules.js';

const ORTE = ['projekt', 'bibliothek'];
// Getter statt fester Texte: die Sprache steht erst beim Zugriff fest (Tests schalten sie um).
const ORT_LABEL = { get projekt() { return t('Projekt'); }, get bibliothek() { return t('Bibliothek'); } };

export function setOptions(projectSets, librarySets) {
  const gruppe = (ort, list) => (list.length
    ? `<optgroup label="${ORT_LABEL[ort]}">${list.map(s => `<option value="${ort}:${esc(s.id)}">${esc(s.name)}</option>`).join('')}</optgroup>`
    : '');
  return gruppe('projekt', projectSets) + gruppe('bibliothek', librarySets);
}

export function parseSetValue(value) {
  const i = typeof value === 'string' ? value.indexOf(':') : -1;
  if (i < 0) return null;
  const ort = value.slice(0, i), id = value.slice(i + 1);
  return ORTE.includes(ort) && id ? { ort, id } : null;
}

const byName = (a, b) => a.name.localeCompare(b.name, 'de');

// Dialog „Pack-Regeln“. Store-unwissend wie openCaseEditor/openLoadWizard: bekommt
// Regeln, Deckschicht-Schalter, Ziele des Loads und Regelsets als Argumente, speichert Regelsets
// über die Rückrufe von app.js und liefert { rules, mixTop, repack } oder null (Abbrechen/Esc).
// Eigene Entscheidung: Reihenfolge über „↑“/„↓“ statt Ziehen – per Tastatur bedienbar, ohne
// Drag-Sonderfälle im <dialog>.
export async function openPackRules(dlg, { rules, mixTop = false, targets, caseById, ruleSets = [], projectRuleSets = [], onSaveRuleSet, onDeleteRuleSet }) {
  if (dlg.open) { // close() feuert `close` asynchron – erst abwarten (Listener vor close() anhängen), sonst trifft das alte Ereignis den neuen Listener
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  let cur = [...rules];
  let sets = [...ruleSets];
  let projSets = [...projectRuleSets];
  const listOf = ort => (ort === 'projekt' ? projSets : sets);

  dlg.innerHTML = `
    <form method="dialog" class="editor pack-rules">
      <h2>${t('Pack-Regeln')}</h2>
      <p class="hint">${t('Oben steht die wichtigste Regel, bei Gleichstand entscheidet die nächste. Jeder Case-Typ bleibt ein eigener Block, Stücke mit Gruppe bilden einen eigenen Block. „zuerst“ heißt an der Stirnwand, „zuletzt“ an der Tür.')}</p>
      <ol class="rule-list"></ol>
      <label class="check"><input type="checkbox" name="mixTop"> ${t('Deckschicht mischen: leichtere, kleinere Cases derselben Gruppe bzw. desselben Gewerks obendrauf')}</label>
      <small class="hint">${t('Cases ohne Gewicht (0 kg) werden nicht gemischt. Die Lagen je Stück gelten weiter.')}</small>
      <fieldset class="rule-add">
        <legend>${t('Regel hinzufügen')}</legend>
        <div class="rule-add-row">
          <select name="by">${RULE_KINDS.map(k => `<option value="${k.by}">${esc(k.label)}</option>`).join('')}</select>
          <select name="value"></select>
          <select name="pos">${Object.entries(POS_LABEL).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button type="button" data-act="add">${t('+ Regel')}</button>
        </div>
      </fieldset>
      <fieldset class="rule-sets">
        <legend>${t('Regelsets')}</legend>
        <div class="rule-add-row">
          <select name="set"></select>
          <button type="button" data-act="apply-set">${t('Übernehmen')}</button>
          <button type="button" data-act="delete-set" class="danger">${t('Löschen')}</button>
        </div>
        <div class="rule-add-row rule-save-row">
          <input name="setName" maxlength="${MAX_RULESET_NAME}" placeholder="${t('Name, z. B. „Tour-Standard“')}">
          <select name="setOrt" aria-label="${t('Speicherort')}"><option value="projekt" selected>${t('im Projekt')}</option><option value="bibliothek">${t('in der Bibliothek')}</option></select>
          <button type="button" data-act="save-set">${t('Als Regelset speichern')}</button>
        </div>
        <small class="hint rule-set-hint" hidden></small>
      </fieldset>
      <menu>
        <button value="cancel" formnovalidate>${t('Abbrechen')}</button>
        <span class="grow"></span>
        <button value="save">${t('Speichern')}</button>
        <button value="repack" class="primary">${t('Speichern und neu packen')}</button>
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
      : `<option value="">${t('(keine in diesem Load)')}</option>`;
    addBtn.disabled = !!opts && !opts.length;
  }
  function renderList() {
    listEl.innerHTML = cur.map((r, i) => {
      const active = ruleActive(r, targets);
      return `
        <li class="rule ${active ? '' : 'inactive'}" data-i="${i}">
          <span class="rule-text">${esc(describeRule(r, caseById))}${active ? '' : ` <small>${t('(nicht in diesem Load)')}</small>`}</span>
          <button type="button" data-act="up" ${i === 0 ? 'disabled' : ''} title="${t('Nach oben')}" aria-label="${t('Nach oben')}">↑</button>
          <button type="button" data-act="down" ${i === cur.length - 1 ? 'disabled' : ''} title="${t('Nach unten')}" aria-label="${t('Nach unten')}">↓</button>
          <button type="button" data-act="remove" title="${t('Regel entfernen')}" aria-label="${t('Regel entfernen')}">×</button>
        </li>`;
    }).join('') || `<li class="hint">${t('Keine Regel – dann entscheidet der Name.')}</li>`;
  }
  function renderSets() {
    const any = projSets.length + sets.length > 0;
    f.set.innerHTML = any ? setOptions(projSets, sets) : `<option value="">${t('(noch keine Regelsets)')}</option>`;
    dlg.querySelector('[data-act="apply-set"]').disabled = !any;
    dlg.querySelector('[data-act="delete-set"]').disabled = !any;
  }
  const showSetHint = text => { setHint.textContent = text; setHint.hidden = !text; };

  const saveSetBtn = dlg.querySelector('[data-act="save-set"]');
  f.mixTop.checked = mixTop === true;

  f.by.addEventListener('change', syncAddRow);
  // Enter im Namensfeld sendet sonst das <form method="dialog"> mit dem ERSTEN Button im Dokument
  // als Submitter – das ist „Abbrechen“ (menu-Leiste), nicht „Als Regelset speichern“: der Dialog
  // schlösse kommentarlos und alle ungespeicherten Regeländerungen wären weg. Deshalb hier
  // abfangen und denselben Klick wie der Speichern-Button auslösen.
  f.setName.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    saveSetBtn.click();
  });
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
      const v = parseSetValue(f.set.value);
      const s = v && listOf(v.ort).find(x => x.id === v.id);
      if (s) { cur = [...s.rules]; f.mixTop.checked = s.mixTop === true; showSetHint(t('Regelset „{name}“ übernommen.', { name: s.name })); }
    }
    if (act === 'delete-set') {
      const v = parseSetValue(f.set.value);
      const s = v && listOf(v.ort).find(x => x.id === v.id);
      if (s && await onDeleteRuleSet?.(s.id, v.ort)) {
        if (v.ort === 'projekt') projSets = projSets.filter(x => x.id !== s.id); else sets = sets.filter(x => x.id !== s.id);
        showSetHint(t('Regelset „{name}“ gelöscht.', { name: s.name }));
      }
      renderSets();
    }
    if (act === 'save-set') {
      const name = f.setName.value.trim();
      if (!name) { f.setName.focus(); return; }
      const ort = f.setOrt.value;
      const saved = await onSaveRuleSet?.(name, cur, f.mixTop.checked, ort);
      if (saved) {
        const next = [...listOf(ort).filter(x => x.id !== saved.id), saved].sort(byName);
        if (ort === 'projekt') projSets = next; else sets = next;
        f.setName.value = '';
        renderSets();
        f.set.value = `${ort}:${saved.id}`;
        showSetHint(t('Regelset „{name}“ gespeichert.', { name: saved.name }));
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
      resolve(v === 'save' || v === 'repack' ? { rules: cur, mixTop: f.mixTop.checked, repack: v === 'repack' } : null);
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
