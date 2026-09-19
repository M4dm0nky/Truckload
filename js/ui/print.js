import { APP_VERSION } from '../version.js';
import { esc, fmtM, ORIENTATION_LABEL } from './dom.js';
import { renderView } from './view2d.js';

export function buildPrint(root, { plan, truck, result }) {
  const t = result.totals;
  const rows = [...result.items].sort((a, b) => result.sequence.get(a.id) - result.sequence.get(b.id));
  root.innerHTML = `
    <header>
      <h1>${esc(plan.name)}</h1>
      <p>${esc(truck.name)} · Innen ${truck.l}×${truck.w}×${truck.h} cm · ${new Date().toLocaleDateString('de-DE')}
        · ${Math.round(t.weight).toLocaleString('de-DE')} / ${truck.payload.toLocaleString('de-DE')} kg
        · ${fmtM(t.loadMeters * 100)} Lademeter · ${t.count} Cases · Truckload V ${APP_VERSION}</p>
    </header>
    <figure><figcaption>Draufsicht (Stirnwand links)</figcaption><svg class="p-top"></svg></figure>
    <figure><figcaption>Seitenansicht (von links)</figcaption><svg class="p-side"></svg></figure>
    ${result.issues.length ? `<section class="p-issues"><b>Achtung:</b> ${result.issues.map(i => esc(i.message)).join(' · ')}</section>` : ''}
    <table>
      <thead><tr><th>Nr.</th><th>Case</th><th>Inhalt</th><th>Lage</th><th>ab Stirnwand</th><th>Höhe</th><th>kg</th></tr></thead>
      <tbody>${rows.map(it => `<tr>
        <td>${result.sequence.get(it.id)}</td><td>${esc(it.c.name)}</td><td>${esc(it.c.content)}</td>
        <td>${ORIENTATION_LABEL[it.p.orientation]}</td><td>${fmtM(it.box.x0)}</td>
        <td>${it.box.z0 > 0 ? `${Math.round(it.box.z0)} cm` : 'Boden'}</td><td>${it.c.weight}</td></tr>`).join('')}
      </tbody>
    </table>`;
  const opts = { truck, result, selectedId: null };
  renderView(root.querySelector('.p-top'), 'top', opts);
  renderView(root.querySelector('.p-side'), 'side', opts);
}
