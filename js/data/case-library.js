// Case-Bibliothek „Meine Sammlung“ (Liste der Verleihfirma des Nutzers).
//
// Der Inhalt steht seit V 0.17.0 in data/meine.json. Einträge werden dort gepflegt bzw. neu
// erzeugt. Dieses Modul behält nur den alten Namen CASE_LIBRARY für Verbraucher und Tests und
// enthält selbst keine Daten. Die Begründungen stehen hier, weil JSON keine Kommentare kann.
//
// Herkunft: Die Liste stammt aus der Excel-Tabelle „Casemaße Complete.xlsx“, Blatt „Data Cases“
// (Zeilen 3–144). Die Umwandlung lief am 2026-09-20 als einmaliges Skript, das nicht im Repo liegt.
// 142 Zeilen hatten einen Typ, 137 Einträge sind übernommen. Fünf Rigging-Zeilen ohne brauchbares
// Höhenmaß (leere Zellen bzw. „-“/„x“) entfielen ersatzlos: „Motorsteuerung (Koffer -BBM“,
// „Bolzenkoffer -BBM“, „FD34 x2 -CAB“, „HOF BOLT -CAB“, „Dolly ‚Drohne‘ -CAB“.
// Gewerk-Zuordnung aus der Spalte „Family“: Fixture/Desk → Licht, Rigging → Rigging,
// DC/Cable → Strom, Rack → Ton, FOH → Video, Case → Sonstiges. Das Firmenkürzel („Company“)
// wird nur angehängt, wenn es im Namen noch nicht vorkommt (z. B. „D8+ 0,5t CAB x12“ bleibt).
//
// Maße und Rollen: Die Maße der Liste sind inklusive Rollen gemessen (dimsInclWheels). Standard
// sind Blue Wheel Ø 100 mm, 13 cm hoch (Nutzerangabe 2026-09-28). Die Rollenhöhe ändert also nicht,
// wie viel Platz ein Case im Truck belegt, nur wie hoch Rollen und Korpus gezeichnet werden.
// Cases unter ca. 45 cm Höhe haben keine Rollen (`wheels: false`, Maß unverändert, Nutzerangabe
// 2026-09-28): MLVT 63A 19″, ChamSys-Pulte, ZR44, Look Viper NT, SF Data II, SF TourHazer II,
// Atomic 3000 x4 und die 19″-Racks von 1 bis 6 HE.
//
// 19″-Racks: Sechs Racks (1, 2, 4, 5, 6, 16 HE) hatten leere Zellen für Länge und Breite.
// l = w = 60 cm ist dafür geschätzt (eigene Entscheidung, nicht gemessen). Bei der Höhe fehlte
// bei vier Racks (1, 4, 5, 16 HE) der Wert; er wurde aus der Höheneinheit gerechnet. Bei 2 und
// 6 HE stand bereits eine gemessene Höhe (15 bzw. 32 cm), die unverändert blieb.
// Aufschlag für Deckel und Boden, aus den drei gemessenen Racks abgeleitet (h − HE × 4,45 cm):
// 2 HE → 6,1 cm, 3 HE → 5,65 cm, 6 HE → 5,3 cm; Mittelwert ≈ 5,68 cm, also
// h = HE × 4,45 + 5,68. Diese kleinen Racks haben keine Rollen (`wheels: false, wheelH: 0`);
// die gemessenen Werte bestätigen das (ein 2-HE-Case mit 15 cm hätte bei 13 cm Rollen nur 2 cm
// Korpus). Nur das 3-HE-Rack ist komplett gemessen. Alle Racks mit geschätzter Breite oder Tiefe
// sind seit Nutzerwunsch 2026-10-10 `legacy` und nicht mehr wählbar; nur 3 HE bleibt wählbar.
//
// Gewichte: 89 von 137 Einträgen tragen ein recherchiertes Schätzgewicht (Feld `note`, Text
// „Gewicht geschätzt: …“). Die beiden FR10-Zeilen behalten ihre Werte aus der Tabelle. Alle
// übrigen bleiben bei 0 kg, lieber 0 als eine erfundene Zahl. Quellen und Rechenweg:
// docs/casemasse-gewichte.md. Einzelfälle:
// - Leere Rack- und Dolly-Gehäuse ohne Geräteinhalt: Standard 75 kg/m³, hergeleitet aus einem
//   leeren 19″-Rack (KORN Case 7HE ohne Deckel, 10,6 kg bei ca. 0,14 m³); Nutzerangabe 2026-09-30,
//   Herleitung „Nachrecherche 2026-09-30“.
// - MA Digital Dimmer 12×2,3 kVA, 23 kg netto (Herstellerangabe); der Dimmer 24ch/48ch sind 2 bzw.
//   4 solcher Einheiten (Nutzerangabe 2026-09-30). Das leere Gestell zählt als leeres Rack, der
//   Dimmer selbst woanders.
// - MLVT (Moving-Light-Verteiler mit Patchfeld): kein Katalogprodukt auffindbar, Nutzer-Standard
//   75 kg für alle vier Varianten (Nutzerangabe 2026-09-30).
// - Powerlocksatz 10 m: 5 Kabel (3 Phasen, N, PE) à 10 m, je 95 mm² (Nutzerangabe 2026-09-30).
//   Kabelgewicht grob aus Kabelsatz-Angeboten (ca. 1,05 kg/m je Ader, keine reine Einzelader-Quelle)
//   plus Case-Anteil.
// - Laka Loom: 5× Harting-HAN16-Lastkabel, 2× Netzwerk, 1× LK24, 1× Erdung, in der Nutzerlänge.
//   „20-30“/„28-40“ sind die fünf HAN16-Kabel gestaffelt, hier mit der Durchschnittslänge gerechnet.
//   Kabelgewichte über H07RN-F-Richtwerte geschätzt.
// - „5fach“ bleibt bei 0 kg: Die Zahl lässt sich nicht in eine Länge übersetzen.
// - INDU Powerlock 400 A mit 4×125 A + 4×63 A + 2×32 A + 3×16 A: Direkttreffer (Bauart vom Nutzer
//   bestätigt 2026-09-30). Für 4×63 A + 2×32 A + 3×16 A gibt es keinen Treffer; das Gewicht ist eine
//   Schätzung zwischen 33 kg (kleinerer 1×63-A-Verteiler) und 140 kg, vom Nutzer akzeptiert.
// - ChamSys MagicQ Compact Wing: 4,0 kg (Herstellerangabe).
// - Ayrton IntelliPix-R: 15,9 kg (Herstellerangabe). Die Marke hat der Nutzer 2026-09-30 bestätigt,
//   sie ist nicht aus dem Firmenfeld „BBM“ ableitbar.
//
// Die Maße der beiden Cube-Zeilen wurden auf Nutzerwunsch 2026-10-09 vertauscht: Vier Geräte passen
// nicht in 60 × 60, 99 × 60 × 58 ist die Größe von „JDC-1 lang (6)“. Namen, Gewichte, Hinweise und
// IDs blieben. Länge und Breite der drei x4/x8/x12-Cases wurden ebenfalls 2026-10-09 getauscht
// (240 cm ist die Länge). Eigene Entscheidung, nicht nachgemessen.
//
// `legacy: true` (Nutzerwunsch 2026-09-28): Der Eintrag ist in keiner Auswahl mehr gelistet, bleibt
// aber vorhanden, damit alte Ladepläne ihre Stücke unverändert behalten. Betroffen sind:
// - die leeren Pack-/Transflex-Cases (ersetzt durch „Packcase L×B×H“ in preset-cases.js),
// - Traversen aus der Liste (Traversenwagen baut man über „+ Traverse hinzufügen“). Seit
//   2026-09-30 auch FD34 2 m CUSTOMIZE und Slick; dort hat jedes Profil (F34/F40) ein echtes
//   Gewicht über `wagonWeight()` in js/model/truss.js, nie 0,
// - die 19″-Racks mit geschätzter Breite oder Tiefe (siehe oben, 2026-10-10).
// Auf Nutzerwunsch 2026-09-30 aus der Auswahl entfernt (überflüssig), Maße und Namen unverändert,
// damit alte Ladepläne sie weiter finden: Lakabaum (flach/Transflex) -BBM (siehe
// docs/casemasse-gewichte.md „Nachrecherche 2026-09-30“) und zwei weitere Einträge.
//
// Dolly-Stacks entstehen nur über den Dolly-Dialog (Nutzerwunsch); die Subwoofer- und Array-Top-
// Vorlagen stehen in preset-cases.js.

import meine from '../../data/meine.json' with { type: 'json' };

export const CASE_LIBRARY = meine.cases;
