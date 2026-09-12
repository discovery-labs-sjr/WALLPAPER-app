(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const imageOf = wallpaper => wallpaper?.preview || wallpaper?.file || "";
  let slides = [];
  let index = 0;
  let timer = null;
  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let intent = "none";
  let moved = false;
  let gyroActive = false;
  let gyroX = 0;
  let gyroY = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function resetTransform() {
    const card = $("#heroCard");
    if (!card) return;
    card.classList.remove("heroTouching", "heroDragging");
    card.style.transform = "rotateX(1deg) rotateY(-9deg) rotateZ(2deg) scale(1)";
  }

  function tilt(x, y, scale = 1) {
    const card = $("#heroCard");
    if (!card) return;
    const tx = clamp(x, -0.5, 0.5);
    const ty = clamp(y, -0.5, 0.5);
    const sx = clamp(scale, 1, 1.035);
    card.style.transform = `rotateX(${clamp(1 - ty * 7, -3.5, 5.5)}deg) rotateY(${clamp(-9 + tx * 10, -14, -4)}deg) rotateZ(${clamp(2 + tx * 2, 0, 4)}deg) scale(${sx})`;
  }

  function renderDots() {
    const dots = $("#heroDots");
    if (!dots) return;
    dots.innerHTML = slides.map((_, i) => `<button class="heroDot ${i === index ? "active" : ""}" data-hero-index="${i}" aria-label="Wallpaper ${i + 1}"></button>`).join("");
  }

  function renderCurrent() {
    if (!slides.length) return;
    index = (index + slides.length) % slides.length;
    const wallpaper = slides[index];
    const image = imageOf(wallpaper);
    const heroImage = $("#heroImage");
    const hero = $("#hero");
    const card = $("#heroCard");
    if (!heroImage || !hero || !card) return;
    heroImage.src = image;
    heroImage.alt = wallpaper.title || "Wallpaper vedette";
    $("#heroTitle").textContent = wallpaper.title || "Wallpaper vedette";
    const likes = Number(wallpaper.likes || 0);
    $(".heroCardLabel span").textContent = "TENDANCE";
    $("#heroMeta").textContent = `${wallpaper.category || "WALLVERSE"}${likes ? ` • ${likes} favoris` : ""}`;
    hero.style.setProperty("--hero-bg-image", `url("${String(image).replace(/"/g, '\\"')}")`);
    card.style.setProperty("--hero-card-bg-image", `url("${String(image).replace(/"/g, '\\"')}")`);
    renderDots();
    resetTransform();
  }

  function next(direction = 1) {
    if (!slides.length) return;
    index = (index + direction + slides.length) % slides.length;
    renderCurrent();
  }

  function scheduleAuto() {
    clearInterval(timer);
    timer = setInterval(() => next(1), 7000);
  }

  async function loadPopularSlides() {
    try {
      const response = await fetch("/api/wallpapers", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      slides = [...data]
        .sort((a, b) => {
          const likeDiff = Number(b.likes || 0) - Number(a.likes || 0);
          if (likeDiff) return likeDiff;
          return Number(b.downloads || 0) - Number(a.downloads || 0);
        })
        .slice(0, 8);
      if (!slides.length) return;
      index = 0;
      renderCurrent();
      scheduleAuto();
    } catch (error) {
      console.warn("WALLVERSE hero popularity unavailable", error);
    }
  }

  function bindDots() {
    const dots = $("#heroDots");
    if (!dots || dots.dataset.heroV2Bound) return;
    dots.dataset.heroV2Bound = "1";
    dots.addEventListener("click", event => {
      const dot = event.target.closest(".heroDot");
      if (!dot) return;
      event.stopPropagation();
      const nextIndex = Number(dot.dataset.heroIndex);
      if (Number.isFinite(nextIndex)) {
        index = nextIndex;
        renderCurrent();
        scheduleAuto();
      }
    });
  }

  function bindTouch() {
    const stage = $("#heroStage");
    const card = $("#heroCard");
    if (!stage || !card || stage.dataset.heroTouchV2) return;
    stage.dataset.heroTouchV2 = "1";

    stage.style.touchAction = "pan-y";

    stage.addEventListener("pointerdown", event => {
      if (event.pointerType === "mouse" || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = lastX = event.clientX;
      startY = lastY = event.clientY;
      intent = "none";
      moved = false;
      card.classList.add("heroTouching");
      clearInterval(timer);
    }, { passive: true });

    stage.addEventListener("pointermove", event => {
      if (pointerId !== event.pointerId) return;
      lastX = event.clientX;
      lastY = event.clientY;
      const dx = lastX - startX;
      const dy = lastY - startY;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (intent === "none" && Math.max(absX, absY) > 8) {
        intent = absX > absY ? "horizontal" : "vertical";
        moved = true;
      }

      if (intent === "horizontal") {
        event.preventDefault();
        card.classList.add("heroDragging");
        const rect = stage.getBoundingClientRect();
        const localX = (event.clientX - rect.left) / rect.width - 0.5;
        const localY = (event.clientY - rect.top) / rect.height - 0.5;
        tilt(localX, localY, 1.03);
        card.style.transform += ` translateX(${clamp(dx * 0.08, -14, 14)}px)`;
      } else if (intent === "none") {
        const rect = stage.getBoundingClientRect();
        tilt((event.clientX - rect.left) / rect.width - 0.5, (event.clientY - rect.top) / rect.height - 0.5, 1.025);
      }
    }, { passive: false });

    const finish = event => {
      if (pointerId !== event.pointerId) return;
      const dx = lastX - startX;
      pointerId = null;
      card.classList.remove("heroDragging");
      card.classList.remove("heroTouching");
      if (intent === "horizontal" && Math.abs(dx) > 48) {
        next(dx < 0 ? 1 : -1);
      } else {
        resetTransform();
        scheduleAuto();
      }
      intent = "none";
    };

    stage.addEventListener("pointerup", finish, { passive: true });
    stage.addEventListener("pointercancel", finish, { passive: true });
    stage.addEventListener("pointerleave", event => {
      if (pointerId == null && event.pointerType === "mouse") resetTransform();
    }, { passive: true });

    stage.addEventListener("click", event => {
      if (event.target.closest(".heroDot") || moved) return;
      const heroImage = $("#heroImage");
      if (heroImage && typeof window.openViewer === "function") {
        const title = $("#heroTitle")?.textContent || "";
        const selected = slides.find(item => item.title === title) || slides[index];
        if (selected?.id != null) window.openViewer(selected.id);
      }
    });
  }

  function bindGyroscope() {
    const stage = $("#heroStage");
    if (!stage || stage.dataset.heroGyroV2) return;
    stage.dataset.heroGyroV2 = "1";

    const onOrientation = event => {
      if (event.gamma == null || event.beta == null) return;
      gyroActive = true;
      const targetX = clamp(event.gamma / 45, -0.5, 0.5);
      const targetY = clamp((event.beta - 35) / 55, -0.5, 0.5);
      gyroX += (targetX - gyroX) * 0.12;
      gyroY += (targetY - gyroY) * 0.12;
      if (pointerId == null) tilt(gyroX, gyroY, 1);
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });

    stage.addEventListener("click", async () => {
      if (!window.DeviceOrientationEvent || typeof window.DeviceOrientationEvent.requestPermission !== "function") return;
      try {
        const result = await window.DeviceOrientationEvent.requestPermission();
        if (result === "granted") window.addEventListener("deviceorientation", onOrientation, { passive: true });
      } catch {}
    }, { once: true });
  }

  function boot() {
    bindTouch();
    bindDots();
    bindGyroscope();
    loadPopularSlides();
    setTimeout(() => {
      bindDots();
      if (!slides.length) loadPopularSlides();
    }, 1200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
