# UI-Bausteine: Werte → Bausteine → Wächter (Stufe B1)

Stand 2026-11-18. Abstimmung: Issue #48, Plan im Kommentar „NYX-Entscheidung: nicht nur Werte,
sondern derselbe Aufbau wie in NYX“ (issuecomment-6960938168). Gebaut von der NYX-Seite als PR,
Truckload merged. Marco hat die Entscheidung im Gespräch an NYX abgegeben („wir brauchen es am
Ende für NYX“); die offenen Punkte aus dem Kommentar sind deshalb hier von NYX entschieden und als
solche markiert.

## 1. Warum

In NYX übernimmt Truckload heute Farben, Schrift, Radius und hell/dunkel (Schnittstelle Version 1,
18 Tokens). Höhe, Innenabstand und Schriftgröße von Knöpfen und Feldern, der Gewählt-Zustand und
das Popup sehen dort weiter aus wie die Web-App, weil diese Werte fest im CSS stehen. Zusätzlich
gestalten 26 Stellen in `css/app.css` Knöpfe oder Felder lokal nach. Neue Oberfläche in Truckload
kann deshalb in NYX jederzeit wieder fremd aussehen, und jede Umgestaltung in Truckload trifft
verstreute Regeln.

B1 baut in Truckload denselben dreischichtigen Aufbau wie NYX #247: **Werte** (Tokens) →
**Bausteine** (eine Datei, nur aus Werten) → **Ansichten**, die Knopf und Feld nie selbst
gestalten, bewacht von einem Test. Danach ist das NYX-Aussehen nur ein zweiter Satz Werte (Stufe B3,
in NYX).

## 2. Ziele, Nicht-Ziele, Anti-Ziele

**Ziele**
- Alle Bedienelement-Gestaltung (Knopf, Feld, Auswahl, Textfeld, Segment, Reiter, Popup, Hinweis)
  steht in `css/ui.css` und liest nur Tokens.
- Schnittstelle Version 2: die Werte, die NYX braucht, um Truckload wie NYX aussehen zu lassen.
- Ein Wächter-Test verhindert, dass eine Ansicht Knopf oder Feld wieder selbst gestaltet oder eine
  Farbe fest einträgt.
- Eine Musterseite `tools/muster.html` zeigt jeden Baustein in jedem Zustand, hell und dunkel
  nebeneinander.
- Der Popup-Überlauf aus #45 ist behoben (`.editor label` mit `grid-template-columns:
  minmax(0, 1fr)`, `select` mit `max-width: 100%`).

**Nicht-Ziele (kommen später oder nie hier)**
- B2: Lucide-Symbole statt Zeichen, gemeinsamer Popup-Kopf mit ×. Eigener Schritt nach B1.
- B3: die NYX-Werte in `frontend/src/lib/truckload/theme.js`. Das macht NYX in NYX.
- `aria-pressed` statt `.on`. **NYX-Entscheidung:** `.on` bleibt; der Wechsel hieße 22 Stellen in
  9 JS-Dateien anzufassen und gehört nicht in einen Umbau, der nichts ändern soll.
- Aufbau und Abläufe (drei Spalten, Assistenten, Inspector), Druck (`css/print.css`), Darstellung
  der Gegenstände (SVG-Cases, 3D).

**Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)**
- Die Web-App sieht danach anders aus, außer an den in §6 aufgezählten Stellen.
- Ein Token wird nach dem Merge umbenannt oder entfernt: Das bricht NYX. Die Liste muss vor dem
  Merge stimmen (§7).
- Eine Abhängigkeit, ein Build-Schritt oder eine Datei, die `sw.js` nicht kennt.
- Die Bausteine kennen NYX (`ui-`-Klassen, NYX-Werte im Truckload-CSS).

## 3. Ansätze

1. **B1 allein, B2 später (gewählt).** Der PR ändert die Web-App nachweislich nicht; das macht den
   Merge für Marco einfach, der die Gestaltung nicht selbst beurteilen will. Symbole und Popup-Kopf
   folgen, wenn B1 in NYX zu sehen ist.
2. B1 und B2 in einem PR: schneller, aber ändert Marcos Web-App sichtbar, und der Bildvergleich
   belegt nicht mehr „nichts geändert“.
3. Nur B1, B2 nie: am wenigsten Arbeit, Zeichen-Symbole und Popup-Kopf blieben in NYX fremd.

Schon in #48 verworfen: NYX überschreibt Truckloads Klassen mit eigenem CSS (driftet bei jedem
Release lautlos), Truckload benutzt NYX' `ui-`-Klassen (Web-App hinge an NYX).

## 4. Schicht 1: Werte

Die 18 Tokens von Version 1 bleiben unverändert. Neu, jeweils mit dem **heutigen** Wert als
Standard, damit die Web-App gleich bleibt:

| Token (Vorschlag) | Standard | ersetzt heute |
|---|---|---|
| `--tl-control-height` | `auto` | (keine Höhe, ergibt sich aus Innenabstand) |
| `--tl-control-height-sm` | `auto` | |
| `--tl-control-font-size` | `inherit` | `font: inherit` |
| `--tl-control-font-size-sm` | `12px` | Zoom-Knöpfe, Chips |
| `--tl-button-pad` | `5px 10px` | `button, .btn` |
| `--tl-button-pad-sm` | `2px 8px` | `.lib-item button`, `.lib-group-head button` |
| `--tl-field-pad` | `5px 8px` | `select, input, textarea` |
| `--tl-field-pad-sm` | `2px 6px` | `.inspector input.insp-weight` |
| `--tl-button-weight` | `inherit` | |
| `--tl-button-primary-weight` | `600` | `button.primary` |
| `--tl-button-bg` | `var(--tl-raised)` | `button, .btn` |
| `--tl-button-hover-bg` | `var(--tl-button-bg)` | (heute ändert Hover nur den Rand) |
| `--tl-button-hover-border` | `var(--tl-text-muted)` | `button:hover` |
| `--tl-selected-bg` | `var(--tl-accent)` | `.seg button.on` und drei Kopien |
| `--tl-selected-text` | `var(--tl-on-accent)` | |
| `--tl-selected-border` | `var(--tl-accent)` | |
| `--tl-marked-border` | `var(--tl-accent)` | gewählter Listeneintrag (`.mat-firms button.on`, `.ge-row.on`) |
| `--tl-dialog-radius` | `12px` | `dialog` |
| `--tl-dialog-pad` | `18px` | `.editor` |
| `--tl-dialog-title-size` | `18px` | `.editor h2` |
| `--tl-dialog-divider` | `transparent` | (neu: Linie unter dem Titel, über `menu`) |
| `--tl-backdrop` | `rgba(0,0,0,.5)` | `dialog::backdrop` |
| `--tl-warn` | `#f2b705` | `--warn` |
| `--tl-warn-text` | `#f2b705` / hell `#7a5a00` | `--warn-text` |

- Die Namen sind ein Vorschlag im Stil der bestehenden. **Die endgültige Liste legt die Musterseite
  zusammen mit der NYX-Probe fest (§7).** Ein Token, den weder die Web-App noch NYX unterschiedlich
  belegt, fliegt raus; einer, der für NYX fehlt, kommt dazu.
- Standards dürfen auf andere Tokens verweisen (`var(--tl-accent)`). Setzt NYX nur `--tl-accent`,
  folgt der Gewählt-Zustand mit; setzt NYX `--tl-selected-bg`, gilt dessen Wert.
- Höhe `auto`: die Bausteine setzen `min-height: var(--tl-control-height)`. Die Web-App bleibt
  so pixelgleich, NYX setzt eine feste Höhe.
- `--warn`/`--warn-text` werden Aliasse auf `--tl-warn`/`--tl-warn-text`, wie `--accent` heute.
- **Blöcke:** jeder Token steht in `:root` in `css/app.css`. In die drei Modus-Blöcke
  (Hellmodus-Media, `data-theme="dark"`, `data-theme="light"`) nur, wenn sich der Wert je Modus
  unterscheidet; in Version 2 betrifft das nur `--tl-warn-text`. Das ist die heutige Praxis
  (`--tl-accent` steht auch nur in `:root`); der Kommentar in `js/ui/themeTokens.js`, der „alle
  vier Blöcke“ verlangt, wird entsprechend berichtigt. **NYX-Entscheidung.**
- Version: `THEME_VERSION = 2`, `--tl-theme-version: 2`, neue Tokens **hinten** an `THEME_TOKENS`
  angehängt (NYX vergleicht die Liste in fester Reihenfolge).
- Die Tokens bleiben in `css/app.css`, nicht in `ui.css`: `tests/theme.test.js` und `nyx-host.md`
  verweisen dorthin. **NYX-Entscheidung.**

## 5. Schicht 2: Bausteine in `css/ui.css`

**NYX-Entscheidung:** eigene Datei, damit der Wächter eine klare Grenze hat. `index.html` lädt sie
**vor** `css/app.css` (erst Grundbausteine, dann Ansichten), `sw.js` führt sie in `ASSETS`.

Inhalt, jeweils aus den heutigen Regeln zusammengeführt:

| Baustein | Varianten und Zustände | heutige Quelle |
|---|---|---|
| Knopf (`button`, `.btn`, `a.btn`) | normal, Haupt (`.primary`), Gefahr (`.danger`), klein, mini, groß, Chip, leise, Listeneintrag; hover, disabled, Fokus | Zeilen 38–44, 49, 67, 69, 86, 151, 202, 207, 250, 271 |
| Feld (`input`, `select`, `textarea`) | normal, klein, Fehler, Warnung, disabled, Farbwahl (`input[type=color]`) | 45, 153–154, 215, 226, 294, 296–297 |
| Gewählt-Zustand (gefüllt) | `.on` an Segment-Knöpfen, Rad-Knöpfen, Reitern; `label:has(input:checked)` im Art-Schalter | 58, 149, 229, 261, 289 |
| Gewählt-Zustand (markiert) | `.on` an Listeneinträgen | 251, 316 |
| Segment | `.seg`, `.seg-label`, `.kind-switch` | 58–59, 146–149 |
| Reiter | `.lkw-tab` mit `.on`, `.none` | 260–263 |
| Popup | `dialog`, `::backdrop`, `.editor`, `h2`, `label` (mit Überlauf-Fix), `.row`, `.check`, `fieldset`, `menu`, Trennlinie | 133–142 |
| Hinweis | `.hint`, `.banner`, `.banner-warn`, `.banner-close` | 47–49, 143 |

Größen der Knopf-Varianten (heutige Werte): Höhe und Schrift der Varianten laufen über Tokens, ihre
Innenabstände sind feste Teile des Bausteins (Kontrollentscheidung, Review I1):
- **klein**: Innenabstand `2px 8px`, Schrift geerbt (Bibliothek).
- **mini**: `1px 8px`, `12px`, Gewicht 400 (Zoom-Knöpfe in der Bildunterschrift, die sonst die
  fette Schrift der `figcaption` erben).
- **groß**: `10px 20px`, `15px` (Hauptknopf der Startseite).
- **Chip**: `3px 10px`, `12px`, Radius `999px` (Schnelllängen, Profiltreffer).
- **leise**: ohne Rand und Hintergrund, `16px`, `line-height: 1`, `2px 6px` (Banner schließen).
- **Listeneintrag**: links bündig, Text plus Zusatz (Startplan, Firmenliste, Geräte-Zeile).

Regeln für den Umzug:
- Jede Variante bekommt eine Klasse; die Ansicht setzt sie im Markup (`index.html` oder das
  erzeugte HTML in `js/`). Das ist eine Markup-Änderung ohne Verhaltensänderung. Klassennamen legt
  der Bauende fest: kurz, englisch wie `.primary`/`.danger`, eine Sprache für alle.
- Die lokale Regel, die ein Baustein ersetzt, wird **gelöscht**, nicht überschrieben.
- Ein Kontext-Selektor in `ui.css` ist erlaubt, wenn das heutige Aussehen sonst nicht exakt bliebe.
  Beispiel: `.editor input:disabled { opacity: .5 }` gilt heute nur im Popup; als globale Regel
  würde das gesperrte Gewichtsfeld im Inspector blasser. Es bleibt also ein Popup-Baustein.
- Anordnung bleibt in der Ansicht: `flex`, `width`, `min-width`, `max-width`, `margin`, `order`,
  `position` und Verwandte. Beispiele: `.case-tabs button { flex: 1 }`, `.lkw-g select
  { max-width: 180px }`, die Breiten der Dialoge je ID.
- Keine Literale in `ui.css`: nur `var(--tl-…)`, die alten Aliasse (`--accent` usw.), Schlüsselwörter
  (`transparent`, `inherit`, `none`) und Maße, die Teil des Bausteins sind (`1px` Rand).
- Nicht betroffen, weil kein Bedienelement: `.lib-item` (ein `div`), `.wiz-dot`, `.ti-tag`, `.ti-chip`
  (ein `div`, kein Chip-Knopf), `.issue`, `.bar`, alle `svg …`-Regeln. „Chip“ meint nur die Knöpfe
  `.quick-len` (Schnelllängen und Profiltreffer).
- **Was nach `ui.css` zieht:** nur Regeln für Bedienelemente, dazu `:focus-visible` (Fokus ist Teil
  des Baustein-Satzes, auch wo er an anderen Elementen greift) und `button:disabled`. In `app.css`
  bleiben `* { box-sizing }`, `[hidden]`, `body`, die Überschriften-Schrift und alles andere, was kein
  Bedienelement gestaltet. **NYX-Entscheidung.**
- **Rangfolge bleibt wie heute:** gewählt schlägt hover. Heute gewinnt `.seg button.on` (0,2,1) gegen
  `button:hover` (0,1,1), ein gewählter Knopf behält beim Überfahren seinen Akzentrand; dasselbe gilt
  für die markierten Listeneinträge. `ui.css` muss diese Reihenfolge über Spezifität (nicht über die
  Quellreihenfolge allein) halten. **NYX-Entscheidung.**
- **Reiter (`.lkw-tab`)** zieht ganz nach `ui.css`: eckige Unterkante, gewählt mit Gewicht 600,
  `.none:not(.on)` gestrichelt, `small` mit `opacity: .75`. Das Gewicht 600 bleibt als Wert im
  Reiter-Baustein, kein eigener Token.
- **Listeneinträge:** `.ge-row` behält sein Raster (`display: grid` usw.) als Anordnung in der Ansicht.
  Die Optik (links bündig, markiert) kommt aus der Listeneintrag-Klasse, die am `button` selbst sitzt,
  auch bei `.mat-firms` (kein Kontext-Selektor `.mat-firms button`). Vorhandene `aria-pressed` an
  `.ge-row` bleiben, wie sie sind.
- **Disabled-Labels im Popup** (`.editor label:has(> input:disabled)`) gehören zum Popup-Baustein.

## 6. Abnahme: Bildvergleich

Vorher = `origin/main` beim Abzweigen (0.33.0, `16aa14f`), nachher = Branch. Aufgenommen mit
`tools/cdp.mjs`, Szenarien im Scratchpad (Truckloads Regel), je hell und dunkel:

Start, Plan mit 2D und 3D, Bibliothek mit Gruppenkopf, Inspector mit Gewichtsfeld und Rädern,
Lade-Assistent, Tabellen-Import (Liste mit Fehler- und Warnfeld), Materialverwaltung mit
gewählter Firma, LKW-Reiter, drei Popups (Case-Editor mit Art-Schalter und Schnelllängen, Regeln,
Auswahl mit langer Liste aus #45), Banner. Dazu Zustände, die nur mit Eingabe entstehen: ein
normaler und ein gewählter Knopf unter der Maus (`p.mouse`), ein Knopf und ein Feld mit
Tastaturfokus (`p.key('Tab')`); der Abdunkler ist auf jedem Popup-Bild mit drauf. **NYX-Entscheidung.**

Verglichen wird automatisch Pixel für Pixel, nicht per Augenschein: Anzahl abweichender Pixel je
Bild und ein Differenzbild (ohne Abhängigkeit, z. B. über Canvas in Chrome per `p.eval`). Der 3D-
Bereich wird vom Vergleich ausgenommen oder auf eine feste Kamera gestellt, falls er nicht
deterministisch rendert.

**Erlaubte Unterschiede, abschließend:**
1. Der Überlauf-Fix im Popup mit langer Auswahl (#45).
2. Felder in der Tabellen-Import-Liste: heute `3px 5px`, danach Feld klein `2px 6px`. Zeilen werden
   2 px niedriger. **NYX-Entscheidung**, damit es nur eine kleine Feldgröße gibt.
3. Kantenglättung an Schrift und Rundungen (einzelne Pixel, keine Flächen).

Alles andere ist ein Fehler und wird behoben, nicht als erlaubt nachgetragen. Die Abnahme macht der
NYX-Nutzer (Aniflu) an den Bildern; Marco merged.

## 7. NYX-Probe vor dem Merge

Die Token-Liste ist nach dem Merge ein Vertrag (Umbenennen bricht NYX). Deshalb wird sie **vor**
dem Merge an NYX ausprobiert: NYX setzt sein Submodul lokal auf den Branch, trägt die Zuordnung in
`theme.js` ein (B3, eigener NYX-Branch, nicht Teil dieses PRs) und sieht sich den Truckload-Tab in
der laufenden App an. Erst wenn Truckload dort wie NYX aussieht, ist die Liste fest. Fehlende oder
überflüssige Tokens werden im Truckload-Branch nachgezogen; bis zum Merge dürfen Namen, Anzahl und
Reihenfolge der Version-2-Tokens noch frei wechseln, die 18 Tokens von Version 1 nie.

Die Musterseite zeigt nur die Truckload-Standardwerte; einen NYX-Wertesatz bekommt sie nicht (der
läge doppelt vor und driftete).

### 7a. Ergebnis der NYX-Probe (2026-11-18)

Die erste Probe sah gut aus, aber Ränder zu blass und Truckload wirkte rund 5 % größer als NYX. Ursachen:
Randfarbe ohne eigenen Token, Grundschrift 14 px statt 13 px, Hinweise 12 px statt 11 px, Zeilenhöhe 1,4 statt
NYX' Standard (≈ 1,2) und rund 20 feste Pixelgrößen in den Ansichten, die der Grundschrift nicht folgen.
**Nutzerentscheidung:** alles in B1 beheben. Damit reicht B1 über die Bedienelemente hinaus auf die Schrift
der Ansichten. Neue Tokens (Standard = heutiger Wert):

| Token | Standard | wirkt auf |
|---|---|---|
| `--tl-control-border` | `var(--tl-line)` | Rand von Knopf, Feld und Art-Schalter |
| `--tl-font-size` | `14px` | Grundschrift (`:root`) |
| `--tl-hint-font-size` | `12px` | `.hint` |
| `--tl-line-height` | `1.4` | Zeilenhöhe (`:root`) |
| `--tl-font-size-xs` | `11px` | kleine Zusätze (Versionsangabe, Tags, `kbd`) |
| `--tl-font-size-sm` | `12px` | Beschriftungen, Tabellenköpfe, Abschnittstitel |
| `--tl-font-size-lg` | `16px` | Überschriften der Bibliothek und des Inspectors |

Einzelwerte, die zu keiner Stufe passen (13, 15, 18 px), werden als ganzzahlige Rechnung über eine Stufe
geschrieben (`calc(var(--tl-font-size) - 1px)`), damit die Web-App pixelgleich bleibt und NYX sie trotzdem
mitverkleinert. SVG-Beschriftungen sind ausgenommen: Ihre Größen sind Einheiten des Plans (cm), keine
Bildschirmpixel. Der Wächter (§8) prüft zusätzlich, dass `font-size` in `app.css` und `ui.css` außerhalb der
Token-Blöcke und der `svg`-Regeln nur über Tokens läuft.

## 8. Schicht 3: Wächter

Neue Testdatei in `tests/`, `node --test`, ohne Abhängigkeiten. Ein kleiner CSS-Zerleger (Kommentare
weg, Regeln samt `@media`-Verschachtelung in Selektor + Deklarationen) liest `css/app.css` und
`css/ui.css`. `css/print.css` ist ausgenommen (Papier, eigener Aufbau).

Er meldet mit Datei, Selektor und Eigenschaft:
1. **In `app.css`** jede Regel, deren Ziel ein Bedienelement ist (`button`, `.btn`, `input`,
   `select`, `textarea`, `dialog`, `label` im Art-Schalter, sowie jede Baustein-Klasse aus `ui.css`)
   und die eine Gestaltungs-Eigenschaft setzt: `padding*`, `height`, `min-height`, `font*`,
   `line-height`, `color`, `background*`, `border*` (auch `-radius`), `box-shadow`, `opacity`,
   `outline*`, `cursor`, `text-align`. Erlaubt bleiben die Anordnungs-Eigenschaften aus §5.
   „Ziel“ ist das letzte zusammengesetzte Glied des Selektors (`.view figcaption .zoom button`
   zielt auf `button`, `.lib-item:hover` nicht). Ein Glied zielt auf ein Bedienelement, wenn es
   ein Element aus der Liste nennt **oder** eine Klasse, die in `ui.css` definiert ist. Damit fällt
   auch `.start-card .primary` darunter: Die Regel wird gelöscht, der Knopf bekommt die Variante
   groß. Eine Ansichtsklasse, die nur Anordnung setzt (`.case-tabs button { flex: 1 }`), meldet
   der Wächter nicht.
2. **In beiden Dateien** Farbliterale (`#…`, `rgb(`, `rgba(`, `hsl(`, benannte Farben außer
   `transparent`/`currentColor`) außerhalb der Token-Blöcke. Ausgenommen sind Regeln, deren
   Selektor mit `svg` beginnt (Gegenstandsfarben, laut `nyx-host.md` nicht gestaltbar).
3. **In `ui.css`** jede Längenangabe, die nicht über einen Token läuft, außer `1px`-Rändern,
   `0` und den Maßen, die §5 ausdrücklich als Teil eines Bausteins nennt. Der Bauende darf diese
   dritte Prüfung weglassen, wenn sie zu viele Ausnahmen braucht; dann steht das im PR.

**Gegenprobe:** Der Test prüft den Zerleger zusätzlich an einem eingebetteten CSS-Schnipsel mit je
einem Verstoß jeder Art und erwartet genau diese Meldungen. Außerdem einmal von Hand rot belegt
(eine der gelöschten lokalen Regeln zurückgelegt), das steht im PR.

`tests/theme.test.js` wird nachgezogen: Token-Liste und Standards von Version 2, und die
Regex-Prüfung „Knöpfe, Felder … lesen die Tokens“ liest `css/ui.css` statt `css/app.css`.

## 9. Musterseite `tools/muster.html`

- Liegt in `tools/`: nicht in `sw.js`, nicht im i18n-Test, im NYX-Paket ausgeschlossen
  (`tools/**`). Texte darin sind deutsch und gehen nicht über `t()`. Das ist vor dem Bau zu
  prüfen, nicht anzunehmen.
- Bindet `../css/app.css` und `../css/ui.css` ein, keine Kopie.
- Zeigt jeden Baustein aus §5 in jedem Zustand (normal, hover per Klasse oder `:hover`-Nachbau,
  Fokus, disabled, gewählt, Fehler, Warnung) und ein Popup mit langer Auswahl.
- Hell und dunkel **nebeneinander**: zwei `iframe`s derselben Seite mit `data-theme="light"` bzw.
  `"dark"` am Wurzelelement (das Attribut überstimmt die Systemeinstellung, wie in NYX).
- Wird vor dem Umzug der Ansichten gebaut und von Aniflu angesehen (§10, Schritt 2).

## 10. Ablauf

1. Diese Spec, dann Plan unter `docs/superpowers/plans/`, Umsetzung per Sub-Agents (Truckloads
   `CLAUDE.md`).
2. Tokens in `app.css`, Bausteine in `ui.css` neben den alten Regeln, Musterseite. **Halt:** Aniflu
   sieht die Musterseite an.
3. Bereich für Bereich umziehen, je Bereich lokale Regeln löschen und Markup-Klassen setzen:
   Kopfleiste und Banner, Startseite, Bibliothek, Inspector, Ansichten (Zoom), LKW-Reiter,
   Assistenten, Popups, Tabellen-Import und Geräte-Schritt, Materialverwaltung.
4. Wächter-Test, `theme.test.js`, `themeTokens.js` (Version 2), `sw.js`.
5. Bildvergleich (§6). **Halt:** Aniflu nimmt die Bilder ab.
6. NYX-Probe (§7), Token-Liste ggf. nachziehen, Bildvergleich erneut.
7. Doku: `docs/nyx-host.md` Abschnitt „Gestaltung“ (Version 2, Token-Tabelle, Bausteine-Regel),
   `docs/architektur.md` (neue Datei), Truckloads `CLAUDE.md` (neue Grundregel „Knopf und Feld nur
   über `css/ui.css`, der Wächter prüft“), `CHANGELOG.md`, „Für den Admin“-Abschnitt in
   `nyx-host.md` (NYX: neue Datei, nichts zu tun bis B3).
8. Versionsnummer vorschlagen und bestätigen lassen (Truckloads Regel; voraussichtlich Patch
   0.33.1), dann PR an `M4dm0nky/Truckload`, Hinweis in #48. Marco merged.

## 11. Dem Bauenden überlassen

- Klassennamen der Varianten und die genaue Form des CSS-Zerlegers.
- Wie hover in der Musterseite dauerhaft sichtbar wird.
- Wie der Pixelvergleich technisch läuft, solange er ohne Abhängigkeit auskommt und Zahlen liefert.
- Reihenfolge der Bereiche in Schritt 3.
- Ob der 3D-Bereich ausgenommen oder fest gestellt wird.
