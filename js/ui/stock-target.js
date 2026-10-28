import { esc } from './dom.js';
import { collectionNameError, MEINE_NAME } from '../model/collections.js';
import { MAX_FIRM } from '../model/limits.js';
import { t } from '../i18n/i18n.js';

// Auswahlwert für „+ Neue Sammlung …“ – der Name kommt dann aus dem Feld `stockNewCompany`
// (Nutzer-Feedback 2026-10-09: neue Sammlung direkt beim Ablegen im Wizard, ohne Umweg über die
// Materialverwaltung). Eine Sammlung entsteht, sobald ihr erstes Case gespeichert ist.
const NEW_FIRM = '__new__';
export const resolveStockCompany = (selectValue, newName) =>
  (selectValue === NEW_FIRM ? String(newName ?? '').trim() : selectValue);

// Fehlertext für den Namen einer neuen Sammlung (null = gültig oder nicht im Neu-Modus).
export const newCompanyError = (selectValue, newName, inStock = true, collections = []) =>
  (inStock && selectValue === NEW_FIRM ? collectionNameError(newName, collections) : null);

// Block „Im Materialbestand ablegen“ – gemeinsam für Case-Editor,
// Traversen- und Dolly-Dialog. 'choose' = Wizard (Häkchen + Ziel), 'fixed' = Materialseite.
export function stockTargetHtml(stock) {
  if (stock.mode === 'fixed') {
    return `<p class="hint stock-target">${stock.company ? t('Sammlung: {name}', { name: esc(stock.company) }) : t(MEINE_NAME)}</p>`;
  }
  const opts = stock.companies.map(n =>
    `<option value="${esc(n)}"${n === stock.defaultCompany ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<fieldset class="stock-target"><legend>${t('Materialbestand')}</legend>
      <label class="check"><input type="checkbox" name="inStock" checked> ${t('Im Materialbestand ablegen')}</label>
      <label>${t('Ablegen in')}<select name="stockCompany"><option value="">${t(MEINE_NAME)}</option>${opts}<option value="${NEW_FIRM}">${t('+ Neue Sammlung …')}</option></select></label>
      <label class="stock-new" hidden>${t('Name der neuen Sammlung')}<input name="stockNewCompany" maxlength="${MAX_FIRM}"></label>
      <p class="hint">${t('Ohne Häkchen gilt das Case nur für diesen Load.')}</p>
    </fieldset>`;
}

export function readStockTarget(form, stock) {
  if (stock.mode === 'fixed') return { inStock: true, company: stock.company ?? '' };
  const f = form.elements;
  return { inStock: f.inStock.checked, company: resolveStockCompany(f.stockCompany.value, f.stockNewCompany?.value) };
}

// `collections`: vorhandene Sammlungen, gegen die der Name einer neuen geprüft wird.
export function wireStockTarget(form, collections = []) {
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
    f.stockNewCompany.setCustomValidity(newCompanyError(f.stockCompany.value, f.stockNewCompany.value, f.inStock.checked, collections) ?? '');
    if (isNew && focus) f.stockNewCompany.focus();
  };
  f.stockNewCompany?.addEventListener('input', () => sync());
  f.inStock.addEventListener('change', () => sync());
  f.stockCompany.addEventListener('change', () => sync(true));
  sync();
}
