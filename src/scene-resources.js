// Shared combat-library resources live for the renderer's lifetime. Everything
// else belongs to its scenery/target group, including generated label textures.
export function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(node => {
    if (node.geometry && !node.geometry.userData?.sharedCombat) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      if (material.userData?.sharedCombat) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture && !value.userData?.keepAlive) textures.add(value);
    }
    if (node.isInstancedMesh) node.dispose();
  });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  root.removeFromParent();
}
