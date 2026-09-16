import core
app = core.app
import studio
import live_studio
from wallpaper_engine import prepare_mobile_wallpaper
from fastapi import Request

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

# Creator uploads are stored in the database. Re-sync them before wallpaper
# API responses so a restarted worker or stale in-memory catalog cannot make a
# previously published wallpaper disappear from the public gallery.
@app.middleware('http')
async def sync_creator_assets(request: Request, call_next):
    if request.url.path == '/api/wallpapers' or request.url.path.startswith('/api/wallpapers/'):
        try:
            studio.load_assets()
        except Exception as exc:
            core.app.logger.exception('Creator asset sync failed: %s', exc) if hasattr(core.app, 'logger') else None
    return await call_next(request)
