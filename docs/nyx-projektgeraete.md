# Geräte aus der NYX-Projektdatenbank in Truckload: Abstimmung

An: NYX-Admin (Aniflu) · Von: Truckload · Stand: 16.11.2026 · Status: **Abstimmung offen, noch kein Code**

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
3. Truckload merkt sich die Zuordnung „MAC Viper → Mac Viper x2 / x1“ und schlägt sie im
   nächsten Projekt direkt vor.
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

## Was Truckload zusagt

- Kein neuer Store ohne Absprache, keine Netzabrufe, keine nativen Dialoge (wie in nyx-host.md).
- Die Funktion ist optional: ohne `projektGeraete()` bleibt Truckload wie bisher.
- Vor dem Bau ergänzt Truckload dieses Dokument um die endgültige Schnittstelle. Zu jeder
  Version kommen oben die Admin-Schritte dazu, wie bei den bisherigen Releases.

## Antworten von NYX

_(Bitte hier direkt eintragen, gern je Fragennummer.)_

## Freigabe

Erst wenn beide Häkchen gesetzt sind, wird auf einer der beiden Seiten gebaut.

- [ ] **NYX:** Fragen beantwortet, Schnittstelle abgestimmt, wir können loslegen. (Name, Datum)
- [ ] **Truckload:** Design an die Antworten angepasst, wir können loslegen. (Name, Datum)
