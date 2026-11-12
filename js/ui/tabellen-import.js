// Dialog „Tabelle importieren“ (Stufe 1): Übersicht, Liste zum Korrigieren, Hilfe. Die Render-Helfer
// (zusammenfassung, uebersichtHtml, listeHtml, zeilenStatus) sind rein und mit node prüfbar; der
// Dialog selbst hängt nur an einem <dialog> und kennt weder Store noch js/app/.
// Alles, was aus der Tabelle stammt (Namen, Gewerke, Befund-Texte), geht durch esc().

import { esc, safeColor, icon } from './dom.js';
import { t, lang, trade } from '../i18n/i18n.js';
import { colorFor } from '../data/categories.js';
import { SPALTEN, FARBEN, zahl, pruefeEintrag, entwurfAus, farbAuffaelligkeiten } from '../model/ladeliste.js';

// Relativ, damit die Dateien auch offline (sw.js) und in NYX gefunden werden.
const VORLAGEN = { de: 'data/Truckload-Ladeliste.xlsx', en: 'data/Truckload-Loadlist.xlsx' };
export const vorlageDatei = (l = lang) => VORLAGEN[l === 'en' ? 'en' : 'de'];

// Höchstzahl gleichzeitig gezeichneter Listenzeilen (2000 Zeilen × ~10 Felder lähmen den Browser).
export const LISTE_MAX = 300;

const reiterName = r => ({ cases: t('Cases'), traversen: t('Traversen'), boxen: t('Boxen'), set: t('Set') })[r];
const spaltenLabel = sg => (lang === 'en' ? sg.en : sg.de);
const ganzzahl = s => { const z = zahl(s, '').wert; return Number.isInteger(z) && z > 0 ? z : 0; };
const istListe = e => e.reiter === 'cases' || e.reiter === 'set';

// Stückzahlen je Kachel und je Gewerk (nur Zeilen ohne roten Befund), plus Zahl der roten/gelben Zeilen.
export function zusammenfassung(eintraege) {
  const z = { cases: 0, traversen: 0, boxen: 0, set: 0, rot: 0, gelb: 0, jeGewerk: [] };
  const gewerke = new Map();
  for (const e of eintraege) {
    if (e.reiter === 'traversen') { z.traversen += ganzzahl(e.werte.stueck); continue; }
    if (e.reiter === 'boxen') { z.boxen += ganzzahl(e.werte.anzahl); continue; }
    if (e.befunde.some(b => b.stufe === 'rot')) { z.rot++; continue; }
    if (e.befunde.length) z.gelb++;
    const d = entwurfAus(e);
    if (!d) continue;
    z[e.reiter] += d.menge;
    gewerke.set(d.case.category, (gewerke.get(d.case.category) ?? 0) + d.menge);
  }
  z.jeGewerk = [...gewerke].map(([gewerk, anzahl]) => ({ gewerk, farbe: colorFor(gewerk), anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.gewerk.localeCompare(b.gewerk, 'de'));
  return z;
}

// Farb-Auffälligkeiten je Reiter (die Zeilennummern gelten nur innerhalb eines Reiters).
export const auffaelligkeiten = eintraege => ['cases', 'set']
  .flatMap(reiter => farbAuffaelligkeiten(eintraege.filter(e => e.reiter === reiter)).map(a => ({ ...a, reiter })));

const farbName = hex => { const f = FARBEN.find(x => x.hex === hex); return f ? (lang === 'en' ? f.en : f.de) : hex; };

// Merkliste: Traversen und Boxen werden in Stufe 1 nur angezeigt, nie gebaut.
function merklisteHtml(eintraege) {
  const zeilen = eintraege.filter(e => e.reiter === 'traversen' || e.reiter === 'boxen').map(e => (e.reiter === 'traversen'
    ? `<li>${esc(e.werte.stueck)} × ${esc(e.werte.profil)} · ${esc(e.werte.laenge)} cm</li>`
    : `<li>${esc(e.werte.anzahl)} × ${esc(e.werte.typ)}</li>`));
  if (!zeilen.length) return '';
  return `<div class="ti-memo"><b>${t('Merkliste')}</b> <span class="hint">${t('Traversen und Boxen werden in einer späteren Version gebaut. Aus diesen Zeilen entsteht jetzt nichts.')}</span><ul>${zeilen.join('')}</ul></div>`;
}

// z = zusammenfassung(...), auffaellig = auffaelligkeiten(...). opts: { zielAktuell: string|null,
// merkliste: Eintrag[] (nur Traversen/Boxen werden gezeigt), ziel, ohneRot, dateiname }.
export function uebersichtHtml(z, auffaellig, { zielAktuell = null, merkliste = [], ziel = zielAktuell !== null ? 'current' : 'new', ohneRot = false, dateiname = '' } = {}) {
  const gesperrt = z.rot > 0 && !ohneRot;
  const kachel = (cls, n, text) => `<span class="ti-chip ${cls}"><b>${n}</b> ${text}</span>`;
  const band = (cls, glyph, text, knopf) => `<div class="ti-band ${cls}"><span>${glyph} ${text}</span>${knopf}</div>`;
  const anzeigen = attrs => `<button type="button" data-act="edit" ${attrs}>${t('ansehen / korrigieren')}</button>`;
  const baender = [];
  if (z.rot) baender.push(band('rot', '✖', esc(t('{n} Zeilen sind fehlerhaft (rot).', { n: z.rot })), anzeigen('data-filter="bad" data-tab="cases"')));
  if (z.gelb) baender.push(band('gelb', '⚠', esc(t('{n} Zeilen mit Hinweis (gelb), sie werden mit den genannten Annahmen übernommen.', { n: z.gelb })), anzeigen('data-filter="bad" data-tab="cases"')));
  for (const a of auffaellig) {
    const text = t('{n} Zeilen sind {farbe}, aber dem Gewerk {gewerk} zugeordnet ({farbe} ist sonst {mehrheit}).',
      { n: a.zeilen.length, farbe: farbName(a.farbe), gewerk: trade(a.gewerk), mehrheit: trade(a.mehrheit) });
    baender.push(band('gelb', '⚠', esc(text), anzeigen(`data-filter="all" data-tab="${esc(a.reiter)}" data-rows="${esc(a.zeilen.join(','))}"`)));
  }
  const gewerke = z.jeGewerk.length
    ? `<table class="ti-trades"><tr><th>${t('Gewerk')}</th><th>${t('Stück')}</th></tr>${z.jeGewerk.map(g =>
      `<tr><td><span class="ti-dot" style="background:${safeColor(g.farbe)}"></span>${esc(trade(g.gewerk))}</td><td>${g.anzahl}</td></tr>`).join('')}</table>`
    : '';
  const ziele = zielAktuell !== null
    ? `<label class="check"><input type="radio" name="target" value="current"${ziel === 'current' ? ' checked' : ''}> ${esc(t('ins aktuelle Projekt „{name}“', { name: zielAktuell }))}</label>`
      + `<label class="check"><input type="radio" name="target" value="new"${ziel === 'new' ? ' checked' : ''}> ${t('neues Projekt anlegen')}</label>`
    : `<label class="check"><input type="radio" name="target" value="new" checked> ${t('neues Projekt anlegen')}</label>`;
  const rotWahl = z.rot ? `<label class="check"><input type="checkbox" name="skipred"${ohneRot ? ' checked' : ''}> ${t('rote Zeilen nicht übernehmen')}</label>` : '';
  const sperre = gesperrt ? ' disabled' : '';
  return `
    <h2>${t('Tabelle importieren')}</h2>
    <p class="hint">${esc(dateiname)}</p>
    <div class="ti-chips">
      ${kachel('', z.cases, t('Cases'))}${kachel('', z.traversen, t('Traversen'))}${kachel('', z.boxen, t('Boxen'))}${kachel('', z.set, t('Set'))}
    </div>
    ${baender.join('')}
    ${gewerke}
    ${merklisteHtml(merkliste)}
    <fieldset class="ti-target"><legend>${t('Wohin?')}</legend>${ziele}${rotWahl}</fieldset>
    ${gesperrt ? `<p class="hint">${t('Übernehmen ist gesperrt, solange rote Zeilen bleiben. Korrigieren oder „rote Zeilen nicht übernehmen“ ankreuzen.')}</p>` : ''}
    <menu>
      <button type="button" data-act="cancel">${t('Abbrechen')}</button>
      <span class="grow"></span>
      <button type="button" data-act="edit" data-filter="all" data-tab="cases">${t('Liste bearbeiten')}</button>
      <button type="button" data-act="only"${sperre}>${t('Nur übernehmen')}</button>
      <button type="button" class="primary" data-act="load"${sperre}>${t('Übernehmen und laden')}</button>
    </menu>`;
}

// Befund-Zustand einer Zeile: { zeile: 'rot'|'gelb'|'', felder: { key: 'rot'|'gelb' }, hinweis: HTML }.
export function zeilenStatus(e) {
  const felder = {};
  for (const b of e.befunde) if (felder[b.feld] !== 'rot') felder[b.feld] = b.stufe;
  const zeile = e.befunde.some(b => b.stufe === 'rot') ? 'rot' : e.befunde.length ? 'gelb' : '';
  const hinweis = e.befunde.map(b => `<span class="ti-${b.stufe}">${esc(b.text)}</span>`).join('<br>');
  return { zeile, felder, hinweis };
}

const passt = (e, suche) => !suche || Object.values(e.werte).some(v => String(v).toLowerCase().includes(suche));

// Tabelle des gewählten Reiters (Cases oder Set). Zeilen tragen ihren Index im ganzen Array
// (data-i), Zellen ihren Schlüssel (data-k); gezeichnet werden höchstens LISTE_MAX gefilterte Zeilen.
// opts: { filter: 'alle'|'fehler', reiter: 'cases'|'set', suche, zeilen?: Set<Zeilennummer> }.
export function listeHtml(eintraege, { filter = 'alle', reiter = 'cases', suche = '', zeilen = null } = {}) {
  const spalten = SPALTEN[reiter];
  const s = String(suche).trim().toLowerCase();
  const treffer = eintraege.map((e, i) => ({ e, i }))
    .filter(({ e }) => e.reiter === reiter && (filter !== 'fehler' || e.befunde.length) && (!zeilen || zeilen.has(e.zeile)) && passt(e, s));
  const zeigen = treffer.slice(0, LISTE_MAX);
  const kopf = `<tr><th>#</th>${spalten.map(sg => `<th>${esc(spaltenLabel(sg))}</th>`).join('')}<th>${t('Hinweis')}</th><th></th></tr>`;
  const zeileHtml = ({ e, i }) => {
    const st = zeilenStatus(e);
    const zellen = spalten.map(sg => {
      const b = e.befunde.filter(x => x.feld === sg.key).map(x => x.text).join(' ');
      return `<td><input type="text" data-k="${esc(sg.key)}" value="${esc(e.werte[sg.key] ?? '')}" class="${st.felder[sg.key] ?? ''}"${b ? ` title="${esc(b)}"` : ''}></td>`;
    }).join('');
    return `<tr data-i="${i}" class="${st.zeile}"><td class="ti-nr">${e.zeile ?? '+'}</td>${zellen}<td class="ti-hint">${st.hinweis}</td>`
      + `<td><button type="button" class="ti-del" data-act="del" title="${t('Zeile löschen')}" aria-label="${t('Zeile löschen')}">${icon('trash')}</button></td></tr>`;
  };
  const rest = treffer.length - zeigen.length;
  return `<table class="ti-list"><thead>${kopf}</thead><tbody>${zeigen.map(zeileHtml).join('')}</tbody></table>`
    + (rest > 0 ? `<p class="hint">${esc(t('… und {n} weitere Zeilen. Mit Suche oder Filter eingrenzen.', { n: rest }))}</p>` : '')
    + (!treffer.length ? `<p class="hint">${t('Keine Zeilen.')}</p>` : '');
}

const zaehlerText = eintraege => {
  const z = zusammenfassung(eintraege);
  return `${t('{rot} fehlerhaft', { rot: z.rot })} · ${t('{gelb} mit Hinweis', { gelb: z.gelb })}`;
};

function listeSeiteHtml(st) {
  const n = r => st.eintraege.filter(e => e.reiter === r).length;
  const tab = r => `<button type="button" data-act="tab" data-tab="${r}" class="${st.reiter === r ? 'on' : ''}">${reiterName(r)} (${n(r)})</button>`;
  const zeilen = st.zeilen?.reiter === st.reiter ? st.zeilen.set : null;
  return `
    <h2>${t('Liste bearbeiten')}</h2>
    <div class="ti-leiste">
      <div class="seg">${tab('cases')}${tab('set')}</div>
      <select data-role="filter">
        <option value="all">${t('Alle')}</option>
        <option value="bad"${st.filter === 'fehler' ? ' selected' : ''}>${t('Nur fehlerhafte')}</option>
      </select>
      <input type="search" data-role="search" value="${esc(st.suche)}" placeholder="${t('Suchen')}">
      ${zeilen ? `<button type="button" data-act="nocolor">${t('Farbfilter aufheben')}</button>` : ''}
      <button type="button" data-act="add">${t('Zeile hinzufügen')}</button>
      <span class="hint" data-role="count">${esc(zaehlerText(st.eintraege))}</span>
    </div>
    <div class="ti-scroll" data-role="table">${listeHtml(st.eintraege, { filter: st.filter, reiter: st.reiter, suche: st.suche, zeilen })}</div>
    <menu><span class="grow"></span><button type="button" class="primary" data-act="back">${t('Zurück zur Übersicht')}</button></menu>`;
}

// opts: { dateiname, eintraege (Traversen/Boxen/Cases/Set aus werteZeilen), zielAktuell: string|null }.
// Ergebnis: { eintraege, ziel: 'current'|'new', laden: boolean, ohneRot: boolean } oder null bei Abbruch.
export async function openTabellenImport(dlg, opts) {
  if (dlg.open) {
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const zielAktuell = opts.zielAktuell ?? null;
  const st = {
    eintraege: [...opts.eintraege], view: 'overview', reiter: 'cases', filter: 'alle', suche: '', zeilen: null,
    ziel: zielAktuell !== null ? 'current' : 'new', ohneRot: false,
  };
  let result = null;

  const tabelleNeu = () => {
    const zeilen = st.zeilen?.reiter === st.reiter ? st.zeilen.set : null;
    dlg.querySelector('[data-role=table]').innerHTML = listeHtml(st.eintraege, { filter: st.filter, reiter: st.reiter, suche: st.suche, zeilen });
  };
  const render = () => {
    if (st.view === 'list') { dlg.innerHTML = `<div class="editor ti">${listeSeiteHtml(st)}</div>`; return; }
    const z = zusammenfassung(st.eintraege);
    dlg.innerHTML = `<div class="editor ti">${uebersichtHtml(z, auffaelligkeiten(st.eintraege), {
      zielAktuell, merkliste: st.eintraege, ziel: st.ziel, ohneRot: st.ohneRot, dateiname: opts.dateiname ?? '' })}</div>`;
  };
  const fertig = laden => { result = { eintraege: st.eintraege, ziel: st.ziel, laden, ohneRot: st.ohneRot }; dlg.close('ok'); };

  // Ein Listener je Ereignisart am Dialog (Ereignis-Delegation), keine je Zelle.
  dlg.onclick = ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'cancel') dlg.close('cancel');
    else if (act === 'only') fertig(false);
    else if (act === 'load') fertig(true);
    else if (act === 'edit') {
      st.view = 'list'; st.filter = b.dataset.filter === 'bad' ? 'fehler' : 'alle'; st.reiter = b.dataset.tab ?? 'cases'; st.suche = '';
      st.zeilen = b.dataset.rows ? { reiter: st.reiter, set: new Set(b.dataset.rows.split(',').map(Number)) } : null;
      // „fehlerhaft“ kann im Set-Reiter liegen, wenn Cases sauber sind
      if (st.filter === 'fehler' && !st.eintraege.some(e => e.reiter === st.reiter && e.befunde.length)
        && st.eintraege.some(e => e.reiter === 'set' && e.befunde.length)) st.reiter = 'set';
      render();
    } else if (act === 'back') { st.view = 'overview'; render(); }
    else if (act === 'tab') { st.reiter = b.dataset.tab; render(); }
    else if (act === 'nocolor') { st.zeilen = null; render(); }
    else if (act === 'add') {
      st.eintraege.push(pruefeEintrag({ zeile: null, reiter: st.reiter, werte: Object.fromEntries(SPALTEN[st.reiter].map(sg => [sg.key, ''])), befunde: [] }));
      st.filter = 'fehler'; st.suche = ''; st.zeilen = null;
      render();
      dlg.querySelector('.ti-list tbody tr:last-child input')?.focus();
    } else if (act === 'del') {
      st.eintraege.splice(Number(b.closest('tr').dataset.i), 1);
      tabelleNeu();
      dlg.querySelector('[data-role=count]').textContent = zaehlerText(st.eintraege);
    }
  };
  dlg.onchange = ev => {
    const el = ev.target;
    if (el.name === 'target') { st.ziel = el.value; return; }
    if (el.name === 'skipred') { st.ohneRot = el.checked; render(); return; }
    if (el.dataset.role === 'filter') { st.filter = el.value === 'bad' ? 'fehler' : 'alle'; tabelleNeu(); return; }
    const tr = el.closest('tr[data-i]');
    if (!tr || !el.dataset.k) return;
    const i = Number(tr.dataset.i);
    const alt = st.eintraege[i];
    const neu = pruefeEintrag({ ...alt, werte: { ...alt.werte, [el.dataset.k]: el.value.trim() } });
    st.eintraege[i] = neu;
    const s = zeilenStatus(neu);
    tr.className = s.zeile;
    for (const input of tr.querySelectorAll('input[data-k]')) {
      input.className = s.felder[input.dataset.k] ?? '';
      const text = neu.befunde.filter(x => x.feld === input.dataset.k).map(x => x.text).join(' ');
      if (text) input.title = text; else input.removeAttribute('title');
    }
    tr.querySelector('.ti-hint').innerHTML = s.hinweis;
    dlg.querySelector('[data-role=count]').textContent = zaehlerText(st.eintraege);
  };
  dlg.oninput = ev => {
    if (ev.target.dataset.role !== 'search') return;
    st.suche = ev.target.value;
    tabelleNeu();
  };

  render();
  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      dlg.onclick = dlg.onchange = dlg.oninput = null;
      resolve(dlg.returnValue === 'ok' ? result : null);
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}

// Kleiner Hilfedialog („?“), ohne Netz.
export function hilfeHtml() {
  return `<form method="dialog" class="editor">
    <h2>${t('Tabelle importieren: so geht es')}</h2>
    <ol class="ti-hilfe">
      <li>${t('„Vorlage herunterladen“ und ausfüllen. Kopfzeile nicht ändern.')}</li>
      <li>${t('Excel: als .xlsx speichern und über „Tabelle importieren“ auswählen.')}</li>
      <li>${t('Google Sheets: Vorlage über Datei → Importieren hochladen und ausfüllen. Dann je Reiter Datei → Herunterladen → CSV.')}</li>
      <li>${t('Google exportiert nur den gerade offenen Reiter. Das ergibt bis zu vier CSV-Dateien, die im Dateidialog alle zusammen ausgewählt werden.')}</li>
      <li>${t('Die Höhe immer inklusive Rollen angeben, so wie das Case auf den Rollen steht.')}</li>
    </ol>
    <menu><span class="grow"></span><button value="ok" class="primary">${t('OK')}</button></menu></form>`;
}

export function openTabellenHilfe(dlg) {
  dlg.innerHTML = hilfeHtml();
  dlg.returnValue = '';
  dlg.showModal();
  return new Promise(resolve => dlg.addEventListener('close', () => resolve(undefined), { once: true }));
}
