import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createEnvironment } from './environments.js';
import { seededRandom, WEAPONS } from './content.js';
import { SceneEffects } from './scene-effects.js';
import { loadCombatAssets, batchParts, findPart, COMBAT_ASSET_URL } from './combat-assets.js';
import { disposeObject } from './scene-resources.js';
import { returnPassPose } from './flight-path.js';

function fighterGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 1.1); shape.lineTo(0.23, 0.1); shape.lineTo(1, -0.8); shape.lineTo(0.3, -0.5); shape.lineTo(0, -0.7); shape.lineTo(-0.3, -0.5); shape.lineTo(-1, -0.8); shape.lineTo(-0.23, 0.1); shape.closePath();
  const wings = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false }); wings.rotateX(-Math.PI / 2);
  const body = new THREE.BoxGeometry(0.26, 0.3, 1.4); body.translate(0, 0.16, -0.1);
  const flatBody = body.toNonIndexed();
  const geometry = mergeGeometries([wings, flatBody]); wings.dispose(); body.dispose(); flatBody.dispose(); return geometry;
}

function batch(scene, geometry, material, count) {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // All live instances stay within this fixed, conservative combat-space bound.
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -4), 55);
  mesh.count = 0; scene.add(mesh); return mesh;
}

export class GameRenderer {
  constructor(container, mission, settings) {
    this.container = container; this.mission = mission; this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x06121c); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.FogExp2(0x071823, 0.006);
    this.previewCamera = new THREE.OrthographicCamera(-25, 25, 20, -20, 0.1, 400);
    this.flightCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 400);
    this.camera = this.previewCamera;
    this.scene.add(new THREE.HemisphereLight(0x9bccdd, 0x08151d, 2.6));
    const sun = new THREE.DirectionalLight(0xf9ddbd, 3.6); sun.position.set(-20, 30, -25); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x58cfdf, 2); rim.position.set(20, 3, 20); this.scene.add(rim);
    this.environment = this.makeEnvironment(mission); this.scene.add(this.environment.group);
    this.retiredEnvironments = []; this.previewEnvironment = null;
    this.temp = new THREE.Object3D(); this.vector = new THREE.Vector3();
    this.createBackground();
    const geometry = fighterGeometry();
    this.player = new THREE.Group();
    const ship = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xc8e4dc, metalness: 0.6, roughness: 0.32 })); this.player.add(ship);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.15, 0.65), new THREE.MeshStandardMaterial({ color: 0x9cffff, emissive: 0x2abfdf, emissiveIntensity: 2 })); cockpit.position.set(0, 0.38, -0.12); this.player.add(cockpit);
    for (const x of [-0.3, 0.3]) {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 1.2, 6), new THREE.MeshBasicMaterial({ color: 0x94ffe1 })); flame.rotation.x = Math.PI / 2; flame.position.set(x, 0.08, 1); this.player.add(flame);
    }
    const hitRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.21, 20), new THREE.MeshBasicMaterial({ color: 0xd8fff1, side: THREE.DoubleSide, depthTest: false })); hitRing.rotation.x = -Math.PI / 2; hitRing.position.y = 0.48; hitRing.renderOrder = 10; this.player.add(hitRing);
    this.scene.add(this.player);
    this.fighters = batch(this.scene, geometry, new THREE.MeshStandardMaterial({ color: 0xf1a587, metalness: 0.4, roughness: 0.6, emissive: 0x35140b, emissiveIntensity: 0.4 }), 64);
    this.friendly = batch(this.scene, new THREE.BoxGeometry(0.085, 0.09, 0.85), new THREE.MeshBasicMaterial({ color: 0x9cffe4 }), 480);
    this.hostile = batch(this.scene, new THREE.SphereGeometry(0.2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff866d }), 480);
    this.missiles = batch(this.scene, new THREE.ConeGeometry(0.17, 0.7, 5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd07f }), 480);
    this.sparks = batch(this.scene, new THREE.BoxGeometry(0.09, 0.08, 0.4), new THREE.MeshBasicMaterial({ color: 0xffc880 }), 450);
    this.warnings = batch(this.scene, new THREE.BoxGeometry(0.075, 0.025, 6), new THREE.MeshBasicMaterial({ color: 0xffbe73, transparent: true, opacity: 0.7, depthWrite: false }), 68);
    this.pickupMesh = batch(this.scene, new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: 0xa1ffcf, emissive: 0x47c6a4, emissiveIntensity: 2 }), 12);
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xb9ffee, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); this.pulse.rotation.x = -Math.PI / 2; this.scene.add(this.pulse);
    this.targets = new Map(); this.createTargets(); this.createHazards();
    this.effects = new SceneEffects(this.scene, this.environment, this.targets, mission.environment);
    this.combatAsset = { status: 'loading', url: COMBAT_ASSET_URL };
    loadCombatAssets(this.combatAsset).then(registry => this.installCombatAssets(registry)).catch(error => {
      this.combatAsset.status = 'fallback'; console.warn('Combat art unavailable; retaining procedural visuals.', error);
    });
    this.raycaster = new THREE.Raycaster(); this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.resize();
  }
  installCombatAssets(registry) {
    this.registry = registry;
    // Prepare before swapping: a malformed package cannot leave a partial player.
    const prepared = new Map(['scout', 'interceptor', 'bomber', 'missile', ...Array.from({ length: 6 }, (_, i) => `debris_${i}`)].map(id => [id, batchParts(registry.get(id))]));
    const art = registry.get('player').clone(true);
    const hitRing = this.player.children.at(-1);
    const retired = [...this.player.children.filter(child => child !== hitRing), this.fighters, this.missiles];
    this.player.remove(...this.player.children); this.player.add(art, hitRing);
    this.playerExhaust = [];
    art.traverse(node => {
      if (!node.name.startsWith('exhaust_')) return;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(.11, .7, 6).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9ffff0 }));
      flame.position.z = .35; node.add(flame); this.playerExhaust.push(flame);
    });
    this.fighters.visible = false; this.missiles.visible = false;
    this.enemyBatches = new Map(['scout', 'interceptor', 'bomber'].map(kind => [kind, prepared.get(kind).map(part => batch(this.scene, part.geometry, part.material, 64))]));
    this.missileBatches = prepared.get('missile').map(part => batch(this.scene, part.geometry, part.material, 480));
    this.installTargetAssets();
    this.effects.installDebris(prepared);
    this.scene.remove(this.fighters, this.missiles);
    const geometries = new Set(), materials = new Set();
    retired.forEach(root => root.traverse(node => { if (node.isMesh) { geometries.add(node.geometry); materials.add(node.material); } }));
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
  }
  installTargetAssets() {
    if (!this.registry) return;
    for (const { group } of this.targets.values()) {
      const kind = group.userData.kind;
      if (kind === 'launcher' || group.userData.imported) continue;
      const root = this.registry.get(kind === 'battery' ? 'turret' : kind === 'coolant' ? 'core' : kind).clone(true);
      for (const child of [...group.children]) if (!child.isSprite) disposeObject(child);
      group.add(root);
      const intact = findPart(root, 'intact'), moving = findPart(root, 'moving'), wreck = findPart(root, 'destroyed'); wreck.visible = false;
      const doors = kind === 'bay' ? ['door_left', 'door_right'].map(name => { const door = findPart(root, name); door.userData.closedX = door.position.x; return door; }) : [];
      group.userData = { kind, imported: true, intact, moving, wreck, doors, rotor: kind === 'bay' ? null : findPart(root, 'rotor') };
    }
  }
  makeEnvironment(mission) {
    return createEnvironment({ ...mission.environment, hardpoints: mission.targets.map(target => ({ id: target.id, socketId: target.socketId, x: target.mountX ?? target.x, y: target.mountY ?? -.55, z: -target.y, radius: target.radius })) });
  }
  setMission(mission, preserveOutgoing = false) {
    const oldEnvironment = this.environment;
    for (const { group, label, relay, shield } of this.targets.values()) {
      label.remove(); disposeObject(group); if (relay) disposeObject(relay); if (shield) disposeObject(shield);
    }
    this.hazards.forEach(({ group }) => disposeObject(group));
    if (preserveOutgoing) this.retiredEnvironments.push({ environment: oldEnvironment, distance: oldEnvironment.group.position.z, age: 0 });
    else {
      oldEnvironment.dispose();
      for (const old of this.retiredEnvironments) old.environment.dispose();
      this.retiredEnvironments = [];
    }
    if (this.previewEnvironment?.mission === mission) {
      this.environment = this.previewEnvironment.environment; this.previewEnvironment = null;
    } else {
      this.previewEnvironment?.environment.dispose(); this.previewEnvironment = null;
      this.environment = this.makeEnvironment(mission); this.scene.add(this.environment.group);
    }
    this.mission = mission; this.targets = new Map(); this.createTargets(); this.createHazards();
    this.effects.bindEnvironment(this.environment, this.targets, mission.environment);
    this.installTargetAssets();
  }
  updateScenery(sim, sceneTime, visualDelta, menu) {
    let distance = sim.distance;
    if (sim.turnRemaining > 0) {
      // The installation never moves during the cinematic. At its end the
      // camera, fighter and installation rebase together onto the entry origin.
      distance = this.settings.reducedMotion && sim.turnRemaining < sim.turnDuration / 2 ? sim.routeDistance(0) : sim.turnDistance;
    }
    this.environment.update(sceneTime, distance, menu, this.settings.reducedMotion);
    if (!menu && sim.nextMission && sim.time >= sim.mission.duration - 14 && !this.previewEnvironment) {
      this.previewEnvironment = { mission: sim.nextMission, environment: this.makeEnvironment(sim.nextMission) };
      this.scene.add(this.previewEnvironment.environment.group);
    }
    if (this.previewEnvironment) {
      const next = this.previewEnvironment;
      next.environment.update(sceneTime, sim.distance - sim.mission.route.at(-1).distance + next.mission.route[0].distance, false);
    }
    for (const old of this.retiredEnvironments) {
      old.age += visualDelta; old.environment.group.position.z = old.distance + old.age * 18;
      if (old.age >= 6) old.environment.dispose();
    }
    this.retiredEnvironments = this.retiredEnvironments.filter(old => old.age < 6);
  }
  createBackground() {
    const random = seededRandom(891); const points = [];
    for (let i = 0; i < 1300; i++) points.push((random() - 0.5) * 350, -35 - random() * 65, (random() - 0.5) * 350);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.stars = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xbbd8dd, size: 0.18, transparent: true, opacity: 0.65, sizeAttenuation: true })); this.scene.add(this.stars);
    const planet = new THREE.Mesh(new THREE.SphereGeometry(32, 48, 24), new THREE.MeshStandardMaterial({ color: 0x264450, roughness: 1, metalness: 0 })); planet.position.set(55, -45, -100); this.scene.add(planet);
    this.planet = planet; this.planetOrigin = planet.position.clone();
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(32.8, 40, 20), new THREE.MeshBasicMaterial({ color: 0x4b8793, transparent: true, opacity: 0.12, side: THREE.BackSide, depthWrite: false })); planet.add(atmosphere);
  }
  createTargets() {
    const labels = document.querySelector('#target-labels');
    for (const target of this.mission.targets) {
      const group = new THREE.Group();
      const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x1b2b30, metalness: 0.7, roughness: 0.6 });
      const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xe7bd71, emissive: 0xd88c38, emissiveIntensity: 1.2 });
      const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x080f13, roughness: 0.9 });
      if (target.kind === 'bay') {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 3.7), baseMaterial); group.add(frame);
        const hole = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.1, 2.8), darkMaterial); hole.position.y = 0.26; group.add(hole);
        const door = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.13, 2.5), new THREE.MeshStandardMaterial({ color: 0x687a74, roughness: 0.7, metalness: 0.5 })); door.position.y = 0.35; group.add(door); group.userData.door = door;
        for (const side of [-1, 1]) { const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 2.8), lightMaterial); strip.position.set(side * 1.5, 0.3, 0); group.add(strip); }
      } else {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(target.radius, target.radius + 0.3, 0.5, 16), baseMaterial); group.add(base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(target.radius * 0.8, 0.1, 6, 24), lightMaterial); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35; group.add(ring);
        if (target.kind === 'core') {
          const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), new THREE.MeshStandardMaterial({ color: 0x92f3de, emissive: 0x52efdf, emissiveIntensity: 2.5, metalness: 0.4, roughness: 0.15 })); crystal.position.y = 1.2; group.add(crystal); group.userData.rotor = crystal;
        } else if (target.kind === 'launcher') {
          const rack = new THREE.Group(); group.add(rack);
          for (const x of [-.55, .55]) for (const y of [.6, 1.15]) {
            const tube = new THREE.Mesh(new THREE.CylinderGeometry(.25, .3, 1.7, 8).rotateX(Math.PI / 2), baseMaterial);
            tube.position.set(x, y, 0); rack.add(tube);
            const cap = new THREE.Mesh(new THREE.CircleGeometry(.19, 8), lightMaterial); cap.position.set(x, y, -.86); cap.rotation.y = Math.PI; rack.add(cap);
          }
          group.userData.rotor = rack;
        } else {
          const cannon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 2.2), baseMaterial); cannon.position.set(0, 0.65, 0.5); group.add(cannon); group.userData.rotor = cannon;
        }
      }
      group.userData.light = lightMaterial;
      group.userData.kind = target.kind;
      const wreck = new THREE.Group(); wreck.visible = false;
      const scorched = new THREE.MeshStandardMaterial({ color: 0x171b1b, metalness: 0.5, roughness: 1 });
      const crater = new THREE.Mesh(new THREE.CylinderGeometry(target.radius * 0.75, target.radius * 0.9, 0.16, 9), scorched); crater.position.y = 0.33; wreck.add(crater);
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + 0.3;
        const shard = new THREE.Mesh(new THREE.BoxGeometry(target.radius * 0.65, 0.18, 0.6), scorched);
        shard.position.set(Math.sin(angle) * target.radius * 0.6, 0.48, Math.cos(angle) * target.radius * 0.6); shard.rotation.set(i % 2 ? 0.3 : -0.25, angle, 0.18); wreck.add(shard);
        const ember = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.35), new THREE.MeshBasicMaterial({ color: 0xffa356 })); ember.position.set(Math.sin(angle) * 0.6, 0.44, Math.cos(angle) * 0.6); ember.rotation.y = angle; wreck.add(ember);
      }
      group.add(wreck); group.userData.wreck = wreck;
      group.position.set(target.mountX ?? target.x, target.mountY ?? -0.55, -target.y); group.scale.setScalar(target.scale || 1); this.scene.add(group);
      const label = document.createElement('div'); label.className = 'target-label'; label.innerHTML = `${target.label}<div><i></i></div>`; label.hidden = true; labels.append(label);
      let relay = null, shield = null;
      if (target.kind === 'battery') {
        relay = new THREE.Group();
        const node = new THREE.Mesh(new THREE.TorusGeometry(.65,.12,6,16), new THREE.MeshBasicMaterial({color:0xffbd70,depthTest:false})); node.rotation.x = Math.PI/2; relay.add(node);
        const link = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(target.mountX-target.x,.15,0)]),new THREE.LineBasicMaterial({color:0xffbd70,transparent:true,opacity:.6,depthTest:false})); relay.add(link); relay.renderOrder=4; this.scene.add(relay);
      }
      if (target.kind === 'core' && (this.mission.boss || target.gates)) {
        shield = new THREE.Mesh(new THREE.SphereGeometry(2.5,20,12),new THREE.MeshBasicMaterial({color:0x60bbff,transparent:true,opacity:.16,wireframe:true,depthWrite:false})); this.scene.add(shield);
      }
      this.targets.set(target.id, { group, label, relay, shield, bar: label.querySelector('i') });
    }
  }
  createHazards() {
    this.hazards = this.mission.hazards.map(hazard => {
      const group = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({ color: 0xf6a154, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide });
      const length = hazard.zone === 'full' ? 24 : 11;
      const lane = new THREE.Mesh(new THREE.PlaneGeometry(hazard.width, length), mat); lane.rotation.x = -Math.PI / 2; lane.position.set(hazard.x, 0.1, hazard.zone === 'full' ? -1 : 7); group.add(lane);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(hazard.width, length)), new THREE.LineBasicMaterial({ color: 0xe7bd71, transparent: true, opacity: 0.5 })); edges.rotation.x = -Math.PI / 2; edges.position.copy(lane.position); group.add(edges); this.scene.add(group);
      return { definition: hazard, group, material: mat };
    });
  }
  resize() {
    this.width = this.container.clientWidth; this.height = this.container.clientHeight;
    this.renderer.setSize(this.width, this.height);
    this.setQuality(this.settings.quality);
  }
  setQuality(quality) {
    const cap = quality === 'low' ? 0.85 : quality === 'high' ? 1.75 : (this.width < 700 ? 1.2 : 1.5);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap)); this.quality = quality;
  }
  setCamera(menu, time, player) {
    const aspect = this.width / this.height;
    this.camera = menu ? this.previewCamera : this.flightCamera;
    if (menu) {
      const height = Math.max(80, 68 / aspect);
      this.camera.left = -height * aspect / 2; this.camera.right = height * aspect / 2; this.camera.top = height / 2; this.camera.bottom = -height / 2;
      this.camera.position.set(43, 58, 40); this.camera.lookAt(-6, -2, -28);
      this.camera.zoom = 1;
    } else {
      // 60 degrees above the hull (90 would be straight down). Perspective
      // exposes sidewalls and makes the hull recede while preserving the field.
      const elevation = Math.PI / 3;
      const distance = Math.max(34, 6 + 9.8 / (Math.tan(25 * Math.PI / 180) * aspect));
      this.camera.aspect = aspect;
      this.camera.position.set(0, Math.sin(elevation) * distance, -3 + Math.cos(elevation) * distance);
      this.camera.lookAt(0, 0, -3);
      if (!this.settings.reducedMotion) this.camera.rotateZ(-player.x * 0.003);
    }
    this.camera.updateProjectionMatrix(); this.camera.updateMatrixWorld();
  }
  pointerToWorld(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.plane, this.vector);
    return hit ? { x: hit.x, y: -hit.z } : { x: 0, y: 0 };
  }
  instance(mesh, index, x, y, scale = 1, angle = 0, height = 0) {
    this.temp.position.set(x, height, -y); this.temp.rotation.set(0, angle, 0); this.temp.scale.setScalar(scale); this.temp.updateMatrix(); mesh.setMatrixAt(index, this.temp.matrix);
  }
  finishBatch(mesh, count) { mesh.count = count; mesh.instanceMatrix.needsUpdate = true; }
  render(sim, elapsed, menu = false) {
    if (sim.mission !== this.mission) this.setMission(sim.mission, !menu && this.currentSimulation === sim);
    this.currentSimulation = sim;
    const sceneTime = menu ? elapsed : (sim.campaignTime ?? sim.time);
    const visualDelta = Math.min(0.05, Math.max(0, sceneTime - (this.lastSceneTime ?? sceneTime)));
    this.lastSceneTime = sceneTime;
    this.setCamera(menu, elapsed, sim.player);
    const turning = !menu && sim.turnRemaining > 0;
    const turnProgress = turning ? 1 - sim.turnRemaining / sim.turnDuration : 0;
    const pose = turning && !this.settings.reducedMotion ? returnPassPose(turnProgress, sim.turnOrigin, sim.turnDistance - sim.routeDistance(0)) : null;
    this.renderer.domElement.style.opacity = turning && this.settings.reducedMotion ? String(Math.abs(2 * turnProgress - 1) ** .7) : '1';
    this.stars.position.set(0, 0, 0); this.planet.position.copy(this.planetOrigin);
    if (pose) {
      const origin = new THREE.Vector3(sim.turnOrigin.x, 0, -sim.turnOrigin.y), position = new THREE.Vector3(pose.x, pose.y, pose.z);
      const axis = new THREE.Vector3(0, 1, 0), heading = pose.heading - pose.bank * .15;
      const focus = new THREE.Vector3(0, 0, -3).sub(origin).applyAxisAngle(axis, heading).add(position);
      this.camera.position.sub(origin).applyAxisAngle(axis, heading).add(position);
      this.camera.lookAt(focus); this.camera.rotateZ(-sim.player.x * .003 - pose.bank * .08); this.camera.updateMatrixWorld();
      // Stars and the distant planet behave as a sky backdrop, with no near
      // parallax or discontinuity when the local coordinate origin is rebased.
      const offset = position.clone().sub(origin); this.stars.position.copy(offset); this.planet.position.add(offset);
    }
    this.updateScenery(sim, sceneTime, visualDelta, menu);
    this.stars.rotation.y = sceneTime * 0.0003;
    this.player.position.set(menu ? 12 : sim.player.x, 0, menu ? 7 : -sim.player.y);
    this.player.scale.setScalar(this.mission.pace?.fighterScale ?? 1);
    const bank = menu ? .2 : this.settings.reducedMotion ? 0 : THREE.MathUtils.clamp(-(sim.player.vx || 0)*.025,-.32,.32);
    this.player.rotation.z = THREE.MathUtils.damp(this.player.rotation.z, bank, 12, visualDelta);
    this.player.rotation.x = 0; this.player.rotation.y = 0; this.player.rotation.order = 'YXZ';
    if (pose) { this.player.position.set(pose.x, pose.y, pose.z); this.player.rotation.set(pose.pitch, pose.heading, pose.bank, 'YXZ'); }
    this.player.visible = menu || sim.player.health > 0;
    for (const child of this.player.children.slice(0,-1)) child.visible = menu || sim.turnRemaining > 0 || sim.player.invulnerable <= 0 || Math.sin(elapsed * 30) > -.3;
    this.playerExhaust?.forEach((flame, i) => { flame.scale.z = this.settings.reducedMotion ? 1 : .85 + Math.sin(sceneTime * 18 + i) * .15; });
    let n = 0;
    if (this.enemyBatches) {
      for (const [kind, meshes] of this.enemyBatches) {
        n = 0;
        for (const enemy of sim.enemies) if (enemy.active && !menu && enemy.kind === kind) {
          for (const mesh of meshes) this.instance(mesh, n, enemy.x, enemy.y, kind === 'bomber' ? .82 : .62, enemy.angle ?? Math.PI, -Math.max(0,1-enemy.age/(enemy.entry || .001)));
          n++;
        }
        meshes.forEach(mesh => this.finishBatch(mesh, n));
      }
    } else { for (const enemy of sim.enemies) if (enemy.active && !menu) this.instance(this.fighters, n++, enemy.x, enemy.y, enemy.kind === 'bomber' ? 0.9 : 0.62, enemy.angle ?? Math.PI); this.finishBatch(this.fighters, n); }
    n = 0;
    for (const enemy of sim.enemies) if (!menu && enemy.active && enemy.kind === 'interceptor' && enemy.age > (sim.mission.pace ? .65 : 1.1) && enemy.age < (sim.mission.pace ? 1.5 : 2)) this.instance(this.warnings, n++, enemy.x, enemy.y - 3, 1, 0, 0.1);
    for (const target of sim.targets) if (!menu && !['bay','coolant'].includes(target.kind) && sim.targetVisible(target) && target.nextAt - sim.time < 1.2) {
      if (target.kind === 'battery' || target.kind === 'launcher') {
        const x = target.mountX ?? target.x, dx = target.aimX-x, dy = target.aimY-target.y;
        this.temp.position.set(x+dx/2,.18,-target.y-dy/2); this.temp.rotation.set(0,target.aimAngle,0); this.temp.scale.set(1,1,Math.hypot(dx,dy)/6); this.temp.updateMatrix(); this.warnings.setMatrixAt(n++,this.temp.matrix);
      } else this.instance(this.warnings,n++,target.x,target.y-3,1.2,0,.1);
    }
    this.finishBatch(this.warnings, n);
    let f = 0, h = 0, m = 0;
    this.friendly.material.color.setHex(WEAPONS[sim.weapon].color);
    for (const shot of sim.shots) if (shot.active && !menu) {
      const angle = -Math.atan2(shot.vx, shot.vy);
      if (shot.friendly) this.instance(this.friendly, f++, shot.x, shot.y, sim.weapon === 'laser' ? 1.3 : 1, angle);
      else if (shot.missile) { for (const mesh of this.missileBatches || [this.missiles]) this.instance(mesh, m, shot.x, shot.y, 1.3, angle, (shot.height || 0) * Math.max(0, 1 - shot.age / (shot.entry || 1))); m++; }
      else this.instance(this.hostile, h++, shot.x, shot.y, 1, angle, (shot.height || 0) * Math.max(0,1-shot.age/(shot.entry || 1)));
    }
    this.finishBatch(this.friendly, f); this.finishBatch(this.hostile, h); this.finishBatch(this.missiles, m);
    this.missileBatches?.forEach(mesh => this.finishBatch(mesh, m));
    n = 0; const maxSparks = this.quality === 'low' ? 90 : 450;
    for (const spark of sim.particles) if (spark.active && !menu && n < maxSparks) this.instance(this.sparks, n++, spark.x, spark.y, 1 - spark.age / spark.life, -Math.atan2(spark.vx, spark.vy), 0.2); this.finishBatch(this.sparks, n);
    n = 0; for (const pickup of sim.pickups) if (pickup.active && !menu) this.instance(this.pickupMesh, n++, pickup.x, pickup.y, 0.8 + Math.sin(elapsed * 5) * 0.1, elapsed * 2, 0.6); this.finishBatch(this.pickupMesh, n);
    for (const target of sim.targets) {
      const { group, label, bar, relay, shield } = this.targets.get(target.id);
      group.position.z = -(menu ? target.anchorY : target.y);
      const destroyed = !menu && target.destroyed;
      if (relay) { relay.position.set(target.x,.18,-target.y); relay.visible = !menu && sim.targetVisible(target); }
      if (shield) { shield.position.set(target.x,.65,-target.y); shield.visible = !menu && sim.targetVisible(target) && sim.isTargetShielded(target) && !sim.turnRemaining; }
      group.visible = true;
      if (turning && this.settings.reducedMotion && turnProgress > .5) group.position.z = sim.routeDistance(0) - target.anchorY;
      if (relay && sim.turnRemaining) relay.visible = false;
      group.userData.wreck.visible = destroyed;
      if (group.userData.imported) {
        group.userData.intact.visible = !destroyed; group.userData.moving.visible = !destroyed;
        const opening = !menu && !destroyed && target.nextAt - sim.time < 1.5;
        for (const door of group.userData.doors) {
          const closed = door.userData.closedX;
          door.position.x = THREE.MathUtils.damp(door.position.x, closed + (opening ? Math.sign(closed) * 1.1 : 0), 7, visualDelta);
        }
        if (group.userData.rotor) group.userData.rotor.rotation.y = target.kind === 'battery' ? (target.aimAngle || 0) : this.settings.reducedMotion ? 0 : sceneTime * .7;
      } else {
      group.userData.light.emissiveIntensity = destroyed ? 0 : target.flash > 0 ? 4 : 1.2;
      group.userData.light.color.setHex(destroyed ? 0x1a2529 : 0xe7bd71);
      if (group.userData.door) {
        const opening = !menu && !destroyed && target.nextAt - sim.time < 1.5;
        const door = group.userData.door; door.visible = !destroyed;
        door.scale.z = THREE.MathUtils.damp(door.scale.z, opening ? 0.18 : 0.9, 7, visualDelta);
        door.position.z = THREE.MathUtils.damp(door.position.z, opening ? -1 : 0, 7, visualDelta);
      }
      if (group.userData.rotor) { group.userData.rotor.visible = !destroyed; group.userData.rotor.rotation.y = ['battery', 'launcher'].includes(target.kind) ? (target.aimAngle || 0) : this.settings.reducedMotion ? 0 : sceneTime * 0.7; }
      }
      label.hidden = menu || !sim.targetVisible(target) || !!sim.turnRemaining;
      if (!label.hidden) {
        this.vector.set(target.x, 0.5, -target.y - target.radius).project(this.camera);
        label.style.transform = `translate(${(this.vector.x * 0.5 + 0.5) * this.width}px,${(-this.vector.y * 0.5 + 0.5) * this.height - 22}px) translateX(-50%)`;
        bar.style.width = `${target.hp / target.maxHp * 100}%`;
      }
    }
    this.hazards.forEach(({ definition, group, material }) => { const state = sim.hazardState(definition); group.visible = !menu && state !== 'off'; material.opacity = state === 'active' ? .38 : .07; });
    this.pulse.visible = !menu && sim.bombFlash > 0 && !this.settings.reducedMotion;
    this.pulse.position.set(sim.player.x, 0.5, -sim.player.y); this.pulse.scale.setScalar(1 + (1 - sim.bombFlash) * 24); this.pulse.material.opacity = sim.bombFlash * 0.65;
    this.effects.update(sim, sceneTime, menu, this.quality, this.settings.reducedMotion);
    this.renderer.render(this.scene, this.camera);
  }
}
