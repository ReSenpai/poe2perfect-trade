"""Store graphics for the Chrome Web Store and Firefox Add-ons listings, composed from raw screenshots of the extension.

Put the raw captures in store/raw (named as in SHOTS below: the workspace on the sample search, seller names replaced
with neutral ones before capture), then run:  python scripts/make-store-assets.py
Needs Pillow and numpy. Writes store/*.png and docs/images/*.jpg (used by the README).
"""

import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand import ACCENT, BOLD, MUTED, REGULAR, ROOT, TEXT, background, emblem, font, paste_framed, wordmark

OUT = os.path.join(ROOT, 'store')
RAW_DIR = os.path.join(OUT, 'raw')
README_DIR = os.path.join(ROOT, 'docs', 'images')

# Raw file, output name, title, subtitle. The Chrome Web Store takes the first five; Firefox Add-ons takes them all.
SHOTS = [
    ('1-workspace.jpg', '1-workspace', 'The trade site, on one screen',
     "Filters on the left, the site's own item cards on the right, searched stats marked in colour."),
    ('2-parameters.jpg', '2-parameters', 'Either, or — and never this',
     'Match at least 2 of 3 resistances, and exclude a modifier, right from a parameter.'),
    ('3-cards.jpg', '3-cards', 'Sort by any line of a card',
     'Click a mod to sort the results by it; roll ranges show on hover.'),
    ('4-compare.jpg', '4-compare', 'Compare two listings side by side',
     'Price, the stats you searched for and every other property, with the difference.'),
    ('5-saved.jpg', '5-saved', 'Your searches stay yours',
     'Save searches by name. Nothing searches until you press Find items.'),
    ('6-help.jpg', '6-help', 'Total, Explicit or Implicit — explained',
     'A built-in guide to stat sources and the three ways a condition can match.'),
]


def raw(name):
    return Image.open(os.path.join(RAW_DIR, name)).convert('RGB')


def screenshot_card(raw_name, name, title, subtitle):
    canvas = background((1280, 800)).convert('RGBA')
    wordmark(canvas, 40, 34)
    d = ImageDraw.Draw(canvas)
    d.text((40, 92), title, font=font(BOLD, 44), fill=TEXT)
    d.text((42, 160), subtitle, font=font(REGULAR, 22), fill=MUTED)
    paste_framed(canvas, raw(raw_name), (40, 214), 1200)
    canvas.convert('RGB').save(os.path.join(OUT, f'screenshot-{name}.png'), optimize=True)


os.makedirs(README_DIR, exist_ok=True)
for raw_name, name, title, subtitle in SHOTS:
    screenshot_card(raw_name, name, title, subtitle)
    # The README shows the raw capture itself, a little smaller.
    shot = raw(raw_name)
    shot.resize((1280, round(shot.height * 1280 / shot.width)), Image.LANCZOS).save(os.path.join(README_DIR, f'{name}.jpg'), quality=86, optimize=True)

# Small promo tile 440x280: name and promise, with a peek at the listings.
tile = background((440, 280), focus=(0.1, 0.2)).convert('RGBA')
peek = raw('1-workspace.jpg').crop((480, 60, 1568, 710))
paste_framed(tile, peek, (236, 112), 300, radius=10)
wordmark(tile, 22, 24, size=34)
d = ImageDraw.Draw(tile)
d.text((22, 100), 'PoE 2 trade,', font=font(BOLD, 26), fill=TEXT)
d.text((22, 134), 'on one', font=font(BOLD, 26), fill=TEXT)
d.text((22, 168), 'screen', font=font(BOLD, 26), fill=ACCENT)
tile.convert('RGB').save(os.path.join(OUT, 'promo-small-440x280.png'), optimize=True)

# Marquee 1400x560.
marquee = background((1400, 560), focus=(0.12, 0.25)).convert('RGBA')
paste_framed(marquee, raw('2-parameters.jpg'), (700, 96), 1000, radius=16)
wordmark(marquee, 64, 70, size=56)
d = ImageDraw.Draw(marquee)
d.text((64, 176), 'The Path of Exile 2', font=font(BOLD, 46), fill=TEXT)
d.text((64, 234), 'trade site, clean', font=font(BOLD, 46), fill=ACCENT)
d.text((66, 316), 'Filters that read like the item you want,', font=font(REGULAR, 22), fill=MUTED)
d.text((66, 348), "the site's own item cards, one search per click.", font=font(REGULAR, 22), fill=MUTED)
marquee.convert('RGB').save(os.path.join(OUT, 'promo-marquee-1400x560.png'), optimize=True)

# Store icon: 96x96 artwork inside a transparent 128x128 square (Chrome); Firefox takes the same file.
store_icon = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
store_icon.alpha_composite(emblem(96), (16, 16))
store_icon.save(os.path.join(OUT, 'store-icon-128.png'))
print('ok')
