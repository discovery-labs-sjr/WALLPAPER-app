(() => {
  const DOWNLOAD_URL = 'https://github.com/discovery-labs-sjr/WALLPAPER-app/releases/latest/download/WALLVERSE.apk';
  const DISMISS_KEY = 'wallverse_android_install_dismissed_v1';

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function mount() {
    if (!isAndroid() || isStandalone() || localStorage.getItem(DISMISS_KEY) === '1') return;
    if (document.getElementById('wvInstallBanner')) return;

    const banner = document.createElement('aside');
    banner.id = 'wvInstallBanner';
    banner.className = 'wvInstallBanner';
    banner.setAttribute('aria-label', 'Installer WALLVERSE');
    banner.innerHTML = `
      <div class="wvInstallIcon"><img src="/static/brand/wallverse-app-icon.svg?v=20260913-icon3" alt=""></div>
      <div class="wvInstallCopy"><strong>WALLVERSE sur ton téléphone</strong><span>Installe l'application Android gratuitement.</span></div>
      <button class="wvInstallButton" type="button">Installer</button>
      <button class="wvInstallClose" type="button" aria-label="Fermer">×</button>
    `;

    banner.querySelector('.wvInstallButton').addEventListener('click', () => {
      window.location.href = DOWNLOAD_URL;
    });
    banner.querySelector('.wvInstallClose').addEventListener('click', () => {
      localStorage.setItem(DISMISS_KEY, '1');
      banner.classList.remove('isVisible');
      window.setTimeout(() => banner.remove(), 320);
    });

    document.body.appendChild(banner);
    requestAnimationFrame(() => banner.classList.add('isVisible'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
