import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { batchParts } from './combat-assets.js';
import { assetUrl } from './asset-url.js';
export const CAMPAIGN_ART_URL='/assets/campaign-modules-v1.glb';
let pending;
export function loadCampaignArt(){
  pending??=new GLTFLoader().loadAsync(assetUrl(CAMPAIGN_ART_URL)).then(gltf=>{
    const registry=new Map();
    for(const id of ['bridge','pylon','refinery','radar','wreck','gunship','supply']){
      const root=gltf.scene.getObjectByName(id);if(!root)throw new Error(`Missing campaign asset ${id}`);
      const parts=batchParts(root);
      for(const part of parts){part.geometry.userData.sharedCombat=true;part.material.userData.sharedCombat=true;}
      registry.set(id,parts);
    }
    return registry;
  });
  return pending;
}
