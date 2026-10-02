from pathlib import Path
import fitz
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
PDF = ROOT / "CreateKids-Визионеры.pdf"
OUT = ROOT / "rendered-slides"
OUT.mkdir(parents=True, exist_ok=True)

doc = fitz.open(PDF)
paths = []
for index, page in enumerate(doc, start=1):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    path = OUT / f"rendered-{index:02d}.png"
    pix.save(path)
    paths.append(path)

thumb_w, thumb_h = 480, 270
margin = 24
sheet = Image.new("RGB", (thumb_w * 4 + margin * 5, thumb_h * 3 + margin * 4), "#D9D9D9")
for i, path in enumerate(paths):
    img = Image.open(path).convert("RGB").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col = i % 4
    row = i // 4
    sheet.paste(img, (margin + col * (thumb_w + margin), margin + row * (thumb_h + margin)))
sheet.save(OUT / "CreateKids-Визионеры-preview.jpg", quality=94)
print(f"Rendered {len(paths)} pages to {OUT}")
