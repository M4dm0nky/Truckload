// Gemeinsamer Datei-Download (Sicherung und Sammlungsexport). Kein Import von js/app.js.
export function downloadJSON(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
