"""Authored second pass after camera review; edits the new source, not v1."""
import bpy, math, ast
from pathlib import Path
from mathutils import Vector, Euler
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'assets/blender/nesis-arcade-v2.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
if bpy.context.scene.get('arcade_refinement'): raise RuntimeError('Refinement already applied; edit saved source directly.')
# Reuse authoring primitives without executing the one-time source generator.
tree=ast.parse((ROOT/'scripts/create-arcade-source.py').read_text())
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]),'<art primitives>','exec'))
mats={m.name:m for m in bpy.data.materials}
collection=bpy.data.collections.new('04_Armour_Architecture');bpy.context.scene.collection.children.link(collection)
# Break the oversized flat deck into a central service trench and articulated plates.
for o in bpy.context.scene.objects:
    if o.name.startswith('Deck_'): o.data.materials.clear();o.data.materials.append(mats['navy'])
for sec,z,length in [(0,2,13),(1,-17,11),(2,-32,12),(3,-47,10)]:
    box('Central_shadow_channel',(0,-1.39,z),(2.5,.08,length),'black',section=sec,bevel=.02)
    for side in (-1,1):
        box('Trench_wall',(side*1.35,-1.05,z),(.26,.65,length),'blue',section=sec)
        for dz in (-length*.32,length*.32):
            box('Service_crossbeam',(0,-1.1,z+dz),(2.5,.4,.42),'edge',section=sec)
        box('Recessed_power_strip',(side*.83,-1.31,z),(.09,.08,length-1),'cyan',section=sec,bevel=.01)
for sec,z,x,length,width in [(0,1,4.6,12,4.8),(1,-15.5,4.5,4,4.8),(1,-23.5,4.5,3,4.8),(2,-32,4.5,4,4.8),(2,-39,4.5,5.5,4.8),(3,-46,4.2,6,4.3),(3,-52,4.2,3,4.3)]:
    for side in (-1,1):
        # Keep both bay footprints clear, including door travel.
        if abs(z+19)<3.5 and side<0 or abs(z+28)<3.5 and side>0:continue
        lo=x-width/2;hi=x+width/2
        shape=[(side*lo,z+length/2),(side*hi,z+length/2-.7),(side*hi,z-length/2+.5),(side*(lo+1),z-length/2),(side*lo,z-length/2+1)]
        prism('Articulated_armour',shape,-1.4,-.58,'blue',section=sec,bevel=.15)
        box('Plate_edge_inlay',(side*(hi-.25),-.53,z),(.1,.06,max(1,length-1.8)),'edge',section=sec,bevel=.015)
        for k in range(3): box('Armour_vent',(side*x,-.49,z+(k-1)*.4),(width*.55,.06,.16),'black',section=sec,bevel=.01)
# Visual sockets: thick aperture collars create an actual hangar recess impression.
for sec,x,z in [(1,-4.8,-19),(1,4.8,-28)]:
    for side in (-1,1):
        prism('Hangar_cheek',[(x+side*1.7,z+2.5),(x+side*3,z+2.9),(x+side*3,z-2.8),(x+side*1.7,z-2.4)],-1.45,-.4,'blue',section=sec)
    box('Hangar_threshold',(x,-.63,z+2.1),(3.5,.7,.55),'orange',section=sec)
    box('Hangar_bulkhead',(x,-.7,z-2.1),(3.5,.65,.65),'navy',section=sec)
# Big stepped reactor buttresses stay clear of the shootable core at z=-56.
for side in (-1,1):
    prism('Reactor_buttress',[(side*2.6,-53),(side*6.7,-52),(side*6.1,-59),(side*2.6,-60)],-1.4,-.4,'blue',section=3)
    box('Reactor_heat_sink',(side*4.6,-.32,-56),(1.1,.15,3.2),'black',section=3)
    for dz in (-1.1,-.55,0,.55,1.1): box('Reactor_fin',(side*4.6,-.16,-56+dz),(1.5,.2,.13),'edge',section=3,bevel=.02)
# Bold aft service hatches give the opening seconds a recognizable composition.
for side in (-1,1):
    box('Aft_identification',(side*4.6,-.49,3.5),(2.1,.05,2.5),'orange',section=0,bevel=.04)
    for dz in (-.7,0,.7): box('Aft_id_cut',(side*4.6,-.44,3.5+dz),(1.1,.05,.22),'navy',section=0,bevel=.01)
bpy.context.scene['arcade_refinement']=True
save(path,(0,-1,-32),100)
