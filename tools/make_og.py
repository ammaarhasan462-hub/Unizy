"""Builds site/assets/og.png, the 1200x630 image shown when unizy.uk is shared (same look as the 3D intro).
Run: python3 tools/make_og.py   (needs Pillow and the Inter font files)"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import random, math

W, H = 1200, 630
F = '/usr/share/fonts/opentype/inter/'


def f(name, size):
    return ImageFont.truetype(F + name, size)


img = Image.new('RGB', (W, H))
px = img.load()
for y in range(H):
    t = y / H
    for x in range(W):
        r = 6 + 18 * t; g = 8 + 18 * t; b = 14 + 22 * t
        dx = (x - 860) / 520; dy = (y - 560) / 260
        glow = math.exp(-(dx * dx + dy * dy))
        px[x, y] = (int(min(255, r + 95 * glow)), int(min(255, g + 52 * glow)), int(min(255, b + 26 * glow)))
d = ImageDraw.Draw(img)
random.seed(4)
for i in range(220):
    x = random.randint(0, W); y = random.randint(0, int(H * 0.62)); a = random.randint(40, 150)
    d.point((x, y), fill=(a, a, min(255, a + 25)))
clouds = Image.new('L', (W, H), 0); cd = ImageDraw.Draw(clouds)
for i in range(70):
    x = random.randint(-100, W + 100); y = random.randint(int(H * 0.8), H + 40); r = random.randint(40, 120)
    cd.ellipse((x - r * 1.6, y - r * 0.7, x + r * 1.6, y + r * 0.7), fill=random.randint(60, 140))
clouds = clouds.filter(ImageFilter.GaussianBlur(26))
img = Image.composite(Image.new('RGB', (W, H), (58, 54, 56)), img, clouds.point(lambda v: int(v * 0.55)))
d = ImageDraw.Draw(img)
ivory = (243, 238, 228); mute = (196, 190, 180); gold = (217, 180, 108)
d.rounded_rectangle((70, 64, 124, 118), radius=14, outline=ivory, width=2, fill=(22, 26, 34))
d.text((97, 91), 'U', font=f('Inter-SemiBold.otf', 30), fill=ivory, anchor='mm')
d.text((140, 91), 'Unizy', font=f('Inter-SemiBold.otf', 34), fill=ivory, anchor='lm')
hf = f('InterDisplay-SemiBold.otf', 74)
for i, line in enumerate(['The mark scheme your', 'uni never gave you.']):
    d.text((68, 180 + i * 84), line, font=hf, fill=ivory)
d.text((70, 372), 'Exam practice and marking for every module at UCL,', font=f('Inter-Regular.otf', 27), fill=mute)
d.text((70, 408), 'Imperial, Queen Mary and LSE.', font=f('Inter-Regular.otf', 27), fill=mute)
d.text((70, 530), 'UNIZY.UK', font=f('Inter-Medium.otf', 18), fill=gold)
card = Image.new('RGBA', (330, 190), (0, 0, 0, 0)); c = ImageDraw.Draw(card)
c.rounded_rectangle((0, 0, 329, 189), radius=22, fill=(12, 16, 22, 215), outline=(255, 255, 255, 40), width=1)
c.rounded_rectangle((22, 22, 86, 86), radius=16, fill=(62, 107, 92, 255))
c.text((54, 54), '2:1', font=f('Inter-Bold.otf', 24), fill=(255, 255, 255), anchor='mm')
c.text((104, 30), '62–66', font=f('Inter-SemiBold.otf', 34), fill=ivory)
c.text((104, 72), 'Year 1 criteria', font=f('Inter-Regular.otf', 15), fill=mute)
c.text((22, 112), '3 CHANGES TO MOVE UP A CLASS', font=f('Inter-Medium.otf', 12), fill=gold)
c.text((22, 134), '1. Derive MR = P(1 + 1/ε) first', font=f('Inter-Regular.otf', 15), fill=ivory)
c.text((22, 158), '2. Add the labelled diagram', font=f('Inter-Regular.otf', 15), fill=ivory)
img = img.convert('RGBA'); img.alpha_composite(card, (830, 396))
img.convert('RGB').save('site/assets/og.png', optimize=True)
print('wrote site/assets/og.png')
