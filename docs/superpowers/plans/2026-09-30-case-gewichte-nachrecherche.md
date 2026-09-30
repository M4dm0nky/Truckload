# Gewichte für 61 „0 kg“-Cases: Ergebnis der gemeinsamen Recherche

## Context

Von den 168 sichtbaren Cases standen 61 auf `weight: 0`, bewusst so belassen laut Recherche
vom 2026-09-20 (`docs/casemasse-gewichte.md`, „Bewusst bei 0 belassen“) mangels Gerätebezug.
In dieser Sitzung sind wir Gruppe B (Produktkategorie erkennbar, Konfiguration unklar) und
einen Teil von Gruppe C Case für Case durchgegangen: der Nutzer hat reale Konfigurationen
genannt, zwei Cases als überflüssig markiert, und für leere Rack-/Dolly-Gehäuse einen
Standardansatz nach Volumen abgesegnet (wie schon bei den Packcases).

**Bleibt am Ende bei 0 kg** (weiterhin ohne Gerätebezug bzw. zu unklar): Generic-Fixtures (7),
Das K -Kraftklub, Base Station/motion Cam -Motion, Gunnar ×3, Sunstrips Sandwich, Case klein
Adapter -Jäger, V-Mat -BBM, FD34 2m CUSTOMIZE, Slick (Nutzer: „Truss wägen wir beim Aufbau
selbst“ – Case bleibt, aber ohne Trussgewicht), Laka Loom 5fach (Bedeutung nach zwei
Rückfragen nicht eindeutig klärbar), MoCo 12ch/32ch (kein belegbares Gewicht gefunden), die
19″-Racks (schon vorher bewusst 0 kg). Nichts davon wird in diesem Durchgang angefasst.

## Vier Cases werden `legacy: true` (Nutzerwunsch „schmeiß raus“)

Gleiches Muster wie beim Packcase-Aufräumen V0.8.1 (`js/data/case-library.js:49`): Eintrag
bleibt für alte Ladepläne bestehen, verschwindet aber aus jeder Auswahl (`groupCases`,
`companiesOf`).

- `lib-63a-vt-haube-bbm` (63A VT Haube -BBM)
- `lib-rigpack-cab` (Rigpack -CAB)
- `lib-lakabaum-flach-bbm` (Lakabaum (flach) -BBM)
- `lib-lakabaum-transflex-bbm` (Lakabaum (Transflex) -BBM)

## Neue Gewichte

Formel wie in der bestehenden Recherche, wo ein Gerät dahintersteht:
`round5(Gerätegewicht_netto × Stückzahl + max(15 kg, Außenvolumen_m³ × 40 kg/m³))`

Für die leeren Rack-/Dolly-Gehäuse (kein Gerät, Nutzerwunsch: Standard nach Volumen wie bei
den Packcases) ein eigener, recherchierter Richtwert: **75 kg/m³**, hergeleitet aus einem
realen leeren 19″-Rack-Case (KORN Case 7HE ohne Deckel, Birke, 10,6 kg bei ca. 0,14 m³ ≈
76 kg/m³, reverb.com). Klar als Standard gekennzeichnet, keine Einzelquelle je Case.

| Case | ID | Maße (cm) | Neues Gewicht | Herleitung |
|---|---|---|---|---|
| ChamSys Wing Compact -CAB | lib-chamsys-wing-compact-cab | 60×35×20 | **20 kg** | Konsole 4,0 kg (chamsyslighting.com/product/magicq-compact-wing) + Case-Anteil 15 kg |
| Intellipix -BBM | lib-intellipix-bbm | 120×67×73 | **40 kg** | Ayrton IntelliPix-R, 15,9 kg (ambersphere.com/product/intellipix-xt – Marke vom Nutzer bestätigt, nicht aus dem Firmenfeld „BBM“ ableitbar) + Case-Anteil 23,5 kg |
| Powerlock-VT groß -CAB | lib-powerlock-vt-gross-cab | 147×80×94 | **140 kg** | Direkttreffer: INDU Powerlock 400A, exakt 4×125A+4×63A+2×32A+3×16A (jundc.com/produkt/powerlock-verteiler-4x125a-4x-63a-2x-32a-3x-16a-rcd-im-case), Nutzer bestätigt Bauart |
| Powerlock-VT klein -CAB | lib-powerlock-vt-klein-cab | 85×60×83 | **50 kg** (Schätzung) | Kein Direkttreffer für 4×63A+2×32A+3×16A; Interpolation zwischen 33 kg (1×63A+4×32A+4×16A+3×Schuko, lichtundton.at) und 140 kg oben, vom Nutzer als Schätzung akzeptiert |
| MLVT 24ch -CAB | lib-mlvt-24ch-cab | 75×60×95 | **75 kg** | Nutzer-Standardwert, gilt für alle vier MLVT-Varianten gleich |
| MLVT 48ch -CAB | lib-mlvt-48ch-cab | 120×60×95 | **75 kg** | dito |
| MLVT 63A 19″ -CAB | lib-mlvt-63a-19-cab | 65×55×33 | **75 kg** | dito |
| MLVT 63A Hotpatch ROW -CAB | lib-mlvt-63a-hotpatch-row-cab | 80×55×99 | **75 kg** | dito |
| Laka Loom 20-30 -CAB | lib-laka-loom-20-30-cab | 100×60×73 | **75 kg** | 5× Harting-HAN16-Lastkabel gestaffelt 20–30 m (Ø 25 m) à 0,33 kg/m (H07RN-F 5G2,5-Richtwert, elektrikshop.de) + 2× Netzwerk (Ø 25 m à 0,15 kg/m, geschätzt) + 1× LK24 (25 m à 0,20 kg/m, geschätzt) + 1× Erdung (25 m à 0,10 kg/m, geschätzt) + Case-Anteil 17,5 kg |
| Laka Loom 28-40 -CAB | lib-laka-loom-28-40-cab | 124×55×68 | **95 kg** | dito, Ø 34 m |
| Laka Loom 45m -CAB | lib-laka-loom-45m-cab | 120×60×73 | **120 kg** | dito, alle 5 Kabel gleich 45 m (Nutzerangabe, keine Staffelung) |
| Powerlocksatz 10m -BBM | lib-powerlocksatz-10m-bbm | 112×120×53 | **80 kg** | 5× Powerlock-Kabel 95 mm² à 10 m, ca. 1,05 kg/m (grobe Herleitung aus Kabelsatz-Angeboten, meevi-rent.de – keine reine Einzelader-Quelle, siehe Dokument) + Case-Anteil 28,5 kg |
| Powerlocksatz 10m -CAB | lib-powerlocksatz-10m-cab | 120×60×55 | **70 kg** | dito, kleineres Case (Anteil 15,8 kg) |
| Dimmer 24ch -CAB | lib-dimmer-24ch-cab | 82×60×120 | **70 kg** | 2× MA Digital Dimmer 12×2,3kVA, 23 kg/Stück (malighting.com/product-archive/product/ma-digital-dimmer-12-x-2-3kva-140501) + Case-Anteil 23,6 kg |
| Dimmer 48ch -CAB | lib-dimmer-48ch-cab | 82×60×154 | **120 kg** | 4× MA Digital Dimmer 12×2,3kVA + Case-Anteil 30,3 kg |
| Datarack braun -CAB | lib-datarack-braun-cab | 75×60×95 | **30 kg** | Standard 75 kg/m³ (0,4275 m³) |
| Datarack schwarz -CAB | lib-datarack-schwarz-cab | 57×55×90 | **20 kg** | Standard 75 kg/m³ (0,282 m³) |
| Rack 16HE Deckel -CAB | lib-rack-16he-deckel-cab | 75×60×95 | **30 kg** | Standard 75 kg/m³ |
| Rack Amp 12HE Schieber -CAB | lib-rack-amp-12-he-schieber-cab | 80×60×85 | **30 kg** | Standard 75 kg/m³ |
| Schubladencase 90 -CAB | lib-schubladencase-90-cab | 60×61×90 | **25 kg** | Standard 75 kg/m³ – reale Schubladencases liegen recherchiert eher bei 120–300 kg/m³ (mehr Material durch Schubfächer), hier bewusst der einfache Rack-Standard verwendet; im Dokument als Einschränkung vermerkt |
| Dolly Rack 28HEx2 -CAB | lib-dolly-rack-28-hex2-cab | 120×80×160 | **115 kg** | Standard 75 kg/m³ (1,536 m³) |
| Markus Tools -ROW only -CAB | lib-markus-tools-row-only-cab | 60×60×118 | **30 kg** | Standard 75 kg/m³ |
| Dimmerdolly (klein/Rack) -BBM | lib-dimmerdolly-klein-rack-bbm | 207×60×160 | **150 kg** | Standard 75 kg/m³ (1,987 m³), leeres Gestell, Dimmer zählt separat (Nutzerangabe) |
| Dimmerdolly (klein/Rack) -CAB | lib-dimmerdolly-klein-rack-cab | 206×80×162 | **200 kg** | Standard 75 kg/m³ (2,672 m³), dito |

24 Cases bekommen ein Gewicht, 4 werden `legacy`, der Rest bleibt unverändert bei 0 kg.

## Umsetzung (Bounded, reine Datenpflege)

- `js/data/case-library.js`: bei jedem der 24 Cases `weight` setzen und einen kurzen
  Quellenkommentar wie bei den schon recherchierten Einträgen ergänzen; bei den 4 Cases
  `{ legacy: true }` in die Optionen aufnehmen (Muster: Zeile 49/62f.).
- `docs/casemasse-gewichte.md`: neuer Abschnitt „Nachrecherche 2026-09-30 (61 offene Cases)“
  mit der Tabelle oben, der 75-kg/m³-Herleitung, der Cable-Gewichts-Herleitung (H07RN-F- und
  Powerlock-Richtwerte, mit Unsicherheit klar benannt) und den vier `legacy`-Fällen mit
  Begründung „auf Nutzerwunsch aus der Auswahl entfernt, 2026-09-30“.
- `README.md`: falls dort eine Zahl zu „X von Y Cases mit Schätzgewicht“ steht, aktualisieren
  (65 → 89 recherchiert/gesetzt, Rest weiter bewusst bei 0 kg).
- Test: bestehenden bzw. neuen Regressionstest in `tests/caseLibrary.test.js` ergänzen, der
  die 24 neuen Gewichte und die 4 `legacy`-Flags gegen `CASE_LIBRARY` verankert (TDD: Test
  zuerst schreiben, rot sehen, Werte eintragen, grün).
- `npm test` grün.
- Auswirkung auf bestehende Ladepläne: Nutzlast/Schwerpunkt ändern sich sofort für Pläne mit
  diesen Case-Typen; Platzierung erst beim nächsten „Alles neu packen“ (wie bei den
  Packcase-Gewichten in V 0.8.6). Kein Maßverlust, da nur `weight` betroffen ist.
- CHANGELOG-Eintrag und Versionsnummer (Vorschlag: Patch) erst nach Rückfrage am Ende, wie
  in CLAUDE.md „Versionierung“ vorgesehen.

## Verifikation

- `npm test` grün, inkl. neuem Regressionstest.
- Stichprobe im Browser (`tools/cdp.mjs`): ein Load mit z. B. Powerlock-VT groß und Dimmer
  48ch anlegen, Inspector zeigt die neuen Gewichte, Nutzlast stimmt mit der Summe überein.
- `docs/casemasse-gewichte.md` nennt zu jedem neuen Gewicht Quelle bzw. Herleitung, die vier
  entfernten Cases sind dort mit Datum und Nutzerwunsch dokumentiert, nicht kommentarlos
  verschwunden.
