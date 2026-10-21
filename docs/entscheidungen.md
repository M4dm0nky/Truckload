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
