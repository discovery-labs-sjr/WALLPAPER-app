/* WALLVERSE cinematic v2 — deterministic entrance timeline */
(() => {
  const run = () => {
    const splash = document.querySelector('#splash');
    if (!splash || splash.dataset.cinematicV2 === '1') return;
    splash.dataset.cinematicV2 = '1';
    splash.classList.add('sv2-ready');

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      splash.classList.add('phase-brand', 'phase-settle', 'sv2-progress');
      return;
    }

    const t0 = performance.now();
    const tick = () => {
      const t = performance.now() - t0;
      if (t >= 160) splash.classList.add('phase-brand');
      if (t >= 980) splash.classList.add('sv2-progress');
      if (t >= 1550) splash.classList.add('phase-settle');
      if (t < 2300) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
