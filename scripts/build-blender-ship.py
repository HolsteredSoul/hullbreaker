"""Run with Blender --background --factory-startup --python this_file.

Builds a native editable source, bakes shared AO and exports sectioned glTF.
The active interactive Blender session is never touched.
"""
import bpy
import bmesh
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'assets' / 'blender'
OUTPUT = ROOT / 'public' / 'assets'
OUTPUT.mkdir(parents=True, exist_ok=True)
source = json.loads((SOURCE / 'hull-source.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = 'Nesis_Capital_Ship'
editable = bpy.data.collections.new('01_Editable_Hull')
runtime = bpy.data.collections.new('02_Game_Export')
anchors = bpy.data.collections.new('03_Hardpoint_Anchors')
for collection in (editable, runtime, anchors):
    scene.collection.children.link(collection)

materials = []
names = ['Armor_Teal', 'Armor_Edge', 'Recess', 'Coolant_Emission', 'Brass', 'Ceramic', 'Exposed_Alloy']
for index, data in enumerate(source['materials']):
    material = bpy.data.materials.new(names[index])
    material.use_nodes = True
    shader = material.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*data['color'], 1)
    shader.inputs['Metallic'].default_value = data['metalness']
    shader.inputs['Roughness'].default_value = data['roughness']
    shader.inputs['Emission Color'].default_value = (*data['emissive'], 1)
    shader.inputs['Emission Strength'].default_value = data['emissiveIntensity']
    material.diffuse_color = (*data['color'], 1)
    materials.append(material)

def convert(x, y, z):
    return (x, -z, y)

def finish_object(obj, material, bevel=0.035):
    obj.data.materials.append(material)
    for collection in list(obj.users_collection):
        collection.objects.unlink(obj)
    editable.objects.link(obj)
    if bevel:
        mod = obj.modifiers.new('Machined edge bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(38)
    return obj

for chunk in source['meshes']:
    raw = chunk['positions']
    vertices = [convert(*raw[i:i+3]) for i in range(0, len(raw), 3)]
    faces = [tuple(range(i, i+3)) for i in range(0, len(vertices), 3)]
    mesh = bpy.data.meshes.new(chunk['name'])
    mesh.from_pydata(vertices, [], faces)
    bm = bmesh.new(); bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0001)
    bmesh.ops.dissolve_limit(bm, angle_limit=0.001, verts=list(bm.verts), edges=list(bm.edges), delimit={'NORMAL'})
    bm.to_mesh(mesh); bm.free(); mesh.update()
    obj = bpy.data.objects.new(chunk['name'], mesh)
    editable.objects.link(obj)
    finish_object(obj, materials[chunk['material']])

def box(name, x, y, z, size, material, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=convert(x, y, z))
    obj = bpy.context.object; obj.name = name
    obj.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish_object(obj, material, bevel)

# Blender-authored detail: seams, flank conduits, inspection hatches and bolt heads.
for side in (-1, 1):
    for section, (z, width) in enumerate(((2, 11), (-21, 9), (-42, 10), (-54, 8))):
        for lane in range(2):
            box(f'Flank_conduit_{side}_{section}_{lane}', side * (width-0.5), -2.1-lane*0.38, z,
                (0.14, 0.13, 5.8), materials[4 if lane else 2], 0.025)
        for n in range(5):
            x = side * (width-1.1)
            bolt_z = z - 2.5 + n * 1.2
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.065, depth=0.065, location=convert(x, -0.99, bolt_z))
            obj = bpy.context.object; obj.name = f'Armor_fastener_{side}_{section}_{n}'
            finish_object(obj, materials[5], 0)
    for n in range(4):
        z = -65.6 - n * 1.8
        box(f'Bridge_window_{side}_{n}', side * 3.8, 0.55, z, (0.1, 0.25, 0.65), materials[3], 0)

# Stable sockets travel with the visual asset and remain independent of behavior.
for target in source['hardpoints']:
    obj = bpy.data.objects.new('socket_' + target['id'].replace('-', '_'), None)
    obj.location = convert(target['x'], -0.55, -target['y'])
    obj.empty_display_type = 'CUBE'; obj.empty_display_size = target['radius']
    obj['target_id'] = target['id']; obj['kind'] = target['kind']
    anchors.objects.link(obj)

print('PHASE: Applying edge treatment to export copies', flush=True)
copies = []
for original in list(editable.objects):
    copy = original.copy(); copy.data = original.data.copy(); runtime.objects.link(copy)
    copy.name = original.name + '_export'; copies.append(copy)
    bpy.context.view_layer.objects.active = copy
    for modifier in list(copy.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
editable.hide_render = True
editable.hide_viewport = True
bpy.ops.object.select_all(action='DESELECT')
for obj in copies: obj.select_set(True)
bpy.context.view_layer.objects.active = copies[0]
bpy.ops.object.join()
master = bpy.context.object; master.name = 'Nesis_Bake_Master'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

print('PHASE: Packing shared UV atlas', flush=True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003, area_weight=0.5)
bpy.ops.object.mode_set(mode='OBJECT')
atlas = bpy.data.images.new('Nesis_Ambient_Occlusion', width=2048, height=2048, alpha=False)
atlas.colorspace_settings.name = 'Non-Color'
for material in materials:
    node = material.node_tree.nodes.new('ShaderNodeTexImage'); node.name = 'Baked AO'; node.image = atlas
    material.node_tree.nodes.active = node
scene.render.engine = 'CYCLES'; scene.cycles.samples = 16
scene.render.threads_mode = 'FIXED'; scene.render.threads = 8
scene.render.bake.margin = 5
print('PHASE: Baking ambient occlusion', flush=True)
bpy.ops.object.bake(type='AO')
atlas.filepath_raw = str(SOURCE / 'nesis-ao.png'); atlas.file_format = 'PNG'; atlas.save(); atlas.pack()

# The official Blender glTF exporter recognizes this named node group.
gltf_group = bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
gltf_group.interface.new_socket(name='Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
for material in materials:
    node = material.node_tree.nodes.new('ShaderNodeGroup'); node.node_tree = gltf_group
    material.node_tree.links.new(material.node_tree.nodes['Baked AO'].outputs['Color'], node.inputs['Occlusion'])

print('PHASE: Splitting runtime meshes by hull section and material', flush=True)
mesh = master.data
groups = {}
for polygon in mesh.polygons:
    key = (math.floor((-polygon.center.y + 20) / 25), polygon.material_index)
    groups.setdefault(key, []).append(polygon)
for (section, material_index), polygons in groups.items():
    vertices, faces, uv_values = [], [], []
    for polygon in polygons:
        start = len(vertices)
        for loop in polygon.loop_indices:
            vertices.append(tuple(mesh.vertices[mesh.loops[loop].vertex_index].co))
            uv_values.append(tuple(mesh.uv_layers.active.data[loop].uv))
        faces.append(tuple(range(start, len(vertices))))
    part_mesh = bpy.data.meshes.new(f'Nesis_Section_{section}_{material_index}')
    part_mesh.from_pydata(vertices, [], faces); part_mesh.update()
    uv = part_mesh.uv_layers.new(name='UVMap')
    for loop, values in zip(uv.data, uv_values): loop.uv = values
    part_mesh.materials.append(master.data.materials[material_index])
    obj = bpy.data.objects.new(part_mesh.name, part_mesh); runtime.objects.link(obj)
bpy.data.objects.remove(master, do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in list(runtime.objects) + list(anchors.objects): obj.select_set(True)
bpy.context.view_layer.objects.active = next(iter(runtime.objects))
scene['asset_contract'] = 'Three.js Y-up after glTF export; bow -Z; static hull plus named sockets; runtime targets/engines separate.'
scene['generator'] = 'scripts/build-blender-ship.py'
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / 'nesis-capital.blend'))
print('PHASE: Exporting browser GLB', flush=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT / 'nesis-capital-v1.glb'), export_format='GLB', use_selection=True, export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
stats = {'mesh_chunks': len(runtime.objects), 'materials': len(materials), 'ao_resolution': 2048,
         'glb_bytes': (OUTPUT / 'nesis-capital-v1.glb').stat().st_size,
         'triangles': sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in runtime.objects)}
(SOURCE / 'asset-report.json').write_text(json.dumps(stats, indent=2))
print('COMPLETE: ' + json.dumps(stats), flush=True)
