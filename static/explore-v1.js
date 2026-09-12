/* WALLVERSE discovery shell — focused Explore mode */
(() => {
  let sortMode = 'popular';
  let catalogCache = null;
  let initialized = false;
  let originalShowTab = null;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function ensureShell() {
    if ($('#discoveryShell')) return;
    const intro = $('.sectionIntro');
    if (!intro) return;
    const shell = document.createElement('div');
    shell.id = 'discoveryShell';
    shell.className = 'discoveryShell';
    shell.innerHTML = `
      <div class="discoveryShellTop">
        <div class="discoveryShellTitle">
          <p class="eyebrow">EXPLORE</p>
          <h2>Trouve ton prochain wallpaper.</h2>
        </div>
        <span class="discoveryCount" id="discoveryCount"></span>
      </div>
      <div class="discoverySort" role="tablist" aria-label="Trier les wallpapers">
        <button type="button" data-sort="popular" class="active" role="tab" aria-selected="true">Populaires</button>
        <button type="button" data-sort="recent" role="tab" aria-selected="false">Récents</button>
        <button type="button" data-sort="az" role="tab" aria-selected="false">A → Z</button>
      </div>`;
    intro.insertAdjacentElement('afterend', shell);
    $$('.discoverySort button', shell).forEach(btn => btn.addEventListener('click', () => {
      sortMode = btn.dataset.sort;
      $$('.discoverySort button', shell).forEach(b => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      applySort();
    }));
  }

  async function loadCatalog() {
    if (catalogCache) return catalogCache;
    try {
      const response = await fetch('/api/wallpapers', { cache: 'no-store' });
      if (!response.ok) throw new Error('catalog');
      catalogCache = await response.json();
    } catch {
      catalogCache = [];
    }
    return catalogCache;
  }

  function getCatalogRank(wallpaper) {
    if (!wallpaper) return 0;
    return Number(wallpaper.likes || 0);
  }

  function sortCurrentGallery() {
    const sections = $('#sections');
    if (!sections) return;
    const gallery = sections.querySelector('.gallery');
    if (!gallery) return;
    const map = new Map((catalogCache || []).map(w => [String(w.id), w]));
    const cards = $$('.card', gallery).map(card => ({
      card,
      wallpaper: map.get(String(card.dataset.id)) || null,
      title: (card.querySelector('strong')?.textContent || '').trim()
    }));
    cards.sort((a, b) => {
      if (sortMode === 'az') return a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
      if (sortMode === 'recent') {
        const ad = String(a.wallpaper?.created_at || a.wallpaper?.updated_at || a.wallpaper?.id || '');
        const bd = String(b.wallpaper?.created_at || b.wallpaper?.updated_at || b.wallpaper?.id || '');
        return bd.localeCompare(ad);
      }
      return getCatalogRank(b.wallpaper) - getCatalogRank(a.wallpaper);
    });
    cards.forEach(({ card }) => gallery.appendChild(card));
    const count = $('#discoveryCount');
    if (count) count.textContent = `${cards.length} wallpapers`;
  }

  function refreshAfterRender() {
    ensureShell();
    if (document.body.classList.contains('wvExplore')) {
      loadCatalog().then(sortCurrentGallery);
    }
  }

  function setMode(tab) {
    document.body.classList.toggle('wvExplore', tab === 'explore');
    document.body.classList.toggle('wvFocused', ['explore', 'live', 'inspiration', 'favorites'].includes(tab));
    ensureShell();
    if (tab === 'explore') {
      const count = $('#discoveryCount');
      if (count) count.textContent = 'Catalogue';
      loadCatalog().then(sortCurrentGallery);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function install() {
    if (initialized) return;
    originalShowTab = window.showTab;
    if (typeof originalShowTab !== 'function') return;
    initialized = true;
    ensureShell();
    window.showTab = function(tab) {
      originalShowTab(tab);
      setMode(tab);
      if (tab === 'explore') setTimeout(refreshAfterRender, 0);
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
  setTimeout(install, 1200);
})();
