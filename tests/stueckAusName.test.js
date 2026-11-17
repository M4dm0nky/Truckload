import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stueckAusName } from '../js/model/stueckAusName.js';

const FAELLE = [
  ['Mac Viper x2 -CAB', 2],
  ['Mac Ultra x1-CAB', 1],
  ['Robe Doppel-Toploader-Case BMFL', 2],
  ['Robe Einzel-Toploader-Case BMFL', 1],
  ['Elation DARTZ 360 6er Roadcase - bestückt', 6],
  ['Laka Loom 5fach -CAB', 5],
  ['Chauvet Professional Rogue R1X Spot (2) Roadcase', 2],
  ['Elation MAXIMUS/MONET 2er FIL Roadcase - 2x Proteus Maximus', 2],
  // Fallen
  ['Robe Doppel-Toploader-Case CycFX 8', 2],
  ['GLP X4-Bar-20 x4 -CAB', 4],
  ['D8+ 0,5t CAB x12', 12],
  ['Dolly Rack 28 HEx2 -CAB', 2],
  ['Atomic 3000 LEDx8 -CAB', 8],
  ['X4-Bar', null],
  // Traversenprofile sind keine Stückzahl
  ['Truss lose 40er -BBM', null],
  ['Trussdolly 40er -BBM', null],
  ['Traverse 29er Dreipunkt 3 m', null],
  ['Traversen-Dolly 29er (8× 2 m)', null],
  ['Atomic 3000', null],
  ['Packcase 120×60×60', null],
  ['Packcase 120x60x60', null],
  ['Single Case', 1],
  ['Dual Case', 2],
  ['', null],
];

test('stueckAusName: Fallsammlung aus der Bibliothek', () => {
  for (const [name, erwartet] of FAELLE) {
    assert.equal(stueckAusName(name), erwartet, name);
  }
});

test('stueckAusName: kein String liefert null', () => {
  assert.equal(stueckAusName(undefined), null);
  assert.equal(stueckAusName(null), null);
  assert.equal(stueckAusName(5), null);
});

for (const datei of ['meine', 'standard']) {
  test(`stueckAusName: jeder Name aus data/${datei}.json liefert null oder 1..99`, () => {
    const j = JSON.parse(readFileSync(new URL(`../data/${datei}.json`, import.meta.url), 'utf8'));
    for (const c of j.cases) {
      const n = stueckAusName(c.name);
      assert.ok(n === null || (Number.isInteger(n) && n >= 1 && n <= 99), `${c.name} -> ${n}`);
    }
  });
}
