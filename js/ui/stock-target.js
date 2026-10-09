import { esc } from './dom.js';

// Block „Im Materialbestand ablegen“ (Spec-Nachtrag 2026-10-09) – gemeinsam für Case-Editor,
// Traversen- und Dolly-Dialog. 'choose' = Wizard (Häkchen + Ziel), 'fixed' = Materialseite.
export function stockTargetHtml(stock) {
  if (stock.mode === 'fixed') {
    return `<p class="hint stock-target">${stock.company ? `Firma: ${esc(stock.company)}` : 'Standardliste'}</p>`;
  }
  const opts = stock.companies.map(n =>
    `<option value="${esc(n)}"${n === stock.defaultCompany ? ' selected' : ''}>${esc(n)}</option>`).join('');
  return `<fieldset class="stock-target"><legend>Materialbestand</legend>
      <label class="check"><input type="checkbox" name="inStock" checked> Im Materialbestand ablegen</label>
      <label>Ablegen in<select name="stockCompany"><option value="">Standardliste</option>${opts}</select></label>
      <p class="hint">Ohne Häkchen gilt das Case nur für diesen Load.</p>
    </fieldset>`;
}

export function readStockTarget(form, stock) {
  if (stock.mode === 'fixed') return { inStock: true, company: stock.company ?? '' };
  const f = form.elements;
  return { inStock: f.inStock.checked, company: f.stockCompany.value };
}

export function wireStockTarget(form) {
  const f = form.elements;
  if (!f.inStock) return;
  const sync = () => { f.stockCompany.disabled = !f.inStock.checked; };
  f.inStock.addEventListener('change', sync);
  sync();
}
