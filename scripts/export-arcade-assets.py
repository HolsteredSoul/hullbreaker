"""Export saved arcade source files; never save over editable .blend art."""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Matrix

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets'; OUT.mkdir(parents=True,exist_ok=True)
report_path=ROOT/'assets/blender/arcade-asset-report.json'
reports=json.loads(report_path.read_text()) if report_path.exists() else {}
selected=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for stem, hull, resolution in [('nesis-arcade-v2',True,2048),('nesis-assault-v3',True,2048),('combat-arcade-v2',False,1024)]:
    if selected and stem not in selected: continue
    bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender'/f'{stem}.blend'))
    scene=bpy.context.scene
    originals=list(scene.objects)
    runtime=bpy.data.collections.new('02_Export_Copies'); scene.collection.children.link(runtime)
    mapping={}
    # Copy complete hierarchy so pivots and user properties survive.
    for o in originals:
        c=o.copy()
        if o.data: c.data=o.data.copy()
        runtime.objects.link(c); c.hide_viewport=False; c.hide_render=False; c.hide_set(False); mapping[o]=c
    for o,c in mapping.items():
        c.parent=mapping.get(o.parent)
        c.name=o.name+'__runtime'
    for o in originals: o.hide_set(True); o.hide_render=True
    # Merge static meshes by section/material; combat meshes by pivot and emission.
    groups={}
    for o,c in mapping.items():
        if c.type!='MESH': continue
        bpy.context.view_layer.objects.active=c
        for mod in list(c.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
        if hull:
            key=(o.get('section',0),o.active_material.name)
        else:
            # Vertex colours combine coloured surfaces into one shared opaque material.
            key=(o.parent.name if o.parent else o.name, o.active_material.name=='cyan')
            col=c.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
            for value in col.data: value.color=o.active_material.diffuse_color
        groups.setdefault(key,[]).append(c)
    joined=[]
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join(); o=bpy.context.object
        o.name=f'hull_{key[0]}_{key[1]}' if hull else f'{key[0]}_{"glow" if key[1] else "paint"}'
        if not hull:
            name='Arcade_Glow' if key[1] else 'Arcade_Paint'
            m=bpy.data.materials.get(name)
            if not m:
                m=bpy.data.materials.new(name); m.use_nodes=True
                shader=m.node_tree.nodes.get('Principled BSDF'); shader.inputs['Roughness'].default_value=.58; shader.inputs['Metallic'].default_value=.18
                vertex=m.node_tree.nodes.new('ShaderNodeVertexColor'); vertex.layer_name='Color'
                m.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
                if key[1]:
                    # glTF cannot multiply vertex colours into emission. A shared
                    # cyan factor retains the intended glow instead of white.
                    shader.inputs['Emission Color'].default_value=(.06,1,.7,1); shader.inputs['Emission Strength'].default_value=.8
            o.data.materials.clear(); o.data.materials.append(m)
            for p in o.data.polygons: p.material_index=0
        joined.append(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:o.select_set(True)
    bpy.context.view_layer.objects.active=joined[0]
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004,area_weight=.5)
    bpy.ops.object.mode_set(mode='OBJECT')
    atlas=bpy.data.images.new(stem+'_AO',width=resolution,height=resolution,alpha=False)
    atlas.generated_color=(1,1,1,1); atlas.colorspace_settings.name='Non-Color'
    materials=set(m for o in joined for m in o.data.materials)
    for m in materials:
        node=m.node_tree.nodes.new('ShaderNodeTexImage'); node.image=atlas; m.node_tree.nodes.active=node
    scene.render.engine='CYCLES'; scene.cycles.samples=8; scene.render.threads_mode='FIXED';scene.render.threads=8
    scene.render.bake.margin=4; scene.render.bake.use_clear=False
    print('BAKING '+stem,flush=True)
    bpy.ops.object.bake(type='AO')
    atlas.filepath_raw=str(OUT/(stem+'-ao.png'));atlas.file_format='PNG';atlas.save();atlas.pack()
    group=bpy.data.node_groups.new('glTF Material Output','ShaderNodeTree');group.interface.new_socket(name='Occlusion',in_out='INPUT',socket_type='NodeSocketFloat')
    for m in materials:
        node=m.node_tree.nodes.new('ShaderNodeGroup');node.node_tree=group
        texture=next(n for n in m.node_tree.nodes if n.type=='TEX_IMAGE' and n.image==atlas)
        m.node_tree.links.new(texture.outputs['Color'],node.inputs['Occlusion'])
    # Restore stable names only after merges, avoiding Blender's name collision suffixes.
    for o,c in mapping.items():
        if o.type=='EMPTY':
            name=o.name; o.name='source_'+name; c.name=name
            if c.get('asset_id'): c.location=(0,0,0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in runtime.objects:o.select_set(True)
    path=OUT/f'{stem}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    reports[stem]={'bytes':path.stat().st_size,'mesh_batches':len(joined),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in joined),'atlas':resolution}
    print('EXPORTED '+json.dumps(reports[stem]),flush=True)
report_path.write_text(json.dumps(reports,indent=2))
