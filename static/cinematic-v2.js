/* WALLVERSE cinematic v5 — reference-first construction, protected from legacy splash cleanup. */
(() => {
  function run(){
    const splash = document.querySelector('#splash');
    const logo = splash?.querySelector('.splashExactLogo');
    if(!splash || splash.dataset.cinematicV5 === '1') return;
    splash.dataset.cinematicV5 = '1';
    splash.classList.add('sv2-ready');
    splash.classList.remove('hidden','phase-out');

    // Always fetch a fresh copy of the construction SVG so the browser cannot keep an older W.
    if(logo){
      const base = logo.currentSrc || logo.src;
      logo.src = `${base.split('?')[0]}?v=wv-reference-${Date.now()}`;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced){
      splash.classList.add('phase-brand','phase-settle');
      window.setTimeout(() => splash.classList.add('phase-out'), 900);
      window.setTimeout(() => splash.classList.add('hidden'), 1300);
      return;
    }

    window.setTimeout(() => splash.classList.add('phase-brand'), 120);
    window.setTimeout(() => splash.classList.add('phase-settle'), 5450);
    window.setTimeout(() => splash.classList.add('phase-out'), 6480);
    window.setTimeout(() => splash.classList.add('hidden'), 6940);

    // app.js contains an older 2.3s/2.9s cleanup. Keep the reference animation alive until its own exit.
    const started = performance.now();
    const guard = window.setInterval(() => {
      if(performance.now() - started < 6250) splash.classList.remove('hidden','phase-out');
      else window.clearInterval(guard);
    }, 90);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
