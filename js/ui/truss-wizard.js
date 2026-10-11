import { esc } from './dom.js';
import { QUICK_LENGTHS, trussProfileName } from './caseInfo.js';
import { isTruss } from '../model/geometry.js';
import { TRUSS_PROFILES, DOLLY_WIDTHS, trussDims, wagonWeight, splitWagons, findMatchingWagon } from '../model/truss.js';
import { colorFor } from '../data/categories.js';
import { applyStockTarget } from '../model/material.js';
import { stockTargetHtml, readStockTarget, wireStockTarget } from './stock-target.js';

// Baut einen neuen Traversenwagen-Case-Typ für eine Stückzahl auf einem Wagen (klassische F34/
// F40-Traverse) – gleiches Schema wie die feste Vorlage T() in js/data/preset-cases.js, nur mit
// `builtin: false`, weil hier ein vom Nutzer erzeugtes Case entsteht statt einer mitgelieferten
// Vorlage. Rein funktional (keine DOM-/Store-Berührung), deshalb wie splitWagons()/wagonWeight()
// unabhängig testbar.
// `wagonW` (optional): Wagenbreite der Firma in cm, sonst die Automatik 60/80 (trussDims).
export function buildWagonCaseType(id, profileName, length, width, count, wagonW) {
  const truss = { length, width, count, ...(wagonW != null ? { wagonW } : {}) };
  const { l, w, h } = trussDims(truss);
  const weight = wagonWeight(length, width, count);
  const lengthLabel = (length / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const name = `Traversenwagen ${profileName} ${lengthLabel} m (${count} Stück)`;
  return {
    id, builtin: false, name, content: '', category: 'Rigging', color: colorFor('Rigging'),
    l, w, h, weight, tippable: false, stackable: true, maxTopLoad: null, stock: null, wheelH: 0,
    kind: 'truss', truss, layers: [1, 2],
  };
}

// Gruppiert die stehenden Pre-Rig-Presets (truss.standing === true) nach Hersteller/Modell für
// die <optgroup>-Einteilung im Dropdown. Presetnamen folgen durchgehend dem Schema
// „Traversenwagen <Modell> <Länge> m – <Hersteller>“ (js/data/preset-cases.js, MLT()); ein Name
// außerhalb des Schemas landet in einer Sammelgruppe statt den Dialog zum Absturz zu bringen.
function groupPrerigCases(cases) {
  const groups = new Map();
  for (const c of cases) {
    const m = c.name.match(/^Traversenwagen (.+?) ([\d,]+\s*m) – (.+)$/);
    const groupLabel = m ? `${m[3]} ${m[1]}` : 'Sonstige';
    const optionLabel = m ? m[2] : c.name;
    if (!groups.has(groupLabel)) groups.set(groupLabel, []);
    groups.get(groupLabel).push({ id: c.id, label: optionLabel });
  }
  return groups;
}

// opts: { cases, onNewTruss(caseType) }
// Ergebnis: { newCases: Case[], additions: [{ caseId, n }], gestapelt } oder null bei Abbruch.
// `newCases` sind über `onNewTruss` bereits gespeicherte, neue Case-Typen (klassischer Zweig) –
// der Aufrufer (load-wizard.js) muss sie nur noch in seine lokale Case-Liste übernehmen.
export function openTrussDialog(dlg, opts = {}) {
  // Gleiche Absicherung wie in case-editor.js: ein noch offener Dialog darf nicht durch
  // `innerHTML = …` unter dem eigenen `close`-Listener weggezogen werden.
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const stock = opts.stock ?? { mode: 'fixed', company: '' };
  const prerigCases = (opts.cases ?? []).filter(c => isTruss(c) && c.truss.standing === true);
  const groups = groupPrerigCases(prerigCases);
  const presetOptionsHtml = [...groups.entries()].map(([label, list]) =>
    `<optgroup label="${esc(label)}">${list.map(o => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('')}</optgroup>`
  ).join('');

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>Traverse hinzufügen</h2>
      <div class="row kind-switch">
        <label><input type="radio" name="kind" value="classic" checked> Klassische Traverse (F34/F40)</label>
        <label><input type="radio" name="kind" value="prerig"> Pre-Rig-Traverse (MLT/S36PR)</label>
      </div>
      <fieldset class="classic-only"><legend>Klassischer Wagen</legend>
        <label>Profil<select name="profile">${TRUSS_PROFILES.map(p => `<option value="${p.width}">${esc(p.name)}</option>`).join('')}</select></label>
        <label>Länge (cm)<input type="number" name="trussLength" min="50" max="1000" step="1" required></label>
        <div class="row quick-lengths">${QUICK_LENGTHS.map(n => `<button type="button" class="quick-len" data-len="${n}">${n}</button>`).join('')}</div>
        <label>Wagenbreite (cm)<input type="number" name="wagonW" min="20" max="200" step="1" required></label>
        <p class="hint">Wagen unterscheiden sich je Firma – die Breite hier an den echten Wagen anpassen.</p>
        <div class="row">
          <label>Gesamtstückzahl<input type="number" name="total" min="1" step="1" required></label>
          <label>Stück pro Wagen<input type="number" name="perWagon" min="1" max="12" step="1" required></label>
        </div>
        <p class="hint wagons-hint"></p>
        ${stockTargetHtml(stock)}
      </fieldset>
      <fieldset class="prerig-only" hidden><legend>Pre-Rig-Traverse</legend>
        ${prerigCases.length
          ? `<label>Modell<select name="preset">${presetOptionsHtml}</select></label>
             <label>Gesamtstückzahl<input type="number" name="prerigTotal" min="1" step="1" required></label>
             <label class="check"><input type="checkbox" name="gestapelt" checked> gestapelt</label>
             <p class="hint">Zwei Einheiten werden beim Packen automatisch übereinandergestellt, wenn das Platz spart.</p>`
          : '<p class="hint">Keine Pre-Rig-Vorlagen verfügbar.</p>'}
      </fieldset>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;
  wireStockTarget(form);
  const kindInputs = [...dlg.querySelectorAll('input[name="kind"]')];
  const classicOnly = dlg.querySelector('.classic-only');
  const prerigOnly = dlg.querySelector('.prerig-only');
  const wagonsHint = dlg.querySelector('.wagons-hint');

  function applyKind(kind) {
    const isPrerig = kind === 'prerig';
    classicOnly.hidden = isPrerig;
    prerigOnly.hidden = !isPrerig;
    f.trussLength.required = !isPrerig; f.total.required = !isPrerig; f.perWagon.required = !isPrerig;
    f.wagonW.required = !isPrerig; f.wagonW.disabled = isPrerig;
    f.trussLength.disabled = isPrerig; f.total.disabled = isPrerig; f.perWagon.disabled = isPrerig; f.profile.disabled = isPrerig;
    if (f.preset) f.preset.disabled = !isPrerig;
    if (f.prerigTotal) { f.prerigTotal.required = isPrerig; f.prerigTotal.disabled = !isPrerig; }
  }
  for (const r of kindInputs) r.addEventListener('change', () => applyKind(r.value));
  applyKind('classic');

  function updateWagonsHint() {
    const total = Number(f.total.value), perWagon = Number(f.perWagon.value);
    try {
      const n = splitWagons(total, perWagon).length;
      wagonsHint.textContent = `→ ${n} Wagen`;
    } catch {
      wagonsHint.textContent = '';
    }
  }
  for (const name of ['total', 'perWagon']) f[name].addEventListener('input', updateWagonsHint);
  // Vorbelegung = bisherige Automatik (2 Stück nebeneinander: bis 60 cm → 60, sonst 80); folgt dem
  // Profil, solange der Nutzer die Breite nicht selbst geändert hat.
  let wagonWTouched = false;
  const autoWagonW = () => (2 * Number(f.profile.value) <= DOLLY_WIDTHS[0] ? DOLLY_WIDTHS[0] : DOLLY_WIDTHS[1]);
  f.wagonW.value = autoWagonW();
  f.wagonW.addEventListener('input', () => { wagonWTouched = true; });
  f.profile.addEventListener('change', () => { if (!wagonWTouched) f.wagonW.value = autoWagonW(); });
  for (const btn of dlg.querySelectorAll('.quick-len')) {
    btn.addEventListener('click', () => { f.trussLength.value = btn.dataset.len; });
  }

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    const kind = kindInputs.find(r => r.checked)?.value ?? 'classic';
    if (kind === 'classic') {
      try {
        splitWagons(Number(f.total.value), Number(f.perWagon.value));
        trussDims({ length: 1, width: Number(f.profile.value), count: 1, wagonW: Number(f.wagonW.value) });
      } catch { e.preventDefault(); }
    } else if (!prerigCases.length) {
      e.preventDefault();
    }
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const kind = kindInputs.find(r => r.checked)?.value ?? 'classic';
      if (kind === 'classic') {
        const width = Number(f.profile.value);
        const profileName = trussProfileName(width);
        const length = Number(f.trussLength.value);
        let wagons;
        try { wagons = splitWagons(Number(f.total.value), Number(f.perWagon.value)); }
        catch { return resolve(null); }
        const distinct = [...new Set(wagons)];
        const target = readStockTarget(form, stock);
        const newCases = [];
        const additions = [];
        for (const n of distinct) {
          const count = wagons.filter(x => x === n).length;
          // Vorhandenen passenden Wagen-Typ nehmen statt einen zweiten anzulegen (findMatchingWagon).
          const wagonW = Number(f.wagonW.value);
          const existing = findMatchingWagon(opts.cases ?? [], { width, length, count: n, wagonW, company: target.company, inStock: target.inStock });
          if (existing) { additions.push({ caseId: existing.id, n: count }); continue; }
          const caseType = applyStockTarget(
            buildWagonCaseType(crypto.randomUUID(), profileName, length, width, n, wagonW),
            target);
          const saved = await opts.onNewTruss?.(caseType);
          if (!saved) continue;
          newCases.push(saved);
          additions.push({ caseId: saved.id, n: count });
        }
        resolve(additions.length ? { newCases, additions, gestapelt: false } : null);
      } else {
        if (!prerigCases.length) return resolve(null);
        const presetId = f.preset.value;
        const n = Number(f.prerigTotal.value);
        if (!presetId || !(n > 0)) return resolve(null);
        resolve({ newCases: [], additions: [{ caseId: presetId, n }], gestapelt: f.gestapelt.checked });
      }
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
