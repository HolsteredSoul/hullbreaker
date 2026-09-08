import fs from 'node:fs';
import assert from 'node:assert/strict';
import { FIRST_MISSION } from '../src/content.js';

const bytes = fs.readFileSync(`public${FIRST_MISSION.environment.model}`);
assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'Must be a GLB');
assert.equal(bytes.readUInt32LE(4), 2, 'Must use glTF 2');
assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB must be complete');
const jsonLength = bytes.readUInt32LE(12);
const asset = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
assert.ok(asset.meshes.length > 1 && asset.meshes.length < 60, 'Keep the hull sectioned for culling');
assert.ok(asset.materials.every(m => m.occlusionTexture), 'All hull materials must include baked AO');
assert.ok(asset.images.every(image => Number.isInteger(image.bufferView)), 'Textures must be embedded');
assert.ok(bytes.length < 15_000_000, 'Keep the initial asset under the transfer budget');
const names = new Set(asset.nodes.map(n => n.name));
for (const target of FIRST_MISSION.targets) assert.ok(names.has(`socket_${target.id.replaceAll('-', '_')}`), `Missing ${target.id} socket`);
let triangles = 0;
for (const mesh of asset.meshes) for (const primitive of mesh.primitives) {
  assert.ok(primitive.attributes.TEXCOORD_0 !== undefined, 'AO needs UV coordinates');
  triangles += asset.accessors[primitive.indices].count / 3;
  const positions = asset.accessors[primitive.attributes.POSITION];
  assert.ok(positions.min.every(Number.isFinite) && positions.max.every(Number.isFinite), 'Bounds must be finite');
}
console.log(JSON.stringify({ bytes: bytes.length, meshes: asset.meshes.length, materials: asset.materials.length, embeddedImages: asset.images.length, triangles, sockets: FIRST_MISSION.targets.length }, null, 2));
