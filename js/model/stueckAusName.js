// Liest die Stückzahl (Geräte je Case) aus einem Case-Namen.
// Liefert eine ganze Zahl 1..99 oder null. Die erste passende Regel gewinnt;
// Einzel/Doppel stehen vor Zahlen ("Doppel-Toploader-Case CycFX 8" -> 2).

const ZAHLWORT = { zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, acht: 8, zehn: 10, zwölf: 12, zwoelf: 12 };

const REGELN = [
  [/\b(?:einzel|single)\b/i, () => 1],
  [/\b(?:doppel|double|dual)\b/i, () => 2],
  // Zahlwort + "fach": "Vierfach-Toploader-Case ... 4" (Zahlwort schlägt nachgestellte Ziffern)
  [/\b(zwei|drei|vier|f(?:ü|ue)nf|sechs|acht|zehn|zw(?:ö|oe)lf)fach/i, m => ZAHLWORT[m[1].toLowerCase()]],
  // "6er", "5fach". Über 20 ist es ein Traversenprofil ("Truss 40er", "29er"), kein Zählwert.
  [/(?<![\w,.])(\d+)\s*(?:er|fach)\b/i, m => (Number(m[1]) <= 20 ? m[1] : null)],
  // "(2)", "(2 Stück)", "(8 Panels)"
  [/\((\d+)(?:\s*(?:stück|stk\.?|panels?))?\)/i, m => m[1]],
  // "x4", "HEx2", "LEDx8": kleines x direkt vor der Zahl, nicht nach einer Ziffer (120x60),
  // gefolgt von Leerraum, Ende oder "-". Großes X ("X4-Bar") zählt nie.
  [/(?<!\d)x(\d+)(?=\s|$|-)/, m => m[1]],
  // "Case x 2": freistehendes x mit Leerraum; nicht am Wortende ("Flex 4", "Matrix 8", "Max 12")
  [/(?<![A-Za-z\d])x\s(\d+)(?=\s|$|-)/, m => m[1]],
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
