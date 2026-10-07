import { esc } from './dom.js';
import { dollyStackCase, dollyStackId, maxDollyCount } from '../model/audioDolly.js';

// opts: { baseCase, cases, onNewDollyStack(caseType) }
// Ergebnis: { newCase, addition: { caseId, n } } oder null bei Abbruch/ungültiger Eingabe.
// Analog openTrussDialog() (js/ui/truss-wizard.js) – fragt NUR die Stückzahl ab, keine „ohne
// Dolly“-Option (Nutzer-Entscheidung: Line-Array-Tops/Subs stehen in der Praxis immer auf
// einem Dolly). Die Stückzahl ist auf maxDollyCount(base) begrenzt (CASE_LIMITS, Befund
// Final-Review Important #3) – keine eigene, engere Grenze darüber hinaus (Nutzer-Entscheidung:
// die bestehende Höhen-/Gewichtsprüfung reicht). Existiert für dieselbe Basisbox+Stückzahl
// bereits ein Case in `opts.cases` (zweiter Dialog-Lauf mit gleicher Eingabe), wird dieser
// unverändert wiederverwendet statt neu gespeichert – sonst würde eine vom Nutzer im
// Case-Editor bearbeitete Zeile beim nächsten Mal stillschweigend wieder auf die Formel-Werte
// zurückgesetzt (Befund Final-Review Important #2).
export function openDollyDialog(dlg, opts = {}) {
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const base = opts.baseCase;
  const maxN = maxDollyCount(base);

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${esc(base.name)} auf Dolly laden</h2>
      <p class="hint">Line-Array-Elemente und Subwoofer stehen immer auf einem Dolly mit
        Schwerlastrollen – wie viele Boxen übereinander?</p>
      <label>Stückzahl auf diesem Dolly<input type="number" name="n" min="1" max="${maxN}" step="1" value="1" required></label>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;

  const validN = () => {
    const n = Number(f.n.value);
    return (n > 0 && Number.isInteger(n) && n <= maxN) ? n : null;
  };

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    if (validN() === null) e.preventDefault();
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const n = validN();
      if (n === null) return resolve(null);
      const id = dollyStackId(base, n);
      const existing = (opts.cases ?? []).find(c => c.id === id);
      if (existing) return resolve({ newCase: existing, addition: { caseId: existing.id, n: 1 } });
      const caseType = dollyStackCase(base, n);
      const saved = await opts.onNewDollyStack?.(caseType);
      if (!saved) return resolve(null);
      resolve({ newCase: saved, addition: { caseId: saved.id, n: 1 } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
