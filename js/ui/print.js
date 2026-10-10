import { APP_VERSION } from '../version.js';
import { esc, safeColor, swatch, fmtM, ORIENTATION_LABEL } from './dom.js';
import { renderView } from './view2d.js';

// Angaben, die auf jeder Druckart im Kopf stehen – ein gemeinsamer Baustein statt doppelter
// esc()/toLocaleString()-Aufrufe in buildPrint und buildChecklist.
function headInfo({ plan, truck, result, lkw }) {
  const t = result.totals;
  return {
    plan: esc(plan.name),
    truck: esc(truck.name),
    // Nur bei „alle LKW“ gesetzt; sonst '' – dann bleibt das Markup eines Ein-LKW-Plans unverändert.
    lkw: lkw ? esc(lkw.name) : '',
    date: new Date().toLocaleDateString('de-DE'),
    count: t.count,
    weight: Math.round(t.weight).toLocaleString('de-DE'),
    version: APP_VERSION,
  };
}

const sortedBySequence = result => [...result.items].sort((a, b) => result.sequence.get(a.id) - result.sequence.get(b.id));

// Warnungen aus dem Packergebnis, gemeinsam für Ladeplan und Abhakliste.
const issuesHTML = result => result.issues.length
  ? `<section class="p-issues"><b>Achtung:</b> ${result.issues.map(i => esc(i.message)).join(' · ')}</section>`
  : '';

// Reines HTML-Bauen, ohne DOM-Zugriff – testbar ohne jsdom. buildPrint hängt danach die SVGs
// über root.querySelector ein (das braucht echtes DOM und bleibt deshalb dort).
export function printHTML({ plan, truck, result, lkw }) {
  const t = result.totals;
  const h = headInfo({ plan, truck, result, lkw });
  const rows = sortedBySequence(result);
  return `
    <header>
      <h1>${h.plan}${h.lkw ? ` – ${h.lkw}` : ''}</h1>
      <p>${h.truck} · Innen ${truck.l}×${truck.w}×${truck.h} cm · ${h.date}
        · ${h.weight} / ${truck.payload.toLocaleString('de-DE')} kg
        · ${fmtM(t.loadMeters * 100)} Lademeter · ${h.count} Cases · Truckload V ${h.version}</p>
      ${t.withoutWeight ? `<p class="p-noweight">${t.withoutWeight} Case${t.withoutWeight === 1 ? '' : 's'} ohne Gewicht – die Nutzlast oben ist unvollständig${t.cog && t.cog.source === 'volume' ? '; Schwerpunkt ersatzweise über das Volumen geschätzt (Cases ohne Gewicht zählen dabei wie voll beladen)' : ''}.</p>` : ''}
    </header>
    <figure><figcaption>Draufsicht (Stirnwand links)</figcaption><svg class="p-top"></svg></figure>
    <figure><figcaption>Seitenansicht (von links)</figcaption><svg class="p-side"></svg></figure>
    ${issuesHTML(result)}
    <table>
      <thead><tr><th>Nr.</th><th>Beschriftung</th><th>Case</th><th>Inhalt</th><th>Ausrichtung</th><th>ab Stirnwand</th><th>Höhe</th><th>Lage</th><th>kg</th></tr></thead>
      <tbody>${rows.map(it => `<tr>
        <td>${result.sequence.get(it.id)}</td><td>${esc(it.label)}</td><td>${esc(it.c.name)}</td><td>${esc(it.c.content)}</td>
        <td>${ORIENTATION_LABEL[it.p.orientation]}</td><td>${fmtM(it.box.x0)}</td>
        <td>${it.box.z0 > 0 ? `${Math.round(it.box.z0)} cm` : 'Boden'}</td><td>${result.layers.get(it.id)}</td><td>${esc(it.c.weight)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function drawViews(scope, { truck, result, colorMode }, draw = renderView) {
  const opts = { truck, result, selectedId: null, colorMode };
  draw(scope.querySelector('.p-top'), 'top', opts);
  draw(scope.querySelector('.p-side'), 'side', opts);
}

export function buildPrint(root, { plan, truck, result, colorMode = 'black' }) {
  root.innerHTML = printHTML({ plan, truck, result });
  drawViews(root, { truck, result, colorMode });
}

// Zweite Druckart: eine Abhakliste für die Rampe – je Stück eine Zeile mit Ladenummer,
// Farbpunkt, Beschriftung und einem leeren Kästchen statt der Draufsicht/Seitenansicht/Tabelle
// aus buildPrint. Bewusst ohne <input type="checkbox">: gedruckte Formularelemente sehen je
// nach Browser verschieden aus und drucken teils gar nicht.
//
// Die Liste zählt nur die GELADENEN Stücke – sie kommt aus `result.items`, also aus
// `plan.placements`. Was in „Noch nicht geladen“ liegt, hat keine Ladenummer und kann nicht
// abgehakt werden. Dass es das gibt, muss auf dem Blatt trotzdem stehen: sonst hakt der Lader
// die Liste vollständig ab, während Cases in der Halle stehen bleiben – genau das Missgeschick,
// das die Abhakliste verhindern soll. Dasselbe gilt für die Warnungen aus dem Packergebnis, die
// der Ladeplan schon druckt.
const CHECKLIST = { title: '', reversed: false, signLabel: 'Geladen von' };
const UNLOAD = { title: 'Ausladeliste – ', reversed: true, signLabel: 'Entladen von' };

export function buildChecklist(root, { plan, truck, result }) {
  listDoc(root, { plan, truck, result }, CHECKLIST);
}

// Vierte Druckart: die Ausladeliste – dieselbe Liste wie die Abhakliste, aber in umgekehrter
// Ladereihenfolge (das zuletzt Eingeladene steht oben und wird zuerst ausgeladen), mit der
// Überschrift „Ausladeliste“. Kopfangaben, Lage und Seitenregel (A4 quer) wie bei der Abhakliste.
export function buildUnloadList(root, { plan, truck, result }) {
  listDoc(root, { plan, truck, result }, UNLOAD);
}

function listDoc(root, args, opts) { root.innerHTML = listHTML(args, opts); }

function listHTML({ plan, truck, result, lkw }, { title, reversed, signLabel }) {
  const h = headInfo({ plan, truck, result, lkw });
  const rows = sortedBySequence(result);
  if (reversed) rows.reverse();
  const offen = plan.unplaced?.length ?? 0;
  return `
    <header>
      <h1>${title}${h.plan}${h.lkw ? ` – ${h.lkw}` : ''}</h1>
      <p>${h.truck} · ${h.date} · ${h.count} Cases · ${h.weight} kg · Truckload V ${h.version}</p>
      ${offen ? `<p class="p-open"><b>${offen} Stück nicht geladen</b> – ${offen === 1 ? 'es steht' : 'sie stehen'} nicht auf dieser Liste.</p>` : ''}
    </header>
    ${issuesHTML(result)}
    <ul class="checklist">${rows.map(it => `<li>
        <span class="num">${result.sequence.get(it.id)}</span>
        ${swatch(it.color)}
        <span class="label">${esc(it.label)} <small>(${esc(it.c.name)})</small></span>
        <span class="layer">Lage ${result.layers.get(it.id)}</span>
        <span class="tick"></span>
      </li>`).join('')}
    </ul>
    <footer class="signoff">
      <span class="sign">${signLabel} <span class="line"></span></span>
      <span class="sign">Datum <span class="line"></span></span>
    </footer>`;
}

// Dritte Druckart: ein Bogen Etiketten, je Stück eines, zum Ausschneiden. Bewusst OHNE
// headInfo()-Kopfzeile auf der Seite selbst – ein Seitenkopf würde das Raster auf jeder Seite
// anders verschieben, sobald die letzte Zeile einer Seite nicht voll ist. Der Planname kommt
// stattdessen klein auf jedes einzelne Etikett (`meta`).
// Etiketten drucken auf A4 HOCH und randlos (Avery-Zweckform-Bögen); Ladeplan und Abhakliste
// bleiben A4 quer. Benannte Seiten (`@page x { … }` + `page:`) wären der direktere Weg, werden
// aber von Browsern uneinheitlich unterstützt – js/app.js hängt deshalb diese Regel nur für den
// Etikettendruck ein und nimmt sie danach wieder weg.
export const pageRuleFor = doc =>
  doc === 'labels' ? '@page { size: A4 portrait; margin: 0; }' : null;

// `truck` wird nicht gebraucht und deshalb auch nicht angefasst: ein Etikett nennt nur den
// Ladenamen. headInfo() würde `truck.name` dereferenzieren und den Etikettendruck ohne Not an
// ein auflösbares Fahrzeug binden.
export function buildLabels(root, { plan, result, size = 'large' }) {
  root.innerHTML = `<div class="labels">${labelsHTML({ plan, result })}</div>`;
}

function labelsHTML({ plan, result, lkw }) {
  const planName = esc(plan.name);
  const rows = sortedBySequence(result);
  const total = rows.length;
  return rows.map(it => {
    const n = result.sequence.get(it.id);
    return `
      <div class="tl-label">
        <span class="seq">${n}</span>
        <span class="name">${esc(it.label)}</span>
        <span class="bar" style="background:${safeColor(it.color)}"></span>
        ${metaHTML(planName, lkw ? esc(lkw.name) : '', `${n} von ${total}`)}
      </div>`;
  }).join('');
}

// Fußzeile eines Etiketts. Mit LKW-Name (nur „alle LKW“) steht er in einer eigenen, nicht
// gekürzten Zeile über Planname und Zählung – sonst sähen Etiketten verschiedener LKW gleich aus.
// Ohne LKW bleibt das Markup wie vor Mehr-LKW.
const metaHTML = (planName, lkwName, count) => lkwName
  ? `<span class="meta meta-lkw"><span class="lkw">${lkwName}</span> <span class="load">${planName}</span> <span class="count">${count}</span></span>`
  : `<span class="meta"><span class="load">${planName}</span> <span class="count">${count}</span></span>`;

// ---- Mehr-LKW-Pläne: „alle LKW“ -----------------------------------------------------------
// `sections`: je LKW { lkw: {name}, plan, truck, result } (die Ansicht des LKW und ihre Prüfung).
// `free`: { plan, caseById } mit der Ansicht der nicht zugeordneten Stücke (unassignedView) oder
// null. Jeder Abschnitt steht in `<section class="p-lkw">`; ab dem zweiten trägt er `p-break`
// (Seitenumbruch davor, css/print.css). Ein-LKW-Pläne gehen nie hier durch (Markup unverändert).
const wrapSections = parts => parts
  .map((html, i) => `<section class="p-lkw${i ? ' p-break' : ''}">${html}</section>`).join('');

// Eigene Entscheidung: „Ohne LKW“ steht als letzter Abschnitt jeder Liste (auch im Ladeplan, dort
// ohne Zeichnung – ein Fahrzeug gibt es nicht). Die Stücke haben keine Ladenummer und sind NICHT
// geladen; der Text sagt das, damit die Liste nicht für vollständig gehalten wird.
function freeHTML({ plan, caseById }, title = '') {
  const items = plan.unplaced;
  const n = items.length;
  const h = headInfoFree(plan);
  return `
    <header>
      <h1>${title}${h.plan} – Ohne LKW</h1>
      <p>${h.date} · ${n} Stück${n === 1 ? '' : 'e'} · Truckload V ${h.version}</p>
      <p class="p-open"><b>${n} Stück${n === 1 ? '' : 'e'} ohne LKW</b> – ${n === 1 ? 'es ist' : 'sie sind'} keinem Fahrzeug zugeordnet und nicht geladen.</p>
    </header>
    <ul class="checklist">${items.map(u => {
      const { label, color, caseName } = freePiece(u, caseById);
      return `<li>
        <span class="num">–</span>
        ${swatch(color)}
        <span class="label">${esc(label)} <small>(${esc(caseName)})</small></span>
        <span class="layer">nicht geladen</span>
        <span class="tick"></span>
      </li>`;
    }).join('')}
    </ul>`;
}
// Beschriftung und Farbe wie in js/model/items.js: fehlt beides am Stück, gelten Case-Name und -Farbe.
const freePiece = (u, caseById) => {
  const c = caseById.get(u.caseId);
  return { label: u.label ?? c?.name ?? u.caseId, color: u.color ?? c?.color, caseName: c?.name ?? 'unbekannter Case' };
};
const headInfoFree = plan => ({ plan: esc(plan.name), date: new Date().toLocaleDateString('de-DE'), version: APP_VERSION });

const hasFree = free => !!free && free.plan.unplaced.length > 0;

// `draw` ersetzt renderView (nur für Tests ohne DOM).
export function buildPrintAll(root, sections, { colorMode = 'black', free = null, draw } = {}) {
  const parts = sections.map(s => printHTML(s));
  if (hasFree(free)) parts.push(freeHTML(free));
  root.innerHTML = wrapSections(parts);
  const scopes = root.querySelectorAll('.p-lkw');
  sections.forEach((s, i) => drawViews(scopes[i], { truck: s.truck, result: s.result, colorMode }, draw));
}

function buildListAll(root, sections, free, opts) {
  const parts = sections.map(s => listHTML(s, opts));
  if (hasFree(free)) parts.push(freeHTML(free, opts.title));
  root.innerHTML = wrapSections(parts);
}
export const buildChecklistAll = (root, sections, { free = null } = {}) => buildListAll(root, sections, free, CHECKLIST);
export const buildUnloadListAll = (root, sections, { free = null } = {}) => buildListAll(root, sections, free, UNLOAD);

// Etiketten aller LKW in EINER Folge (ein Raster, kein Seitenumbruch zwischen den LKW); die
// Ladenummer zählt je LKW, der LKW-Name steht im Etikett. Nicht zugeordnete Stücke folgen zuletzt
// mit „–“ statt Ladenummer.
export function buildLabelsAll(root, sections, { free = null } = {}) {
  const parts = sections.map(s => labelsHTML(s));
  if (hasFree(free)) {
    const planName = esc(free.plan.name);
    const total = free.plan.unplaced.length;
    parts.push(free.plan.unplaced.map((u, i) => {
      const { label, color } = freePiece(u, free.caseById);
      return `
      <div class="tl-label">
        <span class="seq">–</span>
        <span class="name">${esc(label)}</span>
        <span class="bar" style="background:${safeColor(color)}"></span>
        ${metaHTML(planName, 'Ohne LKW', `${i + 1} von ${total}`)}
      </div>`;
    }).join(''));
  }
  root.innerHTML = `<div class="labels">${parts.join('')}</div>`;
}
