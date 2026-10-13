// Materialverwaltung als eigener Bildschirm: Öffnen/Schließen über den Store (materialOpen),
// Verdrahtung der Case-Aktionen und die Case-Editor-Wege, die auch Plan und Lade-Wizard nutzen.
// Kein Import von js/app.js; Store und Speicherpfade kommen als Parameter.
import { mountMaterial } from '../ui/material.js';
import { openCaseEditor } from '../ui/case-editor.js';
import { openTrussDialog } from '../ui/truss-wizard.js';
import { openDollyDialog } from '../ui/dolly-wizard.js';
import { showAlert, showPick } from '../ui/confirmDialog.js';
import { isInStock, copyToCompany, applyStockTarget } from '../model/material.js';
import { userCollectionNames, collectionIdOf, MEINE_ID, STANDARD_ID } from '../model/collections.js';
import { parseCollectionFile, exportCollectionFile, collectionFileName } from '../store/io.js';
import { downloadJSON } from './download.js';
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

  // Name der Sammlung zu einer ID: '' für „Meine Sammlung“ und „Standard“ (kein Firmenname am Case).
  const nameOf = id => {
    const c = store.get().collections.find(x => x.id === id);
    return c && c.id !== MEINE_ID && c.id !== STANDARD_ID ? c.name : '';
  };
  // Zielsammlung für „Kopieren“/„In Bestand übernehmen“: Wert = Name ('' = Meine Sammlung); null = abgebrochen.
  const pickCollection = () => showPick('In welche Sammlung?', [
    { value: '', label: 'Meine Sammlung' },
    ...userCollectionNames(store.get().collections).map(n => ({ value: n, label: n })),
  ]);

  const material = mountMaterial(el, {
    onBack: () => {
      store.update(s => ({ ...s, materialOpen: false }));
      if (materialReturn) { const back = materialReturn; materialReturn = null; back(store.get().cases); }
    },
    onNewCase: async collectionId => {
      const res = await openCaseEditor($('#dlg-case'), null, { stock: { mode: 'fixed', company: nameOf(collectionId) } });
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
    onNewTruss: async collectionId => {
      const res = await openTrussDialog($('#dlg-truss'), { cases: store.get().cases, onNewTruss: saveCase, stock: { mode: 'fixed', company: nameOf(collectionId) } });
      // Gibt es den Wagen in dieser Sammlung schon, legt der Dialog nichts an – das nicht stumm lassen.
      const created = new Set((res?.newCases ?? []).map(c => c.id));
      for (const a of res?.additions ?? []) {
        const existing = created.has(a.caseId) ? null : store.get().cases.find(c => c.id === a.caseId);
        if (existing) await showAlert(`Diesen Traversenwagen gibt es in dieser Sammlung schon: ${existing.name}.`);
      }
      return res;
    },
    onNewDolly: async collectionId => {
      const base = await pickCase('Welche Box kommt auf den Dolly?', store.get().cases.filter(c => c.dollyPrompt && isInStock(c)));
      if (base) await openDollyDialog($('#dlg-dolly'), { baseCase: base, existingCases: store.get().cases, onNewDollyStack: saveCase, stock: { mode: 'fixed', company: nameOf(collectionId) } });
    },
    onCopy: async id => {
      const firm = await pickCollection();
      if (firm != null) await saveCase(copyToCompany(store.get().cases.find(c => c.id === id), firm, uid()));
    },
    onAdopt: async id => {
      const firm = await pickCollection();
      if (firm != null) await saveCase(applyStockTarget(store.get().cases.find(c => c.id === id), { inStock: true, company: firm }));
    },
    onCreateCollection: persistence.createCollection,
    onRenameCollection: persistence.renameCollection,
    onMoveCollection: persistence.moveCollection,
    onDeleteCollection: persistence.deleteCollection,
    onMoveCase: persistence.moveCaseTo,
    onExportCollection: id => {
      const st = store.get();
      const meta = st.collections.find(c => c.id === id);
      if (!meta) return;
      const cases = st.cases.filter(c => collectionIdOf(c) === id);
      downloadJSON(collectionFileName(meta.name), exportCollectionFile(meta, cases));
    },
    // Bricht der Nutzer den Dateidialog ab, feuert kein `change`; die Promise bleibt offen, der
    // Aufrufer blockiert dadurch nichts.
    onImportCollection: () => new Promise(resolve => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/json,.json' });
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return resolve(null);
        try {
          resolve(await persistence.importCollectionFile(parseCollectionFile(await file.text())));
        } catch (err) {
          await showAlert(`Import fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`);
          resolve(null);
        }
      };
      input.click();
    }),
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
