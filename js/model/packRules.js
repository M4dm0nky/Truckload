import { outerDims } from './geometry.js';
import { isTruss } from './truss.js';

// Pack-Regeln je Load (Nutzerwunsch 2026-09-30, Spec docs/superpowers/specs/2026-09-30-pack-regeln-
// design.md): eine Rangliste, die die sortenreinen Blöcke (Case-Typ + Gruppe) von der Stirnwand
// zur Tür ordnet. Die oberste Regel entscheidet, bei Gleichstand die nächste. Auswahlregeln
// schieben einen Block nach vorn (first = Stirnwand) oder hinten (last = Tür), Maßregeln ordnen
// nach Einzelvolumen bzw. Stückzahl absteigend.
export const MAX_RULES = 20;
export const MAX_RULE_VALUE = 200;
const SELECT_BY = ['truss', 'group', 'case', 'category'];
const MEASURE_BY = ['volume', 'count'];
const POSITIONS = ['first', 'last'];
export const POS_LABEL = { first: 'zuerst (Stirnwand)', last: 'zuletzt (Tür)' };
// Reihenfolge und Beschriftung für die Auswahl „Regel hinzufügen“ (js/ui/pack-rules.js).
export const RULE_KINDS = [
  { by: 'group', label: 'Gruppe' },
  { by: 'case', label: 'Case-Typ' },
  { by: 'category', label: 'Gewerk' },
  { by: 'truss', label: 'Traversen' },
  { by: 'volume', label: 'Große zuerst' },
  { by: 'count', label: 'Stückzahl zuerst' },
];

export const volumeOf = c => { const { l, w, h } = outerDims(c); return l * w * h; };

// Die bis V 0.8.4 festen Reihenfolgen, als Regeln ausgedrückt – liefert exakt dieselbe Ordnung wie
// die früheren Komparatoren in orderSorts (Regressionstest in tests/packer.test.js).
export function legacyRules(order) {
  return order === 'count'
    ? [{ by: 'count' }, { by: 'volume' }]
    : [{ by: 'truss', pos: 'last' }, { by: 'volume' }, { by: 'count' }];
}

export const rulesFor = plan => (Array.isArray(plan?.packRules) ? plan.packRules : legacyRules(plan?.packOrder));

export function ruleOk(r) {
  if (!r || typeof r !== 'object') return false;
  if (MEASURE_BY.includes(r.by)) return r.pos === undefined && r.value === undefined;
  if (!SELECT_BY.includes(r.by) || !POSITIONS.includes(r.pos)) return false;
  if (r.by === 'truss') return r.value === undefined;
  return typeof r.value === 'string' && r.value.trim().length > 0 && r.value.length <= MAX_RULE_VALUE;
}

const canonical = r => (MEASURE_BY.includes(r.by) ? { by: r.by }
  : r.by === 'truss' ? { by: 'truss', pos: r.pos }
  : { by: r.by, value: r.value.trim(), pos: r.pos });

// Eine Regel je Art und Ziel: „Gruppe Motoren“ kann nicht zugleich zuerst und zuletzt stehen.
export const ruleKey = r => (r.value === undefined ? r.by : `${r.by}\u0000${r.value.trim()}`);

export function normalizeRules(rules) {
  if (!Array.isArray(rules)) return [];
  const seen = new Set(), out = [];
  for (const r of rules) {
    if (!ruleOk(r)) continue;
    const c = canonical(r), k = ruleKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === MAX_RULES) break;
  }
  return out;
}

export const addRule = (rules, rule) =>
  normalizeRules([...rules.filter(r => ruleKey(r) !== ruleKey(canonical(rule))), rule]);

export function moveRule(rules, i, delta) {
  const j = i + delta;
  if (i < 0 || i >= rules.length || j < 0 || j >= rules.length) return rules;
  const next = [...rules];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export const removeRule = (rules, i) => rules.filter((_, k) => k !== i);

const matches = (r, blk) => {
  const it = blk[0];
  if (r.by === 'truss') return isTruss(it.c);
  if (r.by === 'group') return (it.group ?? '') === r.value;
  if (r.by === 'case') return it.caseId === r.value;
  return it.c.category === r.value;
};

// Ein Block = Array von Stücken { caseId, c, group? } desselben Case-Typs und derselben Gruppe.
// Schlusskriterien: Name, dann Gruppe (ohne Gruppe zuerst). Bei völligem Gleichstand bleibt die
// Eingabereihenfolge (Array.prototype.sort ist stabil) – wie bisher in orderSorts.
export function blockComparator(rules) {
  const cmps = normalizeRules(rules).map(r => {
    if (r.by === 'volume') return (a, b) => volumeOf(b[0].c) - volumeOf(a[0].c);
    if (r.by === 'count') return (a, b) => b.length - a.length;
    const rank = blk => (matches(r, blk) ? (r.pos === 'first' ? -1 : 1) : 0);
    return (a, b) => rank(a) - rank(b);
  });
  const nameOf = blk => String(blk[0].c.name ?? blk[0].caseId);
  cmps.push((a, b) => nameOf(a).localeCompare(nameOf(b), 'de'));
  cmps.push((a, b) => (a[0].group ?? '').localeCompare(b[0].group ?? '', 'de'));
  return (a, b) => {
    for (const f of cmps) { const d = f(a, b); if (d) return d; }
    return 0;
  };
}

// Was sich im aktuellen Load ansprechen lässt. pieces = Placements + Ablage, Stücke ohne
// bekannten Case-Typ zählen nicht.
export function ruleTargets(pieces, caseById) {
  const groups = new Set(), cases = new Map(), categories = new Set();
  let hasTruss = false;
  for (const x of pieces) {
    const c = caseById.get(x.caseId);
    if (!c) continue;
    if (x.group?.trim()) groups.add(x.group.trim());
    cases.set(c.id, String(c.name ?? c.id));
    if (c.category) categories.add(c.category);
    if (isTruss(c)) hasTruss = true;
  }
  const de = (a, b) => a.localeCompare(b, 'de');
  return {
    groups: [...groups].sort(de),
    cases: [...cases].map(([id, name]) => ({ id, name })).sort((a, b) => de(a.name, b.name)),
    categories: [...categories].sort(de),
    hasTruss,
  };
}

export function ruleActive(r, t) {
  if (r.by === 'truss') return t.hasTruss;
  if (r.by === 'group') return t.groups.includes(r.value);
  if (r.by === 'case') return t.cases.some(c => c.id === r.value);
  if (r.by === 'category') return t.categories.includes(r.value);
  return true;
}

export function describeRule(r, caseById) {
  if (r.by === 'volume') return 'Große zuerst';
  if (r.by === 'count') return 'Stückzahl zuerst';
  const pos = POS_LABEL[r.pos];
  if (r.by === 'truss') return `Traversen: ${pos}`;
  if (r.by === 'group') return `Gruppe „${r.value}“: ${pos}`;
  if (r.by === 'case') return `Case-Typ „${caseById.get(r.value)?.name ?? r.value}“: ${pos}`;
  return `Gewerk „${r.value}“: ${pos}`;
}
