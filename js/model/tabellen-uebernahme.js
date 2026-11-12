// Tabellen-Import: übernimmt geprüfte Case-Entwürfe in einen Plan. Die Cases leben nur im Plan
// (`plan.mitgefuehrt.cases`, `herkunft: 'import'`), nie in der Bibliothek. Rein, ohne DOM und Store.

import { MITGEFUEHRT_VERSION } from './mitgefuehrt.js';
import { MAX_MITGEFUEHRT_CASES } from './limits.js';
import { addUnplaced } from './actions.js';
import { stamp } from './stamp.js';
import { t } from '../i18n/i18n.js';

// Macht aus einem im Wizard gebauten Case einen Import-Case (nur im Plan, nie in der Bibliothek).
// Die ID bleibt, damit Stücke ihn weiter finden.
export function alsImportCase(c) {
  const { onlyInPlan, company, collectionId, legacy, ...rest } = c;
  return { ...rest, herkunft: 'import' };
}

// entwuerfe: { case, menge, tipped }[] aus entwurfAus. Stücke kommen ohne `lkw` in die Ablage
// (bei Mehr-LKW-Plänen = „Ohne LKW“).
// gebaut: { cases, stuecke } – fertige Import-Cases (IDs bleiben) und Stücke { caseId, n }; caseId
// aus gebaut.cases oder eine Bibliotheks-ID (Pre-Rig-Vorlage, wird nur referenziert).
export function uebernimmTabelle(plan, entwuerfe, newId, gebaut = { cases: [], stuecke: [] }) {
  const m = plan.mitgefuehrt;
  const vorhanden = Array.isArray(m?.cases) ? m.cases : [];
  const gebauteCases = gebaut.cases ?? [];
  if (vorhanden.length + entwuerfe.length + gebauteCases.length > MAX_MITGEFUEHRT_CASES)
    throw new Error(t('Der Plan würde mehr als {max} Case-Typen enthalten.', { max: MAX_MITGEFUEHRT_CASES }));
  const neu = entwuerfe.map(e => ({ ...e.case, id: newId() }));
  let next = stamp({
    ...plan,
    mitgefuehrt: { ...m, version: m?.version ?? MITGEFUEHRT_VERSION, cases: [...vorhanden, ...neu, ...gebauteCases], trucks: m?.trucks ?? [] },
  });
  entwuerfe.forEach((e, i) => {
    next = addUnplaced(next, neu[i].id, e.menge, newId, { layers: neu[i].layers, tipped: e.tipped });
  });
  const layersVon = new Map(gebauteCases.map(c => [c.id, c.layers]));
  for (const s of gebaut.stuecke ?? []) {
    const layers = layersVon.get(s.caseId);
    next = addUnplaced(next, s.caseId, s.n, newId, layers ? { layers } : {});
  }
  return next;
}
