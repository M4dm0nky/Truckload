// Hilfsfunktionen der Sperr-Tests (tests/i18n.test.js): findet Texte im Quelltext.
// Bewusst ein einfacher Tokenizer, kein vollständiger JS-Parser. Er kennt Strings,
// Template-Literale (mit verschachteltem ${…}), Kommentare und Regex-Literale
// (Heuristik: ein „/“ nach Wert, „)“, „]“ oder „}“ ist eine Division).

const KEYWORDS_VOR_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await', 'instanceof']);
const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };

function unescape(raw) {
  return raw.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r?\n)|([\s\S]))/g,
    (m, u1, u2, x, nl, ch) => {
      if (u1) return String.fromCodePoint(parseInt(u1, 16));
      if (u2) return String.fromCharCode(parseInt(u2, 16));
      if (x) return String.fromCharCode(parseInt(x, 16));
      if (nl) return '';
      return ch in ESC ? ESC[ch] : ch;
    });
}

// Zerlegt den Quelltext in Tokens {type:'str'|'tpl'|'id'|'num'|'p', v, line}.
// Template-Ausdrücke erscheinen als Klammerpaar „(“ … „)“ im Strom, damit die
// Klammertiefe stimmt. Liefert außerdem die Kommentarbereiche.
export function tokenize(src) {
  const toks = [], comments = [];
  const n = src.length;
  let i = 0, line = 1, tid = 0;
  const push = (type, v, extra) => toks.push({ type, v, line, ...extra });

  function template() {
    const id = ++tid;
    let buf = '', subst = 0, partLine = line;
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += c + (src[i + 1] ?? ''); if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === '`') { i++; break; }
      if (c === '$' && src[i + 1] === '{') {
        if (buf) toks.push({ type: 'tpl', v: unescape(buf), line: partLine, tid: id });
        subst++;
        push('p', '(');
        i += 2;
        run(true);
        if (src[i] === '}') i++;
        push('p', ')');
        buf = ''; partLine = line;
        continue;
      }
      if (c === '\n') line++;
      buf += c; i++;
    }
    if (buf || !subst) toks.push({ type: 'tpl', v: unescape(buf), line: partLine, tid: id, solo: !subst });
  }

  function str(q) {
    const startLine = line;
    let buf = '';
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += c + (src[i + 1] ?? ''); if (src[i + 1] === '\n') line++; i += 2; continue; }
      if (c === q) { i++; break; }
      if (c === '\n') break; // unbeendeter String: nicht ins nächste Statement laufen
      buf += c; i++;
    }
    toks.push({ type: 'str', v: unescape(buf), line: startLine });
  }

  function regexErlaubt() {
    const p = toks[toks.length - 1];
    if (!p) return true;
    if (p.type === 'id') return KEYWORDS_VOR_REGEX.has(p.v);
    if (p.type === 'str' || p.type === 'tpl' || p.type === 'num') return false;
    return !(p.v === ')' || p.v === ']' || p.v === '}');
  }

  function regex() {
    i++;
    let inClass = false;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') break;
      if (c === '[') inClass = true;
      else if (c === ']') inClass = false;
      else if (c === '/' && !inClass) { i++; break; }
      i++;
    }
    while (i < n && /[a-z]/i.test(src[i])) i++;
    push('p', 'regex');
  }

  function run(stopAtBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (c === '/' && d === '/') {
        const s = i; while (i < n && src[i] !== '\n') i++;
        comments.push([s, i]); continue;
      }
      if (c === '/' && d === '*') {
        const s = i; i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
        i += 2; comments.push([s, Math.min(i, n)]); continue;
      }
      if (c === '\'' || c === '"') { str(c); continue; }
      if (c === '`') { template(); continue; }
      if (c === '/') {
        if (regexErlaubt()) regex(); else { push('p', '/'); i++; }
        continue;
      }
      if (c === '{') { depth++; push('p', c); i++; continue; }
      if (c === '}') {
        if (stopAtBrace && depth === 0) return;
        depth--; push('p', c); i++; continue;
      }
      if (/[\p{L}_$]/u.test(c)) {
        const s = i; i++;
        while (i < n && /[\p{L}\p{N}_$]/u.test(src[i])) i++;
        push('id', src.slice(s, i)); continue;
      }
      if (/\d/.test(c)) {
        const s = i; i++;
        while (i < n && /[\w.]/.test(src[i])) i++;
        push('num', src.slice(s, i)); continue;
      }
      push('p', c); i++;
    }
  }

  run(false);

  // Erstes Argument eines Aufrufs t( markieren (bei Templates alle Teile).
  const inTids = new Set();
  toks.forEach((tk, k) => {
    if (tk.type !== 'str' && tk.type !== 'tpl') return;
    const a = toks[k - 1], b = toks[k - 2], c = toks[k - 3];
    if (a?.v === '(' && a.type === 'p' && b?.type === 'id' && b.v === 't' && !(c?.type === 'p' && c.v === '.')) {
      tk.inT = true;
      if (tk.tid) inTids.add(tk.tid);
    }
  });
  toks.forEach(tk => { if (tk.tid && inTids.has(tk.tid)) tk.inT = true; });
  return { toks, comments };
}

// „//…“ und „/*…*/“ außerhalb von Strings entfernen (Zeilenumbrüche bleiben).
export function stripComments(src) {
  const { comments } = tokenize(src);
  let out = '', pos = 0;
  for (const [s, e] of comments) {
    out += src.slice(pos, s) + src.slice(s, e).replace(/[^\n]/g, '');
    pos = e;
  }
  return out + src.slice(pos);
}

export function literals(src) {
  return tokenize(src).toks
    .filter(tk => (tk.type === 'str' || tk.type === 'tpl') && tk.v !== '')
    .map(tk => ({ text: tk.v, kind: tk.type === 'str' ? 'str' : 'tpl', inT: !!tk.inT, line: tk.line }));
}

// Aufrufe t(…): key = einfaches String-Literal als erstes Argument, sonst null.
// ident = Name, wenn das erste Argument ein einzelner Bezeichner ist.
export function tCalls(src) {
  const { toks } = tokenize(src);
  const calls = [];
  const isP = (tk, v) => tk?.type === 'p' && tk.v === v;
  toks.forEach((tk, k) => {
    if (tk.type !== 'id' || tk.v !== 't' || !isP(toks[k + 1], '(')) return;
    const prev = toks[k - 1];
    if (isP(prev, '.') || (prev?.type === 'id' && prev.v === 'function')) return;
    const a = toks[k + 2], after = toks[k + 3];
    const einzeln = isP(after, ',') || isP(after, ')');
    let key = null, ident = null, ctx = null;
    if (einzeln && (a?.type === 'str' || (a?.type === 'tpl' && a.solo))) key = a.v;
    else if (einzeln && a?.type === 'id') ident = a.v;
    if (key !== null && isP(after, ',')) {
      // zweites Argument überspringen, drittes (Kontext) lesen
      let depth = 0, j = k + 4;
      for (; j < toks.length; j++) {
        const x = toks[j];
        if (x.type === 'p' && '([{'.includes(x.v)) depth++;
        else if (x.type === 'p' && ')]}'.includes(x.v)) { if (depth === 0) break; depth--; }
        else if (depth === 0 && isP(x, ',')) break;
      }
      if (isP(toks[j], ',')) {
        const c = toks[j + 1], e = toks[j + 2];
        if ((c?.type === 'str' || (c?.type === 'tpl' && c.solo)) && (isP(e, ')') || isP(e, ','))) ctx = c.v;
        else key = null; // Kontext nicht bestimmbar
      }
    }
    calls.push({ key, ctx, ident, line: tk.line });
  });
  return calls;
}

import DE_VOKABULAR from './i18n-de-words.js';

// Kurze, sehr häufige Wörter: schlagen an, wo immer sie als ganzes Wort vorkommen.
const DE_WOERTER = new Set(`und oder nicht kein keine keinen keinem der die das dem den des mit für ist wird noch alle
neu neue neuer neues gewicht fahrzeug fahrzeuge laden löschen speichern abbrechen schließen hinzufügen
bis bearbeiten ansicht höhe breite länge tiefe sind wurde werden zu von auf über unter nach aus bei sich`.split(/\s+/));

// Umlaute/ß, „ “ oder ein Wort der Kurzliste; zusätzlich das Vokabular (tests/i18n-de-words.js),
// aber nur bei Sätzen oder großgeschriebenen Wörtern – kleingeschriebene Einzelwörter
// sind meist Bezeichner ('standing', 'lautsprecher', 'mitgefuehrt').
export function looksGerman(s) {
  if (/[äöüÄÖÜß„“]/.test(s)) return true;
  const woerter = s.match(/[A-Za-z]+/g) ?? [];
  if (woerter.some(w => DE_WOERTER.has(w.toLowerCase()))) return true;
  if (!/\s/.test(s.trim()) && !/^\p{Lu}/u.test(s)) return false;
  return woerter.some(w => w.length >= 4 && DE_VOKABULAR.has(w.toLowerCase()));
}

// Lokale Bindungen namens „t“ (verdecken den Import aus js/i18n/i18n.js): const/let/var t,
// Parameter von function/Pfeilfunktion/catch, Destrukturierung. Liefert [{ line }].
export function shadowsT(src) {
  const { toks } = tokenize(src);
  const isP = (tk, v) => tk?.type === 'p' && tk.v === v;
  const open = '([{', close = ')]}';
  const closeOf = i => {
    let d = 0;
    for (let j = i; j < toks.length; j++) {
      const x = toks[j];
      if (x.type !== 'p') continue;
      if (open.includes(x.v)) d++;
      else if (close.includes(x.v) && --d === 0) return j;
    }
    return toks.length - 1;
  };
  // t als gebundener Name in einer Parameter-/Destrukturierungsliste (Tiefe 1, auch in { … })
  const bindsT = (from, to) => {
    for (let j = from + 1; j < to; j++) {
      const x = toks[j];
      if (x.type !== 'id' || x.v !== 't') continue;
      const p = toks[j - 1], nx = toks[j + 1];
      if (isP(nx, ':')) continue; // Schlüssel { t: x } bindet x, nicht t
      if ((isP(p, '(') || isP(p, ',') || isP(p, '{') || isP(p, ':') || isP(p, '[')) &&
        (isP(nx, ',') || isP(nx, ')') || isP(nx, '}') || isP(nx, ']') || isP(nx, '='))) return toks[j].line;
    }
    return 0;
  };
  const hits = [];
  const add = l => { if (l) hits.push({ line: l }); };
  toks.forEach((tk, i) => {
    if (tk.type === 'id' && tk.v === 't' && ['const', 'let', 'var'].includes(toks[i - 1]?.v) && toks[i - 1].type === 'id') add(tk.line);
    if (tk.type === 'id' && ['const', 'let', 'var'].includes(tk.v) && (isP(toks[i + 1], '{') || isP(toks[i + 1], '['))) {
      add(bindsT(i + 1, closeOf(i + 1)));
    }
    if (tk.type === 'id' && (tk.v === 'function' || tk.v === 'catch')) {
      let j = i + 1;
      while (toks[j] && !isP(toks[j], '(') && !isP(toks[j], '{') && j < i + 4) j++;
      if (isP(toks[j], '(')) add(bindsT(j, closeOf(j)));
    }
    if (isP(tk, '=') && isP(toks[i + 1], '>')) {
      const b = toks[i - 1];
      if (b?.type === 'id' && b.v === 't') add(b.line);
      else if (isP(b, ')')) {
        let d = 0, j = i - 1;
        for (; j >= 0; j--) { if (isP(toks[j], ')')) d++; else if (isP(toks[j], '(') && --d === 0) break; }
        if (j >= 0) add(bindsT(j, i - 1));
      }
    }
  });
  return hits;
}

// ---- HTML (index.html) ----
import { normalisiert } from '../js/i18n/dom.js';

const VOID = new Set(['meta', 'link', 'input', 'br', 'hr', 'img', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
const ATTR_MIT_TEXT = ['title', 'aria-label', 'placeholder', 'alt'];
const entitaeten = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function attrs(raw) {
  const out = {};
  for (const m of raw.matchAll(/([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) out[m[1].toLowerCase()] = entitaeten(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

// Zerlegt HTML in Elemente und Textknoten (ohne <script>/<style>/Kommentare).
// Liefert { texte: [{ text, line, marked }], attribute: [{ attr, text, line, marked }],
// markiert: [{ text, kind, line }], gemischt: [{ text, line }] }.
// „marked“: der Text steht in einem data-t-Element bzw. trägt das passende data-t-<attr>.
// markiert = alle Texte, die translateDom übersetzt (Schlüssel normalisiert).
// gemischt = data-t-Elemente mit Kindelementen (translateDom würde sie zerstören).
export function htmlScan(html) {
  const texte = [], attribute = [], markiert = [], gemischt = [];
  const stack = []; // { name, marked, idx }
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<!doctype[^>]*>|<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/gi;
  let pos = 0;
  const lineAt = i => html.slice(0, i).split('\n').length;
  const text = (s, at) => {
    const t = normalisiert(entitaeten(s));
    if (!t) return;
    const top = stack.find(e => e.marked);
    texte.push({ text: t, line: lineAt(at), marked: !!top });
    if (top) top.buf.push(t);
  };
  for (let m; (m = re.exec(html));) {
    text(html.slice(pos, m.index), pos);
    pos = re.lastIndex;
    if (!m[3]) continue; // Kommentar, Doctype, script, style
    const name = m[3].toLowerCase();
    if (m[2]) { // schließendes Tag
      const k = stack.map(e => e.name).lastIndexOf(name);
      if (k >= 0) {
        for (const e of stack.splice(k)) if (e.dataT) markiert.push({ text: normalisiert(e.buf.join(' ')), kind: 'data-t', line: e.line });
      }
      continue;
    }
    const a = attrs(m[4]);
    const line = lineAt(m.index);
    if (stack.length) { const p = stack[stack.length - 1]; if (p.dataT) gemischt.push({ text: p.name, line }); }
    for (const at of ATTR_MIT_TEXT) {
      if (a[at] === undefined || normalisiert(a[at]) === '') continue;
      const marked = a[`data-t-${at}`] !== undefined;
      attribute.push({ attr: at, text: normalisiert(a[at]), line, marked });
      if (marked) markiert.push({ text: normalisiert(a[at]), kind: `data-t-${at}`, line });
    }
    if (!VOID.has(name) && !m[0].endsWith('/>')) {
      stack.push({ name, marked: a['data-t'] !== undefined || stack.some(e => e.marked), dataT: a['data-t'] !== undefined, buf: [], line });
    }
  }
  text(html.slice(pos), pos);
  return { texte, attribute, markiert, gemischt };
}

// Die Texte, die translateDom übersetzt (Schlüssel für en.js).
export const dataTTexts = html => htmlScan(html).markiert.map(x => x.text);
