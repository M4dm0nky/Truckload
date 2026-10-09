// Merkt sich das Ergebnis des letzten Aufrufs und liefert es erneut, solange alle Argumente
// dieselben Referenzen (Object.is) sind. Der Store erzeugt bei jeder Änderung neue Objekte, daher
// genügt ein Referenzvergleich – Auswahl- oder Ansichtswechsel rechnen so nichts neu.
export function memoLast(fn) {
  let lastArgs = null, lastResult;
  return (...args) => {
    if (lastArgs && lastArgs.length === args.length && args.every((a, i) => Object.is(a, lastArgs[i]))) return lastResult;
    lastResult = fn(...args);
    lastArgs = args;
    return lastResult;
  };
}
