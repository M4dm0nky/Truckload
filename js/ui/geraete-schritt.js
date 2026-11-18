// Schritt „Geräte → Cases“ des Import-Dialogs (Spec 2026-11-17-nyx-projektgeraete). Zustand und
// Render sind rein und mit node prüfbar; der Dialog (tabellen-import.js) hängt nur Klicks daran.
// Nichts wird vorbelegt: ohne Klick bleiben Zuordnungen und Ergebnis leer.

import { esc, symbol } from './dom.js';
import { t } from '../i18n/i18n.js';
import { stueckProCase, bekannteCases, aufteilen, reduktion } from '../model/nyxAbgleich.js';

const MAX_PRO_CASE = 99;
const KEINE = new Map();
const proCase = v => (Number.isInteger(v) && v >= 1 && v <= MAX_PRO_CASE ? v : null);

// liste: Geräte aus NYX (für Gewerk/Gewicht), stand: Zeilen aus stand(), cases: Bibliothek,
// alias: Map aus umhaengen(), plan: aktueller Plan (nur für die Vorschau einer Reduktion).
export function geraeteState({ liste = [], stand = [], cases = [], alias = KEINE, plan = null } = {}) {
  const jeKey = new Map(liste.map(g => [g.key, g]));
  const caseName = id => cases.find(c => c.id === id)?.name ?? id;
  const stuecke = new Map([...(plan?.placements ?? []), ...(plan?.unplaced ?? [])].map(p => [p.id, p]));
  const red = {};
  for (const z of stand) {
    if (z.diff >= 0) continue; // auch bei „nicht laden“: Wieder laden braucht die Reduktion
    const r = reduktion(plan ?? { placements: [], unplaced: [] }, z.key, -z.diff, alias);
    const auf = new Set(r.aufLkw);
    red[z.key] = {
      minus: -z.diff, entfernen: r.entfernen, aufLkw: r.aufLkw,
      stuecke: r.entfernen.map(id => ({ id, caseId: stuecke.get(id)?.caseId, name: caseName(stuecke.get(id)?.caseId), aufLkw: auf.has(id) })),
    };
  }
  return {
    zeilen: stand, jeKey, cases: [...cases], wahl: null,
    diffModus: stand.some(z => z.verladen > 0),
    zuordnung: {}, stueckVor: {}, nichtLaden: new Set(stand.filter(z => z.nichtLaden).map(z => z.key)),
    nichtLadenVor: new Set(stand.filter(z => z.nichtLaden).map(z => z.key)),
    reduktionInfo: red, reduktionWahl: {},
  };
}

const zeileVon = (st, key) => st.zeilen.find(z => z.key === key);
const bedarf = (st, z) => (z && !st.nichtLaden.has(z.key) ? Math.max(z.diff, 0) : 0);

// Zuordnungen eines Typs der Reihe nach durchgerechnet: n Cases, Geräte je Stück, Rest danach.
export function zuordnungenVon(st, key) {
  const z = zeileVon(st, key);
  let offen = st.nichtLaden.has(key) ? 0 : bedarf(st, z);
  const aus = [];
  for (const a of st.zuordnung[key] ?? []) {
    const { cases, rest } = aufteilen(offen, a.stueck);
    const voll = cases > 0;
    const n = voll ? cases : offen > 0 ? 1 : 0;
    const nyxStueck = voll ? a.stueck : offen;
    offen = voll ? rest : 0;
    aus.push({ caseId: a.caseId, name: a.name, stueck: a.stueck, n, nyxStueck, rest: offen });
  }
  return aus;
}

export function offenVon(st, key) {
  const l = zuordnungenVon(st, key);
  if (l.length) return l[l.length - 1].rest;
  return st.nichtLaden.has(key) ? 0 : bedarf(st, zeileVon(st, key));
}

export const caseVon = (st, id) => st.cases.find(c => c.id === id);

// Aktionen: waehle {key} · case {case: Case} · loese {key, i} · stueck {key?, i?, caseId, wert} ·
// nichtladen {key} (umschalten) · red {key, ja}. Gibt den (veränderten) Zustand zurück.
export function geraeteAktion(st, act, d = {}) {
  if (act === 'waehle') { if (zeileVon(st, d.key)) st.wahl = d.key; return st; }
  if (act === 'case') {
    const key = st.wahl;
    const c = d.case;
    if (!key || !c || !zeileVon(st, key) || offenVon(st, key) <= 0) return st;
    if (!caseVon(st, c.id)) st.cases.push(c);
    (st.zuordnung[key] ??= []).push({ caseId: c.id, name: c.name, stueck: proCase(st.stueckVor[c.id]) ?? proCase(stueckProCase(c)) ?? 1 });
    return st;
  }
  if (act === 'loese') { st.zuordnung[d.key]?.splice(d.i, 1); return st; }
  if (act === 'stueck') {
    const w = proCase(d.wert);
    if (w === null) return st;
    if (d.i !== undefined && st.zuordnung[d.key]?.[d.i]) st.zuordnung[d.key][d.i].stueck = w;
    else st.stueckVor[d.caseId] = w;
    return st;
  }
  if (act === 'nichtladen') {
    if (st.nichtLaden.has(d.key)) st.nichtLaden.delete(d.key);
    else { st.nichtLaden.add(d.key); delete st.zuordnung[d.key]; }
    return st;
  }
  if (act === 'red') { st.reduktionWahl[d.key] = !!d.ja; return st; }
  return st;
}

// Ergebnis für den Dialog: nur Angeklicktes. Reduktionen nur, wenn bestätigt.
export function geraeteErgebnis(st) {
  const zuordnungen = [];
  for (const z of st.zeilen) {
    for (const a of zuordnungenVon(st, z.key)) {
      if (a.n > 0) zuordnungen.push({ key: z.key, name: z.name, caseId: a.caseId, n: a.n, stueck: a.stueck, nyxStueck: a.nyxStueck });
    }
  }
  const reduktion = Object.entries(st.reduktionInfo)
    .filter(([key]) => st.reduktionWahl[key] === true && !st.nichtLaden.has(key))
    .map(([key, r]) => ({ key, entfernen: [...r.entfernen] }));
  return { zuordnungen, nichtLaden: [...st.nichtLaden], reduktion };
}

// Würde „Übernehmen“ etwas ändern? Zuordnung, bestätigte Reduktion oder geänderte nichtLaden-Menge.
export function geraeteAenderung(st) {
  const e = geraeteErgebnis(st);
  const gleich = e.nichtLaden.length === st.nichtLadenVor.size && e.nichtLaden.every(k => st.nichtLadenVor.has(k));
  return e.zuordnungen.length > 0 || e.reduktion.length > 0 || !gleich;
}

// ---- Render ----

export function geraeteMenuHtml(st) {
  const dis = geraeteAenderung(st) ? '' : ' disabled';
  return `<menu><button type="button" data-act="cancel">${t('Abbrechen')}</button><span class="grow"></span>`
    + `<button type="button" data-act="only"${dis}>${t('Nur übernehmen')}</button><button type="button" class="primary" data-act="load"${dis}>${t('Übernehmen und laden')}</button></menu>`;
}

const diffText = z => (z.diff > 0 ? `+${z.diff}` : z.diff < 0 ? `−${-z.diff}` : '');

function zustandText(st, z) {
  if (st.nichtLaden.has(z.key)) return t('nicht laden');
  if (z.diff < 0) {
    const w = st.reduktionWahl[z.key];
    return w === true ? t('wird entfernt') : w === false ? t('bleibt stehen') : t('Entfernen offen');
  }
  if (z.diff === 0) return t('Alles verladen');
  const l = zuordnungenVon(st, z.key);
  if (!l.length) return t('noch offen');
  return offenVon(st, z.key) > 0 ? t('Rest offen') : t('zugeordnet');
}

function linkeZeile(st, z) {
  const zahl = st.diffModus && z.diff !== 0 && !st.nichtLaden.has(z.key) ? diffText(z) : String(z.anzahl);
  const zuo = zuordnungenVon(st, z.key).filter(a => a.n > 0)
    .map(a => `<span class="ge-ref">→ ${esc(a.n)}× ${esc(a.name)}</span>`).join('');
  return `<li><button type="button" class="ge-row list-item${st.wahl === z.key ? ' on' : ''}" data-act="g-waehle" data-key="${esc(z.key)}" aria-pressed="${st.wahl === z.key}">`
    + `<span class="ge-name">${esc(z.name)}</span><b class="ge-num">${esc(zahl)}</b><span class="hint">${esc(zustandText(st, z))}</span>${zuo}</button></li>`;
}

const stueckFeld = (wert, attrs) =>
  `<input type="number" min="1" max="${MAX_PRO_CASE}" step="1" value="${esc(wert)}" ${attrs} aria-label="${t('Geräte pro Case')}">`;

function reduktionHtml(st, z) {
  const r = st.reduktionInfo[z.key];
  const w = st.reduktionWahl[z.key];
  const liste = r.stuecke.map(s => `<li>${esc(s.name)}${s.aufLkw ? ` <span class="ti-tag dolly">${t('auf LKW')}</span>` : ''}</li>`).join('');
  const frage = r.aufLkw.length
    ? `<p class="ti-gelb">${symbol('triangle-alert')} ${esc(t('{n} davon stehen auf einem LKW.', { n: r.aufLkw.length }))}</p>`
    : '';
  const ja = r.aufLkw.length ? t('Trotzdem entfernen') : t('Entfernen');
  return `<p>${esc(t('NYX liefert {n} weniger. Diese Stücke würden entfernt:', { n: r.minus }))}</p>`
    + (r.stuecke.length ? `<ul class="ge-red">${liste}</ul>` : `<p class="hint">${t('Keine passenden Stücke im Plan.')}</p>`) + frage
    + `<div class="ti-bauknoepfe"><button type="button" data-act="g-red" data-key="${esc(z.key)}" data-ja="1"${w === true ? ' class="primary"' : ''}${r.stuecke.length ? '' : ' disabled'}>${ja}</button>`
    + `<button type="button" data-act="g-red" data-key="${esc(z.key)}" data-ja="0"${w === false ? ' class="primary"' : ''}>${t('Stehen lassen')}</button></div>`;
}

function vorschlaegeHtml(st, z) {
  const sortiert = bekannteCases(z.key, st.cases); // aufsteigend nach Geräten pro Case
  if (!sortiert.length) return '';
  const zeile = c => `<li class="ge-sug"><button type="button" data-act="g-case" data-case="${esc(c.id)}">${esc(c.name)}</button>`
    + `<span class="hint">${t('Geräte pro Case')}</span>${stueckFeld(st.stueckVor[c.id] ?? stueckProCase(c), `data-role="g-stueck" data-case="${esc(c.id)}"`)}</li>`;
  return `<p><b>${t('Bekannte Cases für diesen Typ:')}</b></p><ul class="ge-sugs">${sortiert.map(zeile).join('')}</ul>`;
}

function rechtsHtml(st) {
  const z = st.wahl ? zeileVon(st, st.wahl) : null;
  if (!z) return `<p class="hint">${t('Wähle links einen Gerätetyp.')}</p>`;
  const key = esc(z.key);
  const nicht = st.nichtLaden.has(z.key);
  const kopf = `<h3>${esc(z.name)} · ${esc(t('{n} Stück', { n: st.diffModus && z.diff > 0 && !nicht ? z.diff : z.anzahl }))}</h3>`;
  if (z.diff < 0 && !nicht) return kopf + reduktionHtml(st, z);
  if (nicht) {
    return `${kopf}<p class="hint">${t('Dieser Typ wird für dieses Projekt nicht geladen.')}</p>`
      + `<button type="button" data-act="g-skip" data-key="${key}">${t('Wieder laden')}</button>`;
  }
  if (z.diff === 0) return `${kopf}<p class="hint">${t('Alles verladen')}</p>`;
  const zuo = zuordnungenVon(st, z.key);
  const offen = offenVon(st, z.key);
  const zeilen = zuo.map((a, i) => `<li class="ge-asg"><span>${a.n > 0 ? `${esc(a.n)}× ${esc(a.name)}` : esc(a.name)}${a.rest > 0 ? ` · ${esc(t('{n} Rest', { n: a.rest }))}` : ''}</span>`
    + `<span class="hint">${t('Geräte pro Case')}</span>${stueckFeld(a.stueck, `data-role="g-stueck" data-key="${key}" data-i="${i}" data-case="${esc(a.caseId)}"`)}`
    + `<button type="button" data-act="g-unset" data-key="${key}" data-i="${i}">${t('Lösen')}</button></li>`).join('');
  const liste = zuo.length ? `<ul class="ge-asgs">${zeilen}</ul>` : '';
  if (offen <= 0) return kopf + liste;
  const sucheUndNeu = `<button type="button" data-act="g-find">${t('Anderes Case suchen …')}</button>`
    + `<button type="button" data-act="g-new">${t('Neues Case')}</button>`
    + `<button type="button" data-act="g-skip" data-key="${key}">${t('Nicht laden')}</button>`;
  return `${kopf}${liste}${zuo.length ? `<p><b>${esc(t('Für den Rest ({n} Stück) ein weiteres Case wählen:', { n: offen }))}</b></p>` : ''}`
    + vorschlaegeHtml(st, z)
    + `<div class="ti-bauknoepfe">${sucheUndNeu}</div>`;
}

// Zwei Spalten: links die Typen, rechts die Auswahl für den gewählten Typ. Ohne Fuß (macht der Dialog).
export function geraeteSchrittHtml(st) {
  const links = st.zeilen.length
    ? `<ul class="ge-list">${st.zeilen.map(z => linkeZeile(st, z)).join('')}</ul>`
    : `<p class="hint">${t('NYX liefert keine Geräte.')}</p>`;
  return `
    <h2>${t('Geräte aus NYX')}</h2>
    <div class="ti-bau ge-cols"><div class="ti-memo">${links}</div><div class="ti-gebaut ge-right">${rechtsHtml(st)}</div></div>`;
}
