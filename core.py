from __future__

import hashlib
import json
import mimetypes
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import jwt
from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker

BASE = Path(__file__).resolve().parent
DATA = BASE / "wallpapers.json"
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(48)
JWT_ALGORITHM = "HS256"
ACCESS_MINUTES = int(os.getenv("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_DAYS = int(os.getenv("REFRESH_TOKEN_DAYS", "30"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN") or None
raw_db_url = os.getenv("DATABASE_URL", f"sqlite:///{BASE / 'wallverse.db'}")
if raw_db_url.startswith("postgres://"): raw_db_url = "postgresql+psycopg://" + raw_db_url[len("postgres://"):]
elif raw_db_url.startswith("postgresql://"): raw_db_url = "postgresql+psycopg://" + raw_db_url[len("postgresql://"):]
connect_args = {"check_same_thread": False} if raw_db_url.startswith("sqlite") else {}
engine = create_engine(raw_db_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
password_hash = PasswordHash.recommended()
class Base(DeclarativeBase): pass
class User(Base):
    __tablename__="users"; id:Mapped[int]=mapped_column(primary_key=True); email:Mapped[str]=mapped_column(String(320),unique=True,index=True); password_hash:Mapped[str]=mapped_column(String(255)); display_name:Mapped[str]=mapped_column(String(80)); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc)); favorites:Mapped[list['Favorite']]=relationship(back_populates='user',cascade='all, delete-orphan'); sessions:Mapped[list['AuthSession']]=relationship(back_populates='user',cascade='all, delete-orphan')
class Favorite(Base):
    __tablename__='favorites'; __table_args__=(UniqueConstraint('user_id','wallpaper_id',name='uq_user_wallpaper'),); id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); wallpaper_id:Mapped[str]=mapped_column(String(80),index=True); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc)); user:Mapped['User']=relationship(back_populates='favorites')
class AuthSession(Base):
    __tablename__='auth_sessions'; id:Mapped[int]=mapped_column(primary_key=True); user_id:Mapped[int]=mapped_column(ForeignKey('users.id',ondelete='CASCADE'),index=True); refresh_hash:Mapped[str]=mapped_column(String(64),unique=True,index=True); expires_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),index=True); revoked:Mapped[bool]=mapped_column(Boolean,default=False); created_at:Mapped[datetime]=mapped_column(DateTime(timezone=True),default=lambda:datetime.now(timezone.utc)); user:Mapped['User']=relationship(back_populates='sessions')
Base.metadata.create_all(engine)
with DATA.open('r',encoding='utf-8') as handle: WALLPAPERS=json.load(handle)
WALLPAPER_BY_ID={item['id']:item for item in WALLPAPERS}; WALLPAPER_IDS=set(WALLPAPER_BY_ID); ALLOWED_IMAGE_HOSTS={'images.unsplash.com','images.pexels.com'}
app=FastAPI(title='WALLVERSE',version='7.0.0'); app.add_middleware(CORSMiddleware,allow_origins=[],allow_credentials=True); app.mount('/static',StaticFiles(directory=BASE/'static'),name='static')
_http_client: httpx.AsyncClient|None=None
class RegisterIn(BaseModel): email:EmailStr; password:str=Field(min_length=8,max_length=128); display_name:str=Field(min_length=2,max_length=80)
class LoginIn(BaseModel): email:EmailStr; password:str=Field(min_length=1,max_length=128)
class FavoriteIn(BaseModel): wallpaper_id:str=Field(min_length=1,max_length=80)
def now(): return datetime.now(timezone.utc)
def token_hash(value:str): return hashlib.sha256(value.encode('utf-8')).hexdigest()
def make_access_token(user_id:int): return jwt.encode({'sub':str(user_id),'type':'access','exp':now()+timedelta(minutes=ACCESS_MINUTES)},JWT_SECRET,algorithm=JWT_ALGORITHM)
def set_auth_cookies(response:Response,access:str,refresh:str,csrf:str):
    common={'secure':COOKIE_SECURE,'httponly':True,'samesite':'lax','domain':COOKIE_DOMAIN,'path':'/'}; response.set_cookie('wallverse_access',access,max_age=ACCESS_MINUTES*60,**common); response.set_cookie('wallverse_refresh',refresh,max_age=REFRESH_DAYS*86400,**common); response.set_cookie('wallverse_csrf',csrf,max_age=REFRESH_DAYS*86400,secure=COOKIE_SECURE,httponly=False,samesite='lax',domain=COOKIE_DOMAIN,path='/')
def clear_auth_cookies(response:Response):
    for name in ('wallverse_access','wallverse_refresh','wallverse_csrf'): response.delete_cookie(name,domain=COOKIE_DOMAIN,path='/')
def issue_session(db:Session,user:User,response:Response):
    access=make_access_token(user.id); refresh=secrets.token_urlsafe(48); csrf=secrets.token_urlsafe(32); db.add(AuthSession(user_id=user.id,refresh_hash=token_hash(refresh),expires_at=now()+timedelta(days=REFRESH_DAYS))); db.commit(); set_auth_cookies(response,access,refresh,csrf)
def current_user(db:Session,access_cookie:str|None):
    if not access_cookie:return None
    try:
        payload=jwt.decode(access_cookie,JWT_SECRET,algorithms=[JWT_ALGORITHM]);
        if payload.get('type')!='access':return None
        return db.get(User,int(payload['sub']))
    except (jwt.PyJWTError,KeyError,TypeError,ValueError):return None
def require_user(wallverse_access:str|None=Cookie(default=None,alias='wallverse_access')):
    with SessionLocal() as db:
        user=current_user(db,wallverse_access)
        if not user:raise HTTPException(401,'Authentification requise')
        return user
def require_csrf(request:Request,csrf_cookie:str|None=Cookie(default=None,alias='wallverse_csrf')):
    if request.method in {'POST','PUT','PATCH','DELETE'}:
        header=request.headers.get('X-CSRF-Token')
        if not csrf_cookie or not header or not secrets.compare_digest(csrf_cookie,header):raise HTTPException(403,'CSRF token invalide')
def local_wallpaper_file(item:dict):
    relative=Path(str(item.get('file') or '').lstrip('/'))
    if relative.is_absolute() or '..' in relative.parts:raise HTTPException(400,'Fichier wallpaper invalide')
    path=BASE/relative
    if not path.is_file():raise HTTPException(404,'Image locale introuvable')
    return path,mimetypes.guess_type(str(path))[0] or 'application/octet-stream'
def remote_preview_url(item:dict):
    preview=item.get('preview')
    if not preview:return None
    parsed=urlparse(str(preview))
    if parsed.scheme!='https' or parsed.hostname not in ALLOWED_IMAGE_HOSTS:return None
    return str(preview)
@app.on_event('startup')
async def startup():
    global _http_client; _http_client=httpx.AsyncClient(timeout=httpx.Timeout(20.0,connect=8.0),follow_redirects=True,headers={'User-Agent':'WALLVERSE/7.0','Accept':'image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8'})
@app.on_event('shutdown')
async def shutdown():
    global _http_client
    if _http_client: await _http_client.aclose(); _http_client=None
@app.get('/',response_class=HTMLResponse)
def home(): return (BASE/'static/index.html').read_text(encoding='utf-8')
@app.get('/health')
def health():
    with SessionLocal() as db: db.execute(select(1))
    return {'status':'ok','wallpapers':len(WALLPAPERS),'database':'ok'}
@app.get('/api/wallpapers')
def get_wallpapers(): return WALLPAPERS
@app.get('/api/wallpapers/{wallpaper_id}')
def get_wallpaper(wallpaper_id:str):
    wallpaper=WALLPAPER_BY_ID.get(wallpaper_id)
    if not wallpaper:raise HTTPException(404,'Wallpaper introuvable')
    return wallpaper
@app.get('/api/wallpapers/{wallpaper_id}/download')
async def download_wallpaper(wallpaper_id:str):
    wallpaper=WALLPAPER_BY_ID.get(wallpaper_id)
    if wallpaper is None:raise HTTPException(404,'Wallpaper introuvable')
    preview=remote_preview_url(wallpaper)
    if preview and _http_client:
        try:
            remote=await _http_client.get(preview,follow_redirects=True)
            if remote.is_success:return Response(content=remote.content,media_type=remote.headers.get('content-type') or mimetypes.guess_type(preview)[0] or 'image/jpeg',headers={'Content-Disposition':f'attachment; filename="{wallpaper["slug"]}.jpg"','Cache-Control':'public, max-age=3600'})
        except httpx.HTTPError:pass
    file_path,media_type=local_wallpaper_file(wallpaper); return FileResponse(file_path,media_type=media_type,filename=f'{wallpaper["slug"]}{file_path.suffix or ".svg"}')
@app.get('/api/auth/csrf')
def csrf_token(response:Response,wallverse_csrf:str|None=Cookie(default=None,alias='wallverse_csrf')):
    token=wallverse_csrf or secrets.token_urlsafe(32); response.set_cookie('wallverse_csrf',token,max_age=REFRESH_DAYS*86400,secure=COOKIE_SECURE,httponly=False,samesite='lax',domain=COOKIE_DOMAIN,path='/'); return {'ok':True}
@app.post('/api/auth/register',status_code=201)
def register(data:RegisterIn,response:Response,_:None=Depends(require_csrf)):
    email=data.email.lower().strip(); display_name=data.display_name.strip()
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email==email)):raise HTTPException(409,'Cette adresse e-mail est déjà utilisée')
        user=User(email=email,password_hash=password_hash.hash(data.password),display_name=display_name); db.add(user); db.commit(); db.refresh(user); issue_session(db,user,response); return {'id':user.id,'email':user.email,'display_name':user.display_name}
@app.post('/api/auth/login')
def login(data:LoginIn,response:Response,_:None=Depends(require_csrf)):
    email=data.email.lower().strip()
    with SessionLocal() as db:
        user=db.scalar(select(User).where(User.email==email))
        if not user or not password_hash.verify(data.password,user.password_hash):raise HTTPException(401,'E-mail ou mot de passe incorrect')
        issue_session(db,user,response); return {'id':user.id,'email':user.email,'display_name':user.display_name}
@app.post('/api/auth/refresh')
def refresh(response:Response,wallverse_refresh:str|None=Cookie(default=None,alias='wallverse_refresh'),_:None=Depends(require_csrf)):
    if not wallverse_refresh:raise HTTPException(401,'Session expirée')
    with SessionLocal() as db:
        session=db.scalar(select(AuthSession).where(AuthSession.refresh_hash==token_hash(wallverse_refresh),AuthSession.revoked.is_(False)))
        if not session or session.expires_at<=now():raise HTTPException(401,'Session expirée')
        session.revoked=True; issue_session(db,session.user,response); return {'ok':True}
@app.post('/api/auth/logout')
def logout(response:Response,wallverse_refresh:str|None=Cookie(default=None,alias='wallverse_refresh'),_:None=Depends(require_csrf)):
    with SessionLocal() as db:
        if wallverse_refresh:
            session=db.scalar(select(AuthSession).where(AuthSession.refresh_hash==token_hash(wallverse_refresh)))
            if session:session.revoked=True; db.commit()
    clear_auth_cookies(response); return {'ok':True}
@app.get('/api/auth/me')
def me(wallverse_access:str|None=Cookie(default=None,alias='wallverse_access')):
    with SessionLocal() as db:
        user=current_user(db,wallverse_access)
        if not user:return {'authenticated':False}
        favorite_ids=db.scalars(select(Favorite.wallpaper_id).where(Favorite.user_id==user.id)).all(); return {'authenticated':True,'user':{'id':user.id,'email':user.email,'display_name':user.display_name},'favorites':list(favorite_ids)}
@app.get('/api/favorites')
def get_favorites(user:User=Depends(require_user)):
    with SessionLocal() as db:return list(db.scalars(select(Favorite.wallpaper_id).where(Favorite.user_id==user.id)).all())
@app.post('/api/favorites')
def add_favorite(data:FavoriteIn,user:User=Depends(require_user),_:None=Depends(require_csrf)):
    if data.wallpaper_id not in WALLPAPER_IDS:raise HTTPException(404,'Wallpaper introuvable')
    with SessionLocal() as db:
        existing=db.scalar(select(Favorite).where(Favorite.user_id==user.id,Favorite.wallpaper_id==data.wallpaper_id))
        if not existing:db.add(Favorite(user_id=user.id,wallpaper_id=data.wallpaper_id)); db.commit()
    return {'ok':True}
@app.delete('/api/favorites/{wallpaper_id}')
def remove_favorite(wallpaper_id:str,user:User=Depends(require_user),_:None=Depends(require_csrf)):
    if wallpaper_id not in WALLPAPER_IDS:raise HTTPException(404,'Wallpaper introuvable')
    with SessionLocal() as db:
        favorite=db.scalar(select(Favorite).where(Favorite.user_id==user.id,Favorite.wallpaper_id==wallpaper_id))
        if favorite:db.delete(favorite); db.commit()
    return {'ok':True}
