import test from 'node:test';
import assert from 'node:assert/strict';
import { project, unproject, drawOrder, wheelStrip, stripRect, wheelView } from '../js/ui/projection.js';
import { esc, fmtM } from '../js/ui/dom.js';

const truck = { l: 1000, w: 250, h: 270 };
const box = { x0: 10, y0: 20, z0: 30, x1: 110, y1: 80, z1: 90 };

test('Draufsicht: linke Wand unten', () => assert.deepEqual(project(box, 'top', truck), { u0: 10, u1: 110, v0: 170, v1: 230 }));
test('Seitenansicht', () => assert.deepEqual(project(box, 'side', truck), { u0: 10, u1: 110, v0: 180, v1: 240 }));
test('Rückansicht', () => assert.deepEqual(project(box, 'rear', truck), { u0: 20, u1: 80, v0: 180, v1: 240 }));
test('unproject Draufsicht', () => assert.deepEqual(unproject(10, 230, 'top', truck), { x: 10, y: 20 }));
test('Zeichenreihenfolge', () => {
  const it = (id, x0, y0, z0) => ({ id, box: { x0, y0, z0 } });
  const items = [it('a', 0, 0, 60), it('b', 100, 100, 0)];
  assert.deepEqual(drawOrder(items, 'top').map(i => i.id), ['b', 'a']);
  assert.deepEqual(drawOrder(items, 'side').map(i => i.id), ['b', 'a']);
  assert.deepEqual(drawOrder(items, 'rear').map(i => i.id), ['a', 'b']);
});
test('Rollenstreifen', () => {
  assert.equal(wheelStrip('top', 'bottom'), null);
  assert.equal(wheelStrip('top', '+y'), 'v0');
  assert.equal(wheelStrip('side', 'bottom'), 'v1');
  assert.equal(wheelStrip('side', '+y'), null);
  assert.equal(wheelStrip('rear', '+y'), 'u1');
  assert.deepEqual(stripRect({ u0: 0, u1: 100, v0: 0, v1: 50 }, 'v1', 6), { x: 0, y: 44, width: 100, height: 6 });
});
test('wheelView', () => {
  assert.equal(wheelView('top', '+y'), 'edge');
  assert.equal(wheelView('side', 'bottom'), 'edge');
  assert.equal(wheelView('rear', 'bottom'), 'edge');
  assert.equal(wheelView('side', '-y'), 'facing');
  assert.equal(wheelView('rear', '+x'), 'facing');
  assert.equal(wheelView('top', 'bottom'), 'hidden');
  assert.equal(wheelView('side', '+y'), 'hidden');
  assert.equal(wheelView('rear', '-x'), 'hidden');
});
test('esc/fmtM', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(fmtM(120), '1,20 m');
});
