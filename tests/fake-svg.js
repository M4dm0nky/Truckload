// Minimales DOM für Tests ohne Browser: gerade genug für renderView/zoom2d (Elemente, Attribute,
// Kinder, Text, dataset, Ereignisse) und eine Serialisierung zum Vergleichen des SVG-Markups.
class FakeEl {
  constructor(tag) {
    this.tag = tag; this.attrs = new Map(); this.children = []; this.dataset = {};
    this._text = ''; this._on = new Map(); this.parent = null;
  }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  replaceChildren() { this.children = []; this._text = ''; }
  set textContent(t) { this._text = String(t); this.children = []; }
  get textContent() { return this._text; }
  addEventListener(type, fn) { (this._on.get(type) ?? this._on.set(type, []).get(type)).push(fn); }
  dispatchEvent(ev) { for (const fn of this._on.get(ev.type) ?? []) fn(ev); return true; }
  getScreenCTM() { return { a: 1 }; }
  *walk() { yield this; for (const c of this.children) yield* c.walk(); }
  querySelectorAll(sel) {
    const cls = sel.split(',').map(s => s.trim().replace(/^\./, ''));
    return [...this.walk()].filter(e => e !== this && cls.includes(e.getAttribute('class')));
  }
}

// Setzt ein globales `document` (createElement/createElementNS, Canvas ohne Kontext → grobe
// Textschätzung, deterministisch) und gibt ein frisches <svg> zurück.
export function installFakeDom() {
  globalThis.document = {
    createElementNS: (_ns, tag) => new FakeEl(tag),
    createElement: () => ({ getContext: () => null }),
  };
  globalThis.CustomEvent ??= class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
}
export const newSvg = () => new FakeEl('svg');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
export function serialize(el) {
  const attrs = [...el.attrs].map(([k, v]) => ` ${k}="${esc(v)}"`).join('');
  const inner = el.children.map(serialize).join('') + esc(el._text);
  return `<${el.tag}${attrs}>${inner}</${el.tag}>`;
}
