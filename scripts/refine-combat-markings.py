"""Final silhouette-review correction to interceptor wing markings."""
import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/'assets/blender/combat-arcade-v2.blend'
bpy.ops.wm.open_mainfile(filepath=str(path))
for o in bpy.context.scene.objects:
    if o.name.startswith('wing_mark') and o.parent and o.parent.get('asset_id')=='interceptor':
        o.location.x=.61 if o.location.x>0 else -.61
        o.location.y=-.74
bpy.ops.wm.save_as_mainfile(filepath=str(path))
