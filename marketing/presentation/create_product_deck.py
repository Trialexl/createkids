from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "product-slides-png"
OUT.mkdir(parents=True, exist_ok=True)
for old in OUT.glob("createkids-product-*.png"):
    old.unlink()
for old in OUT.glob("CreateKids-Презентация-проекта-preview.jpg"):
    old.unlink()

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
MUTED = "#737780"

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"

random.seed(84)


def font(path, size):
    return ImageFont.truetype(path, size)


def add_texture(im, strength=8, opacity=0.028):
    noise = Image.effect_noise(im.size, strength).convert("L")
    alpha = noise.point(lambda _: int(255 * opacity))
    grain = Image.merge("RGBA", (noise, noise, noise, alpha))
    return Image.alpha_composite(im.convert("RGBA"), grain)


def measure(draw, text, fnt):
    box = draw.textbbox((0, 0), text, font=fnt)
    return box[2] - box[0], box[3] - box[1]


def wrap(draw, text, fnt, width):
    lines = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        words = para.split()
        line = ""
        for word in words:
            candidate = word if not line else f"{line} {word}"
            if measure(draw, candidate, fnt)[0] <= width:
                line = candidate
            else:
                if line:
                    lines.append(line)
                line = word
        if line:
            lines.append(line)
    return lines


def fit_text(draw, text, box, max_size, min_size, fill, face=FONT_BLACK, spacing=8, anchor="la"):
    x, y, w, h = box
    for size in range(max_size, min_size - 1, -2):
        fnt = font(face, size)
        lines = wrap(draw, text, fnt, w)
        line_h = int(size * 1.13)
        total = len(lines) * line_h + max(0, len(lines) - 1) * spacing
        if total <= h:
            yy = y
            for line in lines:
                draw.text((x, yy), line, font=fnt, fill=fill, anchor=anchor)
                yy += line_h + spacing
            return yy
    raise RuntimeError(f"Text does not fit: {text}")


def base(bg, number, dark=False):
    im = add_texture(Image.new("RGBA", (W, H), bg), 9, 0.04 if dark else 0.025)
    d = ImageDraw.Draw(im)
    fg = WHITE if dark else INK
    d.text((92, 54), "CREATEKIDS", font=font(FONT_BLACK, 26), fill=fg)
    d.text((1828, 58), f"{number:02d}/14", font=font(FONT_BOLD, 22), fill=fg, anchor="ra")
    return im, d


def title(draw, text, color=INK, sub=None, sub_color=None, max_size=72):
    bottom = fit_text(draw, text, (95, 118, 1650, 185), max_size, 42, color)
    if sub:
        draw.text((99, bottom + 12), sub, font=font(FONT_BOLD, 31), fill=sub_color or color)


def card(draw, box, fill, heading, body="", heading_color=INK, body_color=INK, radius=34, outline=None):
    x, y, w, h = box
    draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=outline, width=4 if outline else 1)
    fit_text(draw, heading, (x + 28, y + 25, w - 56, 82), 31, 21, heading_color, FONT_BLACK, 4)
    if body:
        fit_text(draw, body, (x + 28, y + 118, w - 56, h - 142), 25, 18, body_color, FONT_REG, 7)


def pill(draw, xy, text, bg, fg=INK, size=24):
    x, y = xy
    fnt = font(FONT_BOLD, size)
    tw, th = measure(draw, text, fnt)
    draw.rounded_rectangle((x, y, x + tw + 38, y + th + 24), radius=24, fill=bg)
    draw.text((x + 19, y + 9), text, font=fnt, fill=fg)
    return x + tw + 38


def hand_line(draw, points, fill, width=10, seed=0):
    rng = random.Random(seed)
    pts = [(x + rng.randint(-4, 4), y + rng.randint(-4, 4)) for x, y in points]
    draw.line(pts, fill=fill, width=width, joint="curve")


def star(draw, center, r1, r2, points, fill, outline=None, width=4):
    cx, cy = center
    poly = []
    for i in range(points * 2):
        radius = r1 if i % 2 == 0 else r2
        angle = -math.pi / 2 + i * math.pi / points
        poly.append((cx + math.cos(angle) * radius, cy + math.sin(angle) * radius))
    draw.polygon(poly, fill=fill)
    if outline:
        draw.line(poly + [poly[0]], fill=outline, width=width, joint="curve")


def save(im, number):
    im.convert("RGB").save(OUT / f"createkids-product-{number:02d}.png", quality=96)


# 01 — Cover: founder story
im, d = base(GRAPHITE, 1, True)
fit_text(d, "ПОЧЕМУ МЫ СДЕЛАЛИ\nCREATEKIDS", (94, 155, 1160, 265), 82, 58, WHITE)
fit_text(d, "История двух родителей, двух очень разных детей и одного вопроса о будущем", (98, 485, 1120, 180), 39, 29, LIME, FONT_BOLD, 8)
d.text((100, 900), "Не продуктовый питч. Наша семейная история.", font=font(FONT_BOLD, 28), fill="#D7D9DF")
# Two distinct creative paths from one home.
d.rounded_rectangle((1400, 400, 1580, 610), radius=30, fill=PAPER, outline=WHITE, width=5)
d.polygon([(1370, 410), (1490, 305), (1610, 410)], fill=CORAL, outline=WHITE)
d.rectangle((1460, 515, 1520, 610), fill=SKY)
hand_line(d, [(1490, 650), (1370, 760), (1230, 725), (1120, 835)], CORAL, 12, 1)
hand_line(d, [(1490, 650), (1620, 745), (1745, 690), (1820, 830)], LIME, 12, 2)
for x, y, c, mark in [(1120, 835, CORAL, "7"), (1820, 830, LIME, "14")]:
    d.ellipse((x - 72, y - 72, x + 72, y + 72), fill=c, outline=WHITE, width=5)
    d.text((x, y), mark, font=font(FONT_BLACK, 45), fill=INK, anchor="mm")
save(im, 1)

# 02 — Section: where the idea came from
im, d = base(CORAL, 2)
d.text((98, 160), "ЧАСТЬ 1", font=font(FONT_BLACK, 28), fill=INK)
fit_text(d, "ОТКУДА\nПОЯВИЛАСЬ ИДЕЯ", (95, 250, 1320, 290), 92, 66, WHITE)
d.rounded_rectangle((100, 695, 1640, 895), radius=45, fill=PAPER)
fit_text(d, "Всё началось не с идеи создать приложение. Всё началось с размышлений о будущем наших детей.", (150, 742, 1510, 125), 36, 27, INK, FONT_BOLD, 6)
star(d, (1635, 315), 125, 52, 9, LIME, INK, 5)
d.text((1635, 315), "?", font=font(FONT_BLACK, 76), fill=INK, anchor="mm")
save(im, 2)

# 03 — Two children
im, d = base(PAPER, 3)
title(d, "МЫ — РОДИТЕЛИ ДВОИХ ДЕТЕЙ", INK, "И они очень разные.", CORAL)
card(d, (110, 400, 690, 450), SOFT_CORAL, "СЫНУ 7 ЛЕТ", "Ему важны игра, движение, материал в руках и быстрый результат, который можно сразу показать или разыграть.")
card(d, (1120, 400, 690, 450), GRAPHITE, "ДОЧЕРИ 14 ЛЕТ", "Ей важны самостоятельность, собственный стиль, уважение к личному пространству и проекты без ощущения «детской поделки».", WHITE, WHITE)
d.ellipse((835, 515, 1085, 765), fill=SKY, outline=INK, width=6)
d.text((960, 612), "≠", font=font(FONT_BLACK, 76), fill=INK, anchor="mm")
d.text((960, 705), "разные пути", font=font(FONT_BOLD, 23), fill=INK, anchor="mm")
d.text((960, 955), "Одно занятие редко подходит им одинаково.", font=font(FONT_BLACK, 33), fill=INK, anchor="mm")
save(im, 3)

# 04 — Bet on creativity, not one skill
im, d = base(SKY, 4)
title(d, "МЫ РЕШИЛИ СДЕЛАТЬ СТАВКУ НА ТВОРЧЕСТВО", INK, "Но не на один конкретный навык.", WHITE, 62)
labels = [
    (170, 510, "РИСОВАНИЕ", CORAL), (505, 410, "МУЗЫКА", PAPER),
    (855, 520, "ИСТОРИИ", LIME), (1215, 405, "КИНО", SOFT_CORAL),
    (1530, 535, "КОД", GRAPHITE), (480, 760, "ТЕАТР", GRAPHITE),
    (1270, 755, "ДИЗАЙН", PAPER),
]
for x, y, txt, c in labels:
    fg = WHITE if c == GRAPHITE else INK
    pill(d, (x, y), txt, c, fg, 25)
for x, y, *_ in labels:
    hand_line(d, [(x + 120, y + 55), (960, 790)], "#B7D7E7", 5, x)
d.ellipse((735, 625, 1185, 955), fill=WHITE, outline=INK, width=6)
d.text((960, 735), "СПОСОБНОСТЬ", font=font(FONT_BOLD, 25), fill=CORAL, anchor="mm")
d.text((960, 815), "СОЗДАВАТЬ", font=font(FONT_BLACK, 49), fill=INK, anchor="mm")
d.text((960, 888), "в разных формах", font=font(FONT_REG, 25), fill=MUTED, anchor="mm")
save(im, 4)

# 05 — AI context
im, d = base(GRAPHITE, 5, True)
title(d, "МИР ГОТОВЫХ ОТВЕТОВ МЕНЯЕТ РОДИТЕЛЬСКИЙ ВОПРОС", WHITE, "ИИ уже быстро создаёт типовой контент.", LIME, 56)
answers = [("ТЕКСТ", CORAL), ("ИЗОБРАЖЕНИЕ", SKY), ("МУЗЫКА", LIME), ("КОД", PAPER)]
for i, (txt, c) in enumerate(answers):
    x = 110 + i * 405
    d.rounded_rectangle((x, 420, x + 350, 570), radius=35, fill=c)
    d.text((x + 175, 495), txt, font=font(FONT_BLACK, 27), fill=INK, anchor="mm")
hand_line(d, [(180, 690), (520, 635), (820, 730), (1125, 650), (1500, 735), (1780, 665)], SKY, 10, 27)
questions = ["поставить вопрос", "соединить идеи", "увидеть возможность", "выбрать направление", "довести до результата"]
for i, txt in enumerate(questions):
    x = 115 + i * 345
    y = 790 + (25 if i % 2 else -25)
    d.ellipse((x, y, x + 34, y + 34), fill=CORAL)
    fit_text(d, txt, (x + 52, y - 8, 260, 90), 23, 18, WHITE, FONT_BOLD, 4)
d.text((100, 990), "Нам стало важно не только то, что ребёнок знает, но и то, что он решает создать.", font=font(FONT_BLACK, 28), fill=LIME)
save(im, 5)

# 06 — Unknown professions
im, d = base(PAPER, 6)
title(d, "МЫ НЕ ЗНАЕМ, КЕМ БУДУТ РАБОТАТЬ НАШИ ДЕТИ", INK, "Честно предсказать профессии через 10–15 лет невозможно.", CORAL, 60)
# Dissolving signposts.
for i, (y, txt, c) in enumerate([(420, "ОДНА ПРОФЕССИЯ?", SOFT_CORAL), (575, "ОДИН НАВЫК?", SOFT_BLUE), (730, "ОДИН ПРАВИЛЬНЫЙ ПУТЬ?", SOFT_LIME)]):
    d.polygon([(110, y), (670, y), (745, y + 55), (670, y + 110), (110, y + 110)], fill=c, outline=INK)
    d.text((160, y + 55), txt, font=font(FONT_BLACK, 26), fill=INK, anchor="lm")
    for k in range(6):
        d.ellipse((760 + k * 35, y + 38 + (k % 2) * 18, 775 + k * 35, y + 53 + (k % 2) * 18), fill="#C4C5C8")
d.rounded_rectangle((1120, 405, 1800, 875), radius=48, fill=GRAPHITE)
d.text((1170, 460), "НАША СТАВКА", font=font(FONT_BLACK, 28), fill=LIME)
fit_text(d, "САМОСТОЯТЕЛЬНО\nМЫСЛИТЬ\nИ СОЗДАВАТЬ", (1170, 560, 550, 250), 52, 39, WHITE, FONT_BLACK, 9)
d.text((1170, 820), "в разных сценариях будущего", font=font(FONT_REG, 24), fill="#D3D5DB")
save(im, 6)

# 07 — Section: why it matters
im, d = base(LIME, 7)
d.text((98, 160), "ЧАСТЬ 2", font=font(FONT_BLACK, 28), fill=INK)
fit_text(d, "ПОЧЕМУ ЭТА ИДЕЯ\nСТОИТ ТОГО", (95, 250, 1350, 290), 88, 62, INK)
d.rounded_rectangle((100, 695, 1660, 895), radius=45, fill=GRAPHITE)
fit_text(d, "Мы поняли: этот вопрос волнует не только нашу семью.", (150, 748, 1510, 110), 43, 31, WHITE, FONT_BOLD, 6)
for cx, cy, c in [(1555, 265, CORAL), (1695, 390, SKY), (1480, 490, PAPER)]:
    d.ellipse((cx - 68, cy - 68, cx + 68, cy + 68), fill=c, outline=INK, width=5)
    d.text((cx, cy), "?", font=font(FONT_BLACK, 43), fill=INK, anchor="mm")
save(im, 7)

# 08 — Shared anxiety
im, d = base(SOFT_BLUE, 8)
title(d, "МНОГИЕ РОДИТЕЛИ ЧУВСТВУЮТ ТУ ЖЕ ТРЕВОГУ", INK, "Одних знаний и действий по инструкции может быть недостаточно.", CORAL, 58)
card(d, (105, 420, 520, 410), WHITE, "МЫ ВИДИМ", "Мир меняется быстрее школьных программ. ИИ берёт на себя всё больше готовых операций.")
card(d, (700, 420, 520, 410), SOFT_CORAL, "МЫ ПОНИМАЕМ", "Самостоятельность, воображение и авторский выбор становятся особенно важны.")
card(d, (1295, 420, 520, 410), GRAPHITE, "НО НЕ ЗНАЕМ", "Как системно развивать способность создавать дома — регулярно и без давления.", WHITE, WHITE)
for x in [640, 1235]:
    d.polygon([(x, 590), (x + 38, 615), (x, 640)], fill=INK)
d.rounded_rectangle((255, 900, 1665, 995), radius=36, fill=SKY)
d.text((960, 948), "Тревоге нужен не лозунг, а понятное действие.", font=font(FONT_BLACK, 31), fill=INK, anchor="mm")
save(im, 8)

# 09 — Four practical problems
im, d = base(GRAPHITE, 9, True)
title(d, "НА ПРАКТИКЕ РОДИТЕЛЬ УПИРАЕТСЯ В ЧЕТЫРЕ ПРОБЛЕМЫ", WHITE, "И каждая мешает начать.", LIME, 59)
problems = [
    ("ЧТО ПРОБОВАТЬ?", "Направлений много, а ребёнку пока не из чего выбирать.", CORAL),
    ("КАК СОВМЕСТИТЬ ВОЗРАСТЫ?", "Одно задание не подходит младшему и подростку одинаково.", PAPER),
    ("КАК ЗАНИМАТЬСЯ РЕГУЛЯРНО?", "Подготовка материалов и сценария снова ложится на родителя.", SKY),
    ("КАК НЕ СДЕЛАТЬ ЕЩЁ ОДНУ ШКОЛУ?", "Оценки, образцы и правильные ответы убивают желание пробовать.", LIME),
]
for i, (h, b, c) in enumerate(problems):
    x = 100 + (i % 2) * 880
    y = 405 + (i // 2) * 270
    card(d, (x, y, 790, 225), c, h, b)
d.text((960, 985), "Нам нужна была не теория творчества, а семейная практика.", font=font(FONT_BLACK, 29), fill=WHITE, anchor="mm")
save(im, 9)

# 10 — CreateKids emerges
im, d = base(PAPER, 10)
title(d, "ТАК ПОЯВИЛАСЬ ИДЕЯ CREATEKIDS", INK, "Большую тревогу — превратить в понятную семейную практику.", CORAL, 64)
# Equation from concern to weekly action.
card(d, (105, 420, 600, 360), SOFT_CORAL, "БОЛЬШОЙ ВОПРОС", "Как подготовить ребёнка к будущему, которого мы сами не можем предсказать?")
d.ellipse((790, 520, 990, 720), fill=SKY, outline=INK, width=6)
d.text((890, 620), "→", font=font(FONT_BLACK, 72), fill=INK, anchor="mm")
card(d, (1075, 420, 735, 360), SOFT_LIME, "ПОНЯТНОЕ ДЕЙСТВИЕ", "Каждую неделю пробовать новый способ создавать — отдельно и вместе.")
d.rounded_rectangle((260, 875, 1660, 985), radius=38, fill=GRAPHITE)
d.text((960, 930), "Сначала были семейный вопрос и метод. Приложение появилось потом.", font=font(FONT_BLACK, 28), fill=WHITE, anchor="mm")
save(im, 10)

# 11 — Weekly rhythm
im, d = base(SKY, 11)
title(d, "ОДНА НЕДЕЛЯ — ЧЕТЫРЕ ПОНЯТНЫХ ШАГА", INK, "Одна тема, разные роли и никакого сравнения.", WHITE)
week = [
    ("1", "МЛАДШЕМУ", "Короткая игра\nи быстрый результат", CORAL),
    ("2", "ПОДРОСТКУ", "Самостоятельный\nавторский проект", GRAPHITE),
    ("3", "СЕМЬЕ", "Общая игра\nили лаборатория", LIME),
    ("4", "ПОСЛЕ", "Сохранить процесс\nи задать 2–3 вопроса", PAPER),
]
for i, (num, h, b, c) in enumerate(week):
    x = 95 + i * 455
    fg = WHITE if c == GRAPHITE else INK
    d.ellipse((x + 110, 390, x + 260, 540), fill=c, outline=WHITE, width=5)
    d.text((x + 185, 465), num, font=font(FONT_BLACK, 46), fill=fg, anchor="mm")
    d.text((x + 185, 590), h, font=font(FONT_BLACK, 27), fill=INK, anchor="mm")
    fit_text(d, b, (x + 20, 650, 335, 130), 25, 19, INK, FONT_REG, 7)
    if i < 3:
        hand_line(d, [(x + 285, 465), (x + 390, 430), (x + 445, 470)], WHITE, 8, i + 20)
pill(d, (120, 905), "РИСУНОК", CORAL, INK, 22)
pill(d, (360, 905), "ИСТОРИИ", PAPER, INK, 22)
pill(d, (600, 905), "МУЗЫКА", LIME, INK, 22)
pill(d, (835, 905), "КОНСТРУКЦИИ", SOFT_CORAL, INK, 22)
pill(d, (1190, 905), "КИНО", GRAPHITE, WHITE, 22)
pill(d, (1385, 905), "DIGITAL", PAPER, INK, 22)
pill(d, (1605, 905), "ДИЗАЙН", LIME, INK, 22)
save(im, 11)

# 12 — Interest map after 12 weeks
im, d = base(PAPER, 12)
title(d, "ЧЕРЕЗ 12 НЕДЕЛЬ — НЕ ПАЧКА ОДИНАКОВЫХ ПОДЕЛОК", INK, "А карта живого интереса каждого ребёнка.", CORAL, 57)
trail = [
    (170, 610, CORAL, "ВЫБРАЛ", "сам"),
    (500, 760, LIME, "ЗАДЕРЖАЛСЯ", "дольше"),
    (845, 580, SKY, "ВЕРНУЛСЯ", "без уговоров"),
    (1190, 760, SOFT_CORAL, "УЛУЧШИЛ", "после неудачи"),
    (1540, 580, PAPER, "ПОДЕЛИЛСЯ", "с другими"),
]
hand_line(d, [(x, y) for x, y, *_ in trail], SKY, 14, 33)
for x, y, c, h, b in trail:
    d.ellipse((x - 72, y - 72, x + 72, y + 72), fill=c, outline=INK, width=5)
    star(d, (x, y), 38, 16, 6, INK)
    d.text((x, y + 118), h, font=font(FONT_BLACK, 24), fill=INK, anchor="mm")
    d.text((x, y + 158), b, font=font(FONT_REG, 21), fill=MUTED, anchor="mm")
d.rounded_rectangle((150, 925, 1770, 1015), radius=35, fill=GRAPHITE)
d.text((960, 970), "Мы не измеряем талант. Мы наблюдаем интерес в действии.", font=font(FONT_BLACK, 29), fill=WHITE, anchor="mm")
save(im, 12)

# 13 — What we really want to give
im, d = base(SOFT_BLUE, 13)
title(d, "ЧТО МЫ НА САМОМ ДЕЛЕ ХОТИМ ДАТЬ СЕМЬЕ", INK, "Не обещание угадать будущее — а способ действовать уже сейчас.", CORAL, 58)
not_items = ["НЕ УРОКИ РИСОВАНИЯ", "НЕ ЕЩЁ ОДИН ЭКРАН", "НЕ ТЕСТ НА ПРОФЕССИЮ"]
for i, txt in enumerate(not_items):
    x = 105 + i * 590
    d.rounded_rectangle((x, 400, x + 525, 520), radius=32, fill=WHITE, outline=CORAL, width=5)
    d.text((x + 262, 460), txt, font=font(FONT_BLACK, 23), fill=MUTED, anchor="mm")
d.rounded_rectangle((105, 610, 1810, 905), radius=52, fill=GRAPHITE)
d.text((160, 665), "БЕЗОПАСНОЕ МЕСТО, ГДЕ МОЖНО", font=font(FONT_BLACK, 26), fill=LIME)
verbs = [("ПРОБОВАТЬ", CORAL), ("БРОСАТЬ", PAPER), ("ПЕРЕДЕЛЫВАТЬ", SKY), ("ОШИБАТЬСЯ", LIME), ("НАХОДИТЬ СВОЁ", SOFT_CORAL)]
x = 160
y = 755
for txt, c in verbs:
    nx = pill(d, (x, y), txt, c, INK, 24)
    x = nx + 22
    if x > 1630:
        x = 160
        y += 78
d.text((960, 985), "Родителю — понятный путь. Ребёнку — право оставаться автором.", font=font(FONT_BLACK, 28), fill=INK, anchor="mm")
save(im, 13)

# 14 — Manifesto
im, d = base(GRAPHITE, 14, True)
fit_text(d, "МЫ НЕ ХОТИМ РЕШАТЬ ЗА ДЕТЕЙ,\nВ ЧЁМ ИХ ТАЛАНТ.", (95, 150, 1470, 245), 70, 49, WHITE)
fit_text(d, "МЫ ХОТИМ СОЗДАТЬ УСЛОВИЯ,\nВ КОТОРЫХ ОНИ СМОГУТ ЭТО ОБНАРУЖИТЬ.", (95, 455, 1580, 220), 55, 40, LIME)
d.rounded_rectangle((100, 780, 1815, 945), radius=45, fill=PAPER)
d.text((145, 825), "CREATEKIDS", font=font(FONT_BLACK, 27), fill=CORAL)
d.text((145, 885), "Будущее нельзя предсказать. Способность создавать можно развивать.", font=font(FONT_BLACK, 31), fill=INK)
# Two diverging paths.
hand_line(d, [(1640, 260), (1530, 350), (1600, 455), (1490, 570)], CORAL, 12, 51)
hand_line(d, [(1640, 260), (1750, 360), (1690, 480), (1810, 590)], SKY, 12, 52)
for x, y, c in [(1490, 570, CORAL), (1810, 590, SKY)]:
    star(d, (x, y), 72, 31, 7, c, WHITE, 4)
save(im, 14)

# Contact sheet — 5 columns, 3 rows.
thumb_w, thumb_h = 384, 216
margin = 22
sheet = Image.new("RGB", (thumb_w * 5 + margin * 6, thumb_h * 3 + margin * 4), "#D7D8DB")
for i in range(1, 15):
    image = Image.open(OUT / f"createkids-product-{i:02d}.png").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col, row = (i - 1) % 5, (i - 1) // 5
    sheet.paste(image, (margin + col * (thumb_w + margin), margin + row * (thumb_h + margin)))
sheet.save(OUT / "CreateKids-Презентация-проекта-preview.jpg", quality=94)

# Exact-image PDF.
pdf_path = ROOT / "CreateKids-Презентация-проекта.pdf"
if pdf_path.exists():
    pdf_path.unlink()
pdf = fitz.open()
page_w, page_h = 13.333 * 72, 7.5 * 72
for i in range(1, 15):
    image_path = OUT / f"createkids-product-{i:02d}.png"
    page = pdf.new_page(width=page_w, height=page_h)
    page.insert_image(page.rect, filename=str(image_path))
pdf.save(pdf_path, deflate=True)

print(f"Created 14 founder-story slides, preview and PDF in {ROOT}")
