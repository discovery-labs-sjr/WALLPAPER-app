# WallVerse

Galerie de wallpapers sombre, minimaliste et futuriste, avec authentification, favoris synchronisés et téléchargement.

## Stack
- FastAPI + SQLAlchemy
- PostgreSQL en production / SQLite en local
- Argon2 pour les mots de passe
- JWT d'accès court + refresh token opaque rotatif en cookie HttpOnly
- Protection CSRF pour les mutations
- HTML/CSS/JavaScript vanilla
- Render Blueprint pour le déploiement

## Authentification
1. `POST /api/auth/register` ou `POST /api/auth/login` vérifie les identifiants.
2. Le mot de passe est hashé avec Argon2 et n'est jamais stocké en clair.
3. Le serveur crée un JWT d'accès de courte durée et un refresh token aléatoire.
4. Les tokens sont placés dans des cookies `HttpOnly`, `Secure`, `SameSite=Lax`.
5. Le hash SHA-256 du refresh token est stocké en base afin de pouvoir révoquer et faire tourner les sessions.
6. Un cookie CSRF lisible par le navigateur doit être recopié dans `X-CSRF-Token` pour les requêtes mutantes.
7. Les favoris sont stockés par utilisateur en base, pas seulement dans `localStorage`.

## Flux de requête
```text
Navigateur
   │
   ├─ GET /api/auth/csrf ───────────────► cookie CSRF
   │
   ├─ POST /api/auth/login ─────────────► FastAPI
   │                                      │
   │                                      ├─ vérifie Argon2
   │                                      ├─ signe JWT access (15 min)
   │                                      └─ crée refresh session (30 j)
   │
   │ ◄──────── cookies HttpOnly + CSRF ───┘
   │
   ├─ GET /api/auth/me ─────────────────► utilisateur + favoris
   ├─ POST /api/favorites ───────────────► favoris PostgreSQL
   └─ POST /api/auth/refresh ────────────► rotation du refresh token
```

## Local
```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

Ouvrir `http://127.0.0.1:8000`.

## Render
Le fichier `render.yaml` décrit le web service et PostgreSQL. Crée un Blueprint Render depuis ce dépôt : Render installe les dépendances, crée la base, injecte `DATABASE_URL` et génère `JWT_SECRET`.
