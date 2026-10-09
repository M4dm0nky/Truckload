import { esc } from './dom.js';

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
  dlg.showModal();
  return dlg;
}

export function showAlert(message) {
  const d = open(`<form method="dialog" class="editor"><p>${esc(message)}</p>
    <menu><span class="grow"></span><button value="ok" class="primary">OK</button></menu></form>`);
  return new Promise(resolve => d.addEventListener('close', () => resolve(undefined), { once: true }));
}

export function showConfirm(message, { okLabel = 'OK', cancelLabel = 'Abbrechen', danger = false } = {}) {
  const d = open(`<form method="dialog" class="editor"><p>${esc(message)}</p>
    <menu><span class="grow"></span><button value="cancel" formnovalidate>${esc(cancelLabel)}</button>
    <button value="ok" class="${danger ? 'danger' : 'primary'}">${esc(okLabel)}</button></menu></form>`);
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true }));
}

// Kleiner Auswahldialog (<select> in #dlg-pick); Wert der gewählten Option, null bei Abbruch.
// `options`: [{ value, label }].
export function showPick(title, options) {
  const d = document.getElementById('dlg-pick');
  d.innerHTML = `<form method="dialog" class="editor"><label>${esc(title)}<select name="v">${options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>
    <menu><span class="grow"></span><button value="cancel" formnovalidate>Abbrechen</button><button value="ok" class="primary">OK</button></menu></form>`;
  const sel = d.querySelector('select');
  d.returnValue = ''; // sonst liefert Escape den Wert des vorigen Aufrufs
  d.showModal();
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok' ? sel.value : null), { once: true }));
}

// `maxlength`: optionale Obergrenze fürs Eingabefeld (z. B. Firmenname, s. firmNameError).
export function showPrompt(message, defaultValue = '', { maxlength } = {}) {
  const max = Number.isInteger(maxlength) && maxlength > 0 ? ` maxlength="${maxlength}"` : '';
  const d = open(`<form method="dialog" class="editor"><label>${esc(message)}<input name="value" value="${esc(defaultValue)}"${max}></label>
    <menu><span class="grow"></span><button value="cancel" formnovalidate>Abbrechen</button>
    <button value="ok" class="primary">OK</button></menu></form>`);
  const input = d.querySelector('input');
  queueMicrotask(() => input.focus());
  return new Promise(resolve => d.addEventListener('close', () => resolve(d.returnValue === 'ok' ? input.value : null), { once: true }));
}
