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
| `putMany(items)` | `Promise<void>`, `items = [{ store, value }, …]` |

Fehler kommen als abgelehnte Promise mit `Error`. Typische Meldungen sind „Kein Projekt offen.“
und „Das Projekt wurde gewechselt – Truckload lädt neu.“

Schlägt ein Lesezugriff fehl, sperrt Truckload bis zum Neuladen jeden Schreibzugriff („Laden aus NYX fehlgeschlagen – Truckload bitte neu laden.“). Die Ersatzansicht nach einem Ladefehler zeigt nur die mitgelieferten Daten, und Schreiben gegen einen Bestand, den niemand gesehen hat, könnte echte Daten überschreiben.

Wo NYX speichert:

| Store | Ort in NYX |
|---|---|
| `cases`, `trucks`, `ruleSets` | projektübergreifend (`~/.lpm/lpm_types.db`) |
| `plans` | in der Projektdatei |

`putMany` ist in NYX je Datei eine Transaktion, über beide Dateien hinweg aber **nicht** atomar
(zuerst die projektübergreifenden Stores, dann die Pläne).

Ein neuer Store braucht eine Absprache mit NYX: NYX lehnt unbekannte Stores ab.

## Was NYX voraussetzt

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

## Neue Version in NYX übernehmen

Auf NYX-Seite: `git submodule update --remote truckload`, Tests, Handtest, Commit. NYX übernimmt
nie automatisch.
