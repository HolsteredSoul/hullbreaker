import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './content.js';

// Static ship architecture only. Scenery stays independent of combat behavior.
export function buildCapitalHull(definition) {
  const random = seededRandom(definition.seed);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x304951, roughness: 0.78, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x597075, roughness: 0.66, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x14282e, roughness: 0.9, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x89dcd0, emissive: 0x3bac9a, emissiveIntensity: 1.6 }),
    new THREE.MeshStandardMaterial({ color: 0xb29258, emissive: 0x4e3010, emissiveIntensity: 0.5, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xa2afa5, roughness: 0.76, metalness: 0.4 }),
    new THREE.MeshStandardMaterial({ color: 0x775244, roughness: 0.9, metalness: 0.4 }),
  ];
  const buckets = new Map(), transform = new THREE.Object3D();
  function add(geometry, z, mat) {
    const key = `${Math.floor((z + 20) / 25)}:${mat}`;
    if (!buckets.has(key)) buckets.set(key, []);
    if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
    buckets.get(key).push(geometry);
  }
  function box(x, y, z, w, h, d, mat = 0, rotation = 0) {
    transform.position.set(x, y, z); transform.rotation.set(0, rotation, 0); transform.scale.set(w, h, d); transform.updateMatrix();
    const geometry = new THREE.BoxGeometry(1, 1, 1); geometry.applyMatrix4(transform.matrix); add(geometry, z, mat);
  }
  function armor(points, top, depth, mat = 0, bevel = 0.16) {
    const shape = new THREE.Shape(); points.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z)); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1 });
    geometry.rotateX(Math.PI / 2); geometry.translate(0, top, 0);
    add(geometry, points.reduce((sum, p) => sum + p[1], 0) / points.length, mat);
  }
  function cylinder(x, y, z, radius, height, mat = 2, segments = 12) {
    const geometry = new THREE.CylinderGeometry(radius, radius * 0.9, height, segments); geometry.translate(x, y, z); add(geometry, z, mat);
  }
  // Broad aft, pinched service neck, staggered hangars, reactor shoulders, spearhead.
  const profile = [[14, 9.5], [3, 13], [-9, 11.5], [-16, 7], [-26, 10.5], [-34, 8], [-43, 12], [-52, 10.5], [-62, 6.3], [-72, 7], [14 - definition.length, 0.7]];
  for (let i = 0; i < profile.length - 1; i++) {
    const [aft, wa] = profile[i], [fore, wf] = profile[i + 1];
    armor([[-wa * 0.78, aft], [wa * 0.78, aft], [wf * 0.78, fore], [-wf * 0.78, fore]], -3.2, 3.5, 2, 0.35);
    armor([[-wa, aft - 0.12], [wa, aft - 0.12], [wf, fore + 0.12], [-wf, fore + 0.12]], -1.85, 1.35, 0, 0.18);
    for (const side of [-1, 1]) {
      armor([[side * (wa - 0.3), aft - 0.55], [side * (wa * 0.52), aft - 1.1], [side * (wf * 0.48), fore + 1.3], [side * (wf - 0.35), fore + 0.6]], -1.2, 0.6, i % 3 === 0 ? 1 : 0);
      const middle = (aft + fore) / 2, width = (wa + wf) / 2;
      if (i < 8) {
        box(side * (width - 0.9), -2.2, middle, 0.18, 0.18, (aft - fore) * 0.6, 3);
        for (let rib = 0; rib < 3; rib++) box(side * (width - 0.4), -3.4, middle - 2.1 + rib * 2.1, 0.5, 2.3, 0.38, 1);
      }
    }
  }
  function widthAt(z) {
    for (let i = 0; i < profile.length - 1; i++) {
      const [a, wa] = profile[i], [b, wb] = profile[i + 1];
      if (z <= a && z >= b) return wa + (wb - wa) * ((a - z) / (a - b));
    }
    return 1;
  }
  const clearOfTargets = (x, z, margin = 1) => !(definition.hardpoints || []).some(t => Math.hypot(x - t.x, z - t.z) < t.radius + margin);
  // Irregular plates and maintenance wells replace the repeating runway pattern.
  const panels = [];
  for (let i = 0; i < 115; i++) {
    const z = 10 - random() * 87, width = widthAt(z);
    const x = (random() - 0.5) * Math.max(1, width * 1.55);
    if (!clearOfTargets(x, z, 2) || Math.hypot(x, z + 47) < 4.2) continue;
    const w = 0.5 + random() * 1.8, d = 0.7 + random() * 2.9;
    if (panels.some(p => Math.abs(x - p.x) < (w + p.w) / 2 + 0.3 && Math.abs(z - p.z) < (d + p.d) / 2 + 0.3)) continue;
    panels.push({ x, z, w, d });
    box(x, -1.4, z, w, 0.92, d, random() > 0.82 ? 5 : random() > 0.5 ? 1 : 2);
    if (i % 5 === 0) for (let slat = 0; slat < 4; slat++) box(x, -0.87, z - d * 0.3 + slat * d * 0.2, w * 0.8, 0.06, 0.08, 0);
  }
  // Exposed aft drives and swept outboard engine pods.
  for (const side of [-1, 1]) {
    armor([[side * 7, 10], [side * 13.8, 9], [side * 14.2, -2], [side * 10, -9], [side * 7, -5]], -0.6, 3.8, 1, 0.3);
    armor([[side * 10, 8], [side * 12.5, 7], [side * 12.5, -2], [side * 10, -5]], 0.1, 0.7, 2);
    for (let fin = 0; fin < 6; fin++) box(side * 11.3, 0.8, 5 - fin * 1.6, 2.4, 1.2, 0.22, 1, side * 0.12);
    box(side * 7.6, -0.85, 3, 0.2, 0.15, 10, 4);
    for (let tube = 0; tube < 3; tube++) {
      const geometry = new THREE.CylinderGeometry(0.42, 0.42, 8, 8); geometry.rotateX(Math.PI / 2); geometry.translate(side * (3 + tube * 1.1), -1.05, 5); add(geometry, 5, tube === 1 ? 4 : 2);
    }
  }
  // Port docking arm and shorter starboard cargo block create an asymmetric waist.
  armor([[-7, -19], [-14, -18], [-15.5, -25], [-12, -31], [-7, -29]], -2.3, 2.6, 2, 0.25);
  armor([[-8, -20], [-13, -20], [-13.9, -25], [-11, -28], [-8, -27]], -0.85, 1.5, 1);
  box(-11, -0.55, -24, 2.4, 0.4, 4, 2);
  for (let rail = 0; rail < 4; rail++) box(-11, -0.27, -22.6 - rail * 0.9, 2.1, 0.12, 0.14, 4);
  armor([[8, -26], [12, -28], [12, -34], [8, -35]], -1.1, 2.8, 6);
  for (let pod = 0; pod < 3; pod++) box(10, -0.6, -28.8 - pod * 1.5, 2.5, 0.8, 1.1, 0);
  // Broken starboard shoulder: exposed lattice and a displaced armor plate.
  armor([[8, -39], [13.8, -38], [14, -41], [11.5, -42], [13, -44], [10.6, -47], [7.8, -45]], -0.95, 2.2, 6);
  for (let beam = 0; beam < 4; beam++) box(12.1, -2.1, -39.8 - beam * 1.7, 4.3, 0.18, 0.2, 4, -0.22);
  box(12.3, -0.4, -43, 2.7, 0.18, 2.9, 1, 0.42);
  // Reactor well and radial vanes are below the playable plane.
  cylinder(0, -1.9, -47, 3.7, 0.3, 2, 24);
  const collar = new THREE.TorusGeometry(3.25, 0.24, 6, 32); collar.rotateX(Math.PI / 2); collar.translate(0, -1.15, -47); add(collar, -47, 1);
  cylinder(0, -1.65, -47, 2.2, 0.15, 3, 16);
  for (let vane = 0; vane < 8; vane++) { const angle = vane * Math.PI / 4; box(Math.sin(angle) * 2.7, -0.95, -47 + Math.cos(angle) * 2.7, 0.3, 0.25, 1.3, 5, angle); }
  // Tall command structures sit ahead of the core, clear of the combat corridor.
  armor([[-5, -65], [5.8, -65], [4.4, -75], [-3.8, -77]], -0.3, 1.6, 1, 0.3);
  armor([[-2.8, -67], [5, -67], [4, -72], [-1.8, -74]], 1.7, 2, 0, 0.25);
  armor([[0, -68], [4.5, -68], [3.6, -73], [0, -73]], 3.8, 2, 5, 0.15);
  box(2, 3.65, -73.1, 3.6, 0.45, 0.15, 3);
  box(2.9, 5.9, -70, 0.2, 4, 0.2, 1); box(2.9, 7.5, -70, 2.2, 0.12, 0.18, 4);
  box(-3.5, 1.5, -69, 0.16, 4.7, 0.16, 1);
  armor([[-4.6, -75], [-0.9, -76], [-0.45, 17 - definition.length], [-2.5, -83]], -0.6, 1.8, 5);
  armor([[4.6, -75], [0.9, -76], [0.45, 17 - definition.length], [2.5, -83]], -0.6, 1.8, 1);

  const hull = new THREE.Group();
  for (const [key, geometries] of buckets) {
    const geometry = mergeGeometries(geometries, false); geometry.computeBoundingSphere();
    hull.add(new THREE.Mesh(geometry, materials[Number(key.split(':')[1])]));
    geometries.forEach(g => g.dispose());
  }
  return hull;
}
