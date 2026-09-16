/* WALLVERSE viewer v3 — reliable mobile swipe with API-backed catalog */
(() => {
  const init = () => {
    const viewer = document.querySelector('#viewer');
    const media = document.querySelector('.viewerMedia');
    const image = document.querySelector('#viewerImg');
    if (!viewer || !media || !image) return;

    viewer.classList.add('viewerEnhanced');
    if (!media.querySelector('.viewerGestureHint')) {
      const hint = document.createElement('div');
      hint.className = 'viewerGestureHint';
      hint.textContent = 'Glisse pour changer • vers le bas pour fermer';
      media.appendChild(hint);
    }

    let startX = 0, startY = 0, active = false, moved = false, lastTap = 0;
    let remoteItems = [];
    let loadingItems = null;

    const loadItems = async () => {
      if (remoteItems.length) return remoteItems;
      if (!loadingItems) {
        loadingItems = fetch('/api/wallpapers', { credentials: 'include', cache: 'no-store' })
          .then(r => r.ok ? r.json() : [])
          .then(data => { remoteItems = Array.isArray(data) ? data : []; return remoteItems; })
          .catch(() => [])
          .finally(() => { loadingItems = null; });
      }
      return loadingItems;
    };

    const list = () => {
      if (Array.isArray(window.wallpapers) && window.wallpapers.length) return window.wallpapers;
      if (Array.isArray(window.__wvHomeWallpapers) && window.__wvHomeWallpapers.length) return window.__wvHomeWallpapers;
      return remoteItems;
    };

    const normalize = value => {
      try { return new URL(String(value || ''), location.href).href; } catch { return String(value || ''); }
    };

    const currentId = () => {
      if (window.__wvCurrentWallpaperId) return window.__wvCurrentWallpaperId;
      const items = list();
      const src = normalize(image.currentSrc || image.src);
      const title = document.querySelector('#viewerTitle')?.textContent?.trim() || '';
      const found = items.find(w => normalize(w?.preview || w?.file) === src || (title && String(w?.title || '').trim() === title));
      return found?.id || null;
    };

    const currentIndex = () => {
      const items = list();
      const id = currentId();
      return id == null ? -1 : items.findIndex(w => String(w?.id) === String(id));
    };

    const navigate = async direction => {
      let items = list();
      if (!items.length) items = await loadItems();
      const index = currentIndex();
      if (!items.length || index < 0 || typeof window.openViewer !== 'function') return;
      const next = (index + direction + items.length) % items.length;
      window.__wvCurrentWallpaperId = items[next].id;
      window.openViewer(items[next].id);
    };

    // Prime the catalog while the viewer is open; this does not block opening the image.
    loadItems();

    const resetImage = () => {
      image.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s ease';
      image.style.transform = 'translate3d(0,0,0)';
      image.style.opacity = '1';
      setTimeout(() => { image.style.transition = ''; }, 230);
    };

    image.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      const t = event.touches[0];
      startX = t.clientX; startY = t.clientY;
      active = true; moved = false;
      viewer.classList.add('isInteracting');
    }, { passive: true });

    image.addEventListener('touchmove', event => {
      if (!active || event.touches.length !== 1) return;
      const t = event.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (Math.abs(dx) > Math.abs(dy)) {
        const clamped = Math.max(-110, Math.min(110, dx));
        image.style.transform = `translate3d(${clamped}px,0,0) rotate(${clamped * 0.018}deg)`;
      } else if (dy > 0) {
        const progress = Math.min(1, dy / 230);
        image.style.transform = `translate3d(0,${Math.min(90,dy*.34)}px,0) scale(${1-progress*.08})`;
      }
    }, { passive: true });

    image.addEventListener('touchend', event => {
      if (!active) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      active = false; viewer.classList.remove('isInteracting');
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
        const direction = dx < 0 ? 1 : -1;
        image.style.transition = 'transform .14s ease,opacity .14s ease';
        image.style.transform = `translate3d(${direction * -120}px,0,0) rotate(${direction * -2}deg)`;
        image.style.opacity = '.45';
        setTimeout(async () => {
          await navigate(direction);
          image.style.transition = 'none';
          image.style.transform = `translate3d(${direction * 120}px,0,0) rotate(${direction * 2}deg)`;
          image.style.opacity = '.45';
          requestAnimationFrame(() => {
            image.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1),opacity .24s ease';
            image.style.transform = 'translate3d(0,0,0)';
            image.style.opacity = '1';
          });
        }, 90);
        return;
      }
      if (dy > 90 && dy > Math.abs(dx) * 1.15) {
        if (typeof window.closeViewer === 'function') window.closeViewer();
        return;
      }
      resetImage();
    }, { passive: true });

    image.addEventListener('touchcancel', () => {
      active = false; viewer.classList.remove('isInteracting'); resetImage();
    }, { passive: true });

    image.addEventListener('click', () => {
      const now = Date.now();
      const id = currentId();
      if (now - lastTap < 320 && id && typeof window.toggleFavorite === 'function') window.toggleFavorite(id);
      lastTap = now;
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();