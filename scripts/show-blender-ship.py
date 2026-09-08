"""Frame the exported ship when opening its .blend in a new interactive window."""
import bpy
import math
from mathutils import Euler

def frame_ship():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != 'VIEW_3D':
                continue
            space = area.spaces.active
            space.shading.type = 'MATERIAL'
            space.shading.use_scene_world = False
            space.overlay.show_floor = False
            space.overlay.show_axis_x = False
            space.overlay.show_axis_y = False
            region = next((r for r in area.regions if r.type == 'WINDOW'), None)
            if region:
                with bpy.context.temp_override(window=window, area=area, region=region):
                    bpy.ops.view3d.view_all(center=False)
                space.region_3d.view_rotation = Euler((math.radians(62), 0, math.radians(-25)), 'XYZ').to_quaternion()
                space.region_3d.view_perspective = 'PERSP'
            return None
    return 1

bpy.app.timers.register(frame_ship, first_interval=1)
