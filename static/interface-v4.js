/* WALLVERSE interface v4 — deterministic navigation triggers + clean labels */
(() => {
  let bound = false;
  const NAV_CLASSES = ['navPlay','navHome','navExplore','navLive','navInspiration','navFavorites'];

  function installMotion(){
    if(document.getElementById('wvNavMotion')) return;
    const style=document.createElement('style');
    style.id='wvNavMotion';
    style.textContent='.navBtn.navPlay.navLive .navIconLive svg{animation:wvLivePulse .62s cubic-bezier(.22,.82,.22,1)!important;transform-origin:50% 50%!important}@keyframes wvLivePulse{0%{transform:scale(1)}28%{transform:scale(1.12)}48%{transform:scale(.96)}68%{transform:scale(1.06)}100%{transform:scale(1)}}';
    document.head.appendChild(style);
  }

  function cleanWallpaperLabels(){
    const generic=/^(?:image|wallpaper)?\s*(?:HD|4K|UHD|FULL\s*HD|LIVE(?:\s+WALLPAPER)?|WALLPAPER\s*(?:HD|4K|UHD))$/i;
    document.querySelectorAll('#hero *,#sections *,#inspiration *,#liveSection *').forEach(node=>{
      if(node.children.length===0 && generic.test((node.textContent||'').trim())){
        node.textContent=''; node.setAttribute('aria-hidden','true'); node.style.display='none';
      }
    });
  }

  function play(button){
    if(!button) return;
    const buttons = [...document.querySelectorAll('.navBtn')];
    buttons.forEach(btn => btn.classList.remove(...NAV_CLASSES));
    const tab = String(button.dataset.tab || '');
    const motion = `nav${tab.charAt(0).toUpperCase()}${tab.slice(1)}`;
    if(NAV_CLASSES.includes(motion)) button.classList.add('navPlay', motion);
    window.setTimeout(() => button.classList.remove(...NAV_CLASSES), 820);
  }

  function bind(){
    if(bound) return;
    bound = true;
    installMotion();
    cleanWallpaperLabels();
    new MutationObserver(cleanWallpaperLabels).observe(document.body,{subtree:true,childList:true,characterData:true});
    document.addEventListener('click', event => {
      const button = event.target.closest('.navBtn');
      if(!button) return;
      requestAnimationFrame(() => play(button));
    }, {passive:true});
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest('.navBtn');
      if(button) button.classList.add('navPressing');
    }, {passive:true});
    const release = event => {
      const button = event.target.closest('.navBtn');
      if(button) button.classList.remove('navPressing');
    };
    document.addEventListener('pointerup', release, {passive:true});
    document.addEventListener('pointercancel', release, {passive:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
})();
