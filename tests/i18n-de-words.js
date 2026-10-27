// Deutsche Wörter (≥ 4 Buchstaben) der Oberfläche, für den Sperr-Test der Mehrsprachigkeit (#42).
// Erzeugt einmalig: alle Wörter aus den String-/Template-Literalen von js/ (Stand vor der
// Umstellung), die nicht in /usr/share/dict/words stehen, danach von Hand um Bezeichner,
// CSS-/DOM-Namen, englische Fachwörter und Markennamen bereinigt. Nicht neu erzeugen;
// fehlt ein Wort, hier ergänzen.
// Nachtrag (Task 3): dasselbe Verfahren für die Texte aus index.html (Body, title/aria-label, Inline-Skript).
// Zusätzlich von Hand: „drucken“ steht im System-Wörterbuch, ist aber ein deutsches Oberflächenwort. Verwendung: looksGerman() in tests/i18n-scan.js.
export default new Set(`
  abbrechen aber abgebrochen abgewählt abgleichen ablage ablegen ablehnung abschluss achtung
  aktualisiert aktualisierung aktuell alles andere anderen angeglichen angehakt angelegt
  angepasst anklicken anlegen annimmt anordnen anpassen ansicht anzahl aufheben auflage auflast
  ausblenden ausgeblendet ausgewählt ausladeliste auslassen ausrichtung auswahl auswählen
  auszulassen automatisch automatischen außerhalb bearbeiten behalten behält beidseitig beim
  bekannt bekannten beladen benannten berechnet bereinigte beschriftung beschädigt bestand
  bibliothek bilden bildete bitte bleiben bleibt braucht breit breite bühne dabei danach dann
  daran darf datei daten datenbank datensätze dazurechnen deckschicht deiner derselben
  desselben diese diesem diesen dieser dieses doppelt doppelte dort draufsicht drehen
  duplizieren durchlauf ebene ebenen echten eigene eigenen eigener eigenes eigenschaften eine
  einem einen einer einheiten einlesen einpacken eins einseitig eintragen einträge einträgen
  elemente entfernen entfernt enthält entladen entscheidet erlaubt erlaubte erneut erreichbar
  erreicht erreichte ersatzweise erscheinen erst erstellen ersten etwas exportieren fahrzeug
  fahrzeugbereichs fahrzeuge fahrzeugs farbe fassung fehler fehlgeschlagen fehlt feld fenster
  fertig firmen firmenmarke gardine gedreht gefunden gehen geht gekürzt geladen gelegt gelten
  gelöscht gelöschte gemischt geprüft gesamt gesamtgewicht gesamtstückzahl geschätzt gesetzt
  gesichert gespeichert gespeicherten gestapelt getippt gewerk gewerke gewerks gewicht
  gewichten gewählt geöffnet gibt gleichstand grenze groß große gruppe größer gültige gültigen
  gültiges haken hallo heißt hersteller herstellerangabe herunterladen hier hinaus hinzufügen
  hoch häkchen höchstens höchstzahl höhe ihre immer importieren importiert inhalt inkl innen
  jeder jeweils katalog kein keine keinem keinen keiner klassische klassischer kleiner kleinere
  klick koffer kollidiert kollisionen kommt kompletter konnte konnten kopf kopie kopieren
  korrekturen kurz künftige lademeter ladeplan ladepläne ladeplänen laderaum ladung lage lang
  lassen lasten lautsprecher legen legt leichtere lesbar letzte licht lieferte liegt liste
  lokal lokale lokalen lädt länge länger längsseite lässt löschen marke materialbestand
  materialverwaltung maße mehr mehreren meine metergewicht mindestens mischen mitgelieferte
  mitte modell modus möglich müssen namen neue neuen neuer neuere neueren neues nicht nichts
  nimmt noch notizen nutzlast nächste nötig oben obendrauf oberebene oberste oder ohne ordnung
  packen passende passt pfeile platz platzierung platzierungen plänen profil projekt
  projektdatei prüfen punkt radkasten radkästen ragt rechts regel regeln regelset regelsets
  reihenfolge repariert reserviert richtwert rollen rollenhöhe rollenrichtung räumt rückgängig
  sammlung sammlungen sammlungsdatei sammlungsliste sammlungsname sattel schalter schieben
  schleife schließen schmaler schon schreiben schwer schwerlastrollen schwerpunkt schätzung
  scrollverhalten sein seite seitenansicht selbst sich sicher sichern sicherung sicherungsdatei
  sonderbau sonst sonstige sonstiges speicher speichern speicherort speichert stammt
  standardkatalog standardvorlage standardvorlagen stapel stapelbar stattdessen stehen stehend
  steht stirnseite stirnwand stände stück stücke stücken stückzahl suchen tiefe tippbar tippen
  transaktion traversen traversenbreite traversenlänge traversenstücke traversenwagen treffer
  trotzdem umbenannt umbenennen unbegrenzt unbehandelte unbekannt unbekannte unbekanntem
  unbekannter unbekanntes unerwarteter ungültig ungültige ungültigen ungültiger ungültiges
  unten unter untersammlung untersammlungen unterscheiden unverändert unvollständig verfügbar
  vergleich verloren verschieben verschiebt verschiebung verschoben versionsangabe verteilen
  verteilt verweis verweisen verweist verwendet viele voll volumen vorgabe vorgesehen vorhanden
  vorher vorlage vorlagen wagen wagenbreite wahl wandern waren warnungen wechseln wechselt
  weder weiter weitere welche weniger wenn werden werte wichtigste wieder wiederhergestellt
  wiederherstellen zeichen zeigen zeigt zeitstempel ziehen zoomen zuerst zugeordnet zuletzt
  zuordnung zurück zurückgeschrieben zurückgesetzt zurückholen zurücksetzen zusammenstellen
  zwei zählen älteren ändern änderungen öffnet über übereinander übereinandergestellt
  überlagerung übernehmen übernommen überschneidet überschreiben überschreitet überstieg
  drucken lagen schwarz abhakliste auftreten beiden blass bogen eines einfügen erkennt erzwingt etiketten etikettengröße
  fehlender ganzen gebraucht gedruckt gegenseitig gehören herauszoomen hineinzoomen hinweis höhere
  kann klein können lege mausrad mehrere meldet offen rückansicht strg umstellen versionsmix
  vollständig vorhandenen weise weiteren wiederholen wischen zeichnen zoomt öffne
`.split(/\s+/).filter(Boolean));
