from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import math
import random

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "slides-png"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1920, 1080
GRAPHITE = "#171A21"
INK = "#1C1E24"
PAPER = "#F5F2EA"
WHITE = "#FFFFFF"
LIME = "#C7F464"
CORAL = "#FF6B5E"
SKY = "#67C8FF"
SOFT_BLUE = "#DFF3FF"
SOFT_LIME = "#EDF9D2"
SOFT_CORAL = "#FFE1DC"
MUTED = "#777A82"

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"

random.seed(31)


def F(path, size):
    return ImageFont.truetype(path, size)


def add_texture(im, strength=9, opacity=0.035):
    noise = Image.effect_noise(im.size, strength).convert("L")
    alpha = noise.point(lambda p: int(255 * opacity))
    grain = Image.merge("RGBA", (noise, noise, noise, alpha))
    return Image.alpha_composite(im.convert("RGBA"), grain)


def text_width(draw, text, font):
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0]


def wrap_lines(draw, text, font, width):
    lines = []
    for para in text.split("\n"):
        words = para.split()
        if not words:
            lines.append("")
            continue
        line = ""
        for word in words:
            test = word if not line else f"{line} {word}"
            if text_width(draw, test, font) <= width:
                line = test
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def fitted(draw, text, box, max_size, min_size, fill, font_path=FONT_BLACK, spacing=4):
    x, y, w, h = box
    for size in range(max_size, min_size - 1, -2):
        font = F(font_path, size)
        lines = wrap_lines(draw, text, font, w)
        ascent, descent = font.getmetrics()
        line_h = ascent + descent
        total = len(lines) * line_h + max(0, len(lines) - 1) * spacing
        if total <= h:
            yy = y
            for line in lines:
                draw.text((x, yy), line, font=font, fill=fill)
                yy += line_h + spacing
            return yy
    raise RuntimeError(f"Text does not fit: {text}")


def hand_line(draw, points, fill, width=10, jitter=4, seed=0):
    rng = random.Random(seed)
    pts = [(x + rng.randint(-jitter, jitter), y + rng.randint(-jitter, jitter)) for x, y in points]
    draw.line(pts, fill=fill, width=width, joint="curve")
    if width > 6:
        pts2 = [(x + rng.randint(-2, 2), y + rng.randint(-2, 2)) for x, y in points]
        draw.line(pts2, fill=fill, width=max(3, width // 3), joint="curve")


def dashed(draw, points, fill, width=6, dash=28, gap=18):
    for a, b in zip(points, points[1:]):
        x1, y1 = a
        x2, y2 = b
        dist = math.hypot(x2 - x1, y2 - y1)
        if not dist:
            continue
        ux, uy = (x2 - x1) / dist, (y2 - y1) / dist
        pos = 0
        while pos < dist:
            end = min(pos + dash, dist)
            draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * end, y1 + uy * end), fill=fill, width=width)
            pos += dash + gap


def star(draw, center, r1, r2, points, fill, outline=None, width=4, rotation=-math.pi / 2):
    cx, cy = center
    poly = []
    for i in range(points * 2):
        radius = r1 if i % 2 == 0 else r2
        angle = rotation + i * math.pi / points
        poly.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(poly, fill=fill)
    if outline:
        draw.line(poly + [poly[0]], fill=outline, width=width, joint="curve")


def label(im, xy, text, bg, fg=GRAPHITE, size=28, angle=0, pad=(20, 12)):
    font = F(FONT_BOLD, size)
    dummy = ImageDraw.Draw(im)
    box = dummy.textbbox((0, 0), text, font=font)
    tw, th = box[2] - box[0], box[3] - box[1]
    pw, ph = tw + pad[0] * 2, th + pad[1] * 2 + 4
    patch = Image.new("RGBA", (pw + 30, ph + 30), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    pd.rounded_rectangle((12, 12, 12 + pw, 12 + ph), radius=18, fill=bg)
    pd.text((12 + pad[0], 12 + pad[1] - box[1]), text, font=font, fill=fg)
    if angle:
        patch = patch.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    im.alpha_composite(patch, (int(xy[0]), int(xy[1])))


def panel(im, box, fill=WHITE, angle=0, radius=34, shadow=True, callback=None):
    x, y, w, h = map(int, box)
    pad = 50
    patch = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    if shadow:
        pd.rounded_rectangle((pad + 12, pad + 18, pad + w + 12, pad + h + 18), radius=radius, fill=(0, 0, 0, 38))
    pd.rounded_rectangle((pad, pad, pad + w, pad + h), radius=radius, fill=fill)
    if callback:
        callback(pd, pad, pad, w, h)
    if angle:
        patch = patch.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    im.alpha_composite(patch, (x - (patch.width - w) // 2, y - (patch.height - h) // 2))


def base(bg, index, dark=False):
    im = add_texture(Image.new("RGBA", (W, H), bg), 10, 0.045 if dark else 0.03)
    d = ImageDraw.Draw(im)
    fg = WHITE if dark else INK
    d.text((92, 55), "CREATEKIDS", font=F(FONT_BLACK, 27), fill=fg)
    d.text((1828, 58), f"{index:02d}/12", font=F(FONT_BOLD, 22), fill=fg, anchor="ra")
    return im, d


def save(im, n):
    path = OUT / f"createkids-slide-{n:02d}.png"
    im.convert("RGB").save(path, quality=96)


# 01 — Cover
im, d = base(GRAPHITE, 1, True)
fitted(d, "ВИЗИОНЕРЫ —\nВОТ КТО ВАШИ ДЕТИ", (94, 165, 1050, 330), 88, 60, WHITE)
d.text((100, 545), "Не только пользоваться будущим. Создавать его.", font=F(FONT_BOLD, 38), fill=LIME)
d.text((100, 900), "Семейная лаборатория творчества • 7 и 14 лет", font=F(FONT_REG, 28), fill="#D5D7DD")
hand_line(d, [(1160, 980), (1225, 850), (1190, 720), (1335, 620), (1290, 470), (1450, 360), (1410, 190), (1725, 96)], LIME, 14, 6, 1)
d.ellipse((1265, 365, 1515, 615), fill=SKY, outline=WHITE, width=6)
d.ellipse((1340, 440, 1440, 540), fill=GRAPHITE)
d.arc((1315, 414, 1465, 564), 205, 525, fill=CORAL, width=22)
star(d, (1635, 295), 92, 39, 7, CORAL, WHITE, 5, -0.45)
d.polygon([(1205, 720), (1375, 610), (1515, 775), (1335, 900)], fill=PAPER)
d.line([(1250, 748), (1340, 688), (1440, 795)], fill=GRAPHITE, width=11)
label(im, (1185, 240), "рисунок", SKY, size=27, angle=-6)
label(im, (1505, 560), "звук", CORAL, WHITE, size=27, angle=7)
label(im, (1168, 875), "код", LIME, size=27, angle=-4)
save(im, 1)

# 02 — Answers and questions
im, d = base(PAPER, 2)
fitted(d, "ОТВЕТЫ ДОСТУПНЫ.", (95, 140, 1150, 150), 78, 58, INK)
fitted(d, "ЦЕННЕЕ — ЗАМЫСЕЛ И ВОПРОС.", (95, 290, 1250, 160), 64, 48, CORAL, FONT_BOLD)
for i, (x, y, shade) in enumerate([(115, 640, WHITE), (370, 675, "#E7E8EB"), (625, 710, "#D7D9DE")]):
    def answer(pd, ox, oy, w, h, i=i):
        pd.rounded_rectangle((ox + 25, oy + 25, ox + w - 25, oy + 48), radius=10, fill="#AEB2BA")
        for k in range(3):
            pd.rounded_rectangle((ox + 25, oy + 83 + k * 35, ox + w - 70 - k * 16, oy + 96 + k * 35), radius=5, fill="#C9CCD2")
        pd.text((ox + 25, oy + h - 52), "ГОТОВЫЙ ОТВЕТ", font=F(FONT_BOLD, 17), fill=MUTED)
    panel(im, (x, y, 280, 230), shade, -5 + i * 3, 26, True, answer)
d.ellipse((1285, 405, 1775, 895), fill=SKY)
d.ellipse((1395, 515, 1665, 785), fill=PAPER)
d.arc((1350, 470, 1710, 830), 205, 520, fill=CORAL, width=52)
d.rounded_rectangle((1500, 805, 1560, 930), radius=30, fill=CORAL)
hand_line(d, [(955, 835), (1110, 800), (1190, 880), (1325, 840), (1495, 980), (1760, 915)], GRAPHITE, 10, 5, 7)
label(im, (1365, 925), "А ЧТО, ЕСЛИ…", LIME, size=30, angle=-3)
d.text((98, 992), "ИИ — инструмент. Авторский выбор остаётся за ребёнком.", font=F(FONT_BOLD, 27), fill=INK)
save(im, 2)

# 03 — Create the future
im, d = base(SKY, 3)
fitted(d, "НЕ УГАДЫВАТЬ БУДУЩЕЕ.", (95, 120, 1320, 160), 72, 54, INK)
fitted(d, "УЧИТЬСЯ ЕГО СОЗДАВАТЬ.", (95, 270, 1220, 160), 66, 48, WHITE)
# dissolving signpost
for idx, (yy, text, col) in enumerate([(515, "профессия?", PAPER), (625, "технология?", SOFT_CORAL), (735, "правильный путь?", SOFT_LIME)]):
    d.polygon([(115, yy), (575, yy), (650, yy + 48), (575, yy + 96), (115, yy + 96)], fill=col)
    d.text((155, yy + 48), text, font=F(FONT_BOLD, 29), fill=INK, anchor="lm")
    for k in range(6):
        alpha_col = ["#AFC7D4", "#B9D5DF", "#C8DFE7"][k % 3]
        d.ellipse((655 + k * 34, yy + 30 + (k % 2) * 20, 672 + k * 34, yy + 47 + (k % 2) * 20), fill=alpha_col)
# bridge
hand_line(d, [(780, 900), (950, 760), (1120, 830), (1295, 650), (1470, 740), (1740, 520)], GRAPHITE, 20, 6, 20)
for x, y, c, icon in [(900, 795, CORAL, "Aa"), (1110, 770, LIME, "♪"), (1305, 650, PAPER, "□"), (1515, 665, CORAL, "{ }")]:
    d.ellipse((x - 65, y - 65, x + 65, y + 65), fill=c, outline=INK, width=5)
    d.text((x, y), icon, font=F(FONT_BLACK, 34), fill=INK, anchor="mm")
label(im, (1420, 430), "СВОЙ МАРШРУТ", GRAPHITE, WHITE, size=27, angle=3)
save(im, 3)

# 04 — Eight languages
im, d = base(SKY, 4)
fitted(d, "8 ЯЗЫКОВ ТВОРЧЕСТВА", (95, 110, 1200, 150), 76, 58, INK)
d.text((99, 260), "Своя траектория у каждого.", font=F(FONT_BOLD, 34), fill=WHITE)
tiles = [
    (95, 380, 385, 245, CORAL, "РИСУНОК", "линия → образ"),
    (505, 360, 405, 285, PAPER, "ИСТОРИИ", "слово → мир"),
    (935, 380, 405, 235, LIME, "МУЗЫКА", "ритм → настроение"),
    (1365, 355, 455, 290, SOFT_CORAL, "КОНСТРУИРОВАНИЕ", "материал → прототип"),
    (95, 655, 330, 295, PAPER, "ТЕАТР", "жест → персонаж"),
    (450, 690, 360, 250, GRAPHITE, "КИНО", "кадр → сюжет"),
    (835, 660, 420, 290, LIME, "DIGITAL", "правило → игра"),
    (1280, 690, 540, 250, PAPER, "ДИЗАЙН", "нужда → решение"),
]
for idx, (x, y, w, h, color, title, sub) in enumerate(tiles):
    fg = WHITE if color == GRAPHITE else INK
    d.rounded_rectangle((x, y, x + w, y + h), radius=34, fill=color)
    d.text((x + 28, y + 28), title, font=F(FONT_BOLD, 25 if len(title) < 14 else 21), fill=fg)
    d.text((x + 28, y + h - 46), sub, font=F(FONT_REG, 22), fill=fg)
    if idx == 0:
        hand_line(d, [(x + 60, y + 135), (x + 130, y + 95), (x + 205, y + 150), (x + 285, y + 90)], WHITE, 8, 3, 12)
    elif idx == 1:
        d.text((x + w - 90, y + 130), "Aa", font=F(FONT_ITALIC, 70), fill=CORAL, anchor="mm")
    elif idx == 2:
        for k in range(7):
            hh = 38 + (k % 3) * 24
            d.rounded_rectangle((x + 45 + k * 42, y + 130 - hh / 2, x + 66 + k * 42, y + 130 + hh / 2), radius=10, fill=INK)
    elif idx == 3:
        d.polygon([(x + 300, y + 80), (x + 390, y + 130), (x + 315, y + 185), (x + 225, y + 132)], fill=SKY, outline=INK)
    elif idx == 4:
        d.ellipse((x + 95, y + 90, x + 205, y + 200), outline=CORAL, width=8)
        d.arc((x + 120, y + 120, x + 180, y + 180), 10, 170, fill=CORAL, width=6)
    elif idx == 5:
        for k in range(3):
            d.rectangle((x + 45 + k * 87, y + 105, x + 110 + k * 87, y + 160), outline=SKY, width=5)
    elif idx == 6:
        d.text((x + w / 2, y + 150), "{ }", font=F(FONT_BLACK, 66), fill=INK, anchor="mm")
    else:
        star(d, (x + w - 120, y + 130), 68, 30, 6, CORAL, INK, 4)
save(im, 4)

# 05 — Two trajectories
im, d = base(PAPER, 5)
fitted(d, "РАЗНЫЕ ЗАДАЧИ. РАВНОЕ АВТОРСТВО.", (95, 110, 1500, 150), 66, 48, INK)

def child7(pd, ox, oy, w, h):
    pd.text((ox + 38, oy + 35), "7 ЛЕТ", font=F(FONT_BLACK, 48), fill=INK)
    pd.text((ox + 38, oy + 105), "быстро пробует", font=F(FONT_BOLD, 30), fill=INK)
    pd.ellipse((ox + 90, oy + 200, ox + 330, oy + 435), fill=CORAL)
    pd.ellipse((ox + 135, oy + 270, ox + 176, oy + 311), fill=WHITE)
    pd.ellipse((ox + 245, oy + 270, ox + 286, oy + 311), fill=WHITE)
    pd.line((ox + 170, oy + 365, ox + 220, oy + 390, ox + 275, oy + 350), fill=INK, width=10, joint="curve")
    pd.text((ox + 40, oy + h - 112), "пятно → персонаж\nзвук → история", font=F(FONT_BOLD, 27), fill=INK, spacing=8)


def child14(pd, ox, oy, w, h):
    pd.text((ox + 38, oy + 35), "14 ЛЕТ", font=F(FONT_BLACK, 48), fill=WHITE)
    pd.text((ox + 38, oy + 105), "строит свой стиль", font=F(FONT_BOLD, 30), fill=WHITE)
    pd.rectangle((ox + 75, oy + 205, ox + 475, oy + 455), fill=PAPER)
    pd.text((ox + 110, oy + 235), "СВОЙ\nГОЛОС", font=F(FONT_BLACK, 56), fill=INK, spacing=-4)
    pd.ellipse((ox + 360, oy + 275, ox + 435, oy + 350), fill=LIME)
    pd.line((ox + 110, oy + 407, ox + 400, oy + 407), fill=CORAL, width=11)
    pd.text((ox + 40, oy + h - 112), "постер → трек\nистория → digital", font=F(FONT_BOLD, 27), fill=WHITE, spacing=8)

panel(im, (95, 335, 650, 580), SOFT_CORAL, -2, 40, True, child7)
panel(im, (1175, 325, 650, 590), GRAPHITE, 2, 40, True, child14)
dashed(d, [(425, 940), (750, 1005), (965, 925), (1235, 1000), (1515, 935)], INK, 6, 26, 16)
label(im, (835, 900), "ВМЕСТЕ", LIME, size=31, angle=-2)
d.text((960, 1030), "старший не учитель • младший не исполнитель", font=F(FONT_BOLD, 25), fill=INK, anchor="mm")
save(im, 5)

# 06 — Creative cycle
im, d = base(GRAPHITE, 6, True)
fitted(d, "КАК РОЖДАЕТСЯ ИДЕЯ", (95, 115, 1150, 150), 76, 56, WHITE)
d.text((99, 260), "Не вдохновение по команде. Цикл проб и изменений.", font=F(FONT_BOLD, 33), fill=LIME)
path = [(180, 630), (585, 510), (990, 660), (1420, 480), (1740, 650)]
hand_line(d, path, SKY, 14, 6, 44)
steps = [
    (180, 630, CORAL, "01", "ЗАМЕТИТЬ", "что привлекает"),
    (585, 510, PAPER, "02", "ПРИДУМАТЬ", "несколько вариантов"),
    (990, 660, LIME, "03", "СДЕЛАТЬ", "первую версию"),
    (1420, 480, CORAL, "04", "ИЗМЕНИТЬ", "проверить эффект"),
    (1740, 650, PAPER, "05", "ПРОДОЛЖИТЬ", "или остановиться"),
]
for x, y, color, num, title, sub in steps:
    d.ellipse((x - 84, y - 84, x + 84, y + 84), fill=color, outline=WHITE, width=5)
    d.text((x, y), num, font=F(FONT_BLACK, 41), fill=INK, anchor="mm")
    d.text((x, y + 135), title, font=F(FONT_BLACK, 25), fill=WHITE, anchor="mm")
    d.text((x, y + 175), sub, font=F(FONT_REG, 22), fill="#D8DAE0", anchor="mm")
label(im, (125, 910), "ПЕРВАЯ ВЕРСИЯ ВАЖНЕЕ ИДЕАЛЬНОЙ ИДЕИ", PAPER, size=27, angle=-1)
save(im, 6)

# 07 — Family laboratory
im, d = base(PAPER, 7)
fitted(d, "СЕМЬЯ СТАНОВИТСЯ ЛАБОРАТОРИЕЙ", (95, 110, 1500, 150), 68, 50, INK)
d.text((99, 265), "Не одинаковые поделки. Общая культура создания.", font=F(FONT_BOLD, 34), fill=CORAL)
# top-down table
d.rounded_rectangle((120, 390, 1800, 955), radius=90, fill="#E5D7C2")
d.rounded_rectangle((155, 425, 1765, 920), radius=70, fill="#F0E4D2")
# individual work zones
for x, y, c, kind in [(255, 540, SOFT_CORAL, "draw"), (690, 485, GRAPHITE, "sound"), (1115, 560, SOFT_BLUE, "build"), (1500, 485, LIME, "code")]:
    d.rounded_rectangle((x - 155, y - 100, x + 155, y + 190), radius=35, fill=c)
    if kind == "draw":
        hand_line(d, [(x - 105, y + 60), (x - 30, y - 20), (x + 35, y + 85), (x + 110, y - 5)], CORAL, 10, 4, 61)
    elif kind == "sound":
        for k in range(6):
            hh = 45 + (k % 3) * 35
            d.rounded_rectangle((x - 110 + k * 40, y + 30 - hh / 2, x - 88 + k * 40, y + 30 + hh / 2), radius=10, fill=LIME)
    elif kind == "build":
        d.polygon([(x - 95, y + 90), (x, y - 35), (x + 95, y + 90)], fill=SKY, outline=INK)
        d.rectangle((x - 70, y + 90, x + 70, y + 150), fill=PAPER, outline=INK, width=5)
    else:
        d.text((x, y + 40), "{ }", font=F(FONT_BLACK, 80), fill=INK, anchor="mm")
# central shared circle
d.ellipse((820, 675, 1100, 955), fill=WHITE, outline=CORAL, width=10)
star(d, (960, 815), 80, 35, 7, CORAL, INK, 4)
label(im, (790, 735), "ОБЩИЙ ПРОЕКТ", GRAPHITE, WHITE, size=26, angle=-3)
save(im, 7)

# 08 — Weekly rhythm
im, d = base(GRAPHITE, 8, True)
fitted(d, "ЛИЧНОЕ ПРОСТРАНСТВО + СЕМЕЙНАЯ ЛАБОРАТОРИЯ", (95, 115, 1600, 165), 64, 44, WHITE)
d.text((99, 285), "Реалистичный ритм. Пропуски не нужно догонять.", font=F(FONT_BOLD, 33), fill=LIME)
# calendar path
hand_line(d, [(180, 700), (620, 515), (1070, 675), (1580, 500), (1750, 640)], SKY, 14, 5, 75)
events = [
    (245, 670, CORAL, "20–30 МИН", "СЫН", "игра и быстрый результат"),
    (700, 500, PAPER, "45–75 МИН", "ДОЧЬ", "личный авторский проект"),
    (1180, 655, LIME, "45–90 МИН", "СЕМЬЯ", "общая лаборатория"),
    (1610, 500, CORAL, "5 МИН", "РЕФЛЕКСИЯ", "что хочется повторить"),
]
for x, y, c, time, who, desc in events:
    d.ellipse((x - 95, y - 95, x + 95, y + 95), fill=c, outline=WHITE, width=5)
    d.text((x, y - 12), time, font=F(FONT_BLACK, 25), fill=INK, anchor="mm")
    d.text((x, y + 32), who, font=F(FONT_BOLD, 21), fill=INK, anchor="mm")
    d.text((x, y + 145), desc, font=F(FONT_REG, 22), fill=WHITE, anchor="mm")
label(im, (120, 915), "60–100 МИНУТ В НЕДЕЛЮ", PAPER, size=29, angle=-1)
save(im, 8)

# 09 — One game, two levels
im, d = base(SKY, 9)
fitted(d, "ОДНА ТЕМА. РАЗНОЕ АВТОРСТВО.", (95, 105, 1450, 150), 70, 50, INK)
d.text((99, 255), "Игра: придумать невозможный продукт.", font=F(FONT_BOLD, 34), fill=WHITE)

def product7(pd, ox, oy, w, h):
    pd.text((ox + 35, oy + 30), "7 ЛЕТ", font=F(FONT_BLACK, 43), fill=INK)
    pd.text((ox + 35, oy + 92), "КАРМАННАЯ ПОГОДА", font=F(FONT_BOLD, 28), fill=CORAL)
    pd.rounded_rectangle((ox + 125, oy + 185, ox + 430, oy + 430), radius=80, fill=SKY, outline=INK, width=7)
    pd.ellipse((ox + 190, oy + 235, ox + 260, oy + 305), fill=LIME)
    for k in range(5):
        pd.line((ox + 225, oy + 210, ox + 225 + math.cos(k * 1.25) * 82, oy + 270 + math.sin(k * 1.25) * 82), fill=CORAL, width=8)
    pd.text((ox + 35, oy + h - 80), "рисует • рассказывает • играет", font=F(FONT_BOLD, 25), fill=INK)


def product14(pd, ox, oy, w, h):
    pd.text((ox + 35, oy + 30), "14 ЛЕТ", font=F(FONT_BLACK, 43), fill=WHITE)
    pd.text((ox + 35, oy + 92), "WEATHER / POCKET", font=F(FONT_BOLD, 28), fill=LIME)
    pd.rectangle((ox + 75, oy + 180, ox + 480, oy + 430), fill=PAPER)
    pd.text((ox + 110, oy + 220), "НОСИ\nПОГОДУ\nС СОБОЙ", font=F(FONT_BLACK, 39), fill=INK, spacing=-2)
    pd.ellipse((ox + 370, oy + 275, ox + 445, oy + 350), fill=CORAL)
    pd.text((ox + 35, oy + h - 80), "бренд • аудитория • видеоролик", font=F(FONT_BOLD, 25), fill=WHITE)

panel(im, (110, 375, 740, 560), SOFT_CORAL, -2, 42, True, product7)
panel(im, (1060, 365, 740, 570), GRAPHITE, 2, 42, True, product14)
label(im, (835, 775), "РАВНОЦЕННО", LIME, size=31, angle=-3)
save(im, 9)

# 10 — Return signal
im, d = base(PAPER, 10)
fitted(d, "ГЛАВНЫЙ СИГНАЛ — ХОЧЕТСЯ ВЕРНУТЬСЯ", (95, 110, 1550, 160), 68, 48, INK)
d.text((99, 265), "Не тест таланта. Карта живого интереса.", font=F(FONT_BOLD, 34), fill=CORAL)
trail = [
    (175, 610, CORAL, "ВЫБРАЛ", "сам"),
    (520, 760, LIME, "ВЕРНУЛСЯ", "без уговоров"),
    (870, 575, SKY, "ИЗМЕНИЛ", "вторую версию"),
    (1230, 760, SOFT_CORAL, "ПОПРОСИЛ", "новый материал"),
    (1605, 575, PAPER, "НАЧАЛ", "свой проект"),
]
hand_line(d, [(x, y) for x, y, *_ in trail], SKY, 14, 7, 32)
for x, y, color, title, sub in trail:
    d.ellipse((x - 78, y - 78, x + 78, y + 78), fill=color, outline=INK, width=5)
    star(d, (x, y), 42, 18, 6, INK)
    d.text((x, y + 125), title, font=F(FONT_BLACK, 26), fill=INK, anchor="mm")
    d.text((x, y + 164), sub, font=F(FONT_REG, 22), fill=MUTED, anchor="mm")
label(im, (120, 925), "НАБЛЮДАЕМ ФАКТЫ • НЕ СРАВНИВАЕМ ДЕТЕЙ", GRAPHITE, WHITE, size=27, angle=-1)
save(im, 10)

# 11 — Twelve weeks
im, d = base(GRAPHITE, 11, True)
fitted(d, "12 НЕДЕЛЬ, ЧТОБЫ УВИДЕТЬ СВОЮ ТРАЕКТОРИЮ", (95, 105, 1600, 155), 66, 46, WHITE)
d.text((99, 260), "Проба → ремикс → личный проект → выбор продолжения", font=F(FONT_BOLD, 31), fill=LIME)
weeks = [
    ("01", "СВОБОДА", CORAL), ("02", "ЦВЕТ", SKY), ("03", "ИСТОРИЯ", PAPER), ("04", "ЗВУК", LIME),
    ("05", "ТЕАТР", SOFT_CORAL), ("06", "ДИЗАЙН", SKY), ("07", "КИНО", PAPER), ("08", "РЕМИКС", CORAL),
    ("09", "ИДЕЯ", LIME), ("10", "ЗАМЫСЕЛ", SOFT_BLUE), ("11", "ВЕРСИЯ 2", CORAL), ("12", "ВЫБОР", PAPER),
]
for i, (num, title, color) in enumerate(weeks):
    col = i % 6
    row = i // 6
    x = 95 + col * 298
    y = 385 + row * 295
    d.rounded_rectangle((x, y, x + 260, y + 235), radius=32, fill=color)
    d.text((x + 28, y + 25), num, font=F(FONT_BLACK, 38), fill=INK)
    d.text((x + 28, y + 175), title, font=F(FONT_BOLD, 24 if len(title) < 9 else 21), fill=INK)
    if i % 4 == 0:
        star(d, (x + 185, y + 92), 48, 20, 6, INK)
    elif i % 4 == 1:
        hand_line(d, [(x + 120, y + 120), (x + 165, y + 65), (x + 215, y + 130)], CORAL if color != CORAL else WHITE, 8, 3, i)
    elif i % 4 == 2:
        d.text((x + 185, y + 95), "Aa", font=F(FONT_ITALIC, 54), fill=CORAL, anchor="mm")
    else:
        d.ellipse((x + 145, y + 55, x + 225, y + 135), outline=INK, width=8)
save(im, 11)

# 12 — CTA
im, d = base(PAPER, 12)
fitted(d, "БУДУЩЕЕ НАЧИНАЕТСЯ С ПЕРВОЙ ВЕРСИИ", (95, 130, 1450, 190), 76, 52, INK)
d.text((99, 340), "Дайте идее появиться.", font=F(FONT_BOLD, 42), fill=CORAL)
# living line starts as pencil stroke and becomes horizon
hand_line(d, [(140, 730), (300, 660), (455, 745), (630, 590), (820, 705), (1010, 540), (1230, 660), (1450, 500), (1765, 590)], SKY, 16, 7, 88)
d.polygon([(110, 760), (220, 705), (246, 750), (135, 805)], fill=CORAL, outline=INK)
d.polygon([(110, 760), (86, 792), (135, 805)], fill=PAPER, outline=INK)
for x, y, c, icon in [(455, 745, LIME, "Aa"), (820, 705, CORAL, "♪"), (1230, 660, PAPER, "{ }"), (1450, 500, LIME, "□")]:
    d.ellipse((x - 62, y - 62, x + 62, y + 62), fill=c, outline=INK, width=5)
    d.text((x, y), icon, font=F(FONT_BLACK, 31), fill=INK, anchor="mm")
d.rounded_rectangle((95, 875, 1825, 1015), radius=45, fill=GRAPHITE)
d.text((140, 920), "CREATEKIDS", font=F(FONT_BLACK, 28), fill=LIME)
d.text((140, 965), "Начать первую семейную неделю", font=F(FONT_BLACK, 39), fill=WHITE)
d.rounded_rectangle((1540, 905, 1765, 985), radius=40, fill=CORAL)
d.text((1652, 945), "НАЧАТЬ", font=F(FONT_BOLD, 27), fill=WHITE, anchor="mm")
save(im, 12)

# Contact sheet — 4 x 3
thumb_w, thumb_h = 480, 270
margin = 24
sheet = Image.new("RGB", (thumb_w * 4 + margin * 5, thumb_h * 3 + margin * 4), "#D9D9D9")
for i in range(1, 13):
    img = Image.open(OUT / f"createkids-slide-{i:02d}.png").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col = (i - 1) % 4
    row = (i - 1) // 4
    sheet.paste(img, (margin + col * (thumb_w + margin), margin + row * (thumb_h + margin)))
sheet.save(OUT / "createkids-presentation-contact-sheet.jpg", quality=94)

print(f"Created 12 slides and contact sheet in {OUT}")
