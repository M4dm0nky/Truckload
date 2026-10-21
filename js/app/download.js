// Gemeinsamer Datei-Download (Sicherung und Sammlungsexport). Kein Import von js/app.js.
export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Ersatz für das `cancel`-Ereignis des Dateiauswählers, das sehr alte Browser nicht auslösen: Schließt
// der Dialog ohne Auswahl, bekommt nur `window` den Fokus zurück. Nach `delayMs` (die Auswahl löst
// `change` etwas später als `focus` aus) gilt der Dialog als abgebrochen, wenn keine Datei da ist.
// Gibt eine Funktion zurück, die alles wieder abbaut (Aufruf bei `change`/`cancel`/Abschluss).
// `win` und `timers` sind Testnähte.
export function watchFileDialogClose(input, onNoFile, { delayMs = 1000, win = globalThis.window, timers = { set: setTimeout, clear: clearTimeout } } = {}) {
  let timer = null;
  const onFocus = () => {
    if (timer !== null) return;
    timer = timers.set(() => { timer = null; stop(); if (!input.files?.length) onNoFile(); }, delayMs);
  };
  function stop() {
    win.removeEventListener('focus', onFocus);
    if (timer !== null) { timers.clear(timer); timer = null; }
  }
  win.addEventListener('focus', onFocus);
  return stop;
}
