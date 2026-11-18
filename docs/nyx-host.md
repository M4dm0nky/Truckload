# Einbindung in NYX

## Für den Admin: zu tun vor dem Heben des Submoduls auf 0.34.0

- Neue Datei `css/ui.css` (in `sw.js` eingetragen). NYX packt das Submodul über `**/*` ein, eine
  eigene Dateiliste ist nicht nachzuziehen.
- Schnittstelle Gestaltung auf **Version 2** (31 neue Tokens, Tabelle unter „Gestaltung“). Ohne
  NYX-Zuordnung bleiben sie auf ihren Standards: Truckload sieht in NYX dann aus wie bisher, nichts
  bricht. Die Drift-Sperre in NYX (`frontend/src/lib/truckload/theme.test.js`) meldet Version 2,
  bis `TOKENS_JE_VERSION[2]` eingetragen ist.
- Kein neuer Store, kein Datenmodell, keine Projektdatei betroffen.

Truckload läuft zusätzlich als Tab in NYX (Electron-App von Hoch/Steinmetz). NYX bindet dieses
Repo als Git-Submodul ein, festgenagelt auf einen geprüften Commit, und liefert es über ein
eigenes Protokoll `truckload://app/` aus. Diese Datei hält fest, worauf sich NYX verlässt. Wer
hier etwas davon ändert, bricht NYX, auch wenn alle Tests in diesem Repo grün sind.

## Speicher

In NYX setzt ein Preload `globalThis.truckloadHost`. `js/store/db.js` reicht dann jeden
Zugriff über `js/store/hostDb.js` dorthin durch. Ohne `truckloadHost` (GitHub Pages, localhost)
bleibt alles bei IndexedDB.

| Funktion | Rückgabe |
|---|---|
| `getAll(store)` | `Promise<Array>` aller Datensätze des Stores |
| `put(store, value)` | `Promise<void>`, `value.id` ist ein nicht leerer String |
| `del(store, id)` | `Promise<void>` |
| `writeMany({ puts, deletes })` | `Promise<void>`, `puts = [{ store, value }, …]`, `deletes = [{ store, id }, …]` |

Fehler kommen als abgelehnte Promise mit `Error`. Typische Meldungen sind „Kein Projekt offen.“
und „Das Projekt wurde gewechselt – Truckload lädt neu.“

Schlägt ein Lesezugriff fehl, sperrt Truckload bis zum Neuladen jeden Schreibzugriff („Laden aus NYX fehlgeschlagen – Truckload bitte neu laden.“). Die Ersatzansicht nach einem Ladefehler zeigt nur die mitgelieferten Daten, und Schreiben gegen einen Bestand, den niemand gesehen hat, könnte echte Daten überschreiben.

Wo NYX speichert:

| Store | Ort in NYX |
|---|---|
| `cases`, `collections`, `trucks`, `ruleSets` | projektübergreifend (`~/.lpm/lpm_types.db`) |
| `plans`, `projectRuleSets` | in der Projektdatei |

Projekt-Regelsets (Store `projectRuleSets`) und die mitgeführten Cases und Fahrzeuge eines Plans
(`plan.mitgefuehrt`, seit V 0.17.1): siehe [nyx-projektdatei.md](nyx-projektdatei.md).

Sammlungen (Store `collections`, seit V 0.17.0): siehe [nyx-sammlungen.md](nyx-sammlungen.md). Dort
steht auch, was NYX dafür vorab tun muss und was passiert, wenn der Store fehlt.

`db.putMany` und `db.writeMany` gehen beide über `writeMany` des Hosts. Puts und Deletes einer
Datei landen in NYX in einer Transaktion (alles oder nichts, wie bei IndexedDB). Über beide
Dateien hinweg ist der Aufruf aber **nicht** atomar (zuerst die projektübergreifenden Stores,
dann die Pläne). Sammlungs-Vorgänge (Case speichern, Sammlung anlegen, umbenennen, verschieben,
löschen, Sammlungsdatei importieren) betreffen nur `collections` und sind damit vollständig
atomar. Der Import einer Sicherung mischt dagegen `collections` mit `plans` und ist über beide
Dateien hinweg **nicht** atomar.

Ein neuer Store braucht eine Absprache mit NYX: NYX lehnt unbekannte Stores ab. Seit V 0.17.0 gilt
das für `collections`, seit V 0.17.1 (Projektdatei) zusätzlich für `projectRuleSets`; ohne die
Freigabe zeigt Truckload die Ersatzansicht und sperrt das Schreiben bis zum Neuladen (siehe
[nyx-sammlungen.md](nyx-sammlungen.md)).

## Was NYX voraussetzt

- Chromium ≥ 123 (Electron ≥ 30) wegen der JSON-Module (`import … with { type: 'json' }`, seit
  V 0.17.0); Safari ≥ 17.2, Firefox ≥ 138; nach Herstellerangaben, hier nicht geprüft
  (Details in [nyx-sammlungen.md](nyx-sammlungen.md)).
- Speicherzugriff nur über `js/store/db.js`, keine zweite Stelle, die `indexedDB` anfasst.
- Nur relative Pfade. Die App läuft unter `truckload://app/`, nicht unter `/Truckload/`.
- Der Service Worker registriert sich nur unter `http(s)` (`location.protocol.startsWith('http')`).
- Keine Netzabrufe zur Laufzeit. NYX muss offline laufen.
- Keine nativen `confirm()`/`alert()`/`prompt()`. Sie zerstören unter Windows in Electron die
  Tastatureingabe. Die eigenen `<dialog>`-Popups sind richtig.
- „Sichern“ bleibt ein normaler Download (`<a download>`), „Importieren“ ein `<input type=file>`.
  NYX fängt den Download ab und fragt selbst nach dem Speicherort.
- `vendor/LICENSE-three.txt` bleibt unter diesem Namen. NYX nimmt den Text in seine
  Open-Source-Liste auf. Wer Three.js aktualisiert, ersetzt auch diese Datei aus dem passenden
  Tag.

## Sprache

Truckload erkennt die Sprache am URL-Parameter `lang`: `index.html?…&lang=de|en`. Vorgabe ist
`de`, unbekannte Werte ergeben `de`. Ein Sprachwechsel lädt das Fenster neu.

`sprachen.json` im Wurzelverzeichnis listet die angebotenen Sprachen (`["de","en"]`, seit V 0.21.1);
NYX bietet danach Englisch an.

## Gestaltung

NYX passt Truckload im Tab an sein Erscheinungsbild an. Truckload legt dafür fest, was sich
gestalten lässt, NYX liefert die Werte. Seit Version 2 der Schnittstelle (Issue #48) reicht das bis
in die Bedienelemente und die Schrift der Ansichten.

- **Aufbau in drei Schichten:** Werte (Tokens in `css/app.css`, `:root`) → Bausteine (`css/ui.css`:
  Knopf, Feld, Segment, Reiter, Popup, Hinweis, nur aus Tokens) → Ansichten (`css/app.css`, setzen
  bei Bedienelementen nur Anordnung: `flex`, `width`, `margin` …). `index.html` lädt `ui.css` vor
  `app.css`. `tests/ui-bausteine.test.js` meldet Gestaltung von Bedienelementen in `app.css`,
  Farbliterale und feste Schriftgrößen außerhalb der Token-Blöcke; jeder Baustein in jedem Zustand
  steht auf der Musterseite `tools/muster.html` (nur für Entwickler, nicht ausgeliefert).
- **Varianten** setzt das Markup als Klasse: Knopf `.primary` `.danger` `.small` `.mini` `.large`
  `.chip` `.quiet` `.list-item`, Feld `.small` `.error` `.warn` `.color-compact`. Gewählt ist `.on`
  (gefüllt in `.seg` und am Reiter `.lkw-tab`, nur als Rand am `.list-item`); ein allgemeines
  `button.on` gibt es bewusst nicht.
- **Tokens:** die Liste in `js/ui/themeTokens.js` (`THEME_TOKENS`, `THEME_VERSION`). Die
  Standardwerte stehen in `css/app.css` und sind das Aussehen der Web-App. NYX setzt eigene
  Werte mit dem Selektor `:root:root[data-theme]`.
- **hell/dunkel:** `:root[data-theme="light"|"dark"]` überstimmt die Systemeinstellung. NYX
  setzt das Attribut, die Web-App nie.
- **Wechsel zur Laufzeit:** Nach jedem Setzen löst NYX `tl-theme` an `window` aus. Wer Farben
  einmalig liest (die 3D-Ansicht über `js/ui/themeColors.js`), liest sie dann neu.
- **Neue Tokens:** in `THEME_TOKENS` anhängen, `THEME_VERSION` und `--tl-theme-version` erhöhen,
  in `:root` von `css/app.css` eintragen (in die Modus-Blöcke nur, wenn sich der Wert je Modus
  unterscheidet) und hier in die Tabelle. NYX befüllt nur Tokens, die es für die gemeldete Version
  kennt. Umbenennen oder Entfernen bricht NYX, eine Drift-Sperre dort meldet es.
- **Nicht gestaltbar:** Gegenstandsfarben (Case-Schwarz, Alu, Räder, Griffe), die
  Beschriftungskontur, SVG-Beschriftungen (Plan-Einheiten) und das Layout.

Version 2 (zusätzlich zu den 18 Tokens von Version 1, Standard = Aussehen der Web-App):

| Token | Standard | wirkt auf |
|---|---|---|
| `--tl-control-height`, `--tl-control-height-sm` | `auto` | Mindesthöhe von Knopf/Feld, klein |
| `--tl-control-font-size`, `--tl-control-font-size-sm` | `inherit`, `12px` | Schrift von Knopf/Feld, klein |
| `--tl-button-pad`, `--tl-button-pad-sm` | `5px 10px`, `2px 8px` | Innenabstand Knopf |
| `--tl-field-pad`, `--tl-field-pad-sm` | `5px 8px`, `2px 6px` | Innenabstand Feld |
| `--tl-button-weight`, `--tl-button-primary-weight` | `inherit`, `600` | Schriftgewicht Knopf, Hauptknopf |
| `--tl-button-bg`, `--tl-button-hover-bg`, `--tl-button-hover-border` | `var(--tl-raised)`, `var(--tl-button-bg)`, `var(--tl-text-muted)` | Knopfgrund, Hover |
| `--tl-selected-bg`, `--tl-selected-text`, `--tl-selected-border` | `var(--tl-accent)`, `var(--tl-on-accent)`, `var(--tl-accent)` | Gewählt (gefüllt) |
| `--tl-marked-border` | `var(--tl-accent)` | Gewählt (Listeneintrag) |
| `--tl-dialog-radius`, `--tl-dialog-pad`, `--tl-dialog-title-size` | `12px`, `18px`, `18px` | Popup |
| `--tl-dialog-divider` | `transparent` | Linie unter dem Titel und über den Knöpfen |
| `--tl-backdrop` | `rgba(0,0,0,.5)` | Abdunkler |
| `--tl-warn`, `--tl-warn-text` | `#f2b705`, `#f2b705` (hell `#7a5a00`) | Warnfarbe |
| `--tl-control-border` | `var(--tl-line)` | Rand von Knopf, Feld, Art-Schalter |
| `--tl-font-size`, `--tl-line-height` | `14px`, `1.4` | Grundschrift |
| `--tl-hint-font-size` | `12px` | `.hint` |
| `--tl-font-size-xs`, `--tl-font-size-sm`, `--tl-font-size-lg` | `11px`, `12px`, `16px` | Schriftstufen der Ansichten (Einzelwerte als `calc()` darüber) |

## Drucken

In NYX druckt Truckload nicht mit `window.print()` (Electron zeigt dabei keine Vorschau),
sondern über den Host (`js/app/hostPrint.js`):

1. Ladeplan und Checkliste: `truckloadHost.druckRahmen({ doc, titel })` liefert
   `{ kopf, abschluss, randUntenMm }`. Truckload setzt `kopf` vor und `abschluss` hinter den
   Druckbereich und nimmt `randUntenMm` als unteren Seitenrand, Platz für NYX' Fußzeile.
   Scheitert der Aufruf, wird ohne Rahmen gedruckt.
2. `truckloadHost.print({ doc, titel })`: NYX erzeugt die PDF aus Truckloads Druckansicht und
   öffnet sie.
3. Danach räumt Truckload Seitenregel und Rahmen wieder ab.

Etiketten (`doc: 'labels'`) bekommen keinen Rahmen und keinen geänderten Rand.

Was NYX dabei wissen muss:

- **Container:** `kopf` landet in `<div class="host-print-kopf">` als erstes Kind von
  `#print-root`, `abschluss` in `<div class="host-print-abschluss">` als letztes. Beide tragen
  keine Truckload-Klassen. Gestylt werden sie von NYX, aber die Regeln aus `css/print.css`
  wirken trotzdem hinein, vor allem `#print-root svg` (`width: 100%`, `max-height: 55mm`) und
  `#print-root h1`. Ein Logo im Kopf muss das selbst überstimmen.
- **Spalten:** Checkliste und Ausladeliste setzen `#print-root.doc-checklist` auf zwei Spalten.
  Der Kopf steht dann in Spalte 1, der Abschluss am Ende des Spaltenflusses. Wer den Kopf über
  die volle Breite will, setzt `column-span: all` auf `.host-print-kopf`.
- **Mehr-LKW-Pläne:** Bei „alle LKW“ trägt `#print-root` zusätzlich `doc-all`, und jeder
  LKW-Abschnitt nach dem ersten beginnt mit `.p-break` auf einer neuen Seite. Der Kopf steht
  nur einmal vorn, der Abschluss nur einmal am Ende. Seitenbezogenes gehört deshalb in NYX'
  Fußzeile. Der `titel` nennt den Umfang: `Plan – alle LKW`, `Plan – <LKW>`, `Plan – Ohne LKW`,
  bei Ein-LKW-Plänen wie bisher `Plan – <Fahrzeug>`.
- **Druckarten:** `doc` ist `plan`, `checklist`, `unload` (Ausladeliste) oder `labels`. Eine neue
  Druckart braucht in NYX eine Bezeichnung für Kopf und Dateinamen.
- **Ein Druck zur Zeit:** Solange `print` läuft, ignoriert Truckload weitere Klicks auf „Drucken“.

## Neue Version in NYX übernehmen

Auf NYX-Seite: `git submodule update --remote truckload`, Tests, Handtest, Commit. NYX übernimmt
nie automatisch.
