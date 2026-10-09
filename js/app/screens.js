// Bildschirmwahl: welcher der drei Bildschirme (Start, Plan, Material) gerade sichtbar ist.
// Kein Import von js/app.js (sonst Zyklus); die Verdrahtung (Klick-Handler) kommt als Parameter.
import { esc } from '../ui/dom.js';
import { APP_VERSION } from '../version.js';

// Reine Wahl aus dem Store-Zustand: Material hat Vorrang, ohne Plan ist Start.
export const screenOf = s => (s.materialOpen ? 'material' : s.plan ? 'plan' : 'start');

// Welche Elemente (Schlüssel von `els`) zu welchem Bildschirm gehören. Alle anderen werden ausgeblendet.
export const SCREEN_PARTS = {
  start: ['start'],
  plan: ['header', 'layout'],
  material: ['material'],
};

// `els`: { start, header, layout, material } – die DOM-Elemente der Bildschirme.
export function showScreen(name, els) {
  const shown = new Set(SCREEN_PARTS[name]);
  for (const [key, el] of Object.entries(els)) el.hidden = !shown.has(key);
}

// Startbildschirm: kein Plan gewählt. Eigener, viel einfacherer Render-Pfad statt der vollen
// Pipeline in app.js. `handlers`: { onMaterial, onNew, onImport, onPlan(planId) }.
export function renderStartScreen(el, s, handlers) {
  const plans = [...s.plans].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const listHtml = plans.length
    ? `<ul class="start-plans">${plans.map(p => `
        <li><button class="start-plan-item" type="button" data-plan-id="${esc(p.id)}">${esc(p.name)}</button></li>
      `).join('')}</ul>`
    : `<p class="start-hint">Noch keine gespeicherten Ladepläne.</p>`;
  el.querySelector('#start-actions').innerHTML = `
    <div class="start-main">
      <button id="start-new" class="primary" type="button">Neuen Load erstellen</button>
      <button id="start-material" class="primary" type="button" title="Materialverwaltung: Firmen, Cases, Lautsprecher, Traversen">Material</button>
    </div>
    ${listHtml}
    <button id="start-import" type="button" title="JSON-Sicherung einlesen">Sicherung importieren</button>
    <p class="start-version">V ${esc(APP_VERSION)}</p>
  `;
  el.querySelector('#start-material').onclick = handlers.onMaterial;
  el.querySelector('#start-new').onclick = handlers.onNew;
  el.querySelector('#start-import').onclick = handlers.onImport;
  for (const btn of el.querySelectorAll('.start-plan-item')) {
    btn.onclick = () => handlers.onPlan(btn.dataset.planId);
  }
}
