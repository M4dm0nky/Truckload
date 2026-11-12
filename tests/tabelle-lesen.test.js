import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { parseCsv, readXlsx, readTabellenDateien } from '../js/store/tabelle-lesen.js';

const fix = n => fs.readFileSync(new URL(`./fixtures/${n}`, import.meta.url));
const ab = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const buf = n => ab(fix(n));

test('parseCsv: erkennt Semikolon und Komma', () => {
  assert.deepEqual(parseCsv('a;b;c\n1;2;3'), [['a', 'b', 'c'], ['1', '2', '3']]);
  assert.deepEqual(parseCsv('a,b,c\n1.5,2,3'), [['a', 'b', 'c'], ['1.5', '2', '3']]);
});

test('parseCsv: entfernt BOM, hält Anführungszeichen, Trenner und Zeilenumbruch im Feld', () => {
  const rows = parseCsv('﻿Name;Notiz\r\nA;"a;b"\r\nB;"Zeile1\nZeile2"\r\nC;"sagt ""hallo"""\r\n');
  assert.deepEqual(rows, [['Name', 'Notiz'], ['A', 'a;b'], ['B', 'Zeile1\nZeile2'], ['C', 'sagt "hallo"']]);
});

test('parseCsv: Trenner im Anführungsfeld der ersten Zeile verfälscht die Erkennung nicht', () => {
  assert.deepEqual(parseCsv('"a,b,c";d\n1;2'), [['a,b,c', 'd'], ['1', '2']]);
});

test('parseCsv: Fixtures de und en', () => {
  const de = parseCsv(fix('ladeliste-de.csv').toString('utf8'));
  assert.deepEqual(de[0], ['Name', 'Breite', 'Notiz']);
  assert.deepEqual(de[1], ['Kiste A', '60,5', 'a;b']);
  assert.equal(de[2][2], 'Zeile1\nZeile2');
  assert.equal(de[3][2], 'sagt "hallo"');
  const en = parseCsv(fix('ladeliste-en.csv').toString('utf8'));
  assert.deepEqual(en[1], ['Case A', '60.5', 'a,b']);
});

test('readXlsx(basis): Blätter in Reihenfolge, Werte als Strings', async () => {
  const sheets = await readXlsx(buf('ladeliste-basis.xlsx'));
  assert.deepEqual(sheets.map(s => s.name), ['Cases', 'Set', 'Luecke']);
  const cases = sheets[0].rows;
  assert.deepEqual(cases[0], ['Name', 'Breite', 'Anzahl', 'Doppelt']);
  assert.deepEqual(cases[1], ['Kiste A', '120', '2', '4']);   // Formel: zwischengespeicherter Wert
  assert.deepEqual(cases[2], ['Kiste B', '0.5', '1', '2']);   // kein Exponent
  assert.equal(cases[3][1], '60,5');                          // Text bleibt Text
  assert.equal(cases.length, 4);                              // formatierte Leerzeilen entfallen
  assert.deepEqual(sheets[1].rows, [['Name', 'Teile'], ['Set 1', 'A & B <x>']]); // Entities
});

test('readXlsx(inlinestr): liest Inline-Texte', async () => {
  const sheets = await readXlsx(buf('ladeliste-inlinestr.xlsx'));
  assert.deepEqual(sheets[0].rows[1], ['Kiste A', '120', '2', '4']);
  assert.equal(sheets[0].rows[3][1], '60,5');
  assert.equal(sheets[1].rows[1][1], 'A & B <x>');
});

test('readXlsx: leere Zellen halten die Spaltenposition (r="D5" statt zählen)', async () => {
  const { rows } = (await readXlsx(buf('ladeliste-basis.xlsx')))[2];
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], []);
  assert.deepEqual(rows[4], ['links', '', '', 'rechts']);
});

test('readXlsx: kaputte Eingaben werfen einen Fehler', async () => {
  await assert.rejects(readXlsx(new Uint8Array([1, 2, 3, 4]).buffer));
  await assert.rejects(readXlsx(new ArrayBuffer(0)));
  const b = fix('ladeliste-basis.xlsx');
  await assert.rejects(readXlsx(ab(b.subarray(0, b.length - 30))));
});

test('readXlsx: Zip mit stored-Einträgen (Methode 0) wird gelesen', async () => {
  const sheets = await readXlsx(zipStored(entries('ladeliste-inlinestr.xlsx')));
  assert.equal(sheets[0].rows[1][0], 'Kiste A');
});

test('readTabellenDateien: xlsx je Blatt, csv ein Eintrag, unbekannte Endung wirft', async () => {
  const out = await readTabellenDateien([
    { name: 'a.xlsx', buf: buf('ladeliste-basis.xlsx') },
    { name: 'b.CSV', buf: ab(Buffer.from('x;y\n1;2')) },
  ]);
  assert.deepEqual(out.map(o => [o.datei, o.blatt]), [['a.xlsx', 'Cases'], ['a.xlsx', 'Set'], ['a.xlsx', 'Luecke'], ['b.CSV', '']]);
  assert.deepEqual(out[3].rows, [['x', 'y'], ['1', '2']]);
  await assert.rejects(readTabellenDateien([{ name: 'c.pdf', buf: new ArrayBuffer(1) }]), /c\.pdf/);
});

// --- Hilfen: Zip mit Methode 0 aus den Einträgen eines vorhandenen xlsx bauen ---
function entries(n) {
  const b = fix(n);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = b.length - 22;
  while (dv.getUint32(e, true) !== 0x06054b50) e--;
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const out = [];
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = b.subarray(p + 46, p + 46 + nl).toString('utf8');
    const ds = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = b.subarray(ds, ds + csize);
    out.push({ name, data: method === 8 ? inflateRawSync(raw) : raw });
    p += 46 + nl + xl + cl;
  }
  return out;
}

function zipStored(list) {
  const parts = [], cd = [];
  let off = 0;
  for (const { name, data } of list) {
    const nb = Buffer.from(name), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nb.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nb.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nb, data);
    cd.push(c, nb);
    off += 30 + nb.length + data.length;
  }
  const cdb = Buffer.concat(cd), eo = Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(list.length, 8); eo.writeUInt16LE(list.length, 10);
  eo.writeUInt32LE(cdb.length, 12); eo.writeUInt32LE(off, 16);
  return ab(Buffer.concat([...parts, cdb, eo]));
}
