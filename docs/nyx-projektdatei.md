# Projektdatei vollständig: was NYX wissen muss

## Für den Admin: zu tun vor dem Heben des Submoduls auf 0.32.0

**Neu mit 0.32.0 (Dicht laden):**
- Führt NYX eine eigene Dateiliste des Submoduls, `js/model/rows.js` und `js/model/rowPlanner.js`
  aufnehmen. Wer `sw.js` übernimmt, hat sie schon.
- Neues optionales Feld `rowPlan` (Boolean, fehlt = aus) an Plänen und an Regelsets
  (`ruleSets`, `projectRuleSets`). Es steckt in den bestehenden Datensätzen; wer sie unverändert
  durchreicht, muss nichts tun.
- Kein neuer Store, keine Freigabe nötig. Die Projektdatei ändert sich nur um dieses Feld.
- Ältere Stände lehnen das Feld nicht ab: `checkPlan` und `checkRuleSet` von 0.31.0 prüfen nur die
  ihnen bekannten Felder und ignorieren unbekannte. Ein Zurückdrehen des Submoduls bricht nichts;
  die Option wirkt dann nur nicht und geht beim erneuten Speichern eines Regelsets verloren
  (`saveRuleSet` baut das Objekt neu auf).
- Die Standarddaten (`data/standard.json`) haben drei Vorlagen, die jetzt tippbar sind. Hält NYX
  eine eigene Kopie, die Datei ersetzen.

Gilt seit V 0.17.1. Ergänzt [nyx-host.md](nyx-host.md) und richtet sich an die NYX-Entwicklung, die
Truckload als Submodul einbindet. Vorschlag und Freigabe: Issue #33.

## Zuerst: was NYX tun muss

**Den Store `projectRuleSets` freigeben, und zwar in der Projektdatei** (wie `plans`), bevor diese
Version übernommen wird. NYX lehnt unbekannte Stores ab. Fehlt die Freigabe, scheitert `loadAll()`,
Truckload zeigt die Ersatzansicht und sperrt jeden Schreibzugriff bis zum Neuladen.

Sonst ist nichts zu tun. Die mitgeführten Cases und Fahrzeuge stecken im Plan selbst und liegen
damit schon in der Projektdatei. NYX muss sie weder lesen noch verstehen.

## Was Truckload tut

- **`plan.mitgefuehrt`** = `{ version: 1, cases: [...], trucks: [...] }`: eine Kopie genau der
  Cases und Fahrzeuge, auf die der Plan verweist, ohne `collectionId`. Truckload berechnet sie bei
  jedem Speichern des Plans neu und speichert betroffene Pläne neu, wenn sich ein benutztes Case
  oder Fahrzeug in der Bibliothek ändert.
- **Laden:** Die Bibliothek gewinnt immer. Nur IDs, die dort fehlen, kommen aus der Kopie des
  offenen Plans. Auf dem Rechner, auf dem der Plan entstand, ändert sich also nichts.
- **Fremder Rechner:** Kopien gelten nur für den Plan, erscheinen nicht in Materialverwaltung und
  Wizard und sind erst nach „In meine Bibliothek übernehmen“ änderbar. Übernehmen schreibt das Case
  in den Datensatz „Meine Sammlung“ (`collections`) bzw. das Fahrzeug in `trucks`, beides
  projektübergreifend.
- **Projekt-Regelsets** (`projectRuleSets`): dasselbe Format wie `ruleSets`. Der Regel-Dialog
  speichert standardmäßig ins Projekt. Ein Projektwechsel in NYX zeigt also die Regelsets des neuen
  Projekts.

## Folgen für NYX

- **Größe:** Ein Plan wächst um rund 350 Byte je benutztem Case-Typ (50 Typen: etwa 17 KB).
- **Atomarität:** `projectRuleSets` und `plans` liegen beide in der Projektdatei. Ein `writeMany`
  mit beiden ist eine Transaktion in einer Datei. Der Import einer Sicherung mischt weiterhin
  projektübergreifende Stores mit der Projektdatei und ist darüber hinweg nicht atomar (siehe
  [nyx-host.md](nyx-host.md)).
- **Bewusst nicht gelöst:** Eine Änderung an einem Case in der Bibliothek wirkt in allen Projekten.
