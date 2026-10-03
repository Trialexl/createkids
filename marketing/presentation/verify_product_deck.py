from pathlib import Path
import re
import zipfile

import fitz

ROOT = Path(__file__).resolve().parent
pptx = ROOT / "CreateKids-Презентация-проекта.pptx"
pdf = ROOT / "CreateKids-Презентация-проекта.pdf"
preview = ROOT / "product-rendered-slides" / "CreateKids-Презентация-проекта-preview.jpg"

with zipfile.ZipFile(pptx) as archive:
    names = archive.namelist()
    slides = [n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
    notes = [n for n in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", n)]
    media = [n for n in names if n.startswith("ppt/media/") and n.lower().endswith(".png")]
    text = "\n".join(
        archive.read(n).decode("utf-8", errors="ignore")
        for n in names
        if n.endswith(".xml")
    )

pdf_doc = fitz.open(pdf)
renders = list((ROOT / "product-rendered-slides").glob("rendered-*.png"))
source = (ROOT.parents[1] / "Идеи.md").read_text(encoding="utf-8")

checks = {
    "pptx_exists": pptx.exists(),
    "pdf_exists": pdf.exists(),
    "preview_exists": preview.exists(),
    "pptx_slides": len(slides),
    "speaker_notes": len(notes),
    "embedded_png": len(media),
    "pdf_pages": len(pdf_doc),
    "rendered_pages": len(renders),
    "source_has_origin_section": "### Откуда появилась идея" in source,
    "source_has_value_section": "### Почему эта идея стоит того" in source,
    "source_has_brand_phrase": "Будущее нельзя предсказать. Способность создавать можно развивать." in source,
    "deck_has_founder_title": "Почему мы сделали CreateKids" in text,
    "pptx_bytes": pptx.stat().st_size,
    "pdf_bytes": pdf.stat().st_size,
}
print(checks)

expected = {
    "pptx_exists": True,
    "pdf_exists": True,
    "preview_exists": True,
    "pptx_slides": 14,
    "speaker_notes": 14,
    "embedded_png": 14,
    "pdf_pages": 14,
    "rendered_pages": 14,
    "source_has_origin_section": True,
    "source_has_value_section": True,
    "source_has_brand_phrase": True,
    "deck_has_founder_title": True,
}
for key, value in expected.items():
    if checks[key] != value:
        raise SystemExit(f"FAILED: {key}={checks[key]}, expected {value}")
print("All product deck checks PASSED")
