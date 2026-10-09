import { esc, swatch } from './dom.js';
import { CATEGORIES, colorFor } from '../data/categories.js';
import { layersOf, canTip } from '../model/geometry.js';
import { companiesOf, groupCases, renderGroupList, caseKind, CASE_TABS, NEUTRAL_COMPANY } from './caseGroups.js';
import { caseLine } from './caseInfo.js';
import { MAX_LABEL, NAME_MAX } from '../model/limits.js';
import { openTrussDialog } from './truss-wizard.js';
import { openDollyDialog } from './dolly-wizard.js';
import { searchInOptionsHtml, stockDefaultFor, refreshWizardCases, capToRoom, reduceWizardItem, defaultWizardLayers, countWithoutLayer, setLayerForAll, setTippedForAll, bulkState } from './wizard-items.js';

const MAX_ITEMS = 500;

// opts: { mode: 'new'|'add', cases, trucks, defaultTruckId, defaultName, onNewCase(draft),
//   trussDlg (<dialog> für „Traverse hinzufügen“, optional – ohne wird der Knopf ausgeblendet),
//   onNewTruss(caseType) (speichert einen neu gebauten Traversenwagen-Case-Typ, s. truss-wizard.js),
//   dollyDlg (<dialog> für „… auf Dolly laden“, optional – ohne fügt „+“ bei dollyPrompt-Cases
//   die Box direkt lose hinzu), onNewDollyStack(caseType) (speichert einen
//   neuen Dolly-Stack-Case-Typ, s. dolly-wizard.js),
//   groups: string[] (vorhandene Gruppen des Loads, für die Vorschlagsliste im Gruppenfeld) }
// Ergebnis: { name, truckId, items: [{ caseId, label, color, layers?, tipped?, group? }], autoPack }
// oder null bei Abbruch.
export async function openLoadWizard(dlg, opts = {}) {
  if (dlg.open) { // close() feuert `close` asynchron – erst abwarten (Listener vor close() anhängen), sonst trifft das alte Ereignis den neuen Listener
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const mode = opts.mode ?? 'new';
  const trucks = opts.trucks ?? [];
  let cases = [...(opts.cases ?? [])];
  const counts = new Map(); // caseId -> Anzahl
  let activeTab = CASE_TABS[0].id; // 'cases' — Reiter der Artikelauswahl, s. caseKind() (caseGroups.js)
  const created = new Set(); // im Wizard neu angelegte Cases bleiben trotz Filter sichtbar
  const itemsState = new Map(); // caseId -> [{ label, color, layers, tipped }]
  const total = () => [...counts.values()].reduce((a, b) => a + b, 0);

  const steps = mode === 'add' ? ['cases', 'labels'] : ['load', 'cases', 'labels'];
  let stepIdx = 0;

  dlg.innerHTML = `
    <form method="dialog" class="editor wizard">
      <h2>Load zusammenstellen</h2>
      <div class="wiz-progress">${steps.map(() => '<span class="wiz-dot"></span>').join('')}</div>
      <section class="wiz-step" data-step="load">
        <label>Name<input name="loadName" required maxlength="${NAME_MAX}"></label>
        <label>Fahrzeug<select name="truckId">${trucks.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select></label>
      </section>
      <section class="wiz-step" data-step="cases" hidden>
        <div class="seg case-tabs">${CASE_TABS.map((t, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
        <div class="wiz-cases-head">
          <input type="search" class="wiz-search" placeholder="Suchen (Name oder Inhalt)">
          <select class="wiz-filter"><option value="">Alle Gewerke</option>${CATEGORIES.map(c => `<option>${esc(c.name)}</option>`).join('')}</select>
          <label>Suchen in <select class="wiz-filter-company" title="„Standardkatalog“ zeigt nur Vorlagen und eigene Cases – firmen-gebrandete Cases erst nach gezielter Wahl des Kompletten Bestands oder einer Firma">${searchInOptionsHtml(companiesOf(cases), NEUTRAL_COMPANY)}</select></label>
        </div>
        <p class="hint wiz-totals">0 Stück · 0 kg</p>
        <div class="wiz-case-list"></div>
        <div class="row">
          <button type="button" data-act="new-case">+ Neues Case</button>
          <button type="button" data-act="sonderbau">⬛ Sonderbau</button>
          <button type="button" data-act="new-truss">+ Traverse hinzufügen</button>
        </div>
        <p class="hint wiz-limit-hint" hidden></p>
      </section>
      <section class="wiz-step" data-step="labels" hidden>
        <div class="row wiz-all">
          <b>Alle Stücke:</b>
          <span class="wiz-layers">
            <span class="wiz-layers-label">Lage</span>
            ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" data-all-layer="${n}">${n}</label>`).join('')}
          </span>
          <label class="check wiz-tipped"><input type="checkbox" data-all-tipped>getippt</label>
          <small class="hint wiz-all-hint" hidden></small>
        </div>
        <datalist id="wiz-group-list"></datalist>
        <div class="wiz-groups"></div>
        <p class="hint wiz-nolayer-hint" hidden></p>
        <label class="check"><input type="checkbox" name="autoPack" checked> danach automatisch packen</label>
      </section>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        ${opts.onOpenMaterial ? '<button type="button" data-act="material" title="Materialverwaltung – danach geht es hier weiter">Material</button>' : ''}
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
  const tabBtns = [...dlg.querySelectorAll('.case-tabs button')];
  const newCaseBtn = dlg.querySelector('[data-act="new-case"]');
  const sonderbauBtn = dlg.querySelector('[data-act="sonderbau"]');
  const newTrussBtn = dlg.querySelector('[data-act="new-truss"]');
  const search = dlg.querySelector('.wiz-search');
  const filterSel = dlg.querySelector('.wiz-filter');
  const companyFilterSel = dlg.querySelector('.wiz-filter-company');
  const totalsEl = dlg.querySelector('.wiz-totals');
  const list = dlg.querySelector('.wiz-case-list');
  const limitHint = dlg.querySelector('.wiz-limit-hint');
  const groupsEl = dlg.querySelector('.wiz-groups');
  const allEl = dlg.querySelector('.wiz-all');
  const allHint = dlg.querySelector('.wiz-all-hint');
  const noLayerHint = dlg.querySelector('.wiz-nolayer-hint');
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
        ${swatch(c.color)}
        <span class="lib-text"><b>${esc(c.name)}</b><small>${esc(caseLine(c))}</small></span>
        <div class="stepper">
          <button type="button" data-act="dec" aria-label="Eine weniger" ${n <= 0 ? 'disabled' : ''}>−</button>
          <span class="qty">${n}</span>
          <button type="button" data-act="inc" aria-label="Eine mehr" ${total() >= MAX_ITEMS ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }

  function renderCaseList() {
    const tabCases = cases.filter(c => caseKind(c) === activeTab);
    const groups = groupCases(tabCases, { q: search.value, cat: filterSel.value, company: companyFilterSel.value, keep: created });
    renderGroupList(list, groups, caseRow, {
      // Ohne gesetzten Filter kein „Keine Treffer.“: für einen neuen Nutzer klänge das nach
      // Fehlbedienung statt nach einer leeren, aber gültigen Bibliothek (Formulierung wie in library.js).
      own: '<p class="hint">Noch keine eigenen Cases – „+ Neues Case“ legt eins an.</p>',
      presets: '<p class="hint">Keine Treffer für diese Filter.</p>',
      list: '<p class="hint">Keine Treffer für diese Filter.</p>',
    });
    updateTotals();
  }
  // Firmenfilter neu aufbauen, wenn sich die Case-Liste ändert (nach „+ Neues Case“/„Sonderbau“),
  // sonst bliebe er auf dem Stand beim Öffnen. Das deckt auch eine im Case-Editor über den
  // Ablageziel-Block neu angelegte Firma ab. library.js macht es analog (renderCompanyOptions)
  // und merkt sich zusätzlich die bisherige Auswahl.
  function renderCompanyOptions() {
    const prev = companyFilterSel.value;
    const companies = companiesOf(cases);
    companyFilterSel.innerHTML = searchInOptionsHtml(companies, prev);
    // Rückfall auf „Standardkatalog“, nicht „Alle Firmen“: verschwindet die gemerkte Firma aus der
    // Liste (letztes Case dieser Firma gelöscht), soll der Filter wieder scharf stehen statt
    // auf einmal firmen-gebrandete Cases zu zeigen, die der Nutzer nie gewählt hat.
    if (prev !== NEUTRAL_COMPANY && prev !== '' && !companies.includes(prev)) companyFilterSel.value = NEUTRAL_COMPANY;
  }
  list.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-case]')?.dataset.case;
    if (!id) return;
    if (btn.dataset.act === 'inc') {
      const c = cases.find(x => x.id === id);
      if (c?.dollyPrompt && opts.dollyDlg) { addDollyStack(c); return; }
    }
    const cur = counts.get(id) ?? 0;
    if (btn.dataset.act === 'inc' && total() < MAX_ITEMS) counts.set(id, cur + 1);
    if (btn.dataset.act === 'dec' && cur > 0) {
      const nv = cur - 1;
      if (nv <= 0) counts.delete(id); else counts.set(id, nv);
    }
    renderCaseList();
  });
  // Gewerk-Filter ist innerhalb des Sonderbau-/Traversen-Reiters bedeutungslos (Sonderbau hat
  // immer dasselbe Gewerk, Traversen haben „Rigging“ fest) – dort ausgeblendet statt nur wirkungslos.
  function syncTabUi() {
    tabBtns.forEach(b => b.classList.toggle('on', b.dataset.tab === activeTab));
    filterSel.hidden = activeTab !== 'cases';
    newCaseBtn.hidden = activeTab !== 'cases';
    sonderbauBtn.hidden = activeTab !== 'sonderbau';
    newTrussBtn.hidden = activeTab !== 'traversen' || !opts.trussDlg;
  }
  for (const btn of tabBtns) btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    syncTabUi();
    renderCaseList();
  });
  search.addEventListener('input', renderCaseList);
  filterSel.addEventListener('change', renderCaseList);
  companyFilterSel.addEventListener('change', renderCaseList);

  const stockOpt = () => ({ mode: 'choose', companies: companiesOf(cases), defaultCompany: stockDefaultFor(companyFilterSel.value) });

  async function addNewCase(draft) {
    const c = await opts.onNewCase?.(draft, stockOpt());
    if (!c) return;
    created.add(c.id);
    cases = [...cases.filter(x => x.id !== c.id), c];
    // Dieselbe MAX_ITEMS-Grenze wie der „+“-Stepper: sonst blockierte „Weiter“ später mit „Maximal
    // 500 Stück je Wizard-Durchlauf“, ohne dass erkennbar wäre, warum ein einzelnes neues Case das auslöst.
    if (total() < MAX_ITEMS) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    renderCompanyOptions();
    renderCaseList();
  }
  newCaseBtn.addEventListener('click', () => addNewCase());
  sonderbauBtn.addEventListener('click', () =>
    addNewCase({ category: 'Sonderbau', wheels: true, dimsInclWheels: false }));

  // „Truss hinzufügen“: eigener, mengenbasierter Dialog statt Stepper-Klicks – ergänzt Cases und
  // Stückzahlen direkt in `counts`/`cases`, genau wie addNewCase() oben. Neue klassische Wagen-
  // Case-Typen werden über `opts.onNewTruss` gespeichert (wie `opts.onNewCase`, damit
  // load-wizard.js store-unwissend bleibt); Pre-Rig-Presets liegen schon in `cases`.
  async function addTruss() {
    const res = await openTrussDialog(opts.trussDlg, { cases, onNewTruss: opts.onNewTruss, stock: stockOpt() });
    if (!res) return;
    for (const nc of res.newCases) created.add(nc.id);
    if (res.newCases.length) cases = [...cases.filter(c => !res.newCases.some(nc => nc.id === c.id)), ...res.newCases];
    // Dieselbe MAX_ITEMS-Grenze wie addNewCase() oben – anders als dort kann eine einzelne Addition
    // aber weit mehr als 1 Stück bringen (z. B. alle gleich besetzten Wagen eines „Gesamtstückzahl“-
    // Laufs als eine Addition mit großem n). Deshalb wird n auf den verbleibenden Platz gekappt, statt
    // nur ja/nein zu entscheiden.
    for (const { caseId, n } of res.additions) {
      const room = MAX_ITEMS - total();
      if (room <= 0) break;
      counts.set(caseId, (counts.get(caseId) ?? 0) + Math.min(n, room));
    }
    if (res.gestapelt) f.autoPack.checked = true;
    renderCompanyOptions();
    renderCaseList();
  }
  if (opts.trussDlg) newTrussBtn.addEventListener('click', addTruss);

  // „<Box> auf Dolly laden“: öffnet sich automatisch, wenn „+“ bei einer dollyPrompt-Vorlage
  // geklickt wird (s. Listen-Click-Handler oben) – dieselbe Mechanik wie addTruss(), nur durch den
  // Stepper ausgelöst. Der erzeugte Dolly-Stack-Case-Typ erscheint als eigene Zeile mit normalem
  // +/−-Stepper (kein dollyPrompt), weitere gleiche Stacks kommen also per „+“ ohne neuen Dialog.
  async function addDollyStack(baseCase) {
    const res = await openDollyDialog(opts.dollyDlg, { baseCase, existingCases: cases, onNewDollyStack: opts.onNewDollyStack, stock: stockOpt() });
    if (!res) return;
    created.add(res.newCase.id);
    cases = [...cases.filter(c => c.id !== res.newCase.id), res.newCase];
    const add = capToRoom(res.addition.n, total(), MAX_ITEMS);
    if (add > 0) counts.set(res.addition.caseId, (counts.get(res.addition.caseId) ?? 0) + add);
    renderCompanyOptions();
    renderCaseList();
  }

  function buildItemsState() {
    for (const c of cases) {
      const n = counts.get(c.id) ?? 0;
      if (n <= 0) { itemsState.delete(c.id); continue; }
      const prev = itemsState.get(c.id) ?? [];
      // Vorbelegung je Stück: Lage 1+2 (defaultWizardLayers), „getippt“ nur, wenn der Typ es
      // überhaupt zulässt — der Nutzer ändert Ausnahmen je Zeile oder alles über die Kopfzeile.
      const next = Array.from({ length: n }, (_, i) => prev[i] ?? {
        label: `${c.name} ${i + 1}`.slice(0, MAX_LABEL),
        color: colorFor(c.category),
        layers: defaultWizardLayers(c),
        tipped: canTip(c),
        group: '',
      });
      itemsState.set(c.id, next);
    }
  }
  function renderGroups() {
    buildItemsState();
    const ids = cases.filter(c => (counts.get(c.id) ?? 0) > 0).map(c => c.id);
    groupsEl.innerHTML = ids.map(id => {
      const c = cases.find(x => x.id === id);
      const arr = itemsState.get(id);
      const allowed = layersOf(c);
      const tippable = canTip(c);
      return `
        <fieldset class="wiz-group" data-case="${esc(id)}">
          <legend>${esc(c.name)} <button type="button" data-act="color-all">Farbe auf alle übernehmen</button> <button type="button" data-act="group-all">Gruppe auf alle übernehmen</button></legend>
          ${arr.map((it, i) => `
            <div class="row wiz-item" data-i="${i}">
              <input name="label" value="${esc(it.label)}" maxlength="${MAX_LABEL}">
              <input type="color" name="color" value="${esc(it.color)}">
              <input name="group" list="wiz-group-list" maxlength="${MAX_LABEL}" placeholder="Gruppe" value="${esc(it.group ?? '')}">
              <span class="wiz-layers">
                <span class="wiz-layers-label">Lage</span>
                ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" data-layer="${n}" ${it.layers.includes(n) ? 'checked' : ''} ${allowed.includes(n) ? '' : 'disabled'}>${n}</label>`).join('')}
              </span>
              <label class="check wiz-tipped"><input type="checkbox" name="tipped" ${it.tipped ? 'checked' : ''} ${tippable ? '' : 'disabled'}>getippt</label>
              <small class="hint wiz-layer-hint" ${it.layers.length ? 'hidden' : ''}>Mindestens eine Lage nötig.</small>
            </div>`).join('')}
        </fieldset>`;
    }).join('') || '<p class="hint">Keine Cases ausgewählt.</p>';
    const known = [...new Set([...(opts.groups ?? []), ...allEntries().map(e => e.it.group?.trim()).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, 'de'));
    dlg.querySelector('#wiz-group-list').innerHTML = known.map(g => `<option value="${esc(g)}">`).join('');
    syncAllHead();
  }
  // Alle Stücke mit ihrem Case-Typ, für die Kopfzeile „Alle Stücke“.
  function allEntries() {
    return cases.flatMap(c => (itemsState.get(c.id) ?? []).slice(0, counts.get(c.id) ?? 0).map(it => ({ it, c })));
  }
  function syncAllHead() {
    const entries = allEntries();
    for (const box of allEl.querySelectorAll('input[type="checkbox"]')) {
      const st = bulkState(entries, 'allTipped' in box.dataset ? 'tipped' : Number(box.dataset.allLayer));
      box.checked = st === 'on';
      box.indeterminate = st === 'mixed';
      box.disabled = st === 'none';
    }
  }
  allEl.addEventListener('change', e => {
    const box = e.target;
    const entries = allEntries();
    allHint.hidden = true;
    if ('allTipped' in box.dataset) setTippedForAll(entries, box.checked);
    else {
      const kept = setLayerForAll(entries, Number(box.dataset.allLayer), box.checked);
      if (kept) {
        allHint.textContent = kept === 1
          ? '1 Stück behält diese Lage – mindestens eine Lage nötig.'
          : `${kept} Stücke behalten diese Lage – mindestens eine Lage nötig.`;
        allHint.hidden = false;
      }
    }
    renderGroups();
  });
  groupsEl.addEventListener('input', e => {
    const rowEl = e.target.closest('.wiz-item');
    const groupEl = e.target.closest('.wiz-group');
    if (!rowEl || !groupEl) return;
    const arr = itemsState.get(groupEl.dataset.case);
    const it = arr?.[Number(rowEl.dataset.i)];
    if (!it) return;
    if (e.target.name === 'label') it.label = e.target.value;
    if (e.target.name === 'color') it.color = e.target.value;
    if (e.target.name === 'group') it.group = e.target.value;
    if (e.target.name === 'tipped') it.tipped = e.target.checked;
    if (e.target.dataset.layer) {
      const n = Number(e.target.dataset.layer);
      const hint = rowEl.querySelector('.wiz-layer-hint');
      if (e.target.checked) {
        if (!it.layers.includes(n)) it.layers = [...it.layers, n].sort((a, b) => a - b);
        hint.hidden = true;
      } else if (it.layers.length <= 1) {
        // Die letzte angehakte Lage lässt sich nicht abwählen — ein Stück ohne jede Lage wäre
        // nirgends platzierbar. Häkchen bleibt gesetzt, kurzer Hinweis statt stillem Ignorieren.
        e.target.checked = true;
        hint.hidden = false;
      } else {
        it.layers = it.layers.filter(x => x !== n);
        hint.hidden = true;
      }
    }
    if (e.target.name === 'tipped' || e.target.dataset.layer) syncAllHead();
    if (e.target.dataset.layer && !countWithoutLayer(allEntries())) noLayerHint.hidden = true;
  });
  groupsEl.addEventListener('click', e => {
    const colorBtn = e.target.closest('[data-act="color-all"]');
    const groupBtn = e.target.closest('[data-act="group-all"]');
    if (!colorBtn && !groupBtn) return;
    const groupEl = e.target.closest('.wiz-group');
    const arr = itemsState.get(groupEl.dataset.case);
    if (colorBtn) {
      const firstColor = groupEl.querySelector('.wiz-item input[type="color"]').value;
      for (const it of arr) it.color = firstColor;
    } else {
      const firstGroup = groupEl.querySelector('.wiz-item input[name="group"]').value;
      for (const it of arr) it.group = firstGroup;
    }
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
    if (steps[i] === 'cases') { syncTabUi(); renderCaseList(); }
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
  // Ein Stück ohne Lage wäre nirgends platzierbar (kommt nur bei Case-Typen vor, die weder Lage 1
  // noch 2 erlauben, s. defaultWizardLayers) — „Fertig“ erst, wenn jedes Stück eine Lage hat.
  finishBtn.addEventListener('click', e => {
    const n = countWithoutLayer(allEntries());
    if (!n) return;
    e.preventDefault();
    noLayerHint.textContent = n === 1 ? 'Bei 1 Stück ist keine Lage angehakt.' : `Bei ${n} Stücken ist keine Lage angehakt.`;
    noLayerHint.hidden = false;
  });
  backBtn.addEventListener('click', () => showStep(stepIdx - 1));
  showStep(0);

  // „Material“: Wizard beiseitelegen (schließen, ohne das Ergebnis aufzulösen), Materialverwaltung
  // öffnen, nach deren „Zurück“ mit frischer Case-Liste und unveränderter Auswahl weitermachen.
  let suspended = false;
  dlg.querySelector('[data-act="material"]')?.addEventListener('click', () => {
    suspended = true;
    dlg.returnValue = 'material';
    dlg.close();
  });

  return new Promise(resolve => {
    const onClose = async () => {
      if (suspended) {
        suspended = false;
        let fresh = null;
        try {
          fresh = await opts.onOpenMaterial();
        } catch (err) {
          console.warn(err);
        } finally {
          try {
            cases = refreshWizardCases(counts, fresh ?? cases);
            renderCompanyOptions();
            if (steps[stepIdx] === 'cases') renderCaseList();
            if (steps[stepIdx] === 'labels') renderGroups();
          } finally {
            dlg.returnValue = '';
            dlg.showModal();
          }
        }
        return;
      }
      dlg.removeEventListener('close', onClose);
      const act = dlg.returnValue;
      if (act !== 'finish') return resolve(null);
      buildItemsState();
      const items = [];
      for (const c of cases) {
        const n = counts.get(c.id) ?? 0;
        if (n <= 0) continue;
        const arr = itemsState.get(c.id) ?? [];
        for (let i = 0; i < n; i++) {
          const it = arr[i] ?? { label: '', color: colorFor(c.category), layers: defaultWizardLayers(c), tipped: canTip(c), group: '' };
          items.push({ caseId: c.id, label: it.label.trim(), color: it.color, ...reduceWizardItem(it, c) });
        }
      }
      resolve({
        name: mode === 'add' ? undefined : f.loadName.value.trim(),
        truckId: mode === 'add' ? undefined : f.truckId.value,
        items,
        autoPack: f.autoPack.checked,
      });
    };
    dlg.addEventListener('close', onClose);
    dlg.returnValue = '';
    dlg.showModal();
  });
}
