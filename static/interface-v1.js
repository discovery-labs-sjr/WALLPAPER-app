/* WALLVERSE interface v1 — interaction polish */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function bindNavPressStates() {
    $$('.navBtn').forEach(button => {
      const press = () => button.classList.add('navPressing');
      const release = () => button.classList.remove('navPressing');
      button.addEventListener('pointerdown', press, { passive: true });
      button.addEventListener('pointerup', release, { passive: true });
      button.addEventListener('pointercancel', release, { passive: true });
      button.addEventListener('pointerleave', release, { passive: true });
    });
  }

  function bindCategoryRail() {
    const rail = $('#categories');
    if (!rail) return;

    const updatePinned = () => {
      const top = window.matchMedia('(max-width:700px)').matches ? 68 : 76;
      const rect = rail.getBoundingClientRect();
      rail.classList.toggle('isPinned', rect.top <= top + 1);
    };

    window.addEventListener('scroll', updatePinned, { passive: true });
    window.addEventListener('resize', updatePinned, { passive: true });
    updatePinned();

    const observer = new MutationObserver(() => {
      const active = $('.tab.active', rail);
      active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
    observer.observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    rail.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.scrollLeft += event.deltaY;
    }, { passive: true });
  }

  function install() {
    bindNavPressStates();
    bindCategoryRail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 900);
})();
