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

export function caseLine(c) {
  const company = c.company ? ` · ${c.company}` : '';
  if (isTruss(c)) {
    const wagen = c.truss.standing ? '' : ` · Wagen ${c.w} cm breit`;
    return `Traverse · ${c.truss.count} Stück · ${c.weight} kg/Stück${wagen}${company}`;
  }
  if (c.kind === 'speaker' && c.unitH > 0) return `Dolly ${c.l} × ${c.w} cm (B × T) · ${c.h + (c.wheelH ?? 0)} cm hoch · ${c.weight} kg${company}`;
  const { l, w, h } = outerDims(c);
  return `${l}×${w}×${h} cm · ${c.weight} kg${company}`;
}

function trussLabel(c) {
  const lengthM = (c.truss.length / 100).toFixed(2).replace('.', ',');
  return `Traverse ${trussProfileName(c.truss.width)} · ${lengthM} m · ${c.truss.count} Stück · Wagen ${c.w}er`;
}

function layerLabel(c) {
  const layers = [...layersOf(c)].sort((a, b) => a - b);
  if (layers.length === 4) return '';
  if (layers.length === 1) return `nur Lage ${layers[0]}`;
  const contiguous = layers.every((n, i) => i === 0 || n === layers[i - 1] + 1);
  return contiguous ? `Lage ${layers[0]}–${layers.at(-1)}` : `Lage ${layers.join(', ')}`;
}

export function caseDetail(c) {
  const { l, w, h } = outerDims(c);
  return isTruss(c)
    ? trussLabel(c)
    : `${l}×${w}×${h} cm · ${c.weight} kg${canTip(c) ? ' · tippbar' : ''}${c.stackable ? '' : ' · nicht stapelbar'}${layerLabel(c) ? ` · ${layerLabel(c)}` : ''}`;
}
