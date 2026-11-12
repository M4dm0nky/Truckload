// Tabellen lesen (CSV und xlsx) ohne Abhängigkeit. Läuft im Browser und in Node gleich:
// ZIP wird von Hand gelesen, entpackt wird mit DecompressionStream, XML mit kleinen Scannern
// (DOMParser gibt es in Node nicht). Ergebnis sind immer Zeilen aus Strings; was daraus wird, entscheidet der Import.
import { t } from '../i18n/i18n.js';

const MAX_ENTRY_BYTES = 200 * 1024 * 1024; // Schutz vor ZIP-Bomben
const MAX_ROWS = 1048576;
const MAX_COLS = 16384;

const badXlsx = () => new Error(t('Die Datei ist keine lesbare xlsx-Datei.'));

// ---------- CSV ----------

/** CSV-Text in Zeilen und Felder zerlegen. Trenner ; oder , (nach der ersten Zeile), Anführungszeichen mit "" als ". */
export function parseCsv(text) {
  const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const delim = detectDelimiter(s);
  const rows = [];
  let row = [], field = '', quoted = false, started = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') { quoted = true; started = true; }
    else if (ch === delim) { row.push(field); field = ''; started = true; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = ''; started = false;
    } else { field += ch; started = true; }
  }
  if (started || field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function detectDelimiter(s) {
  let semi = 0, comma = 0, quoted = false;
  for (const ch of s) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted) {
      if (ch === '\n' || ch === '\r') break;
      if (ch === ';') semi++;
      else if (ch === ',') comma++;
    }
  }
  return semi > comma ? ';' : ',';
}

// ---------- ZIP ----------

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Zentralverzeichnis lesen: Map Name -> { method, csize, usize, offset }. */
function zipDirectory(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  const stop = Math.max(0, e - 65535);
  while (e >= stop && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < stop || e < 0) throw badXlsx();
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const dir = new Map();
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) throw badXlsx();
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    dir.set(name, { method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), offset: dv.getUint32(p + 42, true) });
    p += 46 + nl + xl + cl;
  }
  return { dir, dv };
}

async function zipEntry(bytes, zip, name) {
  const ent = zip.dir.get(name);
  if (!ent) return null;
  const { dv } = zip;
  const o = ent.offset;
  if (o + 30 > bytes.length || dv.getUint32(o, true) !== 0x04034b50) throw badXlsx();
  const start = o + 30 + dv.getUint16(o + 26, true) + dv.getUint16(o + 28, true);
  if (start + ent.csize > bytes.length || ent.usize > MAX_ENTRY_BYTES) throw badXlsx();
  const raw = bytes.subarray(start, start + ent.csize);
  let out;
  if (ent.method === 0) out = raw;
  else if (ent.method === 8) out = await inflateRaw(raw);
  else throw badXlsx();
  if (out.length > MAX_ENTRY_BYTES) throw badXlsx();
  return new TextDecoder().decode(out);
}

// ---------- XML (nur das, was xlsx braucht) ----------

const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decodeEntities = s => s
  .replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|(lt|gt|amp|quot|apos));/g,
    (m, hex, dec, name) => (name ? ENTITIES[name] : String.fromCodePoint(hex ? parseInt(hex, 16) : Number(dec))))
  .replace(/_x([0-9a-fA-F]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)));

function attrs(str) {
  const out = {};
  for (const m of str.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeEntities(m[2] ?? m[3]);
  return out;
}

/** Text aus <t>…</t>-Läufen (Rich-Text-Runs zusammengesetzt, Lesehilfen <rPh> ausgenommen). */
function textOf(xml) {
  let s = '';
  for (const m of xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)) s += m[1] ?? '';
  return decodeEntities(s);
}

const sharedStringsOf = xml => [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m => textOf(m[1] ?? ''));

/** Zahlen als Zeichenkette ohne Exponent ('1E-05' -> '0.00001'). */
function plainNumber(v) {
  if (!/e/i.test(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }) : v;
}

function colIndex(letters) {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
}

function sheetRows(xml, shared) {
  const rows = [];
  let rowNo = -1;
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const ra = attrs(rm[1]);
    rowNo = ra.r ? Number(ra.r) - 1 : rowNo + 1;
    if (!(rowNo >= 0 && rowNo < MAX_ROWS)) throw badXlsx();
    let colNo = -1;
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ca = attrs(cm[1]);
      const ref = /^([A-Za-z]+)\d+$/.exec(ca.r ?? '');
      colNo = ref ? colIndex(ref[1]) : colNo + 1;
      if (!(colNo >= 0 && colNo < MAX_COLS)) throw badXlsx();
      const value = cellValue(ca.t, cm[2] ?? '', shared);
      if (value === '') continue;
      const row = rows[rowNo] ?? (rows[rowNo] = []);
      while (row.length < colNo) row.push('');
      row[colNo] = value;
    }
  }
  const out = [];
  for (let i = 0; i < rows.length; i++) out.push(rows[i] ?? []);
  return out;
}

function cellValue(type, inner, shared) {
  if (type === 'inlineStr') return textOf(inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)?.[1] ?? '');
  const v = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
  if (v === undefined) return '';
  if (type === 's') return shared[Number(v)] ?? '';
  if (type === 'e') return '';
  if (type === 'str') return decodeEntities(v);
  return plainNumber(decodeEntities(v));
}

// ---------- xlsx ----------

/** Alle Blätter einer xlsx in Arbeitsmappen-Reihenfolge: [{ name, rows }]. Zellwerte sind Strings, Formeln liefern den zwischengespeicherten Wert. */
export async function readXlsx(buf) {
  try {
    const bytes = new Uint8Array(buf);
    const zip = zipDirectory(bytes);
    const get = name => zipEntry(bytes, zip, name);
    const wb = await get('xl/workbook.xml');
    const relsXml = await get('xl/_rels/workbook.xml.rels');
    if (wb === null || relsXml === null) throw badXlsx();
    const rels = new Map();
    for (const m of relsXml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
      const a = attrs(m[1]);
      if (a.Id && a.Target) rels.set(a.Id, a.Target.startsWith('/') ? a.Target.slice(1) : `xl/${a.Target}`);
    }
    const ssXml = await get('xl/sharedStrings.xml');
    const shared = ssXml === null ? [] : sharedStringsOf(ssXml);
    const sheets = [];
    for (const m of wb.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
      const a = attrs(m[1]);
      const rid = Object.entries(a).find(([k]) => k === 'id' || k.endsWith(':id'))?.[1];
      const path = rels.get(rid);
      const xml = path ? await get(path) : null;
      if (xml === null) throw badXlsx();
      sheets.push({ name: a.name ?? '', rows: sheetRows(xml, shared) });
    }
    return sheets;
  } catch (e) {
    throw e instanceof Error && e.message === badXlsx().message ? e : badXlsx();
  }
}

// ---------- Dateien ----------

/** CSV-Bytes als UTF-8 lesen; ist das ungültig (Excel Deutsch speichert Windows-1252), als Windows-1252. */
function decodeCsv(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

/** Dateien lesen: xlsx -> je Blatt ein Eintrag, csv -> ein Eintrag (blatt ''). Andere Endung wirft. */
export async function readTabellenDateien(files) {
  const out = [];
  for (const { name, buf } of files) {
    const ext = /\.([^./\\]+)$/.exec(name)?.[1].toLowerCase();
    if (ext === 'xlsx') {
      for (const s of await readXlsx(buf)) out.push({ datei: name, blatt: s.name, rows: s.rows });
    } else if (ext === 'csv') {
      out.push({ datei: name, blatt: '', rows: parseCsv(decodeCsv(buf)) });
    } else throw new Error(t('Die Datei „{name}“ ist keine .xlsx- oder .csv-Datei.', { name }));
  }
  return out;
}
