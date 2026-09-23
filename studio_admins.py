from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, Form
from sqlalchemy import DateTime, String, select
from sqlalchemy.orm import Mapped, mapped_column

from core import Base, SessionLocal, User, app, current_user, engine, require_csrf

OWNER_EMAIL = os.getenv('ADMIN_EMAIL', '').strip().lower()


class StudioAdmin(Base):
    __tablename__ = 'studio_admins'
    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    role: Mapped[str] = mapped_column(String(20), default='admin')
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


StudioAdmin.__table__.create(bind=engine, checkfirst=True)


def _current_user(wallverse_access: str | None) -> User | None:
    if not wallverse_access:
        return None
    with SessionLocal() as db:
        return current_user(db, wallverse_access)


def require_owner(wallverse_access: str | None = Cookie(default=None, alias='wallverse_access')) -> User:
    user = _current_user(wallverse_access)
    if not user or not OWNER_EMAIL or user.email.lower() != OWNER_EMAIL:
        raise HTTPException(403, 'Accès réservé à l’administrateur principal')
    return user


@app.get('/api/admin/administrators')
def list_administrators(_: User = Depends(require_owner)):
    with SessionLocal() as db:
        rows = db.scalars(select(StudioAdmin).order_by(StudioAdmin.added_at.asc())).all()
    emails = {OWNER_EMAIL}
    return [
        {'email': OWNER_EMAIL, 'role': 'owner', 'protected': True}
    ] + [
        {'email': row.email, 'role': row.role, 'protected': False, 'added_at': row.added_at.isoformat() if row.added_at else None}
        for row in rows if row.email not in emails
    ]


@app.post('/api/admin/administrators')
def add_administrator(
    email: str = Form(...),
    _: None = Depends(require_csrf),
    __: User = Depends(require_owner),
):
    normalized = email.strip().lower()
    if '@' not in normalized or len(normalized) > 320:
        raise HTTPException(400, 'Adresse e-mail invalide')
    if normalized == OWNER_EMAIL:
        raise HTTPException(409, 'Cette adresse est déjà propriétaire')
    with SessionLocal() as db:
        if db.get(StudioAdmin, normalized):
            raise HTTPException(409, 'Cet administrateur existe déjà')
        db.add(StudioAdmin(email=normalized, role='admin'))
        db.commit()
    return {'ok': True, 'email': normalized, 'role': 'admin'}


@app.delete('/api/admin/administrators/{email}')
def remove_administrator(
    email: str,
    _: None = Depends(require_csrf),
    __: User = Depends(require_owner),
):
    normalized = email.strip().lower()
    if normalized == OWNER_EMAIL:
        raise HTTPException(403, 'Le propriétaire principal ne peut pas être supprimé')
    with SessionLocal() as db:
        row = db.get(StudioAdmin, normalized)
        if not row:
            raise HTTPException(404, 'Administrateur introuvable')
        db.delete(row)
        db.commit()
    return {'ok': True, 'email': normalized}
