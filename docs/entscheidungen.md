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
