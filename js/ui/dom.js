const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ESC[ch]);

const NS = 'http://www.w3.org/2000/svg';
export function svgEl(tag, attrs = {}, parent = null) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  parent?.appendChild(el);
  return el;
}

export const fmtM = cm => `${(cm / 100).toFixed(2).replace('.', ',')} m`;

// Farbkästchen vor einem Case-/Stück-Namen. Stand bis Task 6 viermal als eigene Kopie in
// library.js, load-wizard.js und inspector.js (docs/code-review-2026-09-21.md, „S1 — eine
// swatch()-Hilfsfunktion statt vier Kopien“). Wie der Rest von dom.js kein Ersatz für esc() in
// Attributwerten — esc() schützt nicht innerhalb von style="…", der `color`-Wert kommt hier aber
// immer aus einem Farbwähler oder einer geprüften Datei (COLOR_RE in js/store/io.js).
export const swatch = color => `<span class="swatch" style="background:${esc(color)}"></span>`;

export const ORIENTATION_LABEL = {
  standing: 'stehend',
  tipLong: 'getippt (Längsseite)',
  tipShort: 'getippt (Stirnseite)',
};
