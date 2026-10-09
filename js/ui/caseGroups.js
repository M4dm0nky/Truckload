// Gemeinsame Filter- und Gruppierungslogik für die Case-Listen in der
// Bibliothek (library.js) und im Lade-Wizard (load-wizard.js), damit sich
// beide Listen gleich anfühlen und Such-/Gewerk-/Firmenfilter identisch wirken.
import { isTruss } from '../model/geometry.js';

// Sentinel für den Firmen-Filter: „nur Cases OHNE company“ – der Vorgabewert im Lade-Wizard
// (Nutzerwunsch 2026-10-06: firmen-gebrandete Cases wie „-CAB“ sollen nie von selbst
// auftauchen, nur wenn der Nutzer selbst eine Firma wählt). Unterscheidet sich bewusst von der
// leeren Zeichenkette, die weiterhin „alle Firmen zeigen“ bedeutet (Vorgabe von groupCases()
// selbst bleibt deshalb unverändert `''` – nur der Wizard wählt NEUTRAL_COMPANY als Start).
export const NEUTRAL_COMPANY = '__neutral__';

// Liefert die im Datensatz vorkommenden Firmen, alphabetisch sortiert.
export function companiesOf(cases) {
  return [...new Set(cases.filter(c => !c.legacy && !c.onlyInPlan).map(c => c.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

// Die 4 Reiter der Artikelauswahl (Materialverwaltung + Wizard-Case-Liste); Lautsprecher s. caseKind().
// Case-Typen (kind:'truss'), Sonderbau eigene Case-Typen mit category:'Sonderbau' – beide
// Merkmale schließen sich gegenseitig aus (ein Sonderbau ist nie gleichzeitig eine Traverse),
// alles andere landet im Cases-Reiter. Reine Klassifikation, kein Filtern nach Suche/Gewerk/
// Firma – das übernimmt groupCases() weiterhin, angewandt auf die per Reiter vorgefilterte Liste.
export const CASE_TABS = [
  { id: 'cases', label: 'Cases' },
  { id: 'lautsprecher', label: 'Lautsprecher' },
  { id: 'traversen', label: 'Traversen' },
  { id: 'sonderbau', label: 'Sonderbau' },
];
export function caseKind(c) {
  if (isTruss(c)) return 'traversen';
  if (c.category === 'Sonderbau') return 'sonderbau';
  // Line-Array-Boxen und Subs (dollyPrompt) und die daraus gebauten Boxen-Dollys (kind
  // 'speaker') bekommen einen eigenen Reiter (Nutzerwunsch 2026-10-09: „wo sind die Lautsprecher?“).
  if (c.dollyPrompt || c.kind === 'speaker') return 'lautsprecher';
  return 'cases';
}

// Teilt Cases nach Suche/Gewerk/Firma gefiltert in „Eigene Cases“, „Vorlagen“
// und „Cases aus deiner Liste“ (c.source === 'liste'). Cases ohne `company`
// verschwinden, sobald eine Firma gewählt ist. Mit NEUTRAL_COMPANY ist es
// umgekehrt: nur Cases OHNE `company` bleiben durch. `keep: Set<id>` = in diesem Wizard-Durchlauf
// angelegte Cases: sie umgehen alle Filter (Suche, Gewerk, Firma, onlyInPlan) und landen nach
// ihren übrigen Eigenschaften in der passenden Gruppe.
export function groupCases(cases, { q = '', cat = '', company = '', keep = new Set() } = {}) {
  const needle = q.trim().toLowerCase();
  const matchCompany = c => company === NEUTRAL_COMPANY ? !c.company : (!company || c.company === company);
  const match = c => keep.has(c.id) || (!c.onlyInPlan
    && (!cat || c.category === cat)
    && matchCompany(c)
    && (!needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle)));
  return {
    // `.sort(...)`: eigene Cases kämen sonst in IndexedDB-Schlüsselreihenfolge (UUID) an und sprängen
    // bei jeder Bearbeitung um, weil app.js das bearbeitete Case ans Array-Ende hängt. Hier statt in
    // repo.js sortiert, damit die Reihenfolge nicht davon abhängt, woher die Liste kommt.
    own: cases.filter(c => !c.builtin && !c.legacy && c.source !== 'liste' && match(c)).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    presets: cases.filter(c => c.builtin && !c.legacy && c.source !== 'liste' && match(c)),
    // `!c.legacy`: ersetzte Listen-Einträge bleiben nur für alte Ladepläne.
    list: cases.filter(c => !c.legacy && c.source === 'liste' && match(c)),
  };
}

// Rendert die dreiteilige Case-Liste (Eigene Cases / Vorlagen / Cases aus deiner Liste) für
// Bibliothek und Lade-Wizard: Überschriften mit Zählern gleich aufgebaut, nur `rowFn` und die
// Leertexte unterscheiden sich. `emptyTexts.presetsHeading` ist optional (die Bibliothek hängt
// „ (Richtwerte)“ an die Vorlagen-Überschrift, der Wizard nicht).
export function renderGroupList(target, groups, rowFn, emptyTexts) {
  const { own, presets, list } = groups;
  target.innerHTML = `
      <h3>Eigene Cases (${own.length})</h3>${own.map(rowFn).join('') || emptyTexts.own}
      <h3>Vorlagen (${presets.length})${emptyTexts.presetsHeading ?? ''}</h3>${presets.map(rowFn).join('') || emptyTexts.presets}
      <h3>Cases aus deiner Liste (${list.length})</h3>${list.map(rowFn).join('') || emptyTexts.list}`;
}
