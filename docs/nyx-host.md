# Einbindung in NYX

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
| `plans` | in der Projektdatei |

Sammlungen (Store `collections`, seit V 0.16.1): siehe [nyx-sammlungen.md](nyx-sammlungen.md). Dort
steht auch, was NYX dafür vorab tun muss und was passiert, wenn der Store fehlt.

`db.putMany` und `db.writeMany` gehen beide über `writeMany` des Hosts. Puts und Deletes einer
Datei landen in NYX in einer Transaktion (alles oder nichts, wie bei IndexedDB). Über beide
Dateien hinweg ist der Aufruf aber **nicht** atomar (zuerst die projektübergreifenden Stores,
dann die Pläne). Sammlungs-Vorgänge (Case speichern, Sammlung anlegen, umbenennen, verschieben,
löschen, Sammlungsdatei importieren) betreffen nur `collections` und sind damit vollständig
atomar. Der Import einer Sicherung mischt dagegen `collections` mit `plans` und ist über beide
Dateien hinweg **nicht** atomar.

Ein neuer Store braucht eine Absprache mit NYX: NYX lehnt unbekannte Stores ab. Seit V 0.16.1 gilt
das für `collections`; ohne die Freigabe zeigt Truckload die Ersatzansicht und sperrt das
Schreiben bis zum Neuladen (siehe [nyx-sammlungen.md](nyx-sammlungen.md)).

## Was NYX voraussetzt

- Chromium ≥ 123 (Electron ≥ 30) wegen der JSON-Module (`import … with { type: 'json' }`, seit
  V 0.16.1); Safari ≥ 17.2, Firefox ≥ 138; nach Herstellerangaben, hier nicht geprüft
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

## Gestaltung

NYX passt Truckload im Tab an sein Erscheinungsbild an. Truckload legt dafür fest, was sich
gestalten lässt, NYX liefert die Werte.

- **Tokens:** die Liste in `js/ui/themeTokens.js` (`THEME_TOKENS`, `THEME_VERSION`). Die
  Standardwerte stehen in `css/app.css` und sind das Aussehen der Web-App. NYX setzt eigene
  Werte mit dem Selektor `:root:root[data-theme]`.
- **hell/dunkel:** `:root[data-theme="light"|"dark"]` überstimmt die Systemeinstellung. NYX
  setzt das Attribut, die Web-App nie.
- **Wechsel zur Laufzeit:** Nach jedem Setzen löst NYX `tl-theme` an `window` aus. Wer Farben
  einmalig liest (die 3D-Ansicht über `js/ui/themeColors.js`), liest sie dann neu.
- **Neue Tokens:** in `THEME_TOKENS` anhängen, `THEME_VERSION` und `--tl-theme-version` erhöhen,
  in alle vier Blöcke von `css/app.css` und hier eintragen. NYX befüllt nur Tokens, die es für
  die gemeldete Version kennt. Umbenennen oder Entfernen bricht NYX, eine Drift-Sperre dort
  meldet es.
- **Nicht gestaltbar:** Gegenstandsfarben (Case-Schwarz, Alu, Räder, Griffe), die
  Beschriftungskontur und das Layout.

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
