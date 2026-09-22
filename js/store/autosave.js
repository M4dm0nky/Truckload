// Reine Speicher-Buchhaltung für Ladepläne, ohne DOM und ohne IndexedDB. `js/app.js` bleibt
// der einzige Ort mit Store-Wissen – dieses Modul kennt weder `store` noch `repo`, nur die
// Funktionen, die `createAutosave()` gespritzt bekommt (`savePlan`, eine Uhr, ein Timer).
// Genau das macht die Buchhaltung mit `node --test` deterministisch prüfbar: die erste und
// zweite Fassung dieser Logik lagen in `js/app.js`, das ein Top-Level-`await
// repo.loadAll()` und direkten `document`-Zugriff hat und sich deshalb nicht importieren
// lässt, ohne einen Browser zu simulieren – sechs gezielte Rückbauten blieben dadurch bei
// 275/275 grün.
//
// Was dieses Modul verspricht, unabhängig davon, wie `app.js` es benutzt:
//
//  - `noticeChange(plan)`: ein Plan gilt erst als geändert, wenn seine Objekt-Referenz sich
//    gegenüber dem letzten `noticeChange`/`markKnown`-Aufruf unterscheidet. Reine
//    Auswahl-/Modus-Änderungen (derselbe Plan-Verweis) lösen nichts aus.
//  - Debounce mit Obergrenze: normal `debounceMs` seit der letzten frischen Änderung, aber
//    nie länger als `maxWaitMs` seit der ERSTEN frischen ausstehenden Änderung EINES Plans.
//    Ein Plan, der gerade über einen eigenen Fehlschlag-Timer erneut versucht wird, zählt
//    dabei nicht als "frisch" – er darf die Obergrenzen-Rechnung für andere, unbeteiligte
//    Pläne nicht auf 0 ziehen.
//  - Jeder Plan wird unabhängig nachverfolgt (`Map planId -> Plan`): ein fehlgeschlagener
//    Schreibvorgang für Plan A bleibt bestehen, auch wenn Plan B währenddessen erfolgreich
//    schreibt. `onStatus('error', …)` bleibt entsprechend bestehen.
//  - Ein Fehlschlag löst eine eigene, von der Debounce-Obergrenze entkoppelte Wiederholung
//    im Abstand `retryMs` aus, statt den normalen Debounce für alle anderen Pläne
//    kaputtzumachen.
//  - Trifft während eines Schreibvorgangs (auch eines erfolgreichen) eine weitere Änderung
//    ein, bleibt der Status "speichert" – es wird kein Fehler vorgetäuscht, nur weil danach
//    wieder etwas aussteht.
//  - `exclude(id)`/`include(id)`: ein Plan, dessen Schreiben gerade außerhalb dieses Moduls
//    läuft (Import), kann für die Dauer davon von der automatischen Buchhaltung
//    ausgenommen werden, ohne den Rest zu berühren.
//
// createAutosave({ savePlan, now, setTimer, clearTimer, debounceMs, maxWaitMs, retryMs, onStatus })
export function createAutosave({
  savePlan,
  now = () => Date.now(),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = h => clearTimeout(h),
  debounceMs = 400,
  maxWaitMs = 2000,
  retryMs = 2000,
  onStatus = () => {},
} = {}) {
  const pending = new Map();       // planId -> Plan
  const pendingSince = new Map();  // planId -> Zeitpunkt, seit dem er OHNE aktiven Fehlschlag aussteht
  const retrying = new Set();      // planIds, die gerade über den eigenen Fehlschlag-Timer laufen
  const excluded = new Set();      // planIds, die noticeChange() ignorieren soll
  let lastKnownPlan;
  let timer = null;
  let retryTimer = null;
  let savePendingChain = Promise.resolve();

  const clearMainTimer = () => { if (timer !== null) { clearTimer(timer); timer = null; } };
  const clearRetryTimer = () => { if (retryTimer !== null) { clearTimer(retryTimer); retryTimer = null; } };
  const freshIds = () => [...pending.keys()].filter(id => !retrying.has(id));

  function scheduleFlush() {
    const ids = freshIds();
    clearMainTimer();
    if (ids.length === 0) return;
    const earliest = Math.min(...ids.map(id => pendingSince.get(id)));
    const elapsed = now() - earliest;
    const wait = Math.max(0, Math.min(debounceMs, maxWaitMs - elapsed));
    timer = setTimer(() => { timer = null; flush(); }, wait);
  }

  function scheduleRetry() {
    clearRetryTimer();
    if (retrying.size === 0) return;
    retryTimer = setTimer(() => { retryTimer = null; flush(); }, retryMs);
  }

  // Unbedingt als ausstehend eintragen, ohne die Referenzgleichheits-Abkürzung von
  // noticeChange() – für den Fall, dass ein schon als „bekannt“ vermerkter Plan (z. B. weil
  // exclude() während seines Schreibens lief) nach einem Fehlschlag wieder als ausstehend
  // gelten muss, obwohl sich seine Objekt-Referenz gegenüber dem letzten Blick gar nicht
  // geändert hat.
  function markDirty(plan) {
    lastKnownPlan = plan;
    if (excluded.has(plan.id)) return;
    if (!pending.has(plan.id)) pendingSince.set(plan.id, now());
    pending.set(plan.id, plan);
    retrying.delete(plan.id); // eine frische Änderung bekommt wieder den normalen Debounce statt der Fehlschlag-Bremse
    scheduleFlush();
  }

  function noticeChange(plan) {
    if (plan === lastKnownPlan) return;
    markDirty(plan);
  }

  // Einen Plan als "das ist der aktuelle Stand, keine Änderung" vermerken, ohne ihn als
  // ausstehend einzutragen. Für einen reinen Wechsel zu einem schon bekannten Plan (kein
  // Edit) – ohne das würde die generische Änderungserkennung den Wechsel selbst als
  // Änderung werten und den (u. U. veralteten) Plan zurückschreiben.
  function markKnown(plan) { lastKnownPlan = plan; }

  function exclude(id) { excluded.add(id); }
  function include(id) { excluded.delete(id); }

  function has(id) { return pending.has(id); }
  function peek(id) { return pending.get(id); }

  // planRef optional: nur austragen, wenn der aktuell hinterlegte Stand noch derselbe ist
  // (sonst hätte eine zwischenzeitliche neue Änderung denselben planId erneut eingetragen).
  function forget(id, planRef) {
    if (planRef !== undefined && pending.get(id) !== planRef) return;
    pending.delete(id);
    pendingSince.delete(id);
    retrying.delete(id);
    if (pending.size === 0) {
      clearMainTimer();
      clearRetryTimer();
      onStatus('idle');
    }
  }

  function flush() {
    clearMainTimer();
    if (pending.size === 0) return savePendingChain;
    const batch = [...pending.entries()];
    onStatus('saving');
    savePendingChain = savePendingChain.catch(() => {}).then(async () => {
      let lastErr = null;
      for (const [id, plan] of batch) {
        try {
          await savePlan(plan);
          if (pending.get(id) === plan) {
            pending.delete(id);
            pendingSince.delete(id);
            retrying.delete(id);
          }
        } catch (err) {
          lastErr = err;
          retrying.add(id);
        }
      }
      if (pending.size === 0) {
        clearRetryTimer();
        onStatus('idle');
      } else if (lastErr) {
        onStatus('error', lastErr);
        scheduleRetry();
        scheduleFlush(); // falls daneben noch frische (nicht-retrying) Pläne warten
      } else {
        // Nichts ist fehlgeschlagen – aber während des Schreibens ist etwas Neues
        // dazugekommen. Kein Fehler vortäuschen, nur weiter "speichert" melden.
        onStatus('saving');
        scheduleFlush();
      }
    });
    return savePendingChain;
  }

  function cancelTimer() { clearMainTimer(); }

  return { noticeChange, markKnown, markDirty, exclude, include, has, peek, forget, flush, cancelTimer };
}
