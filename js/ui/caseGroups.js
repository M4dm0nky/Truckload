// Gemeinsame Filter- und Gruppierungslogik für die Case-Listen in der
// Bibliothek (library.js) und im Lade-Wizard (load-wizard.js), damit sich
// beide Listen gleich anfühlen und Such-/Gewerk-/Firmenfilter identisch wirken.

// Liefert die im Datensatz vorkommenden Firmen, alphabetisch sortiert.
export function companiesOf(cases) {
  return [...new Set(cases.map(c => c.company).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
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
    own: cases.filter(c => !c.builtin && match(c)),
    presets: cases.filter(c => c.builtin && !c.legacy && c.source !== 'liste' && match(c)),
    list: cases.filter(c => c.builtin && c.source === 'liste' && match(c)),
  };
}
