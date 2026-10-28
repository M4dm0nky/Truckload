import { CATEGORIES, colorFor } from '../data/categories.js';
import { hasWheels, layersOf, DEFAULT_WHEEL_H, NEW_CASE_WHEEL_H, WHEEL_PRESETS, outerDims, isTruss } from '../model/geometry.js';
import { TRUSS_PROFILES, trussDims } from '../model/truss.js';
import { CASE_LIMITS, NAME_MAX } from '../model/limits.js';
import { QUICK_LENGTHS } from './caseInfo.js';
import { showConfirm } from './confirmDialog.js';
import { esc } from './dom.js';
import { applyStockTarget } from '../model/material.js';
import { stockTargetHtml, readStockTarget, wireStockTarget } from './stock-target.js';
import { t, trade } from '../i18n/i18n.js';

const DEFAULTS = { name: '', content: '', category: 'Sonstiges', l: 120, w: 60, h: 60, weight: 50,
  tippable: true, stackable: true, maxTopLoad: null, stock: null };
const TRUSS_DEFAULTS = { length: 300, width: 29, count: 4 };

// Welche Herkunftsfelder ein gespeichertes Case aus dem Bearbeiten-Ausgangswert `v` übernimmt.
// Neue Cases (auch Kopien einer Vorlage) behalten nur die Firma; `legacy` (ausgeblendete Vorlage)
// darf nie in eine eigene Kopie wandern, sonst wäre sie unsichtbar. Überlagerungen (overrideBuiltin)
// behalten ihre Quelle.
export function retainedFields(v, { isNew, fromTemplate, overrideBuiltin }) {
  return {
    company: v.company,
    source: overrideBuiltin || !isNew ? v.source : undefined,
    note: undefined,
    legacy: fromTemplate ? undefined : v.legacy,
    onlyInPlan: v.onlyInPlan,
  };
}

// Gewerk-Auswahl: der Wert bleibt der deutsche Name (gespeichert), sichtbar ist die Übersetzung.
export const categoryOptionsHtml = () =>
  CATEGORIES.map(k => `<option value="${esc(k.name)}">${esc(trade(k.name))}</option>`).join('');

export async function openCaseEditor(dlg, c, { usedIn = 0, draft, allowDelete = false, stock, overrideBuiltin = false } = {}) {
  // Ein noch offener Dialog: sein `close`-Listener hängt an `dlg` selbst, überlebt also das
  // `dlg.innerHTML = …` unten und würde beim Schließen DIESES Dialogs die Werte des alten, abgehängten
  // Formulars lesen und die alte Promise auflösen. Heute unerreichbar, weil `#dlg-case` nur aus zwei
  // sequentiellen `await`-Pfaden bedient wird.
  if (dlg.open) { // close() feuert `close` asynchron – erst abwarten (Listener vor close() anhängen), sonst trifft das alte Ereignis den neuen Listener
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const src = c ?? draft ?? null;
  const v = { ...DEFAULTS, color: colorFor('Sonstiges'), ...(src ?? {}) };
  if (!CATEGORIES.some(k => k.name === v.category)) v.category = 'Sonstiges';
  if (src && src.color == null) v.color = colorFor(v.category);
  const isNew = !c || (c.builtin && !overrideBuiltin);
  const fromTemplate = !!c?.builtin && !overrideBuiltin;
  const dim = n => `type="number" name="${n}" min="1" max="${CASE_LIMITS[n]}" step="any" required`;
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? t('Neues Case') : t('Case bearbeiten')}</h2>
      ${fromTemplate ? `<p class="hint">${t('Vorlage (Richtwert) – Speichern legt eine eigene Kopie an.')}</p>` : ''}
      <label>${t('Name')}<input name="name" required maxlength="${NAME_MAX}" placeholder="${t('z. B. Kabelcase Strom 1')}"></label>
      <label>${t('Inhalt')}<textarea name="content" rows="3" placeholder="${t('z. B. 10× Schuko 10 m, 4× CEE 32 A 25 m')}"></textarea></label>
      <div class="row">
        <label>${t('Gewerk')}<select name="category">${categoryOptionsHtml()}</select></label>
        <label>${t('Farbe')}<input type="color" name="color"></label>
      </div>
      <div class="row kind-switch">
        <label><input type="radio" name="kind" value="case"> ${t('Case')}</label>
        <label><input type="radio" name="kind" value="truss"> ${t('Traversenwagen')}</label>
      </div>
      <fieldset class="case-only"><legend>${t('Maße stehend (cm)')}</legend>
        <div class="row"><label>${t('Länge')}<input ${dim('l')}></label><label>${t('Breite')}<input ${dim('w')}></label><label>${t('Höhe')}<input ${dim('h')}></label></div>
        <p class="hint outer-dims-hint"></p>
      </fieldset>
      <fieldset class="case-only"><legend>${t('Rollen')}</legend>
        <label class="check"><input type="checkbox" name="wheels"> ${t('mit Rollen')}</label>
        <div class="row">
          <label>${t('Rollenhöhe')}<select name="wheelPreset">
            ${WHEEL_PRESETS.map(p => `<option value="${p.h}">${esc(p.name)} – ${p.h} cm</option>`).join('')}
            <option value="custom">${t('eigene …')}</option>
          </select></label>
          <label class="wheel-custom-label">${t('eigene Höhe (cm)')}<input type="number" name="wheelHCustom" min="1" max="40" step="1"></label>
        </div>
        <div class="row">
          <label class="check"><input type="radio" name="dimsInclWheels" value="incl"> ${t('Maß ist inkl. Rollen')}</label>
          <label class="check"><input type="radio" name="dimsInclWheels" value="excl"> ${t('Maß ist ohne Rollen – Rollen dazurechnen')}</label>
        </div>
        <p class="hint wheel-h-hint" hidden>${t('Rollenhöhe muss kleiner als die Case-Höhe sein (Maß ist inkl. Rollen).')}</p>
      </fieldset>
      <fieldset class="truss-only" hidden><legend>${t('Traversenwagen')}</legend>
        <div class="row">
          <label>${t('Traversenlänge (cm)')}<input type="number" name="trussLength" min="50" max="1000" step="1" required></label>
        </div>
        <div class="row quick-lengths">${QUICK_LENGTHS.map(n => `<button type="button" class="quick-len" data-len="${n}">${n}</button>`).join('')}</div>
        <div class="row">
          <label>${t('Traversenbreite')}<select name="trussWidthProfile">
            ${TRUSS_PROFILES.map(p => `<option value="${p.width}">${p.name} – ${p.width} cm</option>`).join('')}
            <option value="custom">${t('eigene …')}</option>
          </select></label>
          <label>${t('eigene Breite (cm)')}<input type="number" name="trussWidthCustom" min="1" max="40" step="1" required></label>
          <label>${t('Anzahl Stück')}<input type="number" name="trussCount" min="1" max="12" step="1" required></label>
        </div>
        <p class="hint truss-dims"></p>
        <p class="hint truss-hint" hidden>${t('Traversenlänge, -breite und Stückzahl müssen größer als 0 sein.')}</p>
        <p class="hint truss-width-hint" hidden>${t('Traversenbreite max. 40 cm (Wagen 60er oder 80er)')}</p>
      </fieldset>
      <div class="row">
        <label>${t('Gewicht beladen (kg)')}<input type="number" name="weight" min="0" max="${CASE_LIMITS.weight}" step="any" required></label>
        <label>${t('Bestand (Stück)')}<input type="number" name="stock" min="0" max="${CASE_LIMITS.stock}" step="1"></label>
      </div>
      <label class="check case-only"><input type="checkbox" name="tippable"> ${t('tippbar (darf auf die Seite getippt werden)')}</label>
      <label class="check"><input type="checkbox" name="stackable"> ${t('stapelbar (darf etwas obendrauf)')}</label>
      <label>${t('Max. Last obendrauf (kg, leer = unbegrenzt)')}<input type="number" name="maxTopLoad" min="0" max="${CASE_LIMITS.maxTopLoad}" step="1"></label>
      <fieldset><legend>${t('Erlaubte Lagen')}</legend>
        <div class="row">
          ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" class="layer-check" value="${n}"> ${t('Lage {n}', { n })}</label>`).join('')}
        </div>
        <p class="hint layer-hint" hidden>${t('Mindestens eine Lage muss ausgewählt sein.')}</p>
      </fieldset>
      ${stock ? stockTargetHtml(stock) : ''}
      <menu>
        ${allowDelete && !isNew ? `<button value="delete" class="danger" formnovalidate>${t('Löschen')}</button>` : ''}
        <span class="grow"></span>
        <button value="cancel" formnovalidate>${t('Abbrechen')}</button>
        <button value="save" class="primary">${t('Speichern')}</button>
      </menu>
    </form>`;
  const form = dlg.querySelector('form');
  const f = form.elements;
  wireStockTarget(form, stock?.collections ?? []);
  f.name.value = fromTemplate ? t('{name} (eigenes)', { name: v.name }) : v.name;
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
    outerDimsHint.textContent = t('→ im Truck {l} × {w} × {h} cm', { l: d.l, w: d.w, h: d.h });
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
    // wagonW (Wagenbreite aus dem Traversen-Dialog) hat hier kein Feld und bleibt erhalten.
    return { length: Number(f.trussLength.value), width, count: Number(f.trussCount.value),
      ...(truss0.wagonW != null ? { wagonW: truss0.wagonW } : {}) };
  }
  function trussFieldsValid(tr) {
    return tr.length > 0 && tr.width > 0 && tr.count > 0;
  }
  function updateTrussDims() {
    trussHint.hidden = true;
    const tr = currentTruss();
    trussWidthHint.hidden = !(tr.width > 40);
    if (tr.width > 40) {
      trussDimsHint.textContent = '';
      return;
    }
    if (trussFieldsValid(tr)) {
      const d = trussDims(tr);
      trussDimsHint.textContent = t('→ im Truck {l} × {w} × {h} cm', { l: d.l, w: d.w, h: d.h });
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
      const tr = currentTruss();
      if (tr.width > 40) {
        e.preventDefault();
        trussWidthHint.hidden = false;
      } else if (!trussFieldsValid(tr)) {
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
        const msg = usedIn ? t('„{name}“ wird in {used} Ladeplan/-plänen verwendet. Trotzdem löschen?', { name: v.name, used: usedIn }) : t('„{name}“ löschen?', { name: v.name });
        showConfirm(msg, { okLabel: t('Löschen'), danger: true }).then(ok => resolve(ok ? { action: 'delete' } : null));
        return;
      }
      if (act !== 'save') return resolve(null);
      const numOrNull = s => (s === '' ? null : Number(s));
      const kind = kindInputs.find(cb => cb.checked)?.value ?? 'case';
      const base = {
        ...v,
        id: isNew ? crypto.randomUUID() : v.id,
        builtin: false, ...retainedFields(v, { isNew, fromTemplate, overrideBuiltin }),
        name: f.name.value.trim(), content: f.content.value.trim(),
        category: f.category.value, color: f.color.value,
        weight: Number(f.weight.value), stock: numOrNull(f.stock.value),
        maxTopLoad: numOrNull(f.maxTopLoad.value), stackable: f.stackable.checked,
        layers: layerBoxes.filter(cb => cb.checked).map(cb => Number(cb.value)),
      };
      const withStock = value => (stock ? applyStockTarget(value, readStockTarget(form, stock)) : value);
      if (kind === 'truss') {
        const truss = currentTruss();
        const d = trussDims(truss);
        resolve({ action: 'save', value: withStock({
          ...base, kind: 'truss', truss,
          l: d.l, w: d.w, h: d.h, wheelH: 0, tippable: false,
        }) });
      } else {
        resolve({ action: 'save', value: withStock({
          ...base, kind: undefined, truss: undefined,
          l: Number(f.l.value), w: Number(f.w.value), h: Number(f.h.value),
          wheels: f.wheels.checked, wheelH: f.wheels.checked ? currentWheelH() : 0,
          dimsInclWheels: (dimsInclRadios.find(r => r.checked)?.value ?? 'incl') !== 'excl',
          tippable: f.tippable.checked,
        }) });
      }
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
