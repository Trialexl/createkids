from pathlib import Path
import math
import random

from PIL import Image, ImageDraw, ImageFont
import fitz

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "product-slides-png"
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
MUTED = "#737780"

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_ITALIC = "/System/Library/Fonts/Supplemental/Georgia Italic.ttf"

random.seed(42)


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
            test = word if not line else f"{line} {word}"
            if measure(draw, test, fnt)[0] <= width:
                line = test
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
        line_h = int(size * 1.12)
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
    d.text((1828, 58), f"{number:02d}/15", font=font(FONT_BOLD, 22), fill=fg, anchor="ra")
    return im, d


def title(draw, text, color=INK, sub=None, sub_color=None, max_size=72):
    bottom = fit_text(draw, text, (95, 118, 1640, 185), max_size, 44, color)
    if sub:
        draw.text((99, bottom + 12), sub, font=font(FONT_BOLD, 31), fill=sub_color or color)


def card(draw, box, fill, heading, body="", heading_color=INK, body_color=INK, radius=34, outline=None):
    x, y, w, h = box
    draw.rounded_rectangle((x, y, x + w, y + h), radius=radius, fill=fill, outline=outline, width=4 if outline else 1)
    fit_text(draw, heading, (x + 28, y + 24, w - 56, 80), 31, 22, heading_color, FONT_BLACK, 4)
    if body:
        fit_text(draw, body, (x + 28, y + 116, w - 56, h - 138), 25, 18, body_color, FONT_REG, 7)


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


# 01 — Cover
im, d = base(GRAPHITE, 1, True)
fit_text(d, "БУДУЩЕЕ НЕЛЬЗЯ\nПРЕДСКАЗАТЬ.", (94, 145, 1040, 260), 80, 58, WHITE)
fit_text(d, "СПОСОБНОСТЬ СОЗДАВАТЬ\nМОЖНО РАЗВИВАТЬ.", (94, 430, 1220, 230), 65, 48, LIME)
d.text((100, 735), "CreateKids — семейное приложение для детей 6–15 лет", font=font(FONT_BOLD, 30), fill="#DADCE2")
d.text((100, 792), "12 недель творческих экспериментов • без оценок • с реальными проектами", font=font(FONT_REG, 25), fill="#B9BCC4")
for cx, cy, color, label in [(1450, 265, CORAL, "?"), (1645, 495, SKY, "+") , (1380, 720, LIME, "→")]:
    d.ellipse((cx - 105, cy - 105, cx + 105, cy + 105), fill=color, outline=WHITE, width=5)
    d.text((cx, cy - 6), label, font=font(FONT_BLACK, 70), fill=INK, anchor="mm")
hand_line(d, [(1280, 890), (1430, 790), (1510, 850), (1640, 735), (1790, 800)], WHITE, 9, 1)
d.text((100, 965), "Идея проекта • продукт • модель запуска", font=font(FONT_BOLD, 24), fill=CORAL)
save(im, 1)

# 02 — Origin
im, d = base(PAPER, 2)
title(d, "МЫ ИСКАЛИ ЭТО ДЛЯ СВОЕЙ СЕМЬИ", CORAL, "И готового маршрута не нашли.", INK)
card(d, (110, 405, 470, 410), SOFT_CORAL, "СЫН • 7 ЛЕТ", "Короткие игры, движение, материал в руках и быстрый видимый результат.")
card(d, (675, 385, 570, 450), GRAPHITE, "ОБЩИЙ ВОПРОС", "Как помочь детям попробовать разное, не выбрать за них талант и не превратить творчество в ещё одну школу?", WHITE, WHITE)
card(d, (1340, 405, 470, 410), SOFT_BLUE, "ДОЧЬ • 14 ЛЕТ", "Собственный стиль, приватность, реальные культурные формы и личный проект.")
d.text((960, 936), "Так появилась семейная лаборатория CreateKids", font=font(FONT_BLACK, 34), fill=INK, anchor="mm")
hand_line(d, [(310, 850), (650, 920), (960, 870), (1270, 920), (1600, 850)], SKY, 9, 2)
save(im, 2)

# 03 — AI era
im, d = base(SKY, 3)
title(d, "ИИ УЖЕ ДАЁТ ГОТОВЫЕ ОТВЕТЫ", INK, "Тем важнее научиться выбирать, зачем и что создавать.", WHITE)
items = [("НАПИСАТЬ", "текст"), ("НАРИСОВАТЬ", "образ"), ("СОЧИНИТЬ", "музыку"), ("СОБРАТЬ", "код")]
for i, (a, b) in enumerate(items):
    y = 430 + i * 125
    d.rounded_rectangle((105, y, 690, y + 88), radius=28, fill=PAPER if i % 2 == 0 else SOFT_CORAL)
    d.text((142, y + 44), a, font=font(FONT_BLACK, 27), fill=INK, anchor="lm")
    d.text((650, y + 44), b, font=font(FONT_REG, 25), fill=MUTED, anchor="rm")
d.rounded_rectangle((900, 390, 1810, 920), radius=52, fill=GRAPHITE)
d.text((960, 450), "РОЛЬ РЕБЁНКА", font=font(FONT_BLACK, 27), fill=LIME)
fit_text(d, "ЗАДАТЬ НАПРАВЛЕНИЕ\nПРИДУМАТЬ ВАРИАНТЫ\nСДЕЛАТЬ ВЫБОР\nПРОВЕРИТЬ И УЛУЧШИТЬ", (960, 520, 760, 300), 47, 35, WHITE, FONT_BLACK, 12)
d.text((960, 850), "ИИ — инструмент. Ребёнок — автор.", font=font(FONT_BOLD, 29), fill=CORAL)
save(im, 3)

# 04 — Parent pains
im, d = base(GRAPHITE, 4, True)
title(d, "РОДИТЕЛЬ ПОНИМАЕТ ЗАДАЧУ. НО НЕ ЗНАЕТ, С ЧЕГО НАЧАТЬ", WHITE, "Большая тревога превращается в четыре практические проблемы.", LIME, 62)
problems = [
    ("КРУЖКИ ВСЛЕПУЮ", "Ребёнок ещё не пробовал достаточно, чтобы осознанно выбрать."),
    ("РАЗНЫЙ ВОЗРАСТ", "Одно занятие слишком детское для подростка или сложное для младшего."),
    ("СЛОЖНАЯ ПОДГОТОВКА", "Материалы, сценарий и время приходится придумывать взрослому."),
    ("ЕЩЁ ОДНА ШКОЛА", "Образец, оценка и сравнение быстро убивают собственный интерес."),
]
for i, (h, b) in enumerate(problems):
    x = 100 + (i % 2) * 880
    y = 420 + (i // 2) * 275
    card(d, (x, y, 790, 225), CORAL if i == 0 else (PAPER if i == 1 else SKY if i == 2 else LIME), h, b)
d.text((100, 990), "CreateKids даёт маршрут — но оставляет ребёнку выбор.", font=font(FONT_BLACK, 30), fill=WHITE)
save(im, 4)

# 05 — Promise
im, d = base(PAPER, 5)
title(d, "НЕ ТЕСТ НА ТАЛАНТ. 12 НЕДЕЛЬ НАБЛЮДЕНИЙ", INK, "Сначала опыт — потом осознанный следующий шаг.", CORAL)
steps = [
    ("01", "ПРОБОВАТЬ", "8 способов создавать", CORAL),
    ("02", "ЗАМЕЧАТЬ", "что выбирает сам", SKY),
    ("03", "ВОЗВРАЩАТЬСЯ", "без уговоров", LIME),
    ("04", "УГЛУБЛЯТЬ", "то, где живёт интерес", GRAPHITE),
]
for i, (num, h, b, c) in enumerate(steps):
    x = 100 + i * 450
    fg = WHITE if c == GRAPHITE else INK
    d.rounded_rectangle((x, 430, x + 390, 735), radius=42, fill=c)
    d.text((x + 35, 470), num, font=font(FONT_BLACK, 42), fill=fg)
    d.text((x + 35, 575), h, font=font(FONT_BLACK, 27), fill=fg)
    fit_text(d, b, (x + 35, 630, 320, 85), 25, 19, fg, FONT_REG)
    if i < 3:
        d.polygon([(x + 404, 565), (x + 438, 585), (x + 404, 605)], fill=INK)
d.rounded_rectangle((100, 830, 1760, 970), radius=38, fill=SOFT_BLUE)
d.text((140, 874), "РЕЗУЛЬТАТ", font=font(FONT_BLACK, 24), fill=CORAL)
d.text((140, 925), "Карта интересов ребёнка вместо догадок о его способностях", font=font(FONT_BLACK, 34), fill=INK)
save(im, 5)

# 06 — Weekly product
im, d = base(SKY, 6)
title(d, "КАЖДУЮ НЕДЕЛЮ ПРИЛОЖЕНИЕ УЖЕ ВСЁ ПОДГОТОВИЛО", INK, "Одна тема. Разные роли. Один семейный ритм.", WHITE, 60)
week = [
    ("1", "МЛАДШЕМУ", "Короткая игра\n20–30 минут", CORAL),
    ("2", "ПОДРОСТКУ", "Самостоятельный проект\n45–75 минут", GRAPHITE),
    ("3", "СЕМЬЕ", "Общая лаборатория\n45–90 минут", LIME),
    ("4", "ПОСЛЕ", "Фото + 3 вопроса\n5 минут", PAPER),
]
for i, (num, h, b, c) in enumerate(week):
    x = 95 + i * 455
    fg = WHITE if c == GRAPHITE else INK
    d.ellipse((x + 110, 390, x + 260, 540), fill=c, outline=WHITE, width=5)
    d.text((x + 185, 465), num, font=font(FONT_BLACK, 46), fill=fg, anchor="mm")
    d.text((x + 185, 590), h, font=font(FONT_BLACK, 27), fill=INK, anchor="mm")
    fit_text(d, b, (x + 25, 645, 320, 145), 26, 20, INK, FONT_REG, 7)
    if i < 3:
        hand_line(d, [(x + 285, 465), (x + 390, 430), (x + 445, 470)], WHITE, 8, i + 10)
pill(d, (105, 905), "ПОДГОТОВКА ДО 15 МИНУТ", GRAPHITE, WHITE, 26)
pill(d, (640, 905), "КНОПКА «СДЕЛАТЬ ПРОЩЕ»", SOFT_CORAL, INK, 26)
pill(d, (1260, 905), "ПРОПУСКИ НЕ ДОГОНЯЕМ", LIME, INK, 26)
save(im, 6)

# 07 — Screen as guide
im, d = base(GRAPHITE, 7, True)
title(d, "ЭКРАН ВЕДЁТ. ТВОРЧЕСТВО ПРОИСХОДИТ В ЖИЗНИ", WHITE, "Приложение не удерживает ребёнка — оно помогает начать.", LIME, 62)
phases = [
    (150, "ВЫБРАТЬ", "2–5 минут", "задание • материалы • роль", CORAL),
    (710, "УБРАТЬ ТЕЛЕФОН", "40–90 минут", "бумага • картон • звук • движение", SKY),
    (1270, "СОХРАНИТЬ", "5 минут", "фото • настроение • идея версии 2", LIME),
]
for i, (x, h, tm, body, c) in enumerate(phases):
    d.rounded_rectangle((x, 430, x + 500, 790), radius=48, fill=c)
    d.text((x + 35, 475), f"0{i+1}", font=font(FONT_BLACK, 38), fill=INK)
    d.text((x + 35, 565), h, font=font(FONT_BLACK, 29), fill=INK)
    d.text((x + 35, 625), tm, font=font(FONT_BOLD, 27), fill=INK)
    fit_text(d, body, (x + 35, 690, 420, 80), 23, 18, INK, FONT_REG)
    if i < 2:
        d.polygon([(x + 515, 585), (x + 550, 610), (x + 515, 635)], fill=WHITE)
d.text((960, 925), "Не ещё один экран. Стартовая площадка для реального проекта.", font=font(FONT_BLACK, 31), fill=WHITE, anchor="mm")
save(im, 7)

# 08 — Eight directions
im, d = base(PAPER, 8)
title(d, "8 СПОСОБОВ СОЗДАВАТЬ", INK, "Ребёнок выбирает не из слов, а из собственного опыта.", CORAL)
directions = [
    ("РИСУНОК", "линия → образ", CORAL), ("ИСТОРИИ", "слово → мир", SOFT_BLUE),
    ("МУЗЫКА", "ритм → настроение", LIME), ("КОНСТРУИРОВАНИЕ", "материал → прототип", SOFT_CORAL),
    ("ТЕАТР", "жест → персонаж", SOFT_CORAL), ("КИНО", "кадр → сюжет", GRAPHITE),
    ("DIGITAL", "правило → игра", SKY), ("ДИЗАЙН", "нужда → решение", LIME),
]
for i, (h, b, c) in enumerate(directions):
    col, row = i % 4, i // 4
    x, y = 95 + col * 450, 390 + row * 270
    fg = WHITE if c == GRAPHITE else INK
    d.rounded_rectangle((x, y, x + 405, y + 225), radius=34, fill=c)
    d.text((x + 26, y + 28), f"0{i+1}", font=font(FONT_BLACK, 25), fill=fg)
    fit_text(d, h, (x + 26, y + 83, 350, 65), 27, 20, fg, FONT_BLACK, 3)
    d.text((x + 26, y + 184), b, font=font(FONT_REG, 21), fill=fg)
d.text((100, 1005), "Не один «правильный» талант. Несколько возможных траекторий.", font=font(FONT_BLACK, 29), fill=INK)
save(im, 8)

# 09 — Ages
im, d = base(SKY, 9)
title(d, "РАЗНЫЕ ВОЗРАСТЫ. РАВНОЕ АВТОРСТВО", INK, "Старший не учитель. Младший не исполнитель.", WHITE)
card(d, (110, 400, 720, 465), SOFT_CORAL, "7 ЛЕТ • ПРОБА", "Короткая материальная задача. Быстрый результат. Можно рассказать, разыграть и переделать.")
card(d, (1090, 400, 720, 465), GRAPHITE, "14 ЛЕТ • ПОЗИЦИЯ", "Реальная форма: постер, трек, видео, цифровой проект. Собственный стиль и приватное пространство.", WHITE, WHITE)
d.ellipse((845, 515, 1075, 745), fill=LIME, outline=INK, width=6)
d.text((960, 610), "+", font=font(FONT_BLACK, 72), fill=INK, anchor="mm")
d.text((960, 690), "ОБЩИЙ\nПРОЕКТ", font=font(FONT_BLACK, 24), fill=INK, anchor="mm", spacing=3)
d.text((960, 940), "Вместе — не значит одинаково", font=font(FONT_BLACK, 34), fill=INK, anchor="mm")
save(im, 9)

# 10 — Creative cycle
im, d = base(GRAPHITE, 10, True)
title(d, "ТВОРЧЕСТВО — ЭТО ЦИКЛ, А НЕ ОЗАРЕНИЕ", WHITE, "Посмотреть. Выбрать приём. Изменить по-своему. Назвать источник.", LIME, 62)
cycle = [
    ("01", "ЗАМЕТИТЬ", CORAL), ("02", "СОБРАТЬ", PAPER), ("03", "ПРИДУМАТЬ", SKY),
    ("04", "ВЫБРАТЬ", LIME), ("05", "СДЕЛАТЬ", CORAL), ("06", "ИЗМЕНИТЬ", PAPER),
    ("07", "ПОКАЗАТЬ", SKY),
]
points = []
for i in range(7):
    x = 150 + i * 260
    y = 620 + (80 if i % 2 else -70)
    points.append((x, y))
hand_line(d, points, "#A9ADB7", 12, 28)
for (x, y), (num, h, c) in zip(points, cycle):
    d.ellipse((x - 78, y - 78, x + 78, y + 78), fill=c, outline=WHITE, width=4)
    d.text((x, y - 8), num, font=font(FONT_BLACK, 32), fill=INK, anchor="mm")
    d.text((x, y + 128), h, font=font(FONT_BLACK, 22), fill=WHITE, anchor="mm")
d.rounded_rectangle((110, 900, 1810, 1000), radius=35, fill=CORAL)
d.text((960, 950), "ПЕРВАЯ ВЕРСИЯ ВАЖНЕЕ ИДЕАЛЬНОЙ ИДЕИ", font=font(FONT_BLACK, 31), fill=WHITE, anchor="mm")
save(im, 10)

# 11 — Outcomes
im, d = base(PAPER, 11)
title(d, "ЧЕРЕЗ 12 НЕДЕЛЬ — НЕ ОЦЕНКА, А ДОКАЗАТЕЛЬСТВА ИНТЕРЕСА", INK, "Семья видит ребёнка в действии.", CORAL, 60)
outcomes = [
    ("ПОРТФОЛИО ПРОЦЕССА", "Идеи, черновики, фото, видео, аудио и законченные версии.", SOFT_BLUE),
    ("ЛЕНТА ИЗМЕНЕНИЙ", "Что ребёнок переделал после неудачи и как развивал замысел.", SOFT_CORAL),
    ("КАРТА ИНТЕРЕСОВ", "Что выбирал сам, где удерживал внимание и к чему возвращался.", SOFT_LIME),
    ("СЛЕДУЮЩИЙ МАРШРУТ", "Кружок, наставник, сезон или личный проект — уже не вслепую.", GRAPHITE),
]
for i, (h, b, c) in enumerate(outcomes):
    x = 100 + (i % 2) * 880
    y = 405 + (i // 2) * 270
    fg = WHITE if c == GRAPHITE else INK
    card(d, (x, y, 790, 225), c, h, b, fg, fg)
d.text((100, 1000), "Главный сигнал: ребёнок хочет вернуться без уговоров.", font=font(FONT_BLACK, 30), fill=CORAL)
save(im, 11)

# 12 — Difference
im, d = base(SOFT_BLUE, 12)
title(d, "НЕ ЕЩЁ ОДНО ПРИЛОЖЕНИЕ С УРОКАМИ", INK, "Цель — не пройти контент, а найти направление.", CORAL)
left_x, right_x = 110, 1010
d.rounded_rectangle((left_x, 365, left_x + 780, 910), radius=42, fill=WHITE)
d.rounded_rectangle((right_x, 365, right_x + 800, 910), radius=42, fill=GRAPHITE)
d.text((left_x + 40, 410), "ОБЫЧНЫЙ УРОК", font=font(FONT_BLACK, 31), fill=MUTED)
d.text((right_x + 40, 410), "CREATEKIDS", font=font(FONT_BLACK, 31), fill=LIME)
comparisons = [
    ("Одна техника", "Разные способы творчества"),
    ("Повторить образец", "Открытая задача"),
    ("Оценить результат", "Заметить выбор и интерес"),
    ("Ребёнок один", "Личные + семейные проекты"),
    ("Пройти программу", "Найти, куда хочется вернуться"),
]
for i, (a, b) in enumerate(comparisons):
    y = 500 + i * 78
    d.text((left_x + 45, y), "—", font=font(FONT_BLACK, 27), fill=CORAL)
    d.text((left_x + 88, y), a, font=font(FONT_REG, 24), fill=INK)
    d.text((right_x + 45, y), "+", font=font(FONT_BLACK, 27), fill=LIME)
    d.text((right_x + 88, y), b, font=font(FONT_BOLD, 24), fill=WHITE)
d.text((960, 980), "Не искать талант по тесту. Увидеть его в работе.", font=font(FONT_BLACK, 31), fill=INK, anchor="mm")
save(im, 12)

# 13 — MVP
im, d = base(GRAPHITE, 13, True)
title(d, "MVP: ДОСТАТОЧНО, ЧТОБЫ ПРОВЕРИТЬ ПРИВЫЧКУ СОЗДАВАТЬ", WHITE, "Не количество открытых уроков — а возвращение к следующему проекту.", LIME, 57)
columns = [
    ("СТАРТ", ["возраст и время", "12 недель контента", "материалы до 15 минут"], CORAL),
    ("ПРОЦЕСС", ["пошаговый режим", "таймер", "копилка вдохновения", "источники и приёмы"], SKY),
    ("РЕЗУЛЬТАТ", ["фото и версии", "короткая рефлексия", "портфолио", "карта интересов"], LIME),
]
for i, (h, items, c) in enumerate(columns):
    x = 105 + i * 600
    d.rounded_rectangle((x, 400, x + 520, 850), radius=46, fill=c)
    d.text((x + 35, 445), h, font=font(FONT_BLACK, 32), fill=INK)
    for j, item in enumerate(items):
        y = 550 + j * 70
        d.ellipse((x + 38, y + 5, x + 60, y + 27), fill=INK)
        d.text((x + 82, y), item, font=font(FONT_BOLD, 24), fill=INK)
for x, txt in [(150, "СЕМЬЯ НАЧАЛА СЛЕДУЮЩУЮ НЕДЕЛЮ"), (720, "РЕБЁНОК ВЕРНУЛСЯ К ПРОЕКТУ"), (1290, "РОДИТЕЛЮ СТАЛО ЛЕГЧЕ")]:
    pill(d, (x, 920), txt, PAPER, INK, 19)
save(im, 13)

# 14 — Launch and model
im, d = base(SKY, 14)
title(d, "НАЧАТЬ С БЕСПЛАТНОЙ НЕДЕЛИ — ПРОДОЛЖИТЬ СЕЗОНАМИ", INK, "Ценность становится видна после первого реального проекта.", WHITE, 58)
# Funnel
funnel = [
    (170, 430, 720, "БЕСПЛАТНО", "Неделя 1: наблюдать и замечать", CORAL),
    (290, 575, 600, "ПОКУПКА", "Полный маршрут на 12 недель", PAPER),
    (410, 720, 480, "ПОДПИСКА", "Новые тематические сезоны", LIME),
]
for x, y, w, h, b, c in funnel:
    d.polygon([(x, y), (x + w, y), (x + w - 70, y + 105), (x + 70, y + 105)], fill=c, outline=INK)
    d.text((x + w / 2, y + 34), h, font=font(FONT_BLACK, 26), fill=INK, anchor="mm")
    d.text((x + w / 2, y + 74), b, font=font(FONT_REG, 21), fill=INK, anchor="mm")
d.rounded_rectangle((1040, 400, 1785, 885), radius=48, fill=GRAPHITE)
d.text((1090, 450), "КАНАЛЫ", font=font(FONT_BLACK, 31), fill=LIME)
channels = ["родительские сообщества", "блогеры и педагоги", "творческие школы", "музеи и фестивали", "истории семей и карточки проектов"]
for i, item in enumerate(channels):
    y = 550 + i * 62
    d.text((1095, y), "→", font=font(FONT_BLACK, 25), fill=CORAL)
    d.text((1140, y), item, font=font(FONT_BOLD, 24), fill=WHITE)
d.text((1045, 940), "Органическое распространение — без рейтингов детских работ", font=font(FONT_BOLD, 24), fill=INK)
save(im, 14)

# 15 — Final
im, d = base(GRAPHITE, 15, True)
fit_text(d, "НЕ РЕШАЙТЕ ЗА РЕБЁНКА,\nВ ЧЁМ ЕГО ТАЛАНТ.", (95, 155, 1400, 240), 73, 52, WHITE)
fit_text(d, "ПОМОГИТЕ ЕМУ ЭТО ОБНАРУЖИТЬ.", (95, 440, 1500, 140), 59, 45, LIME)
d.rounded_rectangle((100, 690, 1780, 845), radius=44, fill=PAPER)
d.text((145, 735), "CREATEKIDS", font=font(FONT_BLACK, 27), fill=CORAL)
d.text((145, 790), "12 недель, чтобы попробовать, переделать и найти своё", font=font(FONT_BLACK, 34), fill=INK)
d.rounded_rectangle((100, 900, 700, 1000), radius=42, fill=CORAL)
d.text((400, 950), "НАЧАТЬ ПЕРВУЮ НЕДЕЛЮ", font=font(FONT_BLACK, 26), fill=WHITE, anchor="mm")
star(d, (1640, 320), 135, 58, 9, SKY, WHITE, 5)
d.text((1640, 320), "А ЧТО,\nЕСЛИ?", font=font(FONT_BLACK, 31), fill=INK, anchor="mm", spacing=2)
save(im, 15)

# Contact sheet
thumb_w, thumb_h = 384, 216
margin = 22
sheet = Image.new("RGB", (thumb_w * 5 + margin * 6, thumb_h * 3 + margin * 4), "#D7D8DB")
for i in range(1, 16):
    img = Image.open(OUT / f"createkids-product-{i:02d}.png").resize((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    col, row = (i - 1) % 5, (i - 1) // 5
    sheet.paste(img, (margin + col * (thumb_w + margin), margin + row * (thumb_h + margin)))
sheet.save(OUT / "CreateKids-Презентация-проекта-preview.jpg", quality=94)

# PDF is generated directly from the exact slide images.
pdf = fitz.open()
page_w, page_h = 13.333 * 72, 7.5 * 72
for i in range(1, 16):
    image_path = OUT / f"createkids-product-{i:02d}.png"
    page = pdf.new_page(width=page_w, height=page_h)
    page.insert_image(page.rect, filename=str(image_path))
pdf.save(ROOT / "CreateKids-Презентация-проекта.pdf", deflate=True)

print(f"Created 15 slides, preview and PDF in {ROOT}")
