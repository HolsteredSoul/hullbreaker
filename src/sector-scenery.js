import { sectorLayout, sectorModules } from './sector-layout.js';
import { loadCampaignArt } from './campaign-art.js';
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
  const layout = sectorLayout(definition, random);
  group.userData.engineSockets = layout.engines;
  for (const p of layout.pieces) {
    const geometry = p.shape === 'box' ? new THREE.BoxGeometry(1,1,1) : p.shape === 'rock' ? new THREE.IcosahedronGeometry(.5,0) : p.shape === 'disc' ? new THREE.CircleGeometry(1,7).rotateX(-Math.PI/2) : new THREE.TorusGeometry(1,.18,5,12).rotateX(Math.PI/2);
    add(geometry,p.x,p.y,p.z,p.w,p.h,p.d,p.material,p.rotation);
  }
  const used = new Set();
  for (const bucket of buckets.values()) {
    const geometry = mergeGeometries(bucket.geometry); bucket.geometry.forEach(g => g.dispose());
    group.add(new THREE.Mesh(geometry, materials[bucket.material])); used.add(bucket.material);
  }
  materials.forEach((material, i) => { if (!used.has(i)) material.dispose(); });
  group.userData.asset.meshCount = group.children.length;
  let disposed=false;
  const modules=new Map();
  for(const definitionModule of sectorModules(definition)){
    const m=new THREE.Group();m.position.set(definitionModule.x,definitionModule.y,definitionModule.z);
    const fallback=new THREE.Mesh(new THREE.BoxGeometry(definitionModule.w,definitionModule.h,definitionModule.d).translate(0,definitionModule.h/2,0),new THREE.MeshStandardMaterial({color:definitionModule.destructible?0xd49a55:0x536e7a,roughness:.6}));m.add(fallback);
    if(definitionModule.destructible){const ring=new THREE.Mesh(new THREE.RingGeometry(1.45,1.55,4).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffb64f,side:THREE.DoubleSide}));ring.position.y=.72;m.add(ring);}
    group.add(m);modules.set(definitionModule.id,{group:m,fallback,definition:definitionModule});
  }
  group.userData.supplement={status:'loading'};
  loadCampaignArt().then(registry=>{
    if(disposed)return;
    for(const m of modules.values()){
      disposeObject(m.fallback);
      for(const part of registry.get(m.definition.asset))m.group.add(new THREE.Mesh(part.geometry,part.material));
    }
    group.userData.supplement.status='ready';
  }).catch(()=>{if(!disposed)group.userData.supplement.status='fallback';});
  return { group, targetBindings: new Map(),
    setObstacles(states){for(const [id,m] of modules){const state=states.find(o=>o.id.endsWith('/'+id));m.group.visible=!state?.destroyed;}},
    update(time, distance, menu) { group.position.z = menu ? 0 : distance; }, dispose() { disposed=true;disposeObject(group); } };
}
