import { APP_VERSION } from '../version.js';
import { ORIENTATIONS, ROTATIONS, ARCH_SIDES, isTruss } from '../model/geometry.js';
import { CASE_LIMITS, TRUSS_LIMITS, MAX_LABEL, MAX_FIRM, MAX_RULESET_NAME, NAME_MAX, COORD_MAX, MAX_LKW, layersValid } from '../model/limits.js';
import { trussDims } from '../model/truss.js';
import { PRESET_TRUCKS } from '../data/preset-trucks.js';
import { CASE_LIBRARY } from '../data/case-library.js';
import { PRESET_CASES } from '../data/preset-cases.js';
import { upgradeDollyStack, dollyName } from '../model/audioDolly.js';
import { pickPieceFields } from '../model/pieceFields.js';
import { ruleOk, MAX_RULES, PACK_ORDERS } from '../model/packRules.js';

// FORMAT/VERSION werden nur hier benutzt (Import- und Export-Prüfung derselben Datei).
const FORMAT = 'truckload';
const VERSION = 1;
const CASE_KINDS = ['case', 'truss', 'speaker'];

const num = v => typeof v === 'number' && Number.isFinite(v);
const arr = v => (Array.isArray(v) ? v : []);
// Mitgeliefertes nie aus fremden Dateien übernehmen. `preset-` (Standardkatalog, nur lesbar)
// immer verwerfen; `lib-` (Firmen-Vorlagen) nur, wenn als mitgeliefert markiert – eigene
// Überlagerungen mit gleicher lib-ID sind gewollt (Materialverwaltung).
const isPreset = x => !!x?.builtin || (typeof x?.id === 'string' && x.id.startsWith('preset-'));
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const colorOk = x => x.color === undefined || COLOR_RE.test(x.color);
const updatedAtOk = x => x.updatedAt === undefined || typeof x.updatedAt === 'string';

const nameTooLong = (kind, x) => x.name.length > NAME_MAX
  && new Error(`${kind} „${x.name.slice(0, 20)}…“: Name zu lang (höchstens ${NAME_MAX} Zeichen).`);

// Gewicht, Auflast und Bestand über CASE_LIMITS lehnen den Import NICHT ab (eigene Entscheidung:
// ein schweres Spezialcase soll die ganze Sicherung nicht unlesbar machen). Der Wert bleibt
// unverändert, parseBundle meldet ihn in `overLimit`; im Editor gilt die Grenze weiterhin.
const SOFT_LIMITED = ['weight', 'maxTopLoad', 'stock'];
const softOk = (v, nullable) => (nullable && v == null) || (num(v) && v >= 0);
function overLimit(c) {
  return SOFT_LIMITED.filter(k => num(c[k]) && c[k] > CASE_LIMITS[k])
    .map(field => ({ id: c.id, name: c.name, field, value: c[field], max: CASE_LIMITS[field] }));
}

export function checkCase(c) {
  if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Case ohne ID oder Name in der Datei.');
  const tooLong = nameTooLong('Case', c);
  if (tooLong) throw tooLong;
  for (const k of ['l', 'w', 'h']) if (!num(c[k]) || c[k] <= 0 || c[k] > CASE_LIMITS[k]) throw new Error(`Case „${c.name}“ hat ungültige Maße.`);
  if (!softOk(c.weight, false)) throw new Error(`Case „${c.name}“ hat ein ungültiges Gewicht.`);
  if (!colorOk(c)) throw new Error(`Case „${c.name}“ hat eine ungültige Farbe.`);
  if (!updatedAtOk(c)) throw new Error(`Case „${c.name}“ hat einen ungültigen Zeitstempel.`);
  const wheelHOk = c.wheelH == null || (num(c.wheelH) && c.wheelH >= 0 && c.wheelH <= CASE_LIMITS.wheelH
    && (c.dimsInclWheels === false || c.wheelH < c.h));
  const layersOk = c.layers == null || layersValid(c.layers);
  const kindOk = c.kind == null || CASE_KINDS.includes(c.kind);
  const propsOk = softOk(c.maxTopLoad, true) && softOk(c.stock, true)
    && (c.tippable === undefined || typeof c.tippable === 'boolean')
    && (c.stackable === undefined || typeof c.stackable === 'boolean')
    && (c.wheels === undefined || typeof c.wheels === 'boolean')
    && (c.dimsInclWheels === undefined || typeof c.dimsInclWheels === 'boolean')
    && (c.company === undefined || (typeof c.company === 'string' && c.company.length <= MAX_FIRM))
    && (c.legacy === undefined || typeof c.legacy === 'boolean')
    && (c.onlyInPlan === undefined || typeof c.onlyInPlan === 'boolean')
    && wheelHOk && layersOk && kindOk;
  if (!propsOk) throw new Error(`Case „${c.name}“ hat ungültige Eigenschaften.`);
  if (isTruss(c)) {
    const t = c.truss;
    // standing: true (Pre-Rig-Traversen wie H.O.F. MLT/Prolyte S36PR) sind EIN stehendes Stück,
    // width meint dort die Standfläche (bis TRUSS_LIMITS.standingWidth, s. STAND_FOOTPRINT_W in
    // truss.js), nicht den Wagen-Querschnitt (max. TRUSS_LIMITS.width) der stapelnden F34/F40-
    // Variante. Brauchen zusätzlich height.
    const standing = t?.standing === true;
    const trussOk = t
      && num(t.length) && t.length >= 1 && t.length <= TRUSS_LIMITS.length
      && num(t.width) && t.width >= 1 && t.width <= (standing ? TRUSS_LIMITS.standingWidth : TRUSS_LIMITS.width)
      && Number.isInteger(t.count) && t.count >= 1 && t.count <= TRUSS_LIMITS.count
      && (t.wagonW === undefined || (num(t.wagonW) && t.wagonW >= 2 * t.width && t.wagonW <= TRUSS_LIMITS.wagonW))
      && (t.standing === undefined || typeof t.standing === 'boolean')
      && (!standing || (num(t.height) && t.height >= 1 && t.height <= CASE_LIMITS.h))
      && c.tippable !== true;
    if (!trussOk) throw new Error(`Case „${c.name}“ hat ungültige Traversenwagen-Werte.`);
  }
}
// `legacy` (ausgeblendet) gilt nur für Überlagerungen von Firmen-Vorlagen (`lib-`). Frühere
// Versionen des Case-Editors kopierten das Feld in neue Kopien ausgeblendeter Vorlagen (eigene
// UUID); solche Cases wären in der Materialverwaltung nirgends mehr zu finden. Beim Laden und
// Import fällt das Feld dort deshalb weg; Maße und alle anderen Felder bleiben unverändert.
export function dropStrayLegacy(c) {
  if (c?.builtin || !('legacy' in (c ?? {})) || (typeof c.id === 'string' && c.id.startsWith('lib-'))) return c;
  const { legacy, ...rest } = c;
  return rest;
}
export function normalizeCase(c) {
  // Dolly-Stacks früherer Versionen bekommen ihre Darstellungsfelder nach (upgradeDollyStack() in
  // js/model/audioDolly.js) – beim Laden UND beim Datei-Import.
  if (!isTruss(c)) return upgradeDollyStack(c, PRESET_CASES);
  // trussDims() wirft, wenn c.truss.width die Grenze (MAX_TRUSS_WIDTH) überschreitet. Beim Import
  // ist das nicht erreichbar (checkCase() lehnt die Breite vorher ab), aber repo.normalizeOwnCases()
  // ruft normalizeCase() beim Laden für JEDES eigene Case ohne checkCase() auf. Ein vor der Grenze
  // gespeichertes Case darf dort nicht werfen (das leerte stillschweigend die eigene Bibliothek);
  // seine gespeicherten Maße bleiben dann unverändert.
  try {
    const { l, w, h } = trussDims(c.truss);
    return { ...c, l, w, h, wheelH: 0, tippable: false };
  } catch {
    return { ...c, wheelH: 0, tippable: false };
  }
}
function checkArch(a) {
  return a && num(a.x) && a.x >= 0 && num(a.l) && a.l > 0 && num(a.w) && a.w > 0 && num(a.h) && a.h > 0
    && ARCH_SIDES.includes(a.side);
}
export function checkTruck(t) {
  if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Fahrzeug ohne ID oder Name in der Datei.');
  const tooLong = nameTooLong('Fahrzeug', t);
  if (tooLong) throw tooLong;
  for (const k of ['l', 'w', 'h', 'payload']) if (!num(t[k]) || t[k] <= 0) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Werte.`);
  if (!updatedAtOk(t)) throw new Error(`Fahrzeug „${t.name}“ hat einen ungültigen Zeitstempel.`);
  if (t.wheelArches != null && !Array.isArray(t.wheelArches)) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Radkästen.`);
  if (!arr(t.wheelArches ?? []).every(checkArch)) throw new Error(`Fahrzeug „${t.name}“ hat ungültige Radkästen.`);
}
const labelOk = x => x.label === undefined || (typeof x.label === 'string' && x.label.length <= MAX_LABEL);
// Stück-eigene layers: dieselbe Prüfung wie layersOk für Case-Typen (checkCase oben), nur
// hier auf einem Placement/Ablage-Eintrag statt auf einem Case.
const pieceLayersOk = x => x.layers === undefined || layersValid(x.layers);
const tippedOk = x => x.tipped === undefined || typeof x.tipped === 'boolean';
const groupOk = x => x.group === undefined || (typeof x.group === 'string' && x.group.trim().length > 0 && x.group.length <= MAX_LABEL);
const lkwRefOk = x => x.lkw === undefined || typeof x.lkw === 'string';
const rulesOk = r => Array.isArray(r) && r.length <= MAX_RULES && r.every(ruleOk);
// Mehrere LKW in einem Plan (V 0.14): `lkws` fehlt (Ein-LKW-Plan) oder ist eine Liste von höchstens
// MAX_LKW Objekten mit eindeutiger id, Name, Fahrzeug-ID und Gewerke-Liste. Gewerke werden hier nur
// als Strings geprüft (ein später entferntes Gewerk soll die Datei nicht unlesbar machen).
// Feste Schranke gegen feindliche Größen; bewusst NICHT an CATEGORIES gebunden, damit ein später
// entferntes Gewerk keine Datei unlesbar macht.
const MAX_LKW_CATEGORIES = 32;
function checkLkws(p) {
  if (p.lkws === undefined || p.lkws === null) return; // null = fehlendes Feld
  const bad = () => new Error(`Ladeplan „${p.name}“ hat ungültige LKW.`);
  if (!Array.isArray(p.lkws) || p.lkws.length > MAX_LKW) throw bad();
  for (const l of p.lkws) {
    if (!l || typeof l.id !== 'string' || typeof l.name !== 'string' || typeof l.truckId !== 'string'
      || !Array.isArray(l.categories) || l.categories.length > MAX_LKW_CATEGORIES
      || !l.categories.every(c => typeof c === 'string' && c.length <= MAX_LABEL)) throw bad();
    const tooLong = nameTooLong('LKW', l);
    if (tooLong) throw tooLong;
  }
  const lkwIds = p.lkws.map(l => l.id);
  if (new Set(lkwIds).size !== lkwIds.length) throw new Error(`Ladeplan „${p.name}“ enthält doppelte LKW-IDs.`);
}
export function checkPlan(p) {
  if (!p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.placements) || typeof p.truckId !== 'string')
    throw new Error('Ungültiger Ladeplan in der Datei.');
  const tooLong = nameTooLong('Ladeplan', p);
  if (tooLong) throw tooLong;
  if (!updatedAtOk(p)) throw new Error(`Ladeplan „${p.name}“ hat einen ungültigen Zeitstempel.`);
  if (p.notes !== undefined && (typeof p.notes !== 'string' || p.notes.length > 2000))
    throw new Error(`Ladeplan „${p.name}“ hat ungültige Notizen.`);
  if (p.packOrder !== undefined && !PACK_ORDERS.includes(p.packOrder))
    throw new Error(`Ladeplan „${p.name}“ hat eine unbekannte Pack-Reihenfolge.`);
  if (p.packRules !== undefined && !rulesOk(p.packRules))
    throw new Error(`Ladeplan „${p.name}“ hat ungültige Pack-Regeln.`);
  if (p.mixTop !== undefined && typeof p.mixTop !== 'boolean')
    throw new Error(`Ladeplan „${p.name}“ hat einen ungültigen Deckschicht-Schalter.`);
  checkLkws(p);
  const placementOk = pl => pl && typeof pl.id === 'string' && typeof pl.caseId === 'string'
    && ORIENTATIONS.includes(pl.orientation) && ROTATIONS.includes(pl.rot)
    && num(pl.x) && num(pl.y) && num(pl.z) && labelOk(pl) && colorOk(pl)
    && pieceLayersOk(pl) && tippedOk(pl) && groupOk(pl) && lkwRefOk(pl);
  const unplacedOk = u => u && typeof u.id === 'string' && typeof u.caseId === 'string' && labelOk(u) && colorOk(u)
    && pieceLayersOk(u) && tippedOk(u) && groupOk(u) && lkwRefOk(u);
  if (!p.placements.every(placementOk) || !arr(p.unplaced).every(unplacedOk))
    throw new Error(`Ladeplan „${p.name}“ enthält ungültige Platzierungen.`);
  const pieceIds = [...p.placements, ...arr(p.unplaced)].map(x => x.id);
  if (new Set(pieceIds).size !== pieceIds.length)
    throw new Error(`Ladeplan „${p.name}“ enthält doppelte Stück-IDs.`);
}

export function checkRuleSet(rs) {
  const name = typeof rs?.name === 'string' ? rs.name : '';
  if (!rs || typeof rs.id !== 'string' || !name.trim() || name.length > MAX_RULESET_NAME || !rulesOk(rs.rules) || !updatedAtOk(rs)
    || (rs.mixTop !== undefined && typeof rs.mixTop !== 'boolean'))
    throw new Error(`Regelset „${name || '?'}“ ist ungültig.`);
}

export function exportBundle({ cases, trucks, plans, ruleSets = [] }, now = new Date()) {
  return JSON.stringify({
    format: FORMAT, version: VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(),
    cases: cases.filter(c => !c.builtin), trucks: trucks.filter(t => !t.builtin), plans, ruleSets,
  }, null, 2);
}

const FIELD_LABELS = { cases: 'Cases', trucks: 'Fahrzeuge', plans: 'Ladepläne', ruleSets: 'Regelsets' };

// Zwei Werte aus älteren Wizard-/Editor-Vorgaben reißen sonst die harte Alles-oder-nichts-Grenze
// beim Import, obwohl sie reparierbar sind: eine zu lange Beschriftung (früher bis 50 Zeichen,
// MAX_LABEL ist 40) und eine Rollenhöhe, die die Case-Höhe erreicht oder übersteigt. parseBundle
// repariert genau diese zwei Fälle und zählt sie, damit der Nutzer nach dem Import erfährt, was
// angepasst wurde. Jeder andere Regelverstoß verwirft die Datei weiterhin ganz.
function repairLabel(x) {
  if (typeof x?.label !== 'string' || x.label.length <= MAX_LABEL) return null;
  return { ...x, label: x.label.slice(0, MAX_LABEL) };
}
function repairWheelH(c) {
  if (c?.wheelH == null || !num(c.wheelH) || c.wheelH < 0 || c.wheelH > CASE_LIMITS.wheelH) return null;
  if (c.dimsInclWheels === false || c.wheelH < c.h) return null;
  // Rollenhöhe erreicht/übersteigt die Case-Höhe: Rollen abwählen statt die Datei zu verwerfen;
  // ein erratener Zwischenwert wäre eine Behauptung über eine Maßangabe, die niemand nachgemessen
  // hat.
  return { ...c, wheelH: 0, wheels: false };
}

export function parseBundle(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Die Datei ist kein gültiges JSON.'); }
  if (data?.format !== FORMAT) throw new Error('Keine Truckload-Datei.');
  if (!num(data.version)) throw new Error('Die Datei hat keine gültige Versionsangabe.');
  if (data.version > VERSION) throw new Error('Die Datei stammt aus einer neueren Version.');
  for (const field of ['cases', 'trucks', 'plans', 'ruleSets']) {
    if (data[field] !== undefined && !Array.isArray(data[field]))
      throw new Error(`Das Feld „${FIELD_LABELS[field]}“ in der Datei ist beschädigt.`);
  }
  const rawCases = arr(data.cases).filter(c => !isPreset(c));
  const rawTrucks = arr(data.trucks).filter(t => !isPreset(t));
  const rawPlans = arr(data.plans).map(p => ({ ...p, unplaced: arr(p?.unplaced), notes: p?.notes ?? '' }));
  const ruleSets = arr(data.ruleSets);
  if (rawCases.length === 0 && rawTrucks.length === 0 && rawPlans.length === 0 && ruleSets.length === 0)
    throw new Error('Die Datei enthält keine Daten.');

  // Namen waren bis V 0.13.10 teils unbegrenzt (Plan umbenennen, „(Kopie)“, Dolly-Stack aus einem
  // bereits langen Namen: bis 91 Zeichen); ein zu langer Name von Ladeplan, Case oder Fahrzeug wird
  // gekürzt und gemeldet, damit die eigene alte Sicherung importierbar bleibt (eigene
  // Entscheidung). Bei Dolly-Namen bleibt der Zusatz „N er (auf Dolly)“ lesbar erhalten. Die ID
  // bleibt unverändert.
  const nameRepairs = { plan: 0, case: 0, truck: 0 };
  const cutName = (kind, name) => {
    if (typeof name !== 'string' || name.length <= NAME_MAX) return name;
    nameRepairs[kind]++;
    const dolly = kind === 'case' && /^(.*) (\d+)er \(auf Dolly\)$/.exec(name);
    return dolly ? dollyName(dolly[1], dolly[2]) : name.slice(0, NAME_MAX);
  };
  const withCutName = (kind, x) => (x && typeof x.name === 'string' && x.name.length > NAME_MAX ? { ...x, name: cutName(kind, x.name) } : x);
  const trucks = rawTrucks.map(t => withCutName('truck', t));

  let wheelHRepairs = 0;
  const cases = rawCases.map(c => {
    const fixed = repairWheelH(c);
    if (fixed) wheelHRepairs++;
    return withCutName('case', fixed ?? c);
  });
  let labelRepairs = 0;
  const repairPiece = x => {
    const fixed = repairLabel(x);
    if (fixed) labelRepairs++;
    return fixed ?? x;
  };
  // Platzierungen weit außerhalb jedes Fahrzeugs (Betrag > coordMax) kommen in die Ablage statt die
  // Datei abzulehnen: die App begrenzt Koordinaten nirgends, ein solcher Stand ist für sie
  // möglich (validatePlan warnt nur). coordMax = 2 × größte Fahrzeugabmessung (mitgelieferte und
  // die der Datei), mindestens COORD_MAX – ein langes eigenes Fahrzeug löst die Reparatur also nie
  // für legitime Positionen aus.
  const coordMax = Math.max(COORD_MAX, 2 * Math.max(0, ...trucks.flatMap(t => [t.l, t.w, t.h]).filter(num)));
  const farOut = x => x && typeof x === 'object' && ['x', 'y', 'z'].some(k => num(x[k]) && Math.abs(x[k]) > coordMax);
  const planRepairs = [];
  const movePlaced = p => {
    if (!Array.isArray(p.placements) || !p.placements.some(farOut)) return p;
    const out = p.placements.filter(farOut);
    planRepairs.push(`Ladeplan „${p.name}“: ${out.length} ${out.length === 1 ? 'Platzierung' : 'Platzierungen'} außerhalb des Fahrzeugbereichs – in die Ablage verschoben.`);
    return {
      ...p,
      placements: p.placements.filter(x => !farOut(x)),
      unplaced: [...p.unplaced, ...out.map(x => ({ id: x.id, caseId: x.caseId, ...pickPieceFields(x), ...(typeof x.lkw === 'string' ? { lkw: x.lkw } : {}) }))],
    };
  };
  // Unbekannte LKW-Verweise (`lkw` zeigt auf keinen LKW des Plans, oder der Plan hat gar keine
  // `lkws`): Feld entfernen statt die Datei abzulehnen. Eine Platzierung ohne gültigen LKW gibt es
  // nicht – sie kommt in die Ablage (nicht zugeordnet). Nicht-String-Werte bleiben stehen und
  // lehnt checkPlan ab. Stücke ganz ohne `lkw` in einem Mehr-LKW-Plan sind gültig (nicht zugeordnet).
  const fixLkwRefs = p => {
    if (!Array.isArray(p.placements)) return p; // checkPlan lehnt den Plan ab
    const known = new Set((Array.isArray(p.lkws) ? p.lkws : []).map(l => l?.id));
    const stale = x => x && typeof x.lkw === 'string' && !known.has(x.lkw);
    const multi = known.size > 0;
    const nStale = [...p.placements, ...p.unplaced].filter(stale).length;
    // Platzierungen ohne gültigen LKW: nur wo es LKW gibt und die Platzierung nicht schon (mit
    // gültigem Verweis) zugeordnet ist.
    const orphanPl = x => multi && x && typeof x === 'object' && (stale(x) || x.lkw === undefined);
    const toTray = p.placements.filter(orphanPl);
    if (nStale === 0 && toTray.length === 0) return p;
    const strip = x => (stale(x) ? (({ lkw: _d, ...rest }) => rest)(x) : x);
    const parts = [];
    if (nStale > 0) parts.push(`${nStale} ${nStale === 1 ? 'Stück' : 'Stücke'} mit unbekanntem LKW-Verweis – Zuordnung entfernt`);
    if (toTray.length > 0) parts.push(`${toTray.length} ${toTray.length === 1 ? 'Platzierung' : 'Platzierungen'} ohne LKW – in die Ablage verschoben`);
    planRepairs.push(`Ladeplan „${p.name}“: ${parts.join('; ')}.`);
    return {
      ...p,
      placements: p.placements.filter(x => !toTray.includes(x)).map(strip),
      unplaced: [...p.unplaced.map(strip), ...toTray.map(x => ({ id: x.id, caseId: x.caseId, ...pickPieceFields(x) }))],
    };
  };
  // `plan.truckId` ist bei Mehr-LKW-Plänen das Fahrzeug des ersten LKW (js/model/lkw.js). Weicht es
  // ab (fremde oder handbearbeitete Datei), wird es hier angeglichen und gemeldet (eigene
  // Entscheidung); nur wenn sich dadurch wirklich etwas ändert.
  const realignTruck = p => {
    const first = Array.isArray(p.lkws) ? p.lkws[0]?.truckId : undefined;
    if (typeof first !== 'string' || first === p.truckId) return p;
    planRepairs.push(`Ladeplan „${p.name}“: Fahrzeug des Plans an das des ersten LKW angeglichen.`);
    return { ...p, truckId: first };
  };
  const plans = rawPlans.map(movePlaced).map(fixLkwRefs).map(realignTruck).map(p => ({
    ...p,
    name: cutName('plan', p.name),
    // Sehr alte Platzierungen tragen kein `rot` (Geometrie liest es als 0); hier ausschreiben, damit
    // placementOk sie annimmt und der eigene Export wieder importierbar ist.
    placements: Array.isArray(p.placements)
      ? p.placements.map(x => repairPiece(x && typeof x === 'object' && x.rot === undefined ? { ...x, rot: 0 } : x))
      : p.placements,
    unplaced: p.unplaced.map(repairPiece),
  }));

  cases.forEach(checkCase); trucks.forEach(checkTruck); plans.forEach(checkPlan); ruleSets.forEach(checkRuleSet);
  // Doppelte IDs in derselben Liste lassen mergeById/winners still Datensätze verschlucken.
  for (const [field, list] of [['cases', cases], ['trucks', trucks], ['plans', plans], ['ruleSets', ruleSets]]) {
    const dup = list.map(x => x.id).find((id, i, ids) => ids.indexOf(id) !== i);
    if (dup !== undefined) throw new Error(`Die Datei enthält doppelte IDs bei ${FIELD_LABELS[field]} („${dup}“).`);
  }

  const knownCaseIds = new Set([...cases.map(c => c.id), ...CASE_LIBRARY.map(c => c.id), ...PRESET_CASES.map(c => c.id)]);
  const knownTruckIds = new Set([...trucks.map(t => t.id), ...PRESET_TRUCKS.map(t => t.id)]);
  // Unbekannte Verweise nur als IDs liefern: ob ein Case oder Fahrzeug wirklich fehlt, zeigt erst
  // der Abgleich mit dem lokalen Bestand nach dem Zusammenführen (js/app/importExport.js, dort
  // entsteht auch der Warntext). Ein Plan, der auf ein eigenes lokales Case verweist, das nicht
  // in der Datei steht, ist kein Fehler. `cases` führt eine ID je betroffenem Stück.
  const unknownRefs = [];
  for (const p of plans) {
    const missingCases = [...p.placements, ...p.unplaced].map(x => x.caseId).filter(id => !knownCaseIds.has(id));
    const truck = knownTruckIds.has(p.truckId) ? null : p.truckId;
    if (missingCases.length > 0 || truck !== null) unknownRefs.push({ planId: p.id, plan: p.name, cases: missingCases, truck });
  }

  const repairs = [];
  if (wheelHRepairs > 0)
    repairs.push(`${wheelHRepairs} Case${wheelHRepairs === 1 ? '' : 's'}: Rollenhöhe erreichte oder überstieg die Case-Höhe (Vorgabe bis V 0.6) – Rollenhöhe auf 0 gesetzt und Rollen abgewählt.`);
  if (labelRepairs > 0)
    repairs.push(`${labelRepairs} Beschriftung${labelRepairs === 1 ? '' : 'en'} länger als ${MAX_LABEL} Zeichen (Vorgabe bis V 0.6) – gekürzt.`);

  repairs.push(...planRepairs);
  const nameNote = (n, one, many) =>
    n > 0 && repairs.push(`${n} ${n === 1 ? one : many}: Name länger als ${NAME_MAX} Zeichen (bis V 0.13.10 unbegrenzt) – gekürzt.`);
  nameNote(nameRepairs.plan, 'Ladeplan', 'Ladepläne');
  nameNote(nameRepairs.case, 'Case', 'Cases');
  nameNote(nameRepairs.truck, 'Fahrzeug', 'Fahrzeuge');

  return { cases: cases.map(c => normalizeCase(dropStrayLegacy(c))), trucks, plans, ruleSets, unknownRefs, repairs, overLimit: cases.flatMap(overLimit) };
}

// Ein lokaler mitgelieferter Eintrag (`builtin: true`) verliert immer: Mitgeliefertes kommt nie
// aus einer Datei (parseBundle verwirft es), ein Datensatz mit derselben ID ist also eine eigene
// Überlagerung – bei Cases eine bearbeitete/ausgeblendete Firmen-Vorlage (`lib-`). Ohne diese
// Regel behielte der Vorlagen-Eintrag (ohne updatedAt) die Oberhand und die Überlagerung ginge
// beim Wiederherstellen verloren. Pläne und Regelsets haben kein `builtin` – für sie unverändert.
export function mergeById(existing, incoming) {
  const ts = x => (typeof x?.updatedAt === 'string' ? x.updatedAt : null);
  const map = new Map(existing.map(x => [x.id, x]));
  for (const x of incoming) {
    const cur = map.get(x.id);
    const bothStamped = ts(x) !== null && ts(cur) !== null;
    if (!cur || cur.builtin === true || (bothStamped && ts(x) >= ts(cur))) map.set(x.id, x);
  }
  return [...map.values()];
}

export const backupFileName = (now = new Date()) =>
  `truckload-backup-${now.toISOString().slice(0, 10)}.json`;

// Name der stillen Sicherung, die die App vor jedem Import des aktuellen Stands anlegt – wie beim
// „Sichern“-Knopf, nur kenntlich gemacht, damit er nicht mit einer bewusst erzeugten Sicherung
// verwechselt wird.
export const preImportBackupFileName = (now = new Date()) =>
  backupFileName(now).replace(/\.json$/, '-vor-import.json');
