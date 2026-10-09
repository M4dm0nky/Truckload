# Fahrzeugmaße (Vorlagen in `js/data/preset-trucks.js`)

Innenmaße Länge × Breite × Höhe in cm, Stand V 0.12.4 (2026-10-09). Alles **Richtwerte** aus
Verleiherangeboten und Branchenseiten, keine Herstellerdatenblätter – das Notizfeld „mit dem
echten Fahrzeug abgleichen“ bleibt. Je Fahrzeug wurde ein konkretes Angebot übernommen, keine
Mischwerte.

| Vorlage | L × B × H | Nutzlast | Quelle / Anmerkung |
|---|---|---|---|
| Sprinter kurz | 337 × 178 × 205 | 1000 kg | Inserat Sprinter L2H2 (3374 × 1776 × 2050). Nutzlast = Richtwert wie „lang“, keine eigene Quelle |
| Sprinter lang | 430 × 178 × 194 | 1000 kg | unverändert aus V 0.12.3; Inserate L3: 4300 × 1730–1780 × 1930–1970, zwischen den Radkästen ca. 130 cm (Breite 178 bleibt, Radkästen 22 cm je Seite) |
| 3,5-t-Koffer | 420 × 210 × 220 | 900 kg | unverändert; Inserate Iveco Daily 35S: 410–429 × 210–227 × 214–243 |
| 7,5-t-Koffer | 610 × 250 × 240 | 2500 kg | [Autovermietung Arndt](https://www.autovermietung-arndt.de/lkw-transporter/7-5-tonner-mieten) (Atego/Daily, 610 × 250 × 240, 2500 kg); andere Verleiher 603–605 × 246–248 × 230–237 |
| 12-t-Koffer | 720 × 248 × 230 | 5100 kg | Angebot MB Atego 12 t, L 7200 × B 2480 × H 2300 mm, 18 Palettenplätze; alternativ MAN 705 × 250 × 238, 5825 kg |
| 18-t-Koffer | 730 × 248 × 260 | 9000 kg | [Rentinorio](https://www.rentinorio.de/mieten/fahrzeuge/lkw_trucks/lkw/detail:338000175:0:0.html) Actros Koffer 7,30 / 2,48 / 2,60 m; Nutzlast 9–10 t je Angebot ([Arndt](https://corporate.autovermietung-arndt.de/nutzfahrzeuge/18-tonner-mieten): MAN TGM 10 t, 18 Paletten) |
| Trailer 40 t Koffer | 1362 × 248 × 270 | 24000 kg | Standardmaß 13,625 × 2,48 × 2,70 m ([Logistik Heute](https://logistik-heute.de/themen/anhaenger-und-aufbauten/trailer-oder-sattel-auflieger.html)); vorher 1360 |
| Trailer 40 t Koffer extra hoch | 1362 × 248 × 300 | 24000 kg | Mega, Innenhöhe 2,97–3,00 m ([Dachser](https://transport-online.de/news/dachser-umstellung-auf-megatrailer-47969.html)) |
| Trailer 40 t Gardine | 1362 × 248 × 270 | 24000 kg | Curtainsider: Breite 2,48 m (zwischen den Rungen 2,52), Höhe 2,68–2,71 m ([TIP](https://www.tip-group.com/de-ch/mietflotte/auflieger/curtainsider)). Gleiche Stellfläche wie der Koffer; die Seiten sind Plane |

Die Vorlagen-IDs der bestehenden Fahrzeuge (`preset-sprinter`, `preset-lkw75`, `preset-lkw12`,
`preset-sattel`, `preset-mega`) bleiben, nur Namen und Maße ändern sich; gespeicherte Pläne laden
weiter. Neu: `preset-sprinter-kurz`, `preset-lkw18`, `preset-gardine`.
