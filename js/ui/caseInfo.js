// Gemeinsame Case-Texte und Konstanten der Oberfläche: die einzeilige Beschreibung im
// Wizard und auf der Materialseite (caseLine), die Detailzeile der Seitenleiste (caseDetail),
// der Kurzname eines Traversenprofils und die Schnelllängen der Traversen-Dialoge.
import { layersOf, outerDims, isTruss, canTip } from '../model/geometry.js';
import { TRUSS_PROFILES } from '../model/truss.js';
import { t, num } from '../i18n/i18n.js';

export const QUICK_LENGTHS = [100, 200, 240, 250, 300, 400];

// „34er“ für ein bekanntes Profil, sonst die Breite in cm.
export function trussProfileName(width) {
  const p = TRUSS_PROFILES.find(p => p.width === width);
  return p ? p.name.split(' ')[0] : `${width} cm`;
}

// Zahlen einheitlich (Format der Sprache), höchstens eine Nachkommastelle, ohne unnötige Nullen
// („12,5“, „20“, „45,5“). Eigene Entscheidung: Rundung auf eine Stelle statt Rohwert, weil
// Maße und Gewichte so überall gleich aussehen.
export function fmtNum(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '–';
  const s = num(v, { maximumFractionDigits: 1, useGrouping: false });
  return s === '-0' ? '0' : s; // -0,04 rundet sonst zu „-0“
}

// Gemeinsamer Kern von caseLine und caseDetail: Traverse = Profil, Länge, Stückzahl, Wagenbreite,
// Gewicht (c.weight ist bei Traversenwagen das Gewicht des ganzen Wagens); sonst Maße und Gewicht.
function trussCore(c) {
  const p = {
    profile: trussProfileName(c.truss.width),
    length: num(c.truss.length / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }),
    count: c.truss.count, w: fmtNum(c.w), weight: fmtNum(c.weight),
  };
  return c.truss.standing
    ? t('Traverse {profile} · {length} m · {count} Stück · {weight} kg', p)
    : t('Traverse {profile} · {length} m · {count} Stück · Wagen {w} cm breit · {weight} kg/Wagen', p);
}
function dimsCore(c) {
  const { l, w, h } = outerDims(c);
  return `${fmtNum(l)}×${fmtNum(w)}×${fmtNum(h)} cm · ${fmtNum(c.weight)} kg`;
}

export function caseLine(c) {
  const company = c.company ? ` · ${c.company}` : '';
  if (isTruss(c)) return `${trussCore(c)}${company}`;
  if (c.kind === 'speaker' && c.unitH > 0) return `${t('Dolly {l} × {w} cm (B × T) · {h} cm hoch · {weight} kg', { l: fmtNum(c.l), w: fmtNum(c.w), h: fmtNum(c.h + (c.wheelH ?? 0)), weight: fmtNum(c.weight) })}${company}`;
  return `${dimsCore(c)}${company}`;
}

function layerLabel(c) {
  const layers = [...layersOf(c)].sort((a, b) => a - b);
  if (layers.length === 4) return '';
  if (layers.length === 1) return t('nur Lage {n}', { n: layers[0] });
  const contiguous = layers.every((n, i) => i === 0 || n === layers[i - 1] + 1);
  return contiguous ? t('Lage {from}–{to}', { from: layers[0], to: layers.at(-1) }) : t('Lage {list}', { list: layers.join(', ') });
}

export function caseDetail(c) {
  if (isTruss(c)) return trussCore(c);
  const layers = layerLabel(c);
  return `${dimsCore(c)}${canTip(c) ? ` · ${t('tippbar')}` : ''}${c.stackable ? '' : ` · ${t('nicht stapelbar')}`}${layers ? ` · ${layers}` : ''}`;
}
