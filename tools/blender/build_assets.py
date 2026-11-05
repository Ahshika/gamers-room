"""Builds THE GAMEVERSE's solid architecture in Blender, bakes ambient occlusion into vertex colours
and exports two GLB files for the web app.

    "D:/Programs/Blender/blender.exe" --background --factory-startup --python tools/blender/build_assets.py -- blender/export blender/gameverse_assets.blend
    node tools/optimize-models.mjs blender/export public/models

Coordinates: Blender is Z-up; the glTF exporter converts to Y-up, so Blender -Y (front) becomes glTF +Z,
which is where the web camera looks from. All sizes match src/experience/{Portal,Chamber}.ts so the
shader parts made in code (energy surface r=2.95, rune ring r=3.0-3.24) sit exactly inside this frame.

Outputs:
  portal.glb   Frame, Keystones, OuterRing, Spines, Supports  (origin = portal centre)
  chamber.glb  Monolith_A..D, Ruin_A, Ruin_B, Dais             (origin = floor, base at z=0)
Materials are named Stone / Gold / DarkMetal; the web app replaces them with its tuned materials and
multiplies the baked AO (vertex colour) in.
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("usage: blender --background --python build_assets.py -- <out_dir> <blend_out>")
OUT_DIR, BLEND_OUT = argv[0], argv[1]
os.makedirs(OUT_DIR, exist_ok=True)
rng = random.Random(7)

# ---------------------------------------------------------------- scene and materials
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
world = bpy.data.worlds.new("World")
scene.world = world

MATS = {}
for name, color, rough, metal in (
    ("Stone", (0.11, 0.105, 0.14, 1), 0.85, 0.1),
    ("Gold", (0.55, 0.42, 0.18, 1), 0.38, 0.9),
    ("DarkMetal", (0.13, 0.135, 0.17, 1), 0.32, 0.9),
):
    m = bpy.data.materials.new(name)
    bsdf = m.node_tree.nodes.get("Principled BSDF") if m.node_tree else None
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
    MATS[name] = m


def append_block(bm, size, matrix, mat=0, bevel=0.05, segments=2, inset_front=None, relief=None, taper=None, cuts=0):
    """Adds a bevelled box to `bm`.

    size: (x, y, z) before transform; front face is -Y.
    inset_front: (thickness, depth) carved panel on the front face.
    relief: (thickness, height) raised diamond on the front face (inset, then pushed out).
    taper: (sx, sz) scale of the +X end (wedges, tapered pillars).
    cuts: loop cuts along the longest axis, for smoother baked AO on tall pieces.
    """
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    for v in tmp.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if taper:
        for v in tmp.verts:
            if v.co.x > 0:
                v.co.y *= taper[0]
                v.co.z *= taper[1]
    if cuts:
        axis = max(range(3), key=lambda i: size[i])
        edges = [e for e in tmp.edges if abs((e.verts[0].co - e.verts[1].co)[axis]) > 1e-6]
        bmesh.ops.subdivide_edges(tmp, edges=edges, cuts=cuts, use_grid_fill=True)
    if bevel:
        corner_edges = [e for e in tmp.edges if e.is_manifold and e.calc_face_angle(0) > 0.5]
        bmesh.ops.bevel(tmp, geom=corner_edges, offset=bevel, segments=segments, profile=0.5, affect="EDGES", clamp_overlap=True)
    front = min(tmp.faces, key=lambda f: f.calc_center_median().y) if (inset_front or relief) else None
    if front is not None and front.normal.y < -0.9:
        if inset_front:
            r = bmesh.ops.inset_individual(tmp, faces=[front], thickness=inset_front[0], depth=-inset_front[1])
            front = r["faces"][0] if r.get("faces") else front
        if relief:
            r = bmesh.ops.inset_individual(tmp, faces=[front], thickness=relief[0], depth=0.0)
            panel = front
            # turn the inner panel into a diamond: pull its edge midpoints out, push the corners in
            c = panel.calc_center_median()
            for v in panel.verts:
                d = v.co - c
                v.co = c + Vector((d.x * 0.55, 0, d.z * 0.55))
            bmesh.ops.translate(tmp, verts=list(panel.verts), vec=Vector((0, -relief[1], 0)))
    for f in tmp.faces:
        f.material_index = mat
    bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def append_cylinder(bm, r1, r2, depth, matrix, segments=32, mat=0, bevel=0.0):
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, cap_tris=False, segments=segments, radius1=r1, radius2=r2, depth=depth)
    if bevel:
        rims = [e for e in tmp.edges if e.is_manifold and e.calc_face_angle(0) > 0.7]
        bmesh.ops.bevel(tmp, geom=rims, offset=bevel, segments=2, profile=0.5, affect="EDGES", clamp_overlap=True)
    for f in tmp.faces:
        f.material_index = mat
    bmesh.ops.transform(tmp, matrix=matrix, verts=tmp.verts)
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def finish(name, bm, mats, collection):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(MATS[m])
    for p in me.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new(name, me)
    collection.objects.link(obj)
    return obj


def rot_y(angle):
    """Rotation in the portal plane (XZ) by `angle`, mapping +X to (cos a, 0, sin a)."""
    return Matrix.Rotation(-angle, 4, "Y")


def at(x, y, z):
    return Matrix.Translation((x, y, z))


portal_col = bpy.data.collections.new("Portal")
chamber_col = bpy.data.collections.new("Chamber")
scene.collection.children.link(portal_col)
scene.collection.children.link(chamber_col)

# ---------------------------------------------------------------- portal (centre at origin, faces -Y)
FRAME_R = 3.72
BLOCKS = 30
KEY_EVERY = BLOCKS // 5
chord = 2 * math.pi * FRAME_R / BLOCKS

bm = bmesh.new()
for i in range(BLOCKS):
    if i % KEY_EVERY == 0:
        continue  # keystone slot
    a = i / BLOCKS * 2 * math.pi + math.pi / 2
    wear = 0.92 + rng.random() * 0.14
    depth = 1.08 + rng.random() * 0.14
    jitter = Matrix.Rotation((rng.random() - 0.5) * 0.04, 4, "X") @ Matrix.Rotation((rng.random() - 0.5) * 0.03, 4, "Z")
    m = at(math.cos(a) * FRAME_R, (rng.random() - 0.5) * 0.06, math.sin(a) * FRAME_R) @ rot_y(a) @ jitter
    append_block(bm, (0.95 * wear, depth, chord * 0.9), m, bevel=0.06, inset_front=(0.09, 0.035), cuts=1)
frame = finish("Frame", bm, ["Stone"], portal_col)

bm = bmesh.new()
for k in range(5):
    a = k * KEY_EVERY / BLOCKS * 2 * math.pi + math.pi / 2
    m = at(math.cos(a) * (FRAME_R + 0.03), 0, math.sin(a) * (FRAME_R + 0.03)) @ rot_y(a)
    append_block(bm, (1.0, 1.3, chord * 0.92), m, bevel=0.05, relief=(0.08, 0.05), taper=(1.0, 1.22))
keystones = finish("Keystones", bm, ["Gold"], portal_col)

# outer mechanical ring behind the frame, with radial spines
bpy.ops.mesh.primitive_torus_add(major_radius=4.45, minor_radius=0.075, major_segments=120, minor_segments=8, location=(0, 0.35, 0), rotation=(math.pi / 2, 0, 0))
ring = bpy.context.active_object
ring.name = "OuterRing"
ring.data.name = "OuterRing"
ring.data.materials.append(MATS["DarkMetal"])
for c in ring.users_collection:
    c.objects.unlink(ring)
portal_col.objects.link(ring)
# a second, thinner ring with collar blocks, for a mechanical silhouette
bm = bmesh.new()
for i in range(24):
    a = i / 24 * 2 * math.pi
    append_block(bm, (0.22, 0.28, 0.16), at(math.cos(a) * 4.45, 0.35, math.sin(a) * 4.45) @ rot_y(a), bevel=0.02)
for i in range(12):
    a = i / 12 * 2 * math.pi + math.pi / 12
    m = at(math.cos(a) * 4.95, 0.35, math.sin(a) * 4.95) @ rot_y(a) @ Matrix.Rotation(-math.pi / 2, 4, "Y")
    append_cylinder(bm, 0.12, 0.0, 1.1, m, segments=6)
spines = finish("Spines", bm, ["DarkMetal"], portal_col)

# supports: two buttresses anchoring the ring onto the dais (dais top is 3.3 below the centre)
bm = bmesh.new()
for side in (-1, 1):
    x = side * 3.6
    base_z, top_z = -3.32, -1.85
    h = top_z - base_z
    append_block(bm, (1.0, 1.55, h), at(x, 0.05, base_z + h / 2), bevel=0.07, inset_front=(0.12, 0.04), cuts=2)
    append_block(bm, (1.22, 1.75, 0.22), at(x, 0.05, base_z + 0.11), bevel=0.04)
    append_block(bm, (1.12, 1.66, 0.16), at(x, 0.05, top_z + 0.02), mat=1, bevel=0.03)
supports = finish("Supports", bm, ["Stone", "Gold"], portal_col)

# ---------------------------------------------------------------- chamber pieces (base at z=0, ~2 x 2 x 16)
def monolith_a():
    bm = bmesh.new()
    append_block(bm, (2.5, 2.5, 0.8), at(0, 0, 0.4), bevel=0.08)
    append_block(bm, (2.0, 2.0, 13.4), at(0, 0, 0.8 + 6.7), bevel=0.12, inset_front=(0.25, 0.06), cuts=10)
    append_block(bm, (2.35, 2.35, 0.5), at(0, 0, 14.45), bevel=0.06)
    append_block(bm, (1.5, 1.5, 1.3), at(0, 0, 15.35), bevel=0.06)
    return finish("Monolith_A", bm, ["Stone"], chamber_col)


def monolith_b():
    bm = bmesh.new()
    append_block(bm, (2.6, 2.6, 0.9), at(0, 0, 0.45), bevel=0.08)
    # tapered obelisk shaft and pyramidion
    tmp_m = at(0, 0, 0.9 + 6.8) @ Matrix.Rotation(math.pi / 2, 4, "Y")
    append_block(bm, (13.6, 2.0, 2.0), tmp_m, bevel=0.08, taper=(0.62, 0.62), cuts=10)
    append_cylinder(bm, 0.88, 0.0, 1.5, at(0, 0, 15.45) @ Matrix.Rotation(math.pi / 4, 4, "Z"), segments=4)
    return finish("Monolith_B", bm, ["Stone"], chamber_col)


def monolith_c():
    """Broken column: fluted-looking 12-sided shaft, cut off at a slant."""
    bm = bmesh.new()
    append_block(bm, (2.6, 2.6, 0.9), at(0, 0, 0.45), bevel=0.08)
    tmp = bmesh.new()
    bmesh.ops.create_cone(tmp, cap_ends=True, segments=12, radius1=1.0, radius2=0.92, depth=15.0)
    bmesh.ops.subdivide_edges(tmp, edges=[e for e in tmp.edges if abs((e.verts[0].co - e.verts[1].co).z) > 1e-6], cuts=10, use_grid_fill=True)
    bmesh.ops.transform(tmp, matrix=at(0, 0, 0.9 + 7.5), verts=tmp.verts)
    cut = bmesh.ops.bisect_plane(tmp, geom=tmp.verts[:] + tmp.edges[:] + tmp.faces[:], plane_co=(0, 0, 13.8), plane_no=Vector((0.35, 0.1, 1)).normalized(), clear_outer=True)
    edges = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    bmesh.ops.edgeloop_fill(tmp, edges=edges)
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return finish("Monolith_C", bm, ["Stone"], chamber_col)


def monolith_d():
    """Twin-slab gate fragment with a lintel stub."""
    bm = bmesh.new()
    append_block(bm, (2.8, 2.4, 0.7), at(0, 0, 0.35), bevel=0.08)
    for x in (-0.62, 0.62):
        append_block(bm, (0.9, 1.9, 14.0), at(x, 0, 0.7 + 7.0), bevel=0.1, cuts=10)
    append_block(bm, (2.4, 2.1, 0.9), at(0, 0, 15.1), bevel=0.08)
    return finish("Monolith_D", bm, ["Stone"], chamber_col)


def ruin_a():
    """Broken arch: five voussoirs of a large arch, as one floating segment (centred)."""
    bm = bmesh.new()
    R = 4.0
    for i in range(5):
        a = math.radians(55 + i * 14)
        m = at(math.cos(a) * R, 0, math.sin(a) * R - R * 0.85) @ rot_y(a)
        append_block(bm, (1.2, 1.6, 2 * math.pi * R / 26 * 0.92), m, bevel=0.06, inset_front=(0.1, 0.04))
    return finish("Ruin_A", bm, ["Stone"], chamber_col)


def ruin_b():
    """Lintel slab broken at one end."""
    bm = bmesh.new()
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1.0)
    for v in tmp.verts:
        v.co = Vector((v.co.x * 7.0, v.co.y * 2.2, v.co.z * 1.3))
    bmesh.ops.subdivide_edges(tmp, edges=[e for e in tmp.edges if abs((e.verts[0].co - e.verts[1].co).x) > 1e-6], cuts=6, use_grid_fill=True)
    cut = bmesh.ops.bisect_plane(tmp, geom=tmp.verts[:] + tmp.edges[:] + tmp.faces[:], plane_co=(2.6, 0, 0), plane_no=Vector((1, 0.25, 0.45)).normalized(), clear_outer=True)
    bmesh.ops.edgeloop_fill(tmp, edges=[e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)])
    me = bpy.data.meshes.new("tmp")
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return finish("Ruin_B", bm, ["Stone"], chamber_col)


def dais():
    """Three steps (radii 6 / 4.8 / 3.7, 0.3 high each) with bevelled rims; base at z=0."""
    bm = bmesh.new()
    for r, z in ((6.0, 0.15), (4.8, 0.45), (3.7, 0.75)):
        append_cylinder(bm, r + 0.15, r, 0.3, at(0, 0, z), segments=64, bevel=0.04)
    return finish("Dais", bm, ["Stone"], chamber_col)


chamber_objs = [monolith_a(), monolith_b(), monolith_c(), monolith_d(), ruin_a(), ruin_b(), dais()]
portal_objs = [frame, keystones, ring, spines, supports]

# lay chamber pieces out in a row so they do not shadow each other during the AO bake
for i, o in enumerate(chamber_objs):
    o.location.x = i * 14.0
# portal parts bake together (they occlude each other); lift it so the dais-level ground does not touch
for o in portal_objs:
    o.location.z = 4.2


# ---------------------------------------------------------------- ambient occlusion → vertex colours
def ground(z, size):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, z))
    g = bpy.context.active_object
    g.name = "BakeGround"
    return g


def bake_ao(objs, distance):
    world.light_settings.distance = distance
    for o in objs:
        me = o.data
        if "AO" not in me.color_attributes:
            # per vertex (not per corner): shared vertices stay shared, so the file is much smaller
            me.color_attributes.new("AO", "BYTE_COLOR", "POINT")
        me.color_attributes.active_color = me.color_attributes["AO"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.bake(type="AO", target="VERTEX_COLORS")
        o.select_set(False)


g1 = ground(0.9, 40)  # dais top under the portal
bake_ao(portal_objs, 0.9)
bpy.data.objects.remove(g1)
g2 = ground(0.0, 200)
bake_ao(chamber_objs, 1.6)
bpy.data.objects.remove(g2)

for i, o in enumerate(chamber_objs):
    o.location.x = 0.0
for o in portal_objs:
    o.location.z = 0.0

bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND_OUT))


# ---------------------------------------------------------------- export
def export(objs, path):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(path),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_normals=True,
        export_texcoords=False,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


export(portal_objs, os.path.join(OUT_DIR, "portal.glb"))
export(chamber_objs, os.path.join(OUT_DIR, "chamber.glb"))
for o in portal_objs + chamber_objs:
    print(f"ASSET {o.name}: {len(o.data.polygons)} faces, {len(o.data.vertices)} verts")
print("DONE")
