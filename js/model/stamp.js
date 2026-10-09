// Setzt den Änderungszeitpunkt (`updatedAt`, ISO-Zeichenkette) auf einem Datensatz. Die einzige
// Stelle dafür: io.mergeById entscheidet beim Import anhand dieses Werts, welcher Stand neuer ist.
// Rein: liefert eine Kopie; `now` ist die Testnaht. Importiert nichts.
export const stamp = (obj, now = new Date()) => ({ ...obj, updatedAt: now.toISOString() });
