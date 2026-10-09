// Sichern (Export) und Importieren einer JSON-Sicherung. Vor dem Import legt die App still
// eine Sicherung des aktuellen Stands an. Kein Import von js/app.js.
import { allPlansOf } from './core.js';
import { exportBundle, parseBundle, backupFileName, preImportBackupFileName } from '../store/io.js';

const $ = sel => document.querySelector(sel);

// Warntexte für Verweise, die auch NACH dem Zusammenführen ins Leere zeigen. parseBundle kennt nur
// die Datei (plus Vorlagen), nicht die eigenen lokalen Cases/Fahrzeuge; deshalb filtert diese
// Funktion `unknownRefs` gegen den lokalen Zustand nach dem Mischen (`{ cases, trucks }`).
const LIMIT_FIELDS = { weight: ['Gewicht', 'kg'], maxTopLoad: ['Auflast', 'kg'], stock: ['Bestand', 'Stück'] };
// Werte über CASE_LIMITS werden übernommen (nicht abgelehnt), aber genannt.
export const limitWarnings = overLimit => overLimit.map(({ name, field, value, max }) => {
  const [label, unit] = LIMIT_FIELDS[field];
  return `Case „${name}“: ${label} ${value} ${unit} liegt über der Grenze von ${max} ${unit} – unverändert übernommen.`;
});

export function importWarnings(unknownRefs, { cases, trucks }) {
  const caseIds = new Set(cases.map(c => c.id));
  const truckIds = new Set(trucks.map(t => t.id));
  const warnings = [];
  for (const r of unknownRefs) {
    const missing = r.cases.filter(id => !caseIds.has(id)).length;
    if (missing > 0)
      warnings.push(`Ladeplan „${r.plan}“: ${missing} Stück verweisen auf ein Case, das weder in der Datei noch bekannt ist.`);
    if (r.truck !== null && !truckIds.has(r.truck))
      warnings.push(`Ladeplan „${r.plan}“ verweist auf ein unbekanntes Fahrzeug.`);
  }
  return warnings;
}

function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// deps: store, autosave, repo (mergeImportedBundle, saveImportWinners), showAlert, showConfirm.
export function wireImportExport({ store, autosave, repo, showAlert, showConfirm }) {
  $('#export').onclick = () => {
    const s = store.get();
    const plans = allPlansOf(s);
    downloadJSON(backupFileName(), exportBundle({ cases: s.cases, trucks: s.trucks, plans, ruleSets: s.ruleSets }));
  };

  // Ein <button> statt <label> um das versteckte <input type="file">: ein Label ist per
  // Tastatur nicht erreichbar.
  $('#import-btn').onclick = () => $('#import').click();
  $('#import').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    let bundle;
    try {
      bundle = parseBundle(await file.text());
    } catch (err) {
      await showAlert(`Import fehlgeschlagen: ${err?.message ?? 'unbekannter Fehler'}`);
      return;
    }

    // Still eine Sicherung des aktuellen Stands anlegen, BEVOR irgendetwas überschrieben wird –
    // das einzige Netz, falls der Import den falschen Stand bringt.
    const s0 = store.get();
    const backupName = preImportBackupFileName();
    // s0.plan ist null, wenn der Import vom Startbildschirm kommt; dann gehören nur die schon
    // gespeicherten Pläne in die Sicherung.
    const backupText = exportBundle({ cases: s0.cases, trucks: s0.trucks, plans: allPlansOf(s0), ruleSets: s0.ruleSets });
    downloadJSON(backupName, backupText);

    // Den Autosave für den aktuellen Plan für die Dauer des Imports stilllegen: exclude() nimmt
    // einen wartenden oder fehlgeschlagenen Eintrag aus der Buchhaltung heraus, sonst könnte
    // sein Timer (oder ein pagehide-Flush) währenddessen den alten Stand über den importierten
    // schreiben. saveImportWinners() schreibt diesen Plan selbst, falls die Datei ihn gewinnt.
    // Ohne aktuellen Plan (Startbildschirm) gibt es nichts stillzulegen.
    if (s0.plan) autosave.exclude(s0.plan.id);
    let merge;
    let importFailed = false;
    let importErr = null;
    try {
      // Das Mischen läuft synchron im Store-Updater auf dem Zustand zum Zeitpunkt des Updates,
      // nicht auf einem Schnappschuss vor den await-Grenzen: Änderungen des Nutzers dazwischen
      // gehen nicht verloren.
      store.update(s => {
        merge = repo.mergeImportedBundle(s, bundle);
        return { ...s, cases: merge.cases, trucks: merge.trucks, plans: merge.plans, plan: merge.plan, ruleSets: merge.ruleSets };
      });
      // Eine einzige Transaktion (alles oder nichts): unabhängige Schreibvorgänge je Datensatz
      // könnten teilweise gelingen, und dann passte ein Rollback der Oberfläche nicht mehr zur
      // Datenbank.
      await repo.saveImportWinners(merge.winners);
    } catch (err) {
      importFailed = true;
      importErr = err;
      // Store und Datenbank sind auseinandergelaufen: zurück auf den Stand vor dem Import, der
      // noch mit der Datenbank übereinstimmt.
      store.update(s => ({ ...s, cases: s0.cases, trucks: s0.trucks, plans: s0.plans, plan: s0.plan, ruleSets: s0.ruleSets }));
    } finally {
      // finally, damit der Autosave dieses Plans nicht den Rest der Sitzung stumm tot bleibt,
      // falls zwischen exclude() und hier etwas wirft. restore:true, wenn der Import
      // fehlschlug oder der lokale Stand gewann (planChanged === false): ein geparkter,
      // ausstehender eigener Stand wurde dann nicht mitgeschrieben und gilt weiter als
      // ausstehend. `merge` kann vor der Zuweisung undefined sein, daher das Optional-Chaining.
      if (s0.plan) autosave.include(s0.plan.id, { restore: importFailed || !merge?.planChanged });
    }

    if (importFailed) {
      const retry = await showConfirm(
        `Import: Schreiben in die Datenbank fehlgeschlagen (${importErr?.message ?? 'unbekannter Fehler'}). ` +
        'Der Stand von vorher ist wiederhergestellt. Sicherung von eben erneut herunterladen?',
      );
      if (retry) downloadJSON(backupName, backupText);
      return;
    }

    if (merge.planChanged) store.resetHistory();
    // Reparaturen an Altwerten werden gemeldet, damit der Nutzer sieht, was angepasst wurde.
    const repairNote = bundle.repairs.length ? `\n\nBeim Import angepasst:\n– ${bundle.repairs.join('\n– ')}` : '';
    // Verweise, die nach dem Mischen weder in der Datei noch lokal auflösbar sind.
    const warnings = [...importWarnings(bundle.unknownRefs, store.get()), ...limitWarnings(bundle.overLimit)];
    const warnNote = warnings.length ? `\n\nAchtung:\n– ${warnings.join('\n– ')}` : '';
    await showAlert(`Importiert: ${merge.winners.cases.length} Cases, ${merge.winners.trucks.length} Fahrzeuge, ${merge.winners.plans.length} Ladepläne, ${merge.winners.ruleSets.length} Regelsets (neuere lokale Stände behalten).${repairNote}${warnNote}`);
  };
}
