import { colorFor } from './categories.js';
import { trussDims, STAND_FOOTPRINT_W } from '../model/truss.js';

const NOTE = 'Richtwert – Maße und Gewicht an dein Case anpassen';
const P = (id, name, category, l, w, h, weight, opts = {}) => ({
  id: `preset-${id}`, builtin: true, name, content: '', category, color: colorFor(category),
  l, w, h, weight, tippable: true, stackable: true, maxTopLoad: null, stock: null, wheelH: 13, // Blue Wheel Ø 100 mm, Maß inkl. Rollen
  dimsInclWheels: true, note: NOTE, ...opts,
});
// Pre-Rig-Traversen (H.O.F. MLT/Prolyte S36PR): EIN Stück ist EINE stehende Traverse auf Beinen/
// Rollwagen (standing:true, count immer 1). Klassische F34/F40-Wagen mit mehreren Stücken gibt es
// nicht als Vorlage (Wagengrößen sind firmenabhängig) – sie entstehen über den Traversen-Dialog.
// Standfläche ist STAND_FOOTPRINT_W (62 cm – 4 Stück nebeneinander im 40-Tonner), Höhe je Modell
// (standH). BASE_KG ist ein Richtwert für Grundplatte+Beine+Rollen (kein Herstellerwert, s.
// docs/mlt-truss-gewichte.md) – das Stückgewicht selbst ist recherchiert.
const BASE_KG = 25;
// frame: 'closed' = geschlossener Alu-Rahmen (ab MLT TWO, Prolyte S36PR); ohne = offener Rahmen
// mit zwei Längsholmen (MLT ONE), s. standingTrussShape() in truss.js.
const MLT = (id, name, length, pieceWeight, standH, frame) => {
  const truss = { length, width: STAND_FOOTPRINT_W, count: 1, standing: true, height: standH, ...(frame ? { frame } : {}) };
  const { l, w, h } = trussDims(truss);
  const weight = Math.round(pieceWeight + BASE_KG);
  return P(id, name, 'Rigging', l, w, h, weight,
    { kind: 'truss', truss, tippable: false, wheelH: 0, layers: [1, 2] });
};

// Truckmaß (EU): Breiten 60/80/120 cm, gehen in 240 cm Innenbreite auf (Megacase, Gäng-Case).
// Leere Standard-Pack-/Kabelcases: je Maß genau eines, neutral benannt (Nutzerwunsch 2026-09-28).
// Gewicht als Standardwert des Nutzers (2026-09-30): das Standard-Packcase 120×60×60 ohne bzw.
// 120×60×80 mit Rollen wiegt 100 kg, alle anderen nach Volumen ab- bzw. aufgestuft
// (docs/casemasse-gewichte.md). Ein anderer Standard: PACK_REF_KG ändern (für eine andere
// Referenzgröße zusätzlich PACK_REF_VOLUME). Die früheren „Kabelcase/Packcase Truckmaß“-Vorlagen
// und die leeren Pack-/Transflex-Cases aus der Liste bleiben unten bzw. in case-library.js als
// `legacy` für alte Ladepläne erhalten.
const PACK_REF_VOLUME = 120 * 60 * 80;
const PACK_REF_KG = 100;
const PACK = (l, w, h) => P(`packcase-${l}x${w}x${h}`, `Packcase ${l}×${w}×${h}`, 'Sonstiges', l, w, h,
  Math.round(PACK_REF_KG * l * w * h / PACK_REF_VOLUME));

// Gehäusefarbe der Lautsprecher-Vorlagen (nur für die 3D-Ansicht, js/ui/view3d.js). L-Acoustics:
// Finish laut K2 Rigging Manual, Appendix C „Dark Grey brown“ (K1-SB ebenso, deshalb auch für
// KS28) – der Hex-Wert ist eine eigene optische Annäherung an diese Angabe, kein Farbcode des
// Herstellers. Alle anderen: schwarz, weil für sie keine Quelle zu einer anderen Farbe vorliegt.
const LA_FINISH = '#3a332e';
const SPEAKER_BLACK = '#1b1c1e';

export const PRESET_CASES = [
  PACK(60, 60, 60),
  PACK(60, 60, 73),
  PACK(80, 60, 60),
  PACK(120, 60, 60),
  PACK(120, 60, 73),
  PACK(120, 60, 80),
  PACK(120, 80, 80),
  P('rack-12he', '19″-Rack 12 HE auf Rollen', 'Ton', 80, 60, 85, 90, { tippable: false }),
  P('rack-20he', '19″-Rack 20 HE auf Rollen', 'Ton', 80, 60, 120, 140, { tippable: false, maxTopLoad: 80, layers: [1] }),
  P('mh-2er', 'Moving-Head-Case (2 Stück)', 'Licht', 120, 60, 85, 120, { tippable: false }),
  P('led-8er', 'LED-Wall-Case (8 Panels)', 'Video', 120, 60, 110, 220, { tippable: false, layers: [1, 2] }),
  P('distro-63a', 'Stromverteiler 63 A', 'Strom', 80, 60, 90, 110, { tippable: false }),
  P('foh-pult', 'FOH-Pult-Case', 'Ton', 150, 80, 110, 160, { tippable: false, stackable: false, layers: [1] }),
  // Pre-Rig-Traversen (Moving-Light-Truss): EIN Stück ist EINE stehende Traverse auf Beinen/
  // Rollwagen, keine gestapelten Mehrfachstücke (s. MLT() oben). Stückgewichte und Standhöhe
  // recherchiert, siehe docs/mlt-truss-gewichte.md. Alle stehen gleich hoch (115 cm, MLT ONE nach
  // Nutzerangabe 2026-09-25 von geschätzten 75 cm korrigiert). TWO/THREE/FOUR und Prolyte S36PR
  // (kein eigenes „MLT“ bei Prolyte, S36PRF/S36PRA ist der Gegenpart) stehen auf einem geschlossenen
  // Alu-Rahmen, MLT ONE auf der einfachen Version mit offenen Kurzseiten.
  MLT('hof-mlt1-160', 'Traversenwagen MLT ONE 1,6 m – H.O.F.', 160, 28.5, 115),
  MLT('hof-mlt1-240', 'Traversenwagen MLT ONE 2,4 m – H.O.F.', 240, 38.8, 115),
  MLT('hof-mlt1-320', 'Traversenwagen MLT ONE 3,2 m – H.O.F.', 320, 46.6, 115),
  MLT('hof-mlt2-120', 'Traversenwagen MLT TWO 1,2 m – H.O.F.', 120, 36.8, 115, 'closed'),
  MLT('hof-mlt2-160', 'Traversenwagen MLT TWO 1,6 m – H.O.F.', 160, 41.8, 115, 'closed'),
  MLT('hof-mlt2-200', 'Traversenwagen MLT TWO 2,0 m – H.O.F.', 200, 46.7, 115, 'closed'),
  MLT('hof-mlt2-240', 'Traversenwagen MLT TWO 2,4 m – H.O.F.', 240, 50.8, 115, 'closed'),
  MLT('hof-mlt2-300', 'Traversenwagen MLT TWO 3,0 m – H.O.F.', 300, 57.7, 115, 'closed'),
  MLT('hof-mlt2-320', 'Traversenwagen MLT TWO 3,2 m – H.O.F.', 320, 60.1, 115, 'closed'),
  MLT('hof-mlt3-120', 'Traversenwagen MLT THREE 1,2 m – H.O.F.', 120, 34.7, 115, 'closed'),
  MLT('hof-mlt3-160', 'Traversenwagen MLT THREE 1,6 m – H.O.F.', 160, 39.4, 115, 'closed'),
  MLT('hof-mlt3-200', 'Traversenwagen MLT THREE 2,0 m – H.O.F.', 200, 44.4, 115, 'closed'),
  MLT('hof-mlt3-240', 'Traversenwagen MLT THREE 2,4 m – H.O.F.', 240, 48.9, 115, 'closed'),
  MLT('hof-mlt3-300', 'Traversenwagen MLT THREE 3,0 m – H.O.F.', 300, 55.6, 115, 'closed'),
  MLT('hof-mlt3-320', 'Traversenwagen MLT THREE 3,2 m – H.O.F.', 320, 58.0, 115, 'closed'),
  MLT('hof-mlt4-150', 'Traversenwagen MLT FOUR 1,5 m – H.O.F.', 150, 60.0, 115, 'closed'),
  MLT('hof-mlt4-240', 'Traversenwagen MLT FOUR 2,4 m – H.O.F.', 240, 71.5, 115, 'closed'),
  MLT('hof-mlt4-300', 'Traversenwagen MLT FOUR 3,0 m – H.O.F.', 300, 83.5, 115, 'closed'),
  MLT('prolyte-s36prf-122', 'Traversenwagen S36PRF fest 1,22 m – Prolyte', 122, 25.27, 115, 'closed'),
  MLT('prolyte-s36prf-244', 'Traversenwagen S36PRF fest 2,44 m – Prolyte', 244, 37.10, 115, 'closed'),
  MLT('prolyte-s36prf-305', 'Traversenwagen S36PRF fest 3,05 m – Prolyte', 305, 43.20, 115, 'closed'),
  MLT('prolyte-s36pra-122', 'Traversenwagen S36PRA flexibel 1,22 m – Prolyte', 122, 27.00, 115, 'closed'),
  MLT('prolyte-s36pra-244', 'Traversenwagen S36PRA flexibel 2,44 m – Prolyte', 244, 38.70, 115, 'closed'),
  MLT('prolyte-s36pra-305', 'Traversenwagen S36PRA flexibel 3,05 m – Prolyte', 305, 45.16, 115, 'closed'),

  // Gewerk Audio (Nutzerwunsch 2026-10-06): PA-Lautsprecher, sechs Hersteller, recherchiert mit
  // Quelle – docs/casemasse-gewichte.md hat die volle Herleitung, hier nur die kurze Fassung.
  // Neutral wie alle Vorlagen hier: kein `company`-Feld (das steht in case-library.js für die
  // Verleihfirma des Nutzers, nicht für den Geräte-Hersteller). `tippable: false` und
  // `wheelH: 0` bei den 13 Einzelboxen unten – Array-Tops werden geflogen/gestapelt, nie
  // getippt, und tragen als Einzelbox selbst keine Rollen; Subs sind schon in ihrer liegenden
  // Transportlage angelegt (s. u.), kein weiteres Tippen nötig. Jede der 13 bekommt über
  // `dollyPrompt: true` beim Einladen einen Dolly mit Schwerlastrollen untergelegt
  // (js/ui/dolly-wizard.js, js/model/audioDolly.js); Dolly-Stacks entstehen nur über den
  // Dolly-Dialog (Nutzerwunsch).

  // Array-Tops, stehend wie geflogen (0°-Splay).
  P('k2', 'L-Acoustics K2', 'Ton', 138, 40, 35, 56,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: LA_FINISH, note: 'K2 Rigging Manual, Appendix C (l-acoustics.com)' }),
  P('v8v12', 'd&b V8/V12', 'Ton', 70, 46, 31, 34,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'd&b V8/V12 Manual 1.8 (dbaudio.com)' }),
  P('leopard', 'Meyer Sound LEOPARD', 'Ton', 68, 55, 28, 34,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'LEOPARD Datasheet (docs.meyersound.com)' }),
  P('wpc', 'Martin Audio WPC', 'Ton', 77, 42, 32, 35,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'WPC Datasheet (martin-audio.com)' }),
  P('wps', 'Martin Audio WPS', 'Ton', 65, 40, 26, 27,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'martin-audio.com/products/loudspeakers/wps' }),
  P('hdl20a', 'RCF HDL 20-A', 'Ton', 71, 45, 29, 30,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'Gewicht geschätzt: Händlerangabe, nicht aus einem RCF-PDF selbst gelesen' }),
  P('geom620', 'Nexo GEO M620', 'Ton', 37, 26, 19, 10,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'Gewicht geschätzt: Händler-/Manual-Angabe' }),
  P('geom6b', 'Nexo GEO M6B', 'Ton', 37, 26, 19, 8,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'top', cabinetColor: SPEAKER_BLACK, note: 'Gewicht geschätzt: Händler-/Manual-Angabe' }),

  // Subwoofer: liegend (flach) transportiert (Nutzerangabe). Maße liegend: die kleinste
  // recherchierte Achse wird zur Höhe, die beiden größeren zur Grundfläche – eine Umrechnung
  // der recherchierten Maße, keine neue Zahl. Keine feste Herstellerangabe zur Stückzahl auf
  // dem Dolly; der Dolly-Dialog (`dollyPrompt: true`) fragt sie beim Einladen ab.
  P('ks28', 'L-Acoustics KS28', 'Ton', 134, 72, 55, 79,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'sub', cabinetColor: LA_FINISH, note: 'l-acoustics.com/products/ks28, liegend umgerechnet' }),
  P('v-sub', 'd&b V-SUB', 'Ton', 73, 70, 61, 64,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'sub', cabinetColor: SPEAKER_BLACK, note: 'Gewicht geschätzt: Sekundärquelle, nicht aus einem offiziellen d&b-PDF bestätigt, liegend umgerechnet' }),
  P('900-lfc', 'Meyer Sound 900-LFC', 'Ton', 70, 63, 62, 62,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'sub', cabinetColor: SPEAKER_BLACK, note: '900-LFC Datasheet (docs.meyersound.com), Nettogewicht ohne Rigging, liegend umgerechnet' }),
  P('sub-8006-as', 'RCF SUB 8006-AS', 'Ton', 111, 71, 70, 96,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'sub', cabinetColor: SPEAKER_BLACK, note: 'Gewicht geschätzt: Händlerangabe, liegend umgerechnet' }),
  P('ls18', 'Nexo LS18', 'Ton', 78, 68, 51, 56,
    { tippable: false, wheelH: 0, dollyPrompt: true, kind: 'speaker', speakerType: 'sub', cabinetColor: SPEAKER_BLACK, note: 'LS18 Datasheet (nexo-sa.com), liegend umgerechnet' }),

  // Legacy – nicht mehr in der Bibliothek gelistet, bleiben aber für alte Ladepläne bestehen.
  // Durch die Packcases oben ersetzt (Maße und Gewichte unverändert, damit bestehende Loads nicht
  // unbemerkt anders aussehen oder wiegen):
  P('kabel-120x60x60', 'Kabelcase Truckmaß 120×60×60', 'Strom', 120, 60, 60, 110, { legacy: true }),
  P('kabel-120x60x80', 'Kabelcase Truckmaß 120×60×80', 'Strom', 120, 60, 80, 140, { legacy: true }),
  P('pack-80x60x60', 'Packcase Truckmaß 80×60×60', 'Sonstiges', 80, 60, 60, 70, { legacy: true }),
  P('pack-60x60x60', 'Packcase Truckmaß 60×60×60', 'Sonstiges', 60, 60, 60, 50, { legacy: true }),
  P('pack-120x80x80', 'Packcase Truckmaß 120×80×80', 'Sonstiges', 120, 80, 80, 150, { legacy: true }),
  // Ältere Traversen-Vorlagen, ebenfalls legacy:
  P('truss-29-3m', 'Traverse 29er Dreipunkt 3 m', 'Rigging', 300, 29, 29, 15, { tippable: false, wheelH: 0, legacy: true }),
  P('truss-dolly', 'Traversen-Dolly 29er (8× 2 m)', 'Rigging', 200, 60, 70, 180, { tippable: false, legacy: true }),
];
