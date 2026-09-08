"""Blender-authored campaign machinery and fighters. Run in a background Blender.
Saves editable bevelled sources before merging runtime meshes into two batches per asset.
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene;scene.name='Campaign_Armory'
palette={'armor':(.16,.24,.32,1),'edge':(.4,.53,.58,1),'dark':(.035,.055,.08,1),'brass':(.7,.36,.09,1),'white':(.72,.82,.8,1),'glow':(.1,.8,1,1),'red':(.9,.17,.07,1)}
mats={}
for name,color in palette.items():
 m=bpy.data.materials.new(name);m.diffuse_color=color;m.use_nodes=True
 s=m.node_tree.nodes.get('Principled BSDF');s.inputs['Base Color'].default_value=color;s.inputs['Metallic'].default_value=.45;s.inputs['Roughness'].default_value=.5
 if name=='glow':s.inputs['Emission Color'].default_value=color;s.inputs['Emission Strength'].default_value=1.5
 mats[name]=m
roots=[];root=None
def position(x,y,z):return (x,-z,y)
def finish(o,name,material,bevel=0):
 o.name=name;o.parent=root;o.data.materials.append(mats[material])
 if bevel:
  mod=o.modifiers.new('Machined chamfer','BEVEL');mod.width=bevel;mod.segments=2
 return o
def box(name,x,y,z,w,h,d,material='armor',bevel=.06):
 bpy.ops.mesh.primitive_cube_add(size=1,location=position(x,y,z));o=bpy.context.object;o.scale=(w,d,h)
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material,bevel)
def cyl(name,x,y,z,r,h,material='armor',vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=position(x,y,z));return finish(bpy.context.object,name,material,.035)
def begin(name,w,h,d):
 global root
 root=bpy.data.objects.new(name,None);scene.collection.objects.link(root);root['asset_id']=name;root['bounds']=[w,h,d];roots.append(root)
def stripe(x,y,z,w=1.5):box('Illuminated strip',x,y,z,w,.12,.09,'glow',.015)
begin('bridge',4,5,8)
box('Armored footing',0,.3,0,4,.6,8,'dark')
box('Raised command spine',0,1.4,0,2.8,2.2,6.8)
box('Observation deck',0,3.05,-.7,3.8,1.3,4.7,'edge',.18)
box('Bridge canopy',0,3.85,-.7,4,.3,5.2,'armor',.12)
for z in [-2.7,-1.7,-.7,.3,1.3]:
 for x in [-1.93,1.93]:box('Inset bridge window',x,3.1,z,.07,.48,.6,'glow',.025)
for x in [-1,1]:
 cyl('Sensor mast',x,4.3,.8,.08,1.25,'brass',8);box('Antenna',x,4.92,.8,.6,.06,.06,'edge',.01)
for z in [1.8,2.5,3.2]:box('Cooling grille',0,2.56,z,1.5,.08,.25,'dark',.02)
begin('pylon',4,7,5)
box('Reinforced foot',0,.3,0,4,.6,5,'dark')
box('Service column',0,3.4,0,2.9,6.2,3.5)
for y in [1.1,2.5,3.9,5.3]:
 box('Armor collar',0,y,0,3.6,.38,4.3,'edge');stripe(0,y+.2,-2.17,2.8)
 for x in [-1.55,1.55]:box('Service conduit',x,y+.7,.2,.16,.95,2,'brass',.035)
box('Overhanging crown',0,6.65,0,4,.6,5,'edge');stripe(0,6.72,-2.52,3)
begin('refinery',5,5,6)
box('Plant foundation',0,.22,0,5,.44,6,'dark')
for x in [-1.25,1.25]:
 cyl('Pressure vessel',x,1.9,0,.9,3.5,'edge');cyl('Reactor collar',x,3.45,0,1.04,.22,'brass')
 cyl('Reactor cap',x,3.85,0,.7,.6,'armor');cyl('Coolant throat',x,4.35,0,.3,.65,'glow')
 for z in [-1.6,1.6]:box('Exchanger grille',x,1.4,z,1.5,2.3,.65,'armor')
for y in [1,1.7,2.4]:box('Cross-feed pipe',0,y,-2.4,4.5,.18,.25,'brass')
begin('radar',5,5,5)
box('Radar plinth',0,.25,0,4.5,.5,4.5,'dark');cyl('Pedestal',0,1.45,0,.6,2.3,'edge')
box('Sensor array',0,3.35,0,4.6,2.4,.45,'edge',.12)
for x in [-1.8,-.9,0,.9,1.8]:
 for y in [2.65,3.35,4.05]:box('Phased receiver',x,y,-.27,.65,.42,.12,'glow',.02)
box('Top antenna',0,4.7,0,.12,.6,.12,'brass',.01)
begin('wreck',2.4,1.6,3.5)
box('Broken hull plate',0,.2,0,2.4,.4,3.5,'edge',.08)
box('Torn bulkhead',-.9,.75,.2,.5,1.5,2.5,'armor',.04)
box('Exposed spar',.6,.6,-.2,.3,1.2,3,'brass',.035)
for z in [-1.1,0,1.1]:box('Ruptured cross-rib',0,.6,z,2,.35,.25,'dark')
stripe(0,.44,-1.6,1.5)
begin('gunship',3.8,1,3.2)
box('Gunship fuselage',0,.05,0,1,.55,3.2,'armor',.14)
box('Broad assault wing',0,0,.25,3.6,.18,1.6,'red',.08)
box('Armored cockpit',0,.43,-.65,.6,.35,.8,'glow',.08)
for x in [-1.4,1.4]:
 box('Gun pod',x,.05,-.2,.65,.5,2.6,'edge',.1)
 box('Gun barrel',x,.02,-1.55,.18,.18,.9,'dark',.025)
 stripe(x,.05,1.15,.4)
begin('supply',3.2,1.2,2.8)
box('Cargo capsule',0,.1,0,1.5,.85,2.3,'brass',.15)
for z in [-.7,.7]:box('Cargo restraint',0,.1,z,1.6,.95,.18,'dark',.02)
for x in [-1.15,1.15]:
 box('Supply nacelle',x,0,0,.6,.5,2.8,'white',.1);stripe(x,.05,1.4,.4)
box('Power cell',0,.65,0,.75,.18,.85,'glow',.08)
# Save editable objects and modifiers in a spaced display arrangement.
for i,r in enumerate(roots):r.location=(i%3*9-9,i//3*12,0)
scene['contract']='Y-up runtime; forward -Z; module origins at floor; flight assets centered at flight plane.'
scene.world.color=(.08,.08,.08)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/campaign-modules-v1.blend'),compress=True)
for r in roots:r.location=(0,0,0)
runtime_materials={}
for name,emission in [('Campaign_Paint',False),('Campaign_Glow',True)]:
 m=bpy.data.materials.new(name);m.use_nodes=True;s=m.node_tree.nodes.get('Principled BSDF')
 s.inputs['Roughness'].default_value=.55;s.inputs['Metallic'].default_value=.35
 vertex=m.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Color';m.node_tree.links.new(vertex.outputs['Color'],s.inputs['Base Color'])
 if emission:s.inputs['Emission Color'].default_value=(.08,.65,1,1);s.inputs['Emission Strength'].default_value=1.1
 runtime_materials[emission]=m
for r in roots:
 buckets={False:[],True:[]}
 for o in list(r.children):
  bpy.context.view_layer.objects.active=o
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  material=o.active_material;attr=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
  for value in attr.data:value.color=material.diffuse_color
  buckets[material.name=='glow'].append(o)
 for glow,objects in buckets.items():
  if not objects:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object;o.name=r.name+('_glow' if glow else '_paint')
  o.data.materials.clear();o.data.materials.append(runtime_materials[glow])
  for p in o.data.polygons:p.material_index=0
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/assets/campaign-modules-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_extras=True,export_cameras=False,export_lights=False)
report={'bytes':out.stat().st_size,'assets':[r.name for r in roots],'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in scene.objects if o.type=='MESH')}
(ROOT/'assets/blender/campaign-module-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
# Extract editable Nesis component bounds in the SAME axis convention as the GLB.
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/nesis-assault-v3.blend'))
colliders=[]
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 points=[o.matrix_world@Vector(p) for p in o.bound_box]
 lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
 if hi[2]<-.35 or lo[2]>.4 or lo[0]>15 or hi[0]<-15:continue
 colliders.append({'id':'hull-'+o.name,'x':(lo[0]+hi[0])/2,'y':(lo[1]+hi[1])/2,'w':hi[0]-lo[0],'d':hi[1]-lo[1],'bottom':lo[2],'top':hi[2]})
(ROOT/'src/nesis-colliders.json').write_text(json.dumps(colliders,separators=(',',':')))
print('NESIS_COLLIDERS '+str(len(colliders)),flush=True)
