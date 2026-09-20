(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (value = '') => String(value).replace(/[&<>\"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
  const state = { files: [], publishing: false };

  function mount() {
    const studio = $('#studio');
    if (!studio || $('#batchStudio')) return;

    const panel = document.createElement('section');
    panel.id = 'batchStudio';
    panel.className = 'batchStudio';
    panel.innerHTML = `
      <div class="batchHead">
        <div>
          <p class="batchEyebrow">PUBLICATION RAPIDE</p>
          <h2>Publier plusieurs contenus</h2>
          <p>Ajoute jusqu’à 20 images. WALLVERSE prépare automatiquement les tags et la catégorie, sans te demander de nommer chaque image.</p>
        </div>
        <span class="batchBadge">LOT · RAPIDE</span>
      </div>
      <div class="batchControls">
        <label>Type de contenu
          <select id="batchKind">
            <option value="wallpaper">Fond d’écran</option>
            <option value="profile">Profil / avatar WhatsApp</option>
          </select>
        </label>
        <label>Plateforme
          <select id="batchPlatform">
            <option value="mobile">Téléphone</option>
            <option value="desktop">Ordinateur</option>
            <option value="both">Téléphone + ordinateur</option>
          </select>
        </label>
        <label>Catégorie
          <select id="batchCategory">
            <option>Aesthetic</option><option>Nature</option><option>Voitures</option><option>Animaux</option><option>Sport</option><option>Musique</option><option>Espace</option><option>Noir</option><option>Ville & Nuit</option><option>Technologie</option><option>Art</option><option>Anime</option><option>Jeux vidéo</option><option>Profils</option>
          </select>
        </label>
      </div>
      <label class="batchPicker">
        <input id="batchFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple>
        <strong>＋ Sélectionner les images</strong>
        <small>Choisis 1, 5 ou 10 images à la fois. Les informations sont préparées automatiquement.</small>
      </label>
      <div id="batchQueue" class="batchQueue" aria-live="polite"></div>
      <div class="batchActions">
        <div id="batchProgress" class="batchProgress">Aucun fichier sélectionné.</div>
        <button id="batchPublish" class="batchPublish" type="button" disabled>Publier le lot</button>
      </div>
      <div id="batchNotice" class="batchNotice hidden" role="status"></div>
    `;

    const grid = $('.grid', studio);
    studio.insertBefore(panel, grid || studio.firstChild);
    $('#batchFiles', panel).addEventListener('change', event => addFiles(event.target.files));
    $('#batchKind', panel).addEventListener('change', syncKind);
    $('#batchPublish', panel).addEventListener('click', publishBatch);
    syncKind();
  }

  function syncKind() {
    const profile = $('#batchKind')?.value === 'profile';
    const category = $('#batchCategory');
    const platform = $('#batchPlatform');
    if (!category || !platform) return;
    if (profile) {
      category.value = 'Profils';
      category.disabled = true;
      platform.value = 'mobile';
      platform.disabled = true;
    } else {
      category.disabled = false;
      platform.disabled = false;
      if (category.value === 'Profils') category.value = 'Aesthetic';
    }
  }

  function addFiles(fileList) {
    const incoming = [...(fileList || [])].filter(file => file.type.startsWith('image/'));
    const merged = [...state.files, ...incoming];
    state.files = merged.filter((file, index, all) => index === all.findIndex(other => other.name === file.name && other.size === file.size)).slice(0, 20);
    renderQueue();
    $('#batchFiles').value = '';
  }

  function renderQueue() {
    const queue = $('#batchQueue');
    const button = $('#batchPublish');
    const progress = $('#batchProgress');
    if (!queue || !button || !progress) return;
    queue.innerHTML = state.files.map((file, index) => {
      const url = URL.createObjectURL(file);
      return `<article class="batchFile"><img src="${url}" alt=""><div><strong>Image ${index + 1}</strong><small>${(file.size / 1048576).toFixed(1)} Mo</small></div><button class="batchRemove" type="button" data-index="${index}" aria-label="Retirer">×</button></article>`;
    }).join('');
    $$('.batchRemove', queue).forEach(button => button.addEventListener('click', () => {
      state.files.splice(Number(button.dataset.index), 1);
      renderQueue();
    }));
    progress.textContent = state.files.length ? `${state.files.length} image(s) prête(s) à publier.` : 'Aucun fichier sélectionné.';
    button.disabled = !state.files.length || state.publishing;
  }

  function notice(message, error = false) {
    const box = $('#batchNotice');
    if (!box) return;
    box.classList.remove('hidden', 'error');
    box.classList.toggle('error', error);
    box.textContent = message;
  }

  async function publishBatch() {
    if (!state.files.length || state.publishing) return;
    state.publishing = true;
    const button = $('#batchPublish');
    const progress = $('#batchProgress');
    button.disabled = true;
    button.textContent = 'Publication…';
    notice('WALLVERSE prépare et enregistre les images. Ne ferme pas cette page.');
    const form = new FormData();
    state.files.forEach(file => form.append('files', file, file.name));
    form.append('content_kind', $('#batchKind').value);
    form.append('target_platform', $('#batchPlatform').value);
    form.append('category', $('#batchCategory').value);
    form.append('enhance', 'true');
    try {
      const result = await api('/api/admin/wallpapers/batch-upload', {method: 'POST', body: form});
      const message = `${result.published || 0} publié(s) · ${result.failed || 0} échec(s).`;
      progress.textContent = message;
      notice(message + (result.failed ? ' Vérifie les fichiers signalés dans la réponse du serveur.' : ' Toutes les images ont été enregistrées.'), Boolean(result.failed));
      if (!result.failed) state.files = [];
      renderQueue();
      if (typeof loadCatalog === 'function') await loadCatalog();
    } catch (error) {
      notice(error.message || 'La publication du lot a échoué.', true);
      progress.textContent = 'Échec de la publication.';
    } finally {
      state.publishing = false;
      button.disabled = !state.files.length;
      button.textContent = 'Publier le lot';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
