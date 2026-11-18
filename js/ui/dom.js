import { t, num } from '../i18n/i18n.js';
import { SYMBOLS } from './symbols.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ESC[ch]);

const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.appendChild(el);
  return el;
}

// Bildschirm- in viewBox-Koordinaten eines SVG (über getScreenCTM, folgt also dem Zoom).
export const toSvg = (svg, x, y) => new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
// Id des Cases unter dem Zeiger, null auf freier Fläche.
export const caseIdAt = e => e.target.closest('g.case')?.dataset.id ?? null;

// Zwei Nachkommastellen: gerundet wird wie bisher mit toFixed (Binärwert), nur das Zahlenformat folgt der Sprache.
export const fmt2 = v => num(Number(v.toFixed(2)), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
export const fmtM = cm => `${fmt2(cm / 100)} m`;

// Farbkästchen vor einem Case-/Stück-Namen. esc() schützt nicht innerhalb von style="…": Die Farbe
// kommt heute aus einem Farbwähler oder einer geprüften Datei (COLOR_RE in js/store/io.js), aber
// swatch() erzwingt das Muster selbst, statt es von künftigen Aufrufern zu verlangen – ein Wert
// außerhalb von `#RRGGBB`/`#RGB` (leer, Altdaten, fremde Quelle) fällt auf Grau zurück.
const SWATCH_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
// Gibt `c` nur zurück, wenn es #RGB/#RRGGBB ist, sonst Grau – für jede Farbe, die in ein
// style-Attribut oder SVG-Attribut wandert (esc() schützt dort nicht).
export const safeColor = c => (SWATCH_COLOR_RE.test(c) ? c : '#888');
export const swatch = color => `<span class="swatch" style="background:${safeColor(color)}"></span>`;

// Lucide-Symbol (Quelle und Version: js/ui/symbols.js). Folgt über currentColor der Textfarbe und ist für
// Screenreader stumm – den Namen trägt der umgebende Knopf (aria-label). Unbekannter Name = Tippfehler: wirft.
export function symbol(name) {
  if (!Object.hasOwn(SYMBOLS, name)) throw new Error(`Unknown symbol: ${name}`);
  return `<svg class="symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SYMBOLS[name]}</svg>`;
}

// Popup-Kopf: Titel links, × rechts. Das × tut nur, was das Abbrechen des Popups tut: ohne `act` schließt es
// das Formular (value="cancel"), mit `act` löst es data-act aus. `titelHtml` ist fertiges HTML (esc() Sache des Aufrufers).
export function dialogKopf(titelHtml, { act } = {}) {
  const x = act
    ? `type="button" data-act="${esc(act)}"`
    : 'type="submit" value="cancel" formnovalidate';
  return `<header class="dialog-head"><h2>${titelHtml}</h2><button ${x} class="quiet dialog-x" aria-label="${t('Schließen')}" title="${t('Schließen')}">${symbol('x')}</button></header>`;
}

// Getter statt fester Texte: die Sprache steht erst beim Zugriff fest (Tests schalten sie um).
export const ORIENTATION_LABEL = {
  get standing() { return t('stehend'); },
  get tipLong() { return t('getippt (Längsseite)'); },
  get tipShort() { return t('getippt (Stirnseite)'); },
};
