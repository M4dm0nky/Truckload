// Gestaltungs-Schnittstelle (docs/nyx-host.md, „Gestaltung“): die Tokens, die ein Host wie NYX
// setzen darf. NYX liest diese Datei in einer Drift-Sperre — wer hier einen Token ergänzt,
// erhöht THEME_VERSION, hängt ihn HINTEN an (neue Tokens hinten anhängen; NYX vergleicht die Menge),
// trägt ihn in css/app.css (in :root; in die Modus-Blöcke nur, wenn der Wert je Modus abweicht)
// und in docs/nyx-host.md ein. Umbenennen oder Entfernen bricht NYX.
export const THEME_VERSION = 3;
export const THEME_TOKENS = [
  '--tl-bg', '--tl-surface', '--tl-raised', '--tl-input', '--tl-line', '--tl-text', '--tl-text-muted',
  '--tl-accent', '--tl-on-accent', '--tl-selection', '--tl-danger', '--tl-ok', '--tl-truck', '--tl-grid',
  '--tl-font', '--tl-font-display', '--tl-radius', '--tl-focus',
  // Version 2
  '--tl-control-height', '--tl-control-height-sm', '--tl-control-font-size', '--tl-control-font-size-sm',
  '--tl-button-pad', '--tl-button-pad-sm', '--tl-field-pad', '--tl-field-pad-sm',
  '--tl-button-weight', '--tl-button-primary-weight', '--tl-button-bg', '--tl-button-hover-bg',
  '--tl-button-hover-border', '--tl-selected-bg', '--tl-selected-text', '--tl-selected-border',
  '--tl-marked-border', '--tl-dialog-radius', '--tl-dialog-pad', '--tl-dialog-title-size',
  '--tl-dialog-divider', '--tl-backdrop', '--tl-warn', '--tl-warn-text',
  '--tl-control-border', '--tl-font-size', '--tl-hint-font-size',
  '--tl-line-height', '--tl-font-size-xs', '--tl-font-size-sm', '--tl-font-size-lg',
  // Version 3
  '--tl-segment-joined',
];
