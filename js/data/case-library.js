// Case-Bibliothek aus der Excel-Tabelle des Nutzers.
//
// Quelle: „Casemaße Complete.xlsx“, Blatt „Data Cases“ (Zeilen 3–144).
// Erzeugt am 2026-09-20 durch ein einmaliges Umwandlungsskript (nicht im Repo,
// lief im Scratchpad); dieses Modul ist das Ergebnis und wird von Hand gepflegt.
//
// 142 Zeilen hatten einen Typ, 137 sind hier gelandet:
// - Sechs 19″-Racks (1, 2, 4, 5, 6, 16 HE) hatten in der Tabelle leere Zellen für
//   l und w; l = w = 60 cm ist dafür geschätzt. Bei h war die Zelle bei vier
//   Racks (1, 4, 5, 16 HE) ebenfalls leer und wurde aus der Höheneinheit
//   gerechnet (siehe Kommentare unten); bei zwei Racks (2, 6 HE) stand dort
//   dagegen bereits eine gemessene Zahl (15 bzw. 32 cm) — die wird unverändert
//   übernommen, es wird nur gerechnet, was in der Quelle wirklich fehlt.
// - Fünf Rigging-Zeilen ohne brauchbares Höhenmaß (leere Zellen bzw. die
//   Zeichenketten „-“/„x“) entfallen ersatzlos:
//   „Motorsteuerung (Koffer -BBM“, „Bolzenkoffer -BBM“, „FD34 x2 -CAB“,
//   „HOF BOLT -CAB“, „Dolly ‚Drohne‘ -CAB“.
//
// Gewerk-Zuordnung (Spalte „Family“ → Gewerk): Fixture/Desk → Licht,
// Rigging → Rigging, DC/Cable → Strom, Rack → Ton, FOH → Video, Case → Sonstiges.
//
// Namens-Suffix: Das Firmenkürzel (Spalte „Company“) wird nur an den Namen
// angehängt, wenn es darin noch gar nicht vorkommt – steht es schon irgendwo im
// Namen (z. B. „D8+ 0,5t CAB x12“), bleibt der Name unverändert.
//
// Gewichte: 89 von 137 Einträgen tragen ein recherchiertes Schätzgewicht (Feld `note`, Text
// „Gewicht geschätzt: …“); die beiden FR10-Zeilen behalten ihre Originalwerte aus der Tabelle
// unverändert. Alle übrigen bleiben bei 0 – lieber 0 kg als eine erfundene Zahl. Quellen und
// Rechenweg: docs/casemasse-gewichte.md.

import { colorFor } from './categories.js';
import { slug } from '../model/slug.js';

// Rollen: Blue Wheel Ø 100 mm, 13 cm (Nutzerangabe 2026-09-28). Die Maße der Liste sind inkl.
// Rollen gemessen (dimsInclWheels) – die Rollenhöhe ändert also nicht, wie viel Platz ein Case im
// Truck belegt, nur wie hoch Rollen und Korpus gezeichnet werden.
const C = (name, category, l, w, h, company, content = '', opts = {}) => ({
  id: `lib-${slug(name)}`, builtin: true, source: 'liste', name, content, category,
  color: colorFor(category), l, w, h, weight: 0, tippable: true, stackable: true,
  maxTopLoad: null, stock: null, wheels: true, wheelH: 13, dimsInclWheels: true,
  company, ...opts,
});

// `legacy: true` (Nutzerwunsch 2026-09-28): in keiner Auswahl mehr gelistet, aber weiter
// vorhanden, damit alte Ladepläne ihre Stücke unverändert behalten. Betrifft die leeren Pack-/
// Transflex-Cases (ersetzt durch „Packcase L×B×H“ in preset-cases.js) und die Traversen aus der
// Liste (Traversenwagen baut man über „+ Traverse hinzufügen“). Seit 2026-09-30 auch FD34 2m
// CUSTOMIZE und Slick: Traversen führt man nicht als Case-Eintrag, und dort hat jedes Profil
// (F34/F40) bereits ein echtes Gewicht (`wagonWeight()` in js/model/truss.js, nie 0).
export const CASE_LIBRARY = [
  // Lakabaum (flach/Transflex) -BBM: auf Nutzerwunsch 2026-09-30 aus der Auswahl entfernt
  // (überflüssig, siehe docs/casemasse-gewichte.md „Nachrecherche 2026-09-30“). Maße/Namen
  // unverändert, damit alte Ladepläne sie weiter finden.
  C('Lakabaum (flach) -BBM', 'Strom', 112, 60, 53, 'BBM', '', { legacy: true }),
  C('Lakabaum (Transflex) -BBM', 'Strom', 120, 60, 75, 'BBM', '', { legacy: true }),
  // Powerlocksatz 10m: 5 Kabel (3 Phasen + N + PE) à 10 m, je Kabel 95 mm² Powerlock (Nutzerangabe
  // 2026-09-30). Kabelgewicht grob aus Kabelsatz-Angeboten hergeleitet (~1,05 kg/m je Ader, keine
  // reine Einzelader-Quelle) + Case-Anteil – Herleitung in docs/casemasse-gewichte.md.
  C('Powerlocksatz 10m -BBM', 'Strom', 112, 120, 53, 'BBM', '', { weight: 80, note: 'Gewicht geschätzt: 5 × 95 mm² Powerlock-Kabel à 10 m + Case' }),
  // Laka Loom: je Case 5× Harting-HAN16-Lastkabel plus 2× Netzwerk, 1× LK24, 1× Erdung, alle in
  // der angegebenen Länge (Nutzerangabe 2026-09-30). „20-30“/„28-40“ = die 5 Han16-Kabel gestaffelt
  // vom kürzesten zum längsten, hier mit der Durchschnittslänge gerechnet. Kabelgewichte über
  // H07RN-F-Richtwerte geschätzt, Herleitung in docs/casemasse-gewichte.md.
  C('Laka Loom 20-30 -CAB', 'Strom', 100, 60, 73, 'CAB', '', { weight: 75, note: 'Gewicht geschätzt: 5 × Han16 + 2 × Netzwerk + LK24 + Erdung, gestaffelt Ø 25 m + Case' }),
  C('Laka Loom 28-40 -CAB', 'Strom', 124, 55, 68, 'CAB', '', { weight: 95, note: 'Gewicht geschätzt: 5 × Han16 + 2 × Netzwerk + LK24 + Erdung, gestaffelt Ø 34 m + Case' }),
  // „5fach“ bleibt bei 0 kg: Bedeutung der Zahl (Nutzerangabe „5 Stück Kabel in der angegebenen
  // Menge“) lässt sich nicht in eine Länge übersetzen – lieber unbekannt als geraten.
  C('Laka Loom 5fach -CAB', 'Strom', 100, 60, 73, 'CAB'),
  C('Laka Loom 45m -CAB', 'Strom', 120, 60, 73, 'CAB', '', { weight: 120, note: 'Gewicht geschätzt: 5 × Han16 + 2 × Netzwerk + LK24 + Erdung, je 45 m (nicht gestaffelt) + Case' }),
  C('Powerlocksatz 10m -CAB', 'Strom', 120, 60, 55, 'CAB', '', { weight: 70, note: 'Gewicht geschätzt: 5 × 95 mm² Powerlock-Kabel à 10 m + Case' }),
  C('Packcase (Transflex) -BBM', 'Sonstiges', 120, 60, 73, 'BBM', '', { legacy: true }),
  C('Packwürfel -BBM', 'Sonstiges', 60, 60, 73, 'BBM', '', { legacy: true }),
  C('V-Mat (Schubladen tipbar) -BBM', 'Sonstiges', 114, 48, 72, 'BBM'),
  C('Transflex gross -CAB', 'Sonstiges', 120, 60, 73, 'CAB', '', { legacy: true }),
  C('Transflex klein (Würfel) -CAB', 'Sonstiges', 60, 60, 73, 'CAB', '', { legacy: true }),
  C('Case klein Adapter -Jäger', 'Sonstiges', 60, 49, 56, 'Jäger'),
  // MA Digital Dimmer 12×2,3kVA, 23 kg netto (malighting.com/product-archive/product/
  // ma-digital-dimmer-12-x-2-3kva-140501) – Dimmer 24ch/48ch sind 2 bzw. 4 solcher Einheiten
  // (Nutzerangabe 2026-09-30).
  C('Dimmer 24ch -CAB', 'Strom', 82, 60, 120, 'CAB', 'MA', { weight: 70, note: 'Gewicht geschätzt: 2 × MA Digital Dimmer 12×2,3kVA à 23 kg + Case' }),
  C('Dimmer 48ch -CAB', 'Strom', 82, 60, 154, 'CAB', 'MA', { weight: 120, note: 'Gewicht geschätzt: 4 × MA Digital Dimmer 12×2,3kVA à 23 kg + Case' }),
  // Leeres Gestell, der Dimmer selbst zählt woanders (Nutzerangabe 2026-09-30) – Standardgewicht
  // 75 kg/m³ wie bei den übrigen leeren Rack-/Dolly-Gehäusen unten, Herleitung in
  // docs/casemasse-gewichte.md.
  C('Dimmerdolly (klein/Rack) -BBM', 'Strom', 207, 60, 160, 'BBM', '', { weight: 150, note: 'Gewicht geschätzt: leeres Gestell, Standard 75 kg/m³' }),
  // Leere Rack-/Dolly-Gehäuse ohne festen Geräteinhalt (Nutzerangabe 2026-09-30): Standardgewicht
  // 75 kg/m³, hergeleitet aus einem realen leeren 19″-Rack (KORN Case 7HE ohne Deckel, 10,6 kg bei
  // ca. 0,14 m³) – kein Einzelgerät, Herleitung in docs/casemasse-gewichte.md.
  C('Datarack braun -CAB', 'Strom', 75, 60, 95, 'CAB', '', { weight: 30, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('Datarack schwarz -CAB', 'Strom', 57, 55, 90, 'CAB', '', { weight: 20, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('Dimmerdolly (klein/Rack) -CAB', 'Strom', 206, 80, 162, 'CAB', '', { weight: 200, note: 'Gewicht geschätzt: leeres Gestell, Standard 75 kg/m³' }),
  C('Markus Tools -ROW only -CAB', 'Strom', 60, 60, 118, 'CAB', '', { weight: 30, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  // MLVT (Moving-Light-Verteiler mit Patchfeld, Nutzerangabe 2026-09-30): kein Katalogprodukt
  // auffindbar, Nutzer-Standardgewicht 75 kg für alle vier Varianten (24ch, 48ch, 63A 19″, 63A
  // Hotpatch ROW).
  C('MLVT 24ch -CAB', 'Strom', 75, 60, 95, 'CAB', '', { weight: 75, note: 'Gewicht geschätzt: Nutzerangabe, kein recherchiertes Produkt – Standardwert für MLVT-Verteiler' }),
  C('MLVT 48ch -CAB', 'Strom', 120, 60, 95, 'CAB', '', { weight: 75, note: 'Gewicht geschätzt: Nutzerangabe, kein recherchiertes Produkt – Standardwert für MLVT-Verteiler' }),
  // Cases unter ca. 45 cm Höhe haben keine Rollen (Nutzerangabe 2026-09-28; `wheels: false`, Maß
  // unverändert): MLVT 63A 19″, ChamSys-Pulte, ZR44, Look Viper NT, SF Data II, SF TourHazer II,
  // Atomic 3000 x4 no wheels und die 19″-Racks von 1 bis 6 HE.
  C('MLVT 63A 19" -CAB', 'Strom', 65, 55, 33, 'CAB', '', { wheels: false, wheelH: 0, weight: 75, note: 'Gewicht geschätzt: Nutzerangabe, kein recherchiertes Produkt – Standardwert für MLVT-Verteiler' }),
  C('Multicore -CAB', 'Strom', 80, 61, 60, 'CAB'),
  C('Multicore LK24 -CAB', 'Strom', 80, 61, 60, 'CAB'),
  C('Multicore LK37 -CAB', 'Strom', 80, 60, 73, 'CAB'),
  // Direkttreffer: INDU Powerlock 400A mit exakt 4×125A+4×63A+2×32A+3×16A (jundc.com/produkt/
  // powerlock-verteiler-4x125a-4x-63a-2x-32a-3x-16a-rcd-im-case), Bauart vom Nutzer bestätigt
  // 2026-09-30.
  C('Powerlock-VT groß -CAB', 'Strom', 147, 80, 94, 'CAB', '', { weight: 140, note: 'Gewicht geschätzt: INDU Powerlock 400A, 4×125A+4×63A+2×32A+3×16A' }),
  // Kein Direkttreffer für 4×63A+2×32A+3×16A; Schätzung zwischen einem kleineren 1×63A-Verteiler
  // (33 kg) und dem großen 4-stufigen oben (140 kg), vom Nutzer als Schätzung akzeptiert.
  C('Powerlock-VT klein -CAB', 'Strom', 85, 60, 83, 'CAB', '', { weight: 50, note: 'Gewicht geschätzt: Verteiler 4×63A+2×32A+3×16A, zwischen Vergleichswerten interpoliert' }),
  C('MLVT 63A Hotpatch ROW -CAB', 'Strom', 80, 55, 99, 'CAB', '', { weight: 75, note: 'Gewicht geschätzt: Nutzerangabe, kein recherchiertes Produkt – Standardwert für MLVT-Verteiler' }),
  C('ChamSys MQ100 -CAB', 'Licht', 71, 67, 29, 'CAB', 'ChamSys', { wheels: false, wheelH: 0, weight: 30, note: 'Gewicht geschätzt: 1 × ChamSys MQ100 à 14.2 kg + Case' }),
  C('ChamSys MQ500 -CAB', 'Licht', 93, 66, 30, 'CAB', 'ChamSys', { wheels: false, wheelH: 0, weight: 45, note: 'Gewicht geschätzt: 1 × ChamSys MQ500 à 32 kg + Case' }),
  // ChamSys MagicQ Compact Wing, 4,0 kg (chamsyslighting.com/product/magicq-compact-wing).
  C('ChamSys Wing Compact -CAB', 'Licht', 60, 35, 20, 'CAB', 'ChamSys', { wheels: false, wheelH: 0, weight: 20, note: 'Gewicht geschätzt: 1 × ChamSys MagicQ Compact Wing à 4 kg + Case' }),
  C('gMA2 FS -CAB', 'Licht', 138, 32, 93, 'CAB', '', { weight: 60, note: 'Gewicht geschätzt: 1 × grandMA2 full-size à 46 kg + Case' }),
  C('gMA2 Light -CAB', 'Licht', 100, 32, 93, 'CAB', '', { weight: 50, note: 'Gewicht geschätzt: 1 × grandMA2 light à 37 kg + Case' }),
  C('Astera AX5 -BBM', 'Licht', 75, 62, 59, 'BBM', 'Astera', { weight: 20, note: 'Gewicht geschätzt: 1 × Astera AX5 à 3.4 kg + Case' }),
  C('MagicBlade -BBM', 'Licht', 138, 60, 55, 'BBM', 'Ayrton', { weight: 40, note: 'Gewicht geschätzt: 1 × MagicBlade à 21.1 kg + Case' }),
  C('Magicblade wide -CAB', 'Licht', 122, 67, 55, 'CAB', 'Ayrton', { weight: 40, note: 'Gewicht geschätzt: 1 × MagicBlade à 21.1 kg + Case' }),
  C('Sharpy x2 gross -CAB', 'Licht', 100, 60, 70, 'CAB', 'Clay Paky', { weight: 65, note: 'Gewicht geschätzt (Case breiter als „klein“, daher als Sharpy Plus angenommen): 2 × Sharpy Plus à 23 kg + Case' }),
  C('Sharpy x2 klein -CAB', 'Licht', 100, 48, 70, 'CAB', 'Clay Paky', { weight: 55, note: 'Gewicht geschätzt (Case schmaler als „gross“, daher als Legacy Sharpy angenommen): 2 × Sharpy (Legacy) à 19 kg + Case' }),
  C('B-Eye K20 x2 -Jäger', 'Licht', 116, 54, 80, 'Jäger', 'Clay Paky', { weight: 60, note: 'Gewicht geschätzt: 2 × B-Eye K20 à 21 kg + Case' }),
  C('B-Eye K10 x4 -CAB', 'Licht', 120, 60, 70, 'CAB', 'Clay Paky', { weight: 80, note: 'Gewicht geschätzt: 4 × B-Eye K10 à 15 kg + Case' }),
  C('ETC S4 x6 -CAB', 'Licht', 90, 60, 90, 'CAB', 'ETC', { weight: 55, note: 'Gewicht geschätzt: 6 × ETC Source Four (19°/26°/36°/50°) à 6.3 kg + Case' }),
  C('4lite x6 -CAB', 'Licht', 100, 55, 85, 'CAB', 'Generic'),
  C('Asym Flood x1 -CAB', 'Licht', 60, 50, 57, 'CAB', 'Generic'),
  C('Asym Flood x6 -CAB', 'Licht', 120, 60, 60, 'CAB', 'Generic'),
  C('2-light x12 -CAB', 'Licht', 120, 60, 53, 'CAB', 'Generic'),
  C('8-light x6 -CAB', 'Licht', 100, 50, 110, 'CAB', 'Generic'),
  C('4-light HORZ x8 -CAB', 'Licht', 135, 60, 106, 'CAB', 'Generic'),
  C('Dolly 6-Bar -CAB', 'Licht', 210, 70, 190, 'CAB', 'Generic'),
  C('Dolly 2kW -CAB', 'Licht', 120, 80, 163, 'CAB', 'Generic'),
  C('Dolly 6-Bar silber -CAB', 'Licht', 215, 60, 193, 'CAB', 'Generic'),
  C('X4-Bar 20 -BBM', 'Licht', 130, 60, 58, 'BBM', 'GLP', { weight: 35, note: 'Gewicht geschätzt: 1 × X4 Bar 20 à 16 kg + Case' }),
  C('JDC-1 lang -Motion', 'Licht', 118, 55, 50, 'Motion', 'GLP', { weight: 25, note: 'Gewicht geschätzt: 1 × JDC-1 à 11.6 kg + Case' }),
  // Namen (und Stückzahl im Hinweistext) der beiden Cube-Zeilen auf Nutzerwunsch 2026-10-09 getauscht:
  // das Case mit „(4)“ ist das größere (99 × 60 × 58). IDs, Maße und Gewichte blieben, wo sie waren,
  // damit alte Ladepläne ihre Stücke behalten (eigene Entscheidung); die Gewichte sind nicht
  // nachgerechnet. Siehe docs/casemasse-gewichte.md.
  C('JDC-1 Cube -RentALL', 'Licht', 60, 60, 58, 'RentAll', 'GLP', { id: 'lib-jdc-1-cube-4-rentall', weight: 60, note: 'Gewicht geschätzt: 1 × JDC-1 à 11.6 kg + Case' }),
  C('JDC-1 Cube (4) -RentALL', 'Licht', 99, 60, 58, 'RentAll', 'GLP', { id: 'lib-jdc-1-cube-rentall', weight: 25, note: 'Gewicht geschätzt: 4 × JDC-1 à 11.6 kg + Case' }),
  C('JDC-1 lang (6) -RentALL', 'Licht', 99, 60, 58, 'RentAll', 'GLP', { weight: 85, note: 'Gewicht geschätzt: 6 × JDC-1 à 11.6 kg + Case' }),
  C('GLP X4-Bar-20 x4 -CAB', 'Licht', 131, 60, 58, 'CAB', 'GLP', { weight: 80, note: 'Gewicht geschätzt: 4 × X4 Bar 20 à 16 kg + Case' }),
  C('JDC-1 x6 -CAB', 'Licht', 120, 60, 58, 'CAB', 'GLP', { weight: 85, note: 'Gewicht geschätzt: 6 × JDC-1 à 11.6 kg + Case' }),
  C('AF-2 -BBM', 'Licht', 80, 40, 95, 'BBM', 'Jem', { weight: 30, note: 'Gewicht geschätzt: 1 × AF-2 à 15.7 kg + Case' }),
  C('AF-1 -CAB', 'Licht', 44, 23, 58, 'CAB', 'Jem', { weight: 25, note: 'Gewicht geschätzt: 1 × AF-1 à 10 kg + Case' }),
  C('ZR44 -CAB', 'Licht', 78, 37, 34, 'CAB', 'Jem', { wheels: false, wheelH: 0, weight: 35, note: 'Gewicht geschätzt: 1 × ZR44 à 19 kg + Case' }),
  C('Das K - Annahme -Kraftklub', 'Licht', 320, 80, 200, 'Kraftklub', 'Kraftklub'),
  C('Look Viper NT -CAB', 'Licht', 57, 30, 36, 'CAB', 'Look Solutions', { wheels: false, wheelH: 0, weight: 25, note: 'Gewicht geschätzt: 1 × Look Viper NT à 8.6 kg + Case' }),
  C('Atomic 3000 LEDx8 -CAB', 'Licht', 120, 60, 72, 'CAB', 'Martin', { weight: 85, note: 'Gewicht geschätzt: 8 × Atomic 3000 LED à 7.8 kg + Case' }),
  C('Atomic 3000 x4 no wheels -CAB', 'Licht', 120, 60, 36.5, 'CAB', 'Martin', { wheels: false, weight: 45, note: 'Gewicht geschätzt: 4 × Atomic 3000 LED à 7.8 kg + Case' }),
  C('Atomic 3000 x4 wheels -CAB', 'Licht', 120, 60, 50, 'CAB', 'Martin', { weight: 45, note: 'Gewicht geschätzt: 4 × Atomic 3000 LED à 7.8 kg + Case' }),
  C('Atomic 3000 x8 -CAB', 'Licht', 120, 60, 73, 'CAB', 'Martin', { weight: 85, note: 'Gewicht geschätzt: 8 × Atomic 3000 LED à 7.8 kg + Case' }),
  C('Mac Aura x6-CAB', 'Licht', 121, 60, 76, 'CAB', 'Martin', { weight: 60, note: 'Gewicht geschätzt: 6 × Mac Aura à 6.5 kg + Case' }),
  C('Mac Axiom x2 -CAB', 'Licht', 119, 60, 95, 'CAB', 'Martin', { weight: 75, note: 'Gewicht geschätzt: 2 × Mac Axiom à 24.8 kg + Case' }),
  C('Mac Quantum w x2 -CAB', 'Licht', 80, 60, 100, 'CAB', 'Martin', { weight: 60, note: 'Gewicht geschätzt: 2 × Mac Quantum Wash à 21 kg + Case' }),
  C('Mac Viper x2 -CAB', 'Licht', 122, 60, 100, 'CAB', 'Martin', { weight: 100, note: 'Gewicht geschätzt (Variante unklar, Ø aus Performance/Profile/Wash DX): 2 × Mac Viper à 36.4 kg + Case' }),
  C('Mac Ultra x2 -CAB', 'Licht', 150, 60, 100, 'CAB', 'Martin', { weight: 125, note: 'Gewicht geschätzt: 2 × Mac Ultra à 44 kg + Case' }),
  C('Mac Ultra x1-CAB', 'Licht', 76, 60, 100, 'CAB', 'Martin', { weight: 60, note: 'Gewicht geschätzt: 1 × Mac Ultra à 44 kg + Case' }),
  C('MDG Tourpack -BBM', 'Licht', 103, 55, 92, 'BBM', 'MDG', { weight: 85, note: 'Gewicht geschätzt: MDG Tourpack (Hazer inkl. Tourpack-Cradle) ca. 84 kg lt. Datenblatt' }),
  C('MDG Tourpack -CAB', 'Licht', 109, 60, 96, 'CAB', 'MDG', { weight: 85, note: 'Gewicht geschätzt: MDG Tourpack (Hazer inkl. Tourpack-Cradle) ca. 84 kg lt. Datenblatt' }),
  C('BMFL Spot -BBM', 'Licht', 143, 35, 88, 'BBM', 'Robe', { weight: 55, note: 'Gewicht geschätzt: 1 × BMFL Spot à 36 kg + Case' }),
  C('Robe 2500p x1 -CAB', 'Licht', 72, 60, 113, 'CAB', 'Robe', { weight: 60, note: 'Gewicht geschätzt: 1 × ColorSpot 2500E AT à 42.5 kg + Case' }),
  C('Robe 2500p x2 -CAB', 'Licht', 121, 60, 113, 'CAB', 'Robe', { weight: 120, note: 'Gewicht geschätzt: 2 × ColorSpot 2500E AT à 42.5 kg + Case' }),
  C('Robe 2500w x1 -CAB', 'Licht', 72, 60, 105, 'CAB', 'Robe', { weight: 60, note: 'Gewicht geschätzt: 1 × ColorWash 2500E AT à 41 kg + Case' }),
  C('Robe 2500w x2 -CAB', 'Licht', 121, 60, 105, 'CAB', 'Robe', { weight: 110, note: 'Gewicht geschätzt: 2 × ColorWash 2500E AT à 41 kg + Case' }),
  C('Robin 100 LED Beam -CAB', 'Licht', 100, 59, 57, 'CAB', 'Robe', { weight: 20, note: 'Gewicht geschätzt: 1 × Robin 100 LED Beam à 4.5 kg + Case' }),
  C('Aramis -CAB', 'Licht', 189, 60, 82, 'CAB', 'Robert Juliat', { weight: 95, note: 'Gewicht geschätzt: 1 × Aramis à 59 kg + Case' }),
  C('Korrigan -CAB', 'Licht', 133, 60, 63, 'CAB', 'Robert Juliat', { weight: 65, note: 'Gewicht geschätzt: 1 × Korrigan à 43 kg + Case' }),
  C('Q7 lang -BBM', 'Licht', 120, 60, 53, 'BBM', 'SGM', { weight: 25, note: 'Gewicht geschätzt: 1 × SGM Q-7 à 8.1 kg + Case' }),
  C('SGM Q7 x4 -CAB', 'Licht', 60, 60, 75, 'CAB', 'SGM', { weight: 45, note: 'Gewicht geschätzt: 4 × SGM Q-7 à 8.1 kg + Case' }),
  C('SGM Q7 x6 -CAB', 'Licht', 90, 60, 72, 'CAB', 'SGM', { weight: 65, note: 'Gewicht geschätzt: 6 × SGM Q-7 à 8.1 kg + Case' }),
  C('SF Fan Fogger -CAB', 'Licht', 86, 40, 86, 'CAB', 'Smoke Factory', { weight: 40, note: 'Gewicht geschätzt: 1 × SF Fan Fogger à 24 kg + Case' }),
  C('SF Data II -CAB', 'Licht', 64, 35, 35, 'CAB', 'Smoke Factory', { wheels: false, wheelH: 0, weight: 30, note: 'Gewicht geschätzt: 1 × SF Data II à 12.8 kg + Case' }),
  C('SF TourHazer II -CAB', 'Licht', 53, 25, 41, 'CAB', 'Smoke Factory', { wheels: false, wheelH: 0, weight: 30, note: 'Gewicht geschätzt: 1 × SF TourHazer II à 16.5 kg + Case' }),
  // Ayrton IntelliPix-R, 15,9 kg (ambersphere.com/product/intellipix-xt) – Marke vom Nutzer
  // 2026-09-30 bestätigt, nicht aus dem Firmenfeld „BBM“ ableitbar.
  C('Intellipix -BBM', 'Licht', 120, 67, 73, 'BBM', '', { weight: 40, note: 'Gewicht geschätzt: 1 × Ayrton IntelliPix-R à 15.9 kg + Case' }),
  C('Sunstrips Sandwich -CAB', 'Licht', 220, 60, 125, 'CAB'),
  C('ETC S4 x8 -CAB', 'Licht', 119, 60, 83, 'CAB', '', { weight: 75, note: 'Gewicht geschätzt: 8 × ETC Source Four (19°/26°/36°/50°) à 6.3 kg + Case' }),
  C('Q7 x4 -CAB', 'Licht', 60, 60, 75, 'CAB', '', { weight: 45, note: 'Gewicht geschätzt: 4 × SGM Q-7 à 8.1 kg + Case' }),
  C('Gunnar Arkaos Server -CAB', 'Video', 96, 62, 76, 'CAB'),
  C('Gunnar Monitor -CAB', 'Video', 48, 48, 48, 'CAB'),
  C('Gunnar Tools -CAB', 'Video', 80, 60, 91, 'CAB'),
  C('D8+ 0,5t -BBM', 'Rigging', 67, 55, 60, 'BBM', 'Motor', { weight: 30, note: 'Gewicht geschätzt: 1 × D8+ 0,5t à 17 kg + Case' }),
  C('D8+ 1t -BBM', 'Rigging', 80, 60, 60, 'BBM', 'Motor', { weight: 45, note: 'Gewicht geschätzt: 1 × D8+ 1t à 31 kg + Case' }),
  C('D8 2t CAB', 'Rigging', 80, 60, 60, 'CAB', 'Motor', { weight: 55, note: 'Gewicht geschätzt: 1 × D8 2t à 39 kg + Case' }),
  C('D8+ 0,25t CAB', 'Rigging', 60, 50, 56, 'CAB', 'Motor', { weight: 25, note: 'Gewicht geschätzt: 1 × D8+ 0,25t à 10.2 kg + Case' }),
  C('D8+ 0,5t CAB', 'Rigging', 60, 50, 56, 'CAB', 'Motor', { weight: 30, note: 'Gewicht geschätzt: 1 × D8+ 0,5t à 17 kg + Case' }),
  // Länge/Breite der drei x4/x8/x12-Cases auf Nutzerwunsch 2026-10-09 getauscht (240 cm ist die Länge).
  C('D8+ 0,5t CAB x12', 'Rigging', 240, 150, 56, 'CAB', 'Motor', { weight: 285, note: 'Gewicht geschätzt: 12 × D8+ 0,5t à 17 kg + Case' }),
  C('D8+ 0,5t CAB x4', 'Rigging', 240, 50, 56, 'CAB', 'Motor', { weight: 95, note: 'Gewicht geschätzt: 4 × D8+ 0,5t à 17 kg + Case' }),
  C('D8+ 0,5t CAB x8', 'Rigging', 240, 100, 56, 'CAB', 'Motor', { weight: 190, note: 'Gewicht geschätzt: 8 × D8+ 0,5t à 17 kg + Case' }),
  C('D8+ 1t PlusLite -cab', 'Rigging', 69, 60, 71, 'CAB', 'Motor', { weight: 45, note: 'Gewicht geschätzt: 1 × D8+ 1t à 31 kg + Case' }),
  // Auf Nutzerwunsch 2026-09-30 aus der Auswahl entfernt (überflüssig).
  C('63A VT Haube -BBM', 'Ton', 60, 60, 73, 'BBM', '', { legacy: true }),
  // Die folgenden 19″-Racks von 1 bis 6 HE rechnen ihre Höhe aus der Höheneinheit, wo die Tabelle
  // sie nicht nennt: Aufschlag für Deckel + Boden aus den drei gemessenen Racks abgeleitet
  // (h_gemessen − HE × 4,45 cm): 2 HE → 15 − 8,9 = 6,1 cm; 3 HE → 19 − 13,35 = 5,65 cm;
  // 6 HE → 32 − 26,7 = 5,3 cm. Mittelwert ≈ 5,68 cm, also h = HE × 4,45 + 5,68.
  //
  // Diese kleinen Racks haben keine Rollen (nur der 16-HE-Eintrag heißt „on wheels“, weil der
  // Zusatz auf die anderen nicht zutrifft). Die gemessenen Werte bestätigen das: ein 2-HE-Case mit
  // 15 cm Gesamthöhe hätte bei 13 cm Rollenhöhe nur 2 cm Korpus, ein 3-HE-Case mit 19 cm nur 6 cm.
  // Daher `wheels: false, wheelH: 0`; das erlaubt auch für 1 HE den abgeleiteten Wert statt einer
  // künstlichen Mindesthöhe.
  C('19" 16HE on wheels-CAB', 'Ton', 60, 60, 76.9, 'CAB'),  // 16 HE: h = 16 * 4,45 + 5,68, l/w geschätzt 60 x 60 – hat Rollen (Name)
  C('19" 1HE -CAB', 'Ton', 60, 60, 10.1, 'CAB', '', { wheels: false, wheelH: 0 }),  // 1 HE: h = 1 * 4,45 + 5,68, l/w geschätzt 60 x 60, keine Rollen
  C('19" 2HE -CAB', 'Ton', 60, 60, 15, 'CAB', '', { wheels: false, wheelH: 0 }),  // 2 HE: h = 15 cm gemessen (Quelle), l/w geschätzt 60 x 60, keine Rollen
  C('19" 3HE -CAB', 'Ton', 63, 54, 19, 'CAB', '', { wheels: false, wheelH: 0 }),  // 3 HE: gemessen (Quelle), keine Rollen
  C('19" 4HE -CAB', 'Ton', 60, 60, 23.5, 'CAB', '', { wheels: false, wheelH: 0 }),  // 4 HE: h = 4 * 4,45 + 5,68, l/w geschätzt 60 x 60, keine Rollen
  C('19" 5HE -CAB', 'Ton', 60, 60, 27.9, 'CAB', '', { wheels: false, wheelH: 0 }),  // 5 HE: h = 5 * 4,45 + 5,68, l/w geschätzt 60 x 60, keine Rollen
  C('19" 6HE -CAB', 'Ton', 60, 60, 32, 'CAB', '', { wheels: false, wheelH: 0 }),  // 6 HE: h = 32 cm gemessen (Quelle), l/w geschätzt 60 x 60, keine Rollen
  // Leere Rack-/Dolly-Gehäuse ohne festen Geräteinhalt (Nutzerangabe 2026-09-30): Standardgewicht
  // 75 kg/m³, Herleitung siehe docs/casemasse-gewichte.md „Nachrecherche 2026-09-30“.
  C('Rack 16HE Deckel -CAB', 'Ton', 75, 60, 95, 'CAB', '', { weight: 30, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('Rack Amp 12 HE Schieber -CAB', 'Ton', 80, 60, 85, 'CAB', '', { weight: 30, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('Schubladencase 90 -CAB', 'Ton', 60, 61, 90, 'CAB', '', { weight: 25, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('Dolly Rack 28 HEx2 -CAB', 'Ton', 120, 80, 160, 'CAB', '', { weight: 115, note: 'Gewicht geschätzt: leeres Rack, Standard 75 kg/m³' }),
  C('MoCo 12ch -CAB', 'Rigging', 70, 60, 90, 'CAB', 'MoCo'),
  C('MoCo 32ch -CAB', 'Rigging', 80, 60, 113, 'CAB', 'MoCo'),
  C('Truss lose 40er -BBM', 'Rigging', 200, 40, 40, 'BBM', '', { legacy: true }),
  C('Trussdolly 40er -BBM', 'Rigging', 300, 80, 210, 'BBM', '', { legacy: true }),
  C('FD34 2m CUSTOMIZE -CAB', 'Rigging', 200, 60, 135, 'CAB', '', { legacy: true }),
  C('MLT 120 x2 -CAB', 'Rigging', 125, 60.5, 210, 'CAB', '', { legacy: true }),
  C('MLT 160 x2 -CAB', 'Rigging', 165, 60.5, 210, 'CAB', '', { legacy: true }),
  C('MLT 240 x2 -CAB', 'Rigging', 245, 60.5, 210, 'CAB', '', { legacy: true }),
  // Auf Nutzerwunsch 2026-09-30 aus der Auswahl entfernt (überflüssig).
  C('Rigpack -CAB', 'Rigging', 90, 60, 65, 'CAB', '', { legacy: true }),
  C('Slick -CAB', 'Rigging', 252, 40, 189, 'CAB', '', { legacy: true }),
  C('SkyPanel 120 x2-AED', 'Licht', 155, 60, 80, 'AED', 'ARRI', { weight: 65, note: 'Gewicht geschätzt: 2 × SkyPanel S120 à 16.5 kg + Case' }),
  C('Strike Array4 x4 - CAB', 'Licht', 100, 60, 80, 'CAB', 'Chauvet', { weight: 70, note: 'Gewicht geschätzt: 4 × Strike Array 4 à 13 kg + Case' }),
  C('FR10 x2 -RentAll', 'Licht', 100, 60, 66, 'RentAll', 'GLP', { weight: 73.52 }),
  C('FR10 x6 -Motion', 'Licht', 110, 80, 113, 'Motion', 'GLP', { weight: 276 }),
  C('BMFL x2 -Motion', 'Licht', 145, 60, 88, 'Motion', 'Robe', { weight: 105, note: 'Gewicht geschätzt: 2 × BMFL Spot à 36 kg + Case' }),
  C('Base Station -Motion', 'Licht', 120, 60, 66, 'Motion', 'Robe'),
  C('D8+ 1t ProStage -cab', 'Rigging', 60, 60, 61, 'CAB', 'Motor', { weight: 45, note: 'Gewicht geschätzt: 1 × D8+ 1t à 31 kg + Case' }),
  C('D8+ 1t ProStage -motion', 'Rigging', 60, 60, 61, 'Motion', 'Motor', { weight: 45, note: 'Gewicht geschätzt: 1 × D8+ 1t à 31 kg + Case' }),
  C('motion Cam', 'Licht', 38, 34, 57, 'Motion', 'Robe'),
];
