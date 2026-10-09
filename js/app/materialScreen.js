// Materialverwaltung als eigener Bildschirm: Öffnen/Schließen über den Store (materialOpen),
// Verdrahtung der Case-Aktionen und die Case-Editor-Wege, die auch Plan und Lade-Wizard nutzen.
// Kein Import von js/app.js; Store und Speicherpfade kommen als Parameter.
import { mountMaterial } from '../ui/material.js';
import { openCaseEditor } from '../ui/case-editor.js';
import { openTrussDialog } from '../ui/truss-wizard.js';
import { openDollyDialog } from '../ui/dolly-wizard.js';
import { showAlert, showPick } from '../ui/confirmDialog.js';
import { companyList, isInStock, copyToCompany, applyStockTarget } from '../model/material.js';
import { usage } from './core.js';

const $ = sel => document.querySelector(sel);

async function pickCase(title, cases) {
  if (!cases.length) { await showAlert('Keine passende Box vorhanden.'); return null; }
  const id = await showPick(title, cases.map(c => ({ value: c.id, label: c.name + (c.company ? ` – ${c.company}` : '') })));
  return id == null ? null : cases.find(c => c.id === id);
}

// deps: el (der Bildschirm), store, uid, persistence.
// Liefert { material, openMaterial, openMaterialFromWizard, editCase, newCaseForWizard }.
export function mountMaterialScreen({ el, store, uid, persistence }) {
  const saveCase = persistence.saveCase;
  // Aus dem Lade-Wizard geöffnet: „Zurück“ gibt die frische Case-Liste an den Wizard zurück.
  let materialReturn = null;

  function openMaterial() {
    store.update(s => ({ ...s, materialOpen: true, selectedId: s.plan ? null : s.selectedId }));
  }
  function openMaterialFromWizard() {
    return new Promise(resolve => { materialReturn = resolve; openMaterial(); });
  }

  // Zielfirma: '' = Standardliste (Wert ''), sonst Firmenname; null = abgebrochen.
  const pickFirm = () => showPick('In welche Firma?', [{ value: '', label: 'Standardliste' }, ...companyList(store.get().cases).map(f => ({ value: f.name, label: f.name }))]);

  const material = mountMaterial(el, {
    onBack: () => {
      store.update(s => ({ ...s, materialOpen: false }));
      if (materialReturn) { const back = materialReturn; materialReturn = null; back(store.get().cases); }
    },
    onNewCase: async company => {
      const res = await openCaseEditor($('#dlg-case'), null, { stock: { mode: 'fixed', company } });
      if (res?.action === 'save') await saveCase(res.value);
    },
    onEdit: async id => {
      const s = store.get();
      const c = s.cases.find(x => x.id === id);
      if (!c) return;
      const res = await openCaseEditor($('#dlg-case'), c, {
        usedIn: usage(s, id), allowDelete: true, overrideBuiltin: c.builtin,
        stock: c.onlyInPlan ? undefined : { mode: 'fixed', company: c.company ?? '' },
      });
      if (!res) return;
      if (res.action === 'delete') return persistence.removeFromStock(c, { confirmed: true });
      await saveCase(res.value);
    },
    onDelete: id => persistence.removeFromStock(store.get().cases.find(x => x.id === id)),
    onNewTruss: company => openTrussDialog($('#dlg-truss'), { cases: store.get().cases, onNewTruss: saveCase, stock: { mode: 'fixed', company } }),
    onNewDolly: async company => {
      const base = await pickCase('Welche Box kommt auf den Dolly?', store.get().cases.filter(c => c.dollyPrompt && isInStock(c)));
      if (base) await openDollyDialog($('#dlg-dolly'), { baseCase: base, onNewDollyStack: saveCase, stock: { mode: 'fixed', company } });
    },
    onCopy: async id => {
      const firm = await pickFirm();
      if (firm != null) await saveCase(copyToCompany(store.get().cases.find(c => c.id === id), firm, uid()));
    },
    onAdopt: async id => {
      const firm = await pickFirm();
      if (firm != null) await saveCase(applyStockTarget(store.get().cases.find(c => c.id === id), { inStock: true, company: firm }));
    },
    onRename: persistence.renameCompany,
    onDeleteCompany: persistence.deleteCompany,
  });

  // Case aus Bibliothek oder Inspector bearbeiten (caseId null: neues Case).
  async function editCase(caseId) {
    const s = store.get();
    const c = caseId ? s.cases.find(x => x.id === caseId) : null;
    const res = await openCaseEditor($('#dlg-case'), c, { usedIn: caseId ? usage(s, caseId) : 0 });
    if (!res) return;
    await saveCase(res.value);
  }

  // Für den Load-Wizard: legt ein neues Case über den Case-Editor an (optional mit Vorbelegung,
  // z. B. für den „Sonderbau“-Schnellentwurf) und liefert es zurück, ohne den Wizard zu schließen.
  async function newCaseForWizard(draft, stock) {
    const res = await openCaseEditor($('#dlg-case'), null, { draft, stock });
    return res?.action === 'save' ? saveCase(res.value) : null;
  }

  $('#material-open').onclick = openMaterial;

  return { material, openMaterial, openMaterialFromWizard, editCase, newCaseForWizard };
}
