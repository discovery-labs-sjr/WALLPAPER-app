/* WALLVERSE interface v3 — ambient wallpaper sync + tactile navigation */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  let installed = false;

  function ensureAmbient(){
    if($('#uiAmbient')) return $('#uiAmbient');
    const ambient=document.createElement('div');
    ambient.id='uiAmbient';
    ambient.setAttribute('aria-hidden','true');
    document.body.insertBefore(ambient,document.body.firstChild);
    return ambient;
  }

  function setAmbient(url){
    if(!url) return;
    const ambient=ensureAmbient();
    ambient.style.setProperty('--wv-ui-bg-image',`url("${String(url).replace(/"/g,'\\"')}")`);
    document.body.classList.add('uiAmbientReady');
  }

  function syncFromHero(){
    const image=$('#heroImage');
    if(image?.currentSrc||image?.src) setAmbient(image.currentSrc||image.src);
  }

  function bindAmbient(){
    ensureAmbient();
    const hero=$('#heroImage');
    if(hero){
      hero.addEventListener('load',syncFromHero,{passive:true});
      syncFromHero();
    }
    document.addEventListener('pointerover',event=>{
      const card=event.target.closest('.card');
      const image=card?.querySelector('img');
      if(image?.currentSrc) setAmbient(image.currentSrc);
    },{passive:true});
    document.addEventListener('pointerdown',event=>{
      const card=event.target.closest('.card');
      const image=card?.querySelector('img');
      if(image?.currentSrc) setAmbient(image.currentSrc);
    },{passive:true});
    const heroObserver=new MutationObserver(syncFromHero);
    if(hero) heroObserver.observe(hero,{attributes:true,attributeFilter:['src']});
  }

  function playNav(button){
    $$('.navBtn').forEach(btn=>btn.classList.remove('navPlay','navHome','navExplore','navLive','navInspiration','navFavorites','navPressing'));
    const tab=button.dataset.tab||'';
    button.classList.add('navPlay',`nav${tab.charAt(0).toUpperCase()+tab.slice(1)}`);
    window.setTimeout(()=>button.classList.remove('navPlay','navHome','navExplore','navLive','navInspiration','navFavorites'),820);
  }

  function bindNav(){
    $$('.navBtn').forEach(button=>{
      const press=()=>button.classList.add('navPressing');
      const release=()=>button.classList.remove('navPressing');
      button.addEventListener('pointerdown',press,{passive:true});
      button.addEventListener('pointerup',release,{passive:true});
      button.addEventListener('pointercancel',release,{passive:true});
      button.addEventListener('pointerleave',release,{passive:true});
      button.addEventListener('click',()=>playNav(button));
    });
  }

  function bindCategories(){
    const rail=$('#categories');
    if(!rail||rail.dataset.interfaceBound==='1') return;
    rail.dataset.interfaceBound='1';
    const update=()=>{
      const top=window.matchMedia('(max-width:700px)').matches?68:76;
      const rect=rail.getBoundingClientRect();
      rail.classList.toggle('isPinned',rect.top<=top+1);
      document.body.classList.toggle('wvScrolled',window.scrollY>32);
    };
    window.addEventListener('scroll',update,{passive:true});
    window.addEventListener('resize',update,{passive:true});
    update();
    const centerActive=()=>$('.tab.active',rail)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
    const observer=new MutationObserver(()=>requestAnimationFrame(centerActive));
    observer.observe(rail,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    rail.addEventListener('wheel',event=>{
      if(Math.abs(event.deltaY)>Math.abs(event.deltaX)) rail.scrollLeft+=event.deltaY;
    },{passive:true});
  }

  function install(){
    if(installed) return;
    installed=true;
    bindAmbient();
    bindNav();
    bindCategories();
    syncFromHero();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  setTimeout(install,900);
})();
