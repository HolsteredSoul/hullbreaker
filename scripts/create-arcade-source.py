"""One-time authoring of the arcade slice. Never overwrites saved source art.

Blender --background --factory-startup --python scripts/create-arcade-source.py
Export separately with export-arcade-assets.py; manual source edits survive export.
"""
import bpy, math
from pathlib import Path
from mathutils import Vector, Euler

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/blender'
DEST.mkdir(parents=True, exist_ok=True)
FILES = [DEST/'nesis-arcade-v2.blend', DEST/'combat-arcade-v2.blend']
if any(p.exists() for p in FILES):
    raise RuntimeError('Arcade sources already exist. Edit the saved .blend files; export does not regenerate them.')

def xyz(x,y,z): return (x,-z,y)
def reset(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.name=name
    bpy.context.scene.world=bpy.data.worlds.new('Studio')
    bpy.context.scene.world.color=(.15,.15,.15)
    global mats, collection
    collection=bpy.data.collections.new('01_Editable_Forms'); bpy.context.scene.collection.children.link(collection)
    mats={}
    colors={'navy':'172b46','blue':'42698a','edge':'85a8bd','black':'0a1528','orange':'c96d34','ivory':'e2e9db','cyan':'5effe1','red':'db554d','wreck':'293447'}
    for key, value in colors.items():
        rgb=[int(value[i:i+2],16)/255 for i in (0,2,4)]
        rgb=[c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in rgb]
        m=bpy.data.materials.new(key); m.diffuse_color=(*rgb,1); m.use_nodes=True
        p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1)
        p.inputs['Roughness'].default_value=.55; p.inputs['Metallic'].default_value=.22
        if key=='cyan': p.inputs['Emission Color'].default_value=(*rgb,1); p.inputs['Emission Strength'].default_value=2
        mats[key]=m

def root(name, at=(0,0,0)):
    o=bpy.data.objects.new(name,None); collection.objects.link(o); o.location=xyz(*at); o['asset_id']=name
    return o
def finish(o,name,mat,parent=None,section=None,bevel=.06):
    o.name=name
    for c in list(o.users_collection): c.objects.unlink(o)
    collection.objects.link(o)
    o.data.materials.append(mats[mat])
    if parent: o.parent=parent
    if section is not None: o['section']=section
    if bevel:
        b=o.modifiers.new('Broad highlight bevel','BEVEL'); b.width=bevel; b.segments=2
        b=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); b.keep_sharp=True
    return o
def box(name, pos, size, mat, parent=None, section=None, bevel=.06):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(*pos)); o=bpy.context.object
    o.scale=(size[0],size[2],size[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return finish(o,name,mat,parent,section,bevel)
def prism(name, outline, bottom, top, mat, parent=None, section=None, bevel=.12):
    n=len(outline); verts=[xyz(x,y,z) for y in (bottom,top) for x,z in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); collection.objects.link(o)
    # Recalculate ensures arbitrary polygon winding is consistent.
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    import bmesh
    bm=bmesh.new(); bm.from_mesh(mesh); bmesh.ops.recalc_face_normals(bm,faces=bm.faces); bm.to_mesh(mesh); bm.free(); o.select_set(False)
    return finish(o,name,mat,parent,section,bevel)
def cylinder(name,pos,radius,depth,mat,parent=None,section=None,axis='y',vertices=12):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=radius,depth=depth,location=xyz(*pos)); o=bpy.context.object
    if axis=='z': o.rotation_euler.x=math.pi/2
    if axis=='x': o.rotation_euler.y=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,mat,parent,section,.04)
def ring(name,pos,radius,tube,mat,parent=None,section=None,axis='y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=6,location=xyz(*pos),major_radius=radius,minor_radius=tube)
    o=bpy.context.object
    if axis=='z': o.rotation_euler.x=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    return finish(o,name,mat,parent,section,0)
def socket(name,pos,parent=None,**properties):
    o=bpy.data.objects.new(name,None); collection.objects.link(o); o.location=xyz(*pos); o.parent=parent
    for k,v in properties.items(): o[k]=v
    o.empty_display_size=.4
    return o
def save(path,center,distance):
    bpy.ops.object.select_all(action='DESELECT')
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                s=area.spaces.active; s.shading.type='MATERIAL'; s.overlay.show_overlays=False
                s.clip_end=1000; s.region_3d.view_location=Vector(xyz(*center)); s.region_3d.view_distance=distance
                s.region_3d.view_rotation=Euler((math.radians(36),0,math.radians(-28)),'XYZ').to_quaternion()
                s.region_3d.view_perspective='ORTHO'
    bpy.context.scene['export_note']='Editable source: export creates copies without saving over this file.'
    bpy.ops.wm.save_as_mainfile(filepath=str(path))

reset('Nesis_Arcade_Battleship')
# Layered tapered keel. Vary widths and elevations rather than extruding a rectangle.
stations=[(17,10.5),(9,15.8),(-4,15),(-13,10.2),(-25,9.3),(-35,12),(-46,11),(-59,9),(-72,6.2),(-84,.7)]
for i,((za,wa),(zb,wb)) in enumerate(zip(stations,stations[1:])):
    sec=min(4,i//2)
    prism('Keel_%02d'%i,[(-wa*.76,za),(wa*.76,za),(wb*.76,zb),(-wb*.76,zb)],-8,-4.2,'black',section=sec)
    prism('Armour_belt_%02d'%i,[(-wa,za),(wa,za),(wb,zb),(-wb,zb)],-5.6,-2.1,'navy',section=sec,bevel=.26)
    prism('Deck_%02d'%i,[(-wa*.91,za-.25),(wa*.91,za-.25),(wb*.91,zb+.25),(-wb*.91,zb+.25)],-2.15,-1.45,'blue',section=sec,bevel=.15)
    # Segmented flank armour leaves a dark stripe between structural layers.
    for side in (-1,1):
        prism('Flank_strake',[(side*wa,za-1),(side*(wa+.45),za-2),(side*(wb+.45),zb+1.8),(side*wb,zb+1)],-4.5,-3.2,'edge',section=sec,bevel=.1)

# Large sloped shoulder carapaces and aft engine pods.
for side in (-1,1):
    prism('Aft_shoulder',[(side*7,10),(side*15.4,7),(side*14.8,-3),(side*10.6,-10),(side*8,-7)],-2.2,.15,'navy',section=0,bevel=.3)
    prism('Shoulder_crown',[(side*8.4,8),(side*14.1,5),(side*13.5,-2),(side*10.8,-7),(side*9,-5)],.1,.6,'blue',section=0)
    prism('Shoulder_identification',[(side*10.5,5),(side*13.8,3.7),(side*13.5,1.5),(side*10.4,2.5)],.62,.7,'orange',section=0,bevel=.02)
    for k in range(4): box('Cooling_louvre',(side*12,-.1,-2-k*1.25),(3,.3,.5),'black',section=0)
for i,(x,z,r) in enumerate([(-11.2,10,2.4),(-5.7,15,2),(0,17,2.6),(5.7,15,2),(11.2,10,2.4)]):
    cylinder('Engine_armoured_pod',(x,-3.4,z-1),r*1.27,7,'navy',section=0,axis='z')
    cylinder('Engine_heat_shield',(x,-3.4,z+2.1),r*1.08,1,'edge',section=0,axis='z')
    cylinder('Engine_throat',(x,-3.4,z+2.65),r*.86,.12,'black',section=0,axis='z')
    ring('Engine_nozzle',(x,-3.4,z+2.8),r*.92,.16,'blue',section=0,axis='z')
    cylinder('Engine_emitter',(x,-3.4,z+2.85),r*.68,.1,'cyan',section=0,axis='z')
    socket('engine_%d'%i,(x,-3.4,z+3),radius=r*.72,direction=[0,0,1])

# Recessed, quieter flight channel with large rails, not scattered boxes.
for side in (-1,1):
    for sec,z,length,x in [(1,-18,12,8.1),(2,-34,10,9.2),(3,-49,10,8.2)]:
        box('Recessed_service_channel',(side*x,-1.36,z),(1.1,.12,length),'black',section=sec)
        box('Conduit',(side*x,-1.18,z),(.22,.18,length-.7),'edge',section=sec)
        for dz in (-length*.32,0,length*.32): box('Rail_bracket',(side*x,-1.03,z+dz),(1.4,.22,.38),'navy',section=sec)
    # Broad armoured cheek batteries outside the combat corridor.
    for sec,z in [(2,-34),(3,-48)]:
        prism('Battery_sponson',[(side*8.8,z+5),(side*13.7,z+3),(side*13,z-3),(side*9.2,z-5)],-3,.2,'navy',section=sec)
        cylinder('Battery_ring',(side*11.1,.2,z),1.7,.45,'black',section=sec)
        prism('Battery_housing',[(side*9.8,z+1.4),(side*12.4,z+1.4),(side*12.5,z-.9),(side*11.2,z-1.7),(side*9.7,z-.8)],.4,1.4,'blue',section=sec)
        for dx in (-.5,.5):
            cylinder('Battery_barrel',(side*11.1+dx,1.1,z-2.8),.19,4,'edge',section=sec,axis='z')
            box('Battery_muzzle',(side*11.1+dx,1.1,z-4.7),(.6,.5,.8),'black',section=sec)

# Bow stepped wedges: strong silhouette, low central surfaces for clear combat.
for side in (-1,1):
    prism('Bow_armour',[(side*.9,-60),(side*8.2,-60),(side*5.9,-72),(side*.8,-83)],-1.5,-.35,'navy',section=4,bevel=.25)
    prism('Bow_upper_plate',[(side*1.5,-62),(side*7,-62),(side*4.7,-72),(side*1.1,-80)],-.4,-.05,'blue',section=4)
    prism('Bow_recognition_flash',[(side*4,-64),(side*6.5,-64),(side*5.8,-67),(side*3.5,-67)],-.03,.03,'orange',section=4,bevel=.01)
    for z in (-65,-68,-71): box('Bow_seam',(side*3,-.01,z),(3,.05,.13),'black',section=4,bevel=0)
# Command tower offset beyond player bounds, integrated into starboard flank.
prism('Command_foundation',[(9,-38),(14,-38),(14,-45),(9,-47)],-2,1,'navy',section=2)
prism('Command_lower',[(9.5,-39),(13.6,-39),(13,-44.8),(10,-45.5)],1,3,'blue',section=2)
prism('Command_bridge',[(8.9,-40),(14,-40),(13.5,-43.7),(9.3,-44.3)],3,4.2,'navy',section=2)
box('Bridge_window',(11.45,3.65,-44.05),(3.2,.4,.1),'cyan',section=2,bevel=.02)
box('Command_roof',(11.5,4.3,-42),(4.2,.35,3),'edge',section=2)
box('Radar_mast',(12,5.4,-41),(.35,2,.4),'navy',section=2)
box('Radar_crossbar',(12,6.2,-41),(2.2,.3,.5),'blue',section=2)
# Battle damage: missing port shoulder exposes layered rib ends and warm alloy.
for i in range(5):
    box('Exposed_rib',(-9.2,-2.8,-23-i*1.25),(2.4,.5,.35),'orange',section=1)
    o=box('Broken_armour',(-9.8,-1.8,-23-i*1.25),(1.6,.28,.7),'blue',section=1); o.rotation_euler.y=(i%3-1)*.3
for tid,x,z,kind in [('bay_a',-4.8,-19,'bay'),('bay_b',4.8,-28,'bay'),('turret_a',0,-38,'turret'),('core',0,-56,'core')]:
    socket('socket_'+tid,(x,-.55,z),target_id=tid.replace('_','-'),kind=kind)
save(FILES[0],(0,-1,-32),100)

reset('Hullbreaker_Combat_Assets')
# Each asset has its own root. Source display positions are removed on export.
for kind,offset in [('player',(-6,0,0)),('scout',(-2,0,0)),('interceptor',(2,0,0)),('bomber',(6,0,0))]:
    p=root(kind,offset); friendly=kind=='player'; base='ivory' if friendly else 'red'
    if kind=='player':
        outline=[(0,-1.18),(.3,-.35),(1.05,.6),(.95,.93),(.48,.55),(.25,.95),(-.25,.95),(-.48,.55),(-.95,.93),(-1.05,.6),(-.3,-.35)]
    elif kind=='scout': outline=[(0,-1),(.28,-.35),(1,.6),(.6,.72),(.22,.42),(0,.75),(-.22,.42),(-.6,.72),(-1,.6),(-.28,-.35)]
    elif kind=='interceptor': outline=[(-.16,-.45),(-.32,-1.45),(-.58,-1.1),(-.48,.3),(-.8,.75),(-.24,.65),(0,.9),(.24,.65),(.8,.75),(.48,.3),(.58,-1.1),(.32,-1.45),(.16,-.45)]
    else: outline=[(-.45,-.85),(.45,-.85),(.55,-.25),(1.15,-.5),(1.2,.8),(.5,1),(0,.65),(-.5,1),(-1.2,.8),(-1.15,-.5),(-.55,-.25)]
    prism(kind+'_wing',outline,-.1,.1,base,p,bevel=.035)
    prism(kind+'_fuselage',[(-.2,.8),(.2,.8),(.25,-.3),(0,-1),(-.25,-.3)],.05,.3,'blue' if not friendly else 'ivory',p,bevel=.06)
    prism('cockpit',[(-.13,.1),(.13,.1),(.13,-.4),(0,-.64),(-.13,-.4)],.3,.43,'cyan' if friendly else 'black',p,bevel=.025)
    for side in (-1,1):
        x=side*(.85 if kind=='bomber' else .35)
        cylinder('engine_pod',(x,.05,.58),.23 if kind=='bomber' else .15,.95,'navy',p,axis='z')
        cylinder('engine_glow',(x,.05,1.08),.16 if kind=='bomber' else .1,.04,'cyan',p,axis='z')
        socket('exhaust_'+str(side),(x,.05,1.1),p)
        box('wing_mark',(side*.64,.13,.42),(.24,.025,.26),'orange' if not friendly else 'blue',p,bevel=.01)

def target(kind,at):
    p=root(kind,at); intact=socket('intact',(0,0,0),p); moving=socket('moving',(0,0,0),p); wreck=socket('destroyed',(0,0,0),p)
    if kind=='bay':
        for side in (-1,1):
            box('Bay_sidewall',(side*1.52,-.25,0),(.42,1,3.6),'navy',intact)
            box('Bay_running_light',(side*1.28,.28,0),(.09,.08,2.8),'cyan',intact,bevel=.015)
        for z in (-1.7,1.7): box('Bay_endwall',(0,-.25,z),(3.2,1,.35),'blue',intact)
        box('Bay_depth',(0,-.73,0),(2.7,.15,3.1),'black',intact)
        for side in (-1,1):
            door=socket('door_left' if side<0 else 'door_right',(side*.64,.22,0),moving)
            box('Sliding_door',(0,0,0),(1.22,.2,3),'blue',door)
            for z in (-1,0,1): box('Door_rib',(0,.15,z),(1.14,.1,.16),'edge',door,bevel=.02)
            box('Warning_band',(0,.12,.55),(.7,.04,.5),'orange',door,bevel=.01)
    elif kind=='turret':
        cylinder('Turret_foundation',(0,0,0),1.45,.5,'navy',intact)
        ring('Turret_race',(0,.3,0),1.05,.14,'orange',intact)
        pivot=socket('rotor',(0,.4,0),moving)
        prism('Turret_armour',[(-.9,.8),(.9,.8),(1,-.4),(.5,-.85),(-.5,-.85),(-1,-.4)],0,.65,'blue',pivot)
        for x in (-.5,.5):
            cylinder('Gun_barrel',(x,.4,-1.05),.15,1.7,'edge',pivot,axis='z')
            box('Gun_muzzle',(x,.4,-1.9),(.4,.4,.5),'black',pivot)
    else:
        cylinder('Core_foundation',(0,-.1,0),2,.45,'navy',intact,vertices=16)
        ring('Core_outer_ring',(0,.2,0),1.65,.18,'blue',intact)
        pivot=socket('rotor',(0,.7,0),moving)
        cylinder('Core_energy',(0,0,0),.7,1.1,'cyan',pivot,vertices=8)
        ring('Core_containment',(0,.2,0),1.1,.16,'ivory',pivot)
        for i in range(4):
            a=i*math.pi/2; box('Core_pylon',(math.sin(a)*1.55,.45,math.cos(a)*1.55),(.4,.95,.4),'blue',intact)
    cylinder('Scorched_crater',(0,-.1,0),1.5 if kind!='core' else 1.9,.2,'wreck',wreck,vertices=9)
    for i in range(5):
        a=i*math.tau/5
        o=box('Jagged_fragment',(math.sin(a)*1.1,.2,math.cos(a)*1.1),(.85,.35,.6),'navy',wreck); o.rotation_euler=(.15*i,.2,a)
        box('Hot_fracture',(math.sin(a)*.75,.08,math.cos(a)*.75),(.12,.06,.38),'orange',wreck,bevel=.01)
    wreck.hide_viewport=True; wreck.hide_render=True
for kind,at in [('bay',(-5,0,-5)),('turret',(0,0,-5)),('core',(5,0,-5))]: target(kind,at)
p=root('missile',(0,0,3)); cylinder('Missile_body',(0,0,0),.15,.75,'ivory',p,axis='z',vertices=8)
prism('Missile_fins',[(-.38,.3),(-.13,-.05),(.13,-.05),(.38,.3)],-.03,.03,'red',p,bevel=.01)
cylinder('Missile_tip',(0,0,-.4),.09,.18,'orange',p,axis='z',vertices=8)
for i in range(6):
    p=root('debris_'+str(i),(-5+i*2,0,6))
    prism('Wreckage',[(-.5,-.4),(.45,-.5),(.65,.05),(.05,.5),(-.6,.2)],-.12,.12,'blue' if i%2 else 'navy',p,bevel=.025)
    if i%2: box('Exposed_beam',(0,.2,0),(.16,.25,1),'orange',p)
    else: cylinder('Pipe_fragment',(0,.22,0),.14,.9,'edge',p,axis='z',vertices=8)
save(FILES[1],(0,0,0),24)
print('SOURCE ART COMPLETE',flush=True)
