/* WALLVERSE viewer v1 — mobile swipe + desktop polish */
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

    let startX = 0, startY = 0, lastX = 0, active = false, moved = false;
    let baseIndex = -1;

    const currentIndex = () => Array.isArray(window.wallpapers) ? window.wallpapers.findIndex(w => w?.id === window.current?.id) : -1;

    const navigate = direction => {
      if (!Array.isArray(window.wallpapers) || !window.wallpapers.length) return;
      const index = currentIndex();
      if (index < 0) return;
      const next = (index + direction + window.wallpapers.length) % window.wallpapers.length;
      if (typeof window.openViewer === 'function') window.openViewer(window.wallpapers[next].id);
    };

    const resetImage = () => {
      image.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)';
      image.style.transform = '';
      setTimeout(() => { image.style.transition = ''; }, 230);
    };

    image.addEventListener('touchstart', event => {
      if (event.touches.length !== 1) return;
      const t = event.touches[0];
      startX = lastX = t.clientX;
      startY = t.clientY;
      baseIndex = currentIndex();
      active = true;
      moved = false;
      viewer.classList.add('isInteracting');
    }, { passive: true });

    image.addEventListener('touchmove', event => {
      if (!active || event.touches.length !== 1) return;
      const t = event.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      lastX = t.clientX;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      const horizontal = Math.abs(dx) > Math.abs(dy);
      if (horizontal) {
        const clamped = Math.max(-110, Math.min(110, dx));
        image.style.transform = `translateX(${clamped}px) rotate(${clamped * 0.018}deg)`;
      } else if (dy > 0) {
        const progress = Math.min(1, dy / 230);
        image.style.transform = `translateY(${Math.min(90, dy * .34)}px) scale(${1 - progress * .08})`;
      }
    }, { passive: true });

    image.addEventListener('touchend', event => {
      if (!active) return;
      const t = event.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      active = false;
      viewer.classList.remove('isInteracting');
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) {
        const direction = dx < 0 ? 1 : -1;
        image.style.transition = 'transform .14s ease, opacity .14s ease';
        image.style.transform = `translateX(${direction * -120}px) rotate(${direction * -2}deg)`;
        image.style.opacity = '.45';
        setTimeout(() => {
          navigate(direction);
          image.style.transition = 'none';
          image.style.transform = `translateX(${direction * 120}px) rotate(${direction * 2}deg)`;
          image.style.opacity = '.45';
          requestAnimationFrame(() => {
            image.style.transition = 'transform .24s cubic-bezier(.2,.8,.2,1), opacity .24s ease';
            image.style.transform = '';
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

    image.addEventListener('touchcancel', () => { active = false; viewer.classList.remove('isInteracting'); resetImage(); }, { passive: true });

    viewer.addEventListener('click', event => {
      if (event.target.closest('.viewerActions, .closeBtn')) return;
      if (!moved && event.target === image && window.innerWidth <= 760 && typeof window.toggleFavorite === 'function' && window.current) {
        // Keep single tap focused on viewing; double-tap handles favorite below.
      }
      moved = false;
    });

    let lastTap = 0;
    image.addEventListener('click', () => {
      const now = Date.now();
      if (now - lastTap < 320 && window.current && typeof window.toggleFavorite === 'function') {
        window.toggleFavorite(window.current.id);
      }
      lastTap = now;
    });

    viewer.addEventListener('transitionstart', () => { baseIndex = currentIndex(); });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
