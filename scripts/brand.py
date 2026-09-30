"""Shared brand drawing helpers for the store graphics (see scripts/make-store-assets.py)."""

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The workspace's palette: graphite ground, brass gold.
BG = (14, 18, 19)
SURFACE = (20, 27, 27)
BORDER = (58, 64, 58)
TEXT = (236, 233, 222)
MUTED = (164, 174, 166)
ACCENT = (215, 185, 110)

FONTS = r'C:\Windows\Fonts'
BOLD = os.path.join(FONTS, 'seguisb.ttf')
REGULAR = os.path.join(FONTS, 'segoeui.ttf')


def font(path, size):
    return ImageFont.truetype(path, size)


def emblem(size):
    """The extension icon (public/icon/128.png) at any size."""
    icon = Image.open(os.path.join(ROOT, 'public', 'icon', '128.png')).convert('RGBA')
    return icon.resize((size, size), Image.LANCZOS)


def background(size, focus=(0.16, 0.3), reach=0.7, strength=0.34):
    """Near-black ground with one warm brass light, computed per pixel: smooth at any size, no banding."""
    w, h = size
    x = np.linspace(0, 1, w)[None, :]
    y = np.linspace(0, 1, h)[:, None] * (h / w)
    fx, fy = focus[0], focus[1] * (h / w)
    distance = np.sqrt((x - fx) ** 2 + (y - fy) ** 2) / reach
    light = np.clip(1 - distance, 0, 1) ** 2.2 * strength

    ground = np.array(BG, dtype=np.float32)
    warm = np.array((104, 84, 42), dtype=np.float32)
    pixels = ground[None, None, :] + (warm - ground)[None, None, :] * light[:, :, None]
    # A touch of noise keeps wide gradients free of banding after the PNG quantises them.
    pixels += np.random.default_rng(7).normal(0, 0.9, pixels.shape)
    return Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))


def rounded(image, radius):
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, image.size[0] - 1, image.size[1] - 1], radius=radius, fill=255)
    out = image.convert('RGBA')
    out.putalpha(mask)
    return out


def paste_framed(canvas, shot, box_xy, width, radius=14):
    """A screenshot with rounded corners, a thin border and a soft shadow; returns its height."""
    ratio = width / shot.width
    shot = shot.resize((width, round(shot.height * ratio)), Image.LANCZOS)
    x, y = box_xy
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([x - 4, y + 10, x + shot.width + 4, y + shot.height + 22], radius=radius + 6, fill=(0, 0, 0, 170))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(rounded(shot, radius), (x, y))
    ImageDraw.Draw(canvas).rounded_rectangle([x, y, x + shot.width - 1, y + shot.height - 1], radius=radius, outline=BORDER + (255,), width=2)
    return shot.height


def wordmark(canvas, x, y, size=34):
    """The emblem and the name: 'poe2perfect' in text colour, 'trade' in gold."""
    canvas.alpha_composite(emblem(size), (x, y))
    d = ImageDraw.Draw(canvas)
    f = font(BOLD, int(size * 0.62))
    left = x + size + 12
    d.text((left, y + size / 2), 'poe2perfect', font=f, fill=TEXT, anchor='lm')
    width = d.textlength('poe2perfect ', font=f)
    d.text((left + width, y + size / 2), 'trade', font=f, fill=ACCENT, anchor='lm')
