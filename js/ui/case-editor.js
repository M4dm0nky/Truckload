import { CATEGORIES, colorFor } from '../data/categories.js';
import { hasWheels, layersOf, DEFAULT_WHEEL_H, NEW_CASE_WHEEL_H, WHEEL_PRESETS, outerDims } from '../model/geometry.js';
import { TRUSS_PROFILES, trussDims, isTruss } from '../model/truss.js';
import { CASE_LIMITS } from '../store/io.js';
import { showConfirm } from './confirmDialog.js';

const DEFAULTS = { name: '', content: '', category: 'Sonstiges', l: 120, w: 60, h: 60, weight: 50,
  tippable: true, stackable: true, maxTopLoad: null, stock: null };
const TRUSS_DEFAULTS = { length: 300, width: 29, count: 4 };
const QUICK_LENGTHS = [100, 200, 240, 250, 300, 400];

export function openCaseEditor(dlg, c, { usedIn = 0, draft } = {}) {
  // Absicherung gegen einen zweiten Aufruf, bevor der `close`-Listener des vorigen gefeuert hat:
  // der ist an `dlg` selbst hängt (überlebt also das `dlg.innerHTML = …` unten) und würde beim
  // Schließen DIESES Dialogs sonst über sein eigenes, abgehängtes `f` die Werte des alten Formulars
  // lesen und die alte Promise auflösen (heute unerreichbar, da `#dlg-case` nur aus zwei sequentiellen
  // `await`-Pfaden bedient wird – docs/code-review-2026-09-21.md, „S7 — derselbe <dialog> zweimal offen“).
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const src = c ?? draft ?? null;
  const v = { ...DEFAULTS, color: colorFor('Sonstiges'), ...(src ?? {}) };
  if (!CATEGORIES.some(k => k.name === v.category)) v.category = 'Sonstiges';
  if (src && src.color == null) v.color = colorFor(v.category);
  const isNew = !c || c.builtin;
  const dim = n => `type="number" name="${n}" min="1" max="${CASE_LIMITS[n]}" step="0.5" required`;
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neues Case' : 'Case bearbeiten'}</h2>
      ${c?.builtin ? '<p class="hint">Vorlage (Richtwert) – Speichern legt eine eigene Kopie an.</p>' : ''}
      <label>Name<input name="name" required maxlength="80" placeholder="z. B. Kabelcase Strom 1"></label>
      <label>Inhalt<textarea name="content" rows="3" placeholder="z. B. 10× Schuko 10 m, 4× CEE 32 A 25 m"></textarea></label>
      <div class="row">
        <label>Gewerk<select name="category">${CATEGORIES.map(k => `<option>${k.name}</option>`).join('')}</select></label>
        <label>Farbe<input type="color" name="color"></label>
      </div>
      <div class="row kind-switch">
        <label><input type="radio" name="kind" value="case"> Case</label>
        <label><input type="radio" name="kind" value="truss"> Traversenwagen</label>
      </div>
      <fieldset class="case-only"><legend>Maße stehend (cm)</legend>
        <div class="row"><label>Länge<input ${dim('l')}></label><label>Breite<input ${dim('w')}></label><label>Höhe<input ${dim('h')}></label></div>
        <p class="hint outer-dims-hint"></p>
      </fieldset>
      <fieldset class="case-only"><legend>Rollen</legend>
        <label class="check"><input type="checkbox" name="wheels"> mit Rollen</label>
        <div class="row">
          <label>Rollenhöhe<select name="wheelPreset">
            ${WHEEL_PRESETS.map(p => `<option value="${p.h}">${p.name} – ${p.h} cm</option>`).join('')}
            <option value="custom">eigene …</option>
          </select></label>
          <label class="wheel-custom-label">eigene Höhe (cm)<input type="number" name="wheelHCustom" min="1" max="40" step="1"></label>
        </div>
        <div class="row">
          <label class="check"><input type="radio" name="dimsInclWheels" value="incl"> Maß ist inkl. Rollen</label>
          <label class="check"><input type="radio" name="dimsInclWheels" value="excl"> Maß ist ohne Rollen – Rollen dazurechnen</label>
        </div>
        <p class="hint wheel-h-hint" hidden>Rollenhöhe muss kleiner als die Case-Höhe sein (Maß ist inkl. Rollen).</p>
      </fieldset>
      <fieldset class="truss-only" hidden><legend>Traversenwagen</legend>
        <div class="row">
          <label>Traversenlänge (cm)<input type="number" name="trussLength" min="50" max="1000" step="1" required></label>
        </div>
        <div class="row quick-lengths">${QUICK_LENGTHS.map(n => `<button type="button" class="quick-len" data-len="${n}">${n}</button>`).join('')}</div>
        <div class="row">
          <label>Traversenbreite<select name="trussWidthProfile">
            ${TRUSS_PROFILES.map(p => `<option value="${p.width}">${p.name} – ${p.width} cm</option>`).join('')}
            <option value="custom">eigene …</option>
          </select></label>
          <label>eigene Breite (cm)<input type="number" name="trussWidthCustom" min="1" max="40" step="1" required></label>
          <label>Anzahl Stück<input type="number" name="trussCount" min="1" max="12" step="1" required></label>
        </div>
        <p class="hint truss-dims"></p>
        <p class="hint truss-hint" hidden>Traversenlänge, -breite und Stückzahl müssen größer als 0 sein.</p>
        <p class="hint truss-width-hint" hidden>Traversenbreite max. 40 cm (Wagen 60er oder 80er)</p>
      </fieldset>
      <div class="row">
        <label>Gewicht beladen (kg)<input type="number" name="weight" min="0" max="${CASE_LIMITS.weight}" step="0.5" required></label>
        <label>Bestand (Stück)<input type="number" name="stock" min="0" max="${CASE_LIMITS.stock}" step="1"></label>
      </div>
      <label class="check case-only"><input type="checkbox" name="tippable"> tippbar (darf auf die Seite getippt werden)</label>
      <label class="check"><input type="checkbox" name="stackable"> stapelbar (darf etwas obendrauf)</label>
      <label>Max. Last obendrauf (kg, leer = unbegrenzt)<input type="number" name="maxTopLoad" min="0" max="${CASE_LIMITS.maxTopLoad}" step="1"></label>
      <fieldset><legend>Erlaubte Lagen</legend>
        <div class="row">
          ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" class="layer-check" value="${n}"> Lage ${n}</label>`).join('')}
        </div>
        <p class="hint layer-hint" hidden>Mindestens eine Lage muss ausgewählt sein.</p>
      </fieldset>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = c?.builtin ? `${v.name} (eigenes)` : v.name;
  f.content.value = v.content;
  f.category.value = v.category;
  f.color.value = v.color;
  for (const k of ['l', 'w', 'h', 'weight']) f[k].value = v[k];
  f.stock.value = v.stock ?? '';
  f.maxTopLoad.value = v.maxTopLoad ?? '';
  f.tippable.checked = v.tippable;
  f.stackable.checked = v.stackable;

  const wheelCustomLabel = f.wheelHCustom.parentElement;
  const dimsInclRadios = [...dlg.querySelectorAll('input[name="dimsInclWheels"]')];
  const outerDimsHint = dlg.querySelector('.outer-dims-hint');
  const wheelHHint = dlg.querySelector('.wheel-h-hint');
  function setWheelHValue(h) {
    const match = WHEEL_PRESETS.some(p => p.h === h);
    f.wheelPreset.value = match ? String(h) : 'custom';
    f.wheelHCustom.value = h;
    wheelCustomLabel.hidden = match;
  }
  const storedWheelH = Number.isFinite(v.wheelH) ? v.wheelH : null;
  const rawWheelH = storedWheelH > 0 ? storedWheelH : (c ? DEFAULT_WHEEL_H : NEW_CASE_WHEEL_H);
  f.wheels.checked = hasWheels(v);
  setWheelHValue(rawWheelH);
  const inclWheels = v.dimsInclWheels !== false;
  for (const r of dimsInclRadios) r.checked = r.value === (inclWheels ? 'incl' : 'excl');

  function currentWheelH() {
    return f.wheelPreset.value === 'custom' ? Number(f.wheelHCustom.value) : Number(f.wheelPreset.value);
  }
  function inclWheelsChecked() {
    return (dimsInclRadios.find(r => r.checked)?.value ?? 'incl') !== 'excl';
  }
  function wheelHInvalid() {
    return f.wheels.checked && inclWheelsChecked() && currentWheelH() >= Number(f.h.value);
  }
  function updateOuterDimsHint() {
    const l = Number(f.l.value), w = Number(f.w.value), h = Number(f.h.value);
    wheelHHint.hidden = !(h > 0 && wheelHInvalid());
    if (!(l > 0 && w > 0 && h > 0)) { outerDimsHint.textContent = ''; return; }
    const inclChecked = inclWheelsChecked();
    const d = outerDims({ l, w, h, wheels: f.wheels.checked, wheelH: currentWheelH(), dimsInclWheels: inclChecked });
    outerDimsHint.textContent = `→ im Truck ${d.l} × ${d.w} × ${d.h} cm`;
  }
  function updateWheelsUi() {
    const on = f.wheels.checked;
    f.wheelPreset.disabled = !on;
    f.wheelHCustom.disabled = !on || f.wheelPreset.value !== 'custom';
    for (const r of dimsInclRadios) r.disabled = !on;
    updateOuterDimsHint();
  }
  f.wheels.addEventListener('change', updateWheelsUi);
  f.wheelPreset.addEventListener('change', () => {
    wheelCustomLabel.hidden = f.wheelPreset.value !== 'custom';
    f.wheelHCustom.disabled = !f.wheels.checked || f.wheelPreset.value !== 'custom';
    updateOuterDimsHint();
  });
  f.wheelHCustom.addEventListener('input', updateOuterDimsHint);
  for (const r of dimsInclRadios) r.addEventListener('change', updateOuterDimsHint);
  for (const name of ['l', 'w', 'h']) f[name].addEventListener('input', updateOuterDimsHint);
  updateWheelsUi();

  const kindInputs = [...dlg.querySelectorAll('input[name="kind"]')];
  const caseOnly = [...dlg.querySelectorAll('.case-only')];
  const trussOnly = dlg.querySelector('.truss-only');
  const trussDimsHint = dlg.querySelector('.truss-dims');
  const trussHint = dlg.querySelector('.truss-hint');
  const trussWidthHint = dlg.querySelector('.truss-width-hint');
  const trussWidthCustomLabel = f.trussWidthCustom.parentElement;
  const truss0 = v.truss ?? TRUSS_DEFAULTS;
  const knownWidth = TRUSS_PROFILES.some(p => p.width === truss0.width);
  f.trussLength.value = truss0.length;
  f.trussWidthProfile.value = knownWidth ? String(truss0.width) : 'custom';
  f.trussWidthCustom.value = truss0.width;
  function syncTrussWidthCustom() {
    const custom = f.trussWidthProfile.value === 'custom';
    trussWidthCustomLabel.hidden = !custom;
    f.trussWidthCustom.disabled = !custom;
    f.trussWidthCustom.required = custom;
  }
  syncTrussWidthCustom();
  f.trussCount.value = truss0.count;

  function currentTruss() {
    const width = f.trussWidthProfile.value === 'custom' ? Number(f.trussWidthCustom.value) : Number(f.trussWidthProfile.value);
    return { length: Number(f.trussLength.value), width, count: Number(f.trussCount.value) };
  }
  function trussFieldsValid(t) {
    return t.length > 0 && t.width > 0 && t.count > 0;
  }
  function updateTrussDims() {
    trussHint.hidden = true;
    const t = currentTruss();
    trussWidthHint.hidden = !(t.width > 40);
    if (t.width > 40) {
      trussDimsHint.textContent = '';
      return;
    }
    if (trussFieldsValid(t)) {
      const d = trussDims(t);
      trussDimsHint.textContent = `→ im Truck ${d.l} × ${d.w} × ${d.h} cm`;
    } else {
      trussDimsHint.textContent = '';
    }
  }
  function applyKind(kind) {
    const isT = kind === 'truss';
    for (const el of caseOnly) el.hidden = isT;
    trussOnly.hidden = !isT;
    f.l.required = !isT; f.w.required = !isT; f.h.required = !isT;
    f.l.disabled = isT; f.w.disabled = isT; f.h.disabled = isT;
    for (const el of trussOnly.querySelectorAll('input,select')) el.disabled = !isT;
    if (isT) syncTrussWidthCustom();
    updateTrussDims();
  }
  let prevKind = isTruss(v) ? 'truss' : 'case';
  let caseWheelsSnapshot = null; // vom Nutzer gesetzter Rollen-Zustand, gemerkt beim Verlassen von "Case"
  for (const r of kindInputs) {
    r.checked = r.value === prevKind;
    r.addEventListener('change', () => {
      if (prevKind === 'case' && r.value === 'truss') {
        caseWheelsSnapshot = {
          wheels: f.wheels.checked, preset: f.wheelPreset.value, custom: f.wheelHCustom.value,
          dimsIncl: dimsInclRadios.find(x => x.checked)?.value ?? 'incl',
        };
      }
      if (prevKind === 'truss' && r.value === 'case') {
        if (caseWheelsSnapshot) {
          f.wheels.checked = caseWheelsSnapshot.wheels;
          f.wheelPreset.value = caseWheelsSnapshot.preset;
          f.wheelHCustom.value = caseWheelsSnapshot.custom;
          wheelCustomLabel.hidden = caseWheelsSnapshot.preset !== 'custom';
          for (const x of dimsInclRadios) x.checked = x.value === caseWheelsSnapshot.dimsIncl;
        } else if (!f.wheels.checked || !(currentWheelH() > 0)) {
          f.wheels.checked = true;
          setWheelHValue(DEFAULT_WHEEL_H);
        }
      }
      prevKind = r.value;
      applyKind(r.value);
      updateWheelsUi();
    });
  }
  f.trussWidthProfile.addEventListener('change', () => {
    syncTrussWidthCustom();
    updateTrussDims();
  });
  for (const name of ['trussLength', 'trussWidthCustom', 'trussCount']) f[name].addEventListener('input', updateTrussDims);
  for (const btn of dlg.querySelectorAll('.quick-len')) {
    btn.addEventListener('click', () => { f.trussLength.value = btn.dataset.len; updateTrussDims(); });
  }
  applyKind(isTruss(v) ? 'truss' : 'case');

  const layerBoxes = [...dlg.querySelectorAll('.layer-check')];
  const initialLayers = layersOf(v);
  for (const cb of layerBoxes) cb.checked = initialLayers.includes(Number(cb.value));
  const layerHint = dlg.querySelector('.layer-hint');
  dlg.querySelector('form').addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save' && act) return;
    if (!layerBoxes.some(cb => cb.checked)) {
      e.preventDefault();
      layerHint.hidden = false;
    }
    const kind = kindInputs.find(cb => cb.checked)?.value ?? 'case';
    if (kind === 'truss') {
      const t = currentTruss();
      if (t.width > 40) {
        e.preventDefault();
        trussWidthHint.hidden = false;
      } else if (!trussFieldsValid(t)) {
        e.preventDefault();
        trussHint.hidden = false;
      }
    } else if (wheelHInvalid()) {
      e.preventDefault();
      wheelHHint.hidden = false;
    }
  });
  for (const cb of layerBoxes) cb.addEventListener('change', () => { layerHint.hidden = true; });
  f.category.addEventListener('change', () => {
    if (f.color.value === colorFor(v.category) || f.color.value === colorFor(f.category.dataset.prev ?? v.category))
      f.color.value = colorFor(f.category.value);
    f.category.dataset.prev = f.category.value;
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') {
        const msg = usedIn ? `„${v.name}“ wird in ${usedIn} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${v.name}“ löschen?`;
        showConfirm(msg, { okLabel: 'Löschen', danger: true }).then(ok => resolve(ok ? { action: 'delete' } : null));
        return;
      }
      if (act !== 'save') return resolve(null);
      const numOrNull = s => (s === '' ? null : Number(s));
      const kind = kindInputs.find(cb => cb.checked)?.value ?? 'case';
      const base = {
        ...v,
        id: isNew ? crypto.randomUUID() : v.id,
        builtin: false, note: undefined, company: undefined, source: undefined,
        name: f.name.value.trim(), content: f.content.value.trim(),
        category: f.category.value, color: f.color.value,
        weight: Number(f.weight.value), stock: numOrNull(f.stock.value),
        maxTopLoad: numOrNull(f.maxTopLoad.value), stackable: f.stackable.checked,
        layers: layerBoxes.filter(cb => cb.checked).map(cb => Number(cb.value)),
      };
      if (kind === 'truss') {
        const truss = currentTruss();
        const d = trussDims(truss);
        resolve({ action: 'save', value: {
          ...base, kind: 'truss', truss,
          l: d.l, w: d.w, h: d.h, wheelH: 0, tippable: false,
        } });
      } else {
        resolve({ action: 'save', value: {
          ...base, kind: undefined, truss: undefined,
          l: Number(f.l.value), w: Number(f.w.value), h: Number(f.h.value),
          wheels: f.wheels.checked, wheelH: f.wheels.checked ? currentWheelH() : 0,
          dimsInclWheels: (dimsInclRadios.find(r => r.checked)?.value ?? 'incl') !== 'excl',
          tippable: f.tippable.checked,
        } });
      }
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
