/* WALLVERSE cinematic v3 — restrained entrance timeline */
(() => {
  function run(){
    const splash = document.querySelector('#splash');
    if(!splash || splash.dataset.cinematicV3 === '1') return;
    splash.dataset.cinematicV3 = '1';
    splash.classList.add('sv2-ready');

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced){
      splash.classList.add('phase-brand','phase-settle');
      window.setTimeout(() => splash.classList.add('phase-out'), 900);
      return;
    }

    const start = performance.now();
    const frame = now => {
      const t = now - start;
      if(t >= 120) splash.classList.add('phase-brand');
      if(t >= 980) splash.classList.add('phase-settle');
      if(t >= 1580) splash.classList.add('phase-out');
      if(t < 2050) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
