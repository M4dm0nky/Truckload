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

export const ORIENTATION_LABEL = {
  standing: 'stehend',
  tipLong: 'gekippt (Längsseite)',
  tipShort: 'gekippt (Stirnseite)',
};
