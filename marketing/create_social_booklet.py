from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math
import random

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "booklet-social-jpg"
OUT.mkdir(parents=True, exist_ok=True)

W = H = 1080
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

random.seed(17)


def F(path, size):
    return ImageFont.truetype(path, size)


def add_texture(im, strength=8, opacity=0.08):
    noise = Image.effect_noise(im.size, strength).convert("L")
    grain = Image.merge("RGBA", (noise, noise, noise, noise.point(lambda p: int(255 * opacity))))
    return Image.alpha_composite(im.convert("RGBA"), grain)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text_width(draw, text, font):
    b = draw.textbbox((0, 0), text, font=font)
    return b[2] - b[0]


def wrap_lines(draw, text, font, max_width):
    result = []
    for para in text.split("\n"):
        if para == "":
            result.append("")
            continue
        words = para.split()
        line = ""
        for word in words:
            test = word if not line else line + " " + word
            if text_width(draw, test, font) <= max_width:
                line = test
            else:
                if line:
                    result.append(line)
                line = word
        if line:
            result.append(line)
    return result


def draw_wrapped(draw, text, xy, font, fill, max_width, spacing=10, anchor="la"):
    x, y = xy
    lines = wrap_lines(draw, text, font, max_width)
    ascent, descent = font.getmetrics()
    line_h = ascent + descent
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill, anchor=anchor)
        y += line_h + spacing
    return y


def draw_fitted(draw, text, box, font_path, max_size, min_size, fill, spacing=8, anchor="la"):
    x, y, w, h = box
    for size in range(max_size, min_size - 1, -2):
        font = F(font_path, size)
        lines = wrap_lines(draw, text, font, w)
        ascent, descent = font.getmetrics()
        total = len(lines) * (ascent + descent) + max(0, len(lines) - 1) * spacing
        if total <= h:
            yy = y
            for line in lines:
                draw.text((x, yy), line, font=font, fill=fill, anchor=anchor)
                yy += ascent + descent + spacing
            return size, yy
    return min_size, y


def label(im, xy, text, bg, fg=GRAPHITE, size=24, angle=0, pad=(18, 11), radius=16, font_path=FONT_BOLD):
    font = F(font_path, size)
    dummy = ImageDraw.Draw(im)
    b = dummy.textbbox((0, 0), text, font=font)
    tw, th = b[2] - b[0], b[3] - b[1]
    pw, ph = tw + pad[0] * 2, th + pad[1] * 2 + 3
    patch = Image.new("RGBA", (pw + 20, ph + 20), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    pd.rounded_rectangle((8, 8, 8 + pw, 8 + ph), radius=radius, fill=bg)
    pd.text((8 + pad[0], 8 + pad[1] - b[1]), text, font=font, fill=fg)
    if angle:
        patch = patch.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    im.alpha_composite(patch, (int(xy[0]), int(xy[1])))
    return patch.size


def paper_panel(im, box, fill=WHITE, angle=0, radius=32, shadow=True, outline=None, callback=None):
    x, y, w, h = map(int, box)
    pad = 36
    patch = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    pd = ImageDraw.Draw(patch)
    if shadow:
        pd.rounded_rectangle((pad + 10, pad + 14, pad + w + 10, pad + h + 14), radius=radius, fill=(0, 0, 0, 42))
    pd.rounded_rectangle((pad, pad, pad + w, pad + h), radius=radius, fill=fill, outline=outline, width=3 if outline else 1)
    if callback:
        callback(pd, pad, pad, w, h)
    if angle:
        patch = patch.rotate(angle, expand=True, resample=Image.Resampling.BICUBIC)
    im.alpha_composite(patch, (x - (patch.width - w) // 2, y - (patch.height - h) // 2))


def hand_line(draw, points, fill, width=8, jitter=3, seed=0):
    rng = random.Random(seed)
    pts = []
    for x, y in points:
        pts.append((x + rng.randint(-jitter, jitter), y + rng.randint(-jitter, jitter)))
    draw.line(pts, fill=fill, width=width, joint="curve")
    if width > 5:
        pts2 = [(x + rng.randint(-2, 2), y + rng.randint(-2, 2)) for x, y in points]
        draw.line(pts2, fill=fill, width=max(2, width // 3), joint="curve")


def dashed_curve(draw, pts, fill, width=4, dash=18, gap=12):
    # Piecewise dashed hand-drawn path.
    for a, b in zip(pts, pts[1:]):
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


def doodle_star(draw, center, r1, r2, points, fill, outline=None, width=3, rotation=-math.pi/2):
    cx, cy = center
    poly = []
    for i in range(points * 2):
        r = r1 if i % 2 == 0 else r2
        a = rotation + i * math.pi / points
        poly.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    draw.polygon(poly, fill=fill)
    if outline:
        draw.line(poly + [poly[0]], fill=outline, width=width, joint="curve")


def circle_note(draw, center, radius, text, fill, fg=GRAPHITE, font_size=28):
    cx, cy = center
    draw.ellipse((cx-radius, cy-radius, cx+radius, cy+radius), fill=fill)
    draw.text((cx, cy), text, font=F(FONT_BOLD, font_size), fill=fg, anchor="mm")


def base(bg, index, dark=False):
    im = Image.new("RGBA", (W, H), bg)
    im = add_texture(im, 10, 0.045 if dark else 0.035)
    d = ImageDraw.Draw(im)
    fg = WHITE if dark else INK
    d.text((66, 52), "CREATEKIDS", font=F(FONT_BLACK, 24), fill=fg)
    d.text((1014, 56), f"{index:02d}/06", font=F(FONT_BOLD, 20), fill=fg, anchor="ra")
    return im, d


def save(im, n):
    path = OUT / f"createkids-booklet-{n:02d}.jpg"
    im.convert("RGB").save(path, quality=96, subsampling=0)
    return path


# 01 — Cover
im, d = base(GRAPHITE, 1, dark=True)
# Living line / orbit on the right.
hand_line(d, [(585, 965), (640, 850), (622, 745), (708, 646), (695, 520), (790, 400), (760, 250), (930, 112)], LIME, 12, 5, 1)
d.ellipse((708, 398, 884, 574), fill=SKY, outline=WHITE, width=5)
d.ellipse((758, 448, 834, 524), fill=GRAPHITE)
d.arc((745, 435, 847, 537), 210, 530, fill=CORAL, width=15)
doodle_star(d, (890, 320), 70, 31, 7, CORAL, WHITE, 4, rotation=-0.4)
d.polygon([(620, 700), (725, 626), (810, 742), (702, 822)], fill=PAPER)
d.line([(642, 720), (704, 680), (760, 742)], fill=GRAPHITE, width=8)
d.line([(680, 765), (748, 704)], fill=CORAL, width=8)
# Mini interface card.
def card1(pd, ox, oy, w, h):
    pd.text((ox+30, oy+24), "ИДЕЯ НЕДЕЛИ", font=F(FONT_BOLD, 18), fill=MUTED)
    pd.text((ox+30, oy+65), "Создать мир\nиз одной линии", font=F(FONT_BOLD, 24), fill=INK, spacing=5)
    pd.rounded_rectangle((ox+30, oy+h-62, ox+w-30, oy+h-28), radius=17, fill=LIME)
    pd.text((ox+w/2, oy+h-45), "НАЧАТЬ", font=F(FONT_BOLD, 16), fill=INK, anchor="mm")
paper_panel(im, (758, 650, 255, 240), PAPER, angle=5, radius=24, callback=card1)
label(im, (636, 176), "рисунок", SKY, size=22, angle=-6)
label(im, (837, 555), "звук", CORAL, WHITE, size=22, angle=8)
label(im, (632, 875), "код", LIME, size=22, angle=-4)
# Headline.
draw_fitted(d, "Будущее нельзя\nпредсказать.", (64, 170, 630, 260), FONT_BLACK, 76, 58, WHITE, spacing=2)
draw_fitted(d, "Способность создавать\nможно развивать.", (65, 467, 570, 235), FONT_BOLD, 52, 40, LIME, spacing=6)
d.text((68, 845), "Семейная лаборатория творчества", font=F(FONT_BOLD, 27), fill=WHITE)
d.text((68, 892), "для детей 7–14 лет и их родителей", font=F(FONT_REG, 24), fill="#C9CBD2")
label(im, (66, 953), "12 недель • дома • без оценок", PAPER, size=20, angle=-1)
save(im, 1)

# 02 — Why now
im, d = base(PAPER, 2, dark=False)
draw_fitted(d, "Ответы становятся\nдоступнее.", (66, 132, 755, 200), FONT_BLACK, 68, 52, INK, spacing=0)
draw_fitted(d, "Ценнее — замысел\nи хороший вопрос.", (66, 332, 810, 195), FONT_BOLD, 54, 42, CORAL, spacing=4)
# Repeated answer cards fading into a raw construction.
for i, (x, y, c) in enumerate([(80, 620, "#FFFFFF"), (245, 650, "#ECEDEF"), (410, 680, "#D9DBDE")]):
    def cb(pd, ox, oy, w, h, i=i):
        pd.rounded_rectangle((ox+20, oy+22, ox+w-20, oy+42), radius=10, fill="#B8BBC1")
        for k in range(3):
            pd.rounded_rectangle((ox+20, oy+64+k*28, ox+w-50-k*12, oy+75+k*28), radius=5, fill="#D2D4D8")
        pd.text((ox+20, oy+h-42), "ГОТОВЫЙ ОТВЕТ", font=F(FONT_BOLD, 14), fill=MUTED)
    paper_panel(im, (x, y, 190, 190), c, angle=-6+i*3, radius=20, callback=cb)
# Question construction on right.
d.ellipse((688, 560, 1004, 876), fill=SKY)
d.ellipse((758, 630, 934, 806), fill=PAPER)
d.arc((725, 600, 965, 840), 205, 520, fill=CORAL, width=34)
d.rounded_rectangle((823, 807, 863, 888), radius=19, fill=CORAL)
hand_line(d, [(592, 832), (676, 805), (712, 860), (796, 842), (890, 925), (1000, 887)], GRAPHITE, 7, 4, 6)
label(im, (691, 914), "А ЧТО, ЕСЛИ…", LIME, size=24, angle=-3)
d.text((67, 977), "ИИ — инструмент. Авторский выбор остаётся за ребёнком.", font=F(FONT_BOLD, 24), fill=INK)
save(im, 2)

# 03 — Product structure
im, d = base(SKY, 3, dark=False)
draw_fitted(d, "12 недель.", (64, 132, 450, 100), FONT_BLACK, 76, 62, INK)
draw_fitted(d, "8 творческих языков.", (64, 230, 760, 100), FONT_BLACK, 64, 48, WHITE)
d.text((68, 340), "Одна семейная лаборатория.", font=F(FONT_BOLD, 33), fill=INK)
# Bento collage, deliberately varied sizes.
tiles = [
    (70, 438, 270, 175, CORAL, "РИСУНОК", "линия → образ"),
    (365, 420, 310, 220, PAPER, "ИСТОРИИ", "слово → мир"),
    (705, 432, 300, 160, LIME, "МУЗЫКА", "ритм → настроение"),
    (70, 640, 220, 285, PAPER, "ТЕАТР", "жест → персонаж"),
    (315, 675, 255, 220, GRAPHITE, "КИНО", "кадр → сюжет"),
    (595, 628, 410, 145, SOFT_CORAL, "КОНСТРУИРОВАНИЕ", "материал → прототип"),
    (600, 800, 190, 155, LIME, "DIGITAL", "правило → игра"),
    (812, 800, 195, 155, PAPER, "ДИЗАЙН", "нужда → решение"),
]
for idx, (x,y,w,h,c,title,sub) in enumerate(tiles):
    fg = WHITE if c == GRAPHITE else INK
    d.rounded_rectangle((x,y,x+w,y+h), radius=28, fill=c)
    d.text((x+22,y+22), title, font=F(FONT_BOLD, 22 if len(title)<11 else 18), fill=fg)
    d.text((x+22,y+h-40), sub, font=F(FONT_REG, 19), fill=fg)
    if idx == 0:
        hand_line(d, [(x+45,y+90),(x+95,y+65),(x+140,y+110),(x+190,y+66),(x+230,y+102)], WHITE, 6, 2, 12)
    elif idx == 1:
        d.text((x+w-62,y+78), "Aa", font=F(FONT_ITALIC, 56), fill=CORAL, anchor="mm")
    elif idx == 2:
        for k in range(6):
            hh=25+(k%3)*18
            d.rounded_rectangle((x+35+k*38,y+74-hh/2,x+53+k*38,y+74+hh/2),radius=8,fill=INK)
    elif idx == 3:
        d.ellipse((x+63,y+82,x+156,y+175), outline=CORAL, width=7)
        d.arc((x+82,y+108,x+138,y+160), 10, 170, fill=CORAL, width=5)
    elif idx == 4:
        for k in range(3):
            d.rectangle((x+35+k*67,y+80,x+85+k*67,y+122), outline=SKY, width=4)
    elif idx == 5:
        d.polygon([(x+290,y+35),(x+354,y+70),(x+298,y+108),(x+235,y+72)], fill=SKY, outline=INK)
    elif idx == 6:
        d.text((x+w/2,y+86), "{ }", font=F(FONT_BLACK, 42), fill=INK, anchor="mm")
    else:
        doodle_star(d,(x+w/2,y+82),48,22,6,CORAL,INK,3)
label(im, (64, 978), "каждую неделю — новый способ создавать", GRAPHITE, WHITE, size=23, angle=-1)
save(im, 3)

# 04 — Two trajectories
im, d = base(PAPER, 4, dark=False)
draw_fitted(d, "Разные задачи.\nРавное авторство.", (66, 128, 860, 180), FONT_BLACK, 68, 50, INK, spacing=0)
# Left younger card.
def young(pd, ox, oy, w, h):
    pd.text((ox+32,oy+26),"7 ЛЕТ",font=F(FONT_BLACK,36),fill=INK)
    pd.text((ox+32,oy+80),"быстро пробует",font=F(FONT_BOLD,24),fill=INK)
    # blot becomes creature
    pd.ellipse((ox+48,oy+150,ox+220,oy+315),fill=CORAL)
    pd.ellipse((ox+75,oy+195,ox+105,oy+225),fill=WHITE)
    pd.ellipse((ox+160,oy+195,ox+190,oy+225),fill=WHITE)
    pd.line((ox+105,oy+267,ox+145,oy+285,ox+180,oy+258),fill=INK,width=7,joint="curve")
    pd.text((ox+32,oy+h-86),"пятно → персонаж\nзвук → история",font=F(FONT_BOLD,22),fill=INK,spacing=7)
paper_panel(im,(62,368,420,500),SOFT_CORAL,angle=-2,radius=34,callback=young)
# Right teen card.
def teen(pd, ox, oy, w, h):
    pd.text((ox+32,oy+26),"14 ЛЕТ",font=F(FONT_BLACK,36),fill=WHITE)
    pd.text((ox+32,oy+80),"строит свой стиль",font=F(FONT_BOLD,24),fill=WHITE)
    # poster / timeline mockup
    pd.rectangle((ox+42,oy+148,ox+344,oy+318),fill=PAPER)
    pd.text((ox+64,oy+170),"СВОЙ\nГОЛОС",font=F(FONT_BLACK,40),fill=INK,spacing=-2)
    pd.ellipse((ox+255,oy+190,ox+316,oy+251),fill=LIME)
    pd.line((ox+64,oy+283,ox+290,oy+283),fill=CORAL,width=8)
    pd.text((ox+32,oy+h-86),"постер → трек\nистория → digital",font=F(FONT_BOLD,22),fill=WHITE,spacing=7)
paper_panel(im,(594,356,420,510),GRAPHITE,angle=2,radius=34,callback=teen)
# Center joint project connector.
dashed_curve(d, [(268,892),(410,955),(550,900),(690,955),(860,890)], INK, 5, 16, 10)
label(im,(380,880),"ВМЕСТЕ",LIME,size=25,angle=-2)
d.text((541, 990), "старший не учитель • младший не исполнитель", font=F(FONT_BOLD, 23), fill=INK, anchor="mm")
save(im, 4)

# 05 — Kleon method
im, d = base(GRAPHITE, 5, dark=True)
draw_fitted(d, "Творчество не\nвозникает из пустоты.", (66, 128, 890, 180), FONT_BLACK, 62, 48, WHITE, spacing=0)
d.text((68, 325), "Оно начинается с внимания.", font=F(FONT_BOLD, 34), fill=LIME)
# Winding path with 5 stations.
pts = [(130,520),(325,470),(515,590),(700,500),(920,650),(760,842),(510,780),(270,900)]
hand_line(d, pts, SKY, 10, 5, 44)
steps = [
    ((130,520),"01","ЗАМЕТИТЬ",CORAL),
    ((325,470),"02","ВЗЯТЬ ПРИЁМ",PAPER),
    ((515,590),"03","СОЕДИНИТЬ",LIME),
    ((700,500),"04","ИЗМЕНИТЬ",CORAL),
    ((920,650),"05","НАЗВАТЬ\nИСТОЧНИК",PAPER),
]
for (cx,cy),num,title,c in steps:
    d.ellipse((cx-60,cy-60,cx+60,cy+60),fill=c,outline=WHITE,width=4)
    d.text((cx,cy-13),num,font=F(FONT_BLACK,29),fill=INK,anchor="mm")
    d.text((cx,cy+88),title,font=F(FONT_BOLD,22),fill=WHITE,anchor="mm",align="center",spacing=2)
# Three source scraps feeding into path.
label(im,(95,760),"цвет",CORAL,WHITE,size=20,angle=-7)
label(im,(220,800),"ритм",SKY,size=20,angle=6)
label(im,(337,840),"сюжет",LIME,size=20,angle=-4)
d.text((68, 980), "Учебная копия ≠ авторская работа. Важно, что ребёнок изменил.", font=F(FONT_BOLD, 24), fill="#E8E9EC")
save(im, 5)

# 06 — Outcome / CTA
im, d = base(PAPER, 6, dark=False)
draw_fitted(d, "Главный сигнал —\nхочется вернуться.", (66, 122, 900, 185), FONT_BLACK, 68, 52, INK, spacing=0)
d.text((70, 324), "Не тест таланта. Карта живого интереса.", font=F(FONT_BOLD, 31), fill=CORAL)
# Evidence trail.
trail = [
    (120,530,"ВЫБРАЛ","сам"),
    (325,630,"ВЕРНУЛСЯ","без уговоров"),
    (535,535,"ИЗМЕНИЛ","вторую версию"),
    (745,650,"ПОПРОСИЛ","новый материал"),
    (920,535,"НАЧАЛ","свой проект"),
]
hand_line(d, [(x,y) for x,y,_,_ in trail], SKY, 9, 6, 31)
for i,(x,y,title,sub) in enumerate(trail):
    c=[CORAL,LIME,SKY,SOFT_CORAL,PAPER][i]
    outline=INK if c==PAPER else None
    d.ellipse((x-58,y-58,x+58,y+58),fill=c,outline=outline,width=4 if outline else 1)
    doodle_star(d,(x,y),28,13,6,INK if c!=INK else WHITE)
    d.text((x,y+82),title,font=F(FONT_BLACK,20),fill=INK,anchor="mm")
    d.text((x,y+112),sub,font=F(FONT_REG,19),fill=MUTED,anchor="mm")
# CTA block.
d.rounded_rectangle((64,825,1016,1012),radius=36,fill=GRAPHITE)
d.text((100,864),"CREATEKIDS",font=F(FONT_BLACK,26),fill=LIME)
d.text((100,910),"Начать первую неделю",font=F(FONT_BLACK,42),fill=WHITE)
d.rounded_rectangle((762,866,975,966),radius=50,fill=CORAL)
d.text((868,916),"ПОПРОБОВАТЬ",font=F(FONT_BOLD,24),fill=WHITE,anchor="mm")
save(im, 6)

# Contact sheet for quick review.
thumb = 480
margin = 28
sheet = Image.new("RGB", (thumb*3 + margin*4, thumb*2 + margin*3), "#E5E5E5")
for i in range(1,7):
    img = Image.open(OUT / f"createkids-booklet-{i:02d}.jpg").resize((thumb,thumb),Image.Resampling.LANCZOS)
    col=(i-1)%3
    row=(i-1)//3
    sheet.paste(img,(margin+col*(thumb+margin),margin+row*(thumb+margin)))
sheet.save(OUT / "createkids-booklet-contact-sheet.jpg", quality=94)

print(f"Created 6 JPG pages in {OUT}")
