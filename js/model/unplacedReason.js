import { chooseOrientation } from './packer.js';
import { canTip } from './geometry.js';

// Warum steht ein Stück in der Ablage? Nur Gründe, die allein aus den Maßen folgen und unabhängig
// davon wahr sind, ob je gepackt wurde (die Ablage füllt sich auch durch „In Ablage“, „Alles
// ausladen“, einen Fahrzeugwechsel oder einen Wizard ohne Packen). Kein Treffer: null – es wird
// dann kein Grund behauptet („kein Platz“ wäre geraten, eigene Entscheidung nach Review).
// Nutzlast und Lagen-Einschränkung kennt der Packer nicht bzw. nicht billig entscheidbar: nicht geprüft.
// Geprüft wird mit chooseOrientation, derselben Auswahl wie im Packer.
export function unplacedReason(piece, c, truck) {
  if (!c || !truck) return null;
  if (chooseOrientation(c, truck, piece)) return null;
  if (piece?.tipped === true && chooseOrientation(c, truck, { ...piece, tipped: false })) {
    return 'auf „getippt“ gesetzt, passt aber nur stehend';
  }
  if (piece?.tipped === false && canTip(c) && chooseOrientation(c, truck, { ...piece, tipped: undefined })) {
    return 'auf „nicht tippen“ gesetzt, passt aber nur getippt';
  }
  return 'zu groß für den Laderaum';
}
