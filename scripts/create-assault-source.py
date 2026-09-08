"""Derive editable mission hull from approved v2; preserve original source."""
import bpy
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'assets/blender/nesis-assault-v3.blend'
if path.exists():
    raise RuntimeError('Source already exists; edit it directly instead of regenerating')
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/blender/nesis-arcade-v2.blend'))
for obj in list(bpy.context.scene.objects):
    if obj.name.startswith(('Battery_ring', 'Battery_housing', 'Battery_barrel', 'Battery_muzzle')):
        bpy.data.objects.remove(obj, do_unlink=True)
collection = bpy.data.collections.new('Mission_Sockets')
bpy.context.scene.collection.children.link(collection)
for name, x, forward in [('port_a',-11.1,34),('starboard_a',11.1,34),('port_b',-11.1,48),('starboard_b',11.1,48),('coolant',-4.8,44)]:
    obj = bpy.data.objects.new('socket_' + name, None)
    collection.objects.link(obj)
    obj.location = (x, forward, .2)
    obj.empty_display_size = .6
bpy.context.scene['mission_revision'] = 'nesis-assault-v3: dynamic batteries and coolant socket'
bpy.ops.wm.save_as_mainfile(filepath=str(path))
