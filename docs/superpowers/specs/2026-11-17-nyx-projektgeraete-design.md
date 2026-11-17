# Geräte aus der NYX-Projektdatenbank übernehmen

Stand: 2026-11-17 · Status: Design zur Freigabe · Abstimmung mit NYX: `docs/nyx-projektgeraete.md`,
Issue #45

## Warum

Truckload ist ein Modul von NYX Lightwork. In NYX liegen die geplanten Scheinwerfer eines
Projekts aus Vectorworks, zum Beispiel 24 × MAC Viper. Heute legt der Nutzer die passenden Cases
in Truckload von Hand an und zählt selbst. Künftig liest Truckload die Geräte aus NYX. Der Nutzer klickt
je Gerätetyp das passende Case an (Truckload zeigt bekannte Cases als Vorschlag), Truckload
rechnet die Anzahl (24 Viper im Doppelcase → 12 Cases), merkt sich die Wahl für künftige Projekte
und bietet bei Änderungen in NYX nur die Differenz an.

## Ziele

1. Geräte des offenen NYX-Projekts lesen und je Gerätetyp ein Case zuordnen lassen.
2. Anzahl Cases aus Geräten pro Case berechnen, Rest erkennen und mit einem weiteren Case lösen.
3. Zuordnung Gerätetyp → Case projektübergreifend merken und beim nächsten Mal als klickbaren
   Vorschlag zeigen. Gemerkt wird erst, was der Nutzer gewählt und übernommen hat.
4. Differenz-Abgleich: beim erneuten Öffnen nur „+ n“ oder „− n“ je Gerätetyp anbieten.
5. Neues Case im Ablauf anlegen, Gewicht optional (mit Vorschlag aus NYX).

## Nicht-Ziele

- Verfolgung einzelner Geräte (welche Lampe in welchem Case auf welchem LKW).
- Anzeige des Verladestatus in NYX. „Verladen“ nutzt nur Truckload.
- Gemischte Cases (verschiedene Gerätetypen in einem Case).
- Verteiler, Dimmer, Netzwerkgeräte: zweite Stufe, sobald NYX sie liefert.
- Die Funktion in der Web-App ohne NYX.

## Anti-Ziele

- Truckload übernimmt keine Zuordnung ohne Klick des Nutzers (Nutzer).
- Die Namenserkennung verteilt still falsch. Die Stückzahl pro Case steht immer sichtbar da und
  wird nie stumm übernommen.
- Der Abgleich verschiebt oder löscht Stücke, die der Nutzer von Hand angelegt hat.
- NYX bricht: kein neuer Store, keine Netzabrufe, keine nativen Dialoge.

## Ansätze (entschieden)

- **A · Neue Quelle im vorhandenen Import (gewählt).** Der Dialog „Tabelle importieren“ bekommt
  den Einstieg „Aus Projektdatenbank übernehmen“ mit einem neuen ersten Schritt „Geräte → Cases“.
  Danach laufen die vorhandenen Schritte bis zur LKW-Verteilung.
- B · Eigener Bereich „NYX-Geräte“ im Plan: dauerhafte Statusliste, aber LKW-Verteilung neu
  anzubinden. Verworfen.
- C · A jetzt, Statusanzeige später: Der Nutzer wollte den Importbereich mit automatischem Öffnen
  und Knopf.

## Schnittstelle zu NYX (abgestimmt)

`truckloadHost.projektGeraete()` → `Promise<Array<{ key, name, anzahl, hersteller?, gewerk?,
vwNamen, gewichtKg? }>>`, nur lesend, Fehler wie bei `getAll`. `key` ist `gdtf:<uuid>` oder
`vw:<inst_type>` und wird unverändert gespeichert. NYX filtert und zählt; Truckload rechnet nichts
nach. Fehlt die Funktion, ist der Einstieg unsichtbar und es öffnet sich nichts automatisch.

## Was der Nutzer sieht

- **Automatisch:** Beim ersten Öffnen von Truckload in einem NYX-Projekt öffnet sich der Dialog
  mit „Aus Projektdatenbank übernehmen“, sofern NYX Geräte liefert.
- **Per Knopf:** „Aus Projektdatenbank übernehmen“ neben „Tabelle importieren“ (Startbildschirm
  und Plan).
- **Schritt „Geräte → Cases“: Liste links, Auswahl rechts. Truckload belegt nichts vor; jede
  Zuordnung setzt der Nutzer per Klick** (Nutzer):

  ```
  ┌ Geräte aus NYX ─────────────────────┐ ┌ MAC Viper · 25 Stück ───────────────────────┐
  │ ▸ MAC Viper          25  offen      │ │ Bekannte Cases für diesen Typ:               │
  │   Robe BMFL           6  offen      │ │   [ Mac Viper x1 · 1 pro Case ]              │
  │   ROXX Cluster B2     3  zugeordnet │ │   [ Mac Viper x2 · 2 pro Case ]              │
  │     → 3× ROXX x1                    │ │ [ Anderes Case suchen … ]  [ Neues Case ]    │
  │   Tourhazer           2  nicht laden│ │ [ Nicht laden ]                              │
  └─────────────────────────────────────┘ └──────────────────────────────────────────────┘
   nach Klick auf „Mac Viper x2“: „12× Mac Viper x2 · 1 Rest“ → für den Rest erneut ein Case klicken
  ```

  - **Links:** alle Gerätetypen aus NYX mit Anzahl und Stand (offen / zugeordnet mit den gewählten
    Cases und Anzahlen / Rest offen / nicht laden). Ein Klick wählt den Typ.
  - **Rechts, Vorschläge:** nur wenn Truckload den Typ kennt (Cases mit diesem `key` in
    `fasst.geraete`), als klickbare Knöpfe, sortiert nach Geräten pro Case (Single, Doppel, mehr).
    Nichts ist vorgewählt.
  - **Immer da:** „Anderes Case suchen …“ (Bibliothekssuche, vorbelegt mit dem Gerätenamen),
    „Neues Case“, „Nicht laden“. Der Nutzer kann trotz Vorschlag jedes andere Case nehmen.
  - **Erst der Klick auf ein Case** setzt die Zuordnung: Truckload rechnet Anzahl Cases und Rest aus
    den Geräten pro Case und zeigt den Rest. Für den Rest klickt der Nutzer wieder ein Case
    (Vorschläge wie oben, die mit höchstens so vielen Geräten wie der Rest zuerst). Eine Zuordnung
    lässt sich lösen und neu wählen.
  - **Neues Case:** Case-Editor. Gewerk aus `gewerk` („licht“ → „Licht“). Gewicht optional,
    vorgeschlagen als Geräte pro Case × `gewichtKg`, wenn NYX es liefert.
  - **Nicht laden:** für dieses Projekt merken (Hausbestand, Fremdfirma), rücknehmbar.
  - **Geräte pro Case:** Vorschlag aus dem Case-Namen, immer sichtbar, änderbar. Eine Korrektur
    wird am Case gespeichert und gilt danach statt des Namens.
  - **Rest:** Geht die Anzahl nicht auf (25 ÷ 2), steht „1 Rest“ da. Gelöst wird er nur mit einem
    weiteren Case aus der Datenbank oder einem neuen Case (Nutzer).
- **Danach** die vorhandenen Schritte; am Ende „Nur übernehmen“ oder „Übernehmen und laden“. Ziel
  ist immer der aktuelle Plan; gibt es keinen, legt Truckload einen an.
- **Erneutes Öffnen:** links nur Differenzen, z. B. „MAC Viper +4“ oder „−2“. Bei „+4“ zeigt
  rechts dieselben Vorschläge, der Nutzer klickt. Bei „−2“ zeigt Truckload, welche NYX-Stücke es
  entfernen würde (zuerst die ohne LKW), der Nutzer bestätigt per Klick; stehen alle auf LKW, das
  betroffene Stück zeigen und fragen: entfernen (Lücke bleibt) oder stehen lassen (Nutzer).
  Ohne Differenz: „Alles verladen“.
- **Offene Zeilen sperren nichts.** Nicht Zugeordnetes, auch ein offener Rest, erscheint beim
  nächsten Abgleich wieder.

## Datenmodell

1. **Am Case** (Store `collections`, projektübergreifend): optionales Feld
   `fasst = { stueck: 1..99, geraete: [{ key, name }] }`.
   - `stueck`: Geräte pro Case. Fehlt es, gilt der Vorschlag aus dem Namen.
   - `geraete`: für welche Gerätetypen das Case gemerkt ist. Mehrere Cases dürfen denselben `key`
     tragen (x2 und x1).
   - Prüfung in `checkCase` (`js/store/io.js`). Für mitgelieferte Listen-Cases (`lib-…`) über die
     vorhandene Überlagerung in „Meine Sammlung“.
2. **Am Plan** (Store `plans`, Projektdatei): `nyxAbgleich = { geoeffnet: true, nichtLaden: [key…] }`.
3. **An jedem Stück, das der Abgleich erzeugt:** `nyxGeraet: <key>` und `nyxStueck: <Geräte im
   Stück>`. Nur solche Stücke darf eine Reduktion entfernen.
4. **„Verladen“ wird gezählt, nicht gespeichert:** Summe von `nyxStueck` über die Stücke mit
   `nyxGeraet` im Plan, egal ob auf einem LKW oder „Ohne LKW“. Löscht der Nutzer ein Stück, erscheint beim
   nächsten Abgleich wieder eine Differenz.
5. **Neue Cases** aus dem Abgleich landen sofort in der Bibliothek („Meine Sammlung“), nicht als
   Import-Case im Plan, sonst ließe sich die Zuordnung nicht merken. Ein Abbruch des Dialogs nimmt
   sie nicht zurück.
6. **Getippt:** Stücke, die der Abgleich anlegt, sind getippt, wenn das Case tippbar ist (wie die
   Vorgabe im Lade-Wizard). „Übernehmen und laden“ packt mit den Pack-Regeln des Plans, also auch
   mit „Reihen planen“, wenn es an ist.

## Schlüssel umhängen

Liefert NYX für einen Typ `gdtf:<uuid>` und steht in `vwNamen` ein Name, unter dem Truckload eine
Zuordnung als `vw:<Name>` gespeichert hat, gilt diese Zuordnung für den neuen Schlüssel. Beim
Übernehmen schreibt Truckload am Case `vw:<Name>` auf `gdtf:<uuid>` um; Stücke im Plan mit
`nyxGeraet: vw:<Name>` zählen für den neuen Schlüssel mit und werden ebenfalls umgeschrieben.

## Festlegungen aus der Prüfung

1. **Je Plan, nicht je Projekt (Nutzer: „nicht kompliziert“).** Jeder Plan gleicht sich selbst mit
   NYX ab. Ändert sich etwas, kommen Stücke dazu oder fliegen raus, und dann wird neu geladen (der
   vorhandene LKW-Schritt mit „Alles neu laden“, „Neue Stücke auf zusätzliche LKW“ bzw. „in
   vorhandene LKW“). Keine Verrechnung zwischen mehreren Plänen.
2. **Keine Vorbelegung (Nutzer):** Truckload belegt nichts vor. Bekannte Cases erscheinen als
   klickbare Vorschläge, sortiert nach Geräten pro Case; der Nutzer wählt, kann jedes andere Case
   nehmen oder ein neues anlegen.
3. **Typ verschwindet aus NYX (meine Entscheidung):** Ein `key`, den NYX nicht mehr liefert, zählt
   als Anzahl 0 und wird als „− alle“ angeboten.
4. **Geräte im Stück werden festgehalten (meine Entscheidung):** Jedes Stück aus dem Abgleich trägt
   neben `nyxGeraet` die Zahl der Geräte darin (`nyxStueck`). „Verladen“ zählt die Summe dieser
   Zahlen. Eine spätere Korrektur der Geräte pro Case am Case ändert alte Stücke nicht. Ein Rest
   von 1 in einem Doppelcase zählt als 1.
5. **Erstes Öffnen ohne Plan (meine Entscheidung):** Bricht der Nutzer den Dialog ab, solange es
   noch keinen Plan gibt, öffnet er sich beim nächsten Start wieder. `geoeffnet` wird gesetzt,
   sobald der Abgleich in einen Plan übernommen wurde oder der Dialog in einem vorhandenen Plan
   einmal geöffnet war.
6. **Reduktion (Nutzer + meine Entscheidung):** Entfernt werden nur Stücke mit `nyxGeraet`, zuerst
   die ohne LKW, dann Rest-Stücke vor vollen; stehen alle auf LKW, das Stück zeigen und fragen.
   Danach neu laden wie unter 1.
7. **Mehrdeutiges Umhängen (meine Entscheidung):** Fallen mehrere `vw:`-Zuordnungen auf denselben
   `gdtf:`-Schlüssel, werden alle umgeschrieben; die Cases bleiben gemeinsam Kandidaten nach
   Regel 2.

## Namenserkennung (`stueckAusName`)

Reine Funktion, liefert Zahl oder `null`. Erkennt `x2` / `x 2` als eigenes Wort (nicht `X4-Bar`),
`2er`, `Doppel` → 2, `Einzel` / `Single` → 1, `Dreifach` / `5fach`, `(2)`, `2x <Name>`. Fallen aus
den echten Bibliotheksnamen, die **nicht** als Stückzahl gelten: `CycFX 8` (Doppel = 2),
`GLP X4-Bar-20 x4` (= 4), `D8+ 0,5t`, `Dolly Rack 28 HE`, `Atomic 3000`.

## NYX

Kein neuer Store, keine Freigabe. Neue Felder `fasst`, `nyxAbgleich`, `nyxGeraet` speichert NYX
unverändert (bestätigt). Neue Dateien kommen in die Admin-Schritte des Releases; NYX baut den Kanal
`truckload:projektGeraete`.

## Was der Builder entscheidet

Platzierung des Knopfs, Texte (Deutsch, Englisch über `js/i18n/en.js`), Sortierung der Geräteliste,
Ranking der Case-Suche, wie eine Reduktion zerlegt wird (zuerst Rest-Cases, dann volle Cases),
Layout des Schritts im Stil der übrigen Import-Schritte, Host-Attrappe für Tests nach der
abgestimmten Form.

## Abnahme

- Ohne Klick keine Zuordnung und kein Stück; Vorschläge nur bei bekanntem `key`; „Anderes Case
  suchen“ und „Neues Case“ sind immer verfügbar, auch wenn Vorschläge da sind.
- `stueckAusName` mit Fallsammlung aus echten Bibliotheksnamen (Treffer und Fallen).
- Aufteilung: 24 → 12 × 2; 25 → 12 × 2 + 1 Rest; Differenz +4 / −2; „Nicht laden“; offener Rest
  erscheint wieder.
- Umhängen `vw:` → `gdtf:` mit Treffer (Name in `vwNamen`) und Nicht-Treffer (anderer Name).
- Reduktion entfernt nur Stücke mit `nyxGeraet`, zuerst die ohne LKW; ein von Hand angelegtes
  gleiches Case bleibt (Treffer und Nicht-Treffer nebeneinander).
- `checkCase` für `fasst`; Rundreise Sicherung und Projektdatei mit `fasst`, `nyxAbgleich`,
  `nyxGeraet`.
- Host-Attrappe liefert genau die abgestimmte Form, keine erfundenen Felder.
- Ohne `projektGeraete()`: Knopf unsichtbar, kein automatisches Öffnen.
- Handtest in NYX, sobald NYX den Kanal gebaut hat.
