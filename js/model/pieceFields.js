import { MAX_LABEL } from './limits.js';

// Die Felder, die ein Stück (Placement oder Ablage-Eintrag) vom Case-Typ unterscheiden und die
// deshalb an jeder Stelle mitwandern müssen, an der ein Stück kopiert oder umgebaut wird. Wer ein
// neues Stückfeld einführt, trägt es hier ein (und in pickPieceFields) – nicht an sieben Orten.
export const PIECE_FIELDS = ['label', 'color', 'layers', 'tipped', 'group', 'nyxGeraet', 'nyxStueck'];

// Gruppenname (Pack-Regeln, Spec 2026-09-30): getrimmt, auf MAX_LABEL gekürzt, leer = kein Feld.
export const cleanGroup = g => (typeof g === 'string' ? g.trim().slice(0, MAX_LABEL) : '');

// NYX-Geräteübernahme: Schlüssel des Projektgeräts (nicht leerer String, höchstens 200 Zeichen) und
// die Stückzahl dieses Geräts auf dem Stück (Ganzzahl 1..99). Ungültig = kein Feld.
export const NYX_KEY_MAX = 200;
export const NYX_STUECK_MAX = 99;
export const nyxGeraetValid = v => typeof v === 'string' && v.length > 0 && v.length <= NYX_KEY_MAX;
export const nyxStueckValid = v => Number.isInteger(v) && v >= 1 && v <= NYX_STUECK_MAX;

// Liefert nur die vorhandenen Stückfelder von `src`. Fehlende oder leere Felder erzeugen keinen
// Schlüssel (auch kein `undefined`), damit alte Daten schlüsselgleich bleiben: label/color/layers
// zählen nur, wenn sie truthy sind, `tipped` auch als false, `group` nur nicht leer nach dem Trimmen.
export function pickPieceFields(src) {
  const { label, color, layers, tipped, group, nyxGeraet, nyxStueck } = src ?? {};
  const g = cleanGroup(group);
  return {
    ...(label ? { label } : {}),
    ...(color ? { color } : {}),
    ...(layers ? { layers } : {}),
    ...(tipped != null ? { tipped } : {}),
    ...(g ? { group: g } : {}),
    ...(nyxGeraetValid(nyxGeraet) ? { nyxGeraet } : {}),
    ...(nyxStueckValid(nyxStueck) ? { nyxStueck } : {}),
  };
}
