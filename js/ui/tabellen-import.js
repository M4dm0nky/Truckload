// Dialog „Tabelle importieren“ (Stufe 1): Übersicht, Liste zum Korrigieren, Hilfe. Die Render-Helfer
// (zusammenfassung, uebersichtHtml, listeHtml, zeilenStatus) sind rein und mit node prüfbar; der
// Dialog selbst hängt nur an einem <dialog> und kennt weder Store noch js/app/.
// Alles, was aus der Tabelle stammt (Namen, Gewerke, Befund-Texte), geht durch esc().

import { esc, safeColor, symbol, swatch } from './dom.js';
import { t, lang, trade, capList } from '../i18n/i18n.js';
import { colorFor } from '../data/categories.js';
import { SPALTEN, FARBEN, zahl, pruefeEintrag, entwurfAus, farbAuffaelligkeiten, istLoseBox } from '../model/ladeliste.js';
import { alsImportCase } from '../model/tabellen-uebernahme.js';
import { openTrussDialog } from './truss-wizard.js';
import { openDollyDialog } from './dolly-wizard.js';
import { VERHALTEN, ART, gewerkWoerterbuch, gewerkCfg, gewerkEintrag } from '../model/lkw-import.js';
import { catRank } from '../model/lkw-distribute.js';
import { MAX_LKW } from '../model/limits.js';
import { DEFAULT_TRUCK_ID } from '../data/preset-trucks.js';
import { geraeteState, geraeteAktion, geraeteErgebnis, geraeteSchrittHtml, geraeteMenuHtml, caseVon as geCaseVon } from './geraete-schritt.js';

// Relativ, damit die Dateien auch offline (sw.js) und in NYX gefunden werden.
const VORLAGEN = { de: 'data/Truckload-Ladeliste.xlsx', en: 'data/Truckload-Loadlist.xlsx' };
export const vorlageDatei = (l = lang) => VORLAGEN[l === 'en' ? 'en' : 'de'];

const reiterName = r => ({ cases: t('Cases'), traversen: t('Traversen'), boxen: t('Boxen'), set: t('Set') })[r];
const spaltenLabel = sg => (lang === 'en' ? sg.en : sg.de);
const ganzzahl = s => { const z = zahl(s, '').wert; return Number.isInteger(z) && z > 0 ? z : 0; };
const istListe = e => e.reiter === 'cases' || e.reiter === 'set' || istLoseBox(e);

// Stückzahlen je Kachel und je Gewerk (nur Zeilen ohne roten Befund), plus Zahl der roten/gelben Zeilen.
export function zusammenfassung(eintraege) {
  const z = { cases: 0, traversen: 0, boxen: 0, set: 0, rot: 0, rotSet: 0, rotBoxen: 0, gelb: 0, jeGewerk: [] };
  const gewerke = new Map();
  for (const e of eintraege) {
    if (e.reiter === 'traversen') { z.traversen += ganzzahl(e.werte.stueck); continue; }
    if (e.reiter === 'boxen' && !istLoseBox(e)) { z.boxen += ganzzahl(e.werte.anzahl); continue; }
    if (e.befunde.some(b => b.stufe === 'rot')) { z.rot++; if (e.reiter === 'set') z.rotSet++; if (e.reiter === 'boxen') z.rotBoxen++; continue; }
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

// Merkliste: Traversen und Boxen ohne Maße; sie werden in den Schritten danach von Hand gebaut.
const merklisteZeilen = eintraege => eintraege.filter(e => e.reiter === 'traversen' || (e.reiter === 'boxen' && !istLoseBox(e))).map(e => (e.reiter === 'traversen'
  ? `<li>${esc(e.werte.stueck)} × ${esc(e.werte.profil)} · ${esc(e.werte.laenge)} cm</li>`
  : `<li>${esc(e.werte.anzahl)} × ${esc(e.werte.typ)}</li>`));

function merklisteHtml(eintraege) {
  const zeilen = merklisteZeilen(eintraege);
  if (!zeilen.length) return '';
  return `<div class="ti-memo"><b>${t('Merkliste')}</b> <span class="hint">${t('Diese Zeilen baust du in den nächsten Schritten selbst (Traversen, Boxen).')}</span><ul>${zeilen.join('')}</ul></div>`;
}

// z = zusammenfassung(...), auffaellig = auffaelligkeiten(...). opts: { zielAktuell: string|null,
// merkliste: Eintrag[] (nur Traversen/Boxen werden gezeigt), ziel, ohneRot, dateiname }.
export function uebersichtHtml(z, auffaellig, { zielAktuell = null, merkliste = [], ziel = zielAktuell !== null ? 'current' : 'new', ohneRot = false, dateiname = '' } = {}) {
  // Rote Set-Zeilen sperren die Übersicht nicht: der Set-Schritt ist dafür da (eigene Sperre, eigenes Häkchen).
  const rotSonst = z.rot - (z.rotSet ?? 0);
  const gesperrt = rotSonst > 0 && !ohneRot;
  const kachel = (cls, n, text) => `<span class="ti-chip ${cls}"><b>${n}</b> ${text}</span>`;
  const band = (cls, name, text, knopf) => `<div class="ti-band ${cls}"><span>${symbol(name)} ${text}</span>${knopf}</div>`;
  const anzeigen = attrs => `<button type="button" data-act="edit" ${attrs}>${t('ansehen / korrigieren')}</button>`;
  const baender = [];
  if (rotSonst) baender.push(band('rot', 'circle-x', esc(rotSonst === 1 ? t('1 Zeile ist fehlerhaft (rot).') : t('{n} Zeilen sind fehlerhaft (rot).', { n: rotSonst })), anzeigen(`data-filter="bad" data-tab="${rotSonst > (z.rotBoxen ?? 0) ? 'cases' : 'boxen'}"`)));
  if (z.rotSet) baender.push(band('rot', 'circle-x', esc(z.rotSet === 1 ? t('1 Set-Teil ist fehlerhaft und wird im Schritt Set korrigiert.') : t('{n} Set-Teile sind fehlerhaft und werden im Schritt Set korrigiert.', { n: z.rotSet })), anzeigen('data-filter="bad" data-tab="set"')));
  if (z.gelb) baender.push(band('gelb', 'triangle-alert', esc(z.gelb === 1 ? t('1 Zeile mit Hinweis (gelb), sie wird mit den genannten Annahmen übernommen.') : t('{n} Zeilen mit Hinweis (gelb), sie werden mit den genannten Annahmen übernommen.', { n: z.gelb })), anzeigen('data-filter="bad" data-tab="cases"')));
  for (const a of auffaellig) {
    const text = t('{n} Zeilen sind {farbe}, aber dem Gewerk {gewerk} zugeordnet ({farbe} ist sonst {mehrheit}).',
      { n: a.zeilen.length, farbe: farbName(a.farbe), gewerk: trade(a.gewerk), mehrheit: trade(a.mehrheit) });
    baender.push(band('gelb', 'triangle-alert', esc(text), anzeigen(`data-filter="all" data-tab="${esc(a.reiter)}" data-rows="${esc(a.zeilen.join(','))}"`)));
  }
  const gewerke = z.jeGewerk.length
    ? `<table class="ti-trades"><tr><th>${t('Gewerk')}</th><th>${t('Stück')}</th></tr>${z.jeGewerk.map(g =>
      `<tr><td><span class="ti-dot" style="background:${safeColor(g.farbe)}"></span>${esc(trade(g.gewerk))}</td><td>${g.anzahl}</td></tr>`).join('')}</table>`
    : '';
  const ziele = zielAktuell !== null
    ? `<label class="check"><input type="radio" name="target" value="current"${ziel === 'current' ? ' checked' : ''}> ${esc(t('ins aktuelle Projekt „{name}“', { name: zielAktuell }))}</label>`
      + `<label class="check"><input type="radio" name="target" value="new"${ziel === 'new' ? ' checked' : ''}> ${t('neues Projekt anlegen')}</label>`
    : `<label class="check"><input type="radio" name="target" value="new" checked> ${t('neues Projekt anlegen')}</label>`;
  const rotWahl = rotSonst ? `<label class="check"><input type="checkbox" name="skipred"${ohneRot ? ' checked' : ''}> ${t('rote Zeilen nicht übernehmen')}</label>` : '';
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

// Entwürfe für die Übernahme; ausgelassen = Cases/Set/lose-Boxen-Zeilen mit rotem Befund (kein Entwurf).
export function entwuerfeAus(eintraege) {
  const entwuerfe = [];
  const ausgelassen = [];
  for (const e of eintraege) {
    if (!istListe(e)) continue;
    const d = entwurfAus(e);
    if (d) entwuerfe.push(d); else ausgelassen.push(e);
  }
  return { entwuerfe, ausgelassen };
}

export const FELD_KLASSE = { rot: 'error', gelb: 'warn' };
export const feldKlasse = stufe => (FELD_KLASSE[stufe] ? `small ${FELD_KLASSE[stufe]}` : 'small');

// Befund-Zustand einer Zeile: { zeile: 'rot'|'gelb'|'', felder: { key: 'rot'|'gelb' }, hinweis: HTML }.
export function zeilenStatus(e) {
  const felder = {};
  for (const b of e.befunde) if (felder[b.feld] !== 'rot') felder[b.feld] = b.stufe;
  const zeile = e.befunde.some(b => b.stufe === 'rot') ? 'rot' : e.befunde.length ? 'gelb' : '';
  const hinweis = e.befunde.map(b => `<span class="ti-${b.stufe}">${esc(b.text)}</span>`).join('<br>');
  return { zeile, felder, hinweis };
}

const passt = (e, suche) => !suche || Object.values(e.werte).some(v => String(v).toLowerCase().includes(suche));

// Tabelle des gewählten Reiters (Cases, Set oder Boxen). Zeilen tragen ihren Index im ganzen Array
// (data-i), Zellen ihren Schlüssel (data-k); gezeichnet werden alle Zeilen des Filters (der Leser
// liefert höchstens 2000).
// opts: { filter: 'alle'|'fehler', reiter: 'cases'|'set'|'boxen', suche, zeilen?: Set<Zeilennummer> }.
export function listeHtml(eintraege, { filter = 'alle', reiter = 'cases', suche = '', zeilen = null } = {}) {
  const spalten = SPALTEN[reiter];
  const s = String(suche).trim().toLowerCase();
  const treffer = eintraege.map((e, i) => ({ e, i }))
    .filter(({ e }) => e.reiter === reiter && (filter !== 'fehler' || e.befunde.length) && (!zeilen || zeilen.has(e.zeile)) && passt(e, s));
  const kopf = `<tr><th>#</th>${spalten.map(sg => `<th>${esc(spaltenLabel(sg))}</th>`).join('')}<th>${t('Hinweis')}</th><th></th></tr>`;
  const zeileHtml = ({ e, i }) => {
    const st = zeilenStatus(e);
    const zellen = spalten.map(sg => {
      const b = e.befunde.filter(x => x.feld === sg.key).map(x => x.text).join(' ');
      return `<td><input type="text" data-k="${esc(sg.key)}" value="${esc(e.werte[sg.key] ?? '')}" class="${feldKlasse(st.felder[sg.key])}"${b ? ` title="${esc(b)}"` : ''}></td>`;
    }).join('');
    return `<tr data-i="${i}" class="${st.zeile}"><td class="ti-nr">${e.zeile ?? '+'}</td>${zellen}<td class="ti-hint">${st.hinweis}</td>`
      + `<td><button type="button" class="ti-del" data-act="del" title="${t('Zeile löschen')}" aria-label="${t('Zeile löschen')}">${symbol('trash-2')}</button></td></tr>`;
  };
  return `<table class="ti-list"><thead>${kopf}</thead><tbody>${treffer.map(zeileHtml).join('')}</tbody></table>`
    + (!treffer.length ? `<p class="hint">${t('Keine Zeilen.')}</p>` : '');
}

// Filter nach „Zeile hinzufügen“: Eine neue Zeile muss sichtbar sein. Hat sie keinen Befund (leere
// Boxen-Zeile = Merkliste), würde „fehler“ sie verstecken.
export const filterNachHinzufuegen = e => (e.befunde.length ? 'fehler' : 'alle');

// ---- Schritte nach der Übersicht: Traversen, Boxen, Set (und später LKWs) ----

// Reihenfolge der Schritte; ein Schritt kommt nur, wenn sein Reiter Zeilen hat. `lkws` kommt zuletzt, nur beim Laden.
export function schritte(eintraege, laden, mitGeraete = false) {
  const hat = r => eintraege.some(e => e.reiter === r);
  return [...(mitGeraete ? ['geraete'] : []), ...['traversen', 'boxen', 'set'].filter(hat), ...(laden ? ['lkws'] : [])];
}

const MAX_STUECK = 500;
const istTraverse = c => c?.kind === 'truss';
const istDollyStack = c => c?.kind === 'speaker' && c.unitH > 0;
const setRot = eintraege => eintraege.some(e => e.reiter === 'set' && e.befunde.some(b => b.stufe === 'rot'));
export const setGesperrt = (eintraege, ohneRot) => setRot(eintraege) && !ohneRot;

// Fußzeile der Schritte: Zurück links, rechts Weiter bzw. im letzten Schritt Übernehmen.
function fussHtml({ letzter = false, laden = false, sperre = false } = {}) {
  const dis = sperre ? ' disabled' : '';
  const vor = letzter
    ? `<button type="button" class="primary" data-act="finish" data-role="go"${dis}>${laden ? t('Übernehmen und laden') : t('Nur übernehmen')}</button>`
    : `<button type="button" class="primary" data-act="next" data-role="go"${dis}>${t('Weiter')}</button>`;
  return `<menu><button type="button" data-act="prev">${t('Zurück')}</button><span class="grow"></span>${vor}</menu>`;
}

// Bauseite für Traversen oder Boxen. merkliste: Tabellenzeilen (es zählen die des Reiters `art`);
// gebaut: { cases, stuecke }; opts: { dollyBasen, bibliothekCases, basisId, basisN, letzter, laden }.
export function bauSchrittHtml(art, merkliste, gebaut, { dollyBasen = [], bibliothekCases = [], basisId = '', basisN = 1, letzter = false, laden = false } = {}) {
  const zeilen = merkliste.filter(e => e.reiter === art);
  const caseVon = new Map([...bibliothekCases, ...dollyBasen, ...gebaut.cases].map(c => [c.id, c]));
  const eigene = gebaut.stuecke.map((s, i) => ({ s, i, c: caseVon.get(s.caseId) })).filter(x => istTraverse(x.c) === (art === 'traversen'));
  const gebautZeile = ({ s, i, c }) => {
    const tag = art === 'boxen'
      ? (istDollyStack(c) ? `<span class="ti-tag dolly">${t('Dolly')}</span>` : `<span class="ti-tag loose">${t('lose')}</span>`)
      : '';
    return `<li class="ti-bauzeile"><span class="ti-name">${esc(c?.name ?? s.caseId)}</span>${tag}`
      + `<input type="number" min="1" max="${MAX_STUECK}" step="1" value="${esc(s.n)}" data-k="n" data-s="${i}" aria-label="${t('Anzahl')}">`
      + `<button type="button" class="ti-del" data-act="rm" data-s="${i}" title="${t('Entfernen')}" aria-label="${t('Entfernen')}">${symbol('trash-2')}</button></li>`;
  };
  const memo = merklisteZeilen(zeilen);
  const ausTabelle = art === 'boxen' ? zeilen.filter(istLoseBox) : [];
  const links = `<div class="ti-memo"><b>${t('Merkliste')}</b>${memo.length ? `<ul>${memo.join('')}</ul>` : ` <span class="hint">${t('Keine Zeilen.')}</span>`}</div>`
    + (ausTabelle.length
      ? `<div class="ti-ausTabelle"><b>${t('Kommt aus der Tabelle')}</b><ul>${ausTabelle.map(e => `<li>${esc(e.werte.typ)} · ${esc(e.werte.anzahl)}</li>`).join('')}</ul></div>`
      : '');
  const rechts = `<div class="ti-gebaut"><b>${t('Gebaut')}</b>${eigene.length ? `<ul>${eigene.map(gebautZeile).join('')}</ul>` : ` <span class="hint">${t('Noch nichts gebaut.')}</span>`}</div>`;
  const steuerung = art === 'traversen'
    ? `<div class="ti-bauknoepfe"><button type="button" data-act="truss">${t('Traverse hinzufügen')}</button></div>`
    : dollyBasen.length
      ? `<div class="ti-bauknoepfe"><select data-role="basis" aria-label="${t('Grundbox')}">${dollyBasen.map(b => `<option value="${esc(b.id)}"${b.id === basisId ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`
        + `<input type="number" min="1" max="${MAX_STUECK}" step="1" value="${esc(basisN)}" data-role="basisn" aria-label="${t('Anzahl')}">`
        + `<button type="button" data-act="loose">${t('Lose hinzufügen')}</button><button type="button" data-act="dolly">${t('Auf Dolly laden')}</button></div>`
      : `<p class="hint">${t('Keine Grundboxen in der Bibliothek.')}</p>`;
  return `
    <h2>${art === 'traversen' ? t('Traversen bauen') : t('Boxen bauen')}</h2>
    <div class="ti-bau"><div>${links}</div>${rechts}</div>
    ${steuerung}
    ${fussHtml({ letzter, laden })}`;
}

const zaehlerText = eintraege => {
  const z = zusammenfassung(eintraege);
  return `${t('{rot} fehlerhaft', { rot: z.rot })} · ${t('{gelb} mit Hinweis', { gelb: z.gelb })}`;
};

// Set-Schritt: bearbeitbare Tabelle nur der Set-Teile (gleiche data-i/data-k wie die Liste).
export function setSchrittHtml(eintraege, { ohneRot = false, letzter = false, laden = false } = {}) {
  const sperre = setGesperrt(eintraege, ohneRot);
  return `
    <h2>${t('Set')}</h2>
    <p class="hint">${t('Set-Teile prüfen und bei Bedarf korrigieren.')}</p>
    <div class="ti-leiste">
      <button type="button" data-act="add">${t('Zeile hinzufügen')}</button>
      <span class="hint" data-role="count">${esc(zaehlerText(eintraege.filter(e => e.reiter === 'set')))}</span>
    </div>
    <div class="ti-scroll" data-role="table">${listeHtml(eintraege, { filter: 'alle', reiter: 'set' })}</div>
    <label class="check"><input type="checkbox" name="skipredset"${ohneRot ? ' checked' : ''}> ${t('rote Zeilen nicht übernehmen')}</label>
    <p class="hint" data-role="sperrhinweis"${sperre ? '' : ' hidden'}>${t('Weiter ist gesperrt, solange rote Zeilen bleiben. Korrigieren oder „rote Zeilen nicht übernehmen“ ankreuzen.')}</p>
    ${fussHtml({ letzter, laden, sperre })}`;
}

// ---- LKW-Schritt: Verhalten, Fahrzeug, Verteilung, Vorschau ----

const GEWERK_MODI = () => [['offen', t('frei')], ['n', t('verteilen auf')], ['mit', t('zusammen mit')]];

// „Achtung: …“ für Stücke, die beim Laden keinen Platz fanden; '' wenn nichts fehlt. liste: { name, gewerk }[].
export function nichtGeladenText(liste) {
  if (!liste.length) return '';
  const l = capList(liste.map(x => `${x.name} (${trade(x.gewerk)})`)).join(', ');
  return liste.length === 1
    ? t('Achtung: 1 Case nicht geladen, kein Platz: {liste}', { liste: l })
    : t('Achtung: {n} Cases nicht geladen, kein Platz: {liste}', { n: liste.length, liste: l });
}

// Vorschau der LKW-Wahl. vorschau: null | { lkws: { name, gewerke, stueck }[], nichtGeladen: { name, gewerk }[] }.
export function vorschauHtml(vorschau, rechnet = false, fehler = false) {
  const stand = rechnet ? `<span class="hint">${t('rechnet …')}</span>` : '';
  if (fehler) return `<p class="ti-rot">${t('Die Vorschau konnte nicht berechnet werden.')}</p>`;
  if (!vorschau) return stand;
  const zeile = l => `<li class="lkw-vz"><b>${esc(l.name)}</b> ${l.gewerke.map(g => `${swatch(colorFor(g))}${esc(trade(g))}`).join(' ')}`
    + ` <span class="hint">${esc(t('{n} Stück', { n: l.stueck }))}</span></li>`;
  const warn = nichtGeladenText(vorschau.nichtGeladen);
  return `${stand}${vorschau.lkws.length ? `<ul class="lkw-vliste">${vorschau.lkws.map(zeile).join('')}</ul>` : `<p class="hint">${t('Es entsteht kein LKW.')}</p>`}`
    + (warn ? `<p class="ti-gelb">${symbol('triangle-alert')} ${esc(warn)}</p>` : '');
}

// LKW-Schritt. gewerke: Gewerke der betroffenen Stücke; einst: { verhalten, truckId, art, getrennt, gewerke:
// { [name]: { modus: 'offen'|'n'|'mit', n, mit } } } (Lücken = Vorgaben); stueckVon: { [gewerk]: Stückzahl }.
export function lkwSchrittHtml({ gewerke = [], einst = {}, fahrzeuge = [], zielHatLkw = false, freieLkw = MAX_LKW, vorschau = null, rechnet = false, fehler = false, stueckVon = {} } = {}) {
  const verhalten = zielHatLkw && Object.values(VERHALTEN).includes(einst.verhalten) ? einst.verhalten : VERHALTEN.NEU;
  const art = einst.art === ART.WENIGSTE ? ART.WENIGSTE : ART.JE_GEWERK;
  const radio = (v, text) => `<label class="check"><input type="radio" name="lkwverh" value="${v}"${verhalten === v ? ' checked' : ''}> ${text}</label>`;
  const oben = zielHatLkw
    ? `<div class="lkw-verh"><b>${t('Das Projekt hat schon LKW')}</b>`
      + radio(VERHALTEN.NEU, t('Alles neu laden'))
      + `<p class="hint">${t('Die vorhandenen LKW werden ersetzt: Namen und Fahrzeuge der alten LKW gehen verloren.')}</p>`
      + radio(VERHALTEN.ZUSAETZLICH, t('Neue Stücke auf zusätzliche LKW'))
      + radio(VERHALTEN.HINZU, t('Neue Stücke in vorhandene LKW'))
      + '</div>'
    : '';
  const sortiert = [...new Set(gewerke)].sort((a, b) => catRank(a) - catRank(b) || (a < b ? -1 : a > b ? 1 : 0));
  const zeile = g => {
    const c = gewerkCfg(einst.gewerke, g) ?? {};
    const modus = c.modus === 'n' || c.modus === 'mit' ? c.modus : 'offen';
    const andere = sortiert.filter(x => x !== g);
    const n = Number.isInteger(c.n) ? Math.min(Math.max(c.n, 1), Math.max(freieLkw, 1)) : 1;
    const feld = modus === 'n'
      ? `<input type="number" min="1" max="${esc(Math.max(freieLkw, 1))}" step="1" value="${esc(n)}" data-role="gn" data-g="${esc(g)}" aria-label="${t('Anzahl LKW')}">`
      : modus === 'mit'
        ? `<select data-role="gmit" data-g="${esc(g)}" aria-label="${t('zusammen mit')}">${andere.map(x => `<option value="${esc(x)}"${c.mit === x ? ' selected' : ''}>${esc(trade(x))}</option>`).join('')}</select>`
        : '';
    const stueck = gewerkCfg(stueckVon, g) ? ` <span class="hint">${esc(t('{n} Stück', { n: gewerkCfg(stueckVon, g) }))}</span>` : '';
    return `<li class="lkw-g">${swatch(colorFor(g))}<b>${esc(trade(g))}</b>${stueck}`
      + `<select data-role="gmodus" data-g="${esc(g)}" aria-label="${t('Verteilung')}">${GEWERK_MODI().map(([v, l]) => `<option value="${v}"${modus === v ? ' selected' : ''}>${l}</option>`).join('')}</select>${feld}</li>`;
  };
  const einstellungen = verhalten === VERHALTEN.HINZU ? '' : `
    <div class="lkw-fz"><label>${t('Fahrzeug')} <select data-role="lkwtruck">${fahrzeuge.map(f => `<option value="${esc(f.id)}"${f.id === einst.truckId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label></div>
    <div class="seg"><span class="seg-label">${t('Verteilung')}</span>
      <label class="check"><input type="radio" name="lkwart" value="${ART.JE_GEWERK}"${art === ART.JE_GEWERK ? ' checked' : ''}> ${t('Je Gewerk')}</label>
      <label class="check"><input type="radio" name="lkwart" value="${ART.WENIGSTE}"${art === ART.WENIGSTE ? ' checked' : ''}> ${t('So wenige LKWs wie möglich')}</label></div>
    ${art === ART.WENIGSTE
    ? `<label class="check"><input type="checkbox" name="lkwgetrennt"${einst.getrennt ? ' checked' : ''}> ${t('nach Gewerk getrennt')}</label>`
    : `<ul class="lkw-gl">${sortiert.map(zeile).join('')}</ul>`}`;
  return `
    <h2>${t('LKW')}</h2>
    ${oben}${einstellungen}
    <div class="lkw-vorschau" data-role="vorschau">${vorschauHtml(vorschau, rechnet, fehler)}</div>
    <menu><button type="button" data-act="prev">${t('Zurück')}</button><span class="grow"></span><button type="button" class="primary" data-act="finish" data-role="go">${t('Übernehmen und laden')}</button></menu>`;
}

function listeSeiteHtml(st) {
  const n = r => st.eintraege.filter(e => e.reiter === r).length;
  const tab = r => `<button type="button" data-act="tab" data-tab="${r}" class="${st.reiter === r ? 'on' : ''}">${reiterName(r)} (${n(r)})</button>`;
  const zeilen = st.zeilen?.reiter === st.reiter ? st.zeilen.set : null;
  return `
    <h2>${t('Liste bearbeiten')}</h2>
    <div class="ti-leiste">
      <div class="seg seg-inline">${tab('cases')}${tab('set')}${tab('boxen')}</div>
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

// Esc (cancel-Ereignis des Dialogs): in Liste und Schritten zurück zur Übersicht (Korrekturen bleiben), sonst Abbruch (null).
// `heim`: Startansicht des Dialogs ('geraete' bei der NYX-Übernahme, sonst 'overview').
export const escZiel = (view, heim = 'overview') => (view === heim ? null : heim);

// opts: { dateiname, eintraege (Traversen/Boxen/Cases/Set aus werteZeilen), zielAktuell: string|null,
//   trussDlg, dollyDlg (eigene <dialog>-Elemente), dollyBasen: Case[] (Grundboxen), bibliothekCases: Case[] }.
// opts zusätzlich für den LKW-Schritt: zielHatLkw, freieLkw (MAX_LKW minus vorhandene), fahrzeuge: {id, name}[],
//   vorhandeneGewerke: {name, stueck}[] (Stücke des Zielplans), vorschau: async (ergebnis) => { lkws, nichtGeladen }.
// opts.bestaetige(ergebnis): optional, async, wird erst im letzten Schritt gerufen; false = Dialog bleibt offen.
// opts.geraete: { liste, stand, cases, alias, plan } (NYX-Geräte, stand() des Plans, Bibliothek, umhaengen-Alias, aktueller Plan);
//   dann beginnt der Dialog mit dem Schritt „Geräte → Cases“, Ziel ist immer der aktuelle Plan.
//   opts.sucheCase(text) / opts.neuesCase({ name, gewerk, gewichtKg }): async, liefern ein Case oder null.
//   Ergebnis zusätzlich: zuordnungen [{ key, name, caseId, n, stueck, nyxStueck }], nichtLaden [key], reduktion [{ key, entfernen }] (nur bestätigt).
// Ergebnis: { eintraege, ziel: 'current'|'new', laden: boolean, ohneRot: boolean, gebaut: { cases, stuecke }, lkw: einst (nur beim Laden; ohne `neu`) }
// oder null bei Abbruch. Gebaute Cases sind Import-Cases (nie in der Bibliothek), Stücke { caseId, n }.
export async function openTabellenImport(dlg, opts) {
  if (dlg.open) {
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const zielAktuell = opts.zielAktuell ?? null;
  const st = {
    eintraege: [...opts.eintraege], view: 'overview', reiter: 'cases', filter: 'alle', suche: '', zeilen: null,
    ziel: zielAktuell !== null || opts.geraete ? 'current' : 'new', ohneRot: false, ohneRotSet: false,
    laden: false, folge: [], gebaut: { cases: [], stuecke: [] }, basisId: '', basisN: 1,
    lkw: { verhalten: VERHALTEN.NEU, truckId: '', art: ART.JE_GEWERK, getrennt: false, gewerke: gewerkWoerterbuch() },
    vorschau: null, rechnet: false, vorschauFehler: false,
  };
  const fahrzeuge = opts.fahrzeuge ?? [];
  st.lkw.truckId = (fahrzeuge.find(f => f.id === DEFAULT_TRUCK_ID) ?? fahrzeuge[0])?.id ?? '';
  const dollyBasen = opts.dollyBasen ?? [];
  const bibliothekCases = opts.bibliothekCases ?? [];
  let result = null;
  const ge = opts.geraete ? geraeteState(opts.geraete) : null;
  const heim = ge ? 'geraete' : 'overview';
  if (ge) st.view = 'geraete';
  const geErgebnis = () => (ge ? geraeteErgebnis(ge) : {});

  const tabelleNeu = () => {
    const zeilen = st.zeilen?.reiter === st.reiter ? st.zeilen.set : null;
    const filter = st.view === 'set' ? 'alle' : st.filter;
    dlg.querySelector('[data-role=table]').innerHTML = listeHtml(st.eintraege, { filter, reiter: st.reiter, suche: st.suche, zeilen });
  };
  const zaehler = () => zaehlerText(st.view === 'set' ? st.eintraege.filter(e => e.reiter === 'set') : st.eintraege);
  // Im Set-Schritt hängt Weiter an den roten Set-Zeilen; nach einer Änderung nur Knopf und Hinweis nachziehen.
  const setSperreNeu = () => {
    if (st.view !== 'set') return;
    const sperre = setGesperrt(st.eintraege, st.ohneRotSet);
    const knopf = dlg.querySelector('[data-role=go]');
    if (knopf) knopf.disabled = sperre;
    const hinweis = dlg.querySelector('[data-role=sperrhinweis]');
    if (hinweis) hinweis.hidden = !sperre;
  };
  // ---- LKW-Schritt: Gewerke, gültige Einstellungen, Vorschau ----
  const hatLkw = () => st.ziel === 'current' && !!opts.zielHatLkw;
  const verhaltenJetzt = () => (hatLkw() && Object.values(VERHALTEN).includes(st.lkw.verhalten) ? st.lkw.verhalten : VERHALTEN.NEU);
  const freieJetzt = () => (verhaltenJetzt() === VERHALTEN.NEU ? MAX_LKW : Math.max(opts.freieLkw ?? MAX_LKW, 0));
  const gewerkZaehler = () => {
    const m = new Map();
    const plus = (g, n) => m.set(g, (m.get(g) ?? 0) + n);
    const caseVon = new Map([...bibliothekCases, ...dollyBasen, ...st.gebaut.cases].map(c => [c.id, c]));
    for (const d of entwuerfeAus(st.eintraege).entwuerfe) plus(d.case.category || 'Sonstiges', d.menge);
    for (const x of st.gebaut.stuecke) plus(caseVon.get(x.caseId)?.category || 'Sonstiges', x.n);
    for (const a of geErgebnis().zuordnungen ?? []) plus(geCaseVon(ge, a.caseId)?.category || 'Sonstiges', a.n);
    if (verhaltenJetzt() === VERHALTEN.NEU && st.ziel === 'current') for (const v of opts.vorhandeneGewerke ?? []) plus(v.name || 'Sonstiges', v.stueck ?? 0);
    return m;
  };
  // Einstellungen, wie planeLkws sie versteht: immer gültige Werte (Verhalten, Art), N und „mit“ geprüft.
  const einstFuer = () => {
    const gewerke = [...gewerkZaehler().keys()];
    const frei = Math.max(freieJetzt(), 1);
    const gw = gewerkWoerterbuch();
    for (const g of gewerke) {
      const c = gewerkCfg(st.lkw.gewerke, g) ?? {};
      const andere = gewerke.filter(x => x !== g);
      if (c.modus === 'n') gw[g] = { modus: 'n', n: Number.isInteger(c.n) ? Math.min(Math.max(c.n, 1), frei) : 1 };
      else if (c.modus === 'mit' && andere.length) gw[g] = { modus: 'mit', mit: andere.includes(c.mit) ? c.mit : andere[0] };
    }
    return {
      verhalten: verhaltenJetzt(),
      truckId: fahrzeuge.some(f => f.id === st.lkw.truckId) ? st.lkw.truckId : fahrzeuge[0]?.id ?? st.lkw.truckId,
      art: st.lkw.art === ART.WENIGSTE ? ART.WENIGSTE : ART.JE_GEWERK,
      getrennt: !!st.lkw.getrennt,
      gewerke: gw,
    };
  };
  const lkwHtml = () => {
    const z = gewerkZaehler();
    return lkwSchrittHtml({ gewerke: [...z.keys()], stueckVon: Object.fromEntries(z), einst: einstFuer(),
      fahrzeuge, zielHatLkw: hatLkw(), freieLkw: freieJetzt(), vorschau: st.vorschau, rechnet: st.rechnet, fehler: st.vorschauFehler });
  };
  // Entprellt (300 ms), die letzte Anfrage gewinnt; die Vorschau ändert nichts am Store (opts.vorschau rechnet auf einer Kopie).
  let vzTimer = null;
  let vzNr = 0;
  const zeigeVorschau = () => {
    const el = dlg.querySelector('[data-role=vorschau]');
    if (el) el.innerHTML = vorschauHtml(st.vorschau, st.rechnet, st.vorschauFehler);
  };
  const planeVorschau = () => {
    if (!opts.vorschau) return;
    clearTimeout(vzTimer);
    const nr = ++vzNr;
    st.rechnet = true; st.vorschauFehler = false;
    zeigeVorschau();
    vzTimer = setTimeout(async () => {
      let daten = null;
      let fehler = false;
      try { daten = await opts.vorschau({ eintraege: st.eintraege, ziel: st.ziel, laden: true, ohneRot: st.ohneRot, gebaut: st.gebaut, lkw: einstFuer(), ...geErgebnis() }); }
      catch (err) { console.error(err); fehler = true; }
      if (nr !== vzNr || !dlg.open) return;
      st.vorschau = daten; st.rechnet = false; st.vorschauFehler = fehler;
      zeigeVorschau();
    }, 300);
  };
  const lkwAenderung = el => {
    const gewerke = [...gewerkZaehler().keys()];
    const g = el.dataset.g;
    const cfg = () => gewerkEintrag(st.lkw.gewerke, g);
    if (el.name === 'lkwverh') st.lkw.verhalten = el.value;
    else if (el.name === 'lkwart') st.lkw.art = el.value;
    else if (el.name === 'lkwgetrennt') st.lkw.getrennt = el.checked;
    else if (el.dataset.role === 'lkwtruck') st.lkw.truckId = el.value;
    else if (el.dataset.role === 'gmodus') { cfg().modus = el.value; if (el.value === 'mit') cfg().mit = gewerke.find(x => x !== g); }
    else if (el.dataset.role === 'gn') { const n = Number(el.value); cfg().n = Number.isInteger(n) && n >= 1 ? n : 1; }
    else if (el.dataset.role === 'gmit') cfg().mit = el.value;
    else return false;
    render();
    planeVorschau();
    return true;
  };
  const render = () => {
    if (st.view === 'geraete') {
      dlg.innerHTML = `<div class="editor ti">${geraeteSchrittHtml(ge)}${geraeteMenuHtml(ge)}</div>`;
      return;
    }
    if (st.view === 'lkws') { dlg.innerHTML = `<div class="editor ti">${lkwHtml()}</div>`; return; }
    if (st.view === 'list') { dlg.innerHTML = `<div class="editor ti">${listeSeiteHtml(st)}</div>`; return; }
    if (st.view !== 'overview') {
      const letzter = st.folge.indexOf(st.view) === st.folge.length - 1;
      const inhalt = st.view === 'set'
        ? setSchrittHtml(st.eintraege, { ohneRot: st.ohneRotSet, letzter, laden: st.laden })
        : bauSchrittHtml(st.view, st.eintraege, st.gebaut, { dollyBasen, bibliothekCases, basisId: st.basisId, basisN: st.basisN, letzter, laden: st.laden });
      dlg.innerHTML = `<div class="editor ti">${inhalt}</div>`;
      return;
    }
    const z = zusammenfassung(st.eintraege);
    dlg.innerHTML = `<div class="editor ti">${uebersichtHtml(z, auffaelligkeiten(st.eintraege), {
      zielAktuell, merkliste: st.eintraege, ziel: st.ziel, ohneRot: st.ohneRot, dateiname: opts.dateiname ?? '' })}</div>`;
  };
  let busy = false;
  const fertig = async laden => {
    if (busy) return;
    busy = true;
    try {
      const r = { eintraege: st.eintraege, ziel: st.ziel, laden, ohneRot: st.ohneRot, gebaut: st.gebaut, ...(laden ? { lkw: einstFuer() } : {}), ...geErgebnis() };
      if (opts.bestaetige && !(await opts.bestaetige(r))) return;
      result = r;
      dlg.close('ok');
    } finally { busy = false; }
  };

  // Schrittfolge: leer = direkt übernehmen (wie ohne Schritte). `lkws` steht beim Laden zuletzt.
  const starteSchritte = laden => {
    st.laden = laden;
    st.folge = schritte(st.eintraege, laden, !!ge);
    if (st.folge.length <= (ge ? 1 : 0)) { fertig(laden); return; }
    geheZu(ge ? 1 : 0);
  };
  const geheZu = i => {
    if (i < 0) st.view = heim;
    else if (i >= st.folge.length) { fertig(st.laden); return; }
    else {
      st.view = st.folge[i];
      if (st.view === 'set') { st.reiter = 'set'; st.filter = 'alle'; st.suche = ''; st.zeilen = null; }
    }
    render();
    if (st.view === 'lkws') planeVorschau();
  };
  const addiere = (caseId, n) => {
    const s = st.gebaut.stuecke.find(x => x.caseId === caseId);
    if (s) s.n += n; else st.gebaut.stuecke.push({ caseId, n });
  };
  const nimmAuf = res => {
    for (const c of res.newCases ?? (res.newCase ? [res.newCase] : [])) if (!st.gebaut.cases.some(x => x.id === c.id)) st.gebaut.cases.push(c);
    for (const a of res.additions ?? [res.addition]) addiere(a.caseId, a.n);
  };
  const bereinige = () => { st.gebaut.cases = st.gebaut.cases.filter(c => st.gebaut.stuecke.some(s => s.caseId === c.id)); };
  const stueckzahl = el => { const n = Number(el.value); return Number.isInteger(n) && n >= 1 && n <= MAX_STUECK ? n : null; };
  // Aktionen der Schritte; die Wizard-Dialoge öffnen sich über diesem Dialog, danach wird neu gezeichnet.
  let schrittBusy = false;
  const schrittAktion = async (act, b) => {
    if (schrittBusy) return;
    schrittBusy = true;
    try { await schrittAktion1(act, b); } finally { schrittBusy = false; }
  };
  const schrittAktion1 = async (act, b) => {
    if (act === 'prev') return geheZu(st.folge.indexOf(st.view) - 1);
    if (act === 'next') return geheZu(st.folge.indexOf(st.view) + 1);
    if (act === 'finish') return fertig(st.laden);
    if (act === 'rm') {
      st.gebaut.stuecke.splice(Number(b.dataset.s), 1);
      bereinige();
    } else if (act === 'truss') {
      const res = await openTrussDialog(opts.trussDlg, {
        cases: [...bibliothekCases, ...st.gebaut.cases],
        onNewTruss: async c => alsImportCase(c),
        stock: { mode: 'projekt' },
      });
      if (res) nimmAuf(res);
    } else {
      const basis = dollyBasen.find(x => x.id === dlg.querySelector('[data-role=basis]')?.value);
      const n = stueckzahl(dlg.querySelector('[data-role=basisn]') ?? { value: 1 });
      if (!basis || n === null) return;
      if (act === 'loose') addiere(basis.id, n);
      else {
        const res = await openDollyDialog(opts.dollyDlg, {
          baseCase: basis,
          existingCases: [...bibliothekCases, ...st.gebaut.cases],
          onNewDollyStack: async c => alsImportCase(c),
          stock: { mode: 'projekt' },
        });
        if (res) nimmAuf(res);
      }
    }
    if (dlg.open) render();
  };
  const SCHRITT_ACTS = new Set(['prev', 'next', 'finish', 'rm', 'truss', 'loose', 'dolly']);

  // Schritt „Geräte → Cases“: Knöpfe ändern den Zustand, Suche und „Neues Case“ fragen die App.
  let geBusy = false;
  const geraeteKlick = async (act, b) => {
    if (geBusy) return;
    geBusy = true;
    try {
      if (act === 'g-waehle') geraeteAktion(ge, 'waehle', { key: b.dataset.key });
      else if (act === 'g-case') geraeteAktion(ge, 'case', { case: geCaseVon(ge, b.dataset.case) });
      else if (act === 'g-unset') geraeteAktion(ge, 'loese', { key: b.dataset.key, i: Number(b.dataset.i) });
      else if (act === 'g-skip') geraeteAktion(ge, 'nichtladen', { key: b.dataset.key });
      else if (act === 'g-red') geraeteAktion(ge, 'red', { key: b.dataset.key ?? ge.wahl, ja: b.dataset.ja === '1' });
      else if (act === 'g-find' || act === 'g-new') {
        const z = ge.zeilen.find(x => x.key === ge.wahl);
        const g = ge.jeKey.get(ge.wahl);
        if (!z) return;
        const c = act === 'g-find'
          ? await opts.sucheCase?.(z.name)
          : await opts.neuesCase?.({ name: z.name, gewerk: g?.gewerk, gewichtKg: g?.gewichtKg });
        if (c) geraeteAktion(ge, 'case', { case: c });
      }
    } finally { geBusy = false; }
    if (dlg.open && st.view === 'geraete') render();
  };

  // Ein Listener je Ereignisart am Dialog (Ereignis-Delegation), keine je Zelle.
  dlg.onclick = ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act.startsWith('g-')) { geraeteKlick(act, b); return; }
    if (act === 'cancel') dlg.close('cancel');
    else if (act === 'only') starteSchritte(false);
    else if (act === 'load') starteSchritte(true);
    else if (SCHRITT_ACTS.has(act)) schrittAktion(act, b);
    else if (act === 'edit') {
      st.view = 'list'; st.filter = b.dataset.filter === 'bad' ? 'fehler' : 'alle'; st.reiter = b.dataset.tab ?? 'cases'; st.suche = '';
      st.zeilen = b.dataset.rows ? { reiter: st.reiter, set: new Set(b.dataset.rows.split(',').map(Number)) } : null;
      // „fehlerhaft“ kann im Set- oder Boxen-Reiter liegen, wenn Cases sauber sind
      if (st.filter === 'fehler' && !st.eintraege.some(e => e.reiter === st.reiter && e.befunde.length)) {
        const anderer = ['set', 'boxen'].find(r => st.eintraege.some(e => e.reiter === r && e.befunde.length));
        if (anderer) st.reiter = anderer;
      }
      render();
    } else if (act === 'back') { st.view = 'overview'; render(); }
    else if (act === 'tab') { st.reiter = b.dataset.tab; render(); }
    else if (act === 'nocolor') { st.zeilen = null; render(); }
    else if (act === 'add') {
      const neu = pruefeEintrag({ zeile: null, reiter: st.reiter, werte: Object.fromEntries(SPALTEN[st.reiter].map(sg => [sg.key, ''])), befunde: [] });
      st.eintraege.push(neu);
      st.filter = filterNachHinzufuegen(neu); st.suche = ''; st.zeilen = null;
      render();
      dlg.querySelector('.ti-list tbody tr:last-child input')?.focus();
    } else if (act === 'del') {
      st.eintraege.splice(Number(b.closest('tr').dataset.i), 1);
      tabelleNeu();
      dlg.querySelector('[data-role=count]').textContent = zaehler();
      setSperreNeu();
    }
  };
  dlg.onchange = ev => {
    const el = ev.target;
    if (st.view === 'lkws' && lkwAenderung(el)) return;
    if (el.dataset.role === 'g-stueck') {
      geraeteAktion(ge, 'stueck', { key: el.dataset.key, i: el.dataset.i === undefined ? undefined : Number(el.dataset.i), caseId: el.dataset.case, wert: Number(el.value) });
      render();
      return;
    }
    if (el.name === 'target') { st.ziel = el.value; return; }
    if (el.name === 'skipredset') { st.ohneRotSet = el.checked; render(); return; }
    if (el.name === 'skipred') { st.ohneRot = el.checked; render(); return; }
    if (el.dataset.role === 'basis') { st.basisId = el.value; return; }
    if (el.dataset.role === 'basisn') { st.basisN = stueckzahl(el) ?? 1; return; }
    if (el.dataset.k === 'n' && el.dataset.s !== undefined) {
      const n = stueckzahl(el);
      if (n !== null) st.gebaut.stuecke[Number(el.dataset.s)].n = n; else el.value = st.gebaut.stuecke[Number(el.dataset.s)].n;
      return;
    }
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
      input.className = feldKlasse(s.felder[input.dataset.k]);
      const text = neu.befunde.filter(x => x.feld === input.dataset.k).map(x => x.text).join(' ');
      if (text) input.title = text; else input.removeAttribute('title');
    }
    tr.querySelector('.ti-hint').innerHTML = s.hinweis;
    dlg.querySelector('[data-role=count]').textContent = zaehler();
    setSperreNeu();
  };
  dlg.oncancel = ev => {
    if (escZiel(st.view, heim) !== heim) return;
    ev.preventDefault();
    st.view = heim; render();
  };
  dlg.oninput = ev => {
    if (ev.target.dataset.role !== 'search') return;
    st.suche = ev.target.value;
    tabelleNeu();
  };

  render();
  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      clearTimeout(vzTimer); vzNr++;
      dlg.onclick = dlg.onchange = dlg.oninput = dlg.oncancel = null;
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
