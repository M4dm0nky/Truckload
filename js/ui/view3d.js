import { archBoxes } from '../model/validate.js';
import { wheelFace, faceSlab } from '../model/geometry.js';

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

  const boxMesh = (b, material) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0), material);
    m.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return m;
  };
  const edges = (mesh, color) => {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), new THREE.LineBasicMaterial({ color }));
    l.position.copy(mesh.position);
    return l;
  };
  function clear() {
    content.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
    content.clear();
  }

  let framedFor = null;
  function update({ truck, result, selectedId }) {
    clear();
    const room = { x0: 0, y0: 0, z0: 0, x1: truck.l, y1: truck.w, z1: truck.h };
    const floor = boxMesh({ ...room, z0: -2, z1: 0 }, new THREE.MeshLambertMaterial({ color: 0x5a6068 }));
    content.add(floor, edges(boxMesh(room, new THREE.MeshBasicMaterial()), 0x8b95a3));
    const front = boxMesh({ ...room, x1: 3 }, new THREE.MeshLambertMaterial({ color: 0xf0a500, transparent: true, opacity: 0.35 }));
    content.add(front);
    for (const a of archBoxes(truck)) content.add(boxMesh(a, new THREE.MeshLambertMaterial({ color: 0x444a52 })));

    for (const it of result.items) {
      const bad = result.byPlacement.has(it.id);
      const mesh = boxMesh(it.box, new THREE.MeshLambertMaterial({
        color: it.c.color, emissive: bad ? 0x661111 : 0x000000,
      }));
      content.add(mesh, edges(mesh, it.id === selectedId ? 0xffffff : bad ? 0xe5484d : 0x111111));
      content.add(boxMesh(faceSlab(it.box, wheelFace(it.p), 3), new THREE.MeshLambertMaterial({ color: 0x222222 })));
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
