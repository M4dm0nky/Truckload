// Zeichenbreiten-SCHÄTZUNG für 2D (Rückfall ohne Canvas) und 3D (Etikett-Umbruch), s. labelTexture.js.
export const CHAR_ASPECT = 0.56; // grobe Zeichenbreite je Schriftgröße (Sans-Serif-Schätzung, keine echte Font-Metrik)

export const estimateTextWidth = (text, fontSize) => String(text).length * fontSize * CHAR_ASPECT;
