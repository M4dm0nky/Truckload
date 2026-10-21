# Traversen-Katalog: was NYX wissen muss

Gilt seit V 0.18.0. Ergänzt [nyx-host.md](nyx-host.md) und richtet sich an die NYX-Entwicklung, die
Truckload als Submodul einbindet.

## Zuerst: was NYX tun muss

**Nichts am Speicher.** Es gibt keinen neuen Store und kein neues Format der Sicherung oder
Projektdatei. Zur Kenntnis:

- **Neue mitgelieferte Datei `data/traversen.json`** (Traversen-Katalog), gelesen wie `data/standard.json`
  per JSON-Modul-Import (Mindestversion der Laufzeit wie bisher: Chromium ≥ 123). Sie liegt in der
  Offline-Liste von `sw.js`; wer das Submodul mit eigener Dateiliste einbindet, nimmt `data/traversen.json`
  und `js/model/trussCatalog.js` mit auf.
- **Neue optionale Eigenschaft `truss.profileId`** (String bis 64 Zeichen) an Traversenwagen-Cases. Alte
  Wagen ohne die Eigenschaft laden unverändert. Sie wandert wie jede andere Case-Eigenschaft durch
  `collections`, `plans` (Kopie `mitgefuehrt`) und die Sicherung; NYX muss sie nicht auswerten.
- Der Dialog „Traverse hinzufügen“ bekommt eine Profilsuche (z. B. „FD34“) mit Längen und Gewicht
  aus dem Katalog. Das ist reine Oberfläche in Truckload.
