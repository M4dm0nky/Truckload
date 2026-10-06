# Gewerk Audio: Line-Array- und Sub-Vorlagen für sechs Hersteller

## Context

Truckload kennt im Gewerk „Ton“ bisher nur 19″-Racks (`js/data/case-library.js`, 11
Ton-Cases). PA-Lautsprecher fehlen komplett. Nutzerwunsch: L-Acoustics, d&b, Meyer Sound,
Martin Audio, RCF, Nexo recherchieren — Line-Array-Elemente und Subwoofer, Maße/Gewichte und
übliche Transportvarianten (Array-Stacks auf Dollys). Ziel: neutrale Vorlagen (kein
`company`-Feld, passend zum Firmen-Filter-Standard „Neutral“ aus V 0.9.3).

## Recherchestand: Einzelboxen vollständig, mit Quelle

| Vorlage (Einzelbox, Array-Tops stehend wie geflogen) | L×T×H (cm) | Gewicht | Quelle |
|---|---|---|---|
| L-Acoustics K2 | 138 × 40 × 29–35 | 56 kg | [K2 Rigging Manual](https://static.rt-events.fr/document/l-acoustics_k2_manuel_accroche.pdf), Appendix C (offiziell, selbst gelesen) |
| d&b V8/V12 | 70 × 46 × 31 | 34 kg | [V8/V12 Manual 1.8](https://www.dbaudio.com/assets/products/downloads/manuals-documentation/v-series/dbaudio-manual-v8-v12-1.8-en.pdf) (offiziell, selbst gelesen) |
| Meyer Sound LEOPARD | 68 × 55 × 28 | 34 kg | [LEOPARD Datasheet](https://docs.meyersound.com/pdf/leopard_ds_e2.pdf) (offiziell) |
| Martin Audio WPC | 77 × 42 × 32 | 35 kg | [WPC Datasheet](https://martin-audio.com/downloads/datasheets/WPCdatasheet.pdf) (offiziell) |
| Martin Audio WPS | 65 × 40 × 26 | 27 kg | [martin-audio.com/.../wps](https://martin-audio.com/products/loudspeakers/wps) (offiziell) |
| RCF HDL 20-A | 71 × 45 × 29 | 30 kg | Händlerangabe, konsistent über mehrere Quellen |
| Nexo GEO M620 | 37 × 26 × 19 | 10 kg | Händler-/Manual-Angabe |
| Nexo GEO M6B | 37 × 26 × 19 | 8 kg | dito |

**Nutzerangabe zu Subs:** Sie werden **liegend (flach)** transportiert, als 2er-Stacks oder
mehr — wie viele, richtet sich danach, was noch in den Truck passt und nicht zu schwer wird,
keine feste Herstellerangabe. Die Einzelbox-Vorlage wird deshalb in der liegenden Orientierung
angelegt (kleinste recherchierte Achse wird zur Höhe, die beiden größeren zur Grundfläche) —
eine Umrechnung der recherchierten Maße, keine neue Zahl. Das Stapeln selbst übernimmt
Truckload wie bei jedem anderen stapelbaren Case von selbst (`stackable: true`, Lagen).

| Vorlage (Einzelbox, Sub liegend) | L×T×H (cm) | Gewicht | Quelle der Originalmaße |
|---|---|---|---|
| L-Acoustics KS28 | 134 × 72 × 55 | 79 kg | [l-acoustics.com/products/ks28](https://www.l-acoustics.com/products/ks28/) |
| d&b V-SUB | 73 × 70 × 61 | 64 kg | Sekundärquelle, nicht aus einem offiziellen d&b-PDF bestätigt |
| Meyer Sound 900-LFC | 70 × 63 × 62 | 62 kg (netto) | [900-LFC Datasheet](https://docs.meyersound.com/products/en/datasheet---900-lfc.html) (offiziell) |
| RCF SUB 8006-AS | 111 × 71 × 70 | 96 kg | Händlerangabe |
| Nexo LS18 | 78 × 68 × 51 | 56 kg (gerundet) | [LS18 Datasheet](https://www.nexo-sa.com/wp-content/uploads/LS18_Data_Sheet.pdf) (offiziell) |

Martin Audio hat in dieser Recherche keinen dedizierten Sub (WPS ist laut Hersteller ein
kompaktes Line-Array-Top, kein Sub).

## Dolly-Stacks: Array-Tops abgeleitet und validiert, Subs vorerst einzeln

**Nutzerangabe (entscheidend):** Line-Array-Elemente werden mit parallel gestellten
Curve-Stäben (0°-Splay) transportiert — dabei stapeln sie sich als sauberes Rechteck, kein
Keilproblem. Die Dollys sind meist nur wenig größer als das Boxenmaß.

Daraus eine Formel, **kalibriert an den zwei einzigen real dokumentierten leeren Dollys**
(L-Acoustics K2-CHARIOT 145×61×29 cm, RCF KRT-WH 4X HDL20 52×74×20 cm — Maße des leeren
Transportgestells, offiziell): Stapel-Grundfläche = Boxenbreite + 10 cm, Boxentiefe + 20 cm;
Stapelhöhe = 25 cm Sockel + Stückzahl × Boxenhöhe. **Gegenprobe K2:** Formel liefert
148 × 60 cm — der echte K2-CHARIOT ist 145 × 61 cm. Trifft auf 2–3 cm genau.

**Gewicht bewusst ohne Dolly-Eigengewicht** — nur Stückzahl × recherchiertes Boxengewicht.
Für das Dolly-Eigengewicht selbst gibt es nur zwei sehr unterschiedliche Referenzen (K2:
50 kg leer bei 56-kg-Boxen; RCF: 13 kg leer bei 30-kg-Boxen, kein verlässliches Verhältnis).
Eine erfundene Zahl beim Gewicht ist nach CLAUDE.md „Haltung“ schlimmer als eine fehlende —
das Gesamtgewicht der Vorlage ist damit eine dokumentierte Untergrenze, kein Fehler.

**Nur für die Array-Tops angewendet** (K2, V8/V12, LEOPARD, WPC, WPS, HDL 20-A, GEO M620/M6B)
— dort gilt die 0°-Splay-Logik des Nutzers direkt und ist ein echtes, fest paketiertes
Transportstück (K2-CHARIOT, KRT-WH usw. sind reale Herstellerprodukte für genau diese
Stückzahl). Bei **Subs** gibt es laut Nutzer keine feste Stückzahl (liegend, 2er oder mehr, je
nach Platz/Gewicht) — dafür also **keine** eigene Dolly-Stack-Vorlage. Ihre liegende
Einzelbox-Vorlage reicht: Der Nutzer packt beim Laden so viele in einen Load, wie er braucht,
und Truckload stapelt sie wie jedes andere `stackable`-Case von selbst.

### Berechnete Array-Top-Stacks

| Vorlage | L×T×H (cm) | Gewicht |
|---|---|---|
| L-Acoustics K2 4er (auf Dolly) | 148 × 60 × 167 | 224 kg |
| d&b V8/V12 4er (auf Dolly) | 80 × 66 × 149 | 136 kg |
| Meyer Sound LEOPARD 4er (auf Dolly) | 78 × 75 × 137 | 136 kg |
| Martin Audio WPC 4er (auf Dolly) | 87 × 62 × 153 | 140 kg |
| Martin Audio WPS 4er (auf Dolly) | 75 × 60 × 129 | 108 kg |
| RCF HDL 20-A 4er (auf Dolly) | 81 × 65 × 141 | 120 kg |
| Nexo GEO M620 6er (auf Dolly) | 47 × 46 × 139 | 60 kg |
| Nexo GEO M6B 6er (auf Dolly) | 47 × 46 × 139 | 48 kg |

(Nexo offiziell mit 6 Stück je Case/GMT-6CASE bestätigt, nicht 4 — deshalb hier 6er statt 4er.)

## Umsetzung

- **Datei:** `js/data/preset-cases.js`. 13 Einzelbox-Vorlagen (`P(...)`, Kategorie `'Ton'`,
  `stackable: true`) plus 8 Dolly-Stack-Vorlagen für die Array-Tops. Array-Top-Einzelboxen und
  -Stacks: `tippable: false` (geflogen/0°-Splay-Stapel, nie tippen). Sub-Einzelboxen: bereits
  in liegender Orientierung angelegt, ebenfalls `tippable: false` (die Liegend-Lage IST schon
  die Transportlage, kein weiteres Tippen nötig). Kein neuer Helper wie `T()`/`MLT()` — die
  Werte sind fertig berechnet, gehen direkt in `P()`. Die Stack-Vorlagen bekommen `layers: [1]`
  (der Stack ist bereits der volle Turm, keine zweite Lage obendrauf) und einen Kommentar, der
  die Herleitung referenziert.
- **Keine neue Datei**, `sw.js` bleibt unberührt.
- **Namen:** Einzelboxen `"<Hersteller> <Modell>"` (z. B. „L-Acoustics K2“, „Nexo LS18“),
  Array-Top-Stacks `"<Hersteller> <Modell> 4er (auf Dolly)"` bzw. „6er“ bei Nexo. Kein
  Firmenkürzel-Suffix wie „-CAB“ — das steht für die Verleihfirma des Nutzers, nicht den
  Gerätehersteller.
- **Tests:** neue Prüfungen, dass alle 21 Audio-Presets `category === 'Ton'`,
  `company === undefined`, Gewicht `> 0` haben; für die 8 Array-Top-Stacks zusätzlich ein
  Test, der die K2-Gegenprobe aus diesem Plan nachrechnet (148×60×167, 224 kg).
- **Doku:** `docs/casemasse-gewichte.md` neuer Abschnitt mit beiden Tabellen, der
  Dolly-Formel (mit K2-Gegenprobe), der liegenden Sub-Orientierung und der Entscheidung
  „Subs ohne festen Stack, da keine feste Stückzahl“; `docs/architektur.md`/README falls dort
  Vorlagenzahlen genannt sind.
- **Version:** Patch-Vorschlag, vor dem Commit bestätigen lassen (CLAUDE.md-Ablauf).

## Verifikation

- `npm test` grün, neue Tests für die 21 Presets inkl. K2-Gegenprobe.
- Browser-Probe (`tools/cdp.mjs`): Lade-Wizard, Reiter „Cases“, Gewerk „Ton“ — alle 21
  Vorlagen erscheinen unter „Vorlagen“; eine Array-Top-Stack-Vorlage UND mehrere Sub-Einzel-
  boxen in einen Load ziehen, Maße im Inspector gegen die Tabelle prüfen, beim Sub beobachten,
  dass er sich wie erwartet stapeln lässt (Lage 2, 3 …).
- Typografie-Prüfung (CLAUDE.md), Doku-Zahlen stimmen mit dem Datenbestand überein.
