import { colorFor } from '../data/categories.js';

// Recherche: Carvin DB521018 (81×75×20 cm, 18,3 kg, 4× 127-mm-Lenkrollen), SYNQ SQ-218 Dolly
// (11 kg, 4× 100-mm-Schwerlastrollen), DAS PL-EV118S (~81×71×18 cm Versandmaß, ~11 kg) –
// docs/casemasse-gewichte.md hat die volle Herleitung. Mittelwert aus den drei Quellen,
// dokumentiert statt erfunden (CLAUDE.md „Haltung“).
export const DOLLY_HEIGHT_CM = 18; // Rollen + Platte
export const DOLLY_WEIGHT_KG = 15; // Dolly-Eigengewicht, pauschal

// Baut den Case-Typ für „<Basisbox> N er (auf Dolly)“ – der Fußabdruck bleibt exakt der der
// Basisbox (Nutzer-Entscheidung: die reale, schmalere Dolly-Normbreite ändert nichts an der
// Pack-Logik, nur an der Dokumentation, s. docs/casemasse-gewichte.md). Die Dolly-Höhe steckt
// in `wheelH`/`dimsInclWheels: false`, nicht in `h` – dadurch zeichnet die bereits vorhandene
// 4-Rollen-Zeichnung in js/model/caseShape.js den Dolly automatisch mit, ohne neuen Zeichencode
// (bei 18 cm Rollenhöhe sichtbar größer/wuchtiger als die case-üblichen 12–16-cm-Blue-Wheels).
// `h` ist deshalb reine Stückzahl × Boxhöhe (Boxen stehen direkt aufeinander), `layers: [1]`,
// weil der Stack bereits der volle Turm ist – nichts kommt obendrauf.
export function dollyStackCase(baseCase, n) {
  return {
    id: `${baseCase.id}-dolly-${n}`,
    builtin: false,
    name: `${baseCase.name} ${n}er (auf Dolly)`,
    content: '',
    category: baseCase.category,
    color: colorFor(baseCase.category),
    l: baseCase.l,
    w: baseCase.w,
    h: n * baseCase.h,
    weight: DOLLY_WEIGHT_KG + n * baseCase.weight,
    tippable: false,
    stackable: true,
    maxTopLoad: null,
    wheelH: DOLLY_HEIGHT_CM,
    dimsInclWheels: false,
    layers: [1],
  };
}
