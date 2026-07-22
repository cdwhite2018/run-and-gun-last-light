"""Extract the four hero-card portraits from the current 4x2 sprite atlas."""
from pathlib import Path
from PIL import Image

root = Path(__file__).parents[1]
atlas = Image.open(root / "public" / "sprites" / "anime-atlas-v2.png").convert("RGBA")
out = root / "public" / "sprites" / "heroes"
out.mkdir(parents=True, exist_ok=True)
cell_w, cell_h = atlas.width // 4, atlas.height // 2
for index, name in enumerate(("ninja", "operator", "skeleton", "granny")):
    cell = atlas.crop((index * cell_w, 0, (index + 1) * cell_w, cell_h))
    cell.save(out / f"{name}.png", optimize=True)
