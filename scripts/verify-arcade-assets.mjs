import fs from 'node:fs';
import assert from 'node:assert/strict';
import { FIRST_MISSION } from '../src/content.js';

let total = 0;
for (const stem of ['nesis-assault-v3', 'combat-arcade-v2']) {
  const hull = stem.startsWith('nesis'), bytes = fs.readFileSync(`public/assets/${stem}.glb`);
  total += bytes.length;
  assert.equal(bytes.readUInt32LE(0), 0x46546c67); assert.equal(bytes.readUInt32LE(4), 2); assert.equal(bytes.readUInt32LE(8), bytes.length);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
  assert.ok(json.images.every(image => Number.isInteger(image.bufferView)), 'Embedded texture required');
  assert.ok(json.materials.every(material => material.occlusionTexture), 'Baked AO required');
  const names = new Map(json.nodes.map(node => [node.name, node]));
  const required = hull ? [...FIRST_MISSION.targets.map(t => `socket_${t.id.replaceAll('-', '_')}`), ...Array.from({ length: 5 }, (_, i) => `engine_${i}`)] : ['player', 'scout', 'interceptor', 'bomber', 'missile', 'bay', 'turret', 'core', ...Array.from({ length: 6 }, (_, i) => `debris_${i}`)];
  for (const name of required) assert.ok(names.has(name), `Missing ${name}`);
  if (hull) {
    for (let i = 0; i < 5; i++) {
      const node = names.get(`engine_${i}`);
      assert.ok(node.translation.every(Number.isFinite));
      assert.ok(node.extras.radius > 0 && node.extras.direction.length === 3 && node.extras.direction.every(Number.isFinite) && Math.hypot(...node.extras.direction) > 0, 'Valid full engine socket');
    }
    for (const target of FIRST_MISSION.targets) {
      const pos = names.get(`socket_${target.id.replaceAll('-', '_')}`).translation;
      [target.mountX ?? target.x, target.mountY ?? -.55, -target.y].forEach((value, i) => assert.ok(Math.abs(value - pos[i]) < .001, `Socket ${target.id} alignment`));
    }
  } else {
    const descendants = node => [node, ...(node.children || []).flatMap(index => descendants(json.nodes[index]))];
    for (const kind of ['scout', 'interceptor', 'bomber']) {
      const meshes = descendants(names.get(kind)).filter(node => node.mesh !== undefined);
      assert.ok(meshes.reduce((n, node) => n + json.meshes[node.mesh].primitives.length, 0) <= 2, `${kind} batch budget`);
    }
    for (const kind of ['bay', 'turret', 'core']) {
      const parts = descendants(names.get(kind));
      for (const name of ['intact', 'moving', 'destroyed', ...(kind === 'bay' ? ['door_left', 'door_right'] : ['rotor'])]) assert.ok(parts.some(p => p.mesh === undefined && (p.name === name || p.name.startsWith(`${name}.`))), `${kind}/${name}`);
    }
  }
  let triangles = 0, batches = 0;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    batches++; const position = json.accessors[primitive.attributes.POSITION];
    assert.ok(position.min.every(Number.isFinite) && position.max.every(Number.isFinite));
    assert.ok(primitive.attributes.TEXCOORD_0 !== undefined);
    triangles += json.accessors[primitive.indices].count / 3;
  }
  if (hull) { assert.ok(batches <= 40); assert.ok(triangles <= 120000); }
  console.log(JSON.stringify({ asset: stem, bytes: bytes.length, triangles, batches, materials: json.materials.length }));
}
const extra=fs.readFileSync('public/assets/campaign-modules-v1.glb');
assert.equal(extra.readUInt32LE(0),0x46546c67);assert.equal(extra.readUInt32LE(8),extra.length);
const library=JSON.parse(extra.subarray(20,20+extra.readUInt32LE(12)));
for(const name of ['bridge','pylon','refinery','radar','wreck','gunship','supply']){
  const node=library.nodes.find(n=>n.name===name);assert.ok(node,`Campaign module ${name}`);
  assert.equal(node.extras.asset_id,name);assert.ok(node.extras.bounds.every(n=>Number.isFinite(n)&&n>0));
}
let extraTriangles=0,extraBatches=0;
for(const mesh of library.meshes)for(const primitive of mesh.primitives){
  extraBatches++;assert.ok(primitive.attributes.COLOR_0!==undefined,'Authored vertex palette retained');
  extraTriangles+=library.accessors[primitive.indices].count/3;
}
assert.ok(extraBatches<=16&&extraTriangles<20000&&extra.length<2000000,'Supplementary asset budget');
console.log(JSON.stringify({asset:'campaign-modules-v1',bytes:extra.length,triangles:extraTriangles,batches:extraBatches}));
total+=extra.length;
assert.ok(total < 15_000_000, 'Combined asset payload below 15 MB');
console.log(`Combined payload: ${total} bytes`);
