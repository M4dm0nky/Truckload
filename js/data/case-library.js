// Case-Bibliothek aus der Excel-Tabelle des Nutzers.
//
// Quelle: „Casemaße Complete.xlsx“, Blatt „Data Cases“ (Zeilen 3–144).
// Erzeugt am 2026-09-20 durch ein einmaliges Umwandlungsskript (nicht im Repo,
// lief im Scratchpad); dieses Modul ist das Ergebnis und wird von Hand gepflegt.
//
// 142 Zeilen hatten einen Typ, 137 sind hier gelandet:
// - Sechs 19″-Racks (1, 2, 4, 5, 6, 16 HE) hatten in der Tabelle leere Zellen für
//   l und w; l = w = 60 cm ist dafür geschätzt. Bei h war die Zelle bei vier
//   Racks (1, 4, 5, 16 HE) ebenfalls leer und wurde aus der Höheneinheit
//   gerechnet (siehe Kommentare unten); bei zwei Racks (2, 6 HE) stand dort
//   dagegen bereits eine gemessene Zahl (15 bzw. 32 cm) — die wird unverändert
//   übernommen, es wird nur gerechnet, was in der Quelle wirklich fehlt.
// - Fünf Rigging-Zeilen ohne brauchbares Höhenmaß (leere Zellen bzw. die
//   Zeichenketten „-“/„x“) entfallen ersatzlos:
//   „Motorsteuerung (Koffer -BBM“, „Bolzenkoffer -BBM“, „FD34 x2 -CAB“,
//   „HOF BOLT -CAB“, „Dolly ‚Drohne‘ -CAB“.
//
// Gewerk-Zuordnung (Spalte „Family“ → Gewerk): Fixture/Desk → Licht,
// Rigging → Rigging, DC/Cable → Strom, Rack → Ton, FOH → Video, Case → Sonstiges.
//
// Namens-Suffix: Das Firmenkürzel (Spalte „Company“) wird nur an den Namen
// angehängt, wenn es darin noch gar nicht vorkommt – steht es schon irgendwo im
// Namen (z. B. „D8+ 0,5t CAB x12“), bleibt der Name unverändert.
//
// Gewichte: 89 von 137 Einträgen tragen ein recherchiertes Schätzgewicht (Feld `note`, Text
// „Gewicht geschätzt: …“); die beiden FR10-Zeilen behalten ihre Originalwerte aus der Tabelle
// unverändert. Alle übrigen bleiben bei 0 – lieber 0 kg als eine erfundene Zahl. Quellen und
// Rechenweg: docs/casemasse-gewichte.md.

// Seit V 0.16.1 steht der Inhalt in data/meine.json („Meine Sammlung“); dieses Modul behält nur
// den alten Namen CASE_LIBRARY für Verbraucher und Tests.
import meine from '../../data/meine.json' with { type: 'json' };

export const CASE_LIBRARY = meine.cases;
