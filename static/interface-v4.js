/* WALLVERSE interface v4 — deterministic navigation triggers */
(() => {
  let bound = false;
  const NAV_CLASSES = ['navPlay','navHome','navExplore','navLive','navInspiration','navFavorites'];

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
