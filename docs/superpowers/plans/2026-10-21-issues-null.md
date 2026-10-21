# Anleitung: Issues auf null

Diese Anleitung ist für den Online-Agenten (Claude Code im Web), der im Repository `M4dm0nky/Truckload`
arbeitet. Sie ist vollständig: du brauchst keine Rückfragen und stellst keine. Wo eine Entscheidung offen
wäre, steht sie unten schon getroffen oder du triffst sie selbst und hältst sie schriftlich fest.

## 1. Auftrag und Ziel

Es sind 31 Issues offen. Am Ende dieses Auftrags ist **jedes Issue entweder behoben oder durch eine
dokumentierte Entscheidung erledigt**. Eine Ausnahme: drei Issues (#15, #20, #21) brauchen echte Hardware
oder ein Maß, das nur der Nutzer hat; für sie bereitest du eine Prüfliste vor (siehe 6).

Regel des Nutzers (wörtlich): *Was wir als beschlossen haben, ist kein offenes Issue mehr, sondern
geschlossen.* Ein Issue, das nur eine bewusste Einschränkung beschreibt, wird also nicht umgebaut,
sondern mit Begründung entschieden und geschlossen. Ein echter Fehler oder eine klar beschriebene
Verbesserung wird behoben.

Der Wortlaut aller Issues steht in [2026-10-21-issues-null-anhang.md](2026-10-21-issues-null-anhang.md);
mit `gh` kannst du den aktuellen Stand lesen (`gh issue view N --comments`).

## 2. Spielregeln dieses Projekts (kurz, die Quelle ist `CLAUDE.md`)

Lies zuerst `CLAUDE.md`, `docs/architektur.md` und `docs/nyx-host.md`. Das Wichtigste:

- **Keine npm-Abhängigkeiten, kein Build-Schritt.** Reine ES-Module. Prüfen mit `npm test` (`node --test`).
- **Nutzereingaben nur über `esc()`** (`js/ui/dom.js`), in SVG `textContent`. Oberfläche auf **Deutsch** mit
  „…“. Der Begriff heißt **„tippen“**, nie „kippen“.
- **Alte Daten müssen weiter laden.** Jede Änderung am Datenmodell braucht einen Regressionstest mit einem
  Datensatz im alten Schema. **Ändere in diesem Auftrag kein Datenmodell** (kein neues Feld an Cases oder
  Plänen, kein neuer Store). `STORES` in `js/store/db.js` bleibt unverändert. Wäre für ein Issue ein
  Datenmodell nötig, entscheide es stattdessen (siehe 4).
- **Jede neue Datei unter `js/`, `css/`, `data/`, `icons/`, `vendor/`** gehört in die Offline-Liste in
  `sw.js` und, wenn es ein Modul unter `js/` ist, als `modulepreload` in `index.html`
  (`tests/pwa.test.js` prüft beides).
- **Der Name der Quelle der Case-Listen** (die Seite, aus der die Hersteller-Vorlagen stammen) steht
  nirgends im Repo: nicht in Code, Doku, CHANGELOG, Tests, Commit-Texten, Issue-Kommentaren. Vor jedem
  Commit: `grep -rniE "tru[c]k ?pack|backl[i]ne ?logic" . -I --exclude-dir=.git --exclude-dir=node_modules`
  (die Klammern verhindern, dass diese Zeile sich selbst findet) darf in neuen oder geänderten Zeilen nichts finden (ein alter Treffer in
  `CHANGELOG.md` und zwei in älteren Plänen sind bekannt und werden nicht angefasst).
- **Eine Versionsnummer überall** (`js/version.js`, `package.json`, `README.md`, `index.html`, Cache-Name in
  `sw.js`, oberster CHANGELOG-Eintrag; `tests/version.test.js`). **Ändere die Version nicht.** Die Nummer
  vergibt der Nutzer nach der Prüfung. Schreibe den CHANGELOG-Eintrag auch nicht; liefere stattdessen im
  PR-Text (siehe 7) eine Liste der Änderungen, aus der er entsteht.
- **Eigene Entscheidungen werden als eigene benannt**, nie als Absprache mit dem Nutzer.
- **Haltung zu Zahlen:** Eine erfundene Angabe ist schlimmer als eine fehlende. Nichts raten.

Die globale Vorgabe „erst Brainstorming, dann Plan“ gilt für dich **nicht**: Es gibt niemanden, der
antwortet. Dieser Text ist der Plan. Arbeite selbstständig, in kleinen Schritten, mit Tests.

## 3. Vorgehen

1. Arbeitszweig: `git switch -c issues-null` (ab `main`, vorher `git pull`). Alles auf diesem einen Zweig.
2. `npm test` muss vorab grün sein (aktuell 1389 Tests). Ist es das nicht, stoppe und melde es im PR-Text.
3. Arbeite die Issues in der Reihenfolge von Abschnitt 5 ab. **Je Issue ein Commit** (bei großen Issues
   mehrere), Nachricht `fix(#N): …` bzw. `docs(#N): …`, am Ende die Zeile
   `Co-Authored-By: Claude <noreply@anthropic.com>`.
4. **Reine Logik per TDD:** erst der fehlschlagende Test, dann der Code. Tests liegen in `tests/<modul>.test.js`.
   Nimm echte Datenformen, wie die App sie liefert; Doubles erfinden keine Felder.
5. Nach jedem Issue `npm test` komplett. Rot = nicht weiter, erst beheben.
6. **Die App startest du nicht** und fährst keinen Browser. Alles, was nur im Browser sichtbar wäre, schreibst
   du so, dass die Logik als reine Funktion getestet ist und die DOM-Verdrahtung dünn bleibt. Was du nicht
   prüfen konntest, nennst du im PR-Text unter „Nicht im Browser geprüft“. Der Nutzer-Assistent fährt diese
   Punkte danach im Browser.
7. **Pro Issue wird eine Entscheidung festgehalten** (auch beim Beheben): was getan wurde, was nicht, warum.
   Die dauerhafte Fassung steht in `docs/entscheidungen.md` (Datei neu anlegen, Abschnitt je Issue
   `## #N Titel`, 3 bis 8 Zeilen, Stand/Datum). Geändertes Verhalten gehört außerdem in
   `docs/architektur.md` an die passende Stelle und, wenn Nutzer es merken, in die `README.md`.
8. Wenn ein Issue sich als größer erweist als beschrieben (mehr als etwa 300 geänderte Zeilen Code oder ein
   nötiges Datenmodell): **nicht umsetzen**, sondern als Entscheidung festhalten („bleibt so, weil …“) und
   den Grund im PR-Text nennen.

## 4. Die beiden Klassen

- **Klasse B (Behoben):** echter Fehler oder klar beschriebene Verbesserung. Code und Test, dazu Eintrag in
  `docs/entscheidungen.md`.
- **Klasse E (Entschieden):** das Issue beschreibt eine bewusste Einschränkung oder eine offene Idee ohne
  Auftrag. Kein Code. Eintrag in `docs/entscheidungen.md` mit Begründung und, wo es sinnvoll ist, mit
  einem Hinweis, was passieren müsste, um die Entscheidung zu ändern („Wiedervorlage, wenn …“).

Die Zuordnung steht in Abschnitt 5. Weichst du ab (zum Beispiel weil ein Issue sich als leichter oder
schwerer herausstellt), schreibe die Abweichung mit Grund in den PR-Text; das ist erlaubt.

## 5. Issue für Issue

Reihenfolge: zuerst die Fehler (#6, #19, #27, #32), dann die kleinen Verbesserungen, dann die
Entscheidungen, zuletzt die Prüflisten. Die Texte der Issues stehen im Anhang.

### Fehler

**#32 Ladefehler-Hinweis für zu alte Browser (B).** In `index.html` fängt ein Fehlerhandler den Ladefehler
ab. Erkenne einen `SyntaxError` des Modulgraphen (JSON-Module-Syntax, `with { type: 'json' }`) und zeige statt
„Bitte neu laden“ den Text „Dieser Browser ist zu alt für Truckload. Gebraucht werden Chrome oder Edge ab 123,
Safari ab 17.2 oder Firefox ab 138.“ **ohne** „Neu laden“-Knopf. Andere Ladefehler behalten ihren bisherigen
Text. Die Auswahl des Textes gehört in eine kleine reine Funktion (zum Beispiel
`ladefehlerText(error)` in einem Modul, das ohne DOM importierbar ist; beachte, dass der Fehler auftritt,
bevor die App läuft, also darf die Funktion nicht in einem JSON-importierenden Modul stehen). Test dafür.
Ob die von NYX ausgelieferte Electron-Version reicht, kannst du nicht prüfen: das ist Sache von NYX und
steht schon in `docs/nyx-sammlungen.md` („Mindestversion: Chromium ≥ 123“). Das genügt zum Schließen.

**#19 Traversen-Dialog, zwei Randfälle (B + E).**
- *Stiller `preventDefault()`* in `js/ui/truss-wizard.js` (Submit-Handler, `catch { e.preventDefault(); }`):
  zeige eine kurze Meldung im Dialog (zum Beispiel unter „Stück pro Wagen“), warum nicht hinzugefügt wird
  („Stückzahl und Stück je Wagen müssen größer als 0 sein.“ bzw. die Fehlermeldung von `trussDims`). Die
  Fehlerquelle ist `splitWagons`/`trussDims`; teste die Meldungsauswahl als reine Funktion.
- *Abgebrochener Dialog hinterlässt den Wagen-Typ:* **E**. Der Typ entsteht erst nach „Hinzufügen“; bleibt er
  nach Abbruch des Lade-Assistenten in „Eigene Cases“, ist das dasselbe Verhalten wie bei „+ Neues Case“
  (Aufräumen über 🗑). Als Entscheidung festhalten.

**#6 Marke („company“) und Sammlung trennen (B).** Das Kernproblem: Ein Listen-Case (ID `lib-…`), das in
eine benannte Sammlung und zurück nach „Meine Sammlung“ wandert, verliert `company` (`moveCase`,
`js/model/collections.js`), obwohl die mitgelieferte Fassung in `data/meine.json` die Firma kennt.
Lösung ohne neues Feld: Beim Verschieben nach „Meine Sammlung“ setzt `moveCase` `company` auf den Wert des
mitgelieferten Listen-Cases gleicher ID zurück (`CASE_LIBRARY`/`data/meine.json`); gibt es keinen
mitgelieferten Eintrag, wird `company` wie bisher entfernt. Test mit einem echten Listen-Case aus
`meine.json` (hin und zurück) und einem eigenen Case. Dazu die Erklärung des Wizard-Filters „Standardkatalog“
verständlicher machen (Hinweistext/`title` am Filter; was darin steht, ist in Issue #6 beschrieben).
Die Aussagen „company ist nur der Name einer Sammlung, nicht des Baums“ und „Verschieben einer Sammlung
ändert `company` nicht“ sind **E** und kommen in `docs/entscheidungen.md`.

**#27 Service-Worker, Versionsmix (B, mit Ausstieg).** Lies `sw.js` und `docs/architektur.md`, Abschnitt
„Service Worker und Ladefehler“. Ziel: Ein Seitenaufruf bekommt entweder durchgehend neue oder durchgehend
alte Dateien. Prüfe, ob sich das mit einer klaren Regel erreichen lässt (zum Beispiel: sobald eine Datei
eines Seitenaufrufs aus dem Cache bedient wurde, werden alle weiteren Dateien desselben `clientId`
ebenfalls aus dem Cache bedient, und umgekehrt). Gelingt das mit einer kleinen Änderung und einem Test in
`tests/sw.test.js`, setze es um. Gelingt es nicht sicher: **E** (der „Bitte neu laden“-Hinweis fängt den
Rest, das steht schon im Issue), mit Begründung in `docs/entscheidungen.md`. Bei jeder Änderung an `sw.js`
bleibt die Asset-Liste vollständig.

### Kleine Verbesserungen

**#35 Rest aus „Projektdatei vollständig“ (B).**
1. Kopierte Fahrzeuge in `#truck-select` anders kennzeichnen als eigene (`js/app/planView.js`, Aufbau von
   `sortedTrucks`; Erkennung über `d.ausProjekt.trucks`): statt ★ ein anderes Zeichen und im `title`
   „Aus der Projektdatei – nicht in deiner Bibliothek“. Die Entscheidung als kleinen reinen Helfer
   herausziehen und testen.
2. Die Sperren für Kopien als reine Helfer testen (`#truck-edit`-Sperre, `editTruck`-Guard, Stift in der
   Ablage, LKW-Editor mit `bestandOf(s).trucks`): Helfer extrahieren wie `brauchtAuswahl`, je ein Test an
   der Datennaht und am Aufrufort.
3. Wiederholung beim Neuspeichern in `createBestandsSync` (`js/app/core.js`): schlägt `savePlanMitKopie`
   fehl, einmal erneut versuchen (kurze Wartezeit), danach Fehlerstatus wie bisher. Test mit einem
   Double, das beim ersten Aufruf fehlschlägt.
4. Testlücken schließen: gescheiterter Import setzt `projectRuleSets` **und** `ruleSets` auf den Stand vor
   dem Import zurück (`tests/app-importexport.test.js`); `checkPlan` prüft `mitgefuehrt.version` gegen
   `MITGEFUEHRT_VERSION` (fehlerhafte Version → Ablehnung mit Plan-Namen; Test mit Version 1 und 2);
   Test mit `null`-Eintrag in `mitgefuehrt.cases`/`trucks`.

**#38 Import: `null` und Grenzen (B + E).**
- `cleanCases` (`js/store/repo.js`) bereinigt auch ein `null` tief im Datensatz (Felder in `cases[]`):
  entferne `null`-Werte bei Feldern, die optional sind (z. B. `note`, `content`, `maxTopLoad` bleibt `null`
  als gültiger Wert!). Lies zuerst, welche Felder `null` erlauben (`checkCase` in `js/store/io.js`), und
  bereinige nur die, bei denen `null` ein Fehler wäre. Regressionstest mit einem Datensatz im alten Schema.
- Die Grenzen der Maße-Nachfrage (Traversenwagen, Sammlungsdateien, Plan-Kopie, ID-Doppelung) und
  `MAX_DEPTH`: **E**. Sie sind im Issue als Entscheidung des Nutzers beschrieben.

**#8 Überlagerungen wiederherstellen (B).** In der Materialverwaltung bekommt ein Listen-Case, das als
Überlagerung vorliegt (gleiche ID wie in `data/meine.json`, bearbeitet/verschoben/ausgeblendet),
die Aktion „Original wiederherstellen“: die Überlagerung wird entfernt, die mitgelieferte Fassung gilt
wieder (und bekommt künftige Korrekturen). Über `repo.writeCases` und die Warteschlange (`serial`), mit
Rückfrage vorab (`showConfirm`). Reine Entscheidung „ist das Case eine Überlagerung eines Mitgelieferten?“
als Helfer mit Test. Das ausgeblendete (gelöschte) Listen-Case muss sich ebenfalls zurückholen lassen: prüfe
dafür, wie ausgeblendete Cases heute abgelegt sind, und liefere dort dieselbe Aktion oder halte sie als
nicht möglich fest.

**#11 Kleine Härtungen der Sammlungen (B + E).**
- Dateidialog: Bei sehr alten Browsern fehlt das `cancel`-Ereignis. Ersatz: nach dem Schließen des
  Dateidialogs auf `window` `focus` hören und den wartenden Import nach kurzer Frist verwerfen, falls keine
  Datei gewählt wurde. Als reine, testbare Hilfsfunktion kapseln.
- Sammlungsdatei: dieselben Altschema-Reparaturen wie die Sicherung anwenden (Beschriftung über
  `MAX_LABEL` kürzen, alte Rollenhöhe), statt abzulehnen; die Meldung nennt, was repariert wurde. Test.
- Warteschlange wartet auf offene Meldungen: **E** (die Reihenfolge der Schreibvorgänge ist wichtiger als
  ein schnelles Fortsetzen; eine Meldung innerhalb eines Vorgangs ist selten).

**#18 Technische Schulden der Modellschicht (B + E).**
- `caseShape(c, p, box)` und `trussShape(c, p, box)`: `box` bekommt den Vorgabewert `boxOf(c, p)`; Aufrufer
  bleiben unverändert. Test, dass ohne `box` dasselbe herauskommt wie mit `boxOf`.
- `buildStacks` (`js/model/packer.js`): `orderForStacking(itemList, truck)` herausziehen, **ohne
  Verhaltensänderung**. Absicherung: `tests/packer-golden.test.js` und `packer-property.test.js` müssen
  unverändert bestehen; ein eigener Test für `orderForStacking`.
- `toPiece` (`js/model/actions.js`): ein Struktursperr-Test, der prüft, dass jedes Stück-Feld, das ein Case
  oder Stück tragen kann (Liste aus der Doku/Prüfung `checkCase`/`checkPlan`), beim „Alles neu packen“
  erhalten bleibt; schlägt an, wenn jemand ein Feld ergänzt und `toPiece` nicht nachzieht.
- Traversen-Maße `l/w/h` gespeichert und abgeleitet; `validatePlan` läuft komplett: **E** (Datenmodell mit
  Migration bzw. ein Raster ohne realen Bedarf; beides ausdrücklich nicht in diesem Auftrag).

**#31 Grund in der Ablage vollständiger nennen (B).** `unplacedReason` (`js/model/unplacedReason.js`) nennt
zusätzlich, was sich aus den Daten **eindeutig** ergibt: Gewicht des Stücks über der Nutzlast des Fahrzeugs
(„Zu schwer für die Nutzlast“), Lagen-Einschränkung ohne passende Lage (soweit aus Stück und Fahrzeug
herleitbar). Kein Grund bleibt, wo er geraten wäre („kein Platz“). Tests mit echten Plan- und
Fahrzeugformen (`tests/fixtures.js`), je Grund ein Fall und je ein Fall ohne Grund.

**#28 Oberflächen-Kleinigkeiten (B + E).**
- „Stehend, 180°“ im Inspector verwirrt: den Text so ändern, dass er verständlich ist („Stehend, um 180°
  gedreht“), nur wenn die Anzeige tatsächlich diese Lage meint; Test des Textes.
- Lagenwahl endet bei „bis 3“: die Auswahl bis Lage 5 erweitern (ab Lage 5 warnt `validate.js` ohnehin);
  Test an der Funktion, die die Lagenliste erzeugt.
- Firmenfilter springt still auf „Standardkatalog“: einen kurzen Hinweis anzeigen („Firma nicht mehr
  vorhanden – Filter zurückgesetzt“); dünne Verdrahtung, Entscheidung als reine Funktion.
- Die übrigen drei (Wizard schreibt jedem Stück die Farbe aus; Tippen kann Nachbarn überlappen, die Prüfung
  meldet es; im Wizard angelegte Cases bleiben nach Abbruch): **E**.

### Entscheidungen (nur Eintrag in `docs/entscheidungen.md`, Issue wird geschlossen)

Für jedes: 3 bis 8 Zeilen mit Entscheidung, Begründung, „Wiedervorlage, wenn …“.

- **#3 Fehlende Casemaße.** Entscheidung des Nutzers (2026-10-21): endgültig gestrichen. Die fünf Zeilen
  (Motorsteuerung-Koffer, Bolzenkoffer, FD34 ×2, HOF BOLT, Dolly „Drohne“) werden nicht angelegt. Die
  sechs 19″-Racks (1, 2, 4, 5, 6, 16 HE) bleiben als `legacy` in `data/standard.json` (nicht wählbar, alte
  Pläne laden sie weiter); **nichts löschen**. Wer sie braucht, legt sie über „Neues Case“ an.
- **#4 Richtwerte.** Der Mindest-Case-Anteil (15 kg) und die Packcase-Gewichte bleiben Richtwerte, die der
  Nutzer pro Case überschreiben kann. Begründung: Eine Änderung verschöbe die Gewichte bestehender
  Pläne; die Werte sind in `docs/casemasse-gewichte.md` offengelegt.
- **#5 Listen-Cases je Firma aufteilen.** Der Nutzer sortiert selbst über „Verschieben“.
- **#7 Elternsammlung zeigt nur eigene Cases** und der Wizard-Filter schließt Untersammlungen ein: beides
  gewollt.
- **#9 Alter Store `cases`** bleibt als Sicherheitsnetz, kein automatisches Löschen.
- **#13 Verteilung nur bei „Alles neu packen“.** Neues Material landet im gewählten LKW oder ohne
  Zuordnung; verteilt wird bewusst nur auf Knopfdruck.
- **#14 Verteil-Heuristik.** Das Maß bleibt, bis ein echter Plan eine schlechte Verteilung zeigt;
  Wiedervorlage mit der Plandatei.
- **#16 Textmetrik 2D/3D.** 2D kürzt mit „…“, 3D bricht um: gewollt, die Zusammenlegung wäre eine sichtbare
  Verhaltensänderung.
- **#17 Inspector wird bei jedem Bild neu aufgebaut.** Kein Eingriff ohne Performance-Beschwerde.
- **#22 `layers: [1, 2]` an Wizard-Stücken.** Gespeicherte Einschränkung bleibt; die Schnittmengenregel
  (`pieceLayers`) deckt den Fall ab.
- **#23 Zoom, Linien wachsen mit.** Gewollt (Truck-Einheiten); die Schrift wächst nur, wenn sie ins Case passt.
- **#24 Regalverfahren der Deckschicht und 0-kg-Cases.** Heuristik, der Schalter „Deckschicht mischen“ bleibt
  optional; 0 kg heißt unbekannt und mischt nicht.
- **#25 Lagen-Vorgabe 1+2.** Eine Lagen-Einschränkung ist eine bewusste Nutzerangabe; die README erklärt es.
- **#26 Motor-Erkennung und Namensbezug.** Keine automatische Erkennung; Regeln auf umbenannte Gruppen oder
  Gewerke greifen nicht mehr und erscheinen ausgegraut („nicht in diesem Load“).
- **#29 Beschriftungen.** Druckspalten bei langen Beschriftungen (durch die 40-Zeichen-Grenze entschärft),
  Sicherheitsfaktor `CHAR_ASPECT`, 3D-Seitenverhältnis in 0,25-Schritten und die zwei Etikettenformate
  bleiben; ein weiteres Format braucht Eintrag in `#print-label-size`, Rasterregel in `css/print.css` und
  Maße.
- **#30 Gewicht von Standardvorlagen überschreibbar.** Nein; Weg ist „Kopieren“ in der Materialverwaltung.
- **#40 NYX-Hinweis zu 0.18.0.** Kein Eintrag nötig (steht in `docs/nyx-traversen.md`); schließen mit
  Kommentar „Zur Kenntnis genommen, nichts zu tun“ erledigt der Nutzer-Assistent.

## 6. Prüflisten für Hardware-Issues (#15, #20, #21)

Diese drei bleiben offen, bis der Nutzer geprüft hat. Du erledigst die Vorbereitung:

- **#15 Druck:** Lege `docs/pruefliste-hardware.md` an (Abschnitt „Druck“): Schritte, um den Mehr-LKW-Druck
  und die Avery-Bögen 3425 und 3474 am echten Drucker zu prüfen, mit dem erwarteten Ergebnis je Schritt, und
  der Hinweis auf die Stellschraube `align-content` in `css/print.css`. Poste die Liste als Kommentar im
  Issue (`gh issue comment 15 --body-file …`) mit dem Satz „Bitte nach dem Test hier antworten; dann
  wird das Issue geschlossen.“
- **#20 Mausrad/Trackpad:** Abschnitt „Mausrad und Trackpad“ in derselben Datei: ein Mausrad, ein
  Trackpad (Zweifinger-Scrollen, Pinch), je erwartetes Verhalten von `classifyWheel`, und der
  Ausweg „Rad: Auto/Zoom/Schieben“. Ebenfalls als Kommentar im Issue.
- **#21 Dolly-Breite:** Abschnitt „Pre-Rig-Dolly“: welches Maß gemessen werden muss (Breite des Dollys
  neben der Traverse, an welcher Stelle), wo es einzutragen ist (`STAND_DOLLY_INSET` in
  `js/model/truss.js`, zurzeit 2 cm je Seite) und welcher Test mitzuziehen ist. Als Kommentar im Issue.

## 7. Abgabe

1. `git push -u origin issues-null`, dann ein Pull Request gegen `main` mit dem Titel „Issues auf null“.
2. Der PR-Text enthält:
   - eine Tabelle mit **allen 31 Issues**: Nummer, Klasse (B/E/Prüfliste), was getan wurde, Commit;
   - die Zeilen `Closes #N` für alle Issues außer #15, #20, #21 (GitHub schließt sie beim Zusammenführen);
   - die Liste „Nicht im Browser geprüft“;
   - die Liste der Abweichungen von dieser Anleitung mit Grund;
   - eine Zusammenfassung der Änderungen in Worten des Nutzers (deutsch, kurz), aus der der CHANGELOG
     entsteht.
3. **Schließe keine Issues selbst, mische den PR nicht und ändere die Version nicht.** Das geschieht nach der
   Prüfung durch den Nutzer-Assistenten.
4. `npm test` auf dem letzten Stand: alle grün, Zahl der Tests im PR-Text.

## 8. Wann du aufhörst

Du bist fertig, wenn: alle 31 Issues in der Tabelle des PR-Textes stehen, `npm test` grün ist, der Zweig
gepusht ist und `docs/entscheidungen.md` für jedes Issue der Klasse E und für jede Entscheidung innerhalb
von Klasse-B-Issues einen Eintrag hat. Danach meldest du dich nicht mit offenen Fragen, sondern mit dem
PR-Link. Findest du unterwegs einen echten Fehler, der in keinem Issue steht, behebst du ihn im selben PR,
wenn er klein ist, und nennst ihn im PR-Text; ist er groß, legst du ein Issue dafür an (`gh issue create`)
und nennst es dort.
