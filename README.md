# WallVerse

WallVerse est une galerie de wallpapers responsive avec une interface sombre, minimaliste et éditoriale.

## Stack
- FastAPI pour l'API et le téléchargement
- HTML/CSS/JavaScript vanilla pour l'interface
- SVG locaux pour les visuels de démonstration
- `localStorage` pour les favoris

## Lancer en local

```bash
pip install fastapi uvicorn
uvicorn app:app --reload
```

Puis ouvre `http://127.0.0.1:8000`.

## Structure

```text
wallverse/
├── app.py
├── wallpapers.json
├── README.md
└── static/
    ├── index.html
    ├── styles.css
    ├── app.js
    └── wallpapers/
```

## Direction artistique

L'interface privilégie une esthétique de galerie : beaucoup d'espace, typographie nette, grille d'images, navigation discrète, aperçu plein écran et accent fluorescent limité aux actions importantes.

Les visuels SVG présents dans le dépôt servent de contenu de démonstration et peuvent être remplacés par de vrais wallpapers sans modifier le catalogue.
