// Abgleich NYX-Geräte ↔ Plan (Spec 2026-11-17-nyx-projektgeraete). Reine Rechnung, keine Texte.
import { stueckAusName } from './stueckAusName.js';
import { addUnplaced } from './actions.js';
import { canTip } from './geometry.js';
import { lkwsOf, isMultiLkw } from './lkw.js';
import { stamp } from './stamp.js';
import { t } from '../i18n/i18n.js';

const KEINE = new Map();

export const stueckProCase = c => c.fasst?.stueck ?? stueckAusName(c.name) ?? 1;

export const bekannteCases = (key, cases) =>
  cases
    .filter(c => c.fasst?.geraete?.some(g => g.key === key))
    .sort((a, b) => stueckProCase(a) - stueckProCase(b));

// Gerätetyp-Schlüssel eines Stücks, vw:-Alt-Schlüssel über `alias` auf gdtf: gehoben.
const keyOf = (p, alias) => alias.get(p.nyxGeraet) ?? p.nyxGeraet;

// Stücke mit nyxGeraet. `aufLkw`: Platzierung eines gültigen LKW (Mehr-LKW) bzw. jede Platzierung
// (Ein-LKW-Plan), dazu Ablage-Einträge mit gültigem `lkw`. Ohne LKW: Ablage ohne gültigen `lkw` und
// Platzierungen mit ungültigem `lkw` im Mehr-LKW-Plan (so zählt sie lkw.js unassignedView).
function nyxStuecke(plan, alias) {
  const multi = isMultiLkw(plan);
  const known = new Set(lkwsOf(plan).map(l => l.id));
  const mk = (p, placed) => ({
    id: p.id, key: keyOf(p, alias), stueck: p.nyxStueck ?? 1,
    aufLkw: multi ? known.has(p.lkw) : placed,
  });
  return [
    ...plan.placements.filter(p => p.nyxGeraet).map(p => mk(p, true)),
    ...plan.unplaced.filter(p => p.nyxGeraet).map(p => mk(p, false)),
  ];
}

export function umhaengen(geraete, cases) {
  const alias = new Map();
  for (const g of geraete) {
    if (!g.key.startsWith('gdtf:')) continue;
    for (const n of g.vwNamen ?? []) alias.set(`vw:${n}`, g.key);
  }
  const geaendert = [];
  for (const c of cases) {
    const liste = c.fasst?.geraete;
    if (!liste?.some(g => alias.has(g.key))) continue;
    const neu = [];
    for (const g of liste) {
      const k = alias.get(g.key) ?? g.key;
      if (!neu.some(x => x.key === k)) neu.push(k === g.key ? g : { ...g, key: k });
    }
    geaendert.push({ ...c, fasst: { ...c.fasst, geraete: neu } });
  }
  return { cases: geaendert, alias };
}

export function stand(plan, geraete, alias = KEINE) {
  const verladen = new Map();
  for (const s of nyxStuecke(plan, alias)) verladen.set(s.key, (verladen.get(s.key) ?? 0) + s.stueck);
  const nicht = new Set(plan.nyxAbgleich?.nichtLaden ?? []);
  // andersGeladen: Geräte ohne Case (z. B. fest in Motorzügen); Schlüssel vw: über alias auf gdtf: gehoben
  const andersMap = new Map();
  for (const [k, n] of Object.entries(plan.nyxAbgleich?.andersGeladen ?? {})) andersMap.set(alias.get(k) ?? k, n);
  const zeile = (key, name, anzahl) => {
    const v = verladen.get(key) ?? 0;
    const anders = Math.min(andersMap.get(key) ?? 0, anzahl);
    return { key, name, anzahl, verladen: v, anders, diff: anzahl - v - anders, nichtLaden: nicht.has(key) };
  };
  const rows = geraete.map(g => zeile(g.key, g.name, g.anzahl));
  const da = new Set(geraete.map(g => g.key));
  for (const [key] of verladen) if (!da.has(key)) rows.push(zeile(key, key, 0));
  return rows;
}

export const aufteilen = (anzahl, stueck) => ({
  cases: Math.floor(anzahl / stueck), rest: anzahl % stueck,
});

export function stueckeAnlegen(plan, { key, caseId, c, n, stueck }, newId) {
  return addUnplaced(plan, caseId, n, newId, { tipped: canTip(c), nyxGeraet: key, nyxStueck: stueck });
}

// Greedy in fester Reihenfolge: nicht auf LKW vor auf LKW, darin kleinere nyxStueck (Rest-Stücke)
// vor größeren, sonst Plan-Reihenfolge (stabil). Es wird entfernt, bis Σ nyxStueck ≥ minus.
// Ein Überschuss ist möglich (Rest 1 fehlt, nur ein Doppelcase da) und gewollt einfach.
export function reduktion(plan, key, minus, alias = KEINE) {
  const kand = nyxStuecke(plan, alias).filter(s => s.key === key)
    .sort((a, b) => (a.aufLkw - b.aufLkw) || (a.stueck - b.stueck));
  const entfernen = [];
  let summe = 0;
  for (const s of kand) {
    if (summe >= minus) break;
    entfernen.push(s);
    summe += s.stueck;
  }
  return { entfernen: entfernen.map(s => s.id), aufLkw: entfernen.filter(s => s.aufLkw).map(s => s.id) };
}

const MAX_GERAETE = 50;

export function merken(c, key, name) {
  const geraete = c.fasst?.geraete ?? [];
  return {
    ...c,
    fasst: {
      stueck: c.fasst?.stueck ?? stueckProCase(c),
      // io.js (fasstOk) lehnt über 50 ab: bei Überlauf die ältesten verwerfen
      geraete: geraete.some(g => g.key === key) ? geraete : [...geraete, { key, name }].slice(-MAX_GERAETE),
    },
  };
}

// Übernahme des Dialog-Ergebnisses in den Plan (rein): vw:-Stücke auf gdtf: umhängen, bestätigte
// Reduktionen entfernen (nur Stücke mit nyxGeraet), neue Stücke anlegen, nyxAbgleich setzen.
// res: { zuordnungen, nichtLaden, reduktion }; alias: dieselbe Map wie in stand()/umhaengen().
export function uebernimmGeraete(plan, res, newId, caseById, alias = KEINE) {
  const zuordnungen = res.zuordnungen ?? [];
  for (const z of zuordnungen) {
    if (!caseById.get(z.caseId)) throw new Error(t('Das Case „{id}“ fehlt in der Bibliothek.', { id: z.caseId }));
  }
  const weg = new Set((res.reduktion ?? []).flatMap(r => r.entfernen));
  const bleibt = p => !(p.nyxGeraet && weg.has(p.id));
  const umhaengen1 = p => (p.nyxGeraet && alias.has(p.nyxGeraet) ? { ...p, nyxGeraet: alias.get(p.nyxGeraet) } : p);
  let next = { ...plan, placements: plan.placements.filter(bleibt).map(umhaengen1), unplaced: plan.unplaced.filter(bleibt).map(umhaengen1) };
  for (const z of zuordnungen) {
    next = stueckeAnlegen(next, { key: z.key, caseId: z.caseId, c: caseById.get(z.caseId), n: z.n, stueck: z.nyxStueck }, newId);
  }
  const anders = {};
  for (const [k, n] of Object.entries(plan.nyxAbgleich?.andersGeladen ?? {})) anders[alias.get(k) ?? k] = n;
  for (const [k, n] of Object.entries(res.andersGeladen ?? {})) {
    if (n > 0) anders[alias.get(k) ?? k] = n; else delete anders[alias.get(k) ?? k];
  }
  const { andersGeladen: _alt, ...abgleich } = plan.nyxAbgleich ?? {};
  return stamp({ ...next, nyxAbgleich: {
    ...abgleich, geoeffnet: true, nichtLaden: [...new Set((res.nichtLaden ?? []).map(k => alias.get(k) ?? k))],
    ...(Object.keys(anders).length ? { andersGeladen: anders } : {}),
  } });
}

// Cases, die nach der Übernahme in die Bibliothek geschrieben werden: die umgehängten (vw:→gdtf:)
// und jedes zugeordnete Case mit gemerktem Typ und Geräten pro Case, sofern sich dabei etwas ändert.
export function casesZumMerken(bibliothek, umgehaengte, res) {
  const aus = new Map(umgehaengte.map(c => [c.id, c]));
  const vorher = new Map(bibliothek.map(c => [c.id, c]));
  for (const z of res.zuordnungen ?? []) {
    const basis = aus.get(z.caseId) ?? vorher.get(z.caseId);
    if (!basis) continue;
    const m = merken(basis, z.key, z.name);
    const neu = { ...m, fasst: { ...m.fasst, stueck: z.stueck } };
    if (aus.has(z.caseId) || JSON.stringify(neu.fasst) !== JSON.stringify(vorher.get(z.caseId)?.fasst)) aus.set(z.caseId, neu);
  }
  return [...aus.values()];
}
