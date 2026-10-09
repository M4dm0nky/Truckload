import { esc } from './dom.js';
import { layersOf, canTip } from '../model/geometry.js';
import { NEUTRAL_COMPANY } from './caseGroups.js';
import { MAX_LABEL } from '../model/limits.js';

// Optionen der Auswahl „Suchen in“: Standardkatalog (Vorgabe), kompletter Bestand, je Firma.
export function searchInOptionsHtml(companies, selected) {
  const opt = (v, label) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(label)}</option>`;
  return opt(NEUTRAL_COMPANY, 'Standardkatalog') + opt('', 'Kompletter Bestand') + companies.map(n => opt(n, `nur ${n}`)).join('');
}
// Vorgabe-Ablageziel für neue Cases: die gewählte Firma, sonst keine.
export const stockDefaultFor = v => (v && v !== NEUTRAL_COMPANY ? v : '');

// Rückkehr aus der Materialverwaltung (Knopf „Material“ im Wizard, Nutzerwunsch 2026-10-09): die
// Auswahl bleibt, die Case-Liste kommt frisch aus dem Store. Stückzahlen von Cases, die dort
// gelöscht wurden, fallen weg – sonst zählte der Wizard Stücke ohne Case-Typ mit.
export function refreshWizardCases(counts, freshCases) {
  const ids = new Set(freshCases.map(c => c.id));
  for (const id of [...counts.keys()]) if (!ids.has(id)) counts.delete(id);
  return freshCases;
}

// Kappt eine Addition auf den im Wizard verbleibenden Platz unter MAX_ITEMS – ausgelagert, damit
// die 500er-Grenze ohne DOM testbar ist; dieselbe Regel wendet addTruss() inline an.
export function capToRoom(n, total, max) {
  return Math.max(0, Math.min(n, max - total));
}

// Reduziert ein im Wizard bearbeitetes Stück auf die Felder, die tatsächlich eine bewusste
// Einschränkung sind: `layers` nur, wenn das Stück eine ECHTE Teilmenge der vom Case-Typ
// erlaubten Lagen trägt, `tipped` nur, wenn der Case-Typ überhaupt tippbar ist. Sonst trüge
// jedes nie bewusst eingeschränkte Stück feste Werte, und eine spätere Änderung am Case-Typ
// (z. B. eine neu erlaubte Lage) käme dort nie an. Im Inspector lassen sich beide Felder je Stück
// mit derselben Reduktionsregel ändern (`A.setPieceLayers`/`A.setPieceTipped`). Die Anzeige der
// Checkboxen im Wizard bleibt unberührt (s. defaultWizardLayers), nur das gespeicherte ERGEBNIS
// wird reduziert. Die Gruppe (`group`) kommt nur, wenn der Nutzer sie getrimmt nicht leer ausfüllt.
export function reduceWizardItem(it, c) {
  const allowed = layersOf(c);
  const sameLayers = it.layers.length === allowed.length && it.layers.every(n => allowed.includes(n));
  return {
    ...(sameLayers ? {} : { layers: it.layers }),
    ...(canTip(c) ? { tipped: it.tipped } : {}),
    ...(it.group?.trim() ? { group: it.group.trim().slice(0, MAX_LABEL) } : {}),
  };
}

// Vorbelegung je Stück im Wizard: Lage 1 und 2 (soweit der Case-Typ sie erlaubt); Lage 3/4 sind
// nie vorab angehakt, sondern werden immer von Hand geklickt (Nutzerwunsch 2026-09-25) — auch
// wenn der Case-Typ weder Lage 1 noch 2 erlaubt. Ein solches Stück startet ohne Lage, „Fertig“
// blockiert dann, bis eine angehakt ist (countWithoutLayer).
export function defaultWizardLayers(c) {
  return layersOf(c).filter(n => n <= 2);
}

export const countWithoutLayer = entries => entries.filter(e => !e.it.layers.length).length;

// Globale Kopfzeile „Alle Stücke“: `entries` = [{ it, c }] (Wizard-Stück + Case-Typ).
// setLayerForAll schaltet Lage n bei allen Stücken, deren Case-Typ n erlaubt. Beim Abwählen
// bleibt n dort stehen, wo es die letzte Lage wäre (dieselbe Regel wie je Zeile); Rückgabe ist
// die Anzahl dieser Stücke, damit die Oberfläche darauf hinweisen kann.
export function setLayerForAll(entries, n, on) {
  let kept = 0;
  for (const { it, c } of entries) {
    if (!layersOf(c).includes(n)) continue;
    if (on) {
      if (!it.layers.includes(n)) it.layers = [...it.layers, n].sort((a, b) => a - b);
    } else if (it.layers.includes(n)) {
      if (it.layers.length <= 1) kept++;
      else it.layers = it.layers.filter(x => x !== n);
    }
  }
  return kept;
}

export function setTippedForAll(entries, on) {
  for (const { it, c } of entries) if (canTip(c)) it.tipped = on;
}

// Zustand eines Kopf-Häkchens (key = Lage 1–4 oder 'tipped') über alle betroffenen Stücke:
// 'on' alle, 'off' keins, 'mixed' gemischt, 'none' kein Stück, für das es überhaupt gilt.
export function bulkState(entries, key) {
  const vals = key === 'tipped'
    ? entries.filter(e => canTip(e.c)).map(e => e.it.tipped)
    : entries.filter(e => layersOf(e.c).includes(key)).map(e => e.it.layers.includes(key));
  if (!vals.length) return 'none';
  if (vals.every(Boolean)) return 'on';
  return vals.some(Boolean) ? 'mixed' : 'off';
}
