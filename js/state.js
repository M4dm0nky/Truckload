export function createStore(initial, { limit = 50 } = {}) {
  let state = initial;
  let past = [], future = [];
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn(state));
  const pushPast = () => { past = [...past, state.plan].slice(-limit); future = []; };

  return {
    get: () => state,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    update(fn, { history = false } = {}) {
      const next = fn(state);
      if (next === state) return;
      if (history && next.plan !== state.plan) pushPast();
      state = next;
      emit();
    },
    checkpoint: pushPast,
    undo() {
      if (!past.length) return;
      future = [state.plan, ...future];
      state = { ...state, plan: past.at(-1) };
      past = past.slice(0, -1);
      emit();
    },
    redo() {
      if (!future.length) return;
      past = [...past, state.plan];
      state = { ...state, plan: future[0] };
      future = future.slice(1);
      emit();
    },
    resetHistory() { past = []; future = []; },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
  };
}
