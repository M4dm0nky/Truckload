import { esc, dialogKopf, fokusNachOeffnen } from './dom.js';
import { t } from '../i18n/i18n.js';

// Eigene Popups statt der nativen confirm()/alert()/prompt() – gleiches Muster wie
// openCaseEditor/openTruckEditor (<dialog> mit <form method="dialog">, Auflösung im
// close-Event), nur ohne eigenes Formular. Ein einziges <dialog id="dlg-confirm"> (index.html)
// wird je Aufruf neu befüllt; da nie zwei dieser Popups gleichzeitig offen sein können (jedes
// wartet per await/then auf sein close, bevor der nächste Aufrufer drankommt), ist Wiederverwenden
// unkritisch.
let dlg;
function open(html) {
  dlg ??= document.getElementById('dlg-confirm');
  dlg.innerHTML = html;
  dlg.returnValue = ''; // sonst liefert Escape den Wert des vorigen Aufrufs
  dlg.showModal(); fokusNachOeffnen(dlg);
  return dlg;
}

export function showAlert(message) {
  const d = open(`<form method="dialog" class="editor"><p>${esc(message)}</p>
    <menu><span class="grow"></span><button value="ok" class="primary">${t('OK')}</button></menu></form>`);
  return new Promise(resolve => d.addEventListener('close', () => resolve(undefined), { once: true }));
}

export function showConfirm(message, { okLabel = t('OK'), cancelLabel = t('Abbrechen'), danger = false } = {}) {
  const d = open(`<form method="dialog" class="editor"><p>${esc(message)}</p>
    <menu><span class="grow"></span><button value="cancel" formnovalidate>${esc(cancelLabel)}</button>
    <button value="ok" class="${danger ? 'danger' : 'primary'}">${esc(okLabel)}</button></menu></form>`);
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

// Filter der Auswahlliste: alle Wörter (an Leerraum getrennt) müssen im Label vorkommen, Groß-/Kleinschreibung egal.
export function pickFilter(options, text) {
  const w = String(text ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  return options.filter(o => { const l = String(o.label).toLowerCase(); return w.every(x => l.includes(x)); });
}

// Kleiner Auswahldialog (<select> in #dlg-pick); Wert der gewählten Option, null bei Abbruch.
// `options`: [{ value, label }]. `{ suche: true }`: Suchfeld über der Liste (tippt filtert, Enter übernimmt).
export function showPick(title, options, { suche = false } = {}) {
  const d = document.getElementById('dlg-pick');
  const optHtml = list => list.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  const field = suche
    ? `<input type="search" data-role="pick-suche" placeholder="${esc(t('Suchen …'))}" aria-label="${esc(t('Suchen …'))}" autocomplete="off" autofocus><select name="v" size="10" aria-label="${esc(title)}">${optHtml(options)}</select><p class="hint" data-role="pick-leer" hidden>${t('Kein Treffer.')}</p>`
    : `<select name="v" aria-label="${esc(title)}" autofocus>${optHtml(options)}</select>`;
  d.innerHTML = `<form method="dialog" class="editor">${dialogKopf(esc(title))}${field}
    <menu><span class="grow"></span><button value="cancel" formnovalidate>${t('Abbrechen')}</button><button value="ok" class="primary">${t('OK')}</button></menu></form>`;
  const sel = d.querySelector('select');
  if (suche) {
    const input = d.querySelector('[data-role="pick-suche"]');
    const leer = d.querySelector('[data-role="pick-leer"]');
    const ok = d.querySelector('button[value="ok"]');
    const zeige = () => {
      const treffer = pickFilter(options, input.value);
      sel.innerHTML = optHtml(treffer);
      if (treffer.length) sel.selectedIndex = 0;
      leer.hidden = treffer.length > 0;
      ok.disabled = !treffer.length;
    };
    input.addEventListener('input', zeige);
    input.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (sel.value) d.close('ok');
    });
    sel.addEventListener('dblclick', () => { if (sel.value) d.close('ok'); });
    sel.selectedIndex = options.length ? 0 : -1;
  }
  d.returnValue = ''; // sonst liefert Escape den Wert des vorigen Aufrufs
  d.showModal(); fokusNachOeffnen(d);
  if (suche) d.querySelector('[data-role="pick-suche"]').focus();
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok' ? sel.value : null), { once: true }));
}

// `maxlength`: optionale Obergrenze fürs Eingabefeld (z. B. Firmenname, s. firmNameError).
export function showPrompt(message, defaultValue = '', { maxlength } = {}) {
  const max = Number.isInteger(maxlength) && maxlength > 0 ? ` maxlength="${maxlength}"` : '';
  const d = open(`<form method="dialog" class="editor"><label>${esc(message)}<input name="value" value="${esc(defaultValue)}"${max}></label>
    <menu><span class="grow"></span><button value="cancel" formnovalidate>${t('Abbrechen')}</button>
    <button value="ok" class="primary">${t('OK')}</button></menu></form>`);
  const input = d.querySelector('input');
  queueMicrotask(() => input.focus());
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok' ? input.value : null), { once: true }));
}
