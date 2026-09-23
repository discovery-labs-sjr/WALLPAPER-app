import logging
from pathlib import Path

import core
app = core.app
import studio
import studio_extensions
import studio_delete
import live_studio
from wallpaper_engine import prepare_mobile_wallpaper
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("wallverse.storage")

# Every Studio enhancement now produces a phone-ready master instead of merely
# sharpening the original dimensions. This keeps uploads consistent with the
# mobile-first WallVerse presentation.
def _wallverse_mobile_enhance(data: bytes):
    result, meta = prepare_mobile_wallpaper(data)
    meta['original_size_bytes'] = len(data)
    meta['size_bytes'] = len(result)
    meta['saved_percent'] = round(max(0, 100 - (len(result) / max(1, len(data)) * 100)), 1)
    return result, meta

studio.enhance_image = _wallverse_mobile_enhance


def _sync_creator_assets() -> None:
    """Make the database-backed creator catalogue authoritative.

    Render's web-service filesystem is ephemeral, so static/uploads is only a
    materialized cache. WallpaperAsset.image_bytes in the database is the
    durable source of truth.
    """
    studio.load_assets()


@app.on_event('startup')
async def restore_creator_assets_on_startup():
    try:
        _sync_creator_assets()
        logger.info('Creator asset catalog restored from persistent storage')
    except Exception:
        # Do not hide a broken persistence layer behind an apparently healthy
        # empty catalogue. The API middleware will fail closed as well.
        logger.exception('Creator asset restore failed during startup')


@app.middleware('http')
async def sync_creator_assets(request: Request, call_next):
    path = request.url.path

    # Always rebuild/materialize creator assets before the public wallpaper API
    # reads them. This handles worker restarts and ephemeral Render filesystems.
    if path == '/api/wallpapers' or path.startswith('/api/wallpapers/'):
        try:
            _sync_creator_assets()
        except Exception:
            logger.exception('Creator asset sync failed for %s', path)
            return JSONResponse(
                status_code=503,
                content={'detail': 'Le stockage des wallpapers est temporairement indisponible.'},
            )

    # If Render has removed an ephemeral upload file between two requests,
    # recreate it directly from WallpaperAsset before StaticFiles handles the
    # request. This makes the filesystem a cache, never the source of truth.
    elif path.startswith('/static/uploads/'):
        filename = Path(path).name
        wallpaper_id = filename.rsplit('.', 1)[0]
        try:
            with studio.SessionLocal() as db:
                row = db.get(studio.WallpaperAsset, wallpaper_id)
            if row is not None:
                studio.materialize(row)
        except Exception:
            logger.exception('Creator upload rematerialization failed for %s', path)

    return await call_next(request)
