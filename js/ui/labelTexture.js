// Reine Geometrie-/Text-Hilfsfunktionen für die 3D-Beschriftung – ohne Three.js-Import, damit sie
// mit `node --test` ohne WebGL geprüft werden können (Vorbild: `composeMatrix()` in
// instanceMatrix.js). `labelPlanes()` liefert die fünf Beschriftungsflächen eines Case-Korpus
// (vier Seiten + Deckel/Boden – nur die an die Rollen bzw. das Wagenende grenzende sechste Fläche
// bleibt frei, weil dort in `caseShape()`/`trussShape()` bereits Platz für die Rollen-Geometrie aus
// dem Korpus herausgeschnitten ist). `fitFontSize()` bestimmt Schriftgröße und Zeilenumbruch für
// eine gegebene Fläche, mit einer groben Zeichenbreiten-Schätzung statt echter Font-Metrik (die gibt
// es ohne Canvas/WebGL nicht).

const OFFSET = 0.5; // cm Abstand der Beschriftungsebene vor der Korpusfläche

const AXES = ['x', 'y', 'z'];
const dim = (box, axis) => box[`${axis}1`] - box[`${axis}0`];

// Alle sechs Flächen einer Box: Achse + Seite (0 = …0-Fläche, 1 = …1-Fläche).
const FACES = {
  x0: { axis: 'x', side: 0 }, x1: { axis: 'x', side: 1 },
  y0: { axis: 'y', side: 0 }, y1: { axis: 'y', side: 1 },
  z0: { axis: 'z', side: 0 }, z1: { axis: 'z', side: 1 },
};

// Welche der 6 Flächen an die Rollen (Case) bzw. das Wagenende (Traverse) grenzt und deshalb keine
// Beschriftungsfläche bekommt – entspricht der Seite, auf der `caseShape()` den Korpus verkleinert.
const WHEEL_FACE_KEY = { bottom: 'z0', '+x': 'x1', '-x': 'x0', '+y': 'y1', '-y': 'y0' };

// Liefert die fünf Beschriftungsflächen eines Korpus `box` (x0…z1, Truck-Koordinaten cm).
// `face` ist der Rückgabewert von `wheelFace()`/das `face` aus `caseShape()` (bzw. 'bottom' für
// Traversenwagen-Enden); ohne Rollen (undefined/null) wird die Bodenfläche ausgespart.
// Jede Fläche liegt 0,5 cm vor der jeweiligen Korpusfläche (schneidet den Korpus also nie).
// Senkrechte Wände (Normale entlang x/y) haben stets Welt-z als „oben“ – der Text steht dort waagerecht,
// egal ob das Case steht oder getippt liegt (die Box ist immer welt-achsenparallel). Deckel/Boden
// (Normale entlang z) haben Welt-x als „oben“.
export function labelPlanes(box, face) {
  const exclude = WHEEL_FACE_KEY[face] ?? 'z0';
  const planes = [];
  for (const [key, { axis: faceAxis, side }] of Object.entries(FACES)) {
    if (key === exclude) continue;
    const upAxis = faceAxis === 'z' ? 'x' : 'z';
    const widthAxis = AXES.find(a => a !== faceAxis && a !== upAxis);
    const sign = side === 1 ? 1 : -1;

    const center = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2, z: (box.z0 + box.z1) / 2 };
    center[faceAxis] = box[`${faceAxis}${side}`] + sign * OFFSET;

    const normal = { x: 0, y: 0, z: 0 };
    normal[faceAxis] = sign;
    const up = { x: 0, y: 0, z: 0 };
    up[upAxis] = 1;

    planes.push({
      face: key,
      center,
      normal,
      up,
      width: dim(box, widthAxis),
      height: dim(box, upAxis),
    });
  }
  return planes;
}

// `fitFontSize()`/`wrapText()` hier und `fitLabelText()` in js/ui/view2d.js lösen dieselbe
// Aufgabe (Beschriftung an eine Fläche anpassen) mit verschiedenen Verfahren und Ergebnissen —
// 2D kürzt einzeilig mit „…“, 3D bricht mehrzeilig um. Bewusst NICHT zusammengeführt: 2D auf
// Umbruch umzustellen wäre eine sichtbare Verhaltensänderung, keine reine Dopplung (Begründung
// und Gegenkommentar an der Aufrufstelle: js/ui/view2d.js, LABEL_MIN/LABEL_MAX,
// docs/code-review-2026-09-21.md, „S3 — eine Textmetrik für 2D und 3D“). Geteilt wird nur die
// Zeichenbreiten-SCHÄTZUNG (`estimateTextWidth`, s. u.), die view2d.js als Rückfall importiert,
// wenn `getComputedTextLength()` nicht zur Verfügung steht.
const CHAR_ASPECT = 0.56; // grobe Zeichenbreite je Schriftgröße (Sans-Serif-Schätzung, keine echte Font-Metrik)
const LINE_HEIGHT = 1.15; // Zeilenabstand je Schriftgröße

export const estimateTextWidth = (text, fontSize) => String(text).length * fontSize * CHAR_ASPECT;

// Greedy Wortumbruch auf `maxChars` Zeichen je Zeile; einzelne Wörter, die länger als eine Zeile
// sind, werden hart umbrochen (z. B. sehr lange zusammengeschriebene Bezeichnungen). `hardSplit`
// zeigt an, ob das nötig war – `fitFontSize()` bevorzugt damit eine kleinere Schrift ohne mitten im
// Wort umgebrochene Zeilen vor einer größeren Schrift mit hartem Wortumbruch.
function wrapText(text, maxChars) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { lines: [''], hardSplit: false };
  const chars = Math.max(1, maxChars);
  const lines = [];
  let line = '';
  let hardSplit = false;
  for (const word of words) {
    if (word.length > chars) {
      if (line) { lines.push(line); line = ''; }
      hardSplit = true;
      for (let i = 0; i < word.length; i += chars) lines.push(word.slice(i, i + chars));
      continue;
    }
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= chars) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return { lines, hardSplit };
}

// Größte Schriftgröße (cm), mit der `text` – nötigenfalls umgebrochen – in eine Fläche `w`×`h` (cm)
// passt. Verkleinert iterativ ab `maxSize` (Default: `h`) bis `minSize`. Ein Wortumbruch mitten im
// Wort wird nur akzeptiert, wenn keine kleinere Schriftgröße bis `minSize` ohne ihn auskommt; passt
// der Text selbst bei `minSize` nicht, wird trotzdem umgebrochen zurückgegeben (Best-Effort statt
// Endlosschleife/Fehler).
export function fitFontSize(text, w, h, { minSize = 0.8, maxSize } = {}) {
  const max = Math.max(minSize, maxSize ?? h);
  const step = Math.max(max / 100, 0.02);
  let size = max;
  let fallback = null; // größte Schriftgröße, die nur mit hartem Wortumbruch passt
  while (size >= minSize) {
    const maxChars = Math.max(1, Math.floor(w / (size * CHAR_ASPECT)));
    const { lines, hardSplit } = wrapText(text, maxChars);
    const totalHeight = lines.length * size * LINE_HEIGHT;
    const fits = totalHeight <= h && lines.every(l => estimateTextWidth(l, size) <= w);
    if (fits) {
      if (!hardSplit) return { fontSize: size, lines };
      fallback ??= { fontSize: size, lines };
    }
    size -= step;
  }
  if (fallback) return fallback;
  const maxChars = Math.max(1, Math.floor(w / (minSize * CHAR_ASPECT)));
  return { fontSize: minSize, lines: wrapText(text, maxChars).lines };
}
