// Drucken über einen Host (NYX, docs/nyx-host.md „Drucken“): NYX liefert Titelkopf und
// Abschluss, erzeugt die PDF selbst (printToPDF) und öffnet sie – Electron zeigt bei
// window.print() keine Druckvorschau. Ohne DOM und ohne Store: alles Nötige kommt herein, deshalb
// unter node --test prüfbar. Ohne Host druckt chrome.js weiter mit window.print().
// Titel für Kopf und PDF-Dateiname. Bei Mehr-LKW-Plänen nennt er den Umfang (alle LKW, den
// gewählten LKW oder „Ohne LKW“) statt des Fahrzeugtyps; Etiketten tragen nur den Plannamen.
export function druckTitel(doc, { plan, truck, lkwName, alle = false }) {
  const name = plan?.name ?? '';
  if (doc === 'labels') return name;
  const zusatz = alle ? 'alle LKW' : lkwName || truck?.name;
  return zusatz ? `${name} – ${zusatz}` : name;
}

// Lässt einen Druck nur laufen, wenn keiner läuft; ein zweiter Aufruf währenddessen wird
// verworfen (Rückgabe false). Auch nach einem Fehler ist die Sperre wieder frei.
export function createDruckSperre() {
  let laeuft = false;
  return {
    get laeuft() { return laeuft; },
    async lauf(fn) {
      if (laeuft) return false;
      laeuft = true;
      try { await fn(); } finally { laeuft = false; }
      return true;
    },
  };
}

export async function druckeMitHost({ host, doc, titel, einsetzen, setPage, clearPage, zeigeFehler }) {
  let entfernen = null;
  try {
    let rand = null;
    if (doc !== 'labels') {
      // Ein fehlender Rahmen ist kein Grund, gar nicht zu drucken.
      try {
        const r = await host.druckRahmen({ doc, titel });
        if (r) { entfernen = einsetzen(r.kopf ?? '', r.abschluss ?? ''); rand = r.randUntenMm ?? null; }
      } catch { /* ohne Rahmen weiter */ }
    }
    setPage(doc, rand);
    await host.print({ doc, titel });
  } catch (err) {
    zeigeFehler(err?.message ?? String(err));
  } finally {
    clearPage();
    entfernen?.();
  }
}
