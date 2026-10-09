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

export const fmtM = cm => `${(cm / 100).toFixed(2).replace('.', ',')} m`;

// Farbkästchen vor einem Case-/Stück-Namen. Stand bis Task 6 viermal als eigene Kopie in
// library.js, load-wizard.js und inspector.js (docs/code-review-2026-09-21.md, „S1 — eine
// swatch()-Hilfsfunktion statt vier Kopien“). esc() schützt nicht innerhalb von style="…" (B2) —
// der `color`-Wert kommt heute immer aus einem Farbwähler oder einer geprüften Datei (COLOR_RE in
// js/store/io.js), aber swatch() verlässt sich damit auf jeden KÜNFTIGEN Aufrufer, dieselbe
// Prüfung selbst vorzunehmen (Nachtrag Controller, docs/code-review-2026-09-21.md). Das Muster
// erzwingt es deshalb selbst statt es vorauszusetzen: ein Wert außerhalb von `#RRGGBB`/`#RGB`
// (leer, IndexedDB-Altdaten von vor B2, eine künftige fremde Quelle) fällt auf Grau zurück, statt
// ungeprüft ins style-Attribut zu wandern.
const SWATCH_COLOR_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
// Gibt `c` nur zurück, wenn es #RGB/#RRGGBB ist, sonst Grau – für jede Farbe, die in ein
// style-Attribut oder SVG-Attribut wandert (esc() schützt dort nicht).
export const safeColor = c => (SWATCH_COLOR_RE.test(c) ? c : '#888');
export const swatch = color => `<span class="swatch" style="background:${safeColor(color)}"></span>`;

// Inline-SVG-Icons statt Emoji-Zeichen (✎/🗑 in js/ui/library.js) – ein Emoji bringt seine
// eigene, betriebssystemabhängige Farbe mit und fällt damit aus dem sonst durchgehend
// monochromen Dark-/Light-UI heraus. `fill="currentColor"` übernimmt stattdessen die
// Button-Textfarbe und läuft mit dem Farbmodus mit (css/app.css, `button { color: inherit; }`).
// Pfade: Phosphor Icons (MIT), „regular“-Stil, unverändert übernommen.
// Anders als bei swatch() ist `name` hier keine Nutzer-/Importdaten, sondern eine feste
// Zeichenkette im eigenen Code – ein unbekannter Name ist ein Tippfehler und soll laut werfen,
// nicht still ein leeres Icon liefern.
const ICON_PATHS = {
  'pencil-simple': 'M227.31,73.37,182.63,28.68a16,16,0,0,0-22.63,0L36.69,152A15.86,15.86,0,0,0,32,163.31V208a16,16,0,0,0,16,16H92.69A15.86,15.86,0,0,0,104,219.31L227.31,96a16,16,0,0,0,0-22.63ZM92.69,208H48V163.31l88-88L180.69,120ZM192,108.68,147.31,64l24-24L216,84.68Z',
  trash: 'M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z',
};
export function icon(name) {
  const d = ICON_PATHS[name];
  if (!d) throw new Error(`Unbekanntes Icon „${name}“.`);
  return `<svg class="icon" viewBox="0 0 256 256" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
}

export const ORIENTATION_LABEL = {
  standing: 'stehend',
  tipLong: 'getippt (Längsseite)',
  tipShort: 'getippt (Stirnseite)',
};
