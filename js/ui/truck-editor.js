import { showConfirm } from './confirmDialog.js';
import { NAME_MAX } from '../model/limits.js';
import { t } from '../i18n/i18n.js';

export async function openTruckEditor(dlg, truck, { usedIn = 0 } = {}) {
  if (dlg.open) { // close() feuert `close` asynchron – erst abwarten (Listener vor close() anhängen), sonst trifft das alte Ereignis den neuen Listener
    const closed = new Promise(r => dlg.addEventListener('close', r, { once: true }));
    dlg.returnValue = 'cancel'; dlg.close();
    await closed;
  }
  const isNew = !truck || truck.builtin;
  const arch = truck?.wheelArches?.[0];
  dlg.innerHTML = `
    <form method="dialog" class="editor">
      <h2>${isNew ? t('Neues Fahrzeug') : t('Fahrzeug bearbeiten')}</h2>
      ${truck?.builtin ? `<p class="hint">${t('Vorlage (Richtwert) – Speichern legt ein eigenes Fahrzeug an.')}</p>` : ''}
      <label>${t('Name')}<input name="name" required maxlength="${NAME_MAX}" placeholder="${t('z. B. Firmen-7,5-Tonner')}"></label>
      <fieldset><legend>${t('Laderaum innen (cm)')}</legend>
        <div class="row"><label>${t('Länge')}<input type="number" name="l" min="50" max="2000" required></label>
        <label>${t('Breite')}<input type="number" name="w" min="50" max="300" required></label>
        <label>${t('Höhe')}<input type="number" name="h" min="50" max="400" required></label></div>
      </fieldset>
      <label>${t('Nutzlast (kg)')}<input type="number" name="payload" min="1" required></label>
      <label class="check"><input type="checkbox" name="arches"> ${t('Radkästen im Laderaum (beidseitig)')}</label>
      <div class="row arch-fields">
        <label>${t('ab Stirnwand')}<input type="number" name="ax" min="0"></label>
        <label>${t('Länge')}<input type="number" name="al" min="1"></label>
        <label>${t('Breite')}<input type="number" name="aw" min="1"></label>
        <label>${t('Höhe')}<input type="number" name="ah" min="1"></label>
      </div>
      <menu>
        <button value="delete" class="danger" formnovalidate ${isNew ? 'hidden' : ''}>${t('Löschen')}</button>
        <span class="grow"></span>
        <button value="cancel" formnovalidate>${t('Abbrechen')}</button>
        <button value="save" class="primary">${t('Speichern')}</button>
      </menu>
    </form>`;
  const f = dlg.querySelector('form').elements;
  f.name.value = truck ? (truck.builtin ? t('{name} (eigenes)', { name: truck.name }) : truck.name) : '';
  for (const k of ['l', 'w', 'h', 'payload']) f[k].value = truck?.[k] ?? '';
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
        const msg = usedIn ? t('„{name}“ wird in {used} Ladeplan/-plänen verwendet. Trotzdem löschen?', { name: truck.name, used: usedIn }) : t('„{name}“ löschen?', { name: truck.name });
        showConfirm(msg, { okLabel: t('Löschen'), danger: true }).then(ok => resolve(ok ? { action: 'delete' } : null));
        return;
      }
      if (act !== 'save') return resolve(null);
      const wheelArches = f.arches.checked && f.ax.value !== ''
        ? [{ x: +f.ax.value, l: +f.al.value, w: +f.aw.value, h: +f.ah.value, side: 'both' }] : [];
      resolve({ action: 'save', value: {
        id: isNew ? crypto.randomUUID() : truck.id, builtin: false,
        name: f.name.value.trim(), l: +f.l.value, w: +f.w.value, h: +f.h.value,
        payload: +f.payload.value, wheelArches,
      } });
    }, { once: true });
    dlg.returnValue = '';
    dlg.showModal();
  });
}
