# Geräte aus der NYX-Projektdatenbank in Truckload: Abstimmung

An: NYX-Admin (Aniflu) · Von: Truckload · Stand: 17.11.2026 · Status: **umgesetzt in Truckload 0.33.0 (ergänzt in 0.34.2: „anders geladen“), NYX-Seite (Kanal `truckload:projektGeraete`) offen**

## Für den Admin: zu tun vor dem Heben des Submoduls auf 0.34.2

**Neu mit 0.34.2 („anders geladen“, Case-Suche):**
- Neues optionales Feld am Plan: `nyxAbgleich.andersGeladen = { "<key>": Anzahl }` (Ganzzahl 1…9999,
  höchstens 500 Schlüssel). Gemeint sind Geräte, die ohne eigenes Case mitfahren, z. B. fest in MLTs oder
  im Sonderbau. Sie zählen im Abgleich als verladen. Das Feld steckt im bestehenden Plan-Datensatz, NYX
  speichert es unverändert. Es gibt keinen neuen Store, keine Freigabe und keine Änderung an
  `projektGeraete()`.
- Keine neue Datei. „Anderes Case suchen …“ zeigt jetzt ein Suchfeld im vorhandenen `#dlg-pick`.
- Zurückdrehen auf 0.34.1: `checkPlan` von 0.34.1 lehnt das Feld nicht ab, und die Übernahme behält es.
  0.34.1 rechnet es aber nicht ein: Die betroffenen Typen erscheinen dort wieder als offen (+n). Daten
  gehen dabei nicht verloren.

## Davor: zu tun vor dem Heben des Submoduls auf 0.33.0

0.32.0 und 0.33.0 lassen sich zusammen heben (Aniflu, Issue #45).

**Neu mit 0.33.0 (Geräte aus NYX übernehmen):**
- Führt NYX eine eigene Dateiliste des Submoduls, aufnehmen: `js/model/stueckAusName.js`,
  `js/model/nyxAbgleich.js`, `js/store/projektGeraete.js`, `js/ui/geraete-schritt.js` und
  `js/app/projektGeraeteImport.js`. Wer `sw.js` übernimmt, hat sie schon.
- Truckload ruft `truckloadHost.projektGeraete()` auf (NYX baut dafür den Kanal
  `truckload:projektGeraete`, nur lesend, Form siehe „Abgestimmte Schnittstelle“). Fehlt die Funktion,
  bleibt der Knopf „Aus Projektdatenbank übernehmen“ versteckt, und nichts öffnet sich.
- Neue optionale Felder: `fasst` an Cases, `nyxAbgleich` an Plänen, `nyxGeraet` und `nyxStueck` an
  Stücken (Platzierungen und Ablage). Sie stecken in den bestehenden Datensätzen; NYX speichert sie
  unverändert (von Aniflu bestätigt: `tl_records` legt den Datensatz ab, wie er kommt).
- Kein neuer Store, keine Freigabe nötig, die Projektdatei ändert sich nur um diese Felder.
- Zurückdrehen auf 0.32.0: `checkCase`, `checkPlan` und die Stück-Prüfungen von 0.32.0 lehnen
  unbekannte Felder nicht ab (keine Positivliste, geprüft in `js/store/io.js`); Cases, Pläne und
  Sicherungen mit den neuen Feldern bleiben ladbar. 0.32.0 kennt die Felder aber nicht: Packt oder
  dupliziert man damit Stücke neu oder legt sie über „in die Ablage legen“ bzw. „Alles ausladen“
  (`placementToUnplaced`) in die Ablage, gehen die Stückmarken `nyxGeraet`/`nyxStueck` verloren (sie
  laufen über `pickPieceFields`), und der Abgleich zählt diese Stücke dann nicht mehr als verladen. Das ist
  nur eine Lücke im Abgleich, kein Datenverlust an Cases oder Plänen.

## Worum es geht

In NYX liegen die geplanten Geräte eines Projekts, aus Vectorworks importiert, als Stückzahlen
vor, zum Beispiel 24× MAC Viper, 6× Robe BMFL, 2× Verteiler 63 A. Truckload soll diese Liste
lesen und dem Nutzer beim Packen helfen:

1. Öffnet der Nutzer Truckload in einem Projekt zum ersten Mal, zeigt Truckload: „Ich habe
   folgende Geräte gefunden. Wollen wir sie laden?“ Später geht das per Knopf
   „Aus Projektdatenbank übernehmen“.
2. Je Gerätetyp wählt der Nutzer ein Case aus der Case-Datenbank, zum Beispiel
   „Mac Viper x2“ (2 Lampen pro Case). Truckload legt 12 Cases an. Bei 25 Lampen meldet es
   „1 Rest“, und der Nutzer wählt dafür ein anderes Case (Einzelcase) oder legt eins an.
3. Truckload merkt sich die Zuordnung „MAC Viper → Mac Viper x2 / x1“ und zeigt sie im
   nächsten Projekt als Vorschlag. Übernommen wird nur, was der Nutzer anklickt; er kann jedes
   andere Case wählen oder ein neues anlegen.
4. Ändert sich die Planung in NYX (28 statt 24 Viper), bietet Truckload beim nächsten Öffnen nur
   die Differenz an.

Die Markierung, welche Geräte schon verladen sind, nutzt **nur Truckload**. NYX muss sie weder
anzeigen noch auswerten. Truckload braucht von NYX im Kern **lesenden Zugriff auf die Geräte
des offenen Projekts**. Alles, was Truckload dabei speichert, soll über die vorhandenen Wege
laufen (siehe unten).

Bevor eine Seite Code schreibt, wollen wir abgleichen, wie die NYX-Datenbank aufgebaut ist und
wie Truckload heute eingebunden ist, damit beide Seiten zusammenpassen.

## Was Truckload heute über die Einbindung annimmt

Bitte prüfen und korrigieren. Quelle ist [nyx-host.md](nyx-host.md).

- NYX bindet Truckload als Git-Submodul ein und liefert es über `truckload://app/` aus.
- Ein Preload setzt `globalThis.truckloadHost`. Darüber laufen:
  - Speichern: `getAll(store)`, `put(store, value)`, `del(store, id)`, `writeMany({ puts, deletes })`
  - Drucken: `druckRahmen({ doc, titel })`, `print({ doc, titel })`
- Speicherorte:

  | Store | Ort in NYX |
  |---|---|
  | `cases`, `collections`, `trucks`, `ruleSets` | projektübergreifend (`~/.lpm/lpm_types.db`) |
  | `plans`, `projectRuleSets` | in der Projektdatei |

- NYX lehnt unbekannte Stores ab. Ein neuer Store braucht eine Absprache.
- Bei Projektwechsel lehnt der Host mit „Das Projekt wurde gewechselt – Truckload lädt neu.“ ab.

Du hast gesagt, es gibt in NYX eine Datenbank, in der alles steht, was das Programm schreibt,
auch alles von Truckload. Die Fragen unten sollen klären, wie diese Datenbank und die Tabelle
oben zusammenhängen.

## Fragen an NYX

### A. Aufbau der NYX-Datenbank

1. Welche Datenbanken bzw. Dateien gibt es (z. B. `~/.lpm/lpm_types.db`, die Projektdatei,
   weitere)? Welche Technik steckt dahinter (SQLite, JSON …)? Was liegt jeweils darin?
2. Wie sind die Truckload-Stores dort abgelegt (eine Tabelle je Store, JSON-Spalte, eigene
   Spalten)? Prüft NYX dabei Felder oder ein Schema, oder speichert es den Datensatz, wie er
   kommt?
3. Gibt es außer Truckload weitere Teile von NYX, die dieselben Daten lesen oder schreiben
   (z. B. Cases)?

### B. Die Projektgeräte

4. Wo und in welcher Form liegen die Geräte eines Projekts (Tabelle, Felder)? Gibt es eine
   Zeile je Einzelgerät (mit Vectorworks-ID) oder je Gerätetyp mit Anzahl?
5. **Welcher Wert ist ein stabiler Schlüssel je Gerätetyp, der über Projekte hinweg gleich
   bleibt?** Zum Beispiel ein GDTF-Typ, ein Vectorworks-Symbolname oder eine NYX-Typ-ID.
   Truckload merkt sich daran die Zuordnung zum Case, deshalb ist das die wichtigste Frage.
   Was passiert mit dem Schlüssel, wenn derselbe Typ in Vectorworks anders benannt ist?
6. Welche Arten liefert der Pool (Scheinwerfer, Verteiler, Kabel, Rigging, Video …)? Gibt es
   ein Feld, das sich als Gewerk eignet (Licht, Strom, Rigging …)?
7. Welche weiteren Felder gibt es je Gerät (Hersteller, Modus, Gewicht, Maße, Zustand
   „Reserve“/„Hausbestand“)? Truckload braucht mindestens Schlüssel, Anzeigename und Anzahl.
8. Kann sich die Liste ändern, während Truckload offen ist (neuer Vectorworks-Import)? Gibt es
   dann ein Ereignis, oder reicht es, beim Öffnen bzw. per Knopf neu zu lesen?

### C. Wie Truckload heute in NYX eingebunden ist

9. Wie ist `truckloadHost` heute umgesetzt (Preload, IPC-Kanäle, welche Datei auf NYX-Seite)?
10. Wie ordnet NYX Schreibzugriffe dem offenen Projekt zu? Kennt Truckload eine Projekt-ID, und
    kann ein Projekt mehrere Truckload-Pläne haben?
11. Welcher Truckload-Stand ist im Submodul festgenagelt, und wie testet ihr ein neues Heben
    (automatisch, von Hand)?
12. Gibt es Teile von NYX, die Truckload-Daten selbst lesen (z. B. Cases oder Pläne in einer
    NYX-Ansicht)? Dann betreffen neue Felder auch diese Teile.

### D. Vorschlag für die neue Schnittstelle (bitte korrigieren)

Truckload schlägt eine zusätzliche Funktion am Host vor:

```js
truckloadHost.projektGeraete()
// → Promise<Array<{
//      key: string,       // stabiler Gerätetyp-Schlüssel (Frage 5)
//      name: string,      // Anzeigename, z. B. "MAC Viper Profile"
//      anzahl: number,    // Gesamtzahl im Projekt
//      hersteller?: string,
//      gewerk?: string,   // falls vorhanden (Frage 6)
//    }>>
```

- Nur lesend, bezogen auf das offene Projekt. Fehler wie bei `getAll` (abgelehnte Promise mit
  `Error`, Projektwechsel wie bisher).
- Fehlt die Funktion, blendet Truckload die Funktion einfach aus. Ältere NYX-Stände laufen also
  weiter.

13. Passt diese Form? Wäre statt einer neuen Funktion ein lesender Store (z. B.
    `getAll('projektGeraete')`) für euch einfacher?
14. Soll Truckload über die Anzahl hinaus etwas zurückschreiben? Geplant ist das nicht: Die
    Markierung „verladen“ bleibt in Truckloads eigenen Daten.

### E. Was Truckload speichern will

Geplant ist das über die vorhandenen Stores, ohne neuen Store:

- **Am Case** (Store `collections`, projektübergreifend), neues optionales Feld:
  `fasst: { stueck: 2, geraete: [{ key: "<Schlüssel>", name: "MAC Viper Profile" }] }`
  (= „in dieses Case passen 2 Geräte dieses Typs“).
- **Am Plan** (Store `plans`, Projektdatei): `nyxAbgleich: { geoeffnet: true, nichtLaden: ["<key>", …] }`.
- **An jedem erzeugten Stück im Plan:** eine Herkunftsmarke `nyxGeraet: "<key>"`.

15. Nimmt NYX diese neuen Felder ohne Änderung an (Frage 2)? Oder muss etwas freigegeben werden?
16. Wo würdest du die Zuordnung Gerätetyp → Case lieber haben: am Case in `collections` wie
    oben, oder in einer eigenen NYX-Tabelle neben dem Gerätetyp?

### F. Was wir in den Datenbanken gesehen haben: stimmt das so?

Wir haben `~/.lpm/lpm_types.db` und eine Kopie einer aktuellen Projektdatei nur lesend
angesehen. Bitte bestätigen oder korrigieren. Damit lassen sich vermutlich mehrere Fragen
oben kurz beantworten.

17. **Truckload-Daten:** In beiden Dateien gibt es die Tabelle
    `tl_records(store, id, json, updated_at)`. Landen dort alle Truckload-Stores, je Datensatz
    als JSON (`cases`/`collections`/`trucks`/`ruleSets` in `lpm_types.db`, `plans`/`projectRuleSets`
    in der Projektdatei)? Beide Tabellen sind bei uns leer. Wird Truckload in NYX noch nicht
    benutzt, oder liegen die Daten woanders?
18. **Geräte:** Die Tabelle `fixtures` hat eine Zeile je Einzelgerät (`handle`) mit dem
    Vectorworks-Typ `inst_type`. Ist „Anzahl je Gerätetyp“ =
    `count(*) … group by inst_type`?
19. **Schlüssel:** `gdtf_type_links` verknüpft `inst_type` mit `gdtf_uuid` (z. B.
    „MAC Ultra Perf“ → Martin MAC Ultra Performance). Ist `gdtf_uuid` der stabile Schlüssel über
    Projekte hinweg, und `inst_type` nur der Name aus der jeweiligen Vectorworks-Datei? Was soll
    Truckload nehmen, wenn ein Typ noch nicht mit GDTF verknüpft ist?
20. **Zeilen ohne Typ:** Viele `fixtures`-Zeilen haben ein leeres `inst_type` (in unserer Kopie
    531 von 792). Was sind das (Zubehör, Platzhalter, nicht zugeordnete Symbole)? Soll Truckload
    sie auslassen?
21. **Ausgeschlossen:** Was bedeuten `excluded` und `system` (z. B. „A“)? Sollen ausgeschlossene
    Geräte oder bestimmte Systeme nicht in die Ladeliste?
22. **Gewicht:** `fixtures.gewicht` steht als Text („44,00 kg“). Darf Truckload es als Vorschlag
    für das Case-Gewicht nutzen? (Gewicht bleibt in Truckload optional.)
23. **Weitere Gerätearten:** Gehören diese auch in die Liste, und welcher Wert ist dort der Typ?
    - Stromverteiler: `fs_config` (`fs_typ`), Dimmer: `dim_config` (`dim_typ`)
    - Netzwerk/DMX: `dc_devices` (`device_type_id`, z. B. Node 12-fach, Splitter)
    - Traversen: `rigging_truss` (`name`, `count`)
    - Kabel: `laka_items` (`kabel_typ`)
24. **Anzeigenamen:** Soll Truckload `fixture_type_overrides.display` statt `inst_type` zeigen,
    wenn vorhanden?

## Was Truckload zusagt

- Kein neuer Store ohne Absprache, keine Netzabrufe, keine nativen Dialoge (wie in nyx-host.md).
- Die Funktion ist optional: ohne `projektGeraete()` bleibt Truckload wie bisher.
- Vor dem Bau ergänzt Truckload dieses Dokument um die endgültige Schnittstelle. Zu jeder
  Version kommen oben die Admin-Schritte dazu, wie bei den bisherigen Releases.

## Antworten von NYX

Von Aniflu im Issue #45 (17.11.2026), hier unverändert übernommen.

Stand: 16.11.2026, geprüft gegen NYX `main` (Truckload-Submodul auf `917c7e7`, v0.31.0+1).

#### Kurz vorweg (beantwortet F, damit erledigt sich das meiste aus A–E)

- 17 ja · 18 ja, aber mit Filter · 19 ja, mit Rückfall auf `inst_type` · 20 auslassen · 21 `excluded` auslassen, `system` ignorieren · 22 ja, als Vorschlag · 23 erst nur Scheinwerfer · 24 ja.
- Wichtigste Frage (5): Schlüssel = `gdtf:<gdtf_uuid>`, wenn der Typ mit GDTF verknüpft ist, sonst `vw:<inst_type>`. Details unter 5.

#### A. Aufbau der NYX-Datenbank

1. Alles ist SQLite (`better-sqlite3` im Main-Prozess), kein Server und kein JSON außer Einstellungen.
   - Projektdatei `<name>.db`, frei wählbar: Geräte (`fixtures`), Strom (`fs_config`, `dim_config`), Dimmercity (`dc_*`), LaKa (`laka_*`), Rigging (`rigging_truss`), GDTF-Zuordnung des Projekts (`gdtf_type_links`, `gdtf_mode_links`) und Truckloads `tl_records`.
   - `~/.lpm/lpm_types.db`, projektübergreifend: Typbibliotheken (`fs_typen`, `dim_typen`, `dc_device_types` …), die GDTF-Bibliothek (`gdtf_profiles`) und Truckloads `tl_records`.
   - Daneben nur JSON-Einstellungen (`~/.lpm/lpm_settings.json` u. a.), keine Truckload-Daten.
2. Eine generische Tabelle je Datei: `tl_records(store, id, json, updated_at)`, PK `(store, id)`. Der Datensatz wird als JSON abgelegt, **wie er kommt**. Geprüft werden nur: Store bekannt (`STORE_ORT`), `id` ist ein nicht leerer String. `updated_at` wird aus `value.updatedAt` übernommen, wenn es ein String ist. Kein Schema, keine Feldprüfung. Code: `launcher/electron/db-truckload.js`.
3. Nein. Truckload-Daten liest und schreibt in NYX nur Truckload. Umgekehrt liest Truckload heute keine NYX-Daten.

#### B. Die Projektgeräte

4. `fixtures` in der Projektdatei, **eine Zeile je Einzelgerät** (ein Vectorworks-Objekt), PK `handle`. Weitere Kennungen je Gerät: `user_field_5` (NYX-UUID des Einzelgeräts, unser Merge-Schlüssel), `vw_uid`, `mvr_id`. Eine Zeile je Typ mit Anzahl gibt es nicht. Die Anzahl entsteht durch Zählen (siehe 18).
5. **Schlüssel:** `gdtf_uuid` aus `gdtf_type_links`. Das ist die Fixture-Type-ID des GDTF-Profils, sie bleibt über Projekte und über GDTF-Revisionen gleich (die Revision steckt getrennt in `gdtf_rid`). `inst_type` ist nur der Name aus der jeweiligen Vectorworks-Datei.
   - Vorschlag: `key = "gdtf:" + gdtf_uuid`, wenn verknüpft, sonst `key = "vw:" + inst_type`. Das Präfix verhindert Zusammenstöße zwischen beiden Sorten.
   - Anderer Name in Vectorworks: `gdtf_type_links` ist je Projekt an `inst_type` gebunden. Ein neuer Name ist für NYX erst einmal ein neuer Typ. NYX verknüpft ihn aber selbsttätig neu (`gdtf/autoAssign.js`, nach jedem Einlesen; zuerst exakt über den GDTF-Dateinamen aus Vectorworks, danach per Namenssuche). Sobald das greift, kommt wieder derselbe `gdtf:`-Schlüssel heraus, und Truckloads Zuordnung passt.
   - Zwei `inst_type`-Namen mit derselben UUID (z. B. „MAC Viper“ und „Viper Profile“ in einer Datei) fasst NYX zu einem Eintrag zusammen und addiert die Anzahl.
   - Eine Lücke bleibt: Merkt sich Truckload eine Zuordnung unter `vw:MAC Viper` und wird der Typ später mit GDTF verknüpft, ändert sich der Schlüssel. Deshalb liefert NYX zusätzlich `vwNamen` mit (siehe D). Damit kann Truckload eine `vw:`-Zuordnung auf den neuen `gdtf:`-Schlüssel umhängen.
6. Die Projektgeräte (`fixtures`) sind **nur Scheinwerfer**. Die Austauschdatei aus Vectorworks kennt nichts anderes. Ein Gewerk-Feld gibt es nicht. Andere Arten stehen in eigenen Tabellen (siehe 23).
7. Je Gerät gibt es unter anderem: `gdtf_mode` (Mode), `watt`, `gewicht` (Text aus Vectorworks), `dmx_footprint`, `position`, `channel`. Hersteller und Gerätename kommen aus der GDTF-Verknüpfung (`gdtf_type_links.manufacturer`, `.fixture_name`), nur für verknüpfte Typen. Maße und „Reserve“/„Hausbestand“ gibt es nicht.
8. Ja, ein neues Einlesen aus Vectorworks kann jederzeit passieren, auch selbsttätig (Live-Sync). NYX meldet das heute nur dem Hauptfenster (`db:changed`), nicht der Truckload-Seite. **Lesen beim Öffnen und per Knopf reicht.** Ein Ereignis für Truckload bauen wir erst, wenn es gebraucht wird.

#### C. Wie Truckload heute in NYX eingebunden ist

9. Preload `launcher/electron/truckload-preload.js` setzt `truckloadHost` per `contextBridge`. Jeder Aufruf geht über `ipcRenderer.invoke('truckload:<name>', token, …)` an `launcher/electron/truckload/ipc.js`, die Daten landen in `db-truckload.js`. Antwortform intern `{ ok, data | error }`, der Preload macht daraus Auflösung bzw. abgelehnte Promise mit `Error`. Die Kanäle nehmen nur Aufrufe aus dem Truckload-Webview an.
10. Über ein **Token je Dokument**, nicht über eine Projekt-ID: Die Start-URL trägt die Projektgeneration (`?g=N`), der Preload liest sie einmal, und NYX lehnt jeden Aufruf mit einem alten Token ab. Daher die Meldung beim Projektwechsel. Truckload kennt keine Projekt-ID und braucht keine: `plans` liegt in der Projektdatei, also gehört jeder Plan dort automatisch zum Projekt. Mehrere Pläne je Projekt gehen, es sind einfach mehrere Datensätze im Store `plans`.
11. Festgenagelt ist `917c7e7` („docs(nyx): Admin-Schritte für 0.31.0“, also v0.31.0 plus Doku). Ein neues Heben: `git submodule update --remote truckload`, dann automatisch `truckloadLock.test.js` (gleicht u. a. NYX' `STORE_ORT` gegen Truckloads `STORES` ab) und `theme.test.js` (Theme-Token gegen `themeTokens.js`), danach Handtest im Tab, dann wird der Zeiger committet.
12. Nein. NYX liest keine Truckload-Daten. `print/truckload.js` baut nur den Druckrahmen um das, was Truckload liefert.

#### D. Neue Schnittstelle

13. Bitte als **eigene Funktion** `truckloadHost.projektGeraete()`, nicht als Store. Ein Store verspricht `put`/`del`, und `getAll('projektGeraete')` sähe für NYX' Prüfung wie ein Tippfehler-Store aus. Auf NYX-Seite wird das ein weiterer Kanal `truckload:projektGeraete` mit derselben Absender- und Token-Prüfung, Fehler und Projektwechsel wie bei `getAll`. Fehlende Funktion → Truckload blendet aus, wie vorgeschlagen.

    Vorgeschlagene Form (Ergänzungen gegenüber eurem Vorschlag markiert):

    ```js
    truckloadHost.projektGeraete()
    // → Promise<Array<{
    //      key: string,          // "gdtf:<uuid>" oder "vw:<inst_type>"
    //      name: string,         // Anzeigename (Frage 24)
    //      anzahl: number,       // nach Filter (Fragen 18, 20, 21)
    //      hersteller?: string,  // nur bei GDTF-Verknüpfung
    //      gewerk?: string,      // vorerst immer "licht"
    //      vwNamen: string[],    // NEU: alle inst_type, die auf diesen Eintrag fallen (Frage 5)
    //      gewichtKg?: number,   // NEU: nur wenn alle Geräte des Eintrags dasselbe lesbare Gewicht tragen (Frage 22)
    //    }>>
    ```

14. Nein, nichts zurückschreiben. „Verladen“ bleibt in Truckload, so ist es gut.

#### E. Was Truckload speichern will

15. Ja, ohne Änderung. NYX speichert den Datensatz, wie er kommt (siehe 2). `fasst`, `nyxAbgleich` und `nyxGeraet` brauchen keine Freigabe.
16. Am Case in `collections`, wie vorgeschlagen. Das liegt projektübergreifend in `lpm_types.db`, genau richtig für „im nächsten Projekt direkt vorschlagen“. Eine eigene NYX-Tabelle neben dem Gerätetyp wäre ein zweiter Ort für dieselbe Zuordnung. Wichtig: als `key` bitte genau den Schlüssel aus `projektGeraete()` speichern, ohne ihn zu zerlegen.

#### F. Was ihr gesehen habt

17. Ja, genau so. Leer heißt: in dieser Datei wurde Truckload noch nicht benutzt. Woanders liegen die Daten nicht.
18. Ja, aber nur mit Filter. NYX zählt wie die Datapool-Ansicht: `inst_type` nicht leer, `excluded = 0`, und ohne Bezugspunkte (`inst_type` enthält „Nullpunkt“ oder „Messpunkt“, das sind Messmarken, keine Geräte). Danach gruppiert nach dem Schlüssel aus 5, nicht nach `inst_type`. Diese Rechnung macht NYX; Truckload bekommt nur das Ergebnis.
19. Ja (siehe 5). Ohne GDTF-Verknüpfung: `vw:<inst_type>`.
20. Leere Vectorworks-Objekte vom Typ „Lighting Device“ ohne Gerätetyp, ein bekanntes Altlastenthema auf der Vectorworks-Seite. Keine Geräte, also auslassen. Das übernimmt NYX bereits (18).
21. `excluded` = in NYX ausgeblendet, also nicht Teil der Planung → nicht in die Ladeliste (filtert NYX). `system` ist das DMX-System (A–Z), also ein Adressraum, nichts Physisches → ohne Bedeutung fürs Laden, nicht filtern.
22. Ja, als Vorschlag. Das Gewicht ist freier Text aus Vectorworks und kann je Gerät fehlen oder unterschiedlich geschrieben sein. NYX liest es aus und liefert `gewichtKg` nur, wenn es für alle Geräte eines Eintrags eindeutig ist. Sonst fehlt das Feld.
23. Fürs Erste **nur Scheinwerfer**. Verteiler und Dimmer (`fs_config.fs_typ`, `dim_config.dim_typ`) sind die naheliegende zweite Stufe, eine Zeile je Gerät, Typ über die Bibliothek stabil. Netzwerkgeräte (`dc_devices.device_type_id`) ebenso denkbar. `rigging_truss.count` und `laka_items` sind keine Stückzahlen ladbarer Geräte (Traversenzüge bzw. Kabelwege) und bräuchten erst eine Abstimmung, was dort ein „Stück“ ist. Das Feld `gewerk` ist schon in der Form, damit später nichts bricht.
24. Ja. `fixture_type_overrides` mit `scope = 'name'` → `display`, sonst bei GDTF-Verknüpfung `fixture_name`, sonst `inst_type`. NYX setzt den Namen zusammen.

#### Was NYX baut, sobald beide Häkchen stehen

- Kanal `truckload:projektGeraete` (ipc.js), Eintrag im Preload, Zählung und Schlüssel in einem reinen Modul mit eigenen Tests.
- Sperre in `truckloadLock.test.js`: der Kanal ist nur lesend.
- Kein neuer Store, keine Schemaänderung.

## Abgestimmte Schnittstelle (Stand nach den Antworten)

```js
truckloadHost.projektGeraete()
// → Promise<Array<{
//      key: string,          // "gdtf:<gdtf_uuid>" wenn mit GDTF verknüpft, sonst "vw:<inst_type>"
//      name: string,         // Anzeigename: Override (scope 'name') → GDTF fixture_name → inst_type
//      anzahl: number,       // gezählt wie Datapool: inst_type nicht leer, excluded = 0, ohne Null-/Messpunkte
//      hersteller?: string,  // nur bei GDTF-Verknüpfung
//      gewerk?: string,      // vorerst immer "licht"
//      vwNamen: string[],    // alle inst_type, die auf diesen Eintrag fallen
//      gewichtKg?: number,   // nur wenn für alle Geräte des Eintrags eindeutig
//    }>>
```

- Eigene Funktion, kein Store. Nur lesend. Fehler und Projektwechsel wie bei `getAll`.
- Fehlt die Funktion, blendet Truckload „Aus Projektdatenbank übernehmen“ aus.
- Vorerst nur Scheinwerfer. Verteiler, Dimmer und Netzwerkgeräte sind die zweite Stufe; das
  Feld `gewerk` ist dafür schon vorgesehen.
- Truckload speichert `key` genau so, wie NYX ihn liefert, und zerlegt ihn nicht.
- Kein Ereignis bei neuem Einlesen: Truckload liest beim Öffnen und per Knopf.

## Anpassungen auf Truckload-Seite nach den Antworten

1. **Schlüssel umhängen.** Hat Truckload eine Zuordnung unter `vw:<Name>` gespeichert und liefert
   NYX für denselben Typ inzwischen `gdtf:<uuid>` mit `<Name>` in `vwNamen`, übernimmt Truckload
   die Zuordnung für den neuen Schlüssel und schreibt ihn am Case (`fasst.geraete`) um. Ohne das
   ginge die gemerkte Zuordnung verloren, sobald ein Typ mit GDTF verknüpft wird.
2. **Gewichtsvorschlag beim neuen Case.** Liefert NYX `gewichtKg`, schlägt Truckload beim Anlegen
   eines Cases im Abgleich das Gewicht vor: Geräte pro Case × `gewichtKg`. Das Feld bleibt
   optional und änderbar (Gewicht ist in Truckload keine Pflicht).
3. **Gewerk.** Cases, die im Abgleich neu entstehen, bekommen das Gewerk aus `gewerk`
   („licht“ → „Licht“).
4. Alles Übrige bleibt wie oben unter E beschrieben (`fasst` am Case, `nyxAbgleich` am Plan,
   `nyxGeraet` an den Stücken). Neu dazu an den Stücken: `nyxStueck` (Zahl der Geräte im Stück).
   NYX bestätigt: keine Freigabe nötig, NYX speichert die Datensätze unverändert.
5. **Je Plan.** Jeder Truckload-Plan gleicht sich selbst mit der Geräteliste ab; mehrere Pläne
   eines Projekts werden nicht verrechnet. Für NYX ändert das nichts.

## Freigabe

Erst wenn beide Häkchen gesetzt sind, wird auf einer der beiden Seiten gebaut.

- [x] **NYX:** Fragen beantwortet, Schnittstelle abgestimmt, wir können loslegen. (Aniflu, 17.11.2026)
- [x] **Truckload:** Design an die Antworten angepasst, wir können loslegen. (M4dm0nky, 17.11.2026 – Design: `docs/superpowers/specs/2026-11-17-nyx-projektgeraete-design.md`)
