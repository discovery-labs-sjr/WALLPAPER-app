/* WALLVERSE interface v4 — reliable navigation motion + clean labels */
(() => {
  const NAV_CLASSES = ['navPlay','navHome','navExplore','navLive','navInspiration','navFavorites'];
  let bound = false;

  function cleanWallpaperLabels(){
    const generic = /^(?:image|wallpaper)?\s*(?:HD|4K|UHD|FULL\s*HD|LIVE(?:\s+WALLPAPER)?|WALLPAPER\s*(?:HD|4K|UHD))$/i;
    document.querySelectorAll('#hero *,#sections *,#inspiration *,#liveSection *').forEach(node => {
      if (node.children.length === 0 && generic.test((node.textContent || '').trim())) {
        node.textContent = '';
        node.setAttribute('aria-hidden', 'true');
        node.style.display = 'none';
      }
    });
  }

  function play(button){
    if (!button) return;

    document.querySelectorAll('.navBtn').forEach(btn => btn.classList.remove(...NAV_CLASSES));

    const tab = String(button.dataset.tab || '');
    const motion = `nav${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
    if (!NAV_CLASSES.includes(motion)) return;

    // Force a fresh animation even when the same navigation item is tapped repeatedly.
    void button.offsetWidth;
    button.classList.add('navPlay', motion);

    window.setTimeout(() => {
      button.classList.remove(...NAV_CLASSES);
    }, 700);
  }

  function bind(){
    if (bound) return;
    bound = true;

    cleanWallpaperLabels();
    const observer = new MutationObserver(cleanWallpaperLabels);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    document.addEventListener('click', event => {
      const button = event.target.closest('.navBtn');
      if (!button) return;
      play(button);
    }, { passive: true });

    document.addEventListener('pointerdown', event => {
      const button = event.target.closest('.navBtn');
      if (button) button.classList.add('navPressing');
    }, { passive: true });

    const release = event => {
      const button = event.target.closest('.navBtn');
      if (button) button.classList.remove('navPressing');
    };
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
    document.addEventListener('pointerleave', release, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
