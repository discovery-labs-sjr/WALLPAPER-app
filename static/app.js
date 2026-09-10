const $ = (selector, root = document) => root.querySelector(selector);

let wallpapers = [];
let activeCategory = "Tous";
let favorites = new Set(JSON.parse(localStorage.getItem("wallverse_favorites") || "[]"));
let current = null;
let user = null;
let authMode = "login";
let currentTab = "home";

const categories = [
  "Tous","Aesthetic","Nature","Voitures","Animaux","Sport","Musique",
  "Espace","Noir","Ville & Nuit","Technologie","Art","Anime","Jeux vidéo"
];

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[char]));

const imageOf = wallpaper => wallpaper?.preview || wallpaper?.file || "";

const setCssImage = (element, variable, url) => {
  if (element && url) {
    element.style.setProperty(variable, `url("${String(url).replace(/"/g, '\\"')}")`);
  }
};

const csrf = () => {
  const item = document.cookie.split("; ").find(value => value.startsWith("wallverse_csrf="));
  return item ? decodeURIComponent(item.split("=").slice(1).join("=")) : "";
};

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

    return fetch(url, {
      ...options,
      body,
      headers,
      credentials: "include"
    });
  };

  let response = await makeRequest();

  if (response.status === 401 && !authEndpoint) {
    const refreshResponse = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": csrf() },
      credentials: "include"
    });

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

function setGuestFavorites() {
  try {
    favorites = new Set(JSON.parse(localStorage.getItem("wallverse_favorites") || "[]"));
  } catch {
    favorites = new Set();
  }
}

function renderAuth() {
  $("#authLabel").textContent = user ? user.display_name : "Connexion";
  $("#avatar").textContent = user?.display_name?.trim()?.[0]?.toUpperCase() || "W";
}

function wallpaperMatches(wallpaper, query) {
  if (!query) return true;
  const haystack = [wallpaper.title, wallpaper.category, ...(wallpaper.tags || [])].join(" ").toLowerCase();
  return haystack.includes(query);
}

function filtered() {
  const query = $("#search").value.trim().toLowerCase();
  return wallpapers.filter(w =>
    (activeCategory === "Tous" || w.category === activeCategory) &&
    wallpaperMatches(w, query)
  );
}

function card(wallpaper, featured = false) {
  const liked = favorites.has(wallpaper.id);
  const image = imageOf(wallpaper);
  const file = wallpaper.file || "";

  return `
    <article class="card ${featured ? "featured" : ""} ${wallpaper.type === "live" ? "isLive" : ""}" data-id="${esc(wallpaper.id)}">
      <div class="mediaWrap" style="--card-bg-image:url('${esc(image)}')">
        <div class="cardAmbient" aria-hidden="true"></div>
        <img loading="lazy" src="${esc(image)}" alt="${esc(wallpaper.title)}"
             onerror="this.onerror=null;this.src='${esc(file)}'">
        <div class="badges">
          <span class="qualityBadge">${esc(wallpaper.resolution || "HD")}</span>
          ${wallpaper.type === "live" ? '<span class="liveBadgeSmall">● LIVE</span>' : ""}
        </div>
      </div>
      <div class="cardMeta">
        <div>
          <strong>${esc(wallpaper.title)}</strong>
          <small>${esc(wallpaper.category)}</small>
        </div>
        <button class="heart ${liked ? "liked" : ""}" aria-label="${liked ? "Retirer des favoris" : "Ajouter aux favoris"}">${liked ? "♥" : "♡"}</button>
      </div>
    </article>
  `;
}

function section(title, items, feature = false) {
  if (!items.length) return "";
  return `
    <section class="section">
      <div class="sectionTitle">
        <h2>${esc(title)}</h2>
        <span>${items.length} ${items.length > 1 ? "wallpapers" : "wallpaper"}</span>
      </div>
      <div class="gallery">
        ${items.map((wallpaper, index) => card(wallpaper, feature && index === 0)).join("")}
      </div>
    </section>
  `;
}

function bindCards(root = document) {
  root.querySelectorAll(".card").forEach(article => {
    const id = article.dataset.id;
    article.onclick = event => {
      if (event.target.closest(".heart")) return;
      openViewer(id);
    };

    const heart = article.querySelector(".heart");
    if (heart) {
      heart.onclick = event => {
        event.stopPropagation();
        toggleFavorite(id);
      };
    }
  });
}

function updateResultsSummary(count) {
  const query = $("#search").value.trim();
  $("#resultsSummary").textContent = query || activeCategory !== "Tous"
    ? `${count} résultat${count > 1 ? "s" : ""}`
    : "Sélection quotidienne";
}

function renderSections() {
  const list = filtered();
  updateResultsSummary(list.length);

  if (!list.length) {
    $("#sections").innerHTML = "";
    $("#emptyState").classList.remove("hidden");
    return;
  }

  $("#emptyState").classList.add("hidden");

  const narrowed = activeCategory !== "Tous" || $("#search").value.trim();
  if (narrowed) {
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

  $("#sections").innerHTML = groups.map((group, index) => section(group[0], group[1], index === 0)).join("");
  bindCards($("#sections"));
}

function renderCategories() {
  $("#categories").innerHTML = categories.map(category => `
    <button class="tab ${category === activeCategory ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>
  `).join("");

  $("#categories").querySelectorAll(".tab").forEach(button => {
    button.onclick = () => {
      activeCategory = button.dataset.category;
      currentTab = "home";
      updateActiveNav("home");
      renderCategories();
      renderSections();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });
}

function renderLive() {
  const live = wallpapers.filter(w => w.type === "live");
  $("#liveGrid").innerHTML = live.length
    ? live.map(w => card(w)).join("")
    : '<div class="empty"><div class="emptyIcon">◉</div><h2>Aucun Live</h2><p>De nouveaux motion walls arrivent bientôt.</p></div>';
  bindCards($("#liveGrid"));
}

function renderInspiration() {
  const items = [...wallpapers].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  $("#inspirationGrid").innerHTML = items.map(w => `
    <article class="pin" data-id="${esc(w.id)}">
      <img loading="lazy" src="${esc(imageOf(w))}" alt="${esc(w.title)}"
           onerror="this.onerror=null;this.src='${esc(w.file || "")}'">
      <div class="pinMeta">
        <strong>${esc(w.title)}</strong>
        <small>${esc(w.category)} · ${Math.max(1, Math.round((w.likes || 0) / 1000))}k likes</small>
      </div>
    </article>
  `).join("");

  $("#inspirationGrid").querySelectorAll(".pin").forEach(pin => {
    pin.onclick = () => openViewer(pin.dataset.id);
  });
}

function updateActiveNav(tab) {
  document.querySelectorAll(".navBtn").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
}

function showTab(tab) {
  currentTab = tab;
  updateActiveNav(tab);

  $("#sections").classList.toggle("hidden", tab !== "home" && tab !== "explore" && tab !== "favorites");
  $("#inspiration").classList.toggle("hidden", tab !== "inspiration");
  $("#liveSection").classList.toggle("hidden", tab !== "live");
  $("#emptyState").classList.add("hidden");

  if (tab === "home" || tab === "explore") {
    renderSections();
    if (tab === "explore") setTimeout(() => $("#search").focus(), 0);
  } else if (tab === "live") {
    renderLive();
  } else if (tab === "inspiration") {
    renderInspiration();
  } else if (tab === "favorites") {
    showFavorites();
  }
}

function showFavorites() {
  updateActiveNav("favorites");
  $("#sections").classList.remove("hidden");
  $("#inspiration").classList.add("hidden");
  $("#liveSection").classList.add("hidden");

  const items = wallpapers.filter(w => favorites.has(w.id));
  $("#sections").innerHTML = items.length
    ? section("Mes favoris", items, true)
    : '<div class="empty"><div class="emptyIcon">♡</div><h2>Pas encore de favoris</h2><p>Ajoute les wallpapers qui te ressemblent.</p></div>';

  bindCards($("#sections"));
}

async function toggleFavorite(id) {
  if (!user) {
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);

    localStorage.setItem("wallverse_favorites", JSON.stringify([...favorites]));
    updateLike();
    if (currentTab === "favorites") showFavorites();
    else renderSections();
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
    if (currentTab === "favorites") showFavorites();
    else renderSections();
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
  viewerImage.onerror = () => {
    viewerImage.onerror = null;
    viewerImage.src = current.file || "";
  };

  $("#viewerTitle").textContent = current.title;
  $("#viewerCategory").textContent = `${current.category} · ${current.resolution || "HD"}`;
  $("#viewerTags").textContent = (current.tags || []).map(tag => `#${tag}`).join("  ");
  $("#liveBadge").classList.toggle("hidden", current.type !== "live");

  setCssImage($("#viewer"), "--viewer-bg-image", image);
  updateLike();
  $("#viewer").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function updateLike() {
  if (!current) return;
  $("#likeBtn").textContent = favorites.has(current.id) ? "♥" : "♡";
  $("#likeBtn").classList.toggle("liked", favorites.has(current.id));
}

function closeViewer() {
  $("#viewer").classList.add("hidden");
  document.body.style.overflow = "";
  current = null;
}

function openAuth(mode = "login") {
  $("#authModal").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  setAuthMode(mode);
  setTimeout(() => $("#emailInput").focus(), 0);
}

function closeAuth() {
  $("#authModal").classList.add("hidden");
  document.body.style.overflow = "";
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
  $("#authSubmit").disabled = true;
  $("#authError").textContent = "";

  try {
    const data = authMode === "register"
      ? {
          display_name: $("#nameInput").value.trim(),
          email: $("#emailInput").value.trim(),
          password: $("#passwordInput").value
        }
      : {
          email: $("#emailInput").value.trim(),
          password: $("#passwordInput").value
        };

    const path = authMode === "register" ? "/api/auth/register" : "/api/auth/login";
    user = await api(path, { method: "POST", body: data });
    const me = await api("/api/auth/me");
    favorites = new Set(me.favorites || []);
    localStorage.removeItem("wallverse_favorites");

    renderAuth();
    renderSections();
    closeAuth();
    $("#authForm").reset();
  } catch (error) {
    $("#authError").textContent = error.message;
  } finally {
    $("#authSubmit").disabled = false;
  }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } catch (error) {
    console.warn(error);
  } finally {
    user = null;
    setGuestFavorites();
    renderAuth();
    renderSections();
    updateActiveNav("home");
  }
}

function randomWallpaper() {
  if (!wallpapers.length) return;
  const index = Math.floor(Math.random() * wallpapers.length);
  openViewer(wallpapers[index].id);
}

function resetHero() {
  const cardElement = $("#heroCard");
  if (cardElement) cardElement.style.transform = "rotateX(1deg) rotateY(-11deg) rotateZ(3deg)";
}

function tiltHero(x, y) {
  const cardElement = $("#heroCard");
  if (!cardElement) return;
  cardElement.style.transform = `rotateX(${1 - y * 7}deg) rotateY(${-11 + x * 11}deg) rotateZ(${3 + x * 2.5}deg)`;
}

function initHero() {
  const stage = $("#heroStage");
  if (!stage) return;

  stage.addEventListener("pointermove", event => {
    const bounds = stage.getBoundingClientRect();
    tiltHero(
      (event.clientX - bounds.left) / bounds.width - 0.5,
      (event.clientY - bounds.top) / bounds.height - 0.5
    );
  });

  stage.addEventListener("pointerleave", resetHero);

  stage.addEventListener("click", async () => {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      try { await DeviceOrientationEvent.requestPermission(); } catch {}
    }
  }, { once: true });

  window.addEventListener("deviceorientation", event => {
    if (event.gamma == null || event.beta == null) return;
    tiltHero(
      Math.max(-0.5, Math.min(0.5, event.gamma / 45)),
      Math.max(-0.5, Math.min(0.5, (event.beta - 35) / 55))
    );
  }, { passive: true });
}

function updateBrandAmbient(wallpaper) {
  if (!wallpaper) return;
  const image = imageOf(wallpaper);
  setCssImage($("#hero"), "--hero-bg-image", image);
  setCssImage($("#heroCard"), "--hero-card-bg-image", image);
  $("#heroImage").src = image;
  $("#heroImage").onerror = () => {
    $("#heroImage").onerror = null;
    $("#heroImage").src = wallpaper.file || "";
  };
  $("#heroImage").alt = wallpaper.title;
  $("#heroTitle").textContent = wallpaper.title;
  $("#heroMeta").textContent = `${wallpaper.category} · ${wallpaper.resolution || "HD"}`;
}

function updateStats() {
  const count = wallpapers.length;
  $("#statCount").textContent = count.toLocaleString("fr-FR");
  $("#wallpaperCountPill").textContent = `${count} créations`;
}

$("#closeViewer").onclick = closeViewer;
$("#viewer").onclick = event => {
  if (event.target === $("#viewer")) closeViewer();
};
$("#closeAuth").onclick = closeAuth;
$("#authModal").onclick = event => {
  if (event.target === $("#authModal")) closeAuth();
};

$("#authBtn").onclick = () => user ? logout() : openAuth();
$("#loginTab").onclick = () => setAuthMode("login");
$("#registerTab").onclick = () => setAuthMode("register");
$("#authForm").onsubmit = submitAuth;

$("#downloadBtn").onclick = () => {
  if (!current) return;
  const anchor = document.createElement("a");
  anchor.href = `/api/wallpapers/${encodeURIComponent(current.id)}/download`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

$("#likeBtn").onclick = () => current && toggleFavorite(current.id);

$("#shareBtn").onclick = async () => {
  if (!current) return;
  try {
    const shareData = {
      title: current.title,
      text: `Découvre ${current.title} sur WALLVERSE`,
      url: `${location.origin}${location.pathname}#wallpaper=${encodeURIComponent(current.id)}`
    };
    if (navigator.share) await navigator.share(shareData);
    else await navigator.clipboard.writeText(shareData.url);
  } catch {}
};

$("#search").oninput = () => {
  if (currentTab !== "explore") updateActiveNav("explore");
  currentTab = "explore";
  $("#sections").classList.remove("hidden");
  $("#inspiration").classList.add("hidden");
  $("#liveSection").classList.add("hidden");
  renderSections();
};

$("#randomBtn").onclick = randomWallpaper;
$("#randomBtn2").onclick = randomWallpaper;
document.querySelectorAll(".navBtn").forEach(button => button.onclick = () => showTab(button.dataset.tab));

document.onkeydown = event => {
  if (event.key === "Escape") {
    closeViewer();
    closeAuth();
  }

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("#search").focus();
    updateActiveNav("explore");
    currentTab = "explore";
  }
};

async function init() {
  try {
    const response = await fetch("/api/wallpapers", { credentials: "include" });
    if (!response.ok) throw new Error(`Catalogue ${response.status}`);
    wallpapers = await response.json();

    updateBrandAmbient(wallpapers.find(w => w.category === "Voitures") || wallpapers[0]);
    updateStats();

    await fetch("/api/auth/csrf", { credentials: "include" });
    const me = await api("/api/auth/me");

    if (me.authenticated) {
      user = me.user;
      favorites = new Set(me.favorites || []);
    } else {
      setGuestFavorites();
    }

    renderAuth();
    renderCategories();
    renderSections();
    initHero();

    window.setTimeout(() => $("#splash").classList.add("hide"), 3150);
  } catch (error) {
    console.error(error);
    $("#sections").innerHTML = `
      <div class="empty">
        <div class="emptyIcon">!</div>
        <h2>Le catalogue ne répond pas</h2>
        <p>Recharge la page dans quelques secondes.</p>
      </div>
    `;
    window.setTimeout(() => $("#splash").classList.add("hide"), 1200);
  }
}

init();
