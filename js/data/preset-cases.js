// Standardvorlagen (nur lesbar). Der Inhalt steht seit V 0.17.0 in data/standard.json, einer
// Sammlung wie jede andere (docs/nyx-sammlungen.md). Dieses Modul behält nur den alten Namen
// PRESET_CASES für Verbraucher und Tests und enthält selbst keine Daten. Die Begründungen stehen
// hier, weil JSON keine Kommentare kann. Recherche und Rechenweg der Gewichte: docs/casemasse-
// gewichte.md und docs/mlt-truss-gewichte.md.
//
// Richtwerte: Vorlagen tragen den Hinweis „Richtwert – Maße und Gewicht an dein Case anpassen“.
// Maße sind inklusive Rollen (dimsInclWheels), Rollenhöhe 13 cm (Blue Wheel Ø 100 mm).
//
// Packcases (Truckmaß): Breiten 60/80/120 cm, die in 240 cm Innenbreite aufgehen (Megacase,
// Gäng-Case). Je Maß genau ein leerer Standard-Pack- bzw. Kabelcase, neutral benannt
// (Nutzerwunsch 2026-09-28). Gewicht als Standardwert des Nutzers (2026-09-30): Das Packcase
// 120×60×60 ohne bzw. 120×60×80 mit Rollen wiegt 100 kg; alle anderen werden nach Volumen
// ab- bzw. aufgestuft. Formel: PACK_REF_KG × Volumen / PACK_REF_VOLUME (aktuell 100 kg bei
// 120×60×80 cm). Für einen anderen Standard PACK_REF_KG ändern, für eine andere Referenzgröße
// zusätzlich PACK_REF_VOLUME. Die früheren „Kabelcase/Packcase Truckmaß“-Vorlagen und die
// 29er-Traversen sind `legacy`, damit alte Ladepläne sie behalten (Maße und Gewichte unverändert).
//
// Pre-Rig-Traversen (Moving-Light-Truss, H.O.F. MLT / Prolyte S36PR): EIN Stück ist EINE stehende
// Traverse auf Beinen/Rollwagen (standing: true, count immer 1). Klassische F34/F40-Wagen mit
// mehreren Stücken gibt es nicht als Vorlage, weil Wagengrößen firmenabhängig sind; sie entstehen
// über den Traversen-Dialog. Die Standfläche ist STAND_FOOTPRINT_W (62 cm: vier Stück nebeneinander
// im 40-Tonner), die Höhe je Modell standH. Alle stehen 115 cm hoch; MLT ONE war vorher mit 75 cm
// geschätzt und wurde am 2026-09-25 auf Nutzerangabe korrigiert. TWO/THREE/FOUR und Prolyte S36PR
// stehen auf einem geschlossenen Alu-Rahmen (`frame: 'closed'`), MLT ONE auf der einfachen Version
// mit offenen Kurzseiten (ohne `frame`, s. standingTrussShape() in truss.js). Das Stückgewicht ist
// recherchiert. BASE_KG = 25 kg ist dagegen ein eigener Richtwert für Grundplatte, Beine und Rollen
// (kein Herstellerwert) und wird zum Stückgewicht addiert.
//
// Gewerk Audio (Nutzerwunsch 2026-10-06): PA-Lautsprecher von sechs Herstellern, recherchiert mit
// Quelle; die volle Herleitung steht in docs/casemasse-gewichte.md. Neutral wie alle Vorlagen:
// kein `company`-Feld, das steht in der Bibliothek für die Verleihfirma. Die 13 Einzelboxen
// haben `tippable: false` und `wheelH: 0`: Array-Tops werden geflogen oder gestapelt, nie getippt,
// und tragen als Einzelbox keine Rollen. Jede bekommt `dollyPrompt: true`, damit beim Einladen der
// Dolly-Dialog nach Schwerlastrollen fragt (js/ui/dolly-wizard.js, js/model/audioDolly.js).
// Dolly-Stacks entstehen nur über diesen Dialog. Array-Tops stehen stehend wie geflogen (0°-Splay).
// Subwoofer sind liegend transportiert (Nutzerangabe); ihre Maße liegend sind eine Umrechnung der
// recherchierten Maße (kleinste Achse wird zur Höhe), keine neue Zahl. Eine Stückzahl pro Dolly
// nennt keine Herstellerangabe; der Dolly-Dialog fragt sie ab.
//
// Gehäusefarbe der Lautsprecher (nur für die 3D-Ansicht, js/ui/view3d.js): L-Acoustics gibt laut
// K2 Rigging Manual, Appendix C „Dark Grey brown“ an (K1-SB ebenso, deshalb auch für KS28). Der
// Hex-Wert ist eine eigene optische Annäherung an diese Angabe, kein Farbcode des Herstellers.
// Alle anderen sind schwarz, weil für sie keine Quelle zu einer anderen Farbe vorliegt.
//
// Legacy-Vorlagen (`legacy: true`): nicht mehr gelistet, aber für alte Ladepläne erhalten. Dazu
// gehören die Kabel-/Packcase-Truckmaß-Vorlagen von oben und zwei ältere 29er-Traversen-Vorlagen.

import standard from '../../data/standard.json' with { type: 'json' };

export const PRESET_CASES = standard.cases;
