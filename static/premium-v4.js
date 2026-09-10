(() => {
  const $ = (s, root = document) => root.querySelector(s);
  function boot(){
    const legacy = $('#splash');
    if (legacy) { legacy.classList.add('phase-out','hidden'); legacy.setAttribute('aria-hidden','true'); }
    const intro = document.createElement('div');
    intro.id = 'wvIntro';
    intro.innerHTML = '<div class="wvIntroScene"><img class="wvIntroW" src="/static/brand/wallverse-video-w.svg" alt=""><div class="wvIntroTrail"></div><div class="wvIntroStar"><span></span></div><div class="wvIntroWord"><img src="/static/brand/wallverse-video-wordmark.svg" alt=""></div><p class="wvIntroSub">DES FONDS D’ÉCRAN QUI TE RESSEMBLENT</p></div>';
    document.body.appendChild(intro);
    const w=$('.wvIntroW',intro), word=$('.wvIntroWord',intro), star=$('.wvIntroStar',intro), trail=$('.wvIntroTrail',intro), sub=$('.wvIntroSub',intro);
    requestAnimationFrame(()=>w.classList.add('is-visible'));
    setTimeout(()=>w.classList.add('is-pulse'),850);
    setTimeout(()=>{ star.classList.add('is-travel'); trail.classList.add('is-travel'); word.classList.add('is-revealed'); },1220);
    setTimeout(()=>{ star.classList.remove('is-travel'); star.classList.add('is-settle'); sub.classList.add('is-visible'); },2400);
    setTimeout(()=>intro.classList.add('is-out'),3650);
    setTimeout(()=>intro.remove(),4300);
    document.querySelectorAll('button').forEach(btn=>{if(btn.textContent.trim()==='Surprise moi')btn.textContent='Surprise-moi';});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
