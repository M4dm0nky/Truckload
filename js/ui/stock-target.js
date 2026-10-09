import { esc } from './dom.js';
import { firmNameError } from '../model/material.js';
import { MAX_FIRM } from '../model/limits.js';

// Auswahlwert für „+ Neue Firma …“ – der Name kommt dann aus dem Feld `stockNewCompany`
// (Nutzer-Feedback 2026-10-09: neue Firma direkt beim Ablegen im Wizard, ohne Umweg über die
// Materialverwaltung). Eine Firma entsteht, sobald ihr erstes Case gespeichert ist.
const NEW_FIRM = '__new__';
export const resolveStockCompany = (selectValue, newName) =>
  (selectValue === NEW_FIRM ? String(newName ?? '').trim() : selectValue);

// Fehlertext für den Namen einer neuen Firma (null = gültig oder nicht im Neu-Modus).
export const newCompanyError = (selectValue, newName, inStock = true) =>
  (inStock && selectValue === NEW_FIRM ? firmNameError(newName) : null);

// Block „Im Materialbestand ablegen“ – gemeinsam für Case-Editor,
// Traversen- und Dolly-Dialog. 'choose' = Wizard (Häkchen + Ziel), 'fixed' = Materialseite.
export function stockTargetHtml(stock) {
  if (stock.mode === 'fixed') {
    return `<p class="hint stock-target">${stock.company ? `Firma: ${esc(stock.company)}` : 'Standardliste'}</p>`;
  }
  const opts = stock.companies.map(n =>
    `<option value="${esc(n)}"${n === stock.defaultCompany ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<fieldset class="stock-target"><legend>Materialbestand</legend>
      <label class="check"><input type="checkbox" name="inStock" checked> Im Materialbestand ablegen</label>
      <label>Ablegen in<select name="stockCompany"><option value="">Standardliste</option>${opts}<option value="${NEW_FIRM}">+ Neue Firma …</option></select></label>
      <label class="stock-new" hidden>Name der neuen Firma<input name="stockNewCompany" maxlength="${MAX_FIRM}"></label>
      <p class="hint">Ohne Häkchen gilt das Case nur für diesen Load.</p>
    </fieldset>`;
}

export function readStockTarget(form, stock) {
  if (stock.mode === 'fixed') return { inStock: true, company: stock.company ?? '' };
  const f = form.elements;
  return { inStock: f.inStock.checked, company: resolveStockCompany(f.stockCompany.value, f.stockNewCompany?.value) };
}

export function wireStockTarget(form) {
  const f = form.elements;
  if (!f.inStock) return;
  const newLabel = f.stockNewCompany?.closest('label');
  const sync = (focus = false) => {
    f.stockCompany.disabled = !f.inStock.checked;
    if (!newLabel) return;
    const isNew = f.inStock.checked && f.stockCompany.value === NEW_FIRM;
    newLabel.hidden = !isNew;
    f.stockNewCompany.disabled = !isNew;
    f.stockNewCompany.required = isNew; // Formularprüfung blockiert Speichern ohne Namen
    f.stockNewCompany.setCustomValidity(newCompanyError(f.stockCompany.value, f.stockNewCompany.value, f.inStock.checked) ?? '');
    if (isNew && focus) f.stockNewCompany.focus();
  };
  f.stockNewCompany?.addEventListener('input', () => sync());
  f.inStock.addEventListener('change', () => sync());
  f.stockCompany.addEventListener('change', () => sync(true));
  sync();
}
