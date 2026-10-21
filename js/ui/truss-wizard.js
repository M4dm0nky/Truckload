import { esc } from './dom.js';
import { QUICK_LENGTHS, trussProfileName } from './caseInfo.js';
import { isTruss } from '../model/geometry.js';
import { TRUSS_PROFILES, DOLLY_WIDTHS, trussDims, wagonWeight, wagonWeightFor, splitWagons, findMatchingWagon } from '../model/truss.js';
import { searchProfiles, profileById, pieceKg } from '../model/trussCatalog.js';
import { colorFor } from '../data/categories.js';
import { applyStockTarget } from '../model/material.js';
import { stockTargetHtml, readStockTarget, wireStockTarget } from './stock-target.js';

// Baut einen neuen Traversenwagen-Case-Typ für eine Stückzahl auf einem Wagen (klassische F34/
// F40-Traverse) – gleiches Schema wie die feste Vorlage T() in js/data/preset-cases.js, nur mit
// `builtin: false`, weil hier ein vom Nutzer erzeugtes Case entsteht statt einer mitgelieferten
// Vorlage. Rein funktional (keine DOM-/Store-Berührung), deshalb wie splitWagons()/wagonWeight()
// unabhängig testbar.
// `wagonW` (optional): Wagenbreite der Firma in cm, sonst die Automatik 60/80 (trussDims).
// `profile` (optional): Katalogprofil (js/model/trussCatalog.js); dann kommen Gewicht (wagonWeightFor),
// Name (Hersteller + Profil) und `truss.profileId` aus dem Katalog. Ohne Profil alles wie bisher.
export function buildWagonCaseType(id, profileName, length, width, count, wagonW, profile) {
  const truss = { length, width, count, ...(wagonW != null ? { wagonW } : {}), ...(profile ? { profileId: profile.id } : {}) };
  const { l, w, h } = trussDims(truss);
  const weight = profile ? wagonWeightFor(profile, length, count) : wagonWeight(length, width, count);
  const lengthLabel = (length / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  const label = profile ? `${profile.hersteller} ${profile.name}` : profileName;
  const name = `Traversenwagen ${label} ${lengthLabel} m (${count} Stück)`;
  return {
    id, builtin: false, name, content: '', category: 'Rigging', color: colorFor('Rigging'),
    l, w, h, weight, tippable: false, stackable: true, maxTopLoad: null, stock: null, wheelH: 0,
    kind: 'truss', truss, layers: [1, 2],
  };
}

// --- Reine Bausteine für die Profilsuche im Dialog (ohne DOM, einzeln testbar) ---
export const punkteLabel = n => `${n}-Punkt`;

export function originText(art, vergleichId) {
  if (art === 'hersteller') return 'Herstellerangabe';
  if (art === 'berechnet') return 'aus Metergewicht berechnet';
  const v = vergleichId ? profileById(vergleichId) : null;
  return v ? `geschätzt (Vergleich: ${v.hersteller} ${v.name})` : 'geschätzt';
}

// Längen-Tasten eines Profils: { cm, label: „3,5 m · 23 kg“, title: Herkunft }.
export function lengthButtons(profile) {
  return (profile?.lengths ?? []).map(l => {
    const m = (l.cm / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 });
    const kg = l.kg > 0 ? `${l.kg.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg` : 'Gewicht unbekannt';
    return { cm: l.cm, label: `${m} m · ${kg}`, title: originText(l.art, l.vergleich) };
  });
}

export function profileHitLabel(p) {
  return `${p.name} · ${p.hersteller} · ${punkteLabel(p.punkte)} · ${p.width} cm`;
}

// Trefferliste als HTML; alle Katalogtexte über esc(). Leere Liste → Hinweis.
export function profileHitsHtml(profiles) {
  if (!profiles.length) return '<p class="hint">Kein Profil gefunden.</p>';
  return profiles.map(p =>
    `<button type="button" class="quick-len profile-hit" data-id="${esc(p.id)}">${esc(profileHitLabel(p))}</button>`).join('');
}

export function lengthButtonsHtml(profile) {
  return lengthButtons(profile).map(b =>
    `<button type="button" class="quick-len" data-len="${b.cm}" title="${esc(b.title)}">${esc(b.label)}</button>`).join('');
}

// Kleinste zulässige Länge im Längenfeld: 50 cm, mit Katalogprofil die kürzeste Katalog-Länge
// (mindestens 10 cm), damit Tasten wie „0,25 m“ nicht an min="50" scheitern.
export function minLengthFor(profile) {
  const cms = (profile?.lengths ?? []).map(l => l.cm).filter(c => c > 0);
  return cms.length ? Math.max(10, Math.min(50, ...cms)) : 50;
}

// Herkunft des Gewichts für die gewählte Länge ('' ohne Profil).
export function profileOriginLine(profile, lengthCm) {
  if (!profile || !(lengthCm > 0)) return '';
  const hit = profile.lengths.find(l => l.cm === lengthCm);
  return `Gewicht: ${originText(hit ? hit.art : pieceKg(profile, lengthCm).art, hit?.vergleich)}`;
}

// Gruppiert die stehenden Pre-Rig-Presets (truss.standing === true) nach Hersteller/Modell für
// die <optgroup>-Einteilung im Dropdown. Presetnamen folgen durchgehend dem Schema
// „Traversenwagen <Modell> <Länge> m – <Hersteller>“ (js/data/preset-cases.js, MLT()); ein Name
// außerhalb des Schemas landet in einer Sammelgruppe statt den Dialog zum Absturz zu bringen.
function groupPrerigCases(cases) {
  const groups = new Map();
  for (const c of cases) {
    const m = c.name.match(/^Traversenwagen (.+?) ([\d,]+\s*m) – (.+)$/);
    const groupLabel = m ? `${m[3]} ${m[1]}` : 'Sonstige';
    const optionLabel = m ? m[2] : c.name;
    if (!groups.has(groupLabel)) groups.set(groupLabel, []);
    groups.get(groupLabel).push({ id: c.id, label: optionLabel });
  }
  return groups;
}

// Warum der Klassisch-Zweig nicht hinzugefügt werden kann ('' = geht). Dieselben Prüfungen wie beim
// Anlegen (splitWagons, trussDims), damit ein gesperrter „Hinzufügen“-Knopf nie ohne Grund bleibt.
export function classicSubmitError({ total, perWagon, width, wagonW }) {
  try {
    splitWagons(total, perWagon);
    trussDims({ length: 1, width, count: 1, wagonW });
    return '';
  } catch (err) { return err.message; }
}

// opts: { cases, onNewTruss(caseType) }
// Ergebnis: { newCases: Case[], additions: [{ caseId, n }], gestapelt } oder null bei Abbruch.
// `newCases` sind über `onNewTruss` bereits gespeicherte, neue Case-Typen (klassischer Zweig) –
// der Aufrufer (load-wizard.js) muss sie nur noch in seine lokale Case-Liste übernehmen.
export function openTrussDialog(dlg, opts = {}) {
  // Gleiche Absicherung wie in case-editor.js: ein noch offener Dialog darf nicht durch
  // `innerHTML = …` unter dem eigenen `close`-Listener weggezogen werden.
  if (dlg.open) { dlg.returnValue = 'cancel'; dlg.close(); }
  const stock = opts.stock ?? { mode: 'fixed', company: '' };
  const prerigCases = (opts.cases ?? []).filter(c => isTruss(c) && c.truss.standing === true);
  const groups = groupPrerigCases(prerigCases);
  const presetOptionsHtml = [...groups.entries()].map(([label, list]) =>
    `<optgroup label="${esc(label)}">${list.map(o => `<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('')}</optgroup>`
  ).join('');

  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>Traverse hinzufügen</h2>
      <div class="row kind-switch">
        <label><input type="radio" name="kind" value="classic" checked> Klassische Traverse (F34/F40)</label>
        <label><input type="radio" name="kind" value="prerig"> Pre-Rig-Traverse (MLT/S36PR)</label>
      </div>
      <fieldset class="classic-only"><legend>Klassischer Wagen</legend>
        <label>Profil suchen (z. B. FD34)<input type="search" name="profileSearch" autocomplete="off"></label>
        <div class="row quick-lengths profile-hits"></div>
        <p class="hint profile-chosen" hidden><span class="profile-chosen-text"></span> <button type="button" class="quick-len profile-clear">Auswahl aufheben</button></p>
        <label class="profile-select">Profil<select name="profile">${TRUSS_PROFILES.map(p => `<option value="${p.width}">${esc(p.name)}</option>`).join('')}</select></label>
        <label>Länge (cm)<input type="number" name="trussLength" min="50" max="1000" step="1" required></label>
        <div class="row quick-lengths length-buttons">${QUICK_LENGTHS.map(n => `<button type="button" class="quick-len" data-len="${n}">${n}</button>`).join('')}</div>
        <p class="hint length-origin"></p>
        <label>Wagenbreite (cm)<input type="number" name="wagonW" min="20" max="200" step="1" required></label>
        <p class="hint">Wagen unterscheiden sich je Sammlung – die Breite hier an den echten Wagen anpassen.</p>
        <div class="row">
          <label>Gesamtstückzahl<input type="number" name="total" min="1" step="1" required></label>
          <label>Stück pro Wagen<input type="number" name="perWagon" min="1" max="12" step="1" required></label>
        </div>
        <p class="hint wagons-hint"></p>
        <p class="hint form-error" role="alert" hidden></p>
        ${stockTargetHtml(stock)}
      </fieldset>
      <fieldset class="prerig-only" hidden><legend>Pre-Rig-Traverse</legend>
        ${prerigCases.length
          ? `<label>Modell<select name="preset">${presetOptionsHtml}</select></label>
             <label>Gesamtstückzahl<input type="number" name="prerigTotal" min="1" step="1" required></label>
             <label class="check"><input type="checkbox" name="gestapelt" checked> gestapelt</label>
             <p class="hint">Zwei Einheiten werden beim Packen automatisch übereinandergestellt, wenn das Platz spart.</p>`
          : '<p class="hint">Keine Pre-Rig-Vorlagen verfügbar.</p>'}
      </fieldset>
      <menu>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <span class="grow"></span>
        <button value="save" class="primary">Hinzufügen</button>
      </menu>
    </form>`;

  const form = dlg.querySelector('form');
  const f = form.elements;
  wireStockTarget(form, stock?.collections ?? []);
  const kindInputs = [...dlg.querySelectorAll('input[name="kind"]')];
  const classicOnly = dlg.querySelector('.classic-only');
  const prerigOnly = dlg.querySelector('.prerig-only');
  const wagonsHint = dlg.querySelector('.wagons-hint');

  function applyKind(kind) {
    const isPrerig = kind === 'prerig';
    classicOnly.hidden = isPrerig;
    prerigOnly.hidden = !isPrerig;
    f.trussLength.required = !isPrerig; f.total.required = !isPrerig; f.perWagon.required = !isPrerig;
    f.wagonW.required = !isPrerig; f.wagonW.disabled = isPrerig;
    f.trussLength.disabled = isPrerig; f.total.disabled = isPrerig; f.perWagon.disabled = isPrerig; f.profile.disabled = isPrerig; f.profileSearch.disabled = isPrerig;
    if (f.preset) f.preset.disabled = !isPrerig;
    if (f.prerigTotal) { f.prerigTotal.required = isPrerig; f.prerigTotal.disabled = !isPrerig; }
  }
  for (const r of kindInputs) r.addEventListener('change', () => applyKind(r.value));
  applyKind('classic');

  function updateWagonsHint() {
    const total = Number(f.total.value), perWagon = Number(f.perWagon.value);
    try {
      const n = splitWagons(total, perWagon).length;
      wagonsHint.textContent = `→ ${n} Wagen`;
    } catch {
      wagonsHint.textContent = '';
    }
  }
  for (const name of ['total', 'perWagon']) f[name].addEventListener('input', updateWagonsHint);
  // Vorbelegung = bisherige Automatik (2 Stück nebeneinander: bis 60 cm → 60, sonst 80); folgt dem
  // Profil, solange der Nutzer die Breite nicht selbst geändert hat.
  let wagonWTouched = false;
  let chosen = null; // gewähltes Katalogprofil; null = die zwei festen Profile (34er/40er)
  const curWidth = () => (chosen ? chosen.width : Number(f.profile.value));
  const autoWagonW = () => (2 * curWidth() <= DOLLY_WIDTHS[0] ? DOLLY_WIDTHS[0] : DOLLY_WIDTHS[1]);
  f.wagonW.value = autoWagonW();
  f.wagonW.addEventListener('input', () => { wagonWTouched = true; });
  f.profile.addEventListener('change', () => { if (!wagonWTouched) f.wagonW.value = autoWagonW(); });
  const lengthBox = dlg.querySelector('.length-buttons');
  const originEl = dlg.querySelector('.length-origin');
  const hitsBox = dlg.querySelector('.profile-hits');
  const chosenEl = dlg.querySelector('.profile-chosen');
  const defaultLengthsHtml = lengthBox.innerHTML;
  const updateOrigin = () => { originEl.textContent = profileOriginLine(chosen, Number(f.trussLength.value)); };
  lengthBox.addEventListener('click', e => {
    const btn = e.target.closest('.quick-len');
    if (!btn) return;
    f.trussLength.value = btn.dataset.len;
    updateOrigin();
  });
  f.trussLength.addEventListener('input', updateOrigin);
  function setProfile(p) {
    chosen = p;
    f.trussLength.min = minLengthFor(p);
    dlg.querySelector('.profile-select').hidden = !!p;
    chosenEl.hidden = !p;
    if (p) chosenEl.querySelector('.profile-chosen-text').textContent = `Gewählt: ${profileHitLabel(p)}`;
    lengthBox.innerHTML = p ? lengthButtonsHtml(p) : defaultLengthsHtml;
    hitsBox.innerHTML = '';
    if (!wagonWTouched) f.wagonW.value = autoWagonW();
    updateOrigin();
  }
  f.profileSearch.addEventListener('input', () => {
    const q = f.profileSearch.value.trim();
    hitsBox.innerHTML = q ? profileHitsHtml(searchProfiles(q)) : '';
  });
  f.profileSearch.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
  hitsBox.addEventListener('click', e => {
    const btn = e.target.closest('.profile-hit');
    const p = btn && profileById(btn.dataset.id);
    if (p) { setProfile(p); f.profileSearch.value = ''; }
  });
  dlg.querySelector('.profile-clear').addEventListener('click', () => setProfile(null));

  form.addEventListener('submit', e => {
    const act = e.submitter?.value;
    if (act !== 'save') return;
    const kind = kindInputs.find(r => r.checked)?.value ?? 'classic';
    if (kind === 'classic') {
      const msg = classicSubmitError({ total: Number(f.total.value), perWagon: Number(f.perWagon.value), width: curWidth(), wagonW: Number(f.wagonW.value) });
      const box = dlg.querySelector('.form-error');
      box.textContent = msg;
      box.hidden = !msg;
      if (msg) e.preventDefault();
    } else if (!prerigCases.length) {
      e.preventDefault();
    }
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', async () => {
      const act = dlg.returnValue;
      if (act !== 'save') return resolve(null);
      const kind = kindInputs.find(r => r.checked)?.value ?? 'classic';
      if (kind === 'classic') {
        const profile = chosen;
        const width = curWidth();
        const profileName = trussProfileName(width);
        const length = Number(f.trussLength.value);
        let wagons;
        try { wagons = splitWagons(Number(f.total.value), Number(f.perWagon.value)); }
        catch { return resolve(null); }
        const distinct = [...new Set(wagons)];
        const target = readStockTarget(form, stock);
        const newCases = [];
        const additions = [];
        for (const n of distinct) {
          const count = wagons.filter(x => x === n).length;
          // Vorhandenen passenden Wagen-Typ nehmen statt einen zweiten anzulegen (findMatchingWagon).
          const wagonW = Number(f.wagonW.value);
          const existing = findMatchingWagon(opts.cases ?? [], { width, length, count: n, wagonW, company: target.company, inStock: target.inStock, profileId: profile?.id });
          if (existing) { additions.push({ caseId: existing.id, n: count }); continue; }
          const caseType = applyStockTarget(
            buildWagonCaseType(crypto.randomUUID(), profileName, length, width, n, wagonW, profile),
            target);
          const saved = await opts.onNewTruss?.(caseType);
          if (!saved) continue;
          newCases.push(saved);
          additions.push({ caseId: saved.id, n: count });
        }
        resolve(additions.length ? { newCases, additions, gestapelt: false } : null);
      } else {
        if (!prerigCases.length) return resolve(null);
        const presetId = f.preset.value;
        const n = Number(f.prerigTotal.value);
        if (!presetId || !(n > 0)) return resolve(null);
        resolve({ newCases: [], additions: [{ caseId: presetId, n }], gestapelt: f.gestapelt.checked });
      }
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
