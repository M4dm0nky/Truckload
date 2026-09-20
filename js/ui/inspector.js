import { esc, fmtM, ORIENTATION_LABEL } from './dom.js';
import { outerDims, wheelFace, rotForWheelFace } from '../model/geometry.js';

// Reihenfolge und Beschriftung der Rollenrichtungs-Knöpfe. Koordinaten: x wächst zur Trucktür
// (+x = Tür, -x = Front); die Seitenansicht zeigt die y0-Seite (kleines y) als „links“, die
// gegenüberliegende (großes y) als „rechts“ (siehe js/ui/projection.js / view2d.js).
const WHEEL_FACE_ORDER = ['+x', '-x', '-y', '+y'];
const WHEEL_FACE_LABEL = { '+x': 'Tür', '-x': 'Front', '-y': 'links', '+y': 'rechts' };

export function renderInspector(el, { selected, result, truck }) {
  const t = result.totals;
  const pct = Math.min(100, Math.round(t.weight / t.payload * 100));
  const tipped = selected && selected.p.orientation !== 'standing';
  const wheelRow = tipped ? `
      <div class="insp-wheels">
        <span class="hint">Rollen zeigen nach:</span>
        <div class="btns">
          ${WHEEL_FACE_ORDER.map(face => {
            const active = wheelFace(selected.p) === face;
            const reachable = rotForWheelFace(selected.p.orientation, face) != null;
            return `<button data-act="wheel-face" data-face="${face}" class="${active ? 'on' : ''}" ${reachable ? '' : 'disabled'}>${WHEEL_FACE_LABEL[face]}</button>`;
          }).join('')}
        </div>
      </div>` : '';
  const dims = selected ? outerDims(selected.c) : null;
  const sel = selected ? `
    <section class="insp-sel">
      <h2><span class="swatch" style="background:${esc(selected.color)}"></span>${result.sequence.get(selected.id)}. ${esc(selected.label)}</h2>
      ${selected.c.content ? `<p class="content">${esc(selected.c.content)}</p>` : ''}
      <div class="insp-label">
        <label>Beschriftung<input type="text" name="label" maxlength="40" value="${esc(selected.label)}"></label>
        <label>Farbe<input type="color" name="color" value="${esc(selected.color)}"></label>
      </div>
      <dl>
        <dt>Lage</dt><dd>${ORIENTATION_LABEL[selected.p.orientation]}, ${esc(selected.p.rot)}° · Lage ${esc(result.layers.get(selected.id))}</dd>
        <dt>Maße stehend</dt><dd>${dims.l}×${dims.w}×${dims.h} cm</dd>
        <dt>Position</dt><dd>${fmtM(selected.box.x0)} ab Stirnwand · y ${Math.round(selected.box.y0)} · z ${Math.round(selected.box.z0)} cm</dd>
        <dt>Gewicht</dt><dd>${selected.c.weight} kg · Last obendrauf ${Math.round(result.load.get(selected.id) ?? 0)} kg${selected.c.maxTopLoad != null ? ` / max. ${esc(selected.c.maxTopLoad)}` : ''}</dd>
      </dl>
      ${wheelRow}
      <div class="btns">
        <button data-act="rotate">Drehen <kbd>R</kbd></button>
        <button data-act="tip" ${selected.c.tippable ? '' : 'disabled title="Case ist nicht tippbar"'}>Tippen <kbd>T</kbd></button>
        <button data-act="dup">Duplizieren <kbd>D</kbd></button>
        <button data-act="tray">In Ablage</button>
        <button data-act="edit-case">Case bearbeiten</button>
        <button data-act="delete" class="danger">Entfernen <kbd>Entf</kbd></button>
      </div>
      ${(result.byPlacement.get(selected.id) ?? []).map(i => `<p class="issue">${esc(i.message)}</p>`).join('')}
    </section>` : '<p class="hint">Case anklicken, um es zu bearbeiten. Ziehen verschiebt, Stapel wandern mit.</p>';

  el.innerHTML = `${sel}
    <section class="insp-totals">
      <h3>Ladung – ${esc(truck.name)}</h3>
      <div class="bar ${t.weight > t.payload ? 'over' : ''}"><span style="width:${pct}%"></span></div>
      <p>${Math.round(t.weight).toLocaleString('de-DE')} / ${t.payload.toLocaleString('de-DE')} kg Nutzlast</p>
      <dl>
        <dt>Cases</dt><dd>${t.count}</dd>
        <dt>Lademeter</dt><dd>${fmtM(t.loadMeters * 100)} von ${fmtM(truck.l)}</dd>
        <dt>Volumen</dt><dd>${Math.round(t.volumeRatio * 100)} %</dd>
        <dt>Schwerpunkt</dt><dd>${t.cog ? `${fmtM(t.cog.x)} ab Stirnwand, ${Math.round(t.cog.y - truck.w / 2)} cm aus der Mitte` : '–'}</dd>
      </dl>
    </section>
    <section class="insp-issues">
      <h3>Warnungen (${result.issues.length})</h3>
      ${result.issues.map(i => `<p class="issue" ${i.placementId ? `data-select="${esc(i.placementId)}"` : ''}>${
        i.placementId && result.sequence.has(i.placementId) ? `<b>${result.sequence.get(i.placementId)}.</b> ` : ''}${esc(i.message)}</p>`).join('')
        || '<p class="ok">Alles in Ordnung.</p>'}
    </section>
    <p class="hint">Tasten: R drehen · T tippen · W Rollenrichtung · D duplizieren · Pfeile schieben (⇧ = 1 cm) · Entf entfernen · ⌘Z rückgängig</p>`;
}
