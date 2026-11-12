// Tabellen-Import: übernimmt geprüfte Case-Entwürfe in einen Plan. Die Cases leben nur im Plan
// (`plan.mitgefuehrt.cases`, `herkunft: 'import'`), nie in der Bibliothek. Rein, ohne DOM und Store.

import { MITGEFUEHRT_VERSION } from './mitgefuehrt.js';
import { MAX_MITGEFUEHRT_CASES } from './limits.js';
import { addUnplaced } from './actions.js';
import { stamp } from './stamp.js';
import { t } from '../i18n/i18n.js';

// entwuerfe: { case, menge, tipped }[] aus entwurfAus. Stücke kommen ohne `lkw` in die Ablage
// (bei Mehr-LKW-Plänen = „Ohne LKW“).
export function uebernimmTabelle(plan, entwuerfe, newId) {
  const m = plan.mitgefuehrt;
  const vorhanden = Array.isArray(m?.cases) ? m.cases : [];
  if (vorhanden.length + entwuerfe.length > MAX_MITGEFUEHRT_CASES)
    throw new Error(t('Der Plan würde mehr als {max} Case-Typen enthalten.', { max: MAX_MITGEFUEHRT_CASES }));
  const neu = entwuerfe.map(e => ({ ...e.case, id: newId() }));
  let next = stamp({
    ...plan,
    mitgefuehrt: { ...m, version: m?.version ?? MITGEFUEHRT_VERSION, cases: [...vorhanden, ...neu], trucks: m?.trucks ?? [] },
  });
  entwuerfe.forEach((e, i) => {
    next = addUnplaced(next, neu[i].id, e.menge, newId, { layers: neu[i].layers, tipped: e.tipped });
  });
  return next;
}
