import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './content.js';
import { disposeObject } from './scene-resources.js';

// Chunked, material-batched modules: readable silhouettes with a small draw budget.
export function buildSectorScenery(definition) {
  const group = new THREE.Group(), random = seededRandom(definition.seed);
  const type = definition.type, variant = definition.variant;
  const colors = type === 'moon' ? [0x383d4a, 0x737681, 0x252d37, 0x8c785a] : type === 'station' ? [0x344c66, 0x698698, 0x172c40, 0xaf8255] : [0x344c50, 0x678780, 0x172d35, 0x947653];
  const materials = colors.map(color => new THREE.MeshStandardMaterial({ color, roughness: .82, metalness: type === 'moon' ? .15 : .55 }));
  materials.push(new THREE.MeshStandardMaterial({ color: 0x79cfe4, emissive: 0x3a9fbf, emissiveIntensity: 1.2 }));
  materials.push(new THREE.MeshStandardMaterial({ color: 0xe5b568, emissive: 0xa65d24, emissiveIntensity: .45 }));
  const buckets = new Map(), matrix = new THREE.Object3D();
  function add(geometry, x, y, z, sx, sy, sz, material = 0, rotation = 0) {
    matrix.position.set(x, y, z); matrix.rotation.set(0, rotation, 0); matrix.scale.set(sx, sy, sz); matrix.updateMatrix();
    geometry.applyMatrix4(matrix.matrix);
    if (geometry.index) { const flat = geometry.toNonIndexed(); geometry.dispose(); geometry = flat; }
    const key = `${material}:${Math.floor((z + 30) / 40)}`;
    if (!buckets.has(key)) buckets.set(key, { material, geometry: [] });
    buckets.get(key).geometry.push(geometry);
  }
  const box = (x, y, z, w, h, d, material = 0, rotation = 0) => add(new THREE.BoxGeometry(1, 1, 1), x, y, z, w, h, d, material, rotation);
  const rock = (x, y, z, size, material = 0) => add(new THREE.IcosahedronGeometry(1, 0), x, y, z, size, size * .7, size * 1.4, material, random() * 6);
  group.userData.engineSockets = [];
  group.userData.surfaceY = definition.surfaceY;
  group.userData.asset = { status: 'procedural', meshCount: 0 };
  if (type === 'space') {
    if (variant === 'wreckage') {
      for (let i = 0; i < 45; i++) {
        const side = i % 2 ? -1 : 1, z = 20 - random() * 160;
        box(side * (12 + random() * 18), -5 - random() * 10, z, 1 + random() * 4, .5 + random(), 2 + random() * 6, i % 4, random() * 6);
      }
    }
  } else if (type === 'capital') {
    const width = variant === 'cruiser' ? 8.8 : variant === 'command' ? 12.8 : 11.5;
    box(0, -2.8, -38, width * 1.7, 4, 108, 2);
    box(0, -1.55, -38, width * 2, 1.4, 104, 0);
    box(0, -.94, -38, 13, .15, 100, 1);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const z = 5 - i * 11;
        box(side * (width - 1.5), -.6, z, 3, 1.5 + (i % 3) * .6, 8, i % 2);
        box(side * (width - .05), -1, z, .12, .15, 6, 4);
        if (variant !== 'cruiser' && i > 1 && i < 5) box(side * (width + 1.8), -2, z, 5, 2.5, 8, 2);
      }
      box(side * 8.1, -1.7, 9, 3.2, 3, 13, 0);
      box(side * 8.1, -1.5, 16, 2.2, 1.5, .15, 4);
      group.userData.engineSockets.push({ position: [side * 8.1, -1.5, 16.3], direction: [0, 0, 1], radius: 1 });
    }
    box(variant === 'carrier' ? 8.5 : -8.2, 1.4, -75, 3.5, 5.5, 13, 1);
    box(variant === 'carrier' ? 8.5 : -8.2, 4.3, -76, 3.6, .25, 5, 4);
    box(0, -1.5, -95, width * 1.15, 2.2, 12, 0);
    for (let i = 0; i < 24; i++) box((i % 2 ? -1 : 1) * 6, -.8, 8 - i * 4.2, .1, .05, 1.1, 5);
  } else if (type === 'station') {
    box(0, -2.1, -50, 50, 2.5, 144, 2);
    box(0, -.99, -50, 19, .2, 143, 0);
    for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
      const z = 11 - i * 13, height = 4 + (i % 3) * 1.3;
      box(side * 13, height / 2 - 1, z, 6.5, height, 11, i % 2);
      box(side * 9.65, -.1, z, .25, 1, 9, 4);
      box(side * 15, height - .5, z, 9, .6, 4, 2);
      box(side * 20, 1.7, z - 2, 6, 5, 6, 0);
      box(side * 10.8, height - .3, z + 4.5, 2, .15, .3, 5);
      if (variant === 'docks') box(side * 13, -.3, z, 5, .3, 6, 2);
    }
    for (let i = 0; i < 12; i++) box(0, -.86, 10 - i * 11, 18.5, .04, .16, 1);
  } else if (type === 'moon') {
    box(0, -2.3, -50, 100, 2.8, 150, 0);
    for (let i = 0; i < 28; i++) {
      const x = (random() - .5) * 18, z = 14 - random() * 135;
      add(new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), x, -.885, z, 1.5 + random() * 2, 1, .6 + random(), 2, random() * 6);
    }
    for (let i = 0; i < 65; i++) {
      const x = (i % 2 ? 1 : -1) * (11 + random() * 34), z = 20 - random() * 150;
      rock(x, -1.4, z, 2 + random() * 5, i % 3);
    }
    for (let i = 0; i < 15; i++) {
      const x = (i % 2 ? -1 : 1) * (15 + random() * 25), z = 10 - random() * 130;
      add(new THREE.TorusGeometry(1, .18, 5, 12).rotateX(Math.PI / 2), x, -.72, z, 3.5, 1.3, 3.5, 1);
    }
    if (variant !== 'craters') for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      box(side * 11.5, .6, 8 - i * 13, 4.5, 3, 11, 2);
      box(side * 9.2, -.2, 8 - i * 13, .15, .15, 7, 5);
    }
    for (const t of definition.hardpoints || []) box(t.x, -1.1, t.z, 4, .55, 4, 2);
    if (variant === 'fortress') {
      box(0, -1.25, -69, 17, .8, 22, 2);
      for (const side of [-1, 1]) box(side * 13, 1.8, -70, 7, 5.5, 20, 1);
    }
  }
  const used = new Set();
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometry); bucket.geometry.forEach(g => g.dispose());
    group.add(new THREE.Mesh(geometry, materials[bucket.material])); used.add(bucket.material);
  }
  materials.forEach((material, i) => { if (!used.has(i)) material.dispose(); });
  group.userData.asset.meshCount = group.children.length;
  return { group, targetBindings: new Map(), update(time, distance, menu) { group.position.z = menu ? 0 : distance; }, dispose() { disposeObject(group); } };
}
