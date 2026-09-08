import * as THREE from 'three';
import { buildCapitalHull } from './capital-hull.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { assetUrl } from './asset-url.js';
import { buildSectorScenery } from './sector-scenery.js';
import { disposeObject } from './scene-resources.js';


// A scenery provider owns appearance only. Combat targets come from mission data.
// A station can register another factory without modifying Simulation or Input.
const factories = new Map();
export function registerEnvironment(type, factory) { factories.set(type, factory); }
export function createEnvironment(definition) {
  const factory = factories.get(definition.type);
  if (!factory) throw new Error(`Unknown environment: ${definition.type}`);
  return factory(definition);
}

registerEnvironment('capital', (definition) => {
  if (definition.variant && definition.variant !== 'nesis') return buildSectorScenery(definition);
  const group = new THREE.Group();
  group.userData.surfaceY = definition.surfaceY ?? -.85;
  let disposed = false;

  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x304951, roughness: 0.78, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x597075, roughness: 0.66, metalness: 0.65 }),
    new THREE.MeshStandardMaterial({ color: 0x14282e, roughness: 0.9, metalness: 0.3 }),
    new THREE.MeshStandardMaterial({ color: 0x89dcd0, emissive: 0x3bac9a, emissiveIntensity: 1.6 }),
    new THREE.MeshStandardMaterial({ color: 0xb29258, emissive: 0x4e3010, emissiveIntensity: 0.5, roughness: 0.7 }),
  ];
  const hull = buildCapitalHull(definition); group.add(hull);
  const engineGroup = new THREE.Group(); group.add(engineGroup);
  group.userData.engineSockets = [];
  for (const [x, z, radius] of [[-11, 10, 1.65], [-5.5, 15, 1.8], [0, 16, 2.4], [5.5, 15, 1.8], [11, 10, 1.65]]) {
    group.userData.engineSockets.push({ position: [x, -2.8, z + 2.3], direction: [0, 0, 1], radius });
    const casing = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.9, 4, 12), materials[2]);
    casing.rotation.x = Math.PI / 2; casing.position.set(x, -2.8, z); engineGroup.add(casing);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.75, 0.16, 6, 20), materials[1]); ring.position.set(x, -2.8, z + 2.1); engineGroup.add(ring);
    const light = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.65, 20), new THREE.MeshBasicMaterial({ color: 0xa1ffee, side: THREE.DoubleSide })); light.position.set(x, -2.8, z + 2.2); engineGroup.add(light);
  }
  // GLB replacement contract: meters, Y-up, bow toward -Z, aft at Z=14.
  // Keep a playable fallback until the complete asset is loaded and validated.
  const asset = { status: definition.model ? 'loading' : 'procedural', url: definition.model, meshCount: 0 };
  group.userData.asset = asset;
  const targetBindings = new Map();
  if (definition.model) new GLTFLoader().load(assetUrl(definition.model), gltf => {
    if (disposed) { disposeObject(gltf.scene); return; }
    try {
    let meshCount = 0;
    gltf.scene.traverse(object => { if (object.isMesh) meshCount++; });
    if (!meshCount) { asset.status = 'fallback'; console.warn('Capital ship asset contained no meshes; using procedural hull.'); return; }
    if (definition.assetVersion === 2) {
      gltf.scene.updateMatrixWorld(true);
      const sockets = [];
      for (const target of definition.hardpoints || []) {
        const node = gltf.scene.getObjectByName(`socket_${(target.socketId || target.id).replaceAll('-', '_')}`);
        if (!node) throw new Error(`Missing target socket ${target.id}`);
        const position = node.getWorldPosition(new THREE.Vector3());
        const mount = [target.x, target.y ?? -.55, target.z];
        // A campaign may relocate a weapon while still validating the original hull socket.
        if (position.distanceTo(new THREE.Vector3(...(target.socketPosition || mount))) > 0.02) throw new Error(`Misaligned socket ${target.id}`);
        targetBindings.set(target.id, { position: mount, node });
      }
      gltf.scene.traverse(node => {
        if (!node.name.startsWith('engine_') || !node.userData.radius) return;
        const position = node.getWorldPosition(new THREE.Vector3()).toArray();
        const direction = node.userData.direction;
        if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite) || !Math.hypot(...direction) || !(node.userData.radius > 0)) throw new Error('Invalid engine socket');
        sockets.push({ position, direction, radius: node.userData.radius });
      });
      if (!sockets.length) throw new Error('Missing engine sockets');
      group.remove(engineGroup);
      engineGroup.traverse(node => { if (node.isMesh) { node.geometry.dispose(); node.material.dispose(); } });
      group.userData.engineSockets = sockets;
    }
    group.add(gltf.scene); group.remove(hull);
    const ownedMaterials = new Set();
    hull.traverse(object => { if (object.isMesh) { object.geometry.dispose(); ownedMaterials.add(object.material); } });
    ownedMaterials.forEach(material => material.dispose());
    asset.status = 'ready'; asset.meshCount = meshCount;
    } catch (error) { disposeObject(gltf.scene); targetBindings.clear(); asset.status = 'fallback'; console.warn('Capital ship validation failed; retaining procedural scenery.', error); }
  }, undefined, error => { asset.status = 'fallback'; console.warn('Capital ship model unavailable; using procedural hull.', error); });
  return { group, targetBindings, update(time, distance, menu) { group.position.z = menu ? 0 : distance; }, dispose() { disposed = true; targetBindings.clear(); disposeObject(group); } };
});

for (const type of ['space', 'station', 'moon']) registerEnvironment(type, buildSectorScenery);

