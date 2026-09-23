# Gewichtsrecherche für MLT-Traversenwagen (V0.8.0)

Recherchiert am 2026-09-23 für `js/data/preset-cases.js`. Alle Gewichte sind
Netto-Herstellerangaben für ein einzelnes Traversenstück (ohne Dolly). Formel je
Wagen-Vorlage:

```
Wagen-Gewicht = round( Stückgewicht × Stückzahl + Dolly-Pauschale )
Dolly-Pauschale = 2 × 12 kg (wie bei den bestehenden F34-/F44-Wagen)
```

Die Dolly-Pauschale ist ein Richtwert, kein recherchierter Wert für den
jeweiligen Hersteller-Dolly (siehe `docs/offene-punkte.md`). Ein Wagen trägt
`4` Stück (2 nebeneinander, 2 Lagen übereinander), wie bei den bestehenden
Traversenwagen-Vorlagen.

## H.O.F. MLT ONE/TWO/THREE – Querschnitt 29×29 cm (Gurtrohr 48,3×4,5 mm)

Passt in die bestehende Breitenklasse „34er (F34)“ (29 cm).

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

## H.O.F. MLT FOUR – Querschnitt 40×40 cm (Fachwerk 40×3 mm)

Passt in die bestehende Breitenklasse „40er (F44)“ (40 cm). Keine 1,2-m- oder
1,6-m-Variante im Herstellerprogramm.

| Länge | Stückgewicht | Quelle |
|---|---|---|
| 1,5 m | 60,0 kg | https://shop.h-of.de/de/veranstaltungstechnik/pre-rig-truss/mlt-four/3325/traverse-mlt-four |
| 2,4 m | 71,5 kg | s. o. |
| 3,0 m | 83,5 kg | s. o. |

## Prolyte S36PRF (fest) / S36PRA (flexibel) – Querschnitt 36×36 cm

Prolyte führt keine „MLT“-Baureihe; die S36-PreRig-Serie ist der direkte
Gegenpart (Gurtrohr 50×4 mm, Diagonalen 25×3 mm). Neue Breitenklasse „36er
(S36)“ in `TRUSS_PROFILES`. Nur in 1,22/2,44/3,05 m (4/8/10 ft) erhältlich –
keine 1,2-/1,6-/2,4-m-Variante.

| Modell | Länge | Stückgewicht | Quelle |
|---|---|---|---|
| S36PRF (fest) | 1,22 m | 25,27 kg | https://www.prolyte.com/products/aluminium-truss/rectangular-truss/s36prf-l122-pre-rig-truss-fixed-length-4ft |
| S36PRF (fest) | 2,44 m | 37,10 kg | s. o. |
| S36PRF (fest) | 3,05 m | 43,20 kg | s. o. |
| S36PRA (flexibel) | 1,22 m | 27,00 kg | https://www.prolyte.com/products/aluminium-truss/rectangular-truss/s36pra-l122-pre-rig-truss-flexable-length-4ft |
| S36PRA (flexibel) | 2,44 m | 38,70 kg | s. o. |
| S36PRA (flexibel) | 3,05 m | 45,16 kg | s. o. |
