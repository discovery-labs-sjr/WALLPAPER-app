from __future__ import annotations
import base64, io, json, mimetypes, os, re, secrets
from datetime import datetime, timezone
from typing import Any
import httpx
from fastapi import Cookie, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from PIL import Image, ImageFilter, ImageStat, ImageOps
from sqlalchemy import DateTime, Integer, LargeBinary, String, Text, select
from sqlalchemy.orm import Mapped, mapped_column
from core import BASE, Base, SessionLocal, User, WALLPAPER_BY_ID, WALLPAPERS, WALLPAPER_IDS, app, current_user, engine, require_csrf

ADMIN_EMAIL=os.getenv('ADMIN_EMAIL','').strip().lower()
UPLOAD_DIR=BASE/'static'/'uploads'; UPLOAD_DIR.mkdir(parents=True,exist_ok=True)
MAX_BYTES=int(os.getenv('WALLPAPER_MAX_UPLOAD_MB','20'))*1048576
# Seuil plus accessible pour les wallpapers mobiles : 1200x2000 minimum.
MIN_LONG=int(os.getenv('WALLPAPER_MIN_LONG_SIDE','2000')); MIN_SHORT=int(os.getenv('WALLPAPER_MIN_SHORT_SIDE','1200'))
ENHANCE_MAX_LONG=int(os.getenv('WALLPAPER_ENHANCE_MAX_LONG_SIDE','4096'))
CATEGORIES=['Aesthetic','Nature','Voitures','Animaux','Sport','Musique','Espace','Noir','Ville & Nuit','Technologie','Art','Anime','Jeux vidéo']
KEYWORDS={'Voitures':['car','vehicle','truck','taxi','jeep','racing','automobile','supercar','sports car'],'Animaux':['dog','cat','horse','tiger','lion','bear','wolf','fox','bird','fish','snake','rabbit','elephant'],'Sport':['basketball','soccer','football','tennis','golf','baseball','volleyball','bicycle','skateboard','surfboard','ski'],'Nature':['mountain','forest','tree','flower','garden','beach','coast','sunset','sunrise','waterfall','desert','lake','valley','volcano','ocean'],'Espace':['space','planet','earth','moon','star','astronaut','galaxy','nebula','cosmos'],'Musique':['guitar','microphone','drum','piano','violin','sax'],'Technologie':['computer','laptop','keyboard','monitor','smartphone','camera','robot','server','phone'],'Ville & Nuit':['street','skyscraper','building','city','bridge','subway','traffic light','gas station','station'],'Art':['painting','sculpture','art','drawing','portrait'],'Noir':['black','dark','shadow','silhouette']}
TAG_SYNONYMS={'car':'voiture','vehicle':'automobile','sports car':'sport','supercar':'supercar','racing':'racing','gas station':'station-service','night':'nuit','sunset':'coucher de soleil','sunrise':'lever de soleil','mountain':'montagne','forest':'forêt','beach':'plage','ocean':'océan','city':'ville','street':'rue','building':'architecture','dog':'chien','cat':'chat','horse':'cheval','tiger':'tigre','lion':'lion','wolf':'loup','bird':'oiseau','space':'espace','planet':'planète','moon':'lune','galaxy':'galaxie','star':'étoile','guitar':'guitare','microphone':'micro','computer':'ordinateur','laptop':'portable','smartphone':'smartphone','robot':'robot','black':'noir','dark':'sombre'}
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
def open_image(data:bytes)->Image.Image:
    try:
        im=Image.open(io.BytesIO(data)); im.verify(); im=Image.open(io.BytesIO(data)); im=ImageOps.exif_transpose(im).convert('RGB')
        return im
    except Exception as exc: raise HTTPException(400,'Image invalide ou non prise en charge') from exc
def check_image(data:bytes,name:str)->dict[str,Any]:
    if len(data)>MAX_BYTES: raise HTTPException(413,f'Image trop lourde. Maximum : {MAX_BYTES//1048576} Mo')
    im=open_image(data); w,h=im.size; long,short=max(w,h),min(w,h)
    if long<MIN_LONG or short<MIN_SHORT: raise HTTPException(400,f'Résolution insuffisante : minimum {MIN_SHORT}×{MIN_LONG}px')
    sample=im.copy(); sample.thumbnail((900,900)); edge=ImageStat.Stat(sample.convert('L').filter(ImageFilter.FIND_EDGES)).mean[0]
    if edge<18: raise HTTPException(400,'Image possiblement trop floue : ajoute un original plus net')
    fmt=Image.open(io.BytesIO(data)).format; mime=Image.MIME.get(fmt)
    if mime not in {'image/jpeg','image/png','image/webp'}: raise HTTPException(400,'Formats acceptés : JPG, PNG ou WEBP')
    return {'width':w,'height':h,'size_bytes':len(data),'mime_type':mime,'quality_score':round(min(100,(long/MIN_LONG)*55+(short/MIN_SHORT)*45),1)}
def enhance_image(data:bytes)->tuple[bytes,dict[str,Any]]:
    im=open_image(data); original_size=im.size; max_side=max(im.size)
    if max_side>ENHANCE_MAX_LONG:
        ratio=ENHANCE_MAX_LONG/max_side; im=im.resize((round(im.width*ratio),round(im.height*ratio)),Image.Resampling.LANCZOS)
    im=ImageOps.autocontrast(im,cutoff=0.35); im=im.filter(ImageFilter.UnsharpMask(radius=1.15,percent=105,threshold=3))
    out=io.BytesIO(); im.save(out,format='WEBP',quality=94,method=6); result=out.getvalue()
    return result,{'original_width':original_size[0],'original_height':original_size[1],'width':im.width,'height':im.height,'original_size_bytes':len(data),'size_bytes':len(result),'format':'WEBP','saved_percent':round(max(0,100-(len(result)/max(1,len(data))*100)),1),'operations':['orientation corrigée','contraste optimisé','netteté renforcée','compression WEBP haute qualité']}
def smart_category(title:str,name:str,tags:list[str])->tuple[str,float]:
    hay=' '.join([title,name,*tags]).lower(); scores={c:sum(k in hay for k in ks) for c,ks in KEYWORDS.items()}; cat,score=max(scores.items(),key=lambda x:x[1]); return (cat,min(.94,.45+score*.14)) if score else ('Aesthetic',.38)
def tags_from_text(text:str,limit:int=12)->list[str]:
    low=text.lower(); found=[]
    for key,val in TAG_SYNONYMS.items():
        if key in low and val not in found: found.append(val)
    for cat,keys in KEYWORDS.items():
        if any(k in low for k in keys) and cat.lower() not in [x.lower() for x in found]: found.append(cat)
    return found[:limit]
def title_from_caption(caption:str)->str:
    words=re.sub(r'[^\w\s-]',' ',caption,flags=re.UNICODE).split()
    if not words:return 'Nouveau wallpaper'
    # Titre court et éditorial, basé sur les éléments réellement vus dans la légende IA.
    stop={'a','an','the','of','and','with','in','on','at','is','there','this','that'}
    picked=[w for w in words if w.lower() not in stop][:7]
    return ' '.join(picked).strip().capitalize()[:180] or 'Nouveau wallpaper'
async def ai_metadata(data:bytes)->dict[str,Any]:
    token=os.getenv('HF_TOKEN','').strip()
    if not token:return {'caption':None,'title':None,'tags':[],'category':None,'confidence':0}
    caption_model=os.getenv('HF_CAPTION_MODEL','Salesforce/blip-image-captioning-base').strip(); cls_model=os.getenv('HF_IMAGE_MODEL','google/vit-base-patch16-224').strip()
    headers={'Authorization':f'Bearer {token}','Content-Type':'application/octet-stream'}
    caption=None; labels=[]
    try:
        async with httpx.AsyncClient(timeout=45) as c:
            r=await c.post(f'https://router.huggingface.co/hf-inference/models/{caption_model}',content=data,headers=headers)
            if r.status_code<400:
                out=r.json(); caption=(out[0].get('generated_text') if isinstance(out,list) and out else None)
            r=await c.post(f'https://router.huggingface.co/hf-inference/models/{cls_model}',content=data,headers=headers,params={'top_k':8})
            if r.status_code<400:
                out=r.json(); labels=[str(x.get('label','')) for x in out if isinstance(x,dict)] if isinstance(out,list) else []
    except (httpx.HTTPError,ValueError):
        return {'caption':None,'title':None,'tags':[],'category':None,'confidence':0}
    text=' '.join([caption or '',*labels]); tags=tags_from_text(text)
    cat,conf=smart_category('',text,tags)
    return {'caption':caption,'title':title_from_caption(caption) if caption else None,'tags':tags,'category':cat if tags else None,'confidence':round(conf*100)}
def materialize(row:WallpaperAsset)->dict[str,Any]:
    ext=mimetypes.guess_extension(row.mime_type) or '.jpg'; path=UPLOAD_DIR/f'{row.id}{ext}'
    if not path.exists() or path.stat().st_size!=row.size_bytes:path.write_bytes(row.image_bytes)
    public=f'/static/uploads/{path.name}'; return {'id':row.id,'slug':row.slug,'title':row.title,'category':row.category,'tags':json.loads(row.tags_json or '[]'),'type':row.wallpaper_type,'preview':public,'file':public,'source':'creator','width':row.width,'height':row.height,'size_bytes':row.size_bytes}
def load_assets():
    with SessionLocal() as db:rows=db.scalars(select(WallpaperAsset).order_by(WallpaperAsset.created_at.desc())).all()
    for row in rows:
        x=materialize(row)
        if row.id in WALLPAPER_BY_ID:WALLPAPER_BY_ID[row.id].update(x)
        else:WALLPAPERS.append(x);WALLPAPER_BY_ID[row.id]=x;WALLPAPER_IDS.add(row.id)
@app.get('/admin',response_class=HTMLResponse)
def studio_page():return (BASE/'static/admin.html').read_text(encoding='utf-8')
@app.get('/api/admin/me')
def studio_me(user:User=Depends(admin_user)):return {'ok':True,'email':user.email,'categories':CATEGORIES,'enhancement':{'enabled':True,'max_long_side':ENHANCE_MAX_LONG},'ai_metadata':bool(os.getenv('HF_TOKEN','').strip())}
@app.get('/api/admin/wallpapers')
def studio_list(user:User=Depends(admin_user)):
    with SessionLocal() as db:rows=db.scalars(select(WallpaperAsset).order_by(WallpaperAsset.created_at.desc())).all()
    return [materialize(r) for r in rows]
@app.post('/api/admin/analyze')
async def studio_analyze(image:UploadFile=File(...),title:str=Form(''),tags:str=Form(''),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    data=await image.read(); q=check_image(data,image.filename or 'wallpaper.jpg'); taglist=[x.strip() for x in tags.split(',') if x.strip()][:12]
    ai=await ai_metadata(data); smartcat,smartconf=smart_category(title,image.filename or '',taglist)
    category=ai['category'] or smartcat; confidence=ai['confidence'] or round(smartconf*100); suggested_title=ai['title'] or title.strip() or None
    suggested_tags=list(dict.fromkeys([*ai['tags'],*taglist]))[:12]
    return {'ok':True,'quality':q,'category':category,'confidence':confidence,'source':'vision' if ai['category'] else 'smart-fallback','suggested_title':suggested_title,'suggested_tags':suggested_tags,'caption':ai['caption']}
@app.post('/api/admin/enhance')
async def studio_enhance(image:UploadFile=File(...),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    data=await image.read(); check_image(data,image.filename or 'wallpaper.jpg'); result,meta=enhance_image(data)
    return {'ok':True,'enhancement':meta,'mime_type':'image/webp','preview_data':'data:image/webp;base64,'+base64.b64encode(result).decode('ascii')}
@app.post('/api/admin/wallpapers/upload')
async def studio_upload(image:UploadFile=File(...),title:str=Form(...),category:str=Form('Aesthetic'),tags:str=Form(''),wallpaper_type:str=Form('static'),enhance:str=Form('true'),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    title=title.strip()
    if not title:raise HTTPException(400,'Titre requis')
    if category not in CATEGORIES:raise HTTPException(400,'Catégorie invalide')
    if wallpaper_type not in {'static','live'}:raise HTTPException(400,'Type invalide')
    data=await image.read(); q=check_image(data,image.filename or 'wallpaper.jpg'); enhanced=enhance.lower() in {'1','true','yes','on'}; enhance_meta=None
    if enhanced:
        data,enhance_meta=enhance_image(data); q=check_image(data,image.filename or 'wallpaper.webp')
    wid=f'wv-{datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(3)}'; slug=re.sub(r'[^a-z0-9]+','-',title.lower()).strip('-')[:80] or 'wallpaper'
    clean_tags=list(dict.fromkeys([x.strip() for x in tags.split(',') if x.strip()]))[:12]
    row=WallpaperAsset(id=wid,slug=f'{slug}-{wid[-6:]}',title=title,category=category,tags_json=json.dumps(clean_tags,ensure_ascii=False),wallpaper_type=wallpaper_type,mime_type=q['mime_type'],width=q['width'],height=q['height'],size_bytes=q['size_bytes'],image_bytes=data)
    try:
        with SessionLocal() as db:db.add(row);db.commit();db.refresh(row)
    except Exception as exc:
        raise HTTPException(500,'Publication impossible : erreur de stockage du wallpaper') from exc
    x=materialize(row);WALLPAPERS.append(x);WALLPAPER_BY_ID[row.id]=x;WALLPAPER_IDS.add(row.id)
    return {'ok':True,'wallpaper':x,'quality':q,'enhancement':enhance_meta}
@app.patch('/api/admin/wallpapers/{wallpaper_id}')
async def studio_edit(wallpaper_id:str,title:str=Form(...),category:str=Form(...),tags:str=Form(''),wallpaper_type:str=Form('static'),_:None=Depends(require_csrf),user:User=Depends(admin_user)):
    title=title.strip(); clean_tags=list(dict.fromkeys([x.strip() for x in tags.split(',') if x.strip()]))[:12]
    if not title:raise HTTPException(400,'Titre requis')
    if category not in CATEGORIES:raise HTTPException(400,'Catégorie invalide')
    if wallpaper_type not in {'static','live'}:raise HTTPException(400,'Type invalide')
    with SessionLocal() as db:
        row=db.get(WallpaperAsset,wallpaper_id)
        if not row:raise HTTPException(404,'Wallpaper introuvable')
        row.title=title;row.category=category;row.tags_json=json.dumps(clean_tags,ensure_ascii=False);row.wallpaper_type=wallpaper_type;db.commit();db.refresh(row)
    x=materialize(row);WALLPAPER_BY_ID[row.id].update(x) if row.id in WALLPAPER_BY_ID else None
    return {'ok':True,'wallpaper':x}
load_assets()
