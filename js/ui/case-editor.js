import { CATEGORIES, colorFor } from '../data/categories.js';

const DEFAULTS = { name: '', content: '', category: 'Sonstiges', l: 120, w: 60, h: 60, weight: 50,
  tippable: true, stackable: true, maxTopLoad: null, stock: null };

export function openCaseEditor(dlg, c, { usedIn = 0 } = {}) {
  const v = { ...DEFAULTS, color: colorFor('Sonstiges'), ...(c ?? {}) };
  const isNew = !c || c.builtin;
  const dim = n => `type="number" name="${n}" min="1" max="2000" step="0.5" required`;
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neues Case' : 'Case bearbeiten'}</h2>
      ${c?.builtin ? '<p class="hint">Vorlage (Richtwert) – Speichern legt eine eigene Kopie an.</p>' : ''}
      <label>Name<input name="name" required maxlength="80" placeholder="z. B. Kabelcase Strom 1"></label>
      <label>Inhalt<textarea name="content" rows="3" placeholder="z. B. 10× Schuko 10 m, 4× CEE 32 A 25 m"></textarea></label>
      <div class="row">
        <label>Gewerk<select name="category">${CATEGORIES.map(k => `<option>${k.name}</option>`).join('')}</select></label>
        <label>Farbe<input type="color" name="color"></label>
      </div>
      <fieldset><legend>Maße stehend, inkl. Rollen (cm)</legend>
        <div class="row"><label>Länge<input ${dim('l')}></label><label>Breite<input ${dim('w')}></label><label>Höhe<input ${dim('h')}></label></div>
      </fieldset>
      <div class="row">
        <label>Gewicht beladen (kg)<input type="number" name="weight" min="0" step="0.5" required></label>
        <label>Bestand (Stück)<input type="number" name="stock" min="0" step="1"></label>
      </div>
      <label class="check"><input type="checkbox" name="tippable"> kippbar (darf auf die Seite gelegt werden)</label>
      <label class="check"><input type="checkbox" name="stackable"> stapelbar (darf etwas obendrauf)</label>
      <label>Max. Last obendrauf (kg, leer = unbegrenzt)<input type="number" name="maxTopLoad" min="0" step="1"></label>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = c?.builtin ? `${v.name} (eigenes)` : v.name;
  f.content.value = v.content;
  f.category.value = v.category;
  f.color.value = v.color;
  for (const k of ['l', 'w', 'h', 'weight']) f[k].value = v[k];
  f.stock.value = v.stock ?? '';
  f.maxTopLoad.value = v.maxTopLoad ?? '';
  f.tippable.checked = v.tippable;
  f.stackable.checked = v.stackable;
  f.category.addEventListener('change', () => {
    if (f.color.value === colorFor(v.category) || f.color.value === colorFor(f.category.dataset.prev ?? v.category))
      f.color.value = colorFor(f.category.value);
    f.category.dataset.prev = f.category.value;
  });

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') {
        const msg = usedIn ? `„${v.name}“ wird in ${usedIn} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${v.name}“ löschen?`;
        return resolve(confirm(msg) ? { action: 'delete' } : null);
      }
      if (act !== 'save') return resolve(null);
      const numOrNull = s => (s === '' ? null : Number(s));
      resolve({ action: 'save', value: {
        ...v,
        id: isNew ? crypto.randomUUID() : v.id,
        builtin: false, note: undefined,
        name: f.name.value.trim(), content: f.content.value.trim(),
        category: f.category.value, color: f.color.value,
        l: Number(f.l.value), w: Number(f.w.value), h: Number(f.h.value),
        weight: Number(f.weight.value), stock: numOrNull(f.stock.value),
        maxTopLoad: numOrNull(f.maxTopLoad.value),
        tippable: f.tippable.checked, stackable: f.stackable.checked,
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
