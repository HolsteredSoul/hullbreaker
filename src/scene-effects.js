import * as THREE from 'three';
import { seededRandom } from './content.js';

// Cosmetic layer only: no spawn schedules, hit volumes, or damage rules.
export class SceneEffects {
  constructor(scene, environment, targets, definition) {
    this.scene = scene;
    this.environment = environment;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(0.17, 'rgba(220,255,247,.8)'); gradient.addColorStop(0.45, 'rgba(165,240,234,.22)'); gradient.addColorStop(1, 'rgba(120,230,230,0)');
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    this.glowTexture = new THREE.CanvasTexture(canvas);
    this.glowTexture.userData.keepAlive = true;
    this.engineLights = []; this.syncEngines();
    this.coreLights = [];
    for (const [id, { group }] of targets) {
      const core = group.userData.kind === 'core';
      const sprite = this.glow(core ? 0x79ffde : 0xffa14b, 0.4);
      sprite.position.set(0, 0.65, 0); sprite.scale.setScalar(core ? 6 : 2.6); group.add(sprite);
      this.coreLights.push({ id, core, sprite });
    }
    // Flattened radial sprites approximate contact shadows beneath moving ships.
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x010609, map: this.glowTexture, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide });
    this.shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.5, 2.5).rotateX(-Math.PI / 2), shadowMaterial, 65);
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -4), 45);
    scene.add(this.shadows);
    const random = seededRandom(2771);
    this.debrisData = Array.from({ length: 64 }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (16 + random() * 20), height: -5 - random() * 9, z: random() * 95, speed: 0.8 + random() * 1.3, size: 0.1 + random() * 0.25, phase: random() * Math.PI * 2 }));
    this.debris = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x627a80, roughness: 0.9, metalness: 0.5 }), this.debrisData.length);
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debris.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -22), 100);
    scene.add(this.debris);
    const streaks = [];
    for (let i=0;i<48;i++) { const x=(i%2 ? 1:-1)*(9+random()*17), y=2+random()*5, z=random()*90-60; streaks.push(x,y,z,x,y,z+1+random()*2); }
    this.slipstream = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(streaks,3)),new THREE.LineBasicMaterial({color:0x6297aa,transparent:true,opacity:.3,depthWrite:false}));
    this.slipstream.frustumCulled=false; scene.add(this.slipstream);
    this.temp = new THREE.Object3D();
    this.addDeckMarks(definition.markings || []);
  }
  bindEnvironment(environment, targets, definition) {
    for (const { sprite, flame } of this.engineLights) {
      sprite.removeFromParent(); flame.removeFromParent(); sprite.material.dispose(); flame.geometry.dispose(); flame.material.dispose();
    }
    for (const { sprite } of this.coreLights) { sprite.removeFromParent(); sprite.material.dispose(); }
    this.engineLights = []; this.coreLights = []; this.sockets = null;
    this.environment = environment; this.syncEngines();
    for (const [id, { group }] of targets) {
      const core = group.userData.kind === 'core', sprite = this.glow(core ? 0x79ffde : 0xffa14b, .4);
      sprite.position.set(0, .65, 0); sprite.scale.setScalar(core ? 6 : 2.6); group.add(sprite);
      this.coreLights.push({ id, core, sprite });
    }
    this.addDeckMarks(definition.markings || []);
  }
  syncEngines() {
    const sockets = this.environment.group.userData.engineSockets || [];
    if (sockets === this.sockets) return;
    for (const { sprite, flame } of this.engineLights) {
      this.environment.group.remove(sprite, flame); sprite.material.dispose(); flame.geometry.dispose(); flame.material.dispose();
    }
    this.sockets = sockets;
    this.engineLights = sockets.map(socket => {
      const sprite = this.glow(0x70f5ef, .6), direction = new THREE.Vector3(...socket.direction).normalize();
      sprite.position.fromArray(socket.position); sprite.scale.setScalar(socket.radius * 4);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(socket.radius * .68, socket.radius * 5, 12).translate(0, -socket.radius * 2.5, 0), new THREE.MeshBasicMaterial({ color: 0x56e6ff, transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false }));
      flame.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction); flame.position.copy(sprite.position);
      this.environment.group.add(sprite, flame);
      return { sprite, flame, radius: socket.radius };
    });
  }
  installDebris(prepared) {
    this.debris.visible = false;
    this.scene.remove(this.debris); this.debris.geometry.dispose(); this.debris.material.dispose();
    this.debrisBatches = Array.from({ length: 6 }, (_, i) => prepared.get(`debris_${i}`).map(({ geometry, material }) => {
      const mesh = new THREE.InstancedMesh(geometry, material, 64); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -22), 100); mesh.count = 0; this.scene.add(mesh); return mesh;
    }));
  }
  glow(color, opacity) {
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTexture, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  }
  addDeckMarks(markings) {
    for (const mark of markings) {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 256;
      const context = canvas.getContext('2d'); context.fillStyle = '#9eaea3'; context.textAlign = 'center';
      context.font = 'bold 74px monospace'; context.fillText(mark.text, 256, 108);
      context.font = '22px monospace'; context.fillText(mark.sub, 256, 166);
      context.fillRect(65, 193, 382, 5); context.fillRect(65, 38, 40, 5); context.fillRect(407, 38, 40, 5);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mark.width, mark.height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.65, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(mark.x, -0.72, mark.z);
      this.environment.group.add(mesh);
    }
  }
  update(sim, time, menu, quality, reducedMotion) {
    this.slipstream.visible = !!sim.mission.pace && !menu && !reducedMotion;
    if (this.slipstream.visible) {
      const positions=this.slipstream.geometry.attributes.position, delta=Math.min(.1,Math.max(0,time-(this.flowTime ?? time)));
      for(let i=0;i<positions.count;i+=2) { let z=positions.getZ(i)+delta*(22+i*.12); const length=positions.getZ(i+1)-positions.getZ(i); if(z>30)z-=90; positions.setZ(i,z);positions.setZ(i+1,z+length); }
      positions.needsUpdate=true;
    }
    this.flowTime=time;
    this.syncEngines();
    this.engineLights.forEach(({ sprite, flame, radius }, index) => {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(time * 4 + index) * 0.06;
      sprite.scale.setScalar(radius * 4.5 * pulse);
      sprite.material.opacity = quality === 'low' ? 0.46 : 0.72;
      flame.scale.y = pulse; flame.visible = quality !== 'low';
    });
    for (const { id, core, sprite } of this.coreLights) {
      const target = sim.targets.find(t => t.id === id);
      const destroyed = !menu && target.destroyed;
      const flash = !menu && target.flash > 0;
      sprite.visible = core || destroyed || flash;
      sprite.material.color.setHex(flash ? 0xffffff : destroyed ? 0xff762e : core ? 0x79ffde : 0xffa14b);
      sprite.material.opacity = flash ? .7 : destroyed ? 0.22 : core ? 0.45 : 0;
      sprite.scale.setScalar(destroyed ? 2.7 : core ? 6 : 2.6);
    }
    let count = 0;
    const shadow = (x, y, scale) => {
      this.temp.position.set(x + 0.2, -0.82, -y + 0.3); this.temp.rotation.set(0, 0, 0); this.temp.scale.set(scale, 1, scale * 1.2); this.temp.updateMatrix(); this.shadows.setMatrixAt(count++, this.temp.matrix);
    };
    if (!menu) {
      if (sim.player.health > 0) shadow(sim.player.x, sim.player.y, 0.8);
      for (const enemy of sim.enemies) if (enemy.active) shadow(enemy.x, enemy.y, enemy.kind === 'bomber' ? 0.8 : 0.55);
    }
    this.shadows.visible = this.environment.group.userData.surfaceY !== null && !sim.turnRemaining;
    this.shadows.position.y = (this.environment.group.userData.surfaceY ?? -.85) + .85;
    this.shadows.count = count; this.shadows.instanceMatrix.needsUpdate = true;
    this.debris.visible = !reducedMotion && !this.debrisBatches;
    this.debris.count = quality === 'low' ? 18 : this.debrisData.length;
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < this.debris.count; i++) {
      const part = this.debrisData[i];
      this.temp.position.set(part.x, part.height, (part.z + time * part.speed * (!menu && sim.mission.pace ? 9 : 1)) % 95 - 65);
      this.temp.rotation.set(part.phase + time * 0.06, part.phase + time * 0.09, part.phase);
      this.temp.scale.set(part.size * 2, part.size * 2, part.size * 2); this.temp.updateMatrix();
      if (this.debrisBatches) { this.debrisBatches[i % 6].forEach(mesh => mesh.setMatrixAt(counts[i % 6], this.temp.matrix)); counts[i % 6]++; }
      else this.debris.setMatrixAt(i, this.temp.matrix);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    this.debrisBatches?.forEach((meshes, index) => meshes.forEach(mesh => { mesh.visible = !reducedMotion; mesh.count = counts[index]; mesh.instanceMatrix.needsUpdate = true; }));
  }
}
