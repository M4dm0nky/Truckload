import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../js/store/autosave.js';

// js/store/autosave.js kennt weder Store noch IndexedDB noch DOM (Fix-Runde 2, Task 2) -
// alle Abhängigkeiten (Uhr, Timer, `savePlan`) werden gespritzt. Ein manueller Fake-Timer
// macht die Debounce-/Obergrenzen-/Wiederholungs-Logik deterministisch prüfbar, ohne echte
// Zeit verstreichen zu lassen.
function makeClock(startAt = 0) {
  let t = startAt;
  let nextId = 0;
  const timers = new Map(); // id -> { at, fn }
  return {
    now: () => t,
    setTimer: (fn, ms) => { const id = ++nextId; timers.set(id, { at: t + ms, fn }); return id; },
    clearTimer: id => { timers.delete(id); },
    // Rückt die Uhr auf `target` vor und feuert dabei alle fälligen Timer der Reihe nach
    // (auch neu während des Vorrückens hinzugekommene), mit einer Mikrotask-Pause nach
    // jedem Timer, damit asynchrone Arbeit im Callback (flush() ist async) sich auswirken
    // kann, bevor der nächste geprüft wird.
    async advanceTo(target) {
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= target).sort((a, b) => a[1].at - b[1].at);
        if (due.length === 0) break;
        const [id, { at, fn }] = due[0];
        timers.delete(id);
        t = Math.max(t, at);
        fn();
        await settle();
      }
      t = Math.max(t, target);
    },
  };
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise(r => setImmediate(r));
}

function statusLog() {
  const log = [];
  const onStatus = (status, err) => log.push({ status, message: err?.message });
  return { log, onStatus };
}

test('noticeChange: derselbe Plan-Verweis löst nichts aus (reine Auswahl/Modus-Änderung)', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const plan = { id: 'a', name: 'A' };
  auto.noticeChange(plan);
  auto.noticeChange(plan); // exakt derselbe Verweis - kein zweites Mal ausstehend
  assert.equal(auto.has('a'), true);
  auto.noticeChange(plan);
  await clock.advanceTo(500);
  assert.deepEqual(calls, ['a'], 'savePlan darf für denselben unveränderten Verweis nur einmal aufgerufen werden');
});

test('Debounce: schreibt nach debounceMs Ruhe', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    debounceMs: 400, maxWaitMs: 2000,
  });
  auto.noticeChange({ id: 'a', v: 1 });
  await clock.advanceTo(399);
  assert.deepEqual(calls, [], 'vor Ablauf des Debounce darf noch nicht geschrieben sein');
  await clock.advanceTo(400);
  assert.deepEqual(calls, ['a']);
});

// --- Bug 1 [blocking]: ein fehlgeschlagener Schreibvorgang darf nicht vergessen werden,
// nur weil ein ANDERER Plan erfolgreich schreibt. Rückbau-Nachweis: ersetzt man die
// Map-Buchhaltung (pending je planId) durch ein einzelnes "lastSaved"-Feld wie in der
// allerersten Fassung, wird genau dieser Test rot - B's Erfolg würde A's Fehlschlag
// überdecken (status ginge auf "idle", statt "error" zu bleiben).
test('Bug 1: Fehlschlag von Plan A bleibt bestehen, auch wenn Plan B danach erfolgreich schreibt', async () => {
  const clock = makeClock();
  const { log, onStatus } = statusLog();
  const auto = createAutosave({
    savePlan: p => (p.id === 'a' ? Promise.reject(new Error('QuotaExceededError (simuliert)')) : Promise.resolve()),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    onStatus,
  });

  auto.noticeChange({ id: 'a', name: 'A geändert' });
  await clock.advanceTo(400); // A's erster Schreibversuch schlägt fehl
  assert.equal(auto.has('a'), true, 'A muss weiter als ausstehend gelten');
  assert.equal(log.at(-1).status, 'error');

  auto.noticeChange({ id: 'b', name: 'B' });
  await clock.advanceTo(800); // B's Debounce läuft ab und schreibt erfolgreich

  assert.equal(auto.has('b'), false, 'B muss erfolgreich geschrieben worden sein');
  assert.equal(auto.has('a'), true, 'A darf NICHT vergessen werden, nur weil B erfolgreich war');
  assert.equal(log.at(-1).status, 'error', 'der Fehlerstatus darf nicht durch B\'s Erfolg verdeckt werden');
});

test('Bug 1 (Fortsetzung): A erholt sich selbst, sobald das Schreiben wieder klappt', async () => {
  const clock = makeClock();
  const { log, onStatus } = statusLog();
  let failA = true;
  const auto = createAutosave({
    savePlan: p => (p.id === 'a' && failA ? Promise.reject(new Error('kaputt')) : Promise.resolve()),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    retryMs: 500,
    onStatus,
  });
  auto.noticeChange({ id: 'a', name: 'A' });
  await clock.advanceTo(400);
  assert.equal(auto.has('a'), true);
  failA = false;
  await clock.advanceTo(900); // ein Retry-Zyklus (retryMs=500) nach dem Fehlschlag bei t=400
  assert.equal(auto.has('a'), false, 'A muss sich nach Fehlerbehebung selbst nachholen');
  assert.equal(log.at(-1).status, 'idle');
});

// --- Bug 4/E [important]: Debounce-Obergrenze, UND ein dauerhaft fehlschlagender Plan darf
// die Obergrenzen-Rechnung für andere, unbeteiligte Pläne nicht auf 0 ziehen.
test('Obergrenze: wiederholte Änderungen (kürzer als debounceMs) schreiben spätestens nach maxWaitMs', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push({ id: p.id, t: clock.now() }); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    debounceMs: 400, maxWaitMs: 2000,
  });
  // Alle 100 ms eine neue Änderung (simuliert "der Nutzer klickt/ändert dauernd weiter") -
  // der Debounce würde ohne Obergrenze nie ablaufen.
  for (let i = 0; i < 19; i++) {
    auto.noticeChange({ id: 'a', v: i });
    await clock.advanceTo((i + 1) * 100);
  }
  assert.deepEqual(calls, [], 'vor der Obergrenze darf trotz Dauerbetrieb noch nichts geschrieben sein');
  await clock.advanceTo(2100);
  assert.equal(calls.length, 1, 'spätestens ~2000ms nach der ERSTEN ausstehenden Änderung muss geschrieben werden');
  assert.ok(calls[0].t <= 2100 && calls[0].t >= 1900, `Schreibzeitpunkt sollte nahe der Obergrenze liegen, war ${calls[0].t}`);
});

test('Bug E: ein dauerhaft fehlschlagender Plan darf den Debounce für einen unbeteiligten, frischen Plan nicht auf 0 ziehen', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => (p.id === 'a' ? Promise.reject(new Error('kaputt, für immer')) : (calls.push({ id: p.id, t: clock.now() }), Promise.resolve())),
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    debounceMs: 400, maxWaitMs: 2000, retryMs: 1000,
  });
  auto.noticeChange({ id: 'a', v: 0 });
  await clock.advanceTo(3000); // A ist inzwischen weit über die 2000ms-Obergrenze hinaus und retryt erfolglos

  auto.noticeChange({ id: 'b', v: 0 }); // eine frische, unbeteiligte Änderung an einem anderen Plan
  await clock.advanceTo(3050);
  assert.deepEqual(calls, [], 'B darf nicht sofort (wait=0) geschrieben werden, nur weil A schon lange aussteht');

  await clock.advanceTo(3450); // normaler Debounce (400ms) seit B's eigener Änderung
  assert.equal(calls.length, 1, 'B muss nach seinem EIGENEN, normalen Debounce-Fenster geschrieben werden');
  assert.ok(calls[0].t >= 3390 && calls[0].t <= 3450, `B sollte ~400ms nach seiner eigenen Änderung geschrieben werden, war ${calls[0].t}`);
});

// --- Bug D [important]: kein Fehlerbanner, wenn nichts fehlschlägt.
test('Bug D: eine Änderung, die WÄHREND eines erfolgreichen Schreibens eintrifft, täuscht keinen Fehler vor', async () => {
  const clock = makeClock();
  const { log, onStatus } = statusLog();
  let resolveA;
  let callCountA = 0;
  const auto = createAutosave({
    savePlan: p => {
      if (p.id === 'a' && callCountA === 0) {
        callCountA++;
        return new Promise(res => { resolveA = res; }); // hängt absichtlich, bis der Test es freigibt
      }
      return Promise.resolve();
    },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
    onStatus,
  });

  auto.noticeChange({ id: 'a', v: 1 });
  await clock.advanceTo(400); // flush() startet, hängt in savePlan('a', v1)
  assert.equal(log.at(-1).status, 'saving');

  auto.noticeChange({ id: 'a', v: 2 }); // eine neue Änderung trifft MITTEN im laufenden Schreiben ein
  resolveA(); // jetzt lässt der ursprüngliche (v1-)Schreibvorgang los
  await settle();

  assert.equal(auto.has('a'), true, 'v2 ist noch nicht geschrieben und muss weiter ausstehen');
  assert.notEqual(log.at(-1).status, 'error', 'nichts ist fehlgeschlagen - es darf kein Fehler gemeldet werden');
});

// --- Bug 5/G [important/nit]: markKnown() für einen reinen Wechsel, automatische
// Änderungserkennung für einen wirklich neuen (unbekannten) Plan.
test('markKnown: ein reiner Wechsel zu einem bekannten Plan löst kein erneutes Schreiben aus', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const planC = { id: 'c', name: 'C ALT (dieser Tab)' };
  auto.markKnown(planC); // z. B. switchPlan() auf einen aus dem lokalen Cache geladenen Plan
  auto.noticeChange(planC); // derselbe Verweis - keine Änderung
  await clock.advanceTo(1000);
  assert.deepEqual(calls, [], 'ein reiner Wechsel darf nichts schreiben');
});

test('noticeChange nach markKnown: eine ECHTE Änderung (neuer Verweis) wird weiterhin erkannt', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const planC = { id: 'c', name: 'C' };
  auto.markKnown(planC);
  auto.noticeChange({ id: 'c', name: 'C bearbeitet' }); // neuer Verweis = echte Änderung
  await clock.advanceTo(1000);
  assert.deepEqual(calls, ['c']);
});

test('unbekannter (neuer) Plan bekommt sein erstes Speichern automatisch, ohne explizites dirty-Flag', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  // switchPlan() ruft markKnown() nur für BEKANNTE Pläne auf; ein Duplikat/neuer Plan
  // bekommt es nicht - hier direkt der Fall "kein markKnown()" simuliert.
  auto.noticeChange({ id: 'dup-1', name: 'Kopie' });
  await clock.advanceTo(1000);
  assert.deepEqual(calls, ['dup-1'], 'ein nie zuvor gesehener Plan muss sein erstes Speichern bekommen');
});

// --- exclude()/include(): Grundlage für Befund A (Import läuft gegen den eigenen Autosave)
test('exclude/include: ein ausgeschlossener Plan wird von noticeChange() ignoriert, bis er wieder freigegeben wird', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  auto.exclude('p1');
  auto.noticeChange({ id: 'p1', name: 'Import-Stand 1' });
  await clock.advanceTo(1000);
  assert.equal(auto.has('p1'), false, 'während exclude() aktiv ist, darf nichts als ausstehend gelten');
  assert.deepEqual(calls, []);

  auto.include('p1');
  auto.noticeChange({ id: 'p1', name: 'Import-Stand 2' });
  await clock.advanceTo(1500);
  assert.deepEqual(calls, ['p1'], 'nach include() muss eine echte Änderung wieder normal erkannt werden');
});

test('markDirty: trägt einen Plan unbedingt ein, auch wenn seine Referenz schon als bekannt galt (Import-Rollback)', async () => {
  const clock = makeClock();
  const calls = [];
  const auto = createAutosave({
    savePlan: p => { calls.push(p.id); return Promise.resolve(); },
    now: clock.now, setTimer: clock.setTimer, clearTimer: clock.clearTimer,
  });
  const plan = { id: 'p1', name: 'eigene Änderung vor dem Import' };
  auto.markKnown(plan); // z. B. weil der Store gerade exakt auf diesen Stand zurückgerollt wurde
  auto.markDirty(plan); // trotzdem: er war vorher ausstehend und muss es wieder werden
  await clock.advanceTo(1000);
  assert.deepEqual(calls, ['p1']);
});

// --- „Zuordnung“ in saveImportWinners (repo.js) - reine Logik, separat getestet in
// tests/repo.test.js (buildImportWinnerItems). Hier nur die Randnotiz, dass dieses Modul
// dafür nichts wissen muss - es bekommt nur einzelne Pläne über savePlan().
