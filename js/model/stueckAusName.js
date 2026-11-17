// Liest die Stückzahl (Geräte je Case) aus einem Case-Namen.
// Liefert eine ganze Zahl 1..99 oder null. Die erste passende Regel gewinnt;
// Einzel/Doppel stehen vor Zahlen ("Doppel-Toploader-Case CycFX 8" -> 2).

const REGELN = [
  [/\b(?:einzel|single)\b/i, () => 1],
  [/\b(?:doppel|double|dual)\b/i, () => 2],
  // "6er", "5fach". Über 20 ist es ein Traversenprofil ("Truss 40er", "29er"), kein Zählwert.
  [/(?<![\w,.])(\d+)\s*(?:er|fach)\b/i, m => (Number(m[1]) <= 20 ? m[1] : null)],
  // "(2)"
  [/\((\d+)\)/, m => m[1]],
  // "x4", "HEx2", "LEDx8": kleines x, nicht direkt nach einer Ziffer (120x60),
  // gefolgt von Leerraum, Ende oder "-". Großes X ("X4-Bar") zählt nie.
  [/(?<!\d)x\s?(\d+)(?=\s|$|-)/, m => m[1]],
  // "2x Proteus"
  [/(?<![\w,.])(\d+)x\s+\S/, m => m[1]],
];

export function stueckAusName(name) {
  if (typeof name !== 'string') return null;
  for (const [re, wert] of REGELN) {
    const m = re.exec(name);
    if (!m) continue;
    const n = Number(wert(m));
    if (Number.isInteger(n) && n >= 1 && n <= 99) return n;
  }
  return null;
}
