from __future__ import annotations

import io
import json
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, File, Form, HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy import select

import studio
from core import WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, app, require_csrf

PROFILE_CATEGORY = 'Profils'
PROFILE_MAX_BYTES = 20 * 1048576
PROFILE_MIN_SIDE = 256
PROFILE_CROP_MODES = {'square', 'portrait', 'original'}


def _profile_image(data: bytes, crop_mode: str) -> tuple[bytes, dict[str, Any]]:
    if len(data) > PROFILE_MAX_BYTES:
        raise HTTPException(413, 'Image trop lourde. Maximum : 20 Mo')
    try:
        source = Image.open(io.BytesIO(data))
        source.verify()
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    except Exception as exc:
        raise HTTPException(400, 'Image de profil invalide') from exc

    if min(image.size) < PROFILE_MIN_SIDE:
        raise HTTPException(400, f'Image trop petite. Minimum : {PROFILE_MIN_SIDE}×{PROFILE_MIN_SIDE}px')
    if crop_mode not in PROFILE_CROP_MODES:
        raise HTTPException(400, 'Mode de cadrage invalide')

    original_size = image.size
    if crop_mode == 'square':
        side = min(image.size)
        image = ImageOps.fit(image, (side, side), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    elif crop_mode == 'portrait':
        target_ratio = 4 / 5
        width, height = image.size
        current_ratio = width / height
        if current_ratio > target_ratio:
            crop_width = round(height * target_ratio)
            left = (width - crop_width) // 2
            image = image.crop((left, 0, left + crop_width, height))
        else:
            crop_height = round(width / target_ratio)
            top = (height - crop_height) // 2
            image = image.crop((0, top, width, top + crop_height))

    output = io.BytesIO()
    image.save(output, format='WEBP', quality=94, method=6)
    result = output.getvalue()
    return result, {
        'original_width': original_size[0],
        'original_height': original_size[1],
        'width': image.width,
        'height': image.height,
        'crop_mode': crop_mode,
        'format': 'WEBP',
        'size_bytes': len(result),
    }


def _append_asset(row: studio.WallpaperAsset) -> dict[str, Any]:
    item = studio.materialize(row)
    WALLPAPERS.append(item)
    WALLPAPER_BY_ID[row.id] = item
    WALLPAPER_IDS.add(row.id)
    return item


@app.get('/api/profiles')
def profile_catalog():
    with studio.SessionLocal() as db:
        rows = db.scalars(
            select(studio.WallpaperAsset)
            .where(studio.WallpaperAsset.category == PROFILE_CATEGORY)
            .order_by(studio.WallpaperAsset.created_at.desc())
        ).all()
    return [studio.materialize(row) for row in rows]


@app.post('/api/admin/content/batch-upload')
async def batch_content_upload(
    files: list[UploadFile] = File(...),
    content_kind: str = Form('profile'),
    target_platform: str = Form('mobile'),
    category: str = Form(PROFILE_CATEGORY),
    crop_mode: str = Form('square'),
    enhance: str = Form('true'),
    _: None = Depends(require_csrf),
    user=Depends(studio.admin_user),
):
    del target_platform
    if not files:
        raise HTTPException(400, 'Aucune image sélectionnée')
    if len(files) > 20:
        raise HTTPException(400, 'Maximum : 20 images par lot')
    if content_kind not in {'profile', 'wallpaper'}:
        raise HTTPException(400, 'Type de contenu invalide')
    if content_kind == 'profile':
        category = PROFILE_CATEGORY
        if crop_mode not in PROFILE_CROP_MODES:
            raise HTTPException(400, 'Mode de cadrage invalide')
    elif category not in studio.CATEGORIES:
        raise HTTPException(400, 'Catégorie invalide')

    published = []
    failures = []
    use_enhance = enhance.lower() in {'1', 'true', 'yes', 'on'}

    for index, upload in enumerate(files, start=1):
        try:
            raw = await upload.read()
            if content_kind == 'profile':
                data, meta = _profile_image(raw, crop_mode)
                width, height = meta['width'], meta['height']
                mime_type = 'image/webp'
                title = 'Profil WALLVERSE'
            else:
                quality = studio.check_image(raw, upload.filename or 'wallpaper.jpg')
                data = raw
                if use_enhance:
                    data, _ = studio.enhance_image(data)
                    quality = studio.check_image(data, upload.filename or 'wallpaper.webp')
                width, height = quality['width'], quality['height']
                mime_type = quality['mime_type']
                title = 'WALLVERSE'

            wallpaper_id = f'wv-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(3)}'
            row = studio.WallpaperAsset(
                id=wallpaper_id,
                slug=f'asset-{wallpaper_id[-6:]}',
                title=title,
                category=category,
                tags_json=json.dumps([], ensure_ascii=False),
                wallpaper_type='static',
                mime_type=mime_type,
                width=width,
                height=height,
                size_bytes=len(data),
                image_bytes=data,
            )
            with studio.SessionLocal() as db:
                db.add(row)
                db.commit()
                db.refresh(row)
            published.append(_append_asset(row))
        except HTTPException as exc:
            failures.append({'index': index, 'name': upload.filename or f'Image {index}', 'error': str(exc.detail)})
        except Exception:
            failures.append({'index': index, 'name': upload.filename or f'Image {index}', 'error': 'Publication impossible pour cette image'})

    return {
        'ok': not failures,
        'published': len(published),
        'failed': len(failures),
        'items': published,
        'failures': failures,
    }
