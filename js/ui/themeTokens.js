// Gestaltungs-Schnittstelle (docs/nyx-host.md, „Gestaltung“): die Tokens, die ein Host wie NYX
// setzen darf. NYX liest diese Datei in einer Drift-Sperre — wer hier einen Token ergänzt,
// erhöht THEME_VERSION, trägt ihn in css/app.css (:root, Hellmodus, beide data-theme-Blöcke) und
// in docs/nyx-host.md ein. Umbenennen oder Entfernen bricht NYX.
export const THEME_VERSION = 1;
export const THEME_TOKENS = [
  '--tl-bg', '--tl-surface', '--tl-raised', '--tl-input', '--tl-line', '--tl-text', '--tl-text-muted',
  '--tl-accent', '--tl-on-accent', '--tl-selection', '--tl-danger', '--tl-ok', '--tl-truck', '--tl-grid',
  '--tl-font', '--tl-font-display', '--tl-radius', '--tl-focus',
];
