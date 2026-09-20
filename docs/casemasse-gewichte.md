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
| Martin Mac Ultra Performance | 44,0 | https://www.martin.com/en-US/products/mac-ultra-performance |
| Martin Mac Aura (XB, Touring-Variante) | 6,5 | https://www.martin.com/en-US/products/mac-aura-xb |
| Martin Mac Axiom Hybrid | 24,8 | https://www.martin.com/en-US/products/mac-axiom-hybrid |
| Martin Mac Quantum Wash | 21,0 | https://lmg.net/product/martin-mac-quantum-wash/ |
| Martin Atomic 3000 LED | 7,8 | https://www.martin.com/en-US/products/atomic-3000-led |
| Robe BMFL Spot | 36,0 | https://www.robe.cz/bmfl-spot |
| Robe BMFL (Familienschnitt Spot/WashBeam, für nicht spezifizierte „BMFL x2“) | 37,0 (Ø aus 36,0 Spot / 38,4 WashBeam) | https://www.robe.cz/bmfl-spot, https://www.robe.cz/bmfl-washbeam |
| Robe Robin MegaPointe (= „2500p“, siehe Klarstellung unten) | 22,0 | https://www.newlighting.com/37016/new-robe-robin-megapointe/download/product-specs/46290 |
| Robe Robin 100 LED Beam | 4,5 | https://www.10kused.com/product/robe-robin-led-beam-100-lfnh-56314/ |
| Robert Juliat Aramis (Verfolger) | 59,0 | https://rudideluxe.de/en/produkt/robert-juliat-aramis-2500-w-hmi-45-8-dmx/ |
| Robert Juliat Korrigan (Verfolger, inkl. externem Vorschaltgerät) | 43,0 | https://www.robertjuliat.com/Product_Specifications/Fiches_EN/Standard/DSEN103_1149.pdf |
| SGM Q-7 | 8,1 | https://www.atcomms.co.uk/wp-content/uploads/2019/02/SGM-Q7-Spec-Sheet.pdf |
| Clay Paky Sharpy (Legacy) | 19,0 | https://www.claypaky.it/products/sharpy-legacy/ |
| Clay Paky B-Eye K10 | 15,0 | https://www.huss-licht-ton.de/product_info.php/en/Clay-Paky-Aleda-B-EYE-K10-LED-Moving-Head-Wash/info/15831.html |
| Clay Paky B-Eye K20 | 21,0 | https://www.claypaky.it/products/a-leda-b-eye-k20/ |
| ETC Source Four (Standard-Ellipsoid) | 7,9 | https://support.etcconnect.com/ETC/Fixtures/Source_Four/Source_Four_ERS_and_HID/Fixture_and_Shipping_Weights_of_Source_Four |
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
| MDG Tourpack (Hazer bereits im Touring-Cradle) | ca. 84 (185 lb, gesamt, kein zusätzlicher Case-Anteil) | https://shop.solotech.com/products/mdg-theone-dual-fog-haze-single-high-output-generator-touring |
| GLP FR10 Bar (nur zur Plausibilisierung, nicht für die zwei FR10-Zeilen verwendet) | 24,0 | https://www.farralane.com/glp-impression-fr10-bar-10-x-60-watt-rgbw-led-moving-batten.html |

## Klarstellung Robe „2500p“ / „2500w“

Nach Rücksprache mit dem Nutzer bezeichnet `Robe 2500p x…` die Robin-MegaPointe-
Klasse (22 kg netto, Quelle s. o.). Für `Robe 2500w x…` („Wash-Variante“ derselben
Klasse) ließ sich kein eindeutiges, separat gelistetes Robe-Produkt dieses Namens
mit belastbarer Gewichtsangabe finden (weder unter „Robin 2500“ noch als
offizielle Wash-Version der MegaPointe-Baureihe). Deshalb bleiben
`Robe 2500w x1 -CAB` und `Robe 2500w x2 -CAB` bei `weight: 0` – bewusst, nicht
geraten.

## Berechnete Case-Gewichte (65 Einträge)

| Case | Geräte × Stück | Case-Gewicht (kg) |
|---|---|---|
| ChamSys MQ100 -CAB | 1 × ChamSys MQ100 | 30 |
| ChamSys MQ500 -CAB | 1 × ChamSys MQ500 | 45 |
| gMA2 FS -CAB | 1 × grandMA2 full-size | 60 |
| gMA2 Light -CAB | 1 × grandMA2 light | 50 |
| Astera AX5 -BBM | 1 × Astera AX5 | 20 |
| MagicBlade -BBM | 1 × MagicBlade | 40 |
| Magicblade wide -CAB | 1 × MagicBlade | 40 |
| Sharpy x2 gross -CAB | 2 × Sharpy | 55 |
| Sharpy x2 klein -CAB | 2 × Sharpy | 55 |
| B-Eye K20 x2 -Jäger | 2 × B-Eye K20 | 60 |
| B-Eye K10 x4 -CAB | 4 × B-Eye K10 | 80 |
| ETC S4 x6 -CAB | 6 × ETC Source Four | 65 |
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
| Mac Viper x2 -CAB | 2 × Mac Viper | 105 |
| Mac Ultra x2 -CAB | 2 × Mac Ultra | 125 |
| Mac Ultra x1-CAB | 1 × Mac Ultra | 60 |
| MDG Tourpack -BBM | Tourpack-Gesamtgewicht lt. Datenblatt | 85 |
| MDG Tourpack -CAB | Tourpack-Gesamtgewicht lt. Datenblatt | 85 |
| BMFL Spot -BBM | 1 × BMFL Spot | 55 |
| Robe 2500p x1 -CAB | 1 × Robin MegaPointe | 40 |
| Robe 2500p x2 -CAB | 2 × Robin MegaPointe | 75 |
| Robin 100 LED Beam -CAB | 1 × Robin 100 LED Beam | 20 |
| Aramis -CAB | 1 × Aramis | 95 |
| Korrigan -CAB | 1 × Korrigan | 65 |
| Q7 lang -BBM | 1 × SGM Q-7 | 25 |
| SGM Q7 x4 -CAB | 4 × SGM Q-7 | 45 |
| SGM Q7 x6 -CAB | 6 × SGM Q-7 | 65 |
| SF Fan Fogger -CAB | 1 × SF Fan Fogger | 40 |
| SF Data II -CAB | 1 × SF Data II | 30 |
| SF TourHazer II -CAB | 1 × SF TourHazer II | 30 |
| ETC S4 x8 -CAB | 8 × ETC Source Four | 85 |
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
| BMFL x2 -Motion | 2 × BMFL (Ø Spot/WashBeam) | 105 |
| D8+ 1t ProStage -cab | 1 × D8+ 1t | 45 |
| D8+ 1t ProStage -motion | 1 × D8+ 1t | 45 |
| FR10 x2 -RentAll | — (Originalwert Tabelle) | 73,52 |
| FR10 x6 -Motion | — (Originalwert Tabelle) | 276 |

## Bewusst bei 0 belassen

- **Robe 2500w x1/x2 -CAB**: kein eindeutiges Produkt gefunden, siehe Klarstellung
  oben.
- **ChamSys Wing Compact -CAB**: eigenständiges kleines Zusatzpult, nicht im
  Rechercheauftrag; Gewicht nicht recherchiert, um keine Zahl zu raten.
- **Generic-Fixtures ohne Herstellerbezug** (`4lite x6`, `Asym Flood x1/x6`,
  `2-light x12`, `8-light x6`, `4-light HORZ x8`, alle `Dolly …`-Einträge mit
  Company „Generic“): Firmenfeld ist „Generic“, kein recherchierbares
  Gerätemodell dahinter.
- **Q7 x4 / SGM Q7 x4 / SGM Q7 x6 / Q7 lang**: alle mit Gewicht versehen (SGM
  Q-7 eindeutig identifiziert), keine Ausnahme.
- **„Das K – Annahme“ -Kraftklub**: Bandspezifisches Sonderequipment ohne
  identifizierbares Katalogprodukt.
- **Intellipix -BBM**, **Sunstrips Sandwich -CAB**: kein Herstellerfeld, Gerät
  nicht sicher identifizierbar.
- **Base Station -Motion**, **motion Cam**: keine eindeutige Zuordnung zu einem
  bekannten Robe-Produkt dieses Namens gefunden.
- **Gunnar Arkaos Server / Gunnar Monitor / Gunnar Tools -CAB**: „Gunnar“ liest
  sich wie ein Crew-/Systemname, kein recherchierbares Gerätemodell.
- **MoCo 12ch / MoCo 32ch -CAB**: Motor-Steuerracks ohne öffentlich gelistetes
  Referenzprodukt mit Gewichtsangabe.
- **Dimmer 24ch / Dimmer 48ch -CAB**, alle **19″-Racks**, **Rack-/Dolly-/
  Rigging-Cases ohne Gerätebezug** (Truss, Trussdolly, FD34, MLT, Rigpack,
  Slick, Datarack, Multicore, Powerlock-VT, MLVT, Laka Loom, Schubladencase,
  63A VT Haube, Dolly Rack 28HE, Rack 16HE Deckel, Rack Amp 12HE Schieber):
  laut Aufgabenstellung ausdrücklich bei 0 kg zu belassen (kein Gerätebezug).

## Formel-Abweichungen (dokumentiert)

- **BMFL x2 -Motion**: Name nennt keine Variante (Spot/WashBeam/Blade). Die
  Netto-Gewichte der BMFL-Familie liegen mit 36–38,4 kg eng beieinander
  (deutlich unter der 5-kg-Rundung), daher wurde der Mittelwert 37 kg
  verwendet statt die Zeile auf 0 zu setzen.
- **MDG Tourpack -BBM/-CAB**: „Tourpack“ ist bei MDG bereits die Bezeichnung für
  das Hazer-Modul samt fest verbautem Touring-Cradle. Das Datenblatt nennt für
  diese Konfiguration ein Gesamtgewicht von ca. 84 kg (185 lb, Cradle ohne
  CO₂-Flaschen) – die Formel „Gerätegewicht × Stückzahl + Case-Anteil“ wurde
  hier nicht zusätzlich angewendet, weil das recherchierte Gewicht das Case
  bereits einschließt (sonst würde das Case doppelt gezählt).
