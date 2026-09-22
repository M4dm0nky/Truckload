import { archBoxes } from '../model/validate.js';
import { caseShape, wheelAxes } from '../model/caseShape.js';
import { caseColors, CASE_BLACK, DETAIL_MIN } from './caseStyle.js';
import { isTruss, trussShape, TUBE_R_RATIO, DIAG_R_RATIO } from '../model/truss.js';
import { composeMatrix, IDENTITY_QUAT } from './instanceMatrix.js';
import { labelPlanes, fitFontSize } from './labelTexture.js';

const DOLLY_MARK_W = 4; // cm, Breite der Gewerk-/Stückfarb-Markierung auf dem Traversen-Rollbrett

export async function createView3d(container) {
  const THREE = await import('three');
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

  container.replaceChildren();
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#15181d');
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);
  camera.up.set(0, 0, 1); // Truck-Koordinaten: z = oben
  scene.add(new THREE.HemisphereLight(0xffffff, 0x606060, 3));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
  sun.position.set(2000, -1500, 2500);
  scene.add(sun);
  const controls = new OrbitControls(camera, renderer.domElement);
  const content = new THREE.Group();
  scene.add(content);

  const render = () => renderer.render(scene, camera);
  controls.addEventListener('change', render);
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  // Geteilte Geometrien (nie disposen) – jede Box/Kugel/Rolle ist ein skalierter Einheits-Body.
  const GEO_BOX = new THREE.BoxGeometry(1, 1, 1);
  const GEO_BOX_EDGES = new THREE.EdgesGeometry(GEO_BOX);
  const GEO_SPHERE = new THREE.SphereGeometry(2.5, 16, 12);
  const GEO_CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
  const GEO_PLANE = new THREE.PlaneGeometry(1, 1);
  for (const g of [GEO_BOX, GEO_BOX_EDGES, GEO_SPHERE, GEO_CYL, GEO_PLANE]) g.userData.shared = true;

  const shared = mat => { mat.userData.shared = true; return mat; };
  const MAT_FLOOR = shared(new THREE.MeshLambertMaterial({ color: 0x9aa1aa }));
  const MAT_ROOM_EDGE = shared(new THREE.LineBasicMaterial({ color: 0x8b95a3 }));
  const MAT_FRONT = shared(new THREE.MeshLambertMaterial({ color: 0xf0a500, transparent: true, opacity: 0.35 }));
  const MAT_ARCH = shared(new THREE.MeshLambertMaterial({ color: 0x444a52 }));
  const ALU_HEX = '#c9ced4';
  const MAT_ALU = shared(new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.25, roughness: 0.45 }));
  const MAT_CORNER = shared(new THREE.MeshStandardMaterial({ color: 0xd6dbe1, metalness: 0.5, roughness: 0.4 }));
  const MAT_WHEEL = shared(new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 }));
  const MAT_HUB = shared(new THREE.MeshStandardMaterial({ color: 0xd0d5db, metalness: 0.4, roughness: 0.5 }));
  const MAT_EDGE_ALU = shared(new THREE.LineBasicMaterial({ color: 0xb8bec6 }));
  const MAT_EDGE_SEL = shared(new THREE.LineBasicMaterial({ color: 0xf0a500 }));
  const MAT_EDGE_ERR = shared(new THREE.LineBasicMaterial({ color: 0xe5484d }));

  // Flightcase-Look: Alu-Profilstäbe (je Sorte ein InstancedMesh, Farbe je Instanz für Auswahl/Fehler),
  // Kugelecken, Deckelfuge/Butterfly-Verschlüsse, Schalengriffe.
  const MAT_PROFILE = shared(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.25, roughness: 0.45 }));
  const MAT_CHROME = shared(new THREE.MeshStandardMaterial({ color: 0xe6e9ec, metalness: 0.4, roughness: 0.25 }));
  const MAT_SEAM_BAND = shared(new THREE.MeshStandardMaterial({ color: 0xc9ced4, metalness: 0.25, roughness: 0.45 }));
  const MAT_HANDLE_SHELL = shared(new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.85 }));
  // Traversen-Rollbrett: Kunststoff-Platte (schwarz) mit etwas helleren Auflageleisten obenauf.
  const MAT_DOLLY_BOARD = shared(new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.85 }));
  const MAT_DOLLY_RAIL = shared(new THREE.MeshStandardMaterial({ color: 0x33363b, roughness: 0.8 }));
  const COL_PROFILE_N = new THREE.Color(0xc9ced4);
  const COL_PROFILE_SEL = new THREE.Color(0xf0a500);
  const COL_PROFILE_BAD = new THREE.Color(0xe5484d);

  // Feine Körnung für den Laminat-Korpus – einmal prozedural erzeugt, geteilt über alle Cases.
  function makeLaminateTexture() {
    const size = 64;
    const cnv = document.createElement('canvas');
    cnv.width = cnv.height = size;
    const ctx = cnv.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = 128 + (Math.random() - 0.5) * 50;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cnv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 3);
    tex.userData.shared = true;
    return tex;
  }
  const LAM_TEX = makeLaminateTexture();

  // Beschriftungs-Texturen: pro einzigartiger Kombination aus Text, Farbe und Seitenverhältnis
  // eine Canvas-Textur (Text mittig über `fitFontSize()` umgebrochen/skaliert), gecacht über
  // Updates hinweg. Material + Textur sind `userData.shared`, damit `clear()` sie nicht mit den
  // Case-Meshes verwirft – nicht mehr benutzte Einträge werden am Ende von `update()` selbst
  // disposed (siehe `usedLabelKeys`).
  const labelTexCache = new Map(); // JSON.stringify([text, farbe, ratioBucket]) -> { material, texture }
  let usedLabelKeys = new Set();
  function textColorFor(hex) {
    const s = String(hex || CASE_BLACK).replace('#', '');
    const full = s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s.padStart(6, '0').slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16) || 0, g = parseInt(full.slice(2, 4), 16) || 0, b = parseInt(full.slice(4, 6), 16) || 0;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.55 ? '#111214' : '#f5f5f5';
  }
  const LABEL_PAD = 0.85; // 15% Rand verhindert, dass Text bis an die Kante reicht.
  const LABEL_TEX_W = 256; // px, feste Basisbreite der Textur
  // Die Textur wird für die reale Fläche (`width`×`height`, cm) erzeugt statt für ein Quadrat –
  // eine feste 40×40-Vorlage, über die tatsächliche (oft nicht-quadratische) Fläche gestreckt,
  // verzerrt sowohl den Zeilenumbruch als auch die Buchstaben (s. Befund I1). Das Seitenverhältnis
  // geht gerundet (auf 0,25) in den Cache-Schlüssel ein, damit nicht jede Case-Größe eine eigene
  // Textur bekommt.
  function labelTextureFor(text, color, width, height) {
    const ratio = Math.min(4, Math.max(0.25, Math.round((width / height) / 0.25) * 0.25));
    const key = JSON.stringify([text, color, ratio]);
    usedLabelKeys.add(key);
    let entry = labelTexCache.get(key);
    if (entry) return entry;
    const cnv = document.createElement('canvas');
    cnv.width = LABEL_TEX_W;
    cnv.height = Math.max(1, Math.round(LABEL_TEX_W / ratio));
    const ctx = cnv.getContext('2d');
    const { fontSize, lines } = fitFontSize(text, width * LABEL_PAD, height * LABEL_PAD);
    const scale = cnv.width / width; // px je cm
    const px = fontSize * scale;
    ctx.fillStyle = textColorFor(color);
    ctx.font = `700 ${px}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineH = px * 1.15;
    let y = cnv.height / 2 - ((lines.length - 1) * lineH) / 2;
    for (const l of lines) { ctx.fillText(l, cnv.width / 2, y); y += lineH; }
    const texture = shared(new THREE.CanvasTexture(cnv));
    const material = shared(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    entry = { material, texture };
    labelTexCache.set(key, entry);
    return entry;
  }
  // Orthonormale Basis (right = up × normal) aus einer `labelPlanes()`-Fläche – Text steht damit
  // immer aufrecht/unverzerrt, ohne Spiegelung (right×up ergibt wieder die Normale).
  const labelNormalV = new THREE.Vector3();
  const labelUpV = new THREE.Vector3();
  const labelRightV = new THREE.Vector3();
  const labelBasisM = new THREE.Matrix4();
  function labelMesh(pl, text, color) {
    const w = Math.max(pl.width, 0.001), h = Math.max(pl.height, 0.001);
    const { material } = labelTextureFor(text, color, w, h);
    labelNormalV.set(pl.normal.x, pl.normal.y, pl.normal.z);
    labelUpV.set(pl.up.x, pl.up.y, pl.up.z);
    labelRightV.crossVectors(labelUpV, labelNormalV).normalize();
    labelBasisM.makeBasis(labelRightV, labelUpV, labelNormalV);
    const mesh = new THREE.Mesh(GEO_PLANE, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(pl.center.x, pl.center.y, pl.center.z);
    mesh.quaternion.setFromRotationMatrix(labelBasisM);
    return mesh;
  }

  // Korpus-/Band-Materialien pro Farbe gecacht (Case-Farbe wechselt selten, nie disposen).
  const bodyMatCache = new Map();
  const bodyMaterial = (color, bad) => {
    const key = `${color}|${bad}`;
    let m = bodyMatCache.get(key);
    if (!m) {
      m = shared(new THREE.MeshStandardMaterial({
        color, roughness: 0.7, emissive: bad ? 0x661111 : 0x000000,
        bumpMap: LAM_TEX, bumpScale: 0.12,
      }));
      bodyMatCache.set(key, m);
    }
    return m;
  };
  const bandMatCache = new Map();
  const bandMaterial = color => {
    let m = bandMatCache.get(color);
    if (!m) { m = shared(new THREE.MeshStandardMaterial({ color, roughness: 0.6 })); bandMatCache.set(color, m); }
    return m;
  };

  const boxMesh = (b, material) => {
    const m = new THREE.Mesh(GEO_BOX, material);
    m.scale.set(Math.max(b.x1 - b.x0, 0.001), Math.max(b.y1 - b.y0, 0.001), Math.max(b.z1 - b.z0, 0.001));
    m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return m;
  };
  const edges = (b, material) => {
    const l = new THREE.LineSegments(GEO_BOX_EDGES, material);
    l.scale.set(Math.max(b.x1 - b.x0, 0.001), Math.max(b.y1 - b.y0, 0.001), Math.max(b.z1 - b.z0, 0.001));
    l.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return l;
  };
  const cornerSpheres = b => {
    const out = [];
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) {
      const s = new THREE.Mesh(GEO_SPHERE, MAT_CORNER);
      s.position.set(x, y, z);
      out.push(s);
    }
    return out;
  };

  // Rolle im Rollenschacht w (Höhe wh entlang der Normalen n, Fußabdruck d×d in a1/a2):
  // Schwenkplatte an der Karosserieseite, Gabel (2 Bleche) hinunter zur Achse, Rad + Nabe.
  function wheelMesh(w, face) {
    const [a1, a2, n] = wheelAxes(face);
    const n0 = w[`${n}0`], n1 = w[`${n}1`];
    const wh = n1 - n0;
    const outerN = face === 'bottom' ? n0 : (face[0] === '+' ? n1 : n0);
    const innerN = outerN === n0 ? n1 : n0;
    const towardOuter = outerN > innerN ? 1 : -1; // Richtung von der Karosserie zur Rollen-Außenseite

    const r = wh * 0.42, t = r * 0.8;
    const centerN = outerN - towardOuter * r; // r nach innen von der Außenfläche – berührt sie nur tangential

    const a1_0 = w[`${a1}0`], a1_1 = w[`${a1}1`];
    const a2_0 = w[`${a2}0`], a2_1 = w[`${a2}1`];
    const mkBox = (a1r, a2r, nr) => ({
      [`${a1}0`]: a1r[0], [`${a1}1`]: a1r[1],
      [`${a2}0`]: a2r[0], [`${a2}1`]: a2r[1],
      [`${n}0`]: Math.min(nr[0], nr[1]), [`${n}1`]: Math.max(nr[0], nr[1]),
    });

    const plate = mkBox([a1_0, a1_1], [a2_0, a2_1], [innerN, innerN + towardOuter * 1.2]);
    const forkA = mkBox([a1_0, a1_0 + 0.8], [a2_0, a2_1], [innerN, centerN]);
    const forkB = mkBox([a1_1 - 0.8, a1_1], [a2_0, a2_1], [innerN, centerN]);

    const pos = { x: 0, y: 0, z: 0 };
    pos[a1] = (a1_0 + a1_1) / 2;
    pos[a2] = (a2_0 + a2_1) / 2;
    pos[n] = centerN;

    const wheelCyl = new THREE.Mesh(GEO_CYL, MAT_WHEEL);
    wheelCyl.scale.set(r, t, r);
    const hubCyl = new THREE.Mesh(GEO_CYL, MAT_HUB);
    hubCyl.scale.set(r * 0.5, t * 1.15, r * 0.5);
    if (a1 === 'x') { wheelCyl.rotation.z = Math.PI / 2; hubCyl.rotation.z = Math.PI / 2; }
    wheelCyl.position.set(pos.x, pos.y, pos.z);
    hubCyl.position.copy(wheelCyl.position);

    return [boxMesh(plate, MAT_ALU), boxMesh(forkA, MAT_ALU), boxMesh(forkB, MAT_ALU), wheelCyl, hubCyl];
  }

  // Die 12 Kanten eines Korpus als Alu-Profilstäbe (3×3 cm, leicht über die Flächen hinausstehend).
  function edgeBars(b, out) {
    const t = 1.5, ext = 0.3;
    for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1])
      out.push({ x0: b.x0 - ext, x1: b.x1 + ext, y0: y - t, y1: y + t, z0: z - t, z1: z + t });
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1])
      out.push({ x0: x - t, x1: x + t, y0: b.y0 - ext, y1: b.y1 + ext, z0: z - t, z1: z + t });
    for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1])
      out.push({ x0: x - t, x1: x + t, y0: y - t, y1: y + t, z0: b.z0 - ext, z1: b.z1 + ext });
  }

  // Butterfly-Verschlüsse auf dem Deckelfuge-Band: 2 auf den Längsseiten (y0/y1), 1 auf jeder
  // Stirnseite (x0/x1) – analog zur 2D-Darstellung (Ansicht 'side'/'rear').
  function latchBoxes(b, zSeam, out) {
    const hw = 2, d = 0.9, hh = 1.5;
    for (const fx of [0.25, 0.75]) {
      const cx = b.x0 + (b.x1 - b.x0) * fx;
      out.push({ x0: cx - hw, x1: cx + hw, y0: b.y0 - d, y1: b.y0 + 0.3, z0: zSeam - hh, z1: zSeam + hh });
      out.push({ x0: cx - hw, x1: cx + hw, y0: b.y1 - 0.3, y1: b.y1 + d, z0: zSeam - hh, z1: zSeam + hh });
    }
    const cy = (b.y0 + b.y1) / 2;
    out.push({ x0: b.x0 - d, x1: b.x0 + 0.3, y0: cy - hw, y1: cy + hw, z0: zSeam - hh, z1: zSeam + hh });
    out.push({ x0: b.x1 - 0.3, x1: b.x1 + d, y0: cy - hw, y1: cy + hw, z0: zSeam - hh, z1: zSeam + hh });
  }

  // Versenkte Schalengriffe mittig auf den Stirnseiten (x0/x1): dunkle, leicht vertiefte Schale
  // + Chrom-Bügel, der leicht über die Fläche hinaussteht.
  function handleMeshes(b) {
    const cy = (b.y0 + b.y1) / 2, cz = b.z0 + (b.z1 - b.z0) * 0.55;
    const hw = 6, hh = 3.5, depth = 3;
    const out = [];
    for (const side of [0, 1]) {
      const outer = side === 0 ? b.x0 : b.x1;
      const shell = side === 0
        ? { x0: outer, x1: outer + depth, y0: cy - hw, y1: cy + hw, z0: cz - hh, z1: cz + hh }
        : { x0: outer - depth, x1: outer, y0: cy - hw, y1: cy + hw, z0: cz - hh, z1: cz + hh };
      const bracket = { x0: outer - 0.3, x1: outer + 0.3, y0: cy - hw * 0.55, y1: cy + hw * 0.55, z0: cz - 1, z1: cz + 1 };
      out.push(boxMesh(shell, MAT_HANDLE_SHELL), boxMesh(bracket, MAT_CHROME));
    }
    return out;
  }

  // Alle drei Builder schreiben ihre Matrix über die reine `composeMatrix()`-Hilfsfunktion in ein
  // einziges wiederverwendetes THREE.Matrix4 (`instMat.fromArray(...)` überschreibt alle 16
  // Elemente vollständig) statt über ein geteiltes, mutierbares Object3D („dummy“) – so kann keine
  // Rotation eines Aufrufs in den nächsten durchsickern (siehe instanceMatrix.js).
  const instMat = new THREE.Matrix4();
  const instArr = new Array(16);
  const setMat = (mesh, i, px, py, pz, qx, qy, qz, qw, sx, sy, sz) => {
    composeMatrix(px, py, pz, qx, qy, qz, qw, sx, sy, sz, instArr);
    mesh.setMatrixAt(i, instMat.fromArray(instArr));
  };

  function buildInstanced(geometry, material, boxes, colors) {
    if (!boxes.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, boxes.length);
    boxes.forEach((b, i) => {
      const [qx, qy, qz, qw] = IDENTITY_QUAT;
      setMat(mesh, i, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2, qx, qy, qz, qw,
        Math.max(b.x1 - b.x0, 0.001), Math.max(b.y1 - b.y0, 0.001), Math.max(b.z1 - b.z0, 0.001));
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  // GEO_SPHERE hat Radius 2.5 – für Kugelecken mit Radius `radius` gleichmäßig skalieren.
  function buildInstancedSpheres(positions, radius, material) {
    if (!positions.length) return null;
    const mesh = new THREE.InstancedMesh(GEO_SPHERE, material, positions.length);
    const s = radius / 2.5;
    positions.forEach((p, i) => {
      const [qx, qy, qz, qw] = IDENTITY_QUAT;
      setMat(mesh, i, p.x, p.y, p.z, qx, qy, qz, qw, s, s, s);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  // Beliebig orientierter Zylinder zwischen zwei Punkten (Gurtrohre/Diagonalen der Traverse) –
  // GEO_CYL liegt lokal auf der Y-Achse, daher Rotation über setFromUnitVectors.
  const cylQuat = new THREE.Quaternion();
  const cylDir = new THREE.Vector3();
  const cylUp = new THREE.Vector3(0, 1, 0);
  function buildInstancedCylinders(material, segs, colors) {
    if (!segs.length) return null;
    const mesh = new THREE.InstancedMesh(GEO_CYL, material, segs.length);
    segs.forEach((s, i) => {
      cylDir.set(s.p2.x - s.p1.x, s.p2.y - s.p1.y, s.p2.z - s.p1.z);
      const len = cylDir.length() || 0.001;
      cylDir.normalize();
      cylQuat.setFromUnitVectors(cylUp, cylDir);
      setMat(mesh, i, (s.p1.x + s.p2.x) / 2, (s.p1.y + s.p2.y) / 2, (s.p1.z + s.p2.z) / 2,
        cylQuat.x, cylQuat.y, cylQuat.z, cylQuat.w, s.r, len, s.r);
      if (colors) mesh.setColorAt(i, colors[i]);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  // Traversenwagen-Geometrie (Task 6): Gurtrohre (4 pro Traversenstück, über die volle Länge) +
  // Zickzack-Diagonalen auf allen 4 Seiten je Stück; Rollwagen als Alu-Rahmen + 4 Rollen (`wheelMesh`
  // mit face 'bottom', da Wagen nie gekippt werden). Sammelt Segmente für die geteilten
  // InstancedMeshes (`chordSegs`/`diagSegs`), gibt Nicht-Instanzierbares direkt an `content`.
  function trussPoint(lenAxis, widAxis, lenVal, widVal, z) {
    const p = { x: 0, y: 0, z };
    p[lenAxis] = lenVal;
    p[widAxis] = widVal;
    return p;
  }
  function faceZigzag(lenAxis, widAxis, len0, len1, cornerA, cornerB, profileWidth, r, out) {
    const length = len1 - len0;
    const segs = Math.max(1, Math.round(length / Math.max(profileWidth, 1)));
    const step = length / segs;
    const at = (chord, i) => trussPoint(lenAxis, widAxis, len0 + i * step, chord.w, chord.z);
    for (let i = 0; i < segs; i++) {
      const [from, to] = i % 2 === 0 ? [cornerA, cornerB] : [cornerB, cornerA];
      out.push({ p1: at(from, i), p2: at(to, i + 1), r });
    }
  }
  function addTruss(it, bad, selected, chordSegs, chordColors, diagSegs, seq) {
    const { c, p, box } = it;
    const shape = trussShape(c, p, box);
    const { lenAxis, widAxis } = shape;

    const edgeMat = selected ? MAT_EDGE_SEL : bad ? MAT_EDGE_ERR : MAT_EDGE_ALU;
    content.add(edges(box, edgeMat));

    shape.boards.forEach((b, i) => {
      content.add(boxMesh(b, MAT_DOLLY_BOARD), edges(b, MAT_EDGE_ALU));
      const dollyColor = it.color ?? c.color;
      if (dollyColor) {
        // Nur eine schmale Kennzeichnung an der nach außen zeigenden Stirnkante des Bretts (analog
        // zur `truss-mark`-Marke in 2D), nicht die volle Brettfläche – sonst sieht das schwarze
        // Kunststoff-Rollbrett wie eine lackierte Platte aus. An den Längskanten (in Fahrtrichtung)
        // laufen die Gurtrohre der Traverse fast über die gesamte Brettbreite entlang – eine Marke
        // dort würde meist unter einem Rohr verschwinden. An der Stirnkante (quer zur Fahrtrichtung,
        // wo auch die Beschriftung sitzt) kreuzen die Rohre die Marke nur an 2–3 schmalen Stellen,
        // der Rest bleibt aus jedem Blickwinkel sichtbar.
        const boardLen = b[`${lenAxis}1`] - b[`${lenAxis}0`];
        const markL = Math.min(DOLLY_MARK_W, boardLen / 3);
        const l0 = i === 0 ? b[`${lenAxis}0`] : b[`${lenAxis}1`] - markL;
        const l1 = i === 0 ? b[`${lenAxis}0`] + markL : b[`${lenAxis}1`];
        const stripe = { ...b, z0: b.z1 - 0.3, z1: b.z1, [`${lenAxis}0`]: l0, [`${lenAxis}1`]: l1 };
        content.add(boxMesh(stripe, bandMaterial(dollyColor)));
      }
      // Beschriftung nur auf dem jeweils nach außen zeigenden Wagenende (nicht ringsum wie beim Case).
      // Bezugsfläche bleibt das volle Wagenvolumen (shape.dollies), nicht nur die Platte.
      // Schriftfarbe aus dem tatsächlichen Hintergrund (Alu-Wagenende) ableiten, nicht aus der Stück-/Gewerkfarbe.
      if (it.label) {
        const d = shape.dollies[i];
        const endFace = `${lenAxis}${i}`;
        const pl = labelPlanes(d, 'bottom').find(p => p.face === endFace);
        if (pl) content.add(labelMesh(pl, `${seq}. ${it.label}`, ALU_HEX));
      }
    });
    for (const r of shape.rails) content.add(boxMesh(r, MAT_DOLLY_RAIL));
    for (const w of shape.wheels) content.add(...wheelMesh(w, 'bottom'));

    const profileWidth = c.truss.width;
    const chordR = profileWidth * TUBE_R_RATIO, diagR = profileWidth * DIAG_R_RATIO;
    const col = selected ? COL_PROFILE_SEL : bad ? COL_PROFILE_BAD : COL_PROFILE_N;
    for (const pc of shape.pieces) {
      const len0 = pc[`${lenAxis}0`], len1 = pc[`${lenAxis}1`];
      const w0 = pc[`${widAxis}0`], w1 = pc[`${widAxis}1`];
      const corners = [{ w: w0, z: pc.z0 }, { w: w1, z: pc.z0 }, { w: w0, z: pc.z1 }, { w: w1, z: pc.z1 }];
      for (const cn of corners) {
        chordSegs.push({ p1: trussPoint(lenAxis, widAxis, len0, cn.w, cn.z), p2: trussPoint(lenAxis, widAxis, len1, cn.w, cn.z), r: chordR });
        chordColors.push(col);
      }
      const [c00, c10, c01, c11] = corners;
      faceZigzag(lenAxis, widAxis, len0, len1, c00, c10, profileWidth, diagR, diagSegs); // unten
      faceZigzag(lenAxis, widAxis, len0, len1, c01, c11, profileWidth, diagR, diagSegs); // oben
      faceZigzag(lenAxis, widAxis, len0, len1, c00, c01, profileWidth, diagR, diagSegs); // Seite w0
      faceZigzag(lenAxis, widAxis, len0, len1, c10, c11, profileWidth, diagR, diagSegs); // Seite w1
    }
  }

  function clear() {
    content.traverse(o => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!m.userData.shared) m.dispose();
    });
    content.clear();
  }

  // Vollständiger Abbau der Ansicht: ResizeObserver, Controls und WebGL-Kontext freigeben, dazu
  // alle geteilten Geometrien/Materialien/Texturen (die `clear()` bewusst überspringt, weil sie
  // über Updates hinweg wiederverwendet werden) und die Farb-/Beschriftungs-Caches. Ohne das bleibt
  // bei jedem Neuaufbau nach einem Fehler (app.js, `catch`) ein WebGL-Kontext hängen – Chrome hält
  // nur rund 16 davon (s. Befund I6).
  function dispose() {
    resizeObserver.disconnect();
    controls.dispose();
    clear();
    for (const g of [GEO_BOX, GEO_BOX_EDGES, GEO_SPHERE, GEO_CYL, GEO_PLANE]) g.dispose();
    LAM_TEX.dispose();
    for (const m of [
      MAT_FLOOR, MAT_ROOM_EDGE, MAT_FRONT, MAT_ARCH, MAT_ALU, MAT_CORNER, MAT_WHEEL, MAT_HUB,
      MAT_EDGE_ALU, MAT_EDGE_SEL, MAT_EDGE_ERR, MAT_PROFILE, MAT_CHROME, MAT_SEAM_BAND,
      MAT_HANDLE_SHELL, MAT_DOLLY_BOARD, MAT_DOLLY_RAIL,
    ]) m.dispose();
    for (const { material, texture } of labelTexCache.values()) { material.dispose(); texture.dispose(); }
    labelTexCache.clear();
    for (const m of bodyMatCache.values()) m.dispose();
    bodyMatCache.clear();
    for (const m of bandMatCache.values()) m.dispose();
    bandMatCache.clear();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  let framedFor = null;
  function update({ truck, result, selectedId, colorMode = 'black' }) {
    clear();
    usedLabelKeys = new Set();
    const room = { x0: 0, y0: 0, z0: 0, x1: truck.l, y1: truck.w, z1: truck.h };
    const floor = boxMesh({ ...room, z0: -2, z1: 0 }, MAT_FLOOR);
    content.add(floor, edges(room, MAT_ROOM_EDGE));
    content.add(boxMesh({ ...room, x1: 3 }, MAT_FRONT));
    for (const a of archBoxes(truck)) content.add(boxMesh(a, MAT_ARCH));

    // Für die instanzierten Sorten (Profilstäbe, Verschlüsse, Kugelecken, Traversen-Gurtrohre/
    // -Diagonalen) über alle Cases sammeln und am Ende je Sorte ein einziges InstancedMesh bauen.
    const profileBoxes = [], profileColors = [], latchBoxesAll = [], cornerPositions = [];
    const chordSegs = [], chordColors = [], diagSegs = [];

    for (const it of result.items) {
      const bad = result.byPlacement.has(it.id);
      const colors = caseColors(it.c, colorMode, it.color);

      if (isTruss(it.c)) {
        addTruss(it, bad, it.id === selectedId, chordSegs, chordColors, diagSegs, result.sequence.get(it.id));
        continue;
      }

      const { body, wheels, face } = caseShape(it.c, it.p, it.box);

      const bodyMesh = boxMesh(body, bodyMaterial(colors.body, bad));
      content.add(bodyMesh);

      const bw = body.x1 - body.x0, bd = body.y1 - body.y0, bh = body.z1 - body.z0;
      const detailed = Math.min(bw, bd, bh) >= DETAIL_MIN;

      if (!detailed) {
        const edgeMat = it.id === selectedId ? MAT_EDGE_SEL : bad ? MAT_EDGE_ERR : MAT_EDGE_ALU;
        content.add(edges(body, edgeMat), ...cornerSpheres(body));
      } else {
        edgeBars(body, profileBoxes);
        const col = it.id === selectedId ? COL_PROFILE_SEL : bad ? COL_PROFILE_BAD : COL_PROFILE_N;
        for (let i = 0; i < 12; i++) profileColors.push(col);
        for (const x of [body.x0, body.x1]) for (const y of [body.y0, body.y1]) for (const z of [body.z0, body.z1])
          cornerPositions.push({ x, y, z });

        if (face === 'bottom') {
          const zSeam = body.z0 + bh * 0.25;
          content.add(boxMesh({
            x0: body.x0 - 0.3, x1: body.x1 + 0.3, y0: body.y0 - 0.3, y1: body.y1 + 0.3,
            z0: zSeam - 1, z1: zSeam + 1,
          }, MAT_SEAM_BAND));
          latchBoxes(body, zSeam, latchBoxesAll);
          content.add(...handleMeshes(body));
        }
      }

      if (colors.stripe) {
        const band = {
          x0: body.x0 - 0.2, x1: body.x1 + 0.2, y0: body.y0 - 0.2, y1: body.y1 + 0.2,
          z0: body.z1 - 12, z1: body.z1 - 6,
        };
        content.add(boxMesh(band, bandMaterial(colors.stripe)));
      }

      for (const w of wheels) content.add(...wheelMesh(w, face));

      // Schriftfarbe aus dem tatsächlichen Korpus-Hintergrund ableiten, nicht aus der Stück-/Gewerkfarbe
      // (die im Modus „Schwarz“ nur als Farbstreifen erscheint, nicht als Korpusfarbe).
      if (it.label) {
        const labelText = `${result.sequence.get(it.id)}. ${it.label}`;
        for (const pl of labelPlanes(body, face)) content.add(labelMesh(pl, labelText, colors.body));
      }
    }

    const profileMesh = buildInstanced(GEO_BOX, MAT_PROFILE, profileBoxes, profileColors);
    if (profileMesh) content.add(profileMesh);
    const latchMesh = buildInstanced(GEO_BOX, MAT_CHROME, latchBoxesAll, null);
    if (latchMesh) content.add(latchMesh);
    const cornerMesh = buildInstancedSpheres(cornerPositions, 4, MAT_CHROME);
    if (cornerMesh) content.add(cornerMesh);
    const chordMesh = buildInstancedCylinders(MAT_PROFILE, chordSegs, chordColors);
    if (chordMesh) content.add(chordMesh);
    const diagMesh = buildInstancedCylinders(MAT_ALU, diagSegs, null);
    if (diagMesh) content.add(diagMesh);

    // Nicht mehr verwendete Beschriftungs-Texturen freigeben (sonst wächst der Cache bei jedem
    // Umsortieren/Umbenennen unbegrenzt weiter – Texturen/Materialien sind sonst „shared“ und würden
    // von `clear()` nie disposed).
    for (const [key, entry] of labelTexCache) {
      if (usedLabelKeys.has(key)) continue;
      entry.material.dispose();
      entry.texture.dispose();
      labelTexCache.delete(key);
    }

    const frameKey = `${truck.id}:${truck.l}x${truck.w}x${truck.h}`;
    if (framedFor !== frameKey) {
      camera.position.set(truck.l * 1.25, -truck.w * 2.2, truck.h * 2.4);
      controls.target.set(truck.l / 2, truck.w / 2, truck.h / 3);
      controls.update();
      framedFor = frameKey;
    }
    resize();
    render();
  }
  return { update, dispose };
}
