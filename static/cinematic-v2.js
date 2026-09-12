/* WALLVERSE cinematic v6 — clean code-native brand entrance. */
(() => {
  function run(){
    const splash = document.querySelector('#splash');
    const logo = splash?.querySelector('.splashExactLogo');
    if(!splash || splash.dataset.cinematicV6 === '1') return;
    splash.dataset.cinematicV6 = '1';
    splash.classList.add('sv2-ready');
    splash.classList.remove('hidden','phase-out');

    if(logo){
      const base = logo.currentSrc || logo.src;
      logo.src = `${base.split('?')[0]}?v=wallverse-final-${Date.now()}`;
    }

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced){
      splash.classList.add('phase-brand','phase-settle');
      window.setTimeout(() => splash.classList.add('phase-out'), 1100);
      window.setTimeout(() => splash.classList.add('hidden'), 1500);
      return;
    }

    // Let the SVG draw itself first; the CSS class only controls the scene entrance/exit.
    window.setTimeout(() => splash.classList.add('phase-brand'), 90);
    window.setTimeout(() => splash.classList.add('phase-settle'), 2250);
    window.setTimeout(() => splash.classList.add('phase-out'), 2850);
    window.setTimeout(() => splash.classList.add('hidden'), 3300);

    const started = performance.now();
    const guard = window.setInterval(() => {
      if(performance.now() - started < 2800) splash.classList.remove('hidden','phase-out');
      else window.clearInterval(guard);
    }, 80);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
