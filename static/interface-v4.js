/* WALLVERSE navigation interactions — one reliable click path */
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
    void button.offsetWidth;
    button.classList.add('navPlay', motion);
    window.setTimeout(() => button.classList.remove(...NAV_CLASSES), 800);
  }

  function bind(){
    if (bound) return;
    bound = true;
    cleanWallpaperLabels();
    const observer = new MutationObserver(cleanWallpaperLabels);
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});

    document.addEventListener('pointerdown', event => {
      const button = event.target.closest?.('.navBtn');
      if (button) button.classList.add('navPressing');
    }, {passive:true});

    document.addEventListener('click', event => {
      const button = event.target.closest?.('.navBtn');
      if (!button) return;
      button.classList.remove('navPressing');
      play(button);
    });

    document.addEventListener('pointercancel', event => {
      const button = event.target.closest?.('.navBtn');
      if (button) button.classList.remove('navPressing');
    }, {passive:true});

    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const button = event.target.closest?.('.navBtn');
      if (button) play(button);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();
