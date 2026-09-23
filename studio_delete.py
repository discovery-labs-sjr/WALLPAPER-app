from pathlib import Path

from fastapi import Depends, HTTPException

from core import WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, app, require_csrf
from studio import ADMIN_EMAIL, SessionLocal, WallpaperAsset, UPLOAD_DIR, admin_user


@app.delete('/api/admin/wallpapers/{wallpaper_id}')
def studio_delete(wallpaper_id: str, _: None = Depends(require_csrf), user=Depends(admin_user)):
    with SessionLocal() as db:
        row = db.get(WallpaperAsset, wallpaper_id)
        if row is None:
            raise HTTPException(404, 'Wallpaper introuvable')
        db.delete(row)
        db.commit()

    for path in UPLOAD_DIR.glob(f'{wallpaper_id}.*'):
        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass

    WALLPAPER_BY_ID.pop(wallpaper_id, None)
    WALLPAPERS[:] = [item for item in WALLPAPERS if item.get('id') != wallpaper_id]
    WALLPAPER_IDS.discard(wallpaper_id)
    return {'ok': True, 'deleted_id': wallpaper_id}
