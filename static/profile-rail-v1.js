(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

  function loadRailStyles() {
    if (document.querySelector('link[data-profile-rail-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/static/featured-widget-rail-v1.css?v=20260925-profile3';
    link.dataset.profileRailStyle = 'true';
    document.head.appendChild(link);
  }

  function imageOf(item) { return item?.preview || item?.file || ''; }

  function mount(items) {
    const root = $('#wvProfileRail');
    if (!root) return;
    const valid = (Array.isArray(items) ? items : []).filter(item => imageOf(item));
    // Do not erase the existing Featured rail when no real profile has been published yet.
    if (!valid.length) return;

    const thumbs = valid.slice(0, 20).map(item => {
      const image = esc(imageOf(item));
      return `<button class="wvProfileItem" type="button" data-profile-id="${esc(item.id)}" aria-label="Profil WALLVERSE"><span class="wvProfileThumb"><img loading="lazy" src="${image}" alt="Profil" draggable="false"></span></button>`;
    }).join('');
    const track = `${thumbs}${thumbs}`;
    root.classList.remove('is-empty');
    root.innerHTML = `<div class="wvProfileHeader"><div class="wvProfileHeading"><strong>Profile Widget</strong><span class="wvProfileNew">NEW</span></div><div class="wvProfileNav" aria-label="Parcourir les profils"><button class="wvProfileArrow wvProfileArrowPrev is-hidden" type="button" data-profile-prev aria-label="Profils précédents">‹</button><button class="wvProfileArrow" type="button" data-profile-next aria-label="Profils suivants">›</button></div></div><div class="wvProfileViewport"><div class="wvProfileTrack">${track}</div></div>`;

    const viewport = $('.wvProfileViewport', root);
    const railTrack = $('.wvProfileTrack', root);
    if (!viewport || !railTrack) return;
    let paused = false;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    let lastTime = performance.now();
    const half = () => railTrack.scrollWidth / 2;
    const normalize = () => {
      const width = half();
      if (width > 0 && viewport.scrollLeft >= width) viewport.scrollLeft -= width;
      if (width > 0 && viewport.scrollLeft < 0) viewport.scrollLeft += width;
      $('[data-profile-prev]', root)?.classList.toggle('is-hidden', viewport.scrollLeft <= 4);
    };
    const step = direction => {
      paused = true;
      viewport.scrollBy({left: Math.max(viewport.clientWidth * .72, 180) * direction, behavior: 'smooth'});
      window.setTimeout(() => { paused = false; lastTime = performance.now(); }, 520);
    };
    $('[data-profile-prev]', root)?.addEventListener('click', () => step(-1));
    $('[data-profile-next]', root)?.addEventListener('click', () => step(1));
    viewport.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      dragging = true; paused = true; startX = event.clientX; startScroll = viewport.scrollLeft;
      try { viewport.setPointerCapture(event.pointerId); } catch {}
    }, {passive: true});
    viewport.addEventListener('pointermove', event => {
      if (dragging) viewport.scrollLeft = startScroll - (event.clientX - startX);
    }, {passive: true});
    const end = event => {
      if (!dragging) return;
      dragging = false; paused = false; lastTime = performance.now();
      try { viewport.releasePointerCapture(event.pointerId); } catch {}
    };
    viewport.addEventListener('pointerup', end, {passive: true});
    viewport.addEventListener('pointercancel', end, {passive: true});
    viewport.addEventListener('mouseenter', () => { paused = true; });
    viewport.addEventListener('mouseleave', () => { paused = false; lastTime = performance.now(); });
    viewport.addEventListener('scroll', normalize, {passive: true});

    const tick = now => {
      const dt = Math.min(64, now - lastTime);
      lastTime = now;
      if (!paused && !dragging) viewport.scrollLeft += dt * .022;
      normalize();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async function load() {
    try {
      const response = await fetch('/api/profiles', {credentials: 'include', cache: 'no-store'});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const profiles = await response.json();
      if (Array.isArray(profiles) && profiles.some(item => imageOf(item))) {
        loadRailStyles();
        mount(profiles);
      }
    } catch (error) {
      console.error('WALLVERSE profile rail:', error);
    }
  }

  function boot() {
    if (!$('#wvProfileRail')) return;
    load();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true});
  else boot();
})();
