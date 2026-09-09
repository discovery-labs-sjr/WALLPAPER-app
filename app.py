from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import json
import mimetypes
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wallverse")
BASE = Path(__file__).resolve().parent
DATA = BASE / "wallpapers.json"
app = FastAPI(title="WallVerse", version="5.0.0")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
with DATA.open("r", encoding="utf-8") as file:
    WALLPAPERS = json.load(file)
for wallpaper in WALLPAPERS:
    path = BASE / wallpaper["file"].lstrip("/")
    if not path.exists(): logger.warning("Wallpaper %s introuvable: %s", wallpaper["id"], path)
@app.get("/", response_class=HTMLResponse)
def home():
    return (BASE / "static" / "index.html").read_text(encoding="utf-8")
@app.get("/api/wallpapers")
def get_wallpapers(): return WALLPAPERS
@app.get("/api/wallpapers/{wallpaper_id}/download")
def download_wallpaper(wallpaper_id: str):
    wallpaper = next((item for item in WALLPAPERS if item["id"] == wallpaper_id), None)
    if wallpaper is None: raise HTTPException(status_code=404, detail="Wallpaper introuvable")
    file_path = BASE / wallpaper["file"].lstrip("/")
    if not file_path.is_file(): raise HTTPException(status_code=404, detail="Image introuvable")
    media_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(file_path, media_type=media_type or "application/octet-stream", filename=f'{wallpaper["slug"]}{file_path.suffix or ".svg"}')
