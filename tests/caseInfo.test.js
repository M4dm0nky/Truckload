import test from 'node:test';
import assert from 'node:assert/strict';
import { caseLine, caseDetail, trussProfileName, QUICK_LENGTHS } from '../js/ui/caseInfo.js';

// Erwartungswerte stammen aus dem Code vor dem Zusammenlegen (V 0.13.7): caseLine aus
// load-wizard.js, caseDetail aus library.js.
const CASES = [
  { name: "normal", c: {id:'a',name:'X',l:120,w:80,h:60,weight:45.5,stackable:true},
    line: "120×80×60 cm · 45.5 kg",
    detail: "120×80×60 cm · 45.5 kg" },
  { name: "firma", c: {id:'a',name:'X',l:120,w:80,h:60,weight:45.5,stackable:false,company:'Muster GmbH',layers:[1,2],tippable:true},
    line: "120×80×60 cm · 45.5 kg · Muster GmbH",
    detail: "120×80×60 cm · 45.5 kg · tippbar · nicht stapelbar · Lage 1–2" },
  { name: "truss", c: {id:'a',name:'X',l:300,w:80,h:50,weight:12.5,stackable:true,company:'Prolyte',kind:'truss',truss:{length:300,width:29,count:6,standing:false,wagonW:80}},
    line: "Traverse · 6 Stück · 12.5 kg/Stück · Wagen 80 cm breit · Prolyte",
    detail: "Traverse 34er · 3,00 m · 6 Stück · Wagen 80er" },
  { name: "truss40", c: {id:'a',name:'X',l:120,w:60,h:60,weight:20,stackable:true,kind:'truss',truss:{length:250,width:40,count:4,standing:false}},
    line: "Traverse · 4 Stück · 20 kg/Stück · Wagen 60 cm breit",
    detail: "Traverse 40er · 2,50 m · 4 Stück · Wagen 60er" },
  { name: "trussOdd", c: {id:'a',name:'X',l:120,w:60,h:60,weight:20,stackable:true,kind:'truss',truss:{length:333,width:35,count:2}},
    line: "Traverse · 2 Stück · 20 kg/Stück · Wagen 60 cm breit",
    detail: "Traverse 35 cm · 3,33 m · 2 Stück · Wagen 60er" },
  { name: "prerig", c: {id:'a',name:'X',l:200,w:50,h:300,weight:80,stackable:true,kind:'truss',truss:{length:200,width:50,count:1,standing:true,height:300}},
    line: "Traverse · 1 Stück · 80 kg/Stück",
    detail: "Traverse 50 cm · 2,00 m · 1 Stück · Wagen 50er" },
  { name: "dolly", c: {id:'a',name:'X',l:80,w:60,h:30,weight:99,stackable:true,kind:'speaker',unitH:40,wheelH:12,company:'Fa'},
    line: "Dolly 80 × 60 cm (B × T) · 42 cm hoch · 99 kg · Fa",
    detail: "80×60×30 cm · 99 kg" },
  { name: "sonder", c: {id:'a',name:'Sonderbau',l:310,w:105,h:77,weight:0,stackable:false,layers:[1,3],dimsInclWheels:false,wheelH:10},
    line: "310×105×87 cm · 0 kg",
    detail: "310×105×87 cm · 0 kg · nicht stapelbar · Lage 1, 3" },
];

for (const { name, c, line, detail } of CASES) {
  test(`caseLine: ${name}`, () => assert.equal(caseLine(c), line));
  test(`caseDetail: ${name}`, () => assert.equal(caseDetail(c), detail));
}

test('trussProfileName: bekanntes Profil kurz, unbekanntes mit Breite', () => {
  assert.equal(trussProfileName(29), '34er');
  assert.equal(trussProfileName(40), '40er');
  assert.equal(trussProfileName(35), '35 cm');
});

test('QUICK_LENGTHS', () => assert.deepEqual(QUICK_LENGTHS, [100, 200, 240, 250, 300, 400]));
