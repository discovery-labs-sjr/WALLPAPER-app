import core
app = core.app
import studio
from wallpaper_engine import prepare_mobile_wallpaper

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
