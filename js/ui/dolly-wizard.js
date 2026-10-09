import { esc } from './dom.js';
import { stockTargetHtml, readStockTarget, wireStockTarget } from './stock-target.js';
import { dollyStackCase, maxDollyCount, dollyDepth } from '../model/audioDolly.js';

// opts: { baseCase, onNewDollyStack(caseType) }
// Ergebnis: { newCase, addition: { caseId, n } } oder null bei Abbruch/ungültiger Eingabe.
// Analog openTrussDialog() (js/ui/truss-wizard.js) – fragt NUR die Stückzahl ab, keine „ohne
// Dolly“-Option (Nutzer-Entscheidung: Line-Array-Tops/Subs stehen in der Praxis immer auf
// einem Dolly). Die Stückzahl ist auf maxDollyCount(base) begrenzt (CASE_LIMITS (js/model/limits.js), Befund
// Final-Review Important #3) – keine eigene, engere Grenze darüber hinaus (Nutzer-Entscheidung:
// die bestehende Höhen-/Gewichtsprüfung reicht).
//
// Ruling 2026-10-08 (ersetzt Befund Final-Review Important #2): existiert für dieselbe Basis-
// box+Stückzahl schon ein Case, wird er trotzdem NEU berechnet und überschrieben, nicht mehr
// unverändert wiederverwendet. Die frühere „nicht überschreiben“-Regel sollte eine vom Nutzer
// im Case-Editor bearbeitete Zeile schützen – hat in der Praxis aber verhindert, dass bereits
// erzeugte Dolly-Stacks jemals neue Felder/Optik aus einer späteren Version bekommen (Nutzer
// hatte dadurch nach der 3D-Lautsprecher-Überarbeitung weiter die alte Flightcase-Darstellung
// auf einem schon vorher angelegten „K2 2er“). Das betrifft praktisch nur automatisch erzeugte,
// nie von Hand bearbeitete Zeilen – genau wie die mitgelieferten Basis-Vorlagen (preset-k2 &
// Co.) schon immer bei jedem Release aktualisiert werden, ohne eine Schutzregel dafür.

// Prüft eine rohe Formular-Eingabe gegen 1..maxN – ausgelagert aus openDollyDialog() (Befund
// Final-Review Minor #8), damit eine ungültige Stückzahl (0, negativ, leer, nicht-numerisch,
// über maxN) ohne DOM unabhängig getestet werden kann, statt nur implizit über eine einzelne
// Browser-Probe mit einer gültigen Zahl.
export function parseDollyCount(raw, maxN) {
  const n = Number(raw);
  return (n > 0 && Number.isInteger(n) && n <= maxN) ? n : null;
}

// Reiner Baustein: Bestand → Stack mit Firmen-ID; „nur Load“ → eigene UUID, onlyInPlan, keine
// Firma, damit er keinen Bestands-Stack gleicher ID verdeckt oder überschreibt.
export function buildDollyResult(base, n, wagen, target, uuid) {
  if (target.inStock) return dollyStackCase(base, n, wagen, target.company);
  return { ...dollyStackCase(base, n, wagen), id: uuid, company: undefined, onlyInPlan: true };
}

export function openDollyDialog(dlg, opts = {}) {
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const base = opts.baseCase;
  const maxN = maxDollyCount(base);
  const stock = opts.stock ?? { mode: 'fixed', company: '' };

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${esc(base.name)} auf Dolly laden</h2>
      <p class="hint">Line-Array-Elemente und Subwoofer stehen immer auf einem Dolly mit
        Schwerlastrollen – wie viele Boxen übereinander?</p>
      <label>Stückzahl auf diesem Dolly<input type="number" name="n" min="1" max="${maxN}" step="1" value="1" required></label>
      <div class="row">
        <label>Wagen Breite (cm)<input type="number" name="wl" min="20" max="400" step="1" value="${base.l}" required></label>
        <label>Wagen Tiefe (cm)<input type="number" name="ww" min="20" max="250" step="1" value="${dollyDepth(base.w)}" required></label>
      </div>
      <p class="hint wagen-hint"></p>
      ${stockTargetHtml(stock)}
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;
  wireStockTarget(form);

  const validN = () => parseDollyCount(f.n.value, maxN);
  const wagenHint = dlg.querySelector('.wagen-hint');
  // Wagengröße ist firmenabhängig – hier anzeigen und änderbar halten; die Höhe ist fest.
  const wagen = () => ({ l: Number(f.wl.value), w: Number(f.ww.value) });
  const wagenValid = () => { const g = wagen(); return g.l >= 20 && g.w >= 20; };
  const updateWagenHint = () => {
    wagenHint.textContent = wagenValid() ? `Wagen: ${wagen().l} × ${wagen().w} cm (B × T)` : '';
  };
  for (const name of ['wl', 'ww']) f[name].addEventListener('input', updateWagenHint);
  updateWagenHint();

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    if (validN() === null || !wagenValid()) e.preventDefault();
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const n = validN();
      if (n === null || !wagenValid()) return resolve(null);
      const caseType = buildDollyResult(base, n, wagen(), readStockTarget(form, stock), crypto.randomUUID());
      const saved = await opts.onNewDollyStack?.(caseType);
      if (!saved) return resolve(null);
      resolve({ newCase: saved, addition: { caseId: saved.id, n: 1 } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
