# Entscheidungen zu den offenen Issues

Stand 2026-10-21 („Issues auf null“). Ein Abschnitt je Issue: was getan wurde, was nicht, warum.
Entscheidungen der Klasse E sind eigene Entscheidungen bzw. Bestätigungen früherer Nutzerentscheidungen,
wie sie in den Issues beschrieben sind; die Wiedervorlage steht jeweils dabei.

## #32 Ladefehler-Hinweis für zu alte Browser
Behoben. Ein `SyntaxError` des Modulgraphen, der nicht nach fehlendem Export aussieht (Versionsmix), zeigt
„Dieser Browser ist zu alt für Truckload …“ ohne „Neu laden“. Die Textauswahl `tlLadefehlerText` steht im
Inline-Skript von `index.html` (läuft vor dem Modulgraphen, darf also kein JSON-Modul importieren) und ist in
`tests/pwa.test.js` geprüft. Die Mindestversion von Electron in NYX steht schon in `docs/nyx-sammlungen.md`
(Chromium ≥ 123); ob NYX sie erfüllt, ist Sache von NYX. Die Meldungstexte der Browser für fehlende
JSON-Modul-Syntax sind nicht an echten alten Browsern geprüft (Heuristik: alles, was nicht nach fehlendem
Export klingt).

## #19 Traversen-Dialog, zwei Randfälle
Behoben: Der Dialog sperrt „Hinzufügen“ nicht mehr stumm, sondern zeigt unter „Stück pro Wagen“ den Grund
(`classicSubmitError` in `js/ui/truss-wizard.js`, Meldungen von `splitWagons`/`trussDims`).
Entschieden (E): Ein beim Abbruch des Lade-Assistenten übrig bleibender neuer Wagen-Typ bleibt in „Eigene
Cases“, wie bei „+ Neues Case“; aufgeräumt wird über 🗑. Der Typ entsteht erst mit „Hinzufügen“, ein
vorhandener passender wird wiederverwendet (`findMatchingWagon`). Wiedervorlage, wenn Nutzer verwaiste Wagen-Typen
als Störung melden.

## #6 Marke („company“) und Sammlung trennen
Behoben: Wandert ein Listen-Case (ID aus `data/meine.json`) in eine benannte Sammlung und zurück nach „Meine
Sammlung“, bekommt es die Marke der mitgelieferten Fassung zurück (`moveCase(c, target, shipped)`, aufgerufen
in `moveCaseTo` mit `CASE_LIBRARY`). Ohne mitgelieferte Fassung (eigenes Case) entfällt `company` wie bisher;
nichts wird aus dem Namen abgeleitet. Kein neues Feld. Der Hinweistext (`title`) am Wizard-Filter
„Standardkatalog“ sagt jetzt, was er zeigt: Cases ohne Firmenmarke.
Entschieden (E): `company` ist nur der Name der Sammlung, in der das Case zuletzt lag, nicht der Name des
Baums; wer nach Oberfirma filtert, nimmt den Sammlungsfilter. Das Verschieben einer Sammlung ändert die
`company` ihrer Cases nicht. Wiedervorlage, wenn eine Marke über Sammlungsgrenzen hinweg gebraucht wird
(das wäre ein Datenmodell-Thema, mit NYX abzustimmen).

## #27 Service-Worker, Versionsmix bei langsamem Netz
Geprüft, nicht geändert (E, die in der Anleitung vorgesehene Rückfalllösung). Die Regel „alles eines Clients
aus dem Cache“ (wie `degraded` sie schon anwendet) schließt den Mix nicht aus, weil der Cache selbst gemischt
wird: `networkFirst` schreibt jede frisch geholte Datei in denselben Cache `truckload-v<Version>`. Ist eine
neue Fassung ausgeliefert und der Service Worker noch der alte, enthält der Cache nach ein paar frischen Abrufen
neue und alte Dateien nebeneinander; „ab jetzt nur noch Cache“ bedient dann ebenfalls Mix. Eine sichere Lösung
braucht einen Zwischenspeicher je Seitenaufruf, der erst vollständig geholt und dann im Ganzen übernommen
wird – das ist ein Umbau von `sw.js` weit über eine kleine Änderung hinaus, und er ließe sich ohne Browser und
ohne langsames Netz nicht abnehmen. Der Rest wird vom Ladefehler-Hinweis in `index.html` („Bitte neu laden“)
aufgefangen; die Voraussetzung für den Mix (Timeout von 3 s genau während einer Auslieferung) ist selten.
Wiedervorlage, wenn der Hinweis in der Praxis gemeldet wird. Die Asset-Liste ist unverändert.

## #35 Rest aus „Projektdatei vollständig“
Behoben: (1) Kopierte Fahrzeuge tragen in `#truck-select` ◇ statt ★ und den `title` „Aus der Projektdatei – nicht
in deiner Bibliothek“ (`truckMarke`). (2) Die Entscheidungen über Kopien sind reine Helfer in
`js/model/mitgefuehrt.js` (`istKopieCase`, `istKopieTruck`, `truckMarke`, `truckStiftSperre`) und von
`planView.js` benutzt (Stift am Fahrzeug, `editTruck`-Guard, Stift in der Ablage, Inspector); getestet an der
Datennaht mit echtem `bestandOf` (`tests/app-core.test.js`). Die DOM-Verdrahtung selbst ist nicht im Browser
gefahren. (3) `createBestandsSync` wiederholt ein fehlgeschlagenes `savePlan` einmal nach 500 ms; erst danach
Fehlerstatus. (4) Testlücken: Rollback von `projectRuleSets`/`ruleSets` beim gescheiterten Import,
`checkPlan` prüft `mitgefuehrt.version` jetzt gegen `MITGEFUEHRT_VERSION` (Version 2 wird mit Plan-Namen
abgelehnt, bisher nur „ist eine Zahl“), `null`-Einträge in `mitgefuehrt.cases/trucks`.
Eigene Entscheidung: Eine Datei mit künftiger Kopie-Version wird abgelehnt statt still gelesen; ändert sich das
Format, muss `MITGEFUEHRT_VERSION` zusammen mit einer Lese-Migration erhöht werden.

## #38 Import: null in Datensätzen, Grenzen der Maße-Nachfrage
Behoben: `cleanCases` (`js/store/repo.js`) entfernt beim Laden `null` bei Feldern, die fehlen dürfen, aber nicht
`null` sein dürfen (`content`, `tippable`, `stackable`, `wheels`, `dimsInclWheels`, `company`, `legacy`,
`onlyInPlan`, und in `truss` `wagonW`, `profileId`, `standing`); es gilt der Vorgabewert. Felder, die `null`
ausdrücklich erlauben (`maxTopLoad`, `stock`, `kind`, `layers`, `wheelH`), bleiben unberührt. Maße und Gewicht
werden nie angefasst. Gelesen wurde `checkCase` (`js/store/io.js`). Der bereinigte Stand wird nicht
zurückgeschrieben; er entsteht bei jedem Laden neu und landet mit dem nächsten Speichern des Cases in der
Datenbank. Regressionstest mit einem Datensatz im alten Schema (`tests/repo.test.js`).
Entschieden (E), Entscheidung des Nutzers zu #10: Die Maße-Nachfrage beim Import gilt nur für Cases der
Sicherung; Traversenwagen (Maße aus `truss`), Sammlungsdateien und die mitgeführte Kopie im Plan lehnen ein
Case ohne Maße weiter ab; eine Ergänzung gilt je Case-ID (bei verschiedenen Fehlern derselben ID in Plan-Kopie
und Top-Level-Liste wird nur der Top-Level-Eintrag nachgefragt). `MAX_DEPTH` (4) gilt nur in der Oberfläche;
eine tiefere Kette aus fremder Datei lädt. Wiedervorlage, wenn Importe in der Praxis an diesen Grenzen scheitern.
