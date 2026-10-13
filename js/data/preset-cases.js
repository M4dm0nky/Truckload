// Standardvorlagen (nur lesbar). Der Inhalt steht seit V 0.16.1 in data/standard.json, einer
// Sammlung wie jede andere (docs/nyx-sammlungen.md). Hier bleibt nur der alte Name, unter dem
// Verbraucher und Tests die Vorlagen kennen. Recherche und Rechenweg der Gewichte:
// docs/casemasse-gewichte.md, docs/mlt-truss-gewichte.md.
import standard from '../../data/standard.json' with { type: 'json' };

export const PRESET_CASES = standard.cases;
