(() => {
  "use strict";

  const CATEGORY_MAP = {
    Aesthetic: "Aesthetic", Voitures: "Cars", Animaux: "Animals", Sport: "Sport",
    Musique: "Music", Espace: "Space", Noir: "Noir", "Ville & Nuit": "City & Night",
    Technologie: "Technology", Art: "Art", Anime: "Anime", "Jeux vidéo": "Video Games", Nature: "Nature"
  };
  const CATEGORY_BY_LABEL = Object.fromEntries(Object.entries(CATEGORY_MAP).map(([fr, en]) => [en, fr]));
  const ORDER = [
    "Hot", "Aesthetic", "Locked In",
    "Animals", "Anime", "Art", "Cars", "City & Night", "Music", "Nature", "Noir", "Space", "Sport", "Technology", "Video Games"
  ];

  let allWallpapers = [];
  let active = "Hot";
  let mode = "all";
  let booted = false;
  let rendering = false;
  let observer = null;

  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const englishCategory = category => CATEGORY_MAP[category] || category || "Aesthetic";
  const imageOf = w => w?.preview || w?.file || "";

  function isHomeVisible() {
    const activeTab = $(".navBtn.active")?.dataset.tab;
    return !activeTab || activeTab === "home";
  }

  function hotItems() { return [...allWallpapers].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10); }
  function lockedItems() {
    return [...allWallpapers].filter(w => String(w.type || "static").toLowerCase() !== "live").sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);
  }
  function categoryItems(label) {
    if (label === "Hot") return hotItems();
    if (label === "Locked In") return lockedItems();
    const original = CATEGORY_BY_LABEL[label];
    return allWallpapers.filter(w => w.category === original);
  }
  function filteredBySearch(items) {
    const query = $("#search")?.value.trim().toLowerCase() || "";
    if (!query) return items;
    return items.filter(w => [w.title, w.category, englishCategory(w.category), ...(w.tags || [])].join(" ").toLowerCase().includes(query));
  }

  function card(w) {
    const image = imageOf(w);
    const live = String(w.type || "").toLowerCase() === "live";
    const video = w.video || w.video_url || w.motion_url || "";
    const media = video
      ? `<video class="wvMotion" muted loop autoplay playsinline preload="metadata" poster="${esc(image)}"><source src="${esc(video)}"></video>`
      : `<div class="wvPoster" style="background-image:url('${esc(image)}')"></div><img loading="lazy" src="${esc(image)}" alt="${esc(w.title)}" onerror="this.onerror=null;this.style.display='none'">`;
    return `<article class="wvCard ${live ? "is-live" : ""} ${video ? "has-video" : ""}" data-id="${esc(w.id)}" tabindex="0" aria-label="${esc(w.title)}">
      ${media}
      ${live ? '<span class="wvLiveBadge">LIVE</span>' : ''}
      <button class="wvHeart" type="button" data-heart="${esc(w.id)}" aria-label="Favorite">♡</button>
      <div class="wvCardMeta"><strong>${esc(w.title)}</strong><small>${esc(englishCategory(w.category))}</small></div>
    </article>`;
  }

  function section(label, items, showSeeAll = true) {
    const visible = filteredBySearch(items).slice(0, 10);
    if (!visible.length) return "";
    const action = showSeeAll ? `<button class="wvSeeAll" type="button" data-see-all="${esc(label)}">See All</button>` : "";
    return `<section class="wvRailSection" data-section="${esc(label)}"><div class="wvHomeIntro"><h1>${esc(label)}</h1>${action}</div><div class="wvRail" aria-label="${esc(label)} wallpapers">${visible.map(card).join("")}</div></section>`;
  }

  function renderCategories() {
    const root = $("#categories");
    if (!root) return;
    root.innerHTML = ORDER.map(label => `<button class="tab ${label === active ? "active" : ""}" type="button" data-wv-category="${esc(label)}">${esc(label)}</button>`).join("");
    root.querySelectorAll("[data-wv-category]").forEach(button => button.addEventListener("click", () => {
      active = button.dataset.wvCategory || "Hot";
      mode = "single";
      renderCategories();
      renderHome();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  }

  function renderHome() {
    if (!isHomeVisible()) return;
    const root = $("#sections");
    if (!root) return;
    rendering = true;
    const query = $("#search")?.value.trim() || "";
    if (query) {
      const results = filteredBySearch(allWallpapers).slice(0, 30);
      root.innerHTML = results.length ? section("Search", results, false) : '<div class="wvResultsEmpty"><strong>No wallpapers found</strong>Try another search.</div>';
    } else if (mode === "single") {
      root.innerHTML = section(active, categoryItems(active)) || '<div class="wvResultsEmpty"><strong>No wallpapers yet</strong>More wallpapers are coming soon.</div>';
    } else {
      root.innerHTML = ORDER.map(label => section(label, categoryItems(label))).join("");
    }
    setTimeout(() => { rendering = false; }, 0);
  }

  function bindCards() {
    const root = $("#sections");
    if (!root) return;
    root.querySelectorAll(".wvCard").forEach(article => {
      const open = () => { const id = article.dataset.id; if (typeof window.openViewer === "function") window.openViewer(id); };
      article.addEventListener("click", event => { if (!event.target.closest("[data-heart]")) open(); });
      article.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
      article.querySelector("[data-heart]")?.addEventListener("click", event => {
        event.stopPropagation();
        const id = event.currentTarget.dataset.heart;
        if (typeof window.toggleFavorite === "function") window.toggleFavorite(id);
      });
    });
    root.querySelectorAll("[data-see-all]").forEach(button => button.addEventListener("click", () => {
      active = button.dataset.seeAll || "Hot";
      mode = "single";
      renderCategories();
      renderHome();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }));
  }

  function applyBodyMode() { document.body.classList.add("wvGalleryHome"); }

  async function boot() {
    if (booted) return;
    booted = true;
    applyBodyMode();
    try {
      const response = await fetch("/api/wallpapers", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      allWallpapers = Array.isArray(data) ? data : [];
      renderCategories();
      renderHome();
      bindCards();
      observeSections();
    } catch (error) {
      console.error("WallVerse home redesign:", error);
      const root = $("#sections");
      if (root) root.innerHTML = '<div class="wvResultsEmpty"><strong>WallVerse is temporarily unavailable</strong>Please reload the page.</div>';
    }
  }

  function observeSections() {
    const root = $("#sections");
    if (!root || observer) return;
    observer = new MutationObserver(() => {
      if (rendering || !isHomeVisible()) return;
      requestAnimationFrame(() => { if (!rendering && isHomeVisible()) { renderHome(); bindCards(); } });
    });
    observer.observe(root, { childList: true });
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
  window.addEventListener("load", () => { if (!booted) boot(); }, { once: true });
  document.addEventListener("input", event => {
    if (event.target?.id === "search" && isHomeVisible()) { mode = "single"; active = "Hot"; renderHome(); bindCards(); }
  });
})();
