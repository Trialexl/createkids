from pathlib import Path
import re
import zipfile
import fitz

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parents[1]
pptx = ROOT / "CreateKids-Визионеры.pptx"
pdf = ROOT / "CreateKids-Визионеры.pdf"

with zipfile.ZipFile(pptx) as archive:
    names = archive.namelist()
    slides = [n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)]
    notes = [n for n in names if re.fullmatch(r"ppt/notesSlides/notesSlide\d+\.xml", n)]
    media = [n for n in names if n.startswith("ppt/media/") and n.lower().endswith(".png")]

pdf_doc = fitz.open(pdf)
renders = list((ROOT / "rendered-slides").glob("rendered-*.png"))

md_files = list(PROJECT.rglob("*.md"))
wiki = [(f, p.strip()) for f in md_files for p in re.findall(r"\[\[([^\]|#]+)", f.read_text())]
missing = []
for source, target in wiki:
    candidates = [PROJECT / f"{target}.md", source.parent / f"{target}.md"]
    if not any(path.exists() for path in candidates):
        missing.append((str(source.relative_to(PROJECT)), target))

checks = {
    "pptx_exists": pptx.exists(),
    "pdf_exists": pdf.exists(),
    "pptx_slides": len(slides),
    "speaker_notes": len(notes),
    "embedded_png": len(media),
    "pdf_pages": len(pdf_doc),
    "rendered_pages": len(renders),
    "missing_wikilinks": len(missing),
    "pptx_bytes": pptx.stat().st_size,
    "pdf_bytes": pdf.stat().st_size,
}
print(checks)

expected = {
    "pptx_exists": True,
    "pdf_exists": True,
    "pptx_slides": 12,
    "speaker_notes": 12,
    "embedded_png": 12,
    "pdf_pages": 12,
    "rendered_pages": 12,
    "missing_wikilinks": 0,
}
for key, value in expected.items():
    if checks[key] != value:
        raise SystemExit(f"FAILED: {key}={checks[key]}, expected {value}")
print("All deck checks PASSED")
