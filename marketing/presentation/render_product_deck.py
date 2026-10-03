from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "CreateKids-Презентация-проекта.pdf"
OUT = ROOT / "product-rendered-slides"
OUT.mkdir(parents=True, exist_ok=True)

for old in OUT.glob("rendered-*.png"):
    old.unlink()

doc = fitz.open(PDF)
paths = []
for index, page in enumerate(doc, start=1):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = OUT / f"rendered-{index:02d}.png"
    pix.save(path)
    paths.append(path)

thumb_w, thumb_h = 384, 216
margin = 22
sheet = Image.new("RGB", (thumb_w * 5 + margin * 6, thumb_h * 3 + margin * 4), "#D7D8DB")
for i, path in enumerate(paths):
    img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col, row = i % 5, i // 5
    sheet.paste(img, (margin + col * (thumb_w + margin), margin + row * (thumb_h + margin)))
sheet.save(OUT / "CreateKids-Презентация-проекта-preview.jpg", quality=94)
print(f"Rendered {len(paths)} PDF pages to {OUT}")
