import fs from 'node:fs';
import { buildCapitalHull } from '../src/capital-hull.js';
import { FIRST_MISSION } from '../src/content.js';

const hull = buildCapitalHull({ ...FIRST_MISSION.environment, hardpoints: FIRST_MISSION.targets.map(t => ({ x: t.x, z: -t.y, radius: t.radius })) });
const materials = [], materialIds = new Map(), meshes = [];
hull.traverse(mesh => {
  if (!mesh.isMesh) return;
  if (!materialIds.has(mesh.material)) {
    materialIds.set(mesh.material, materials.length);
    materials.push({ color: mesh.material.color.toArray(), emissive: mesh.material.emissive.toArray(), emissiveIntensity: mesh.material.emissiveIntensity, metalness: mesh.material.metalness, roughness: mesh.material.roughness });
  }
  meshes.push({ name: `Hull_${meshes.length.toString().padStart(2, '0')}`, material: materialIds.get(mesh.material), positions: Array.from(mesh.geometry.attributes.position.array) });
});
fs.mkdirSync('assets/blender', { recursive: true });
fs.writeFileSync('assets/blender/hull-source.json', JSON.stringify({ materials, meshes, hardpoints: FIRST_MISSION.targets }));
console.log(`Exported ${meshes.length} hull chunks for Blender.`);
