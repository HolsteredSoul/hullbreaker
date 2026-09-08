import { sweepBox } from './collision.js';

export const enemyRadius = enemy => enemy.kind === 'gunship' ? 1.2 : enemy.kind === 'bomber' ? .9 : .6;
// Plan in installation coordinates: scrolling must not move a wall through a holding fighter.
export function steerAroundScenery(enemy, preferred, obstacles, distance, scrollSpeed, source = null) {
  const radius = enemyRadius(enemy) + .18, worldY = enemy.y + distance, horizon = 1.65;
  const nearby = obstacles.filter(o => !o.destroyed && o.source !== source && o.bottom <= .2 && o.top >= -.2 &&
    Math.abs(o.x-enemy.x) < o.w/2 + 12 && Math.abs(o.y-worldY) < o.d/2 + 26);
  if (!nearby.length) return preferred;
  const clear = (vx, vy) => {
    const x = enemy.x + vx*horizon, y = worldY + (vy+scrollSpeed)*horizon;
    if (Math.abs(x) > 8.1) return false;
    return !nearby.some(o => Number.isFinite(sweepBox(enemy.x, worldY, x, y, o, radius, 0, 0, .2)));
  };
  if (clear(preferred.vx, preferred.vy)) { enemy.avoiding = false; return preferred; }
  const candidates = [];
  for (const vy of [preferred.vy, preferred.vy*.4-scrollSpeed*.6, -scrollSpeed]) {
    for (const vx of [preferred.vx, 0, -3, 3, -6, 6]) {
      const score = Math.abs(vx-preferred.vx)*.6 + Math.abs(vy-preferred.vy)*1.2 + Math.abs(vx-(enemy.navVx||0))*.2;
      candidates.push({vx,vy,score});
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  const choice = candidates.find(c=>clear(c.vx,c.vy));
  enemy.avoiding = true;
  if (choice) { enemy.navVx = choice.vx; return choice; }
  // Brake in world space if boxed in. Collision remains authoritative, including unexpected overlaps.
  enemy.navVx = 0;
  return {vx:0,vy:-scrollSpeed};
}

export function clearSpawnX(x, y, radius, obstacles, source = null) {
  for (const candidate of [x, x-2, x+2, x-4, x+4, 0, -6, 6]) {
    if (Math.abs(candidate)>7.5) continue;
    if (!obstacles.some(o=>!o.destroyed && (!source || o.source!==source) && Number.isFinite(sweepBox(candidate,y,candidate,y,o,radius+.18,0,0,.2)))) return candidate;
  }
  return null;
}
