from __future__ import annotations

import json
import mimetypes
import os
import re
import secrets
from datetime import datetime, timezone

from fastapi import Depends, File, Form, HTTPException, UploadFile

from core import SessionLocal, WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, User, app, require_csrf
import studio
from studio import CATEGORIES, WallpaperAsset, UPLOAD_DIR, admin_user

LIVE_MAX_BYTES = int(os.getenv("WALLPAPER_LIVE_MAX_UPLOAD_MB", "30")) * 1048576
LIVE_MIMES = {"video/mp4", "video/webm", "video/quicktime"}
LIVE_EXTS = {".mp4", ".webm", ".mov"}


def _valid_video(data: bytes, filename: str, content_type: str | None) -> str:
    if not data:
        raise HTTPException(400, "Fichier Live vide")
    if len(data) > LIVE_MAX_BYTES:
        raise HTTPException(413, f"Vidéo trop lourde. Maximum : {LIVE_MAX_BYTES // 1048576} Mo")
    mime = (content_type or mimetypes.guess_type(filename)[0] or "").lower()
    suffix = os.path.splitext(filename.lower())[1]
    if mime not in LIVE_MIMES or suffix not in LIVE_EXTS:
        raise HTTPException(400, "Live accepté : MP4, WebM ou MOV")
    if mime == "video/mp4" and len(data) >= 12 and data[4:8] != b"ftyp":
        raise HTTPException(400, "Le fichier MP4 ne semble pas valide")
    if mime == "video/webm" and not data.startswith(b"\x1a\x45\xdf\xa3"):
        raise HTTPException(400, "Le fichier WebM ne semble pas valide")
    return mime


_original_materialize = studio.materialize


def _materialize_with_live_url(row: WallpaperAsset) -> dict:
    item = _original_materialize(row)
    if str(row.mime_type or "").lower().startswith("video/"):
        item["video"] = item["preview"]
    return item


studio.materialize = _materialize_with_live_url
# Re-run existing asset materialization so video rows receive their media URL after restart.
studio.load_assets()


@app.post("/api/admin/live/upload")
async def live_upload(
    image: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("Aesthetic"),
    tags: str = Form(""),
    media_width: int = Form(1080),
    media_height: int = Form(2340),
    _: None = Depends(require_csrf),
    user: User = Depends(admin_user),
):
    title = title.strip()
    if not title:
        raise HTTPException(400, "Titre requis")
    if category not in CATEGORIES:
        raise HTTPException(400, "Catégorie invalide")
    if media_width <= 0 or media_height <= 0 or media_width > 20000 or media_height > 20000:
        raise HTTPException(400, "Dimensions Live invalides")

    data = await image.read()
    mime = _valid_video(data, image.filename or "wallpaper.mp4", image.content_type)
    wid = f'wv-live-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(3)}'
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80] or "live-wallpaper"
    clean_tags = list(dict.fromkeys(x.strip() for x in tags.split(",") if x.strip()))[:12]

    row = WallpaperAsset(
        id=wid,
        slug=f"{slug}-{wid[-6:]}",
        title=title,
        category=category,
        tags_json=json.dumps(clean_tags, ensure_ascii=False),
        wallpaper_type="live",
        mime_type=mime,
        width=media_width,
        height=media_height,
        size_bytes=len(data),
        image_bytes=data,
    )
    try:
        with SessionLocal() as db:
            db.add(row)
            db.commit()
            db.refresh(row)
    except Exception as exc:
        raise HTTPException(500, "Publication Live impossible : erreur de stockage") from exc

    ext = mimetypes.guess_extension(mime) or ".mp4"
    path = UPLOAD_DIR / f"{row.id}{ext}"
    path.write_bytes(data)
    public = f"/static/uploads/{path.name}"
    item = {
        "id": row.id,
        "slug": row.slug,
        "title": row.title,
        "category": row.category,
        "tags": clean_tags,
        "type": "live",
        "preview": public,
        "file": public,
        "video": public,
        "source": "creator",
        "width": row.width,
        "height": row.height,
        "size_bytes": row.size_bytes,
    }
    WALLPAPERS.append(item)
    WALLPAPER_BY_ID[row.id] = item
    WALLPAPER_IDS.add(row.id)
    return {"ok": True, "wallpaper": item}
