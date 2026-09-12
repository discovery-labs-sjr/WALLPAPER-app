/* WALLVERSE cinematic v4 — let the reference construction breathe for the full 6.6s sequence. */
(() => {
  function run(){
    const splash = document.querySelector('#splash');
    if(!splash || splash.dataset.cinematicV4 === '1') return;
    splash.dataset.cinematicV4 = '1';
    splash.classList.add('sv2-ready');
    splash.classList.remove('hidden','phase-out');

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(reduced){
      splash.classList.add('phase-brand','phase-settle');
      window.setTimeout(() => splash.classList.add('phase-out'), 900);
      window.setTimeout(() => splash.classList.add('hidden'), 1300);
      return;
    }

    window.setTimeout(() => splash.classList.add('phase-brand'), 120);
    // app.js still has legacy 2.3s/2.9s cleanup timers; cancel their visual effect here.
    window.setTimeout(() => splash.classList.remove('phase-out'), 2350);
    window.setTimeout(() => splash.classList.remove('hidden','phase-out'), 3000);
    window.setTimeout(() => splash.classList.add('phase-settle'), 5450);
    window.setTimeout(() => splash.classList.add('phase-out'), 6480);
    window.setTimeout(() => splash.classList.add('hidden'), 6940);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',run,{once:true});
  else run();
})();
