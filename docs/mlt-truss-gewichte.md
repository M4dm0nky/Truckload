# Gewichtsrecherche für MLT-Traversenwagen (V0.7.2, korrigiert V0.7.3)

Recherchiert am 2026-09-23 für `js/data/preset-cases.js`. Alle Stückgewichte sind
Netto-Herstellerangaben für die Traverse selbst (ohne Grundplatte/Beine/Rollen).
Formel je Vorlage:

```
Case-Gewicht = round( Stückgewicht + Grundplatten-Pauschale )
Grundplatten-Pauschale = 25 kg
```

Die Grundplatten-Pauschale ist ein Richtwert für Grundplatte, Beine und Rollen,
kein recherchierter Wert für den jeweiligen Hersteller-Unterbau (siehe
`docs/offene-punkte.md`). **Ein Stück ist immer EINE Traverse** – anders als bei
den bestehenden F34-/F44-Traversenwagen (die mehrere Stücke auf einen
gemeinsamen Transport-Wagen stapeln) steht hier jedes Stück einzeln auf seinen
eigenen Beinen bzw. seinem eigenen Rollwagen und wird komplett montiert in den
Truck gerollt.

## Korrektur V0.7.3: Querschnitt und Aufbau

Die erste Fassung nahm fälschlich einen quadratischen Rohr-Querschnitt
an und stapelte 4 Stück auf einen gemeinsamen Wagen – wie die bestehenden F34-/
F44-Vorlagen. Nach Sichtung von Herstellerfotos und einer Bemaßungszeichnung
(H.O.F. „350MLT“, Artikel-Bild `hoffork_350MLT_bemassung`) ist das falsch:

- **Querschnitt ist rechteckig, nicht quadratisch**: H.O.F. 608×356 mm, Prolyte
  S36PR (Datenblatt) 610×360 mm – praktisch identisch zwischen den Herstellern.
  In der App: `STAND_TRUSS_W = 60`, `STAND_TRUSS_H = 35` (`js/model/truss.js`).
- **Ein Stück steht einzeln auf 4 Beinen** über einer schmalen Grundplatte mit
  Rollen (H.O.F. MLT ONE: direkt am Bein, kein eigener Rollwagen-Tisch;
  MLT TWO/THREE/FOUR: auf einem fahrbaren Unterwagen mit Teleskopbeinen) – nicht
  mehrere Stücke gestapelt auf einem gemeinsamen Flachwagen.
- **Standflächen-Breite** (Bein-/Rollen-Spur, `STAND_FOOTPRINT_W = 80` cm) ist
  eine Fotoabschätzung, keine Herstellerangabe.
- **Standhöhe** (montiert, auf Rollen/Beinen): für H.O.F. MLT TWO mit
  103 cm belegt (Produktseite, „Gesamthöhe mit Dolly“). Für ONE/THREE/FOUR und
  Prolyte S36PR keine Herstellerangabe gefunden – MLT TWO/THREE/FOUR und beide
  S36PR-Varianten sehen auf allen Fotos vergleichbar hoch aus (gleicher
  Rollwagen-Aufbau), deshalb einheitlich 103 cm als Richtwert übernommen.
  MLT ONE steht ohne eigenen Rollwagen-Tisch sichtbar niedriger, geschätzt auf
  75 cm (Fotovergleich, kein Herstellerwert).

## H.O.F. MLT ONE/TWO/THREE – Querschnitt 608×356 mm (Gurtrohr 48,3×4,5 mm)

| Modell | Länge | Stückgewicht | Quelle |
|---|---|---|---|
| MLT ONE | 1,6 m | 28,5 kg | https://shop.h-of.de/de/veranstaltungstechnik/pre-rig-truss/mlt-one/721/traverse-mlt-one |
| MLT ONE | 2,4 m | 38,8 kg | s. o. |
| MLT ONE | 3,2 m | 46,6 kg | s. o. |
| MLT TWO | 1,2 m | 36,8 kg | https://shop.h-of.de/de/moving-light-truss/2696/traversenstrecke-mlt-two |
| MLT TWO | 1,6 m | 41,8 kg | s. o. |
| MLT TWO | 2,0 m | 46,7 kg | s. o. |
| MLT TWO | 2,4 m | 50,8 kg | s. o. |
| MLT TWO | 3,0 m | 57,7 kg | s. o. |
| MLT TWO | 3,2 m | 60,1 kg | s. o. |
| MLT THREE | 1,2 m | 34,7 kg | https://shop.h-of.de/de/veranstaltungstechnik/pre-rig-truss/mlt-three/3080/traverse-mlt-three |
| MLT THREE | 1,6 m | 39,4 kg | s. o. |
| MLT THREE | 2,0 m | 44,4 kg | s. o. |
| MLT THREE | 2,4 m | 48,9 kg | s. o. |
| MLT THREE | 3,0 m | 55,6 kg | s. o. |
| MLT THREE | 3,2 m | 58,0 kg | s. o. |

## H.O.F. MLT FOUR – Querschnitt vergleichbar (Fachwerk 40×3 mm)

Keine 1,2-m- oder 1,6-m-Variante im Herstellerprogramm.

| Länge | Stückgewicht | Quelle |
|---|---|---|
| 1,5 m | 60,0 kg | https://shop.h-of.de/de/veranstaltungstechnik/pre-rig-truss/mlt-four/3325/traverse-mlt-four |
| 2,4 m | 71,5 kg | s. o. |
| 3,0 m | 83,5 kg | s. o. |

## Prolyte S36PRF (fest) / S36PRA (flexibel) – Querschnitt 610×360 mm

Prolyte führt keine „MLT“-Baureihe; die S36-PreRig-Serie ist der direkte
Gegenpart (Gurtrohr 50×4 mm, Diagonalen 25×3 mm). Nur in 1,22/2,44/3,05 m
(4/8/10 ft) erhältlich – keine 1,2-/1,6-/2,4-m-Variante.

| Modell | Länge | Stückgewicht | Quelle |
|---|---|---|---|
| S36PRF (fest) | 1,22 m | 25,27 kg | https://www.prolyte.com/products/aluminium-truss/rectangular-truss/s36prf-l122-pre-rig-truss-fixed-length-4ft |
| S36PRF (fest) | 2,44 m | 37,10 kg | s. o. |
| S36PRF (fest) | 3,05 m | 43,20 kg | s. o. |
| S36PRA (flexibel) | 1,22 m | 27,00 kg | https://www.prolyte.com/products/aluminium-truss/rectangular-truss/s36pra-l122-pre-rig-truss-flexable-length-4ft |
| S36PRA (flexibel) | 2,44 m | 38,70 kg | s. o. |
| S36PRA (flexibel) | 3,05 m | 45,16 kg | s. o. |
