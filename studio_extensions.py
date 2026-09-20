from __future__ import annotations

import io
import json
import re
import secrets
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, File, Form, HTTPException, UploadFile
from PIL import Image

import studio
from core import WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, app, require_csrf

# The profile rail needs its own explicit category while keeping the existing
# wallpaper categories intact for the home gallery.
if 'Profils' not in studio.CATEGORIES:
    studio.CATEGORIES.append('Profils')

BATCH_MAX_FILES = 20
PROFILE_MIN_SIDE = 256


def _filename_title(filename: str) -> str:
    base = re.sub(r'\.[^.]+$', '', filename or '')
    base = re.sub(r'[_\-.]+', ' ', base)
    base = re.sub(r'\b(copy|final|img|image|photo|wallpaper|wallpapers|4k|8k|uhd|hd)\b', ' ', base, flags=re.I)
    base = re.sub(r'\s+', ' ', base).strip()
    if not base:
        return 'Nouveau contenu'
    return base[:1].upper() + base[1:180]


def _profile_quality(data: bytes, filename: str) -> dict[str, Any]:
    if len(data) > studio.MAX_BYTES:
        raise HTTPException(413, f'Fichier trop lourd. Maximum : {studio.MAX_BYTES // 1048576} Mo')
    try:
        with Image.open(io.BytesIO(data)) as probe:
            width, height = probe.size
            mime = Image.MIME.get(probe.format)
    except Exception as exc:
        raise HTTPException(400, 'Image de profil invalide ou non prise en charge') from exc
    if mime not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(400, 'Formats acceptés : JPG, PNG ou WEBP')
    if min(width, height) < PROFILE_MIN_SIDE:
        raise HTTPException(400, f'Image de profil trop petite : minimum {PROFILE_MIN_SIDE}×{PROFILE_MIN_SIDE}px')
    return {
        'width': width,
        'height': height,
        'size_bytes': len(data),
        'mime_type': mime,
        'quality_score': round(min(100, (max(width, height) / 1080) * 55 + (min(width, height) / 1080) * 45), 1),
    }


def _platform_tags(target_platform: str) -> list[str]:
    return {
        'mobile': ['plateforme:mobile'],
        'desktop': ['plateforme:ordinateur'],
        'both': ['plateforme:mobile', 'plateforme:ordinateur'],
    }.get(target_platform, ['plateforme:mobile'])


@app.post('/api/admin/wallpapers/batch-upload')
async def studio_batch_upload(
    files: list[UploadFile] = File(...),
    content_kind: str = Form('wallpaper'),
    target_platform: str = Form('mobile'),
    category: str = Form('Aesthetic'),
    enhance: str = Form('true'),
    _: None = Depends(require_csrf),
    user=Depends(studio.admin_user),
):
    if not files:
        raise HTTPException(400, 'Sélectionne au moins une image')
    if len(files) > BATCH_MAX_FILES:
        raise HTTPException(400, f'Maximum {BATCH_MAX_FILES} fichiers par lot')
    if content_kind not in {'wallpaper', 'profile'}:
        raise HTTPException(400, 'Type de contenu invalide')
    if target_platform not in {'mobile', 'desktop', 'both'}:
        raise HTTPException(400, 'Plateforme invalide')
    if category not in studio.CATEGORIES and content_kind != 'profile':
        raise HTTPException(400, 'Catégorie invalide')

    results: list[dict[str, Any]] = []
    use_enhance = enhance.lower() in {'1', 'true', 'yes', 'on'}

    for upload in files:
        filename = upload.filename or 'wallverse-image.jpg'
        try:
            data = await upload.read()
            if content_kind == 'profile':
                quality = _profile_quality(data, filename)
            else:
                quality = studio.check_image(data, filename)

            ai = await studio.ai_metadata(data) if content_kind == 'wallpaper' else {
                'title': None, 'tags': [], 'category': None, 'confidence': 0, 'caption': None
            }
            title = ai.get('title') or _filename_title(filename)
            tags = list(dict.fromkeys([*(ai.get('tags') or []), *(_platform_tags(target_platform))]))[:12]
            final_category = 'Profils' if content_kind == 'profile' else (ai.get('category') or category)
            if content_kind == 'profile':
                tags = list(dict.fromkeys(['profil', 'whatsapp', *tags]))[:12]

            enhancement = None
            # The current app-level enhancer is mobile-oriented. Do not apply
            # it to desktop-only assets or square profile images.
            if use_enhance and content_kind == 'wallpaper' and target_platform in {'mobile', 'both'}:
                data, enhancement = studio.enhance_image(data)
                quality = studio.check_image(data, filename)

            wallpaper_id = f'wv-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(3)}'
            slug_base = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:80] or 'wallpaper'
            row = studio.WallpaperAsset(
                id=wallpaper_id,
                slug=f'{slug_base}-{wallpaper_id[-6:]}',
                title=title,
                category=final_category,
                tags_json=json.dumps(tags, ensure_ascii=False),
                wallpaper_type='static',
                mime_type=quality['mime_type'],
                width=quality['width'],
                height=quality['height'],
                size_bytes=quality['size_bytes'],
                image_bytes=data,
            )
            with studio.SessionLocal() as db:
                db.add(row)
                db.commit()
                db.refresh(row)

            asset = studio.materialize(row)
            WALLPAPERS.append(asset)
            WALLPAPER_BY_ID[row.id] = asset
            WALLPAPER_IDS.add(row.id)
            results.append({'ok': True, 'filename': filename, 'wallpaper': asset, 'enhancement': enhancement})
        except HTTPException as exc:
            results.append({'ok': False, 'filename': filename, 'error': exc.detail})
        except Exception:
            results.append({'ok': False, 'filename': filename, 'error': 'Publication impossible pour ce fichier'})

    return {
        'ok': any(item['ok'] for item in results),
        'published': sum(1 for item in results if item['ok']),
        'failed': sum(1 for item in results if not item['ok']),
        'results': results,
    }
