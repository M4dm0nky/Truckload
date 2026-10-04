# Lagen-Durchsicht in 3D und Avery-Etiketten — Umsetzungsplan

> **Für agentische Umsetzer:** Dieser Plan wird mit `superpowers:executing-plans` abgearbeitet,
> danach eine unabhängige Schlussprüfung über den ganzen Branch. Das ist meine eigene
> Entscheidung, nicht mit dem Nutzer abgestimmt: CLAUDE.md verlangt Subagenten für
> **unabhängige** Aufgaben, und die vier hier sind es nicht — drei von ihnen fassen
> `js/app.js` an und müssen ohnehin nacheinander laufen. Schritte tragen Kästchen (`- [ ]`).

**Ziel:** Die zwei Entscheidungen nachziehen, die ich bei V 0.9.0 eigenmächtig getroffen
hatte — die Lagen-Durchsicht gibt es jetzt auch in 3D (durch Ausblenden), und die Etiketten
passen auf echte Avery-Zweckform-Bögen.

**Vorgehen:** Beides sind umrissene Änderungen an vorhandenem Code. In 3D werden Stücke
oberhalb der Grenze gar nicht erst gebaut — damit bleiben die geteilten Materialien und
InstancedMeshes unangetastet. Für die Etiketten hängt `js/app.js` vor dem Druck eine eigene
`@page`-Regel ein (A4 hoch, randlos) und nimmt sie danach wieder weg; Ladeplan und Abhakliste
bleiben A4 quer.

**Technik:** Reine ES-Module, kein Build-Schritt, `node --test`, Three.js aus `vendor/`.

**Entwurf:** In diesem Gespräch abgestimmt (Brainstorming vom 2026-10-04, kein eigenes
Spec-Dokument — die Änderung ist dafür zu klein). Die tragenden Punkte stehen unten unter
„Globale Vorgaben“ und in den Aufgaben.

## Globale Vorgaben

- Keine npm-Abhängigkeiten, kein Build-Schritt. Keine neue Datei unter `js/` oder `css/` —
  sonst muss die ASSETS-Liste in `sw.js` ergänzt werden (`tests/pwa.test.js` prüft das).
- Nutzereingaben in HTML nur über `esc()` aus `js/ui/dom.js`; in SVG `textContent`.
- Oberfläche auf Deutsch, Anführungszeichen „…“ mit schließendem Zeichen **U+201C**.
- „tippen“, nie „kippen“.
- Eine Versionsnummer überall: `js/version.js`, `package.json`, `README.md`, `index.html`,
  Cache-Name in `sw.js`, oberster CHANGELOG-Eintrag. Ziel: **0.9.1** (Patch, kein Git-Tag).
  Erst in Aufgabe 4 anfassen.
- Alte Daten müssen weiter laden; `layerLimit` ist kein Teil des Plans und wird nicht
  gespeichert.
- Erfundene Zahlen sind schlimmer als fehlende. Wo eine Herstellerangabe nicht belegt ist,
  wird das als ungeprüft dokumentiert, statt sie zu behaupten.

## Worauf die Schlussprüfung besonders schauen soll

- **Ausgewähltes Stück oberhalb der Grenze (3D):** Es darf nicht verschwinden, sonst zeigt der
  Inspector ein Stück an, das in der Ansicht nicht existiert. Test in Aufgabe 1.
- **`layerLimit === null` (Auswahl „alle“):** 2D wie 3D müssen sich bitgleich wie vor der
  Änderung verhalten. Test in Aufgabe 1.
- **Leere Ladung und Ladung ohne sichtbares Stück:** `update()` darf nicht stürzen, wenn nach
  dem Filtern nichts übrig bleibt; die Kamera rahmt auf das Fahrzeug, nicht auf die Stücke.
  Test in Aufgabe 1 (reine Funktion) plus Browser-Prüfung in Aufgabe 2.
- **Druckart wechseln, ohne zu drucken:** Die eingehängte `@page`-Regel darf nicht
  zurückbleiben und den nächsten Ladeplan-Ausdruck auf Hochformat zwingen. Test in Aufgabe 3.
- **Etikettenzahl je Bogen:** 10 bzw. 24 — nicht 6 bzw. 15 wie bisher. Belegt über einen
  echten PDF-Export in Aufgabe 3.

---

## Dateien

| Datei | Verantwortung in diesem Plan |
|---|---|
| `js/model/validate.js` | neue reine Funktion `aboveLayer()` neben `archBoxes()` |
| `tests/validate.test.js` | Tests dazu |
| `js/ui/view2d.js` | `aboveLayer()` statt der Prüfung von Hand |
| `js/ui/view3d.js` | `layerLimit` in `update()`, Stücke oberhalb der Grenze auslassen |
| `js/app.js` | `layerLimit` an `view3d.update()`, Lagen-Auswahl auch in 3D sichtbar, `@page`-Regel für den Etikettendruck |
| `css/print.css` | Avery-Raster statt des freien Rasters |
| `index.html` | Beschriftung der Größenauswahl |
| `tests/print.test.js` | Test für die `@page`-Regel-Verwaltung ist **nicht** hier, sondern in Aufgabe 3 beschrieben |
| `README.md`, `docs/architektur.md`, `docs/offene-punkte.md`, `CHANGELOG.md` | Aufgabe 4 |

---

### Aufgabe 1: `aboveLayer()` als gemeinsame Regel

Die Prüfung „liegt über der gewählten Lage“ steht heute von Hand in `js/ui/view2d.js:358`.
In 3D käme sie ein zweites Mal dazu. Genau diese Doppelung hat in V 0.9.0 schon einmal eine
Fix-Runde gekostet (die Lagenberechnung selbst), deshalb wird sie hier vorher ausgelagert.

**Dateien:**
- Ändern: `js/model/validate.js` (neue Export-Funktion, direkt nach `archBoxes`)
- Ändern: `js/ui/view2d.js:358`
- Test: `tests/validate.test.js`

**Schnittstellen:**
- Liefert an Aufgabe 2: `aboveLayer(layers, id, limit, selectedId)` → `boolean`.
  `layers` ist `result.layers` (Map id→Lage ab 1), `limit` ist `null` für „alle“,
  `selectedId` ist die Kennung des ausgewählten Stücks oder `null`.
  `true` heißt „liegt oberhalb der Grenze“ — 2D zeichnet es dann blass, 3D lässt es weg.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Ans Ende von `tests/validate.test.js`:

```js
// Gemeinsame Regel für die Lagen-Durchsicht: 2D zeichnet solche Stücke blass, 3D lässt sie
// ganz weg. Eine Funktion für beide, damit die Ansichten nicht auseinanderlaufen können.
test('aboveLayer: ohne Grenze („alle“) liegt nichts oberhalb', () => {
  const layers = new Map([['a', 1], ['b', 3]]);
  assert.equal(aboveLayer(layers, 'a', null, null), false);
  assert.equal(aboveLayer(layers, 'b', null, null), false);
});

test('aboveLayer: oberhalb der Grenze ja, auf und unter der Grenze nein', () => {
  const layers = new Map([['a', 1], ['b', 2], ['c', 3]]);
  assert.equal(aboveLayer(layers, 'a', 2, null), false);
  assert.equal(aboveLayer(layers, 'b', 2, null), false);
  assert.equal(aboveLayer(layers, 'c', 2, null), true);
});

// Das ausgewählte Stück bleibt immer sichtbar: in 3D verschwände es sonst ganz, während der
// Inspector es weiter als ausgewählt führt; in 2D verblasste sein Auswahlrahmen auf 18 %.
test('aboveLayer: das ausgewählte Stück ist nie oberhalb', () => {
  const layers = new Map([['c', 3]]);
  assert.equal(aboveLayer(layers, 'c', 1, 'c'), false);
  assert.equal(aboveLayer(layers, 'c', 1, 'anderes'), true);
});

// Ein Stück ohne Eintrag in der Lagenkarte (soll nicht vorkommen) gilt als Lage 1 und bleibt
// damit sichtbar — lieber ein Stück zu viel zeigen als eines verschwinden lassen.
test('aboveLayer: ein Stück ohne bekannte Lage gilt als Lage 1', () => {
  assert.equal(aboveLayer(new Map(), 'unbekannt', 1, null), false);
});
```

Den Import oben in der Datei ergänzen: `aboveLayer` zu den bereits aus
`../js/model/validate.js` importierten Namen hinzufügen.

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag sehen**

Laufen lassen: `node --test tests/validate.test.js`
Erwartet: FEHLER, `aboveLayer is not a function` (bzw. ein Importfehler).

- [ ] **Schritt 3: Umsetzen**

In `js/model/validate.js`, direkt nach der Funktion `archBoxes`:

```js
// Lagen-Durchsicht: liegt dieses Stück oberhalb der gewählten Lage? `limit === null` heißt
// „alle“ und damit nie. Das AUSGEWÄHLTE Stück ist immer ausgenommen — in 3D verschwände es
// sonst ganz, während der Inspector es weiter als ausgewählt führt, in 2D verblasste sein
// Auswahlrahmen auf 18 %. Eine Regel für beide Ansichten, damit sie nicht auseinanderlaufen
// (die Lagen selbst kommen schon aus `layerMap` hier in dieser Datei).
export const aboveLayer = (layers, id, limit, selectedId) =>
  limit != null && id !== selectedId && (layers.get(id) ?? 1) > limit;
```

In `js/ui/view2d.js` den Import aus `'../model/validate.js'` um `aboveLayer` erweitern und
Zeile 358 ersetzen:

```js
    const faint = aboveLayer(result.layers, it.id, layerLimit, selectedId);
```

Die Zeile darüber (`const layers = layerLimit != null ? result.layers : null;`) entfällt
ersatzlos, ebenso die Variable `layers` in `renderView`.

- [ ] **Schritt 4: Tests laufen lassen**

Laufen lassen: `npm test`
Erwartet: alles grün. Die Zahl der Tests steigt um 4.

- [ ] **Schritt 5: Festschreiben**

```bash
git add js/model/validate.js js/ui/view2d.js tests/validate.test.js
git commit -m "refactor: aboveLayer() als gemeinsame Regel der Lagen-Durchsicht"
```

---

### Aufgabe 2: Lagen-Durchsicht in 3D

In 3D werden Stücke oberhalb der Grenze **ausgeblendet**, nicht blass gezeichnet. Eine
Transparenz je Stück wäre dort teuer: Materialien liegen nach Farbe in einem Zwischenspeicher
(`bodyMatCache`, `bandMatCache`) und die Profilstäbe laufen als ein einziges `InstancedMesh`
über alle Cases — man müsste die Materialien verdoppeln und die InstancedMeshes nach
blass/kräftig trennen. Ausblenden kostet nichts und ergibt in 3D einen sauberen Schnitt durch
die Ladung; den blassen Zusammenhang braucht man dort nicht, weil man umherfahren kann.

**Dateien:**
- Ändern: `js/ui/view3d.js` (Signatur von `update()`, die Schleife über `result.items`)
- Ändern: `js/app.js:715` (Aufruf von `view3d.update`) und `js/app.js:540` (Sichtbarkeit von
  `#layer-group`)

**Schnittstellen:**
- Benutzt aus Aufgabe 1: `aboveLayer(layers, id, limit, selectedId)` aus
  `js/model/validate.js`.
- `update({ truck, result, selectedId, colorMode, layerLimit })` — `layerLimit` ist neu und
  hat den Vorgabewert `null`.

- [ ] **Schritt 1: `update()` filtern lassen**

In `js/ui/view3d.js` den Import aus `'../model/validate.js'` um `aboveLayer` erweitern
(`archBoxes` kommt bereits von dort) und die Signatur ändern:

```js
  function update({ truck, result, selectedId, colorMode = 'black', layerLimit = null }) {
```

In derselben Funktion die Schleife über die Stücke um eine erste Zeile ergänzen:

```js
    for (const it of result.items) {
      // Lagen-Durchsicht: in 3D werden höhere Lagen AUSGEBLENDET statt blass gezeichnet.
      // Eine Transparenz je Stück wäre hier teuer (Materialien liegen nach Farbe im
      // Zwischenspeicher, Profilstäbe laufen als ein InstancedMesh über alle Cases); in 3D
      // kann man umherfahren, der blasse Zusammenhang wird also nicht gebraucht.
      if (aboveLayer(result.layers, it.id, layerLimit, selectedId)) continue;
      const bad = result.byPlacement.has(it.id);
```

Die Spanne für den Gewichtsmodus (`weightRange(result.items)`, einmal je Render) bleibt
**unverändert über alle Stücke** — sonst spränge die Farbskala beim Umschalten der Lagen um.

- [ ] **Schritt 2: `js/app.js` verdrahten**

Den Aufruf bei Zeile 715 ergänzen:

```js
    view3d.update({ truck: d.truck, result: d.result, selectedId: s.selectedId, colorMode: s.caseColors, layerLimit: s.layerLimit });
```

Und die Zeile, die die Auswahl im 3D-Modus versteckt, samt ihrem Kommentar ersetzen — sie
wirkt jetzt in beiden Ansichten:

```js
  // Lagen-Durchsicht wirkt in beiden Ansichten: 2D zeichnet höhere Lagen blass, 3D blendet
  // sie aus (js/ui/view3d.js). Die Auswahl bleibt deshalb immer sichtbar.
```

Der Ausdruck `$('#layer-group').hidden = s.mode !== '2d';` entfällt ersatzlos.

- [ ] **Schritt 3: Tests laufen lassen**

Laufen lassen: `npm test`
Erwartet: alles grün, keine neuen Tests (Three.js lässt sich in `node --test` nicht laden —
diese Aufgabe wird im Browser abgenommen).

- [ ] **Schritt 4: Im Browser prüfen**

Server starten und ein Szenario fahren (siehe CLAUDE.md, „Im Browser“):

```bash
python3 -m http.server 8766
node tools/cdp.mjs ./szenario.mjs ./ausgabe
```

**Achtung:** `p.eval` erwartet eine Funktion als Zeichenkette (intern
`(deinCode).apply(null, args)`), kein ausgeführtes IIFE. `p.shot('name')` hängt `.png` selbst
an. `p.logs` ist eine Eigenschaft, keine Funktion.

Aufbau: ein Prüf-Fahrzeug, in dem sicher gestapelt wird (z. B. 300 × 240 × 270 cm) und
12 gleiche stapelbare Cases à 60 × 60 × 60 cm, dann `#pack-all` klicken, auf 3D umschalten.
Drei Aufnahmen: `Lagen = alle`, `bis 1`, und `bis 1` mit einem ausgewählten Stück der Lage 3
(über `app.select(id)` aus `/js/app.js`).

Selbst ansehen (Read auf die PNG) und im Bericht beschreiben:
- bei „alle“ stehen volle Stapel,
- bei „bis 1“ ist nur noch die Bodenreihe da,
- das ausgewählte Stück der Lage 3 ist trotzdem zu sehen,
- die Lagen-Auswahl ist im 3D-Modus sichtbar.

Zusätzlich: Lagen-Auswahl auf „bis 1“ stellen und den Truck leeren („Truck entladen“) — die
3D-Ansicht darf nicht stürzen und die Konsole (`p.logs`) keine Fehler zeigen.

- [ ] **Schritt 5: Festschreiben**

```bash
git add js/ui/view3d.js js/app.js
git commit -m "feat: Lagen-Durchsicht auch in 3D – höhere Lagen werden ausgeblendet"
```

---

### Aufgabe 3: Etiketten auf Avery-Zweckform-Bögen

Die beiden Größen werden zu zwei echten Formaten. Die Maße waren schon richtig gewählt — nur
das Hochformat fehlte, weil `@page` für alle Druckarten A4 quer war.

| Auswahl | Artikel | Etikett | Raster | je Bogen |
|---|---|---|---|---|
| `large` | Avery Zweckform **3425** | 105 × 57 mm | 2 Spalten × 5 Zeilen | 10 |
| `small` | Avery Zweckform **3474** | 70 × 37 mm | 3 Spalten × 8 Zeilen | 24 |

Beide Raster sind 210 mm breit (2 × 105 und 3 × 70) — das ist genau die A4-Breite, der
Seitenrand links und rechts ist damit zwangsläufig 0. Senkrecht bleibt bei 3425 ein Spiel von
12 mm (297 − 5 × 57 = 12) und bei 3474 von 1 mm (297 − 8 × 37). **Der obere Rand ist nicht
belegt:** die öffentlichen Quellen nennen ihn nicht, und die eine Seite mit Zahlen
widerspricht sich selbst. Das Raster wird deshalb senkrecht zentriert — die einzige neutrale
Wahl — und das als ungeprüft dokumentiert (Aufgabe 4). Nicht raten, nicht als Herstellerangabe
ausgeben.

**Dateien:**
- Ändern: `css/print.css` (der Block ab „Etiketten (Task 4)“)
- Ändern: `js/app.js` (`@page`-Regel um den Etikettendruck herum)
- Ändern: `index.html` (Beschriftung in `#print-label-size`)
- Test: `tests/print.test.js`

**Schnittstellen:**
- Benutzt: `buildLabels(root, { plan, result, size })` aus `js/ui/print.js` — unverändert.
- Liefert: `setPrintPage(doc)` und `clearPrintPage()` in `js/app.js`, siehe Schritt 3.

- [ ] **Schritt 1: Den fehlschlagenden Test schreiben**

Der Test prüft die reine Regel, welche `@page`-Vorschrift zu welcher Druckart gehört — ohne
DOM, ohne echten Druck. Ans Ende von `tests/print.test.js`:

```js
import { pageRuleFor } from '../js/ui/print.js';

// Etiketten müssen auf A4 HOCH und randlos, damit sie auf Avery-Bögen passen; Ladeplan und
// Abhakliste bleiben A4 quer. Benannte Seiten (@page x { … } + page:) werden von Browsern
// uneinheitlich unterstützt, deshalb hängt js/app.js die Regel vor dem Druck ein und nimmt
// sie danach wieder weg. Bleibt sie stehen, druckt der nächste Ladeplan im Hochformat.
test('pageRuleFor: nur Etiketten brauchen eine eigene Seitenvorschrift', () => {
  assert.equal(pageRuleFor('plan'), null);
  assert.equal(pageRuleFor('checklist'), null);
  assert.match(pageRuleFor('labels'), /@page\s*\{[^}]*A4 portrait/);
  assert.match(pageRuleFor('labels'), /margin:\s*0/);
});
```

- [ ] **Schritt 2: Test laufen lassen, Fehlschlag sehen**

Laufen lassen: `node --test tests/print.test.js`
Erwartet: FEHLER, `pageRuleFor is not a function`.

- [ ] **Schritt 3: Umsetzen**

In `js/ui/print.js`, direkt vor `buildLabels`:

```js
// Etiketten drucken auf A4 HOCH und randlos (Avery-Zweckform-Bögen); Ladeplan und Abhakliste
// bleiben A4 quer. Benannte Seiten (`@page x { … }` + `page:`) wären der naheliegende Weg,
// werden aber von Browsern uneinheitlich unterstützt — js/app.js hängt deshalb diese Regel
// nur für den Etikettendruck ein und nimmt sie danach wieder weg.
export const pageRuleFor = doc =>
  doc === 'labels' ? '@page { size: A4 portrait; margin: 0; }' : null;
```

In `js/app.js` den Import aus `'./ui/print.js'` um `pageRuleFor` erweitern und den
`#print`-Handler so umbauen, dass die Regel vor dem Druck gesetzt und danach entfernt wird:

```js
// Die Seitenvorschrift hängt an der Druckart (pageRuleFor in js/ui/print.js). Sie wird NACH
// dem Druck wieder entfernt – bliebe sie stehen, druckte der nächste Ladeplan im Hochformat.
// `afterprint` kommt in allen Zielbrowsern; der Rückfall im Handler selbst deckt den Fall ab,
// dass der Druckdialog gar nicht erst aufgeht.
function setPrintPage(doc) {
  clearPrintPage();
  const rule = pageRuleFor(doc);
  if (!rule) return;
  const el = document.createElement('style');
  el.id = 'print-page';
  el.textContent = rule;
  document.head.appendChild(el);
}
function clearPrintPage() {
  document.getElementById('print-page')?.remove();
}
window.addEventListener('afterprint', clearPrintPage);
```

Im `#print`-Handler, unmittelbar vor `window.print();`:

```js
  setPrintPage(doc);
  window.print();
```

In `css/print.css` den gesamten Kommentarblock ab „Etiketten (Task 4)“ bis einschließlich der
Zeile `#print-root.doc-labels.size-small .labels { … }` ersetzen durch:

```css
/* Etiketten: Avery-Zweckform-Bögen, A4 HOCH und randlos (die @page-Regel dafür hängt
   js/app.js nur für diese Druckart ein, siehe pageRuleFor in js/ui/print.js).
   - groß  Avery Zweckform 3425, 105×57 mm → 2 Spalten × 5 Zeilen = 10 je Bogen
   - klein Avery Zweckform 3474,  70×37 mm → 3 Spalten × 8 Zeilen = 24 je Bogen
   Beide Raster sind 210 mm breit (2×105 und 3×70) = genau A4-Breite, der Seitenrand links
   und rechts ist damit zwangsläufig 0. Senkrecht bleibt Spiel (297 − 5×57 = 12 mm bzw.
   297 − 8×37 = 1 mm). WIE VIEL davon oben liegt, ist nicht belegt — die öffentlich
   auffindbaren Quellen nennen den oberen Rand nicht. Das Raster wird deshalb zentriert
   (die neutrale Wahl) statt eine Herstellerangabe zu behaupten, die wir nicht haben; ein
   Testbogen zeigt sofort, ob das stimmt, und zu ändern ist dann align-content.
   Kein Schnittrahmen: auf Haftpapier würde er mitgedruckt. */
#print-root.doc-labels .labels {
  display: grid; gap: 0; justify-content: center; align-content: center;
  min-height: 297mm;
}
#print-root.doc-labels.size-large .labels { grid-template-columns: repeat(2, 105mm); grid-auto-rows: 57mm; }
#print-root.doc-labels.size-small .labels { grid-template-columns: repeat(3, 70mm); grid-auto-rows: 37mm; }
```

Und in der Regel `#print-root.doc-labels .tl-label` die Eigenschaft
`border: 0.2mm dashed #999;` streichen.

In `index.html` die beiden Optionen beschriften:

```html
        <option value="large">Etiketten groß – Avery 3425 (105 × 57 mm, 10 je Bogen)</option>
        <option value="small">Etiketten klein – Avery 3474 (70 × 37 mm, 24 je Bogen)</option>
```

- [ ] **Schritt 4: Tests laufen lassen**

Laufen lassen: `npm test`
Erwartet: alles grün, ein Test mehr.

- [ ] **Schritt 5: Im Browser prüfen — echter PDF-Export**

Ein Viewport-Screenshot beweist hier nichts; nur ein echter Seitenauszug zeigt, ob das Raster
aufgeht. Im Szenario:

```js
const r = await p.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
fs.writeFileSync(`${OUT}/etiketten-gross.pdf`, Buffer.from(r.data, 'base64'));
```

`preferCSSPageSize: true` ist wichtig — damit zieht die eingehängte `@page`-Regel. Vor dem
Export in der Seite `setPrintPage('labels')` wirksam machen, also den Druckweg so nachstellen,
wie `#print` ihn geht (Klasse am `#print-root` setzen, `buildLabels` rufen, Regel einhängen).

Ein Load mit 30 Stücken, beide Größen. Beide PDFs selbst ansehen (Read mit `pages`) und im
Bericht beschreiben:
- **groß:** 10 Etiketten auf der ersten Seite, 3 Seiten gesamt, Hochformat,
- **klein:** 24 auf der ersten Seite, 2 Seiten gesamt, Hochformat,
- kein Schnittrahmen, Farbbalken sichtbar, nichts über den Rand.

Danach prüfen, dass die Regel wieder weg ist: nach dem Etikettendruck die Druckart auf
„Ladeplan“ stellen, erneut exportieren und belegen, dass die Seite wieder quer ist.

- [ ] **Schritt 6: Festschreiben**

```bash
git add js/ui/print.js js/app.js css/print.css index.html tests/print.test.js
git commit -m "feat: Etiketten passen auf Avery-Zweckform 3425 und 3474"
```

---

### Aufgabe 4: Doku und Version

**Dateien:**
- Ändern: `README.md` (Abschnitte „Lagen-Durchsicht“ und „Drucken“)
- Ändern: `docs/architektur.md` (Absatz zur Lagen-Durchsicht und zu `js/ui/print.js`)
- Ändern: `docs/offene-punkte.md` (zwei Einträge entfallen, einer kommt dazu)
- Ändern: `js/version.js`, `package.json`, `README.md`, `index.html`, `sw.js`, `CHANGELOG.md`

- [ ] **Schritt 1: `README.md`**

Im Abschnitt „Lagen-Durchsicht“ den Satz „Die Auswahl wirkt nur in den 2D-Ansichten; in 3D
kann man ohnehin umherfahren.“ ersetzen durch:

```markdown
In den 2D-Ansichten werden höhere Lagen blass gezeichnet, in der 3D-Ansicht ganz ausgeblendet
— dort ergibt das einen sauberen Schnitt durch die Ladung. Das ausgewählte Case bleibt in
beiden Fällen sichtbar. Der Ausdruck zeigt immer alle Lagen.
```

Beim Punkt „Etiketten“ den Satz zu den Maßen ersetzen durch:

```markdown
  Zwei Größen zur Wahl, beide auf gängiges Haftpapier abgestimmt: **Avery Zweckform 3425**
  (105 × 57 mm, 10 je Bogen) und **Avery Zweckform 3474** (70 × 37 mm, 24 je Bogen). Diese
  beiden Druckarten gehen auf A4 hoch und randlos; Ladeplan und Abhakliste bleiben A4 quer.
  Vor dem ersten Bogen einen Testdruck auf normalem Papier machen und gegen einen
  Etikettenbogen halten — der senkrechte Rand ist nicht aus Herstellerangaben belegt.
```

Den Satz „Alle drei drucken auf A4 quer.“ streichen.

- [ ] **Schritt 2: `docs/architektur.md`**

Im Absatz zur Lagen-Durchsicht den Satz ab „**Bewusst nur in 2D:**“ bis zum Ende des Absatzes
ersetzen durch:

```markdown
In 3D werden solche Stücke **ausgeblendet** statt blass gezeichnet (`js/ui/view3d.js`,
`update()` überspringt sie): Materialien liegen dort nach Farbe im Zwischenspeicher und die
Profilstäbe laufen als ein einziges `InstancedMesh` über alle Cases — eine Transparenz je
Stück hieße, beides zu verdoppeln und zu trennen. Welche Stücke betroffen sind, entscheidet
in beiden Ansichten dieselbe Funktion `aboveLayer()` in `js/model/validate.js`, damit sie
nicht auseinanderlaufen; das ausgewählte Stück ist dort immer ausgenommen.
```

Im Absatz zu `js/ui/print.js` ans Ende anfügen:

```markdown
Die Seitenvorschrift hängt an der Druckart: `pageRuleFor(doc)` liefert für Etiketten
`@page { size: A4 portrait; margin: 0 }`, sonst `null`. `js/app.js` hängt die Regel vor
`window.print()` als `<style id="print-page">` ein und entfernt sie im `afterprint` wieder —
benannte Seiten (`@page x { … }` + `page:`) wären der direktere Weg, werden aber von Browsern
uneinheitlich unterstützt.
```

- [ ] **Schritt 3: `docs/offene-punkte.md`**

Die beiden Einträge streichen, die jetzt erledigt sind: „Die Lagen-Durchsicht (V 0.9.0) gibt
es nur in 2D …“ und „Die Etikettenmaße (105 × 57 mm, 70 × 37 mm) sind frei metrisch gewählt
…“. Stattdessen aufnehmen:

```markdown
- Der senkrechte Rand der Avery-Bögen 3425 und 3474 ist nicht aus Herstellerangaben belegt —
  die öffentlich auffindbaren Quellen nennen ihn nicht. Das Etikettenraster wird deshalb
  senkrecht zentriert. Waagerecht ist es eindeutig (2 × 105 = 3 × 70 = 210 mm = A4-Breite).
  Sitzt der Druck auf einem echten Bogen daneben, ist `align-content` in `css/print.css` die
  Stellschraube.
- Andere Haftpapier-Formate als 3425 und 3474 gibt es nicht. Ein weiteres Format braucht einen
  Eintrag in `#print-label-size`, eine Rasterregel in `css/print.css` und dessen Maße.
```

- [ ] **Schritt 4: Version auf 0.9.1**

`0.9.0` → `0.9.1` in: `js/version.js`, `package.json`, `index.html` (`#app-version`),
`README.md` (Zeile 3), `sw.js` (Cache-Name). Neuer CHANGELOG-Eintrag oben:

```markdown
## V 0.9.1 – 2026-10-04

Zwei Entscheidungen aus V 0.9.0 nachgezogen.

- **Lagen-Durchsicht jetzt auch in 3D:** höhere Lagen werden dort ausgeblendet statt blass
  gezeichnet — ein sauberer Schnitt durch die Ladung. Das ausgewählte Case bleibt sichtbar.
  Welche Stücke betroffen sind, entscheidet in 2D und 3D dieselbe Regel.
- **Etiketten passen auf Haftpapier:** Avery Zweckform 3425 (105 × 57 mm, 10 je Bogen) und
  3474 (70 × 37 mm, 24 je Bogen). Diese Druckart geht dafür auf A4 hoch und randlos, der
  Schnittrahmen entfällt. Ladeplan und Abhakliste bleiben A4 quer. Der senkrechte Rand ist
  nicht aus Herstellerangaben belegt und zentriert — vor dem ersten Bogen einen Testdruck
  gegen einen Etikettenbogen halten.
```

Kein Git-Tag (Patch-Stand).

- [ ] **Schritt 5: Prüfen und festschreiben**

Laufen lassen: `npm test` (`tests/version.test.js` erzwingt die sechs Stellen).
Typografie prüfen — jede geänderte Datei muss `0 []` zeigen:

```bash
python3 -c "
import re,sys
for p in sys.argv[1:]:
    s=open(p,encoding='utf-8').read(); print(p, s.count(chr(0x201d)), re.findall(chr(0x201e)+'[^'+chr(0x201c)+chr(0x201d)+'\"\n]*\"',s))" README.md docs/architektur.md docs/offene-punkte.md CHANGELOG.md
```

```bash
git add -A
git commit -m "chore: Version 0.9.1 – Lagen-Durchsicht in 3D, Avery-Etiketten"
```

---

## Abnahme

- `npm test` grün.
- Die Aufnahmen aus Aufgabe 2 und die PDFs aus Aufgabe 3 selbst angesehen; nur Aufnahmen
  zählen, auf denen das Geprüfte zu sehen ist.
- Was **nicht** maschinell abgenommen werden kann: ob der Druck auf einem echten Avery-Bogen
  deckungsgleich sitzt. Das muss der Nutzer mit einem Testbogen prüfen — ausdrücklich so im
  Bericht sagen, nicht als erledigt ausgeben.
