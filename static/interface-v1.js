/* WALLVERSE interface v2 — tactile navigation + ambient shell */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let installed = false;

  function ensureAmbient() {
    if ($('#uiAmbient')) return $('#uiAmbient');
    const ambient = document.createElement('div');
    ambient.id = 'uiAmbient';
    ambient.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(ambient, document.body.firstChild);
    return ambient;
  }

  function setAmbient(url) {
    if (!url) return;
    const ambient = ensureAmbient();
    ambient.style.setProperty('--wv-ui-bg-image', `url("${String(url).replace(/"/g, '\\"')}")`);
    document.body.classList.add('uiAmbientReady');
  }

  function bindAmbientSources() {
    ensureAmbient();

    const hero = $('#heroImage');
    if (hero) {
      if (hero.currentSrc || hero.src) setAmbient(hero.currentSrc || hero.src);
      hero.addEventListener('load', () => setAmbient(hero.currentSrc || hero.src), { passive: true });
    }

    document.addEventListener('pointerover', event => {
      const card = event.target.closest('.card');
      const image = card?.querySelector('img');
      if (image?.currentSrc) setAmbient(image.currentSrc);
    }, { passive: true });

    document.addEventListener('pointerdown', event => {
      const card = event.target.closest('.card');
      const image = card?.querySelector('img');
      if (image?.currentSrc) setAmbient(image.currentSrc);
    }, { passive: true });
  }

  function playNav(button) {
    $$('.navBtn').forEach(btn => btn.classList.remove('navPlay', 'navPressing'));
    const tab = button.dataset.tab || '';
    button.classList.add('navPlay');
    button.classList.toggle('navHome', tab === 'home');
    button.classList.toggle('navExplore', tab === 'explore');
    button.classList.toggle('navLive', tab === 'live');
    button.classList.toggle('navInspiration', tab === 'inspiration');
    button.classList.toggle('navFavorites', tab === 'favorites');
    window.setTimeout(() => button.classList.remove('navPlay', 'navHome', 'navExplore', 'navLive', 'navInspiration', 'navFavorites'), 760);
  }

  function bindNav() {
    $$('.navBtn').forEach(button => {
      const press = () => button.classList.add('navPressing');
      const release = () => button.classList.remove('navPressing');
      button.addEventListener('pointerdown', press, { passive: true });
      button.addEventListener('pointerup', release, { passive: true });
      button.addEventListener('pointercancel', release, { passive: true });
      button.addEventListener('pointerleave', release, { passive: true });
      button.addEventListener('click', () => playNav(button));
    });
  }

  function bindCategoryRail() {
    const rail = $('#categories');
    if (!rail || rail.dataset.interfaceBound === '1') return;
    rail.dataset.interfaceBound = '1';

    const updateState = () => {
      const top = window.matchMedia('(max-width:700px)').matches ? 68 : 76;
      const rect = rail.getBoundingClientRect();
      rail.classList.toggle('isPinned', rect.top <= top + 1);
      document.body.classList.toggle('wvScrolled', window.scrollY > Math.max(30, rect.top + window.scrollY - top));
    };

    window.addEventListener('scroll', updateState, { passive: true });
    window.addEventListener('resize', updateState, { passive: true });
    updateState();

    const centerActive = () => {
      const active = $('.tab.active', rail);
      if (!active) return;
      active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    };

    const observer = new MutationObserver(() => {
      requestAnimationFrame(centerActive);
    });
    observer.observe(rail, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    rail.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) rail.scrollLeft += event.deltaY;
    }, { passive: true });
  }

  function install() {
    if (installed) return;
    installed = true;
    ensureAmbient();
    bindAmbientSources();
    bindNav();
    bindCategoryRail();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 900);
  setTimeout(bindCategoryRail, 1400);
})();
