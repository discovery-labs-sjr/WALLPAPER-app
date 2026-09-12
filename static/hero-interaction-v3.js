(() => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function boot() {
    const stage = document.querySelector('#heroStage');
    const card = document.querySelector('#heroCard');
    if (!stage || !card || stage.dataset.heroV3) return;
    stage.dataset.heroV3 = '1';

    let activePointer = null;
    let startX = 0;
    let startY = 0;
    let moved = false;
    let intent = 'none';

    const setPose = (rx, ry, rz, scale = 1, tx = 0) => {
      card.style.setProperty('--hero-rx', `${rx}deg`);
      card.style.setProperty('--hero-ry', `${ry}deg`);
      card.style.setProperty('--hero-rz', `${rz}deg`);
      card.style.setProperty('--hero-scale', scale);
      card.style.setProperty('--hero-tx', `${tx}px`);
    };

    const reset = () => {
      card.classList.remove('heroTouching', 'heroDragging');
      setPose(1, window.matchMedia('(max-width:700px)').matches ? -2 : -7, window.matchMedia('(max-width:700px)').matches ? .6 : 1.2, 1, 0);
    };

    stage.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' || event.button !== 0) return;
      activePointer = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      moved = false;
      intent = 'none';
      card.classList.add('heroTouching');
    }, { passive: true });

    stage.addEventListener('pointermove', event => {
      if (activePointer !== event.pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);

      if (intent === 'none' && Math.max(ax, ay) > 7) {
        intent = ax > ay ? 'horizontal' : 'vertical';
        moved = true;
      }

      if (intent === 'vertical') {
        card.classList.remove('heroTouching', 'heroDragging');
        return;
      }

      if (intent === 'horizontal') {
        card.classList.add('heroTouching', 'heroDragging');
        const rect = stage.getBoundingClientRect();
        const localX = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
        const localY = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
        const tx = clamp(dx * 0.18, -24, 24);
        setPose(1 - localY * 10, -2 + localX * 18, .6 + localX * 2.8, 1.055, tx);
        return;
      }

      const rect = stage.getBoundingClientRect();
      const localX = clamp((event.clientX - rect.left) / rect.width - 0.5, -0.5, 0.5);
      const localY = clamp((event.clientY - rect.top) / rect.height - 0.5, -0.5, 0.5);
      setPose(1 - localY * 8, -2 + localX * 14, .6 + localX * 2.2, 1.045, clamp(dx * 0.08, -10, 10));
    }, { passive: true });

    const finish = event => {
      if (activePointer !== event.pointerId) return;
      activePointer = null;
      card.classList.remove('heroDragging');
      if (!moved) {
        // Give a clean, obvious tactile press without affecting the page scroll.
        card.classList.remove('heroTouching');
        requestAnimationFrame(() => {
          if (!activePointer) reset();
        });
      } else {
        reset();
      }
      intent = 'none';
    };

    stage.addEventListener('pointerup', finish, { passive: true });
    stage.addEventListener('pointercancel', finish, { passive: true });

    const onOrientation = event => {
      if (activePointer != null || event.gamma == null || event.beta == null) return;
      const x = clamp(event.gamma / 28, -0.5, 0.5);
      const y = clamp((event.beta - 35) / 38, -0.5, 0.5);
      setPose(1 - y * 8, -2 + x * 14, .6 + x * 2.4, 1.018, x * 5);
    };

    window.addEventListener('deviceorientation', onOrientation, { passive: true });

    reset();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 80);
  }
})();
