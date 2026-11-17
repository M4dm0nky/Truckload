// Bildschirmwahl: welcher der drei Bildschirme (Start, Plan, Material) gerade sichtbar ist.
// Kein Import von js/app.js (sonst Zyklus); die Verdrahtung (Klick-Handler) kommt als Parameter.
import { esc } from '../ui/dom.js';
import { APP_VERSION } from '../version.js';
import { vorlageDatei } from '../ui/tabellen-import.js';
import { t } from '../i18n/i18n.js';

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
// Pipeline in app.js. `handlers`: { onMaterial, onNew, onImport, onTabelle, onTabelleHilfe, onPlan(planId), onGeraete? (nur in NYX mit Projektgeräten) }.
export function renderStartScreen(el, s, handlers) {
  const plans = [...s.plans].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const listHtml = plans.length
    ? `<ul class="start-plans">${plans.map(p => `
        <li><button class="start-plan-item" type="button" data-plan-id="${esc(p.id)}">${esc(p.name)}</button></li>
      `).join('')}</ul>`
    : `<p class="start-hint">${t('Noch keine gespeicherten Ladepläne.')}</p>`;
  el.querySelector('#start-actions').innerHTML = `
    <div class="start-main">
      <button id="start-new" class="primary" type="button">${t('Neuen Load erstellen')}</button>
      <button id="start-material" class="primary" type="button" title="${t('Materialverwaltung: Sammlungen, Cases, Lautsprecher, Traversen')}">${t('Material')}</button>
    </div>
    ${listHtml}
    <button id="start-import" type="button" title="${t('JSON-Sicherung einlesen')}">${t('Sicherung importieren')}</button>
    <div class="start-tabelle">
      <button id="start-tabelle" type="button" title="${t('Ladeliste aus Excel oder CSV einlesen')}">${t('Tabelle importieren')}</button>
      ${handlers.onGeraete ? `<button id="start-geraete" type="button" title="${t('Projektgeräte aus NYX in Cases übernehmen')}">${t('Aus Projektdatenbank übernehmen')}</button>` : ''}
      <button id="start-tabelle-hilfe" type="button" title="${t('Hilfe zum Tabellen-Import')}" aria-label="${t('Hilfe zum Tabellen-Import')}">?</button>
      <a id="start-template" class="btn" href="${vorlageDatei()}" download>${t('Vorlage herunterladen')}</a>
    </div>
    <p class="start-version">V ${esc(APP_VERSION)}</p>
  `;
  el.querySelector('#start-material').onclick = handlers.onMaterial;
  el.querySelector('#start-new').onclick = handlers.onNew;
  el.querySelector('#start-import').onclick = handlers.onImport;
  el.querySelector('#start-tabelle').onclick = handlers.onTabelle;
  if (handlers.onGeraete) el.querySelector('#start-geraete').onclick = handlers.onGeraete;
  el.querySelector('#start-tabelle-hilfe').onclick = handlers.onTabelleHilfe;
  for (const btn of el.querySelectorAll('.start-plan-item')) {
    btn.onclick = () => handlers.onPlan(btn.dataset.planId);
  }
}
