// Tastenkürzel des Plan-Bildschirms. `keyFor` ist rein (Tastenereignis -> Aktionsname),
// `attachKeyboard` hängt den Handler ans Dokument. Kein Import von js/app.js.

const LETTER_ACTIONS = { r: 'rotate', t: 'tip', w: 'wheel-face', d: 'dup', Delete: 'delete', Backspace: 'delete' };
const ARROWS = {
  ArrowLeft: ['move-left', -1, 0], ArrowRight: ['move-right', 1, 0],
  ArrowUp: ['move-up', 0, 1], ArrowDown: ['move-down', 0, -1],
};
const MOVES = Object.fromEntries(Object.values(ARROWS).map(([name, dx, dy]) => [name, [dx, dy]]));

// Pfeil-Schrittweite in cm: 5, mit ⇧ fein 1.
export const stepFor = e => (e.shiftKey ? 1 : 5);

// Tastenereignis -> Aktionsname oder null. Eingabefelder und offene Dialoge (`dialogOpen`)
// bekommen keine Kürzel. `e.target` kann das Dokument selbst sein (kein `closest`).
export function keyFor(e, { dialogOpen = false } = {}) {
  if (dialogOpen || e.target?.closest?.('input, textarea, select')) return null;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (e.key === 'Escape') return 'deselect';
  const act = LETTER_ACTIONS[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (act && !mod) return act;
  return ARROWS[e.key]?.[0] ?? null;
}

// `actions`: undo(), redo(), deselect(), je Auswahl-Aktion (rotate, tip, 'wheel-face', dup, delete)
// name(id) und move(id, dx, dy, step). Aktiv nur, wenn screenOf(getState()) 'plan' ist.
export function attachKeyboard({ getState, screenOf, actions, doc = document }) {
  doc.addEventListener('keydown', e => {
    const s = getState();
    if (screenOf(s) !== 'plan') return;
    const name = keyFor(e, { dialogOpen: !!doc.querySelector('dialog[open]') });
    if (!name) return;
    if (name === 'undo' || name === 'redo') { e.preventDefault(); return actions[name](); }
    if (name === 'deselect') return actions.deselect();
    const id = s.selectedId;
    if (name in MOVES) {
      if (!id) return;
      e.preventDefault();
      return actions.move(id, ...MOVES[name], stepFor(e));
    }
    e.preventDefault();
    if (id) actions[name](id);
  });
}
