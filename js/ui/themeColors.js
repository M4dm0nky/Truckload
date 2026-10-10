// Bedeutungsfarben der 3D-Ansicht aus den Gestaltungs-Tokens (docs/nyx-host.md). Ohne DOM: der
// Aufrufer reicht eine Lesefunktion herein, deshalb unter node --test prüfbar. Gegenstandsfarben
// (Alu, Räder, Case-Schwarz) gehören bewusst nicht dazu.
export const FALLBACK = Object.freeze({ bg: '#0f172a', selection: '#f0a500', danger: '#dc2626' });

const lies = (getVar, name, fallback) => {
  const v = getVar(name);
  const t = typeof v === 'string' ? v.trim() : '';
  return t || fallback;
};

export function readThemeColors(getVar) {
  return {
    bg: lies(getVar, '--tl-bg', FALLBACK.bg),
    selection: lies(getVar, '--tl-selection', FALLBACK.selection),
    danger: lies(getVar, '--tl-danger', FALLBACK.danger),
  };
}
