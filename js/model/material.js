import { MAX_FIRM } from './limits.js';
import { t } from '../i18n/i18n.js';

// Materialbestand (docs/superpowers/specs/2026-10-09-materialverwaltung-design.md):
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

// Beim Umbenennen werden Firmen-Vorlagen (`lib-`) zu eigenen Überlagerungen mit gleicher ID
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

// Überlagerung einer mitgelieferten Listen-Vorlage: ein eigener Datensatz (builtin:false) mit der ID
// eines mitgelieferten Eintrags (data/meine.json). Liefert die mitgelieferte Fassung oder undefined.
// `shipped`: die mitgelieferte Liste (CASE_LIBRARY); als Parameter, damit das Modell ohne Daten testbar bleibt.
export const originalOf = (c, shipped) => (c && !c.builtin ? shipped.find(s => s.id === c.id) : undefined);
export const istUeberlagerung = (c, shipped) => !!originalOf(c, shipped);
// Ausgeblendet (gelöscht) ist eine Überlagerung mit `legacy`; sie steht in keiner Sammlung mehr.
export const ausgeblendeteUeberlagerungen = (cases, shipped) => cases.filter(c => c.legacy && istUeberlagerung(c, shipped));

export function firmNameError(name) {
  const n = (name ?? '').trim();
  if (!n) return t('Sammlungsname fehlt.');
  if (n.length > MAX_FIRM) return t('Sammlungsname: höchstens {max} Zeichen.', { max: MAX_FIRM });
  if (/^__.*__$/.test(n)) return t('Dieser Sammlungsname ist reserviert.');
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
