"""Extract isolated sprites without relying on imperfect atlas cell boundaries."""
from pathlib import Path
from PIL import Image

root = Path(__file__).parents[1]
atlas = Image.open(root / "public" / "sprites" / "anime-atlas-v2.png").convert("RGBA")
regions = {
    "heroes/ninja": (0, 0, 410, 512),
    "heroes/operator": (410, 0, 760, 512),
    "heroes/skeleton": (760, 0, 1120, 512),
    "heroes/granny": (1120, 0, 1536, 512),
    "enemies/mercenary": (0, 512, 360, 1024),
    "enemies/trooper": (360, 512, 690, 1024),
    "enemies/officer": (690, 512, 1070, 1024),
    "enemies/heavy": (1070, 512, 1536, 1024),
}
for name, region in regions.items():
    piece = atlas.crop(region)
    alpha_box = piece.getchannel("A").getbbox()
    if not alpha_box:
        continue
    piece = piece.crop(alpha_box)
    canvas = Image.new("RGBA", (480, 512))
    scale = min(1, 456 / piece.width, 488 / piece.height)
    if scale < 1:
        piece = piece.resize((round(piece.width * scale), round(piece.height * scale)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(piece, ((480-piece.width)//2, 512-piece.height-12))
    destination = root / "public" / "sprites" / f"{name}.png"
    destination.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(destination, optimize=True)
