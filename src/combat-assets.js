import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { assetUrl } from './asset-url.js';

export const COMBAT_ASSET_URL = '/assets/combat-arcade-v2.glb';
const required = ['player', 'scout', 'interceptor', 'bomber', 'bay', 'turret', 'core', 'missile', ...Array.from({ length: 6 }, (_, i) => `debris_${i}`)];

export function findPart(root, name) {
  let found;
  root.traverse(node => { if (!found && !node.isMesh && (node.name === name || node.name.startsWith(`${name}.`) || node.name.startsWith(`${name}_`) || new RegExp(`^${name}\\d+$`).test(node.name))) found = node; });
  return found;
}

// Normalize mesh transforms once, leaving only shared geometry and two materials
// per fighter class for the render loop. Target hierarchies retain their pivots.
export function batchParts(root) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert(), groups = new Map();
  root.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld));
    const key = node.material.uuid;
    if (!groups.has(key)) groups.set(key, { material: node.material, geometries: [] });
    groups.get(key).geometries.push(geometry);
  });
  return [...groups.values()].map(({ material, geometries }) => {
    const geometry = mergeGeometries(geometries);
    geometries.forEach(g => g.dispose());
    if (!geometry) throw new Error(`Incompatible geometry in ${root.name}`);
    return { geometry, material };
  });
}

export function loadCombatAssets(status) {
  return new GLTFLoader().loadAsync(assetUrl(COMBAT_ASSET_URL)).then(gltf => {
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      node.geometry.userData.sharedCombat = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.userData.sharedCombat = true;
    });
    const registry = new Map(required.map(id => [id, gltf.scene.getObjectByName(id)]));
    for (const [id, root] of registry) {
      if (!root || !new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).length()) throw new Error(`Missing combat asset: ${id}`);
    }
    for (const kind of ['bay', 'turret', 'core']) {
      for (const part of ['intact', 'moving', 'destroyed', ...(kind === 'bay' ? ['door_left', 'door_right'] : ['rotor'])]) {
        if (!findPart(registry.get(kind), part)) throw new Error(`Missing ${kind}/${part}`);
      }
    }
    status.status = 'ready'; status.count = registry.size;
    return registry;
  });
}
