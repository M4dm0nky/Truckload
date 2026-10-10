import { APP_VERSION } from '../version.js';
import { esc, safeColor, swatch, fmtM, ORIENTATION_LABEL } from './dom.js';
import { renderView } from './view2d.js';

// Angaben, die auf jeder Druckart im Kopf stehen – ein gemeinsamer Baustein statt doppelter
// esc()/toLocaleString()-Aufrufe in buildPrint und buildChecklist.
function headInfo({ plan, truck, result }) {
  const t = result.totals;
  return {
    plan: esc(plan.name),
    truck: esc(truck.name),
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
export function printHTML({ plan, truck, result }) {
  const t = result.totals;
  const h = headInfo({ plan, truck, result });
  const rows = sortedBySequence(result);
  return `
    <header>
      <h1>${h.plan}</h1>
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

export function buildPrint(root, { plan, truck, result, colorMode = 'black' }) {
  root.innerHTML = printHTML({ plan, truck, result });
  const opts = { truck, result, selectedId: null, colorMode };
  renderView(root.querySelector('.p-top'), 'top', opts);
  renderView(root.querySelector('.p-side'), 'side', opts);
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
export function buildChecklist(root, { plan, truck, result }) {
  listDoc(root, { plan, truck, result }, { title: '', reversed: false });
}

function listDoc(root, { plan, truck, result }, { title, reversed }) {
  const h = headInfo({ plan, truck, result });
  const rows = sortedBySequence(result);
  if (reversed) rows.reverse();
  const offen = plan.unplaced?.length ?? 0;
  root.innerHTML = `
    <header>
      <h1>${title}${h.plan}</h1>
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
      <span class="sign">Geladen von <span class="line"></span></span>
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
  const planName = esc(plan.name);
  const rows = sortedBySequence(result);
  const total = rows.length;
  root.innerHTML = `<div class="labels">${rows.map(it => {
    const n = result.sequence.get(it.id);
    return `
      <div class="tl-label">
        <span class="seq">${n}</span>
        <span class="name">${esc(it.label)}</span>
        <span class="bar" style="background:${safeColor(it.color)}"></span>
        <span class="meta"><span class="load">${planName}</span> <span class="count">${n} von ${total}</span></span>
      </div>`;
  }).join('')}</div>`;
}
