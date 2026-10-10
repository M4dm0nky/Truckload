import { chooseOrientation } from './packer.js';

// Warum steht ein Stück in der Ablage? Nur billige Prüfungen auf den Daten (kein Packlauf), jede
// ein Fakt, den der Packer genauso anwendet (chooseOrientation); sonst der Auffangtext.
// Rückgabe: kurzer Text, oder null, wenn Case oder Fahrzeug unbekannt sind.
//
// Bewusst NICHT geprüft (eigene Entscheidung, in der Doku/im Report benannt):
//  - Nutzlast: der Packer kennt die Nutzlast nicht; ein Stück landet nie deshalb in der Ablage.
//    „Nutzlast ausgeschöpft“ wäre erfunden. Zu schwer meldet validatePlan als Warnung.
//  - Lagen-Einschränkung: ein Stück mit z. B. „nur Lage 2“ scheitert, wenn kein passender Stapel
//    darunter entsteht – das hängt vom Packlauf ab und ist nicht billig entscheidbar (die
//    Stapelhöhe darunter ist offen, die Lage allein sagt nichts über die Höhe). Dann gilt der
//    Auffangtext.
// `plan` steht in der Signatur, wird aber nicht gebraucht.
export const REASON_FALLBACK = 'kein Platz mehr im Laderaum';

export function unplacedReason(piece, c, truck, plan) { // eslint-disable-line no-unused-vars
  if (!c || !truck) return null;
  if (!chooseOrientation(c, truck, piece)) {
    if (piece?.tipped === true && chooseOrientation(c, truck, { ...piece, tipped: false })) {
      return 'auf „getippt“ gesetzt, passt aber nur stehend';
    }
    return 'zu groß für den Laderaum';
  }
  return REASON_FALLBACK;
}
