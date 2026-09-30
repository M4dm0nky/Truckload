## Nachrecherche 2026-09-30 (61 offene Cases)

Von den bis dahin bewusst bei 0 kg belassenen 61 Cases (siehe „Bewusst bei 0 belassen“ unten)
sind wir mit dem Nutzer gemeinsam Case für Case durchgegangen: reale Konfigurationen (Verteiler-
Ausgänge, Kabellängen, Gerätemodelle) klären, dann recherchieren. 24 Cases bekommen dadurch ein
Gewicht, 4 werden auf Nutzerwunsch `legacy: true` (aus der Auswahl entfernt, alte Ladepläne laden
sie unverändert weiter). Der Rest bleibt aus denselben Gründen wie zuvor bei 0 kg.

### Vier entfernte Cases

Auf ausdrücklichen Nutzerwunsch („schmeiß raus“) als überflüssig markiert, Maße/Namen bleiben
für alte Ladepläne unverändert:

- Lakabaum (flach) -BBM
- Lakabaum (Transflex) -BBM
- 63A VT Haube -BBM
- Rigpack -CAB

### Standardwert für leere Rack-/Dolly-Gehäuse: 75 kg/m³

Für Cases ohne festen Geräteinhalt (Datarack, Rack 16HE Deckel, Rack Amp 12HE Schieber,
Schubladencase 90, Dolly Rack 28HEx2, Markus Tools, Dimmerdolly klein/Rack) hat der Nutzer einem
Standardwert nach Volumen zugestimmt, analog zu den Packcases oben. Hergeleitet aus einem realen
leeren 19″-Rack-Case: KORN Case 19″ 7HE ohne Deckel, Birke, 10,6 kg bei ca. 0,60×0,60×0,40 m ≈
0,14 m³ → rund 76 kg/m³, aufgerundet 75 kg/m³
([reverb.com](https://reverb.com/item/55150624-korn-case-19-zoll-rack-ohne-deckel-7-he-60-cm-schwarz-casebau)).
Kein recherchierter Einzelwert je Case, sondern ein Standard. Bei Schubladencases liegen reale
Produkte eher bei 120–300 kg/m³ (mehr Material durch Schubfächer) – hier trotzdem der einfache
Rack-Standard verwendet, das Gewicht von `Schubladencase 90 -CAB` ist also eher niedrig angesetzt.
`Dimmerdolly (klein/Rack)` ist laut Nutzerangabe ein leeres Gestell, der Dimmer selbst zählt
separat (z. B. über `Dimmer 24ch`/`Dimmer 48ch` unten).

### Verteiler und Kabel

- **Powerlock-VT groß -CAB**: Direkttreffer mit exakt der vom Nutzer genannten Bestückung
  (4×125A + 4×63A + 2×32A + 3×16A) – INDU Powerlock 400A, 140 kg
  ([jundc.com](https://jundc.com/produkt/powerlock-verteiler-4x125a-4x-63a-2x-32a-3x-16a-rcd-im-case/)).
- **Powerlock-VT klein -CAB**: kein Direkttreffer für 4×63A + 2×32A + 3×16A. Interpoliert
  zwischen einem kleineren 1×63A-Verteiler (33 kg,
  [lichtundton.at](https://lichtundton.at/technik-katalog/stromversorgung-kabel/starkstromverteiler-cee63-auf-2xcee16-und-2xcee32/))
  und dem großen 4-stufigen Verteiler oben (140 kg): 50 kg, vom Nutzer als Schätzung akzeptiert.
- **MLVT 24ch/48ch/63A/63A Hotpatch ROW -CAB** („Moving-Light-Verteiler mit Patchfeld“,
  Nutzerangabe): kein Katalogprodukt auffindbar, wirkt wie ein firmeninterner Rack-Typ.
  Nutzer-Standardgewicht 75 kg für alle vier Varianten gleich, unabhängig von Kanalzahl/Amperage.
- **Powerlocksatz 10m -BBM/-CAB**: laut Nutzer 5 Kabel (3 Phasen + N + PE) à 10 m, je Kabel
  95 mm² Powerlock. Kabelgewicht grob aus Kabelsatz-Angeboten hergeleitet (Powerlock-Kabelsätze
  mit gemischten Querschnitten, [meevi-rent.de](https://www.meevi-rent.de/shop/powerlock-315a-kabelsatz-4x120mm2-1x95mm2-200-meter-23/)),
  ca. 1,05 kg/m je Ader – **keine reine Einzelader-Quelle**, nur eine grobe Herleitung. 5×10m×1,05 kg/m
  = 52,5 kg + Case-Anteil.
- **Laka Loom 20-30/28-40/45m -CAB**: laut Nutzer je Case 5× Harting-HAN16-Lastkabel plus
  2× Netzwerk, 1× LK24, 1× Erdung, alle in der angegebenen Länge. „20-30“ und „28-40“ meinen die
  5 Han16-Kabel gestaffelt vom kürzesten zum längsten (hier mit der Durchschnittslänge
  gerechnet), „45m“ heißt alle 5 Kabel gleich 45 m lang. Kabelgewichte geschätzt über
  H07RN-F-5G2,5-Richtwert für die Han16-Lastkabel (0,33 kg/m,
  [elektrikshop.de](https://www.elektrikshop.de/h07rn-f-5g2-5-gummischlauchleitung.html)) und
  grobe eigene Schätzwerte für die dünneren Netzwerk- (0,15 kg/m), LK24- (0,20 kg/m) und
  Erdungs-Kabel (0,10 kg/m) – diese drei sind **nicht einzeln recherchiert**.
- **„Laka Loom 5fach“ bleibt bei 0 kg**: Die Bedeutung der „5“ ließ sich auch nach zwei
  Rückfragen nicht in eine Länge übersetzen (Nutzerantwort „5 Stück Kabel in der angegebenen
  Menge“) – lieber unbekannt als geraten.
- **MoCo 12ch/32ch -CAB bleiben bei 0 kg**: Chainmaster-Steuerung (BGV-D8/CM-820) bestätigt,
  aber für das 12-Kanal-Modell (CM-820018) ist online keine Gewichtsangabe zu finden, und für
  32ch existiert kein passendes Chainmaster-Produkt.

### Geräte mit Direkttreffer

| Gerät | Gewicht (kg) | Quelle |
|---|---|---|
| ChamSys MagicQ Compact Wing | 4,0 | https://chamsyslighting.com/product/magicq-compact-wing/ |
| Ayrton IntelliPix-R (für „Intellipix -BBM“, Marke vom Nutzer bestätigt) | 15,9 | https://www.ambersphere.com/product/intellipix-xt/ |
| MA Digital Dimmer 12×2,3kVA (für „Dimmer 24ch“ = 2×, „Dimmer 48ch“ = 4×, Nutzerangabe) | 23,0 | https://www.malighting.com/product-archive/product/ma-digital-dimmer-12-x-2-3kva-140501/ |

### Ergebnistabelle

| Case | Neues Gewicht |
|---|---|
| ChamSys Wing Compact -CAB | 20 kg |
| Intellipix -BBM | 40 kg |
| Powerlock-VT groß -CAB | 140 kg |
| Powerlock-VT klein -CAB | 50 kg |
| MLVT 24ch -CAB | 75 kg |
| MLVT 48ch -CAB | 75 kg |
| MLVT 63A 19″ -CAB | 75 kg |
| MLVT 63A Hotpatch ROW -CAB | 75 kg |
| Laka Loom 20-30 -CAB | 75 kg |
| Laka Loom 28-40 -CAB | 95 kg |
| Laka Loom 45m -CAB | 120 kg |
| Powerlocksatz 10m -BBM | 80 kg |
| Powerlocksatz 10m -CAB | 70 kg |
| Dimmer 24ch -CAB | 70 kg |
| Dimmer 48ch -CAB | 120 kg |
| Datarack braun -CAB | 30 kg |
| Datarack schwarz -CAB | 20 kg |
| Rack 16HE Deckel -CAB | 30 kg |
| Rack Amp 12 HE Schieber -CAB | 30 kg |
| Schubladencase 90 -CAB | 25 kg |
| Dolly Rack 28 HEx2 -CAB | 115 kg |
| Markus Tools -ROW only -CAB | 30 kg |
| Dimmerdolly (klein/Rack) -BBM | 150 kg |
| Dimmerdolly (klein/Rack) -CAB | 200 kg |

## Packcases (Standardgewicht, Nutzerangabe 2026-09-30)

Anders als die recherchierten Gewichte unten ist das hier kein recherchierter Wert,
sondern ein Standardwert des Nutzers: Das Standard-Packcase ist 120×60×60 ohne Rollen,
also 120×60×80 hoch mit Rollen. Es wiegt als Standard 100 kg (änderbar), alle anderen
Packcases werden danach nach Volumen ab- bzw. aufgestuft. Die mitgelieferten Packcases
sind inklusive Rollen gemessen, die Referenz ist deshalb der Eintrag „Packcase
120×60×80“. Formel: `round(100 × l·w·h / (120·60·80))`.

| Packcase | Volumen | Gewicht |
|---|---|---|
| 60×60×60 | 0,216 m³ | 38 kg |
| 60×60×73 | 0,263 m³ | 46 kg |
| 80×60×60 | 0,288 m³ | 50 kg |
| 120×60×60 | 0,432 m³ | 75 kg |
| 120×60×73 | 0,526 m³ | 91 kg |
| 120×60×80 | 0,576 m³ | 100 kg (Standard) |
| 120×80×80 | 0,768 m³ | 133 kg |

Im Code steht die Formel (`PACK` in `js/data/preset-cases.js`), nicht die einzelnen
Zahlen. Legacy-Einträge (die früheren „Packcase/Kabelcase Truckmaß …“-Vorlagen) sind
unverändert und behalten ihre alten Gewichte.

# Gewichtsrecherche für die Case-Bibliothek (Task 2, V0.5.0)

Recherchiert am 2026-09-20 für `js/data/case-library.js`. Formel je Eintrag:

```
Case-Gewicht = round5( Gerätegewicht_netto × Stückzahl + Case-Anteil )
Case-Anteil  = max(15 kg, Außenvolumen_m³ × 40 kg/m³)
```

Gerätegewichte sind Netto-Herstellerangaben ohne Verpackung. Case-Anteil ist ein
grober Richtwert für Birke-Multiplex-Case + Polster/Schaum, kein recherchierter
Wert für das konkrete Case. `round5` rundet auf volle 5 kg.

Wo kein belastbarer Gerätebezug oder keine sichere Stückzahl feststellbar war,
bleibt `weight: 0` unverändert – siehe Abschnitt „Bewusst bei 0 belassen“ unten.

## Geräte­gewichte (Quelle → Netto-Gewicht)

| Gerät | Gewicht (kg) | Quelle |
|---|---|---|
| Martin Mac Viper Performance | 37,9 | https://www.martin.com/en-US/products/mac-viper-performance |
| Martin Mac Viper Profile | 37,2 | https://www.martin.com/en-US/products/mac-viper-profile |
| Martin Mac Viper Wash DX | 34,1 | https://www.martin.com/en-US/products/mac-viper-wash-dx |
| Martin Mac Viper (Ø Performance/Profile/Wash DX, Variante bei „Mac Viper x2“ nicht im Namen genannt) | 36,4 | s. drei Zeilen oben |
| Martin Mac Ultra Performance | 44,0 | https://www.martin.com/en-US/products/mac-ultra-performance |
| Martin Mac Aura (XB, Touring-Variante) | 6,5 | https://www.martin.com/en-US/products/mac-aura-xb |
| Martin Mac Axiom Hybrid | 24,8 | https://www.martin.com/en-US/products/mac-axiom-hybrid |
| Martin Mac Quantum Wash | 21,0 | https://lmg.net/product/martin-mac-quantum-wash/ |
| Martin Atomic 3000 LED | 7,8 | https://www.martin.com/en-US/products/atomic-3000-led |
| Robe BMFL Spot | 36,0 | https://www.robe.cz/bmfl-spot |
| Robe BMFL WashBeam | 38,4 | https://www.robe.cz/bmfl-washbeam |
| Robe BMFL Blade | 37,9 | https://www.robe.cz/bmfl-blade |
| Robe BMFL (Ø aus Spot/WashBeam/Blade, für nicht spezifizierte „BMFL x2“) | 37,4 | s. drei Zeilen oben |
| Robe ColorSpot 2500E AT (= „2500p“, siehe Korrektur unten) | 42,5 | https://www.robe.cz/colorspot-2500e-at |
| Robe ColorWash 2500E AT (= „2500w“, siehe Korrektur unten) | 41,0 | https://www.robe.cz/colorwash-2500e-at |
| Robe Robin 100 LED Beam | 4,5 | https://www.10kused.com/product/robe-robin-led-beam-100-lfnh-56314/ |
| Robert Juliat Aramis (Verfolger) | 59,0 | https://rudideluxe.de/en/produkt/robert-juliat-aramis-2500-w-hmi-45-8-dmx/ |
| Robert Juliat Korrigan (Verfolger, inkl. externem Vorschaltgerät) | 43,0 | https://www.robertjuliat.com/Product_Specifications/Fiches_EN/Standard/DSEN103_1149.pdf |
| SGM Q-7 | 8,1 | https://www.atcomms.co.uk/wp-content/uploads/2019/02/SGM-Q7-Spec-Sheet.pdf |
| Clay Paky Sharpy (Legacy, = „klein“, siehe Korrektur unten) | 19,0 | https://www.claypaky.it/products/sharpy-legacy/ |
| Clay Paky Sharpy Plus (= „gross“, siehe Korrektur unten) | 23,0 | https://www.claypaky.it/products/sharpy-plus/ |
| Clay Paky B-Eye K10 | 15,0 | https://www.huss-licht-ton.de/product_info.php/en/Clay-Paky-Aleda-B-EYE-K10-LED-Moving-Head-Wash/info/15831.html |
| Clay Paky B-Eye K20 | 21,0 | https://www.claypaky.it/products/a-leda-b-eye-k20/ |
| ETC Source Four, Linsentuben 19°/26°/36°/50° (Standardausführung; siehe Korrektur unten) | 6,3 | https://support.etcconnect.com/ETC/Fixtures/Source_Four/Source_Four_ERS_and_HID/Fixture_and_Shipping_Weights_of_Source_Four |
| GLP X4 Bar 20 | 16,0 | https://glp.de/en/?view=article&id=850&catid=55 |
| GLP JDC-1 | 11,6 | https://www.germanlightproducts.com/wp-content/uploads/2017/04/PDF-Spec-Sheet-JDC1.pdf |
| Jem AF-1 | 10,0 | https://www.tsllighting.com/wp-content/uploads/2018/12/Jem-AF1-Fan-Spec-Sheet.pdf |
| Jem AF-2 (Basisgewicht ohne Flying-Bracket) | 15,7 | https://jmfx.net/sites/default/files/jem_fan_manual.pdf |
| Jem ZR44 Hi-Mass (Trockengewicht) | 19,0 | https://www.martin.com/Files/Images/Download/Products/Jem_ZR44_Hi-Mass_low(1).pdf |
| Look Solutions Viper NT (ohne Tank) | 8,6 | https://www.looksolutions.com/uploads/pdf/en_fr/info_viper.nt_e.pdf |
| Smoke Factory Fan Fogger EC (ohne Fluid) | 24,0 | https://smoke-factory.de/produkt/fan-fogger-ec-2-6/?lang=en |
| Smoke Factory Data II | 12,8 | https://smoke-factory.de/produkt/data-ii/?lang=en |
| Smoke Factory Tour Hazer II | 16,5 | https://www.manualslib.com/manual/1211096/Smoke-Factory-Tour-Hazer-Ii.html |
| ARRI SkyPanel S120 (montierte Version, Handbetrieb) | 16,5 | https://www.arri.com/resource/blob/31140/1ca36cb902c3b25d9c8eb97dda5c58c3/arri-skypanel-s120-c-data-sheet-en-data.pdf |
| Chauvet Strike Array 4 | 13,0 | https://chauvetprofessional.com/product/strike-array-4/ |
| Astera AX5 TriplePar | 3,4 | https://www.astera-led.com/wp-content/uploads/Datasheet_AX5_TriplePar_V1.pdf |
| Ayrton MagicBlade-R | 21,1 | https://tmsomaha.com/rentals-new/moving-lights/ayrton-magicblade-r/ |
| ChamSys MagicQ MQ100 | 14,2 | https://www.chamsys.at/downloads/PDFs/Datenblatt_MQ100_Expert.pdf |
| ChamSys MagicQ MQ500 | 32,0 | https://chamsyslighting.com/product/magicq-mq500-stadium-console/ |
| MA Lighting grandMA2 full-size | 46,0 | https://www.malighting.com/product-archive/product/grandma2-full-size-120111/ |
| MA Lighting grandMA2 light | 37,0 | https://www.christielites.com/file_uploads/spec_608_120112-grandMA2-light.pdf |
| Kettenzug D8+ 0,25 t (Body, ohne Kette) | 10,2 | https://chainmaster.de/en/250kg-4m-min-d8plus/ |
| Kettenzug D8+ 0,5 t (Body, ohne Kette) | 17,0 | https://chainmaster.de/en/500kg-4m-min-d8plus/ |
| Kettenzug D8+ 1 t (Body, ohne Kette) | 31,0 | https://chainmaster.de/en/1000kg-4m-min-d8plus/ |
| Kettenzug D8 2 t (Body, ohne Kette) | 39,0 | https://chainmaster.de/en/2000kg-4m-min-d8/ |
| MDG Tourpack (Hazer bereits im Touring-Cradle) | ca. 84 (185 lb „theONE Touring, in rack, no CO2 bottles“, gesamt, kein zusätzlicher Case-Anteil) | https://www.christielites.com/theone-mdg-fogger-hazer-in-touring-cradle/230w4w33w114w1156 |
| GLP FR10 Bar (nur zur Plausibilisierung, nicht für die zwei FR10-Zeilen verwendet) | 24,0 | https://www.farralane.com/glp-impression-fr10-bar-10-x-60-watt-rgbw-led-moving-batten.html |

## Korrektur Robe „2500p“ / „2500w“ (Fix-Runde 1)

In der ersten Fassung dieses Protokolls stand hier fälschlich „Nach Rücksprache
mit dem Nutzer“ als Begründung für die Deutung „2500p = Robin MegaPointe“. Diese
Rücksprache hat es nicht gegeben – das war meine eigene Fehlentscheidung in der
ersten Recherche, nicht mit dem Nutzer abgestimmt. Ein Reviewer hat sie zu Recht
verworfen:

- Die Robin MegaPointe trägt in keiner offiziellen Bezeichnung „2500“ und kennt
  keine Spot/Wash-Aufteilung.
- `Robe 2500p x1 -CAB` ist 113 cm hoch; die MegaPointe misst nur 640×396×230 mm
  – die Fallhöhe des Case passt nicht zu diesem kompakten Gerät.
- Robe führt dagegen ein Modellpaar mit „2500“ im Namen und exakt der
  Spot/Wash-Aufteilung, die die Namen `2500p`/`2500w` nahelegen: **ColorSpot
  2500E AT** (638×536×678 mm, 42,5 kg) und **ColorWash 2500E AT**
  (641×542×545 mm, 41 kg). Beide Gerätehöhen liegen deutlich näher an den
  113 cm bzw. 105 cm Case-Höhe als die MegaPointe.

Neu eingetragen: `Robe 2500p x…` = ColorSpot 2500E AT (42,5 kg/Stück),
`Robe 2500w x…` = ColorWash 2500E AT (41 kg/Stück) – für beide Varianten (p wie
w), nicht nur für eine.

## Berechnete Case-Gewichte (67 Einträge, Stand nach Fix-Runde 1)

| Case | Geräte × Stück | Case-Gewicht (kg) |
|---|---|---|
| ChamSys MQ100 -CAB | 1 × ChamSys MQ100 | 30 |
| ChamSys MQ500 -CAB | 1 × ChamSys MQ500 | 45 |
| gMA2 FS -CAB | 1 × grandMA2 full-size | 60 |
| gMA2 Light -CAB | 1 × grandMA2 light | 50 |
| Astera AX5 -BBM | 1 × Astera AX5 | 20 |
| MagicBlade -BBM | 1 × MagicBlade | 40 |
| Magicblade wide -CAB | 1 × MagicBlade | 40 |
| Sharpy x2 gross -CAB | 2 × Sharpy Plus (breiteres Case, 60 cm) | 65 |
| Sharpy x2 klein -CAB | 2 × Sharpy (Legacy, schmaleres Case, 48 cm) | 55 |
| B-Eye K20 x2 -Jäger | 2 × B-Eye K20 | 60 |
| B-Eye K10 x4 -CAB | 4 × B-Eye K10 | 80 |
| ETC S4 x6 -CAB | 6 × ETC Source Four (6,3 kg) | 55 |
| X4-Bar 20 -BBM | 1 × X4 Bar 20 | 35 |
| JDC-1 lang -Motion | 1 × JDC-1 | 25 |
| JDC-1 Cube (4) -RentALL | 4 × JDC-1 | 60 |
| JDC-1 Cube -RentALL | 1 × JDC-1 | 25 |
| JDC-1 lang (6) -RentALL | 6 × JDC-1 | 85 |
| GLP X4-Bar-20 x4 -CAB | 4 × X4 Bar 20 | 80 |
| JDC-1 x6 -CAB | 6 × JDC-1 | 85 |
| AF-2 -BBM | 1 × AF-2 | 30 |
| AF-1 -CAB | 1 × AF-1 | 25 |
| ZR44 -CAB | 1 × ZR44 | 35 |
| Look Viper NT -CAB | 1 × Look Viper NT | 25 |
| Atomic 3000 LEDx8 -CAB | 8 × Atomic 3000 LED | 85 |
| Atomic 3000 x4 no wheels -CAB | 4 × Atomic 3000 LED | 45 |
| Atomic 3000 x4 wheels -CAB | 4 × Atomic 3000 LED | 45 |
| Atomic 3000 x8 -CAB | 8 × Atomic 3000 LED | 85 |
| Mac Aura x6-CAB | 6 × Mac Aura | 60 |
| Mac Axiom x2 -CAB | 2 × Mac Axiom | 75 |
| Mac Quantum w x2 -CAB | 2 × Mac Quantum Wash | 60 |
| Mac Viper x2 -CAB | 2 × Mac Viper (Variante unklar, Ø aus Performance/Profile/Wash DX, 36,4 kg) | 100 |
| Mac Ultra x2 -CAB | 2 × Mac Ultra | 125 |
| Mac Ultra x1-CAB | 1 × Mac Ultra | 60 |
| MDG Tourpack -BBM | Tourpack-Gesamtgewicht lt. Datenblatt | 85 |
| MDG Tourpack -CAB | Tourpack-Gesamtgewicht lt. Datenblatt | 85 |
| BMFL Spot -BBM | 1 × BMFL Spot | 55 |
| Robe 2500p x1 -CAB | 1 × ColorSpot 2500E AT | 60 |
| Robe 2500p x2 -CAB | 2 × ColorSpot 2500E AT | 120 |
| Robe 2500w x1 -CAB | 1 × ColorWash 2500E AT | 60 |
| Robe 2500w x2 -CAB | 2 × ColorWash 2500E AT | 110 |
| Robin 100 LED Beam -CAB | 1 × Robin 100 LED Beam | 20 |
| Aramis -CAB | 1 × Aramis | 95 |
| Korrigan -CAB | 1 × Korrigan | 65 |
| Q7 lang -BBM | 1 × SGM Q-7 | 25 |
| SGM Q7 x4 -CAB | 4 × SGM Q-7 | 45 |
| SGM Q7 x6 -CAB | 6 × SGM Q-7 | 65 |
| SF Fan Fogger -CAB | 1 × SF Fan Fogger | 40 |
| SF Data II -CAB | 1 × SF Data II | 30 |
| SF TourHazer II -CAB | 1 × SF TourHazer II | 30 |
| ETC S4 x8 -CAB | 8 × ETC Source Four (6,3 kg) | 75 |
| Q7 x4 -CAB | 4 × SGM Q-7 | 45 |
| D8+ 0,5t -BBM | 1 × D8+ 0,5t | 30 |
| D8+ 1t -BBM | 1 × D8+ 1t | 45 |
| D8 2t CAB | 1 × D8 2t | 55 |
| D8+ 0,25t CAB | 1 × D8+ 0,25t | 25 |
| D8+ 0,5t CAB | 1 × D8+ 0,5t | 30 |
| D8+ 0,5t CAB x12 | 12 × D8+ 0,5t | 285 |
| D8+ 0,5t CAB x4 | 4 × D8+ 0,5t | 95 |
| D8+ 0,5t CAB x8 | 8 × D8+ 0,5t | 190 |
| D8+ 1t PlusLite -cab | 1 × D8+ 1t | 45 |
| SkyPanel 120 x2-AED | 2 × SkyPanel S120 | 65 |
| Strike Array4 x4 - CAB | 4 × Strike Array 4 | 70 |
| BMFL x2 -Motion | 2 × BMFL Spot (Variante vom Nutzer bestätigt, 36,0 kg) | 105 |
| D8+ 1t ProStage -cab | 1 × D8+ 1t | 45 |
| D8+ 1t ProStage -motion | 1 × D8+ 1t | 45 |
| FR10 x2 -RentAll | — (Originalwert Tabelle) | 73,52 |
| FR10 x6 -Motion | — (Originalwert Tabelle) | 276 |

**Q7 x4 / SGM Q7 x4 / SGM Q7 x6 / Q7 lang**: alle mit Gewicht versehen (SGM
Q-7 eindeutig identifiziert), keine Ausnahme.

## Bewusst bei 0 belassen

- **Generic-Fixtures ohne Herstellerbezug** (`4lite x6`, `Asym Flood x1/x6`,
  `2-light x12`, `8-light x6`, `4-light HORZ x8`, alle `Dolly …`-Einträge mit
  Hersteller „Generic“ im Feld „Inhalt“; Firmenfeld ist bei diesen Einträgen
  „CAB“): kein recherchierbares Gerätemodell hinter „Generic“.
- **„Das K – Annahme“ -Kraftklub**: Bandspezifisches Sonderequipment ohne
  identifizierbares Katalogprodukt.
- **Sunstrips Sandwich -CAB**, **Case klein Adapter -Jäger**, **V-Mat
  (Schubladen tipbar) -BBM**: kein Herstellerfeld, Gerät nicht sicher
  identifizierbar.
- **Base Station -Motion**, **motion Cam**: keine eindeutige Zuordnung zu einem
  bekannten Robe-Produkt dieses Namens gefunden.
- **Gunnar Arkaos Server / Gunnar Monitor / Gunnar Tools -CAB**: „Gunnar“ liest
  sich wie ein Crew-/Systemname, kein recherchierbares Gerätemodell.
- **MoCo 12ch / MoCo 32ch -CAB**: Chainmaster-Steuerung bestätigt (Nachrecherche
  2026-09-30), aber für 12ch keine Gewichtsangabe auffindbar und für 32ch kein
  passendes Produkt – siehe oben.
- **„Laka Loom 5fach“ -CAB**: Bedeutung nach zwei Rückfragen nicht in eine
  Länge übersetzbar – siehe „Nachrecherche 2026-09-30“ oben.
- **Multicore -CAB / Multicore LK24 -CAB / Multicore LK37 -CAB**: Kabellänge/
  Kanalzahl je Einsatz unterschiedlich, kein fester Inhalt.
- alle **19″-Racks** (1–6, 16 HE), **Truss lose 40er -BBM**, **Trussdolly
  40er -BBM**, **MLT 120/160/240 x2 -CAB**: laut Aufgabenstellung ausdrücklich
  bei 0 kg zu belassen (kein Gerätebezug); die vier zuletzt genannten sind
  zusätzlich `legacy`.

**Korrektur (2026-09-30, zweite Runde):** Die erste Fassung dieser Recherche hat
`FD34 2m CUSTOMIZE -CAB` und `Slick -CAB` mit der Begründung „der Nutzer wägt die
enthaltene Traverse beim Aufbau selbst“ bewusst bei 0 kg belassen. Das war falsch –
der Nutzer wägt gar nicht beim Aufbau. Richtig ist: Traversen werden nicht über
diese beiden Case-Einträge geführt, sondern über „+ Traverse hinzufügen“
(`js/ui/truss-wizard.js`) neu gebaut, und dort hat jedes Profil (F34/F40) bereits
ein echtes Gewicht (`wagonWeight()` in `js/model/truss.js`, nie 0). Die beiden
Einträge sind damit überflüssig und jetzt `legacy: true`, gleiches Muster wie
`Truss lose 40er -BBM`/`Trussdolly 40er -BBM`/`MLT 120/160/240 x2 -CAB` oben.

## Formel-Abweichungen und Variantenunsicherheit (dokumentiert)

- **BMFL x2 -Motion**: Der Name nennt keine Variante (Spot/WashBeam/Blade),
  daher wurde zunächst der Mittelwert aus allen drei Varianten (37,4 kg)
  verwendet. Der Nutzer hat die Variante inzwischen bestätigt: **Spot**
  (36,0 kg). Das gerundete Case-Gewicht bleibt dadurch unverändert bei 105 kg.
  Die Methode „Mittelwert bei ungenannter Variante“ wird weiterhin bei
  Mac Viper angewendet, siehe unten.
- **Mac Viper x2 -CAB**: Der Name nennt keine Variante (Performance/Profile/
  Wash DX). In der ersten Fassung dieses Protokolls war das nicht als
  Unsicherheit benannt und stillschweigend die Performance-Variante (37,9 kg)
  gewählt worden. Nachgebessert: wie bei BMFL wird jetzt der Mittelwert aus
  allen drei bekannten Varianten (36,4 kg) verwendet. Am gerundeten
  Case-Gewicht ändert sich dadurch nur wenig (105 kg → 100 kg).
- **Sharpy x2 gross / Sharpy x2 klein -CAB**: Der Name „Sharpy“ allein ist
  mehrdeutig (Legacy Sharpy 19 kg vs. Sharpy Plus 23 kg, 21 % Unterschied).
  Die beiden Case-Zeilen unterscheiden sich nur in der Breite (60 cm „gross“
  vs. 48 cm „klein“) und im Namenszusatz. Der Sharpy Plus hat laut
  Herstellerangabe eine größere Grundfläche (307×375 mm) als der kompaktere
  Legacy Sharpy – das passt zur Namens-/Breitenlogik. Zuordnung: „gross“ =
  Sharpy Plus (23 kg), „klein“ = Legacy Sharpy (19 kg). Diese Zuordnung stützt
  sich auf Namens- und Case-Breiten-Indiz, nicht auf eine explizite
  Modellangabe in der Tabelle – die Unsicherheit steht deshalb auch in der
  `note` beider Zeilen.
- **ETC S4 x6 / ETC S4 x8 -CAB**: In der ersten Fassung wurde von derselben
  ETC-Quelle die 70°-Zeile (7,9 kg) statt der Standard-Linsentuben-Zeile
  (19°/26°/36°/50°, 6,3 kg) übernommen. Korrigiert auf 6,3 kg; die Case-Namen
  nennen keinen Öffnungswinkel, 6,3 kg gilt für die in der Praxis häufigste
  Konfiguration.
- **MDG Tourpack -BBM/-CAB**: „Tourpack“ ist bei MDG bereits die Bezeichnung für
  das Hazer-Modul samt fest verbautem Touring-Cradle. Das Datenblatt nennt für
  diese Konfiguration ein Gesamtgewicht von ca. 84 kg (185 lb, „theONE
  Touring, in rack, no CO2 bottles“) – die Formel „Gerätegewicht × Stückzahl +
  Case-Anteil“ wurde hier nicht zusätzlich angewendet, weil das recherchierte
  Gewicht das Case bereits einschließt (sonst würde das Case doppelt gezählt).
  In der ersten Fassung war hier fälschlich eine andere, nicht zitierte Seite
  (solotech.com, die 23 kg Generator + 33,5 kg Cradle + 120 kg
  Betriebsgewicht nennt, aber nicht die 84 kg) als Quelle angegeben – jetzt
  auf die tatsächlich belegende Quelle korrigiert.
