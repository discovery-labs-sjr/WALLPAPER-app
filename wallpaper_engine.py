from __future__ import annotations

import io
from typing import Any

from PIL import Image, ImageEnhance, ImageFilter, ImageOps

# WallVerse mobile master: designed around modern tall phone displays.
MOBILE_WIDTH = 1080
MOBILE_HEIGHT = 2340
MOBILE_RATIO = MOBILE_WIDTH / MOBILE_HEIGHT

# A lightweight focal-point map. It is deliberately conservative: the goal is
# to preserve the important lower/central subject without pretending to know
# exact object bounding boxes when no vision model is available.
FOCAL_BY_CATEGORY = {
    'Voitures': (0.54, 0.62),
    'Animaux': (0.50, 0.56),
    'Sport': (0.50, 0.54),
    'Nature': (0.50, 0.50),
    'Espace': (0.50, 0.48),
    'Musique': (0.50, 0.55),
    'Ville & Nuit': (0.50, 0.52),
    'Technologie': (0.50, 0.52),
    'Art': (0.50, 0.50),
    'Anime': (0.50, 0.52),
    'Jeux vidéo': (0.50, 0.54),
    'Noir': (0.50, 0.50),
    'Aesthetic': (0.50, 0.50),
}


def _center_crop(im: Image.Image, size: tuple[int, int], center: tuple[float, float]) -> Image.Image:
    target_w, target_h = size
    src_w, src_h = im.size
    target_ratio = target_w / target_h
    src_ratio = src_w / src_h

    if abs(src_ratio - target_ratio) < 0.002:
        return im.resize(size, Image.Resampling.LANCZOS)

    if src_ratio > target_ratio:
        # Too wide: remove sides while keeping the chosen horizontal focal point.
        crop_h = src_h
        crop_w = round(src_h * target_ratio)
        cx = min(max(center[0], 0.0), 1.0) * src_w
        left = round(cx - crop_w / 2)
        left = max(0, min(left, src_w - crop_w))
        box = (left, 0, left + crop_w, src_h)
    else:
        # Too tall: remove top/bottom while keeping the chosen vertical focal point.
        crop_w = src_w
        crop_h = round(src_w / target_ratio)
        cy = min(max(center[1], 0.0), 1.0) * src_h
        top = round(cy - crop_h / 2)
        top = max(0, min(top, src_h - crop_h))
        box = (0, top, src_w, top + crop_h)

    return im.crop(box).resize(size, Image.Resampling.LANCZOS)


def prepare_mobile_wallpaper(
    data: bytes,
    category: str = 'Aesthetic',
    title: str = '',
    tags: list[str] | None = None,
) -> tuple[bytes, dict[str, Any]]:
    """Create a phone-ready 1080x2340 master without stretching the artwork."""
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert('RGB')
    original = im.size
    focal = FOCAL_BY_CATEGORY.get(category, (0.50, 0.50))

    # Small title/tag hints can gently move the crop for common compositions.
    text = ' '.join([title, *(tags or [])]).lower()
    if any(k in text for k in ('porsche', 'car', 'voiture', 'racing', 'supercar')):
        focal = (0.54, 0.64)
    elif any(k in text for k in ('elephant', 'lion', 'tiger', 'animal')):
        focal = (0.50, 0.56)

    im = _center_crop(im, (MOBILE_WIDTH, MOBILE_HEIGHT), focal)

    # Gentle finishing only; avoid the artificial over-sharpening look.
    im = ImageOps.autocontrast(im, cutoff=0.25)
    im = ImageEnhance.Color(im).enhance(1.025)
    im = im.filter(ImageFilter.UnsharpMask(radius=0.9, percent=72, threshold=3))

    out = io.BytesIO()
    im.save(out, format='WEBP', quality=94, method=6)
    result = out.getvalue()
    return result, {
        'original_width': original[0],
        'original_height': original[1],
        'width': MOBILE_WIDTH,
        'height': MOBILE_HEIGHT,
        'format': 'WEBP',
        'target': 'mobile-1080x2340',
        'crop': 'smart-focal',
        'focal_point': {'x': round(focal[0], 3), 'y': round(focal[1], 3)},
        'operations': [
            'orientation corrigée',
            'cadrage intelligent téléphone',
            'contraste optimisé',
            'couleurs équilibrées',
            'netteté légère',
            'WEBP haute qualité',
        ],
    }
