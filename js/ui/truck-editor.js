export function openTruckEditor(dlg, t, { usedIn = 0 } = {}) {
  const isNew = !t || t.builtin;
  const arch = t?.wheelArches?.[0];
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? 'Neues Fahrzeug' : 'Fahrzeug bearbeiten'}</h2>
      ${t?.builtin ? '<p class="hint">Vorlage (Richtwert) – Speichern legt ein eigenes Fahrzeug an.</p>' : ''}
      <label>Name<input name="name" required maxlength="80" placeholder="z. B. Firmen-7,5-Tonner"></label>
      <fieldset><legend>Laderaum innen (cm)</legend>
        <div class="row"><label>Länge<input type="number" name="l" min="50" max="2000" required></label>
        <label>Breite<input type="number" name="w" min="50" max="300" required></label>
        <label>Höhe<input type="number" name="h" min="50" max="400" required></label></div>
      </fieldset>
      <label>Nutzlast (kg)<input type="number" name="payload" min="1" required></label>
      <label class="check"><input type="checkbox" name="arches"> Radkästen im Laderaum (beidseitig)</label>
      <div class="row arch-fields">
        <label>ab Stirnwand<input type="number" name="ax" min="0"></label>
        <label>Länge<input type="number" name="al" min="1"></label>
        <label>Breite<input type="number" name="aw" min="1"></label>
        <label>Höhe<input type="number" name="ah" min="1"></label>
      </div>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>Löschen</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>Abbrechen</button>
        <button value="save" class="primary">Speichern</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = t ? (t.builtin ? `${t.name} (eigenes)` : t.name) : '';
  for (const k of ['l', 'w', 'h', 'payload']) f[k].value = t?.[k] ?? '';
  f.arches.checked = !!arch;
  [f.ax.value, f.al.value, f.aw.value, f.ah.value] = arch ? [arch.x, arch.l, arch.w, arch.h] : ['', 100, 22, 30];
  const sync = () => {
    dlg.querySelector('.arch-fields').hidden = !f.arches.checked;
    for (const k of ['ax', 'al', 'aw', 'ah']) f[k].required = f.arches.checked;
  };
  f.arches.addEventListener('change', sync); sync();

  return new Promise(resolve => {
    dlg.addEventListener('close', () => {
      const act = dlg.returnValue;
      if (act === 'delete') {
        const msg = usedIn ? `„${t.name}“ wird in ${usedIn} Ladeplan/-plänen verwendet. Trotzdem löschen?` : `„${t.name}“ löschen?`;
        return resolve(confirm(msg) ? { action: 'delete' } : null);
      }
      if (act !== 'save') return resolve(null);
      const wheelArches = f.arches.checked && f.ax.value !== ''
        ? [{ x: +f.ax.value, l: +f.al.value, w: +f.aw.value, h: +f.ah.value, side: 'both' }] : [];
      resolve({ action: 'save', value: {
        id: isNew ? crypto.randomUUID() : t.id, builtin: false,
        name: f.name.value.trim(), l: +f.l.value, w: +f.w.value, h: +f.h.value,
        payload: +f.payload.value, wheelArches,
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
