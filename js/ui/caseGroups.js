// Gemeinsame Filter- und Gruppierungslogik für die Case-Listen in der
// Bibliothek (library.js) und im Lade-Wizard (load-wizard.js), damit sich
// beide Listen gleich anfühlen und Such-/Gewerk-/Firmenfilter identisch wirken.
import { isTruss } from '../model/truss.js';

// Liefert die im Datensatz vorkommenden Firmen, alphabetisch sortiert.
export function companiesOf(cases) {
  return [...new Set(cases.map(c => c.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
}

// Die 3 Reiter der Artikelauswahl (Bibliothek + Wizard-Case-Liste): Traversen sind eigene
// Case-Typen (kind:'truss'), Sonderbau eigene Case-Typen mit category:'Sonderbau' – beide
// Merkmale schließen sich gegenseitig aus (ein Sonderbau ist nie gleichzeitig eine Traverse),
// alles andere landet im Cases-Reiter. Reine Klassifikation, kein Filtern nach Suche/Gewerk/
// Firma – das übernimmt groupCases() weiterhin, angewandt auf die per Reiter vorgefilterte Liste.
export const CASE_TABS = [
  { id: 'cases', label: 'Cases' },
  { id: 'traversen', label: 'Traversen' },
  { id: 'sonderbau', label: 'Sonderbau' },
];
export function caseKind(c) {
  if (isTruss(c)) return 'traversen';
  if (c.category === 'Sonderbau') return 'sonderbau';
  return 'cases';
}

// Teilt Cases nach Suche/Gewerk/Firma gefiltert in „Eigene Cases“, „Vorlagen“
// und „Cases aus deiner Liste“ (c.source === 'liste'). Cases ohne `company`
// verschwinden, sobald eine Firma gewählt ist.
export function groupCases(cases, { q = '', cat = '', company = '' } = {}) {
  const needle = q.trim().toLowerCase();
  const match = c => (!cat || c.category === cat)
    && (!company || c.company === company)
    && (!needle || `${c.name} ${c.content ?? ''}`.toLowerCase().includes(needle));
  return {
    // `.sort(...)`: eigene Cases kamen bis Task 8 in IndexedDB-Schlüsselreihenfolge an
    // (crypto.randomUUID()), sprangen also bei jeder Bearbeitung zusätzlich um (js/app.js hängt
    // das bearbeitete Case ans Ende des Arrays), weil weder repo.js noch hier sortiert wurde
    // (docs/code-review-2026-09-21.md, „9. Eigene Cases erscheinen in UUID-Reihenfolge“). Hier
    // sortiert statt in repo.js: damit ist die Reihenfolge unabhängig davon, woher die Liste kommt
    // (Neuladen vs. innerhalb der Sitzung bearbeitet), mit einem einzigen Aufrufer für beide Fälle.
    own: cases.filter(c => !c.builtin && match(c)).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    presets: cases.filter(c => c.builtin && !c.legacy && c.source !== 'liste' && match(c)),
    list: cases.filter(c => c.builtin && c.source === 'liste' && match(c)),
  };
}

// Rendert die dreiteilige Case-Liste (Eigene Cases / Vorlagen / Cases aus deiner Liste), die
// Bibliothek (library.js) und Lade-Wizard (load-wizard.js) bis Task 6 als je eigene Kopie
// hielten — Überschriften mit Zählern und Leertexte identisch aufgebaut, nur `rowFn` und die
// Leertexte selbst unterschieden sich zwischen beiden (docs/code-review-2026-09-21.md,
// „S2 — die dreiteilige Case-Liste gemeinsam rendern“). `emptyTexts.presetsHeading` ist der
// einzige zusätzliche Unterschied (Bibliothek hängt „ (Richtwerte)“ an die Vorlagen-Überschrift,
// der Wizard nicht) und bleibt deshalb ein eigener, optionaler Parameter statt vereinheitlicht.
export function renderGroupList(target, groups, rowFn, emptyTexts) {
  const { own, presets, list } = groups;
  target.innerHTML = `
      <h3>Eigene Cases (${own.length})</h3>${own.map(rowFn).join('') || emptyTexts.own}
      <h3>Vorlagen (${presets.length})${emptyTexts.presetsHeading ?? ''}</h3>${presets.map(rowFn).join('') || emptyTexts.presets}
      <h3>Cases aus deiner Liste (${list.length})</h3>${list.map(rowFn).join('') || emptyTexts.list}`;
}
