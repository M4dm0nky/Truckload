import { esc, swatch } from './dom.js';
import { CATEGORIES, colorFor } from '../data/categories.js';
import { outerDims, layersOf } from '../model/geometry.js';
import { isTruss, canTip } from '../model/truss.js';
import { companiesOf, groupCases, renderGroupList, caseKind, CASE_TABS } from './caseGroups.js';
import { MAX_LABEL } from '../model/geometry.js';
import { openTrussDialog } from './truss-wizard.js';

const MAX_ITEMS = 500;

// Reduziert ein im Wizard bearbeitetes Stück auf die Felder, die tatsächlich eine bewusste
// Einschränkung sind: `layers` nur, wenn das Stück eine ECHTE Teilmenge der vom Case-Typ
// erlaubten Lagen trägt (nicht einfach alle angehakt lässt), `tipped` nur, wenn der Case-Typ
// überhaupt tippbar ist (sonst wäre der Wert ohnehin ohne Wirkung). Ohne diese Reduktion würde
// jedes Stück, das der Nutzer nie bewusst eingeschränkt hat, trotzdem `layers`/`tipped` als
// feste Werte tragen — eine spätere Änderung am Case-Typ (z. B. eine neu erlaubte Lage) käme
// dann bei diesen Stücken nie an. Nachträglich lassen sich beide Felder je Stück im Inspector
// ändern (`A.setPieceLayers`/`A.setPieceTipped`, js/ui/inspector.js), mit derselben
// Reduktionsregel. Die Vorbelegung/Anzeige der Checkboxen hier im Wizard bleibt davon
// unberührt (s. defaultWizardLayers), nur das gespeicherte ERGEBNIS wird reduziert.
export function reduceWizardItem(it, c) {
  const allowed = layersOf(c);
  const sameLayers = it.layers.length === allowed.length && it.layers.every(n => allowed.includes(n));
  return {
    ...(sameLayers ? {} : { layers: it.layers }),
    ...(canTip(c) ? { tipped: it.tipped } : {}),
  };
}

// Vorbelegung je Stück im Wizard: Lage 1 und 2 (soweit der Case-Typ sie erlaubt), Lage 3/4 aus
// (Nutzerwunsch 2026-09-25). Erlaubt ein Case-Typ weder Lage 1 noch 2, gelten seine eigenen
// Lagen — sonst hätte das Stück keine einzige Lage (eigene Entscheidung für diesen Randfall).
export function defaultWizardLayers(c) {
  const allowed = layersOf(c);
  const low = allowed.filter(n => n <= 2);
  return [...(low.length ? low : allowed)];
}

// Globale Kopfzeile „Alle Stücke“: `entries` = [{ it, c }] (Wizard-Stück + Case-Typ).
// setLayerForAll schaltet Lage n bei allen Stücken, deren Case-Typ n erlaubt. Beim Abwählen
// bleibt n dort stehen, wo es die letzte Lage wäre (dieselbe Regel wie je Zeile); Rückgabe ist
// die Anzahl dieser Stücke, damit die Oberfläche darauf hinweisen kann.
export function setLayerForAll(entries, n, on) {
  let kept = 0;
  for (const { it, c } of entries) {
    if (!layersOf(c).includes(n)) continue;
    if (on) {
      if (!it.layers.includes(n)) it.layers = [...it.layers, n].sort((a, b) => a - b);
    } else if (it.layers.includes(n)) {
      if (it.layers.length <= 1) kept++;
      else it.layers = it.layers.filter(x => x !== n);
    }
  }
  return kept;
}

export function setTippedForAll(entries, on) {
  for (const { it, c } of entries) if (canTip(c)) it.tipped = on;
}

// Zustand eines Kopf-Häkchens (key = Lage 1–4 oder 'tipped') über alle betroffenen Stücke:
// 'on' alle, 'off' keins, 'mixed' gemischt, 'none' kein Stück, für das es überhaupt gilt.
export function bulkState(entries, key) {
  const vals = key === 'tipped'
    ? entries.filter(e => canTip(e.c)).map(e => e.it.tipped)
    : entries.filter(e => layersOf(e.c).includes(key)).map(e => e.it.layers.includes(key));
  if (!vals.length) return 'none';
  if (vals.every(Boolean)) return 'on';
  return vals.some(Boolean) ? 'mixed' : 'off';
}

function caseLine(c) {
  const company = c.company ? ` · ${c.company}` : '';
  if (isTruss(c)) return `Traverse · ${c.truss.count} Stück · ${c.weight} kg/Stück${company}`;
  const { l, w, h } = outerDims(c);
  return `${l}×${w}×${h} cm · ${c.weight} kg${company}`;
}

// opts: { mode: 'new'|'add', cases, trucks, defaultTruckId, defaultName, onNewCase(draft),
//   trussDlg (<dialog> für „Traverse hinzufügen“, optional – ohne wird der Knopf ausgeblendet),
//   onNewTruss(caseType) (speichert einen neu gebauten Traversenwagen-Case-Typ, s. truss-wizard.js) }
// Ergebnis: { name, truckId, items: [{ caseId, label, color, layers, tipped }], autoPack } oder
// null bei Abbruch.
export function openLoadWizard(dlg, opts = {}) {
  const mode = opts.mode ?? 'new';
  const trucks = opts.trucks ?? [];
  let cases = [...(opts.cases ?? [])];
  const counts = new Map(); // caseId -> Anzahl
  let activeTab = CASE_TABS[0].id; // 'cases' — Reiter der Artikelauswahl, s. caseKind() (caseGroups.js)
  const itemsState = new Map(); // caseId -> [{ label, color, layers, tipped }]
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
        <div class="seg case-tabs">${CASE_TABS.map((t, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
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
          <button type="button" data-act="dec" ${n <= 0 ? 'disabled' : ''}>−</button>
          <span class="qty">${n}</span>
          <button type="button" data-act="inc" ${total() >= MAX_ITEMS ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
  }

  function renderCaseList() {
    const tabCases = cases.filter(c => caseKind(c) === activeTab);
    const groups = groupCases(tabCases, { q: search.value, cat: filterSel.value, company: companyFilterSel.value });
    renderGroupList(list, groups, caseRow, {
      // Vorher „Keine Treffer.“ auch ganz ohne gesetzten Filter — für einen neuen Nutzer, dessen
      // erster Blick auf die eigenen Cases oft genau der Wizard ist, klang das nach einer
      // Fehlbedienung statt nach einer leeren, aber gültigen Bibliothek. js/ui/library.js sagt an
      // derselben Stelle bereits das Richtige (docs/code-review-2026-09-21.md, „N8 — leere Liste
      // ohne Erklärung im Wizard“); dieselbe Formulierung hier übernommen.
      own: '<p class="hint">Noch keine eigenen Cases – „+ Neues Case“ oder eine Vorlage kopieren.</p>',
      presets: '<p class="hint">Keine Treffer für diese Filter.</p>',
      list: '<p class="hint">Keine Treffer für diese Filter.</p>',
    });
    updateTotals();
  }
  // Firmenfilter neu aufbauen, wenn sich die Case-Liste ändert (nach „+ Neues Case“/„Sonderbau“) –
  // vorher blieb er auf dem Stand beim Öffnen des Wizards stehen (docs/code-review-2026-09-21.md,
  // „N7 — Firmenfilter im Wizard veraltet nach + Neues Case“). js/ui/library.js macht es für
  // dieselbe Hilfsfunktion bereits richtig (renderCompanyOptions) und merkt sich zusätzlich die
  // bisherige Auswahl.
  //
  // Heute ohne beobachtbare Wirkung, bewusst als Vorsorge stehen gelassen (Fix-Runde 1, Reviewer):
  // `js/ui/case-editor.js` hat kein Formularfeld für `company` und setzt es beim Speichern explizit
  // auf `undefined` (Zeile „builtin: false, note: undefined, company: undefined, …“) – ein über
  // „+ Neues Case“/„Sonderbau“ angelegtes Case kann also nie eine neue Firma mitbringen, `company`
  // kommt heute ausschließlich aus der mitgelieferten Bibliothek (`js/data/case-library.js`).
  // Der Fall tritt erst ein, wenn der Case-Editor je ein Firmenfeld bekommt – dann greift dieser
  // Aufruf ohne weitere Änderung.
  function renderCompanyOptions() {
    const prev = companyFilterSel.value;
    const companies = companiesOf(cases);
    companyFilterSel.innerHTML = `<option value="">Alle Firmen</option>${companies.map(name => `<option${name === prev ? ' selected' : ''}>${esc(name)}</option>`).join('')}`;
    if (!companies.includes(prev)) companyFilterSel.value = '';
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

  async function addNewCase(draft) {
    const c = await opts.onNewCase?.(draft);
    if (!c) return;
    cases = [...cases.filter(x => x.id !== c.id), c];
    // Dieselbe MAX_ITEMS-Grenze wie der „+“-Stepper (Zeile 141) — vorher umging „+ Neues Case“/
    // „Sonderbau“ sie, „Weiter“ blockierte danach mit „Maximal 500 Stück je Wizard-Durchlauf“, ohne
    // dass der Nutzer verstehen konnte, warum ein einzelnes neu angelegtes Case das auslöst
    // (docs/code-review-2026-09-21.md, „N9 — + Neues Case umgeht die 500er-Grenze“).
    if (total() < MAX_ITEMS) counts.set(c.id, (counts.get(c.id) ?? 0) + 1);
    renderCompanyOptions();
    renderCaseList();
  }
  newCaseBtn.addEventListener('click', () => addNewCase());
  sonderbauBtn.addEventListener('click', () =>
    addNewCase({ category: 'Sonderbau', wheels: true, dimsInclWheels: false }));

  // „Truss hinzufügen“ (Task 3): eigener, mengenbasierter Dialog statt Stepper-Klicks – ergänzt
  // Cases und Stückzahlen direkt in `counts`/`cases`, genau wie addNewCase() oben. Neue klassische
  // Wagen-Case-Typen werden über `opts.onNewTruss` gespeichert (derselbe Store-Zugriffspfad wie
  // `opts.onNewCase`, damit load-wizard.js weiterhin store-unwissend bleibt); Pre-Rig-Presets
  // existieren schon in `cases` (kommen über `opts.cases` aus dem bereits gemergten Bestand).
  async function addTruss() {
    const res = await openTrussDialog(opts.trussDlg, { cases, onNewTruss: opts.onNewTruss });
    if (!res) return;
    if (res.newCases.length) cases = [...cases.filter(c => !res.newCases.some(nc => nc.id === c.id)), ...res.newCases];
    // Dieselbe MAX_ITEMS-Grenze wie addNewCase() oben — anders als dort kann eine einzelne
    // Addition hier aber weit mehr als 1 Stück auf einmal bringen (z. B. alle gleich
    // besetzten Wagen eines "Gesamtstückzahl"-Laufs landen als eine Addition mit großem n),
    // ein einfaches Vorher-Gate wie bei addNewCase würde die Grenze also selbst noch
    // überspringen können. Deshalb wird n auf den verbleibenden Platz gekappt, statt nur
    // ja/nein zu entscheiden (Befund der Abschlussprüfung: „addTruss umgeht die
    // 500er-Grenze“).
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
          <legend>${esc(c.name)} <button type="button" data-act="color-all">Farbe auf alle übernehmen</button></legend>
          ${arr.map((it, i) => `
            <div class="row wiz-item" data-i="${i}">
              <input name="label" value="${esc(it.label)}" maxlength="${MAX_LABEL}">
              <input type="color" name="color" value="${esc(it.color)}">
              <span class="wiz-layers">
                <span class="wiz-layers-label">Lage</span>
                ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" data-layer="${n}" ${it.layers.includes(n) ? 'checked' : ''} ${allowed.includes(n) ? '' : 'disabled'}>${n}</label>`).join('')}
              </span>
              <label class="check wiz-tipped"><input type="checkbox" name="tipped" ${it.tipped ? 'checked' : ''} ${tippable ? '' : 'disabled'}>getippt</label>
              <small class="hint wiz-layer-hint" hidden>Mindestens eine Lage nötig.</small>
            </div>`).join('')}
        </fieldset>`;
    }).join('') || '<p class="hint">Keine Cases ausgewählt.</p>';
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
          const it = arr[i] ?? { label: '', color: colorFor(c.category), layers: defaultWizardLayers(c), tipped: canTip(c) };
          items.push({ caseId: c.id, label: it.label.trim(), color: it.color, ...reduceWizardItem(it, c) });
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
