// Shared geometry description: visual surfaces and collision volumes use the same coordinates.
export function sectorLayout(definition, random) {
  const type=definition.type, variant=definition.variant, pieces=[], engines=[];
  const box=(x,y,z,w,h,d,material=0,rotation=0)=>pieces.push({shape:'box',x,y,z,w,h,d,material,rotation});
  const rock=(x,y,z,size,material=0)=>{
    // Keep the full rotated rock bounds outside the authored combat deck.
    const rotation=random()*6, halfWidth=size*Math.abs(Math.cos(rotation))+size*1.4*Math.abs(Math.sin(rotation));
    pieces.push({shape:'rock',x:Math.sign(x)*Math.max(Math.abs(x),9+halfWidth),y,z,w:size*2,h:size*1.4,d:size*2.8,material,rotation});
  };
  const add=(shape,x,y,z,w,h,d,material,rotation)=>pieces.push({shape,x,y,z,w,h,d,material,rotation});
  if (type === 'space') {
    if (variant === 'wreckage') {
      for (let i = 0; i < 45; i++) {
        const side = i % 2 ? -1 : 1, z = 20 - random() * 160;
        box(side * (12 + random() * 18), -5 - random() * 10, z, 1 + random() * 4, .5 + random(), 2 + random() * 6, i % 4, random() * 6);
      }
    }
  } else if (type === 'capital') {
    const width = variant === 'cruiser' ? 8.8 : variant === 'command' ? 12.8 : 11.5;
    box(0, -2.8, -38, width * 1.7, 4, 108, 2);
    box(0, -1.55, -38, width * 2, 1.4, 104, 0);
    box(0, -.94, -38, 13, .15, 100, 1);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const z = 5 - i * 11;
        box(side * (width - 1.5), -.6, z, 3, 1.5 + (i % 3) * .6, 8, i % 2);
        box(side * (width - .05), -1, z, .12, .15, 6, 4);
        if (variant !== 'cruiser' && i > 1 && i < 5) box(side * (width + 1.8), -2, z, 5, 2.5, 8, 2);
      }
      box(side * 8.1, -1.7, 9, 3.2, 3, 13, 0);
      box(side * 8.1, -1.5, 16, 2.2, 1.5, .15, 4);
      engines.push({ position: [side * 8.1, -1.5, 16.3], direction: [0, 0, 1], radius: 1 });
    }
    box(0, -1.5, -95, width * 1.15, 2.2, 12, 0);
    for (let i = 0; i < 24; i++) box((i % 2 ? -1 : 1) * 6, -.8, 8 - i * 4.2, .1, .05, 1.1, 5);
  } else if (type === 'station') {
    box(0, -2.1, -50, 50, 2.5, 144, 2);
    box(0, -.99, -50, 19, .2, 143, 0);
    for (const side of [-1, 1]) for (let i = 0; i < 11; i++) {
      const z = 11 - i * 13, height = 4 + (i % 3) * 1.3;
      box(side * 13, i%2?height/2-1:-.65, z, 6.5, i%2?height:.4, 11, i % 2);
      box(side * 9.65, -.1, z, .25, 1, 9, 4);
      if(i%2)box(side * 15, height - .5, z, 9, .6, 4, 2);
      box(side * 20, 1.7, z - 2, 6, 5, 6, 0);
      box(side * 10.8, height - .3, z + 4.5, 2, .15, .3, 5);
      if (variant === 'docks') box(side * 13, -.3, z, 5, .3, 6, 2);
    }
    for (let i = 0; i < 12; i++) box(0, -.86, 10 - i * 11, 18.5, .04, .16, 1);
  } else if (type === 'moon') {
    box(0, -2.3, -50, 100, 2.8, 150, 0);
    for (let i = 0; i < 28; i++) {
      const x = (random() - .5) * 18, z = 14 - random() * 135;
      add('disc', x, -.885, z, 1.5 + random() * 2, 1, .6 + random(), 2, random() * 6);
    }
    for (let i = 0; i < 65; i++) {
      const x = (i % 2 ? 1 : -1) * (11 + random() * 34), z = 20 - random() * 150;
      rock(x, -1.4, z, 2 + random() * 5, i % 3);
    }
    for (let i = 0; i < 15; i++) {
      const x = (i % 2 ? -1 : 1) * (15 + random() * 25), z = 10 - random() * 130;
      add('ring', x, -.72, z, 3.5, 1.3, 3.5, 1);
    }
    if (variant !== 'craters') for (const side of [-1, 1]) for (let i = 0; i < 10; i++) {
      box(side * 11.5, .6, 8 - i * 13, 4.5, 3, 11, 2);
      box(side * 9.2, -.2, 8 - i * 13, .15, .15, 7, 5);
    }
    for (const t of definition.hardpoints || []) box(t.x, -1.1, t.z, 4, .55, 4, 2);
    if (variant === 'fortress') {
      box(0, -1.25, -69, 17, .8, 22, 2);
      for (const side of [-1, 1]) box(side * 13, 1.8, -70, 7, 5.5, 20, 1);
    }
  }

  return {pieces,engines};
}

// Bounds match the Blender module roots; a clear center lane always remains.
export const MODULE_BOUNDS = {
  bridge: {w:4,h:5,d:8}, pylon: {w:4,h:7,d:5}, refinery: {w:5,h:5,d:6},
  radar: {w:5,h:5,d:5}, wreck: {w:2.4,h:1.6,d:3.5},
};
export function sectorModules(definition) {
  const type=definition.type, variant=definition.variant, modules=[];
  const put=(asset,x,z,y=-.85)=>modules.push({asset,x,y,z,...MODULE_BOUNDS[asset]});
  if(type==='capital' && variant!=='nesis') {
    put('bridge',variant==='carrier'?8.5:-8.2,-75);
    for(const side of [-1,1])for(const z of [-10,-43])put('refinery',side*12.8,z,-1.2);
  }
  if(type==='station')for(const side of [-1,1])for(let i=0;i<6;i++)put(i%2?'refinery':'pylon',side*12,11-i*26);
  if(type==='moon')for(const side of [-1,1])for(const z of [-12,-55,-91])put(variant==='craters'?'radar':'refinery',side*13,z);
  if(variant==='wreckage')for(const [x,z] of [[-4,-8],[4,-29],[-3,-53],[5,-76]])put('wreck',x,z,-.7);
  if(type==='capital'&&variant!=='nesis')put('wreck',-3,-9,-.7);
  if(type==='station')put('wreck',3,-8,-.7);
  return modules.map((m,i)=>({...m,id:`module-${i}`,destructible:m.asset==='wreck',hp:m.asset==='wreck'?9:Infinity}));
}
export function sceneryColliders(definition, random) {
  const layout=definition.variant==='nesis'?{pieces:[]}:sectorLayout(definition,random);
  return [
    ...layout.pieces.flatMap((p,i)=>{
      if(!['box','rock'].includes(p.shape)||p.y+p.h/2<-.4)return [];
      const c=Math.abs(Math.cos(p.rotation||0)),s=Math.abs(Math.sin(p.rotation||0));
      return [{id:`structure-${i}`,x:p.x,y:-p.z,w:p.w*c+p.d*s,d:p.d*c+p.w*s,bottom:p.y-p.h/2,top:p.y+p.h/2,hp:Infinity}];
    }),
    ...sectorModules(definition).map(m=>({id:m.id,x:m.x,y:-m.z,w:m.w,d:m.d,bottom:m.y,top:m.y+m.h,hp:m.hp,destructible:m.destructible})),
    ...(definition.collisionHull||[]),
  ];
}
