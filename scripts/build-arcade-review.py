"""Compose a disposable review scene from editable sources. Does not alter them."""
import bpy, math
from pathlib import Path
from mathutils import Vector, Euler
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'assets/blender/nesis-arcade-v2.blend'))
scene=bpy.context.scene;scene.name='Hullbreaker_Arcade_Review'
with bpy.data.libraries.load(str(ROOT/'assets/blender/combat-arcade-v2.blend'),link=False) as (source,target):
    target.collections=['01_Editable_Forms']
combat=target.collections[0];combat.name='05_Combat_Asset_Library';scene.collection.children.link(combat)
roots={o.get('asset_id'):o for o in combat.objects if o.get('asset_id')}
def copy_tree(o,parent=None):
    clone=o.copy();combat.objects.link(clone);clone.parent=parent
    for child in o.children: copy_tree(child,clone)
    return clone
for kind,x,z in [('bay',-4.8,-19),('bay',4.8,-28),('turret',0,-38),('core',0,-56)]:
    o=copy_tree(roots[kind]);o.location=(x,-z,-.55)
    def hide_wreck(node):
        if node.name.startswith('destroyed'):node.hide_viewport=True;node.hide_render=True
        for child in node.children:hide_wreck(child)
    hide_wreck(o)
for name,o in roots.items():
    if name=='player':o.location=(0,-6,1);o.scale=(2,2,2)
    else:
        # Keep the complete craft library in the file, away from the hero view.
        o.location.x-=50
        o.hide_viewport=True;o.hide_render=True
        def hide_all(node):
            for child in node.children:child.hide_viewport=True;child.hide_render=True;hide_all(child)
        hide_all(o)
# A camera/light setup makes a repeatable neutral studio render available too.
bpy.ops.object.camera_add(location=(63,-86,104));camera=bpy.context.object;camera.name='Review_Camera'
direction=Vector((0,32,-1))-camera.location;camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=113;scene.camera=camera
for name,pos,power,size in [('Key',(-35,-15,65),22000,65),('Fill',(35,40,35),16000,45),('Rim',(0,90,45),22000,35)]:
    bpy.ops.object.light_add(type='AREA',location=pos);o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,35,0))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT')
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            s=area.spaces.active;s.shading.type='MATERIAL';s.overlay.show_overlays=False;s.clip_end=1000
            s.region_3d.view_location=Vector((0,32,-1));s.region_3d.view_distance=100;s.region_3d.view_perspective='ORTHO'
            s.region_3d.view_rotation=Euler((math.radians(36),0,math.radians(-28)),'XYZ').to_quaternion()
scene['review_only']='Generated assembly. Edit nesis-arcade-v2.blend and combat-arcade-v2.blend; export with npm run asset:export.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/hullbreaker-art-review.blend'))
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT/'output/playwright/arcade-blender-studio.png')
bpy.ops.render.render(write_still=True)
