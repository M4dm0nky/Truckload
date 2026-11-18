// Hilfsfunktionen des Bausteine-Wächters: ein kleiner CSS-Zerleger und die Prüfungen
// darauf. Bewusst einfach (kein vollständiger CSS-Parser); keine Abhängigkeiten.

// Kommentare durch Leerraum ersetzen, Zeilenumbrüche bleiben (Zeilennummern stimmen).
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
}

// Teilt s an sep außerhalb von Klammern und Anführungszeichen.
function splitTop(s, sep) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const c of s) {
    if (quote) { if (c === quote) quote = null; cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === sep && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}

function parseDecls(body) {
  const decls = [];
  for (const part of splitTop(body, ';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim();
    if (prop) decls.push({ prop, value: part.slice(i + 1).trim() });
  }
  return decls;
}

// Index der schließenden Klammer zu der „{“ an Position open.
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}' && --depth === 0) return i;
  }
  return s.length;
}

export function parseCss(text) {
  const src = stripComments(text);
  const lineAt = pos => src.slice(0, pos).split('\n').length;
  const rules = [];
  (function walk(from, to, media) {
    let i = from;
    while (i < to) {
      while (i < to && /\s/.test(src[i])) i++;
      if (i >= to) break;
      const open = src.indexOf('{', i);
      const semi = src.indexOf(';', i);
      if (open < 0 || open >= to) break;
      if (semi >= 0 && semi < open && src[i] === '@') { i = semi + 1; continue; }
      const prelude = src.slice(i, open).trim();
      const close = matchBrace(src, open);
      if (prelude.startsWith('@')) {
        const m = /^@media\s*([\s\S]*)$/.exec(prelude);
        if (m) walk(open + 1, close, m[1].trim());
        // andere At-Regeln (@keyframes, @font-face …) werden übersprungen
      } else {
        const line = lineAt(i);
        const decls = parseDecls(src.slice(open + 1, close));
        for (const sel of splitTop(prelude, ',')) {
          const selector = sel.trim().replace(/\s+/g, ' ');
          if (selector) rules.push({ selector, decls, media, line });
        }
      }
      i = close + 1;
    }
  })(0, src.length, null);
  return rules;
}

export function targetCompound(selector) {
  const parts = [];
  let depth = 0, cur = '';
  for (const c of selector) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (depth === 0 && /[\s>+~]/.test(c)) { if (cur) parts.push(cur); cur = ''; } else cur += c;
  }
  if (cur) parts.push(cur);
  return parts[parts.length - 1] ?? '';
}

// Klassen, die ui.css nur als Zustand setzt und die auch an Nicht-Bedienelementen hängen:
// on = gewählt/aktiv (auch .wiz-dot.on), error = Fehlerzustand (auch .save-status.error),
// warn = Warnzustand (auch an Hinweisen), none = „leer“-Variante des Tabs (nur mit :not(.on) gepaart),
// sel = gewählte Zeile/Karte in Listen.
export const STATE_CLASSES = new Set(['on', 'error', 'warn', 'none', 'sel']);

function stripNot(c) {
  return c.replace(/:not\((?:[^()]|\([^)]*\))*\)/g, '');
}

function classesOf(compound) {
  return [...stripNot(compound).matchAll(/\.([\w-]+)/g)].map(m => m[1]);
}

// Baustein- und Variantenklassen: alle Klassen im Zielglied unverschachtelter ui.css-Regeln
// (`.chip`, `button.small`, `.lkw-tab.on`), ohne Zustandsklassen. Kontextklassen
// (das `.row` aus `.editor .row`) und alles in `:not(...)` zählen nicht.
export function uiClasses(rules) {
  const set = new Set();
  for (const r of rules) {
    if (targetCompound(r.selector) !== r.selector) continue;
    for (const c of classesOf(r.selector)) if (!STATE_CLASSES.has(c)) set.add(c);
  }
  return set;
}

// Ein Glied zielt auf ein Bedienelement, wenn es ein Element aus der Liste nennt oder IRGENDEINE
// seiner Klassen `btn` oder eine Baustein-/Variantenklasse ist (`.quick-len.chip` zählt).
export function isControlTarget(compound, ui) {
  const c = stripNot(compound)
    .replace(/::?[\w-]+(\([^)]*\))?/g, '')
    .replace(/\[[^\]]*\]/g, '');
  if (/^(button|input|select|textarea|dialog)(?![\w-])/i.test(c)) return true;
  return classesOf(c).some(k => k === 'btn' || ui.has(k));
}

export const LOOK_PROPS = /^(padding|height|min-height|font|line-height|color|background|border|box-shadow|opacity|outline|cursor|text-align)/;

export function findControlStyling(rules, ui) {
  const out = [];
  for (const r of rules) {
    if (!isControlTarget(targetCompound(r.selector), ui)) continue;
    for (const d of r.decls) if (LOOK_PROPS.test(d.prop)) out.push({ selector: r.selector, prop: d.prop, line: r.line });
  }
  return out;
}

const NAMED = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
  'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod ' +
  'darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
  'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
  'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
  'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
  'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid ' +
  'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
  'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise ' +
  'palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown ' +
  'salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
  'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const NAMED_RE = new RegExp(`(?<![\\w-])(?:${NAMED.join('|')})(?![\\w-])`, 'i');

function hasColor(prop, value) {
  const v = value.replace(/"[^"]*"|'[^']*'/g, '').replace(/url\([^)]*\)/gi, '').replace(/var\(\s*--[\w-]+/gi, 'var(');
  if (/#[0-9a-f]{3,8}(?![\w-])/i.test(v) || /\b(?:rgba?|hsla?)\(/i.test(v)) return true;
  return !/^font/.test(prop) && NAMED_RE.test(v);
}

export function findColorLiterals(rules) {
  const out = [];
  for (const r of rules) {
    if (r.selector.startsWith(':root') || r.selector.startsWith('svg')) continue;
    for (const d of r.decls) {
      if (d.prop.startsWith('--')) continue;
      if (hasColor(d.prop, d.value)) out.push({ selector: r.selector, prop: d.prop, value: d.value, line: r.line });
    }
  }
  return out;
}
