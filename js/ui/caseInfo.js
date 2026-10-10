// Gemeinsame Case-Texte und Konstanten der Oberfläche: die einzeilige Beschreibung im
// Wizard und auf der Materialseite (caseLine), die Detailzeile der Seitenleiste (caseDetail),
// der Kurzname eines Traversenprofils und die Schnelllängen der Traversen-Dialoge.
import { layersOf, outerDims, isTruss, canTip } from '../model/geometry.js';
import { TRUSS_PROFILES } from '../model/truss.js';

export const QUICK_LENGTHS = [100, 200, 240, 250, 300, 400];

// „34er“ für ein bekanntes Profil, sonst die Breite in cm.
export function trussProfileName(width) {
  const p = TRUSS_PROFILES.find(p => p.width === width);
  return p ? p.name.split(' ')[0] : `${width} cm`;
}

// Zahlen einheitlich: deutsch, höchstens eine Nachkommastelle, ohne unnötige Nullen
// („12,5“, „20“, „45,5“). Eigene Entscheidung: Rundung auf eine Stelle statt Rohwert, weil
// Maße und Gewichte so überall gleich aussehen.
export const fmtNum = n => Number(n).toLocaleString('de-DE', { maximumFractionDigits: 1, useGrouping: false });

// Gemeinsamer Kern von caseLine und caseDetail: Traverse = Profil, Länge, Stückzahl, Wagenbreite,
// Gewicht (c.weight ist bei Traversenwagen das Gewicht des ganzen Wagens); sonst Maße und Gewicht.
function trussCore(c) {
  const lengthM = (c.truss.length / 100).toFixed(2).replace('.', ',');
  const wagon = c.truss.standing ? '' : ` · Wagen ${fmtNum(c.w)} cm breit`;
  const unit = c.truss.standing ? 'kg' : 'kg/Wagen';
  return `Traverse ${trussProfileName(c.truss.width)} · ${lengthM} m · ${c.truss.count} Stück${wagon} · ${fmtNum(c.weight)} ${unit}`;
}
function dimsCore(c) {
  const { l, w, h } = outerDims(c);
  return `${fmtNum(l)}×${fmtNum(w)}×${fmtNum(h)} cm · ${fmtNum(c.weight)} kg`;
}

export function caseLine(c) {
  const company = c.company ? ` · ${c.company}` : '';
  if (isTruss(c)) return `${trussCore(c)}${company}`;
  if (c.kind === 'speaker' && c.unitH > 0) return `Dolly ${fmtNum(c.l)} × ${fmtNum(c.w)} cm (B × T) · ${fmtNum(c.h + (c.wheelH ?? 0))} cm hoch · ${fmtNum(c.weight)} kg${company}`;
  return `${dimsCore(c)}${company}`;
}

function layerLabel(c) {
  const layers = [...layersOf(c)].sort((a, b) => a - b);
  if (layers.length === 4) return '';
  if (layers.length === 1) return `nur Lage ${layers[0]}`;
  const contiguous = layers.every((n, i) => i === 0 || n === layers[i - 1] + 1);
  return contiguous ? `Lage ${layers[0]}–${layers.at(-1)}` : `Lage ${layers.join(', ')}`;
}

export function caseDetail(c) {
  if (isTruss(c)) return trussCore(c);
  const layers = layerLabel(c);
  return `${dimsCore(c)}${canTip(c) ? ' · tippbar' : ''}${c.stackable ? '' : ' · nicht stapelbar'}${layers ? ` · ${layers}` : ''}`;
}
