// Sprachkern: t() für Texte, num()/date() für Formate, trade() für Gewerke.
// Gespeicherte Daten bleiben deutsch; übersetzt wird nur bei der Anzeige.
import EN from './en.js';

const GEWERKE_EN = {
  Licht: 'Lighting', Ton: 'Sound', Video: 'Video', Rigging: 'Rigging', Strom: 'Power',
  'Bühne': 'Staging', Backline: 'Backline', Sonderbau: 'Scenic', Sonstiges: 'Other',
};

// Live-Binding: Importeure sehen Änderungen durch setLang.
// Ohne location (Node, Worker) bleibt es bei Deutsch.
export let lang = new URLSearchParams(globalThis.location?.search ?? '').get('lang') === 'en' ? 'en' : 'de';

// Nur für Tests.
export function setLang(l) { lang = l === 'en' ? 'en' : 'de'; }

// Ganze Sätze übersetzen; Parameter vorher selbst mit esc() behandeln, t() escaped nichts.
// Nachschlagen nur in eigenen Einträgen: Namen aus Importdaten wie „constructor“ dürfen
// nicht den Object-Prototyp treffen.
const eigen = (obj, key) => (Object.hasOwn(obj, key) ? obj[key] : undefined);

export function t(text, params, ctx) {
  let out = text;
  if (lang === 'en') out = eigen(EN, ctx ? `${ctx}|${text}` : text) ?? text;
  if (params) out = out.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(params, k) ? String(params[k]) : m));
  return out;
}

const locale = () => (lang === 'en' ? 'en-GB' : 'de-DE');
export const num = (v, opts) => v.toLocaleString(locale(), opts);
export const date = d => d.toLocaleDateString(locale());

export const trade = name => (lang === 'en' ? eigen(GEWERKE_EN, name) ?? name : name);

export const builtinNote = c => (c.builtin ? t(c.note) : c.note ?? '');
