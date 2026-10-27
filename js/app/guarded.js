import { t } from '../i18n/i18n.js';

// Eine Speicheraktion mit genau einer Fehlermeldung. Ersetzt die gleichförmigen
// try/catch + showAlert-Blöcke: bei einem Fehler erscheint „<label>: <Meldung>“, sonst nichts.
// Kein Import von js/app.js; `showAlert` kommt als Parameter.
export async function guarded(label, fn, { showAlert }) {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    await showAlert(`${label}: ${err?.message ?? t('unbekannter Fehler')}`);
    return { ok: false, value: undefined };
  }
}
