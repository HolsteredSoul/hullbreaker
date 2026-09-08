// Designed squads compile into a schedule. Each role has its own readable attack.
export const SQUADS = {
  'double-vee': [[-5,18,'scout'],[-2.5,16,'scout'],[0,18,'scout'],[2.5,16,'scout'],[5,18,'scout']],
  'pincer': [[-7,17,'interceptor','pincer'],[7,17,'interceptor','pincer'],[-5.5,20,'scout'],[5.5,20,'scout']],
  'gunship-screen': [[0,19,'gunship','hold'],[-5,16,'scout'],[5,16,'scout'],[-2.5,21,'scout'],[2.5,21,'scout']],
  'bomber-wall': [[-4.5,19,'bomber'],[4.5,20,'bomber'],[0,16,'scout'],[-7,22,'interceptor'],[7,22,'interceptor']],
  'sweeping-six': [[-7,17,'scout','sweep'],[-4.3,19,'scout','sweep'],[-1.6,21,'scout','sweep'],[1.1,23,'scout','sweep'],[3.8,25,'scout','sweep'],[6.5,27,'scout','sweep']],
  'crossing-pair': [[-6,17,'gunship','cross'],[6,20,'gunship','cross'],[-5,22,'interceptor'],[5,22,'interceptor']],
  'supply-escort': [[0,20,'supply'],[-5,17,'scout'],[5,17,'scout'],[-3,23,'interceptor'],[3,23,'interceptor']],
};
export function campaignWaves(random, duration, levelIndex, assault = false) {
  const choices = ['double-vee','pincer','gunship-screen','bomber-wall','sweeping-six','crossing-pair'];
  const result = [];
  const supplies = ['weapon', 'shield', 'hull', 'power', 'pulse'];
  let last = -1;
  for (let at = .8, beat = 0; at < duration - 2; beat++) {
    let index = Math.floor(random() * choices.length);
    if (index === last) index = (index + 1) % choices.length;
    const supply = beat % 5 === 1;
    result.push({ at, pattern: supply ? 'supply-escort' : choices[index], side: random() < .5 ? -1 : 1,
      rewardType: supplies[(Math.floor(beat / 5) + levelIndex) % supplies.length], bonus: 400 + levelIndex * 100 });
    last = index;
    at += beat % 6 === 5 ? 3.6 : Math.max(1.65, 2.6 - levelIndex * .18) + random() * .35;
  }
  return result;
}
