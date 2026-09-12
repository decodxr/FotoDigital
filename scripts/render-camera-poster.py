"""Render a poster from the licensed camera geometry, not from a stock thumbnail.
Optional offline dependencies: pyrender==0.1.45 trimesh>=4 numpy Pillow.
On Python 3.12, upgrade PyOpenGL to 3.1.10 after installing pyrender.
Run with PYOPENGL_PLATFORM=egl where a headless EGL device is available.
"""
import argparse
from pathlib import Path
import numpy as np
import trimesh
import pyrender
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("destination")
args = parser.parse_args()

asset = trimesh.load(args.source, force="scene", process=False)
print("Geometry:", [(name, len(mesh.faces)) for name, mesh in asset.geometry.items()])
# The disconnected long strap belongs to a tabletop arrangement, not the hero.
parts = []
for node in asset.graph.nodes_geometry:
    matrix, key = asset.graph[node]
    if "strap" in node.lower():
        continue
    mesh = asset.geometry[key].copy()
    mesh.apply_transform(matrix)
    parts.append(mesh)
bounds = np.array([mesh.bounds for mesh in parts])
low, high = bounds[:, 0].min(axis=0), bounds[:, 1].max(axis=0)
center = (low + high) / 2
scale = 3.8 / (high[0] - low[0])
rotation = trimesh.transformations.euler_matrix(0.13, -0.42, -0.055, "rxyz")
scene = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.35, 0.35, 0.35])
for mesh in parts:
    mesh.vertices = (mesh.vertices - center) * scale
    material = mesh.visual.material
    if material.name == "Camera_01_lens":
        material.baseColorFactor = [0.08, 0.15, 0.19, 1]
        material.metallicFactor = 0.55
        material.roughnessFactor = 0.1
    scene.add(pyrender.Mesh.from_trimesh(mesh, smooth=False), pose=rotation)

def look_at(position, target=(0, 0, 0)):
    z = np.array(position, dtype=float) - np.array(target)
    z /= np.linalg.norm(z)
    x = np.cross([0, 1, 0], z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    pose = np.eye(4)
    pose[:3, :3] = np.column_stack([x, y, z])
    pose[:3, 3] = position
    return pose

camera = pyrender.PerspectiveCamera(yfov=np.deg2rad(34), aspectRatio=1.25)
scene.add(camera, pose=look_at([0, 0.15, 7.7], [0, 0.15, 0]))
for position, intensity, color in [
    ([-3, 5, 4], 3.8, [1, .96, .89]),
    ([4, 2, 3], 3.1, [.82, .91, 1]),
    ([0, 6, -3], 4.0, [1, 1, 1]),
    ([-4, 0, -1], 1.7, [.8, .88, 1]),
    ([1, -2, 5], 1.4, [1, .96, .9]),
]:
    scene.add(pyrender.DirectionalLight(color=color, intensity=intensity), pose=look_at(position))
renderer = pyrender.OffscreenRenderer(1600, 1280)
try:
    color, depth = renderer.render(scene, flags=pyrender.RenderFlags.RGBA)
    image = Image.fromarray(color).resize((1200, 960), Image.Resampling.LANCZOS)
    destination = Path(args.destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=91, method=6)
    print("Poster:", destination, destination.stat().st_size, "bytes")
finally:
    renderer.delete()
