// Übersetzt das statische HTML (index.html): Elemente mit data-t / data-t-title /
// data-t-aria-label / data-t-placeholder tragen ihren deutschen Text im Dokument selbst.
// Die Marker sind boolesche Attribute; der deutsche Text (Schlüssel) ist der Elementtext
// bzw. der aktuelle Attributwert. Auf Deutsch bleibt das Dokument unverändert.
import { lang, t } from './i18n.js';

const ATTRIBUTE = ['title', 'aria-label', 'placeholder'];

// Schlüssel-Normalisierung: Whitespace-Läufe zu einem Leerzeichen, Ränder weg.
// Der Scanner der Sperr-Tests nutzt dieselbe Funktion.
export const normalisiert = s => String(s).replace(/\s+/g, ' ').trim();

export function translateDom(root) {
  document.documentElement.lang = lang;
  if (lang !== 'en') return;
  const sel = ['data-t', ...ATTRIBUTE.map(a => `data-t-${a}`)].map(a => `[${a}]`).join(',');
  for (const el of root.querySelectorAll(sel)) {
    if (el.getAttribute('data-t') !== null) {
      const de = normalisiert(el.textContent);
      const en = t(de);
      if (en !== de) el.textContent = en;
    }
    for (const a of ATTRIBUTE) {
      if (el.getAttribute(`data-t-${a}`) === null) continue;
      const alt = el.getAttribute(a);
      if (alt === null) continue;
      const de = normalisiert(alt);
      const en = t(de);
      if (en !== de) el.setAttribute(a, en);
    }
  }
}
