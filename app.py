import logging
from pathlib import Path

import core
app = core.app
import studio
import studio_extensions
import studio_delete
import studio_admins
import live_studio
from wallpaper_engine import prepare_mobile_wallpaper
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("wallverse.storage")

def _wallverse_mobile_enhance(data: bytes):
    result, meta = prepare_mobile_wallpaper(data)
    meta['original_size_bytes'] = len(data)
    meta['size_bytes'] = len(result)
    meta['saved_percent'] = round(max(0, 100 - (len(result) / max(1, len(data)) * 100)), 1)
    return result, meta

studio.enhance_image = _wallverse_mobile_enhance

def _sync_creator_assets() -> None:
    studio.load_assets()

@app.on_event('startup')
async def restore_creator_assets_on_startup():
    try:
        _sync_creator_assets()
        logger.info('Creator asset catalog restored from persistent storage')
    except Exception:
        logger.exception('Creator asset restore failed during startup')

@app.middleware('http')
async def sync_creator_assets(request: Request, call_next):
    path = request.url.path
    if path == '/api/wallpapers' or path.startswith('/api/wallpapers/'):
        try:
            _sync_creator_assets()
        except Exception:
            logger.exception('Creator asset sync failed for %s', path)
            return JSONResponse(status_code=503, content={'detail': 'Le stockage des wallpapers est temporairement indisponible.'})
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
