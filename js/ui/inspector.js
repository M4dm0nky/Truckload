import { esc, fmtM, ORIENTATION_LABEL, swatch } from './dom.js';
import { outerDims, wheelFace, layersOf, pieceLayers } from '../model/geometry.js';
import { MAX_LABEL } from '../model/geometry.js';
import { canTip } from '../model/truss.js';

// Reihenfolge und Beschriftung der Rollenrichtungs-Knöpfe. Koordinaten: x wächst zur Trucktür
// (+x = Tür, -x = Front); die Seitenansicht zeigt die y0-Seite (kleines y) als „links“, die
// gegenüberliegende (großes y) als „rechts“ (siehe js/ui/projection.js / view2d.js).
const WHEEL_FACE_ORDER = ['+x', '-x', '-y', '+y'];
const WHEEL_FACE_LABEL = { '+x': 'Tür', '-x': 'Front', '-y': 'links', '+y': 'rechts' };

// Block „Laden“ – für ein platziertes Stück (piece = das Placement, tippedOn aus der
// Orientierung) genauso wie für ein Ablage-Stück (piece = der Ablage-Eintrag, tippedOn aus
// `tipped ?? canTip(c)`) – Optik/Klassen wie im Wizard (js/ui/load-wizard.js), damit das
// Häkchen-Verhalten (letzte Lage nicht abwählbar) demselben Muster folgt.
function loadBlock(piece, c, tippedOn) {
  const allowed = layersOf(c);
  const layers = pieceLayers(piece, c);
  const tippable = canTip(c);
  return `
    <div class="insp-load">
      <span class="wiz-layers">
        <span class="wiz-layers-label">Lage</span>
        ${[1, 2, 3, 4].map(n => `<label class="check"><input type="checkbox" data-layer="${n}" ${layers.includes(n) ? 'checked' : ''} ${allowed.includes(n) ? '' : 'disabled'}>${n}</label>`).join('')}
      </span>
      <label class="check wiz-tipped"><input type="checkbox" name="tipped" ${tippedOn ? 'checked' : ''} ${tippable ? '' : 'disabled'}>getippt</label>
      <small class="hint wiz-layer-hint" hidden>Mindestens eine Lage nötig.</small>
    </div>`;
}

export function renderInspector(el, { selected, selectedUnplaced, result, truck }) {
  const t = result.totals;
  const pct = Math.min(100, Math.round(t.weight / t.payload * 100));
  const tipped = selected && selected.p.orientation !== 'standing';
  const wheelRow = tipped ? `
      <div class="insp-wheels">
        <span class="hint">Rollen zeigen nach:</span>
        <div class="btns">
          ${WHEEL_FACE_ORDER.map(face => {
            const active = wheelFace(selected.p) === face;
            return `<button data-act="wheel-face" data-face="${face}" class="${active ? 'on' : ''}">${WHEEL_FACE_LABEL[face]}</button>`;
          }).join('')}
        </div>
      </div>` : '';
  const dims = selected ? outerDims(selected.c) : null;
  const sel = selected ? `
    <section class="insp-sel" data-id="${esc(selected.id)}">
      <h2>${swatch(selected.color)}${result.sequence.get(selected.id)}. ${esc(selected.label)}</h2>
      ${selected.c.content ? `<p class="content">${esc(selected.c.content)}</p>` : ''}
      <div class="insp-label">
        <label>Beschriftung<input type="text" name="label" maxlength="${MAX_LABEL}" value="${esc(selected.label)}"></label>
        <label>Farbe<input type="color" name="color" value="${esc(selected.color)}"></label>
      </div>
      <dl>
        <dt>Lage</dt><dd>${ORIENTATION_LABEL[selected.p.orientation]}, ${esc(selected.p.rot)}° · Lage ${esc(result.layers.get(selected.id))}</dd>
        <dt>Maße stehend</dt><dd>${dims.l}×${dims.w}×${dims.h} cm</dd>
        <dt>Position</dt><dd>${fmtM(selected.box.x0)} ab Stirnwand · y ${Math.round(selected.box.y0)} · z ${Math.round(selected.box.z0)} cm</dd>
        <dt>Gewicht</dt><dd>${selected.c.weight} kg · Last obendrauf ${Math.round(result.load.get(selected.id) ?? 0)} kg${selected.c.maxTopLoad != null ? ` / max. ${esc(selected.c.maxTopLoad)}` : ''}</dd>
      </dl>
      ${wheelRow}
      ${loadBlock(selected.p, selected.c, tipped)}
      <div class="btns">
        <button data-act="rotate">Drehen <kbd>R</kbd></button>
        <!-- Truthy-Check statt canTip(c) (js/model/truss.js) — bewusst, s. Kommentar an der
             canTip-Definition: checkCase/normalizeCase erzwingen an jeder Entstehungsstelle
             bereits einen echten Boolean, Truthy und canTip liefern hier also dasselbe. -->
        <button data-act="tip" ${selected.c.tippable ? '' : 'disabled title="Case ist nicht tippbar"'}>Tippen <kbd>T</kbd></button>
        <button data-act="dup">Duplizieren <kbd>D</kbd></button>
        <button data-act="tray">In Ablage</button>
        <button data-act="edit-case">Case bearbeiten</button>
        <button data-act="delete" class="danger">Entfernen <kbd>Entf</kbd></button>
      </div>
      ${(result.byPlacement.get(selected.id) ?? []).map(i => `<p class="issue">${esc(i.message)}</p>`).join('')}
    </section>` : (selectedUnplaced ? `
    <section class="insp-sel insp-unplaced" data-id="${esc(selectedUnplaced.id)}">
      <h2>${swatch(selectedUnplaced.color)}${esc(selectedUnplaced.label)}</h2>
      <p class="hint">Noch nicht geladen</p>
      <div class="insp-label">
        <label>Beschriftung<input type="text" name="label" maxlength="${MAX_LABEL}" value="${esc(selectedUnplaced.label)}"></label>
        <label>Farbe<input type="color" name="color" value="${esc(selectedUnplaced.color)}"></label>
      </div>
      ${loadBlock(selectedUnplaced.item, selectedUnplaced.c, selectedUnplaced.item.tipped ?? canTip(selectedUnplaced.c))}
      <div class="btns">
        <button data-act="edit-case">Case bearbeiten</button>
        <button data-act="delete" class="danger">Entfernen</button>
      </div>
    </section>` : '<p class="hint">Case anklicken, um es zu bearbeiten. Ziehen verschiebt, Stapel wandern mit.</p>');

  el.innerHTML = `${sel}
    <section class="insp-totals">
      <h3>Ladung – ${esc(truck.name)}</h3>
      <div class="bar ${t.weight > t.payload ? 'over' : ''}"><span style="width:${pct}%"></span></div>
      <p>${Math.round(t.weight).toLocaleString('de-DE')} / ${t.payload.toLocaleString('de-DE')} kg Nutzlast${t.withoutWeight ? ` · <span class="hint">${t.withoutWeight} Case${t.withoutWeight === 1 ? '' : 's'} ohne Gewicht – die Nutzlast oben ist unvollständig</span>` : ''}</p>
      <dl>
        <dt>Cases</dt><dd>${t.count}</dd>
        <dt>Lademeter</dt><dd>${fmtM(t.loadMeters * 100)} von ${fmtM(truck.l)}</dd>
        <dt>Volumen</dt><dd>${Math.round(t.volumeRatio * 100)} %</dd>
        <dt>Schwerpunkt</dt><dd>${t.cog ? `${fmtM(t.cog.x)} ab Stirnwand, ${Math.round(t.cog.y - truck.w / 2)} cm aus der Mitte${t.cog.source === 'volume' ? ' (ersatzweise über das Volumen geschätzt: Cases ohne Gewicht zählen dabei wie voll beladen)' : ''}` : '–'}</dd>
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
