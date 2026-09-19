import { archBoxes } from '../model/validate.js';
import { caseShape, wheelAxes } from '../model/caseShape.js';
import { caseColors } from './caseStyle.js';

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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
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
  new ResizeObserver(resize).observe(container);

  // Geteilte Geometrien (nie disposen) – jede Box/Kugel/Rolle ist ein skalierter Einheits-Body.
  const GEO_BOX = new THREE.BoxGeometry(1, 1, 1);
  const GEO_BOX_EDGES = new THREE.EdgesGeometry(GEO_BOX);
  const GEO_SPHERE = new THREE.SphereGeometry(2.5, 16, 12);
  const GEO_CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
  for (const g of [GEO_BOX, GEO_BOX_EDGES, GEO_SPHERE, GEO_CYL]) g.userData.shared = true;

  const shared = mat => { mat.userData.shared = true; return mat; };
  const MAT_FLOOR = shared(new THREE.MeshLambertMaterial({ color: 0x5a6068 }));
  const MAT_ROOM_EDGE = shared(new THREE.LineBasicMaterial({ color: 0x8b95a3 }));
  const MAT_FRONT = shared(new THREE.MeshLambertMaterial({ color: 0xf0a500, transparent: true, opacity: 0.35 }));
  const MAT_ARCH = shared(new THREE.MeshLambertMaterial({ color: 0x444a52 }));
  const MAT_ALU = shared(new THREE.MeshStandardMaterial({ color: 0xb8bec6, metalness: 0.6, roughness: 0.35 }));
  const MAT_CORNER = shared(new THREE.MeshStandardMaterial({ color: 0xd6dbe1, metalness: 0.5, roughness: 0.4 }));
  const MAT_WHEEL = shared(new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.9 }));
  const MAT_HUB = shared(new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.4, roughness: 0.5 }));
  const MAT_EDGE_ALU = shared(new THREE.LineBasicMaterial({ color: 0xb8bec6 }));
  const MAT_EDGE_SEL = shared(new THREE.LineBasicMaterial({ color: 0xf0a500 }));
  const MAT_EDGE_ERR = shared(new THREE.LineBasicMaterial({ color: 0xe5484d }));

  // Korpus-/Band-Materialien pro Farbe gecacht (Case-Farbe wechselt selten, nie disposen).
  const bodyMatCache = new Map();
  const bodyMaterial = (color, bad) => {
    const key = `${color}|${bad}`;
    let m = bodyMatCache.get(key);
    if (!m) {
      m = shared(new THREE.MeshStandardMaterial({ color, roughness: 0.7, emissive: bad ? 0x661111 : 0x000000 }));
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
    hubCyl.scale.set(r * 0.35, t * 1.15, r * 0.35);
    if (a1 === 'x') { wheelCyl.rotation.z = Math.PI / 2; hubCyl.rotation.z = Math.PI / 2; }
    wheelCyl.position.set(pos.x, pos.y, pos.z);
    hubCyl.position.copy(wheelCyl.position);

    return [boxMesh(plate, MAT_ALU), boxMesh(forkA, MAT_ALU), boxMesh(forkB, MAT_ALU), wheelCyl, hubCyl];
  }

  function clear() {
    content.traverse(o => {
      if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) if (!m.userData.shared) m.dispose();
    });
    content.clear();
  }

  let framedFor = null;
  function update({ truck, result, selectedId, colorMode = 'black' }) {
    clear();
    const room = { x0: 0, y0: 0, z0: 0, x1: truck.l, y1: truck.w, z1: truck.h };
    const floor = boxMesh({ ...room, z0: -2, z1: 0 }, MAT_FLOOR);
    content.add(floor, edges(room, MAT_ROOM_EDGE));
    content.add(boxMesh({ ...room, x1: 3 }, MAT_FRONT));
    for (const a of archBoxes(truck)) content.add(boxMesh(a, MAT_ARCH));

    for (const it of result.items) {
      const bad = result.byPlacement.has(it.id);
      const colors = caseColors(it.c, colorMode);
      const { body, wheels, face } = caseShape(it.c, it.p, it.box);

      const bodyMesh = boxMesh(body, bodyMaterial(colors.body, bad));
      const edgeMat = it.id === selectedId ? MAT_EDGE_SEL : bad ? MAT_EDGE_ERR : MAT_EDGE_ALU;
      content.add(bodyMesh, edges(body, edgeMat), ...cornerSpheres(body));

      if (colors.stripe) {
        const band = {
          x0: body.x0 - 0.2, x1: body.x1 + 0.2, y0: body.y0 - 0.2, y1: body.y1 + 0.2,
          z0: body.z1 - 12, z1: body.z1 - 6,
        };
        content.add(boxMesh(band, bandMaterial(colors.stripe)));
      }

      for (const w of wheels) content.add(...wheelMesh(w, face));
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
  return { update };
}
