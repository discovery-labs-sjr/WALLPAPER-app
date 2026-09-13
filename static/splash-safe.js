/* Safe splash controller: static logo, short hold, clean exit. */
(() => {
  function run() {
    const splash = document.getElementById('splash');
    if (!splash || splash.dataset.safeSplash === '1') return;
    splash.dataset.safeSplash = '1';
    splash.classList.remove('hidden', 'phase-brand', 'phase-settle', 'phase-out');
    window.setTimeout(() => splash.classList.add('phase-out'), 1100);
    window.setTimeout(() => splash.classList.add('hidden'), 1550);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();
