import { chooseOrientation } from './packer.js';
import { canTip, pieceLayers } from './geometry.js';

// Warum steht ein Stück in der Ablage? Nur Gründe, die allein aus Stück, Case-Typ und Fahrzeug folgen und
// unabhängig davon wahr sind, ob je gepackt wurde (die Ablage füllt sich auch durch „In Ablage“, „Alles
// ausladen“, einen Fahrzeugwechsel oder einen Wizard ohne Packen). Kein Treffer: null – es wird dann
// kein Grund behauptet („kein Platz“ wäre geraten, eigene Entscheidung nach Review).
// Genannt werden (mehrere durch „; “ getrennt):
// - die Maße (chooseOrientation, dieselbe Auswahl wie im Packer): zu groß, bzw. getippt/nicht getippt;
// - das Gewicht des Stücks über der Nutzlast des Fahrzeugs (das Stück allein überschreitet sie schon);
// - eine Lagen-Einschränkung ohne Lage 1: das Stück darf nur auf anderen Stücken stehen. Das ist eine
//   Tatsache aus den Daten, keine Behauptung, dass deshalb nichts darunter war.
// Nicht genannt: Pack-Regeln und alles, was von den anderen Stücken im Plan abhängt.
export function unplacedReason(piece, c, truck) {
  if (!c || !truck) return null;
  const reasons = [];
  if (!chooseOrientation(c, truck, piece)) {
    if (piece?.tipped === true && chooseOrientation(c, truck, { ...piece, tipped: false })) {
      reasons.push('auf „getippt“ gesetzt, passt aber nur stehend');
    } else if (piece?.tipped === false && canTip(c) && chooseOrientation(c, truck, { ...piece, tipped: undefined })) {
      reasons.push('auf „nicht tippen“ gesetzt, passt aber nur getippt');
    } else {
      reasons.push('zu groß für den Laderaum');
    }
  }
  if (c.weight > 0 && truck.payload > 0 && c.weight > truck.payload) {
    reasons.push(`zu schwer für die Nutzlast des Fahrzeugs (${fmt(c.weight)} kg, erlaubt ${fmt(truck.payload)} kg)`);
  }
  const layers = pieceLayers(piece, c);
  if (!layers.includes(1)) {
    reasons.push(`erlaubte Lagen ${layers.join(', ')}: darf nur auf anderen Stücken stehen`);
  }
  return reasons.length ? reasons.join('; ') : null;
}

const fmt = n => Math.round(n).toLocaleString('de-DE');
