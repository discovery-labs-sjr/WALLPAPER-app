/* WALLVERSE interface v4 — deterministic navigation triggers */
(() => {
  const SELECTORS = '.navBtn';
  let bound = false;

  function classesFor(tab) {
    const key = String(tab || '');
    return ['navPlay', 'navHome', 'navExplore', 'navLive', 'navInspiration', 'navFavorites'].filter(Boolean).concat(`nav${key.charAt(0).toUpperCase()}${key.slice(1)}`);
  }

  function play(button) {
    if (!button) return;
    const buttons = [...document.querySelectorAll(SELECTORS)];
    buttons.forEach(btn => {
      btn.classList.remove('navPlay','navHome','navExplore','navLive','navInspiration','navFavorites');
    });
    button.classList.add(...classesFor(button.dataset.tab));
    window.setTimeout(() => {
      button.classList.remove('navPlay','navHome','navExplore','navLive','navInspiration','navFavorites');
    }, 900);
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener('click', event => {
      const button = event.target.closest(SELECTORS);
      if (!button) return;
      requestAnimationFrame(() => play(button));
    }, { passive: true });

    document.addEventListener('pointerdown', event => {
      const button = event.target.closest(SELECTORS);
      if (!button) return;
      button.classList.add('navPressing');
    }, { passive: true });

    const release = event => {
      const button = event.target.closest(SELECTORS);
      if (button) button.classList.remove('navPressing');
    };
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
})();
