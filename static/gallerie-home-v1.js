(() => {
  "use strict";

  const CATEGORY_MAP = {
    Aesthetic: "Aesthetic",
    Voitures: "Cars",
    Animaux: "Animals",
    Sport: "Sport",
    Musique: "Music",
    Espace: "Space",
    Noir: "Noir",
    "Ville & Nuit": "City & Night",
    Technologie: "Technology",
    Art: "Art",
    Anime: "Anime",
    "Jeux vidéo": "Video Games",
    Nature: "Nature"
  };

  const CATEGORY_BY_LABEL = Object.fromEntries(Object.entries(CATEGORY_MAP).map(([fr, en]) => [en, fr]));
  const ORDER = [
    "Hot", "Aesthetic", "Locked In",
    "Animals", "Anime", "Art", "Cars", "City & Night", "Music", "Nature", "Noir", "Space", "Sport", "Technology", "Video Games"
  ];

  let allWallpapers = [];
  let active = "Hot";
  let booted = false;
  let rendering = false;
  let observer = null;

  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));

  function englishCategory(category) {
    return CATEGORY_MAP[category] || category || "Aesthetic";
  }

  function imageOf(w) {
    return w?.preview || w?.file || "";
  }

  function isHomeVisible() {
    const activeTab = $(".navBtn.active")?.dataset.tab;
    return !activeTab || activeTab === "home";
  }

  function hotItems() {
    return [...allWallpapers].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);
  }

  function lockedItems() {
    // Editorial collection: static, lock-screen-friendly walls first.
    return [...allWallpapers]
      .filter(w => String(w.type || "static").toLowerCase() !== "live")
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 10);
  }

  function categoryItems(label) {
    if (label === "Hot") return hotItems();
    if (label === "Locked In") return lockedItems();
    const original = CATEGORY_BY_LABEL[label];
    return allWallpapers.filter(w => w.category === original);
  }

  function filteredBySearch(items) {
    const input = $("#search");
    const query = input?.value.trim().toLowerCase() || "";
    if (!query) return items;
    return items.filter(w => [w.title, w.category, englishCategory(w.category), ...(w.tags || [])].join(" ").toLowerCase().includes(query));
  }

  function card(w) {
    const image = imageOf(w);
    const live = String(w.type || "").toLowerCase() === "live";
    return `<article class="wvCard ${live ? "is-live" : ""}" data-id="${esc(w.id)}" tabindex="0" aria-label="${esc(w.title)}">
      <div class="wvPoster" style="background-image:url('${esc(image)}')"></div>
      <img loading="lazy" src="${esc(image)}" alt="${esc(w.title)}" onerror="this.onerror=null;this.style.display='none'">
      ${live ? '<span class="wvLiveBadge">LIVE</span>' : ''}
      <button class="wvHeart" type="button" data-heart="${esc(w.id)}" aria-label="Favorite">♡</button>
      <div class="wvCardMeta"><strong>${esc(w.title)}</strong><small>${esc(englishCategory(w.category))}</small></div>
    </article>`;
  }

  function section(label, items) {
    const visible = filteredBySearch(items).slice(0, 10);
    if (!visible.length) return "";
    return `<section class="wvRailSection" data-section="${esc(label)}">
      <div class="wvHomeIntro"><h1>${esc(label)}</h1><button class="wvSeeAll" type="button" data-see-all="${esc(label)}">See All</button></div>
      <div class="wvRail" aria-label="${esc(label)} wallpapers">${visible.map(card).join("")}</div>
    </section>`;
  }

  function renderCategories() {
    const root = $("#categories");
    if (!root) return;
    root.innerHTML = ORDER.map(label => `<button class="tab ${label === active ? "active" : ""}" type="button" data-wv-category="${esc(label)}">${esc(label)}</button>`).join("");
    root.querySelectorAll("[data-wv-category]").forEach(button => {
      button.addEventListener("click", () => {
        active = button.dataset.wvCategory || "Hot";
        renderCategories();
        renderHome();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function renderHome() {
    if (!isHomeVisible()) return;
    const root = $("#sections");
    if (!root) return;
    rendering = true;
    try {
      const query = $("#search")?.value.trim() || "";
      if (query) {
        const results = filteredBySearch(allWallpapers).slice(0, 30);
        root.innerHTML = results.length
          ? section("Search", results)
          : '<div class="wvResultsEmpty"><strong>No wallpapers found</strong>Try another search.</div>';
        return;
      }
      if (active !== "Hot") {
        root.innerHTML = section(active, categoryItems(active)) || '<div class="wvResultsEmpty"><strong>No wallpapers yet</strong>More wallpapers are coming soon.</div>';
        return;
      }
      root.innerHTML = ["Hot", ...ORDER.slice(1)].map(label => section(label, categoryItems(label))).join("");
    } finally {
      rendering = false;
    }
  }

  function bindCards() {
    const root = $("#sections");
    if (!root) return;
    root.querySelectorAll(".wvCard").forEach(article => {
      const open = () => {
        const id = article.dataset.id;
        if (typeof window.openViewer === "function") window.openViewer(id);
      };
      article.addEventListener("click", event => {
        if (event.target.closest("[data-heart]")) return;
        open();
      });
      article.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
      });
      article.querySelector("[data-heart]")?.addEventListener("click", event => {
        event.stopPropagation();
        const id = event.currentTarget.dataset.heart;
        if (typeof window.toggleFavorite === "function") window.toggleFavorite(id);
      });
    });
    root.querySelectorAll("[data-see-all]").forEach(button => {
      button.addEventListener("click", () => {
        active = button.dataset.seeAll || "Hot";
        renderCategories();
        renderHome();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  }

  function applyBodyMode() {
    document.body.classList.add("wvGalleryHome");
    $("#liveSection")?.classList.add("hidden");
    $("#inspiration")?.classList.add("hidden");
  }

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
      applyBodyMode();
      // Existing app scripts can rerender #sections after login/favorites/search.
      // Re-apply our presentation without changing the source data.
      requestAnimationFrame(() => {
        if (!rendering && isHomeVisible()) { renderHome(); bindCards(); }
      });
    });
    observer.observe(root, { childList: true, subtree: false });
  }

  document.addEventListener("DOMContentLoaded", boot, { once: true });
  window.addEventListener("load", () => { if (!booted) boot(); }, { once: true });
  document.addEventListener("input", event => {
    if (event.target?.id === "search" && isHomeVisible()) {
      renderHome();
      bindCards();
    }
  });
})();
