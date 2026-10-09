import { MAX_FIRM } from './limits.js';

// Materialbestand (V 0.12.5, docs/superpowers/specs/2026-10-09-materialverwaltung-design.md):
// Firma = `company`-String am Case, keine eigene Tabelle. Reine Funktionen, kein DOM, kein Store.
// `legacy` = ausgeblendet (gelöschte Firmen-Vorlage, alte Ladepläne behalten das Stück),
// `onlyInPlan` = im Wizard ohne „Im Materialbestand ablegen“ angelegt, gilt nur für den Load.
export const isInStock = c => !c.legacy && !c.onlyInPlan;

export function companyList(cases, extra = []) {
  const counts = new Map(extra.map(n => [n, 0]));
  for (const c of cases) if (isInStock(c) && c.company) counts.set(c.company, (counts.get(c.company) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export const casesOf = (cases, company) =>
  cases.filter(c => isInStock(c) && (company ? c.company === company : !c.company));

export const onlyInPlanCases = cases => cases.filter(c => c.onlyInPlan && !c.legacy);

// Firmen-Vorlagen (`lib-`) werden dabei zu eigenen Überlagerungen mit gleicher ID
// (mergeOwnWithBuiltins, js/store/repo.js) – Pläne verweisen weiter per caseId.
export const renameCompany = (cases, from, to) =>
  cases.filter(c => c.company === from).map(c => ({ ...c, builtin: false, company: to }));

// Standardvorlagen (`preset-`) sind nur lesbar; Firmen-Vorlagen (`lib-`) werden ausgeblendet statt
// entfernt – auch schon überlagerte (builtin:false, bearbeitet oder Firma umbenannt), sonst käme
// die mitgelieferte Version beim nächsten Start über mergeOwnWithBuiltins zurück.
export function deletionFor(c) {
  if (c.id.startsWith('lib-')) return { save: { ...c, builtin: false, legacy: true } };
  if (!c.builtin) return { remove: c.id };
  return null;
}

export function firmNameError(name) {
  const n = (name ?? '').trim();
  if (!n) return 'Firmenname fehlt.';
  if (n.length > MAX_FIRM) return `Firmenname: höchstens ${MAX_FIRM} Zeichen.`;
  if (/^__.*__$/.test(n)) return 'Dieser Firmenname ist reserviert.';
  return null;
}

export const copyToCompany = (c, company, id) => ({
  ...c, id, builtin: false, company: company || undefined,
  source: undefined, note: undefined, legacy: undefined, onlyInPlan: undefined,
});

export const applyStockTarget = (c, { inStock, company }) => ({
  ...c,
  company: inStock && company ? company : undefined,
  onlyInPlan: inStock ? undefined : true,
});
