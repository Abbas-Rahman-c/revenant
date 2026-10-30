"""Renders the Devpost thumbnail (3:2) for Summoning Circle.

Usage: python planning/make_thumbnail.py planning/thumbnail.png
"""
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else "thumbnail.png"
SS = 2  # supersample factor for smooth edges
W, H = 1500 * SS, 1000 * SS

VOID = (13, 10, 20)
BONE = (237, 230, 214)
DUST = (155, 146, 168)
EMBER = (255, 138, 61)
SPECTRE = (167, 139, 250)
FONTS = "C:/Windows/Fonts/"

base = Image.new("RGB", (W, H), VOID)

# warm haze behind the circle
haze = Image.new("RGB", (W, H), VOID)
hd = ImageDraw.Draw(haze)
cx, cy, R = int(W * 0.735), int(H * 0.50), int(H * 0.35)
for i in range(60, 0, -1):
    r = R * 1.9 * i / 60
    t = 1 - i / 60
    col = tuple(int(VOID[k] + (c - VOID[k]) * t * 0.22) for k, c in enumerate((90, 40, 30)))
    hd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
base = Image.blend(base, haze.filter(ImageFilter.GaussianBlur(60 * SS)), 1.0)

lines = Image.new("RGBA", (W, H), (0, 0, 0, 0))
glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
ld, gd = ImageDraw.Draw(lines), ImageDraw.Draw(glow)


def ring(r, col, w):
    ld.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=w)


# faint construction rings
ring(R * 1.12, DUST + (70,), 2 * SS)
ring(R * 0.80, DUST + (90,), 2 * SS)
ring(R * 0.55, DUST + (60,), 1 * SS)

# octagram from two squares
for rot in (0, 45):
    pts = [(cx + R * 0.80 * math.cos(math.radians(a + rot - 90)),
            cy + R * 0.80 * math.sin(math.radians(a + rot - 90))) for a in range(0, 360, 90)]
    ld.polygon(pts, outline=SPECTRE + (70,), width=2 * SS)

# progress arc: the circle is the download bar
PROGRESS = 0.72
box = [cx - R, cy - R, cx + R, cy + R]
ld.arc(box, -90, 270, fill=DUST + (60,), width=3 * SS)
ld.arc(box, -90, -90 + 360 * PROGRESS, fill=EMBER + (255,), width=5 * SS)
gd.arc(box, -90, -90 + 360 * PROGRESS, fill=EMBER + (200,), width=18 * SS)

# sigils between the rings, lit up to the progress point
random.seed(7)
N = 24
for i in range(N):
    a = -90 + 360 * (i + 0.5) / N
    lit = (i + 0.5) / N <= PROGRESS
    rr = R * 0.905
    sx, sy = cx + rr * math.cos(math.radians(a)), cy + rr * math.sin(math.radians(a))
    s = 19 * SS
    col = EMBER + (255,) if lit else DUST + (110,)
    strokes = []
    for _ in range(random.randint(2, 4)):
        p1 = (sx + random.uniform(-s, s), sy + random.uniform(-s, s))
        p2 = (sx + random.uniform(-s, s), sy + random.uniform(-s, s))
        strokes.append((p1, p2))
    if random.random() < 0.5:
        rad = random.uniform(3, 6) * SS
        strokes.append(("dot", (sx, sy - s * 0.6, rad)))
    for st in strokes:
        if st[0] == "dot":
            x, y, rad = st[1]
            ld.ellipse([x - rad, y - rad, x + rad, y + rad], outline=col, width=2 * SS)
            if lit:
                gd.ellipse([x - rad, y - rad, x + rad, y + rad], outline=EMBER + (160,), width=6 * SS)
        else:
            ld.line(st, fill=col, width=3 * SS)
            if lit:
                gd.line(st, fill=EMBER + (150,), width=10 * SS)

# leading spark at the end of the progress arc
ea = math.radians(-90 + 360 * PROGRESS)
ex, ey = cx + R * math.cos(ea), cy + R * math.sin(ea)
for rad, alpha in ((40, 60), (22, 140), (9, 255)):
    gd.ellipse([ex - rad * SS, ey - rad * SS, ex + rad * SS, ey + rad * SS], fill=(255, 200, 140, alpha))

# the summoned flame at the center
def flame(scale, col):
    # teardrop: tip at the top, round belly at the bottom, slight lean
    pts = []
    for k in range(0, 361, 4):
        t = math.radians(k)
        x = math.sin(t) * (math.sin(t / 2) ** 1.6) * 0.62
        y = -math.cos(t)
        x += 0.06 * (1 - (y + 1) / 2) ** 2  # lean the tip slightly
        pts.append((cx + x * scale, cy + 10 * SS + y * scale * 1.15))
    return pts


gd.polygon(flame(R * 0.34, None), fill=EMBER + (170,))
ld.polygon(flame(R * 0.30, None), fill=(255, 150, 70, 255))
ld.polygon(flame(R * 0.17, None), fill=(255, 226, 170, 255))

glow = glow.filter(ImageFilter.GaussianBlur(14 * SS))
base = base.convert("RGBA")
base.alpha_composite(glow)
base.alpha_composite(lines)

# type
d = ImageDraw.Draw(base)
title = ImageFont.truetype(FONTS + "GARABD.TTF", 118 * SS)
tag = ImageFont.truetype(FONTS + "GARAIT.TTF", 50 * SS)
small = ImageFont.truetype(FONTS + "GARA.TTF", 34 * SS)
x0 = 90 * SS
d.text((x0, 330 * SS), "Summoning", font=title, fill=BONE)
d.text((x0, 455 * SS), "Circle", font=title, fill=BONE)
d.text((x0, 615 * SS), "AI that lives in your browser.", font=tag, fill=EMBER)
d.text((x0, 690 * SS), "No server. No API bill.", font=small, fill=DUST)
d.text((x0, 735 * SS), "Nothing leaves your device.", font=small, fill=DUST)

img = base.convert("RGB").resize((W // SS, H // SS), Image.LANCZOS)
img.save(OUT, optimize=True)
print("saved", OUT, img.size)
