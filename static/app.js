const $ = (selector, root = document) => root.querySelector(selector);

let wallpapers = [];
let activeCategory = "Tous";
let favorites = new Set();
let current = null;
let user = null;
let authMode = "login";
let currentTab = "home";
let heroIndex = 0;
let heroPointerStartX = 0;
let heroPointerDown = false;
let heroAutoTimer = null;

const categories = [
  "Tous", "Aesthetic", "Nature", "Voitures", "Animaux", "Sport", "Musique",
  "Espace", "Noir", "Ville & Nuit", "Technologie", "Art", "Anime", "Jeux vidéo"
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
}[char]));

const imageOf = wallpaper => wallpaper?.preview || wallpaper?.file || "";

function setCssImage(element, variable, url) {
  if (element && url) {
    element.style.setProperty(variable, `url("${String(url).replace(/"/g, '\\"')}")`);
  }
}

function csrf() {
  const item = document.cookie.split("; ").find(value => value.startsWith("wallverse_csrf="));
  return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : "";
}

async function api(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const authEndpoint = /^\/api\/auth\/(login|register|refresh|logout|csrf)$/.test(url);
  const makeRequest = () => {
    const headers = { ...(options.headers || {}) };
    if (method !== "GET") headers["X-CSRF-Token"] = csrf();
    let body = options.body;
    if (body && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    return fetch(url, { ...options, body, headers, credentials: "include" });
  };
  let response = await makeRequest();
  if (response.status === 401 && !authEndpoint) {
    const refreshResponse = await fetch("/api/auth/refresh", { method: "POST", headers: { "X-CSRF-Token": csrf() }, credentials: "include" });
    if (refreshResponse.ok) response = await makeRequest();
  }
  if (!response.ok) {
    let data = {};
    try { data = await response.json(); } catch {}
    throw new Error(data.detail || `Erreur ${response.status}`);
  }
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") || "";
  return type.includes("application/json") ? response.json() : response.text();
}

function loadGuestFavorites() {
  try { favorites = new Set(JSON.parse(localStorage.getItem("wallverse_favorites") || "[]")); }
  catch { favorites = new Set(); }
}

function renderAuth() {
  $("#authLabel").textContent = user ? user.display_name : "Connexion";
  $("#avatar").textContent = user?.display_name?.trim()?.[0]?.toUpperCase() || "W";
}

function filtered() {
  const query = $("#search").value.trim().toLowerCase();
  return wallpapers.filter(w => {
    const categoryMatch = activeCategory === "Tous" || w.category === activeCategory;
    const haystack = [w.title, w.category, ...(w.tags || [])].join(" ").toLowerCase();
    return categoryMatch && (!query || haystack.includes(query));
  });
}

function card(wallpaper, featured = false) {
  const image = imageOf(wallpaper);
  const file = wallpaper.file || "";
  const liked = favorites.has(wallpaper.id);
  return `
    <article class="card ${featured ? "featured" : ""} ${wallpaper.type === "live" ? "isLive" : ""}" data-id="${esc(wallpaper.id)}">
      <div class="mediaWrap" style="--card-bg-image:url('${esc(image)}')">
        <div class="cardAmbient" aria-hidden="true"></div>
        <img loading="lazy" src="${esc(image)}" alt="${esc(wallpaper.title)}" onerror="this.onerror=null;this.src='${esc(file)}'">
      </div>
      <div class="cardMeta">
        <div><strong>${esc(wallpaper.title)}</strong><small>${esc(wallpaper.category)}</small></div>
        <button class="heart ${liked ? "liked" : ""}" aria-label="${liked ? "Retirer des favoris" : "Ajouter aux favoris"}">${liked ? "♥" : "♡"}</button>
      </div>
    </article>`;
}

function section(title, items, featured = false) {
  if (!items.length) return "";
  return `<section class="section"><div class="sectionTitle"><h2>${esc(title)}</h2></div><div class="gallery">${items.map((w, i) => card(w, featured && i === 0)).join("")}</div></section>`;
}

function bindCards(root = document) {
  root.querySelectorAll(".card").forEach(article => {
    const id = article.dataset.id;
    article.addEventListener("click", event => { if (!event.target.closest(".heart")) openViewer(id); });
    article.querySelector(".heart")?.addEventListener("click", event => { event.stopPropagation(); toggleFavorite(id); });
  });
}

function renderSections() {
  const list = filtered();
  const query = $("#search").value.trim();
  $("#resultsSummary").textContent = query || activeCategory !== "Tous" ? "Résultats" : "Sélection quotidienne";
  if (!list.length) {
    $("#sections").innerHTML = "";
    $("#emptyState").classList.remove("hidden");
    return;
  }
  $("#emptyState").classList.add("hidden");
  if (activeCategory !== "Tous" || query) {
    $("#sections").innerHTML = section(activeCategory === "Tous" ? "Résultats" : activeCategory, list, true);
    bindCards($("#sections"));
    return;
  }
  const popular = [...wallpapers].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);
  const groups = [
    ["Tendances maintenant", popular],
    ["Aesthetic", wallpapers.filter(w => w.category === "Aesthetic")],
    ["Voitures", wallpapers.filter(w => w.category === "Voitures")],
    ["Nature", wallpapers.filter(w => w.category === "Nature")],
    ["Espace", wallpapers.filter(w => w.category === "Espace")],
    ["Anime", wallpapers.filter(w => w.category === "Anime")],
    ["Noir & Chrome", wallpapers.filter(w => w.category === "Noir")],
    ["Ville & Nuit", wallpapers.filter(w => w.category === "Ville & Nuit")],
    ["Technologie", wallpapers.filter(w => w.category === "Technologie")],
    ["Sport", wallpapers.filter(w => w.category === "Sport")]
  ];
  $("#sections").innerHTML = groups.map((g, i) => section(g[0], g[1], i === 0)).join("");
  bindCards($("#sections"));
}

function renderCategories() {
  $("#categories").innerHTML = categories.map(category => `<button class="tab ${category === activeCategory ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("");
  $("#categories").querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    updateNav("home");
    renderCategories();
    renderSections();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
}

function renderLive() {
  const live = wallpapers.filter(w => w.type === "live");
  $("#liveGrid").innerHTML = live.length ? live.map(w => card(w)).join("") : '<div class="empty"><div class="emptyIcon">◉</div><h2>Aucun Live</h2><p>De nouveaux motion walls arrivent bientôt.</p></div>';
  bindCards($("#liveGrid"));
}

function renderInspiration() {
  const items = [...wallpapers].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  $("#inspirationGrid").innerHTML = items.map(w => `<article class="pin" data-id="${esc(w.id)}"><img loading="lazy" src="${esc(imageOf(w))}" alt="${esc(w.title)}" onerror="this.onerror=null;this.src='${esc(w.file || "")}'"><div class="pinMeta"><strong>${esc(w.title)}</strong><small>${esc(w.category)}</small></div></article>`).join("");
  $("#inspirationGrid").querySelectorAll(".pin").forEach(pin => pin.addEventListener("click", () => openViewer(pin.dataset.id)));
}

function updateNav(tab) {
  currentTab = tab;
  document.querySelectorAll(".navBtn").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
}

function showTab(tab) {
  updateNav(tab);
  $("#sections").classList.toggle("hidden", !["home", "explore", "favorites"].includes(tab));
  $("#inspiration").classList.toggle("hidden", tab !== "inspiration");
  $("#liveSection").classList.toggle("hidden", tab !== "live");
  $("#emptyState").classList.add("hidden");
  if (tab === "home" || tab === "explore") {
    renderSections();
    if (tab === "explore") setTimeout(() => $("#search").focus(), 0);
  } else if (tab === "live") renderLive();
  else if (tab === "inspiration") renderInspiration();
  else if (tab === "favorites") showFavorites();
}

function showFavorites() {
  updateNav("favorites");
  $("#sections").classList.remove("hidden");
  $("#inspiration").classList.add("hidden");
  $("#liveSection").classList.add("hidden");
  const items = wallpapers.filter(w => favorites.has(w.id));
  $("#sections").innerHTML = items.length ? section("Mes favoris", items, true) : '<div class="empty"><div class="emptyIcon">♡</div><h2>Pas encore de favoris</h2><p>Ajoute les wallpapers qui te ressemblent.</p></div>';
  bindCards($("#sections"));
}

async function toggleFavorite(id) {
  if (!user) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    localStorage.setItem("wallverse_favorites", JSON.stringify([...favorites]));
    updateLike();
    currentTab === "favorites" ? showFavorites() : renderSections();
    return;
  }
  try {
    if (favorites.has(id)) {
      await api(`/api/favorites/${encodeURIComponent(id)}`, { method: "DELETE" });
      favorites.delete(id);
    } else {
      await api("/api/favorites", { method: "POST", body: { wallpaper_id: id } });
      favorites.add(id);
    }
    updateLike();
    currentTab === "favorites" ? showFavorites() : renderSections();
  } catch (error) {
    if (/Authentification/i.test(error.message)) openAuth();
    else console.error(error);
  }
}

function openViewer(id) {
  current = wallpapers.find(w => w.id === id);
  if (!current) return;
  const image = imageOf(current);
  const viewerImage = $("#viewerImg");
  viewerImage.src = image;
  viewerImage.alt = current.title;
  viewerImage.onerror = () => { viewerImage.onerror = null; viewerImage.src = current.file || ""; };
  $("#viewerTitle").textContent = current.title;
  $("#viewerCategory").textContent = current.category;
  $("#viewerTags").textContent = (current.tags || []).map(tag => `#${tag}`).join("  ");
  $("#liveBadge").classList.toggle("hidden", current.type !== "live");
  setCssImage($("#viewer"), "--viewer-bg-image", image);
  updateLike();
  $("#viewer").classList.remove("hidden");
  $("#viewer").setAttribute("aria-hidden", "false");
  document.body.classList.add("modalOpen");
}

function closeViewer() {
  $("#viewer").classList.add("hidden");
  $("#viewer").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");
  current = null;
}

function updateLike() {
  if (!current) return;
  const liked = favorites.has(current.id);
  $("#likeBtn").textContent = liked ? "♥" : "♡";
  $("#likeBtn").classList.toggle("liked", liked);
  $("#likeBtn").setAttribute("aria-label", liked ? "Retirer des favoris" : "Ajouter aux favoris");
}

function openAuth(mode = "login") {
  setAuthMode(mode);
  $("#authModal").classList.remove("hidden");
  $("#authModal").setAttribute("aria-hidden", "false");
  document.body.classList.add("modalOpen");
  setTimeout(() => $("#emailInput").focus(), 0);
}

function closeAuth() {
  $("#authModal").classList.add("hidden");
  $("#authModal").setAttribute("aria-hidden", "true");
  document.body.classList.remove("modalOpen");
}

function setAuthMode(mode) {
  authMode = mode;
  const register = mode === "register";
  $("#authTitle").textContent = register ? "Créer ton compte." : "Bienvenue.";
  $("#nameField").classList.toggle("hidden", !register);
  $("#nameInput").required = register;
  $("#passwordInput").autocomplete = register ? "new-password" : "current-password";
  $("#authSubmit").textContent = register ? "Créer mon compte" : "Se connecter";
  $("#loginTab").classList.toggle("active", !register);
  $("#registerTab").classList.toggle("active", register);
  $("#authError").textContent = "";
}

async function submitAuth(event) {
  event.preventDefault();
  const submit = $("#authSubmit");
  submit.disabled = true;
  $("#authError").textContent = "";
  try {
    const data = authMode === "register"
      ? { display_name: $("#nameInput").value.trim(), email: $("#emailInput").value.trim(), password: $("#passwordInput").value }
      : { email: $("#emailInput").value.trim(), password: $("#passwordInput").value };
    user = await api(authMode === "register" ? "/api/auth/register" : "/api/auth/login", { method: "POST", body: data });
    const me = await api("/api/auth/me");
    favorites = new Set(me.favorites || []);
    localStorage.removeItem("wallverse_favorites");
    renderAuth();
    closeAuth();
    $("#authForm").reset();
    renderSections();
  } catch (error) {
    $("#authError").textContent = error.message;
  } finally {
    submit.disabled = false;
  }
}

async function logout() {
  try { await api("/api/auth/logout", { method: "POST" }); }
  catch (error) { console.error(error); }
  user = null;
  loadGuestFavorites();
  renderAuth();
  renderSections();
}

function randomWallpaper() {
  if (!wallpapers.length) return;
  openViewer(wallpapers[Math.floor(Math.random() * wallpapers.length)].id);
}

function heroSlides() {
  const preferred = wallpapers.filter(w => ["Voitures", "Nature", "Aesthetic", "Ville & Nuit"].includes(w.category));
  return preferred.length ? preferred.slice(0, Math.min(8, preferred.length)) : wallpapers.slice(0, 8);
}

function renderHero() {
  const slides = heroSlides();
  if (!slides.length) return;
  heroIndex = (heroIndex + slides.length) % slides.length;
  const wallpaper = slides[heroIndex];
  const image = imageOf(wallpaper);
  $("#heroImage").src = image;
  $("#heroImage").alt = wallpaper.title;
  $("#heroTitle").textContent = wallpaper.title;
  $("#heroMeta").textContent = wallpaper.category;
  setCssImage($("#hero"), "--hero-bg-image", image);
  setCssImage($("#heroCard"), "--hero-card-bg-image", image);
  renderHeroDots(slides.length);
  resetHero();
}

function renderHeroDots(count) {
  $("#heroDots").innerHTML = Array.from({ length: count }, (_, i) => `<button class="heroDot ${i === heroIndex ? "active" : ""}" data-hero-index="${i}" aria-label="Wallpaper ${i + 1}"></button>`).join("");
  $("#heroDots").querySelectorAll(".heroDot").forEach(dot => dot.addEventListener("click", event => {
    event.stopPropagation();
    heroIndex = Number(dot.dataset.heroIndex);
    renderHero();
  }));
}

function nextHero(direction = 1) {
  const slides = heroSlides();
  if (!slides.length) return;
  heroIndex = (heroIndex + direction + slides.length) % slides.length;
  renderHero();
}

function resetHero() {
  const cardElement = $("#heroCard");
  if (cardElement) cardElement.style.transform = "rotateX(1deg) rotateY(-9deg) rotateZ(2deg)";
}

function tiltHero(x, y) {
  const cardElement = $("#heroCard");
  if (!cardElement) return;
  cardElement.style.transform = `rotateX(${1 - y * 7}deg) rotateY(${-9 + x * 10}deg) rotateZ(${2 + x * 2}deg)`;
}

function initHeroInteraction() {
  const stage = $("#heroStage");
  if (!stage) return;
  stage.addEventListener("pointerdown", event => {
    heroPointerDown = true;
    heroPointerStartX = event.clientX;
    stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener("pointermove", event => {
    const rect = stage.getBoundingClientRect();
    tiltHero((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5);
  });
  stage.addEventListener("pointerup", event => {
    const dx = event.clientX - heroPointerStartX;
    heroPointerDown = false;
    if (Math.abs(dx) > 55) nextHero(dx < 0 ? 1 : -1);
  });
  stage.addEventListener("pointercancel", () => { heroPointerDown = false; resetHero(); });
  stage.addEventListener("pointerleave", () => { if (!heroPointerDown) resetHero(); });
  window.addEventListener("deviceorientation", event => {
    if (event.gamma == null || event.beta == null) return;
    tiltHero(Math.max(-0.5, Math.min(0.5, event.gamma / 45)), Math.max(-0.5, Math.min(0.5, (event.beta - 35) / 55)));
  });
  clearInterval(heroAutoTimer);
  heroAutoTimer = setInterval(() => nextHero(1), 6500);
}

function initSplash() {
  const splash = $("#splash");
  const path = $("#splashWPath");
  const letters = document.querySelectorAll(".logoLetter");
  const diamond = $("#splashDiamond");
  const trail = $("#diamondTrail");
  if (!splash || !path) return;
  try {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
  } catch {}
  const start = performance.now();
  const timeline = () => {
    const elapsed = performance.now() - start;
    if (elapsed >= 120) splash.classList.add("phase-w");
    if (elapsed >= 900) splash.classList.add("phase-draw-word");
    if (elapsed >= 1120) {
      splash.classList.add("phase-travel");
      diamond.classList.add("traveling");
      trail.classList.add("traveling");
      letters.forEach((letter, index) => setTimeout(() => letter.classList.add("revealed"), index * 95));
    }
    if (elapsed >= 1880) splash.classList.add("phase-settle");
    if (elapsed >= 2300) splash.classList.add("phase-out");
    if (elapsed < 2550) requestAnimationFrame(timeline);
  };
  requestAnimationFrame(timeline);
}

function bindGlobalEvents() {
  $("#closeViewer").addEventListener("click", closeViewer);
  $("#viewer").addEventListener("click", event => { if (event.target === $("#viewer")) closeViewer(); });
  $("#closeAuth").addEventListener("click", closeAuth);
  $("#authModal").addEventListener("click", event => { if (event.target === $("#authModal")) closeAuth(); });
  $("#authBtn").addEventListener("click", () => user ? logout() : openAuth());
  $("#loginTab").addEventListener("click", () => setAuthMode("login"));
  $("#registerTab").addEventListener("click", () => setAuthMode("register"));
  $("#authForm").addEventListener("submit", submitAuth);
  $("#likeBtn").addEventListener("click", () => current && toggleFavorite(current.id));
  $("#shareBtn").addEventListener("click", async () => {
    if (!current) return;
    try {
      if (navigator.share) await navigator.share({ title: current.title, text: `Découvre ${current.title} sur WALLVERSE`, url: location.href });
      else await navigator.clipboard.writeText(location.href);
    } catch {}
  });
  $("#downloadBtn").addEventListener("click", () => {
    if (!current) return;
    const link = document.createElement("a");
    link.href = `/api/wallpapers/${encodeURIComponent(current.id)}/download`;
    link.download = `${current.slug || current.id}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
  $("#randomBtn").addEventListener("click", randomWallpaper);
  $("#randomBtn2").addEventListener("click", randomWallpaper);
  $("#heroRandom").addEventListener("click", randomWallpaper);
  $("#heroExplore").addEventListener("click", () => showTab("explore"));
  $("#search").addEventListener("input", () => showTab("explore"));
  document.querySelectorAll(".navBtn").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") { closeViewer(); closeAuth(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); $("#search").focus(); }
  });
}

async function requestMotionPermission() {
  if (typeof DeviceOrientationEvent === "undefined" || typeof DeviceOrientationEvent.requestPermission !== "function") return;
  try { await DeviceOrientationEvent.requestPermission(); } catch {}
}

async function init() {
  initSplash();
  bindGlobalEvents();
  $("#heroStage").addEventListener("click", requestMotionPermission, { once: true });
  try {
    wallpapers = await fetch("/api/wallpapers", { cache: "no-store" }).then(response => {
      if (!response.ok) throw new Error("Catalogue indisponible");
      return response.json();
    });
    loadGuestFavorites();
    await fetch("/api/auth/csrf", { credentials: "include" });
    const me = await api("/api/auth/me");
    if (me.authenticated) {
      user = me.user;
      favorites = new Set(me.favorites || []);
    }
    renderAuth();
    renderCategories();
    renderHero();
    renderSections();
    initHeroInteraction();
  } catch (error) {
    console.error(error);
    $("#sections").innerHTML = '<div class="empty"><div class="emptyIcon">!</div><h2>Catalogue indisponible</h2><p>Impossible de charger les wallpapers pour le moment.</p></div>';
  } finally {
    setTimeout(() => $("#splash")?.classList.add("phase-out"), 2300);
    setTimeout(() => $("#splash")?.classList.add("hidden"), 2900);
  }
}

// Small public bridge for progressive UI modules (viewer, gestures, etc.).
// Getters keep the bridge synchronized with the live application state.
try {
  Object.defineProperties(window, {
    wallpapers: { configurable: true, get: () => wallpapers },
    current: { configurable: true, get: () => current }
  });
  Object.assign(window, { openViewer, closeViewer, toggleFavorite });
} catch {}

init();
