from __future__
import io, json, mimetypes, os, re, secrets
from datetime import datetime, timezone
from typing import Any
import httpx
from fastapi import Cookie, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from PIL import Image, ImageFilter, ImageStat
from sqlalchemy import DateTime, Integer, LargeBinary, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column
from core import BASE, Base, SessionLocal, User, WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, app, current_user, engine, require_csrf

ADMIN_EMAIL=os.getenv('ADMIN_EMAIL','').strip().lower()
UPLOAD_DIR=BASE/'static'/'uploads'; UPLOAD_DIR.mkdir(parents=True,exist_ok=True)
MAX_BYTES=int(os.getenv('WALLPAPER_MAX_UPLOAD_MB','20'))*1048576
MIN_LONG=int(os.getenv('WALLPAPER_MIN_LONG_SIDE','2400')); MIN_SHORT=int(os.getenv('WALLPAPER_MIN_SHORT_SIDE','1440'))
CATEGORIES=['Aesthetic','Nature','Voitures','Animaux','Sport','Musique','Espace','Noir','Ville & Nuit','Technologie','Art','Anime','Jeux vidéo']
KEYWORDS={'Voitures':['car','vehicle','truck','taxi','jeep','racing'],'Animaux':['dog','cat','horse','tiger','lion','bear','wolf','fox','bird','fish','snake','rabbit','elephant'],'Sport':['basketball','soccer','football','tennis','golf','baseball','volleyball','bicycle','skateboard','surfboard','ski'],'Nature':['mountain','forest','tree','flower','garden','beach','coast','sunset','sunrise','waterfall','desert','lake','valley','volcano'],'Espace':['space','planet','earth','moon','star','astronaut','galaxy','nebula','cosmos'],'Musique':['guitar','microphone','drum','piano','violin','sax'],'Technologie':['computer','laptop','keyboard','monitor','smartphone','camera','robot','server'],'Ville & Nuit':['street','skyscraper','building','city','bridge','subway','traffic light'],'Art':['painting','sculpture','art','drawing','portrait'],'Noir':['black','dark','shadow','silhouette']}
class WallpaperAsset(Base):
    __tablename__='wallpaper_assets'
    id:Mapped[str]=mapped_column(String(80),primary_key=True); slug:Mapped[str]=mapped_column(String(120),unique=True,index=True); title:Mapped[str]=mapped_column(String(180)); category:Mapped[str]=mapped_column(String(80)); tags_json:Mapped[str]=mapped_column(Text,default='[]'); wallpaper_type:Mapped[str]=mapped_column(String(20),default='static'); mime_type:Mapped[str]=mapped_column(String(100)); width:Mapped[int]=mapped_column(Integer); height:Mapped[int]=mapped_column(Integer); size_bytes:Mapped[int]=mapped_column(Integer); image_bytes:Mapped[bytes]=mapped_column(LargeBinary); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc))
WallpaperAsset.__table__.create(bind=engine,checkfirst=True)
def admin_user(wallverse_access:str|None=Cookie(default=None,alias='wallverse_access'))->User:
    if not ADMIN_EMAIL: raise HTTPException(503,'Studio créateur non configuré : ADMIN_EMAIL manque dans Render')
    with SessionLocal() as db:
        user=current_user(db,wallverse_access)
        if not user or user.email.lower()!=ADMIN_EMAIL: raise HTTPException(403,'Accès créateur refusé')
        return user
def check_image(data:bytes,name:str)->dict[str,Any]:
    if len(data)>MAX_BYTES: raise HTTPException(413,f'Image trop lourde. Maximum : {MAX_BYTES//1048576} Mo')
    try: im=Image.open(io.BytesIO(data)); im.verify(); im=Image.open(io.BytesIO(data)).convert('RGB')
    except Exception as exc: raise HTTPException(400,'Image invalide ou non prise en charge') from exc
    w,h=im.size; long,short=max(w,h),min(w,h)
    if long<MIN_LONG or short<MIN_SHORT: raise HTTPException(400,f'Résolution insuffisante : minimum {MIN_SHORT}×{MIN_LONG}px')
    sample=im.copy(); sample.thumbnail((900,900)); edge=ImageStat.Stat(sample.convert('L').filter(ImageFilter.FIND_EDGES)).mean[0]
    if edge<18: raise HTTPException(400,'Image possiblement trop floue : ajoute un original plus net')
    fmt=Image.open(io.BytesIO(data)).format; mime=Image.MIME.get(fmt)
    if mime not in {'image/jpeg','image/png','image/webp'}: raise HTTPException(400,'Formats acceptés : JPG, PNG ou WEBP')
    return {'width':w,'height':h,'size_bytes':len(data),'mime_type':mime,'quality_score':round(min(100,(long/MIN_LONG)*55+(short/MIN_SHORT)*45),1)}
def smart_category(title:str,name:str,tags:list[str])->tuple[str,float]:
    hay=' '.join([title,name,*tags]).lower();scores={c:sum(k in hay for k in ks) for c,ks in KEYWORDS.items()};cat,score=max(scores.items(),key=lambda x:x[1]);return (cat,min(.94,.45+score*.14)) if score else ('Aesthetic',.38)
async def ai_category(data:bytes)->tuple[str|None,float]:
    token=os.getenv('HF_TOKEN','').strip()
    if not token:return None,0
    model=os.getenv('HF_IMAGE_MODEL','google/vit-base-patch16-224').strip();url=f'https://router.huggingface.co/hf-inference/models/{model}'
    try:
        async with httpx.AsyncClient(timeout=35) as c:
            r=await c.post(url,content=data,headers={'Authorization':f'Bearer {token}','Content-Type':'application/octet-stream'},params={'top_k':8})
            if r.status_code>=400:return None,0
            out=r.json()
    except (httpx.HTTPError,ValueError):return None,0
    best=None;score=0
    for row in out if isinstance(out,list) else []:
        label=str(row.get('label','')).lower();s=float(row.get('score',0))
        for cat,ks in KEYWORDS.items():
            if any(k in label for k in ks) and s>score:best,score=cat,s
    return best,score
def materialize(row:WallpaperAsset)->dict[str,Any]:
    ext=mimetypes.guess_extension(row.mime_type) or '.jpg';path=UPLOAD_DIR/f'{row.id}{ext}'
    if not path.exists() or path.stat().st_size!=row.size_bytes:path.write_bytes(row.image_bytes)
    public=f'/static/uploads/{path.name}';return {'id':row.id,'slug':row.slug,'title':row.title,'category':row.category,'tags':json.loads(row.tags_json or '[]'),'type':row.wallpaper_type,'preview':public,'file':public,'source':'creator','width':row.width,'height':row.height,'size_bytes':row.size_bytes}
def load_assets():
    with SessionLocal() as db:rows=db.scalars(select(WallpaperAsset).order_by(WallpaperAsset.created_at.desc())).all()
    for row in rows:
        x=materialize(row)
        if row.id in WALLPAPER_BY_ID:WALLPAPER_BY_ID[row.id].update(x)
        else:WALLPAPERS.append(x);WALLPAPER_BY_ID[row.id]=x;WALLPAPER_IDS.add(row.id)
@app.get('/admin',response_class=HTMLResponse)
def studio_page():return (BASE/'static/admin.html').read_text(encoding='utf-8')
@app.get('/api/admin/me')
def studio_me(user:User=Depends(admin_user)):return {'ok':True,'email':user.email,'categories':CATEGORIES}
@app.get('/api/admin/wallpapers')
def studio_list(user:User=Depends(admin_user)):
    with SessionLocal() as db:rows=db.scalars(select(WallpaperAsset).order_by(WallpaperAsset.created_at.desc())).all()
    return [materialize(r) for r in rows]
@app.post('/api/admin/analyze')
async def studio_analyze(image:UploadFile=File(...),title:str=Form(''),tags:str=Form(''),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    data=await image.read();q=check_image(data,image.filename or 'wallpaper.jpg');taglist=[x.strip() for x in tags.split(',') if x.strip()][:12];cat,conf=smart_category(title,image.filename or '',taglist);ai,ais=await ai_category(data)
    if ai:cat,conf=ai,ais
    return {'ok':True,'quality':q,'category':cat,'confidence':round(conf*100),'source':'vision' if ai else 'smart-fallback'}
@app.post('/api/admin/wallpapers/upload')
async def studio_upload(image:UploadFile=File(...),title:str=Form(...),category:str=Form('Aesthetic'),tags:str=Form(''),wallpaper_type:str=Form('static'),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    title=title.strip()
    if not title:raise HTTPException(400,'Titre requis')
    if category not in CATEGORIES:raise HTTPException(400,'Catégorie invalide')
    if wallpaper_type not in {'static','live'}:raise HTTPException(400,'Type invalide')
    data=await image.read();q=check_image(data,image.filename or 'wallpaper.jpg');wid=f'wv-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(3)}';slug=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')[:80] or 'wallpaper';row=WallpaperAsset(id=wid,slug=f'{slug}-{wid[-6:]}',title=title,category=category,tags_json=json.dumps([x.strip() for x in tags.split(',') if x.strip()][:12],ensure_ascii=False),wallpaper_type=wallpaper_type,mime_type=q['mime_type'],width=q['width'],height=q['height'],size_bytes=q['size_bytes'],image_bytes=data)
    with SessionLocal() as db:db.add(row);db.commit();db.refresh(row)
    x=materialize(row);WALLPAPERS.append(x);WALLPAPER_BY_ID[row.id]=x;WALLPAPER_IDS.add(row.id)
    return {'ok':True,'wallpaper':x,'quality':q}
load_assets()
