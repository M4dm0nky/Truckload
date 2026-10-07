import { esc } from './dom.js';
import { dollyStackCase } from '../model/audioDolly.js';

// opts: { baseCase, onNewDollyStack(caseType) }
// Ergebnis: { newCase, addition: { caseId, n } } oder null bei Abbruch/ungültiger Eingabe.
// Analog openTrussDialog() (js/ui/truss-wizard.js) – fragt NUR die Stückzahl ab, keine „ohne
// Dolly“-Option (Nutzer-Entscheidung: Line-Array-Tops/Subs stehen in der Praxis immer auf
// einem Dolly) und keine eigene Obergrenze (die bestehende Höhen-/Gewichtsprüfung beim
// Platzieren im Truck greift wie bei jedem anderen Case).
export function openDollyDialog(dlg, opts = {}) {
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const base = opts.baseCase;

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${esc(base.name)} auf Dolly laden</h2>
      <p class="hint">Line-Array-Elemente und Subwoofer stehen immer auf einem Dolly mit
        Schwerlastrollen – wie viele Boxen übereinander?</p>
      <label>Stückzahl auf diesem Dolly<input type="number" name="n" min="1" step="1" value="1" required></label>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    const n = Number(f.n.value);
    if (!(n > 0) || !Number.isInteger(n)) e.preventDefault();
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const n = Number(f.n.value);
      if (!(n > 0) || !Number.isInteger(n)) return resolve(null);
      const caseType = dollyStackCase(base, n);
      const saved = await opts.onNewDollyStack?.(caseType);
      if (!saved) return resolve(null);
      resolve({ newCase: saved, addition: { caseId: saved.id, n: 1 } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
