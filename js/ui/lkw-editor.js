// Dialog „LKW anlegen / bearbeiten“: Name, Fahrzeug, Gewerke-Haken, Löschen mit Rückfrage.
// Gleiches Muster wie openTruckEditor (<dialog> mit <form method="dialog">, Auflösung im close-Ereignis).
import { esc } from './dom.js';
import { showAlert, showConfirm } from './confirmDialog.js';
import { NAME_MAX } from '../model/limits.js';
import { CATEGORIES } from '../data/categories.js';

export const CATEGORY_HINT = 'Kein Haken = Rest-LKW (nimmt alles, was sonst keiner annimmt)';
export const LAST_LKW_MESSAGE = 'Der letzte LKW lässt sich nicht löschen – ein Plan mit mehreren LKW braucht mindestens einen. „Truck entladen“ räumt ihn stattdessen leer.';

// Rückfrage vor dem Löschen: nennt, was mit den Stücken passiert (sie werden keinem LKW zugeordnet).
export const deleteQuestion = (name, pieces) =>
  `LKW „${name}“ löschen?${pieces ? ` Seine ${pieces} Stücke werden keinem LKW mehr zugeordnet (Platzierungen wandern nach „Noch nicht geladen“).` : ''}`;

// Sortierung wie in der Kopfleiste: Vorlagen vorn, eigene danach alphabetisch.
const sortTrucks = trucks => [...trucks].sort((a, b) =>
  a.builtin === b.builtin ? a.name.localeCompare(b.name, 'de') : a.builtin ? -1 : 1);

// lkw: null = neuer LKW. opts: { trucks, defaultTruckId, isLast, pieces }.
// Ergebnis: { action: 'save', value: { name, truckId, categories } } | { action: 'delete' } | null.
export async function openLkwEditor(dlg, lkw, { trucks, defaultTruckId, isLast = false, pieces = 0 }) {
  if (dlg.open) {
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const isNew = !lkw;
  const truckId = lkw?.truckId ?? defaultTruckId;
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neuer LKW' : 'LKW bearbeiten'}</h2>
      <label>Name<input name="name" required maxlength="${NAME_MAX}" placeholder="z. B. LKW Ton"></label>
      <label>Fahrzeug<select name="truck">${sortTrucks(trucks).map(t =>
        `<option value="${esc(t.id)}" ${t.id === truckId ? 'selected' : ''}>${esc(t.name)}${t.builtin ? '' : ' ★'} – ${t.l}×${t.w}×${t.h}</option>`).join('')}</select></label>
      <fieldset class="lkw-cats"><legend>Gewerke</legend>
        <div class="lkw-cat-list">${CATEGORIES.map(c =>
          `<label class="check"><input type="checkbox" name="cat" value="${esc(c.name)}" ${lkw?.categories?.includes(c.name) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
        <p class="hint">${esc(CATEGORY_HINT)}</p>
      </fieldset>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = lkw?.name ?? '';
  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') {
        if (isLast) { showAlert(LAST_LKW_MESSAGE).then(() => resolve(null)); return; }
        showConfirm(deleteQuestion(lkw.name, pieces), { okLabel: 'Löschen', danger: true })
          .then(ok => resolve(ok ? { action: 'delete' } : null));
        return;
      }
      if (act !== 'save') return resolve(null);
      resolve({ action: 'save', value: {
        name: f.name.value.trim(),
        truckId: f.truck.value,
        categories: [...dlg.querySelectorAll('input[name="cat"]:checked')].map(i => i.value),
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
