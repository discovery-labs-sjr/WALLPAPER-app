(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { files: [], publishing: false, editorIndex: -1, editorImage: null };

  function mount() {
    const studio = $('#studio');
    if (!studio || $('#batchStudio')) return;
    const panel = document.createElement('section');
    panel.id = 'batchStudio';
    panel.className = 'batchStudio';
    panel.innerHTML = `
      <div class="batchHead"><div><p class="batchEyebrow">PUBLICATION RAPIDE</p><h2>Publier plusieurs contenus</h2><p>Ajoute jusqu’à 20 images. Les profils sont automatiquement cadrés, avec un réglage manuel si nécessaire.</p></div><span class="batchBadge">LOT · RAPIDE</span></div>
      <div class="batchControls">
        <label>Type de contenu<select id="batchKind"><option value="wallpaper">Fond d’écran</option><option value="profile">Profil / avatar WhatsApp</option></select></label>
        <label>Plateforme<select id="batchPlatform"><option value="mobile">Téléphone</option><option value="desktop">Ordinateur</option><option value="both">Téléphone + ordinateur</option></select></label>
        <label>Catégorie<select id="batchCategory"><option>Aesthetic</option><option>Nature</option><option>Voitures</option><option>Animaux</option><option>Sport</option><option>Musique</option><option>Espace</option><option>Noir</option><option>Ville & Nuit</option><option>Technologie</option><option>Art</option><option>Anime</option><option>Jeux vidéo</option><option>Profils</option></select></label>
        <label id="batchCropLabel">Cadrage automatique<select id="batchCrop"><option value="square">Carré — avatar</option><option value="portrait">Portrait 4:5</option><option value="original">Original</option></select></label>
      </div>
      <label class="batchPicker"><input id="batchFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><strong>＋ Sélectionner les images</strong><small>Choisis 1, 5 ou 10 images à la fois. Maximum 20.</small></label>
      <div id="batchQueue" class="batchQueue" aria-live="polite"></div>
      <div class="batchActions"><div id="batchProgress" class="batchProgress">Aucun fichier sélectionné.</div><button id="batchPublish" class="batchPublish" type="button" disabled>Publier le lot</button></div>
      <div id="batchNotice" class="batchNotice hidden" role="status"></div>
      <div id="profileCropModal" class="wvCropModal hidden" role="dialog" aria-modal="true" aria-label="Ajuster le cadrage du profil">
        <div class="wvCropPanel"><div class="wvCropHead"><strong>Ajuster le profil</strong><button id="cropClose" type="button" aria-label="Fermer">×</button></div>
          <p class="wvCropHelp">Déplace l’image avec le doigt ou la souris. Utilise le zoom pour placer précisément le visage.</p>
          <div id="cropViewport" class="wvCropViewport"><img id="cropImage" alt="Aperçu du cadrage" draggable="false"></div>
          <label class="wvCropZoom">Zoom <input id="cropZoom" type="range" min="1" max="3" step="0.01" value="1"></label>
          <div class="wvCropActions"><button id="cropCancel" type="button">Annuler</button><button id="cropApply" type="button">Utiliser ce cadrage</button></div>
        </div>
      </div>`;
    const grid = $('.grid', studio);
    studio.insertBefore(panel, grid || studio.firstChild);
    $('#batchFiles', panel).addEventListener('change', event => addFiles(event.target.files));
    $('#batchKind', panel).addEventListener('change', syncKind);
    $('#batchPublish', panel).addEventListener('click', publishBatch);
    $('#cropClose', panel).addEventListener('click', closeEditor);
    $('#cropCancel', panel).addEventListener('click', closeEditor);
    $('#cropApply', panel).addEventListener('click', applyEditor);
    $('#cropZoom', panel).addEventListener('input', event => { if (state.editorIndex >= 0) { state.files[state.editorIndex].crop.zoom = Number(event.target.value); state.files[state.editorIndex].crop.manual = true; renderEditorImage(); } });
    bindEditorDrag();
    syncKind();
  }

  function syncKind() {
    const profile = $('#batchKind')?.value === 'profile';
    const category = $('#batchCategory');
    const platform = $('#batchPlatform');
    const cropLabel = $('#batchCropLabel');
    if (!category || !platform || !cropLabel) return;
    category.disabled = profile;
    platform.disabled = profile;
    cropLabel.hidden = !profile;
    if (profile) { category.value = 'Profils'; platform.value = 'mobile'; }
    else if (category.value === 'Profils') category.value = 'Aesthetic';
    renderQueue();
  }

  function addFiles(fileList) {
    const incoming = [...(fileList || [])].filter(file => file.type.startsWith('image/'));
    state.files = [...state.files, ...incoming.map(file => ({file, crop: {x: .5, y: .5, zoom: 1, manual: false}}))].filter((entry, index, all) => index === all.findIndex(other => other.file.name === entry.file.name && other.file.size === entry.file.size)).slice(0, 20);
    renderQueue();
    $('#batchFiles').value = '';
  }

  function renderQueue() {
    const queue = $('#batchQueue'); const button = $('#batchPublish'); const progress = $('#batchProgress');
    if (!queue || !button || !progress) return;
    const profile = $('#batchKind')?.value === 'profile';
    queue.innerHTML = state.files.map((entry, index) => `<article class="batchFile"><img src="${URL.createObjectURL(entry.file)}" alt=""><div><strong>Image ${index + 1}</strong><small>${(entry.file.size / 1048576).toFixed(1)} Mo</small></div>${profile ? `<button class="batchAdjust" type="button" data-index="${index}">${entry.crop.manual ? 'Cadrage réglé ✓' : 'Ajuster'}</button>` : ''}<button class="batchRemove" type="button" data-index="${index}" aria-label="Retirer">×</button></article>`).join('');
    $$('.batchRemove', queue).forEach(button => button.addEventListener('click', () => { state.files.splice(Number(button.dataset.index), 1); renderQueue(); }));
    $$('.batchAdjust', queue).forEach(button => button.addEventListener('click', () => openEditor(Number(button.dataset.index))));
    progress.textContent = state.files.length ? `${state.files.length} image(s) prête(s) à publier.` : 'Aucun fichier sélectionné.';
    button.disabled = !state.files.length || state.publishing;
  }

  function notice(message, error = false) {
    const box = $('#batchNotice'); if (!box) return;
    box.classList.remove('hidden', 'error'); box.classList.toggle('error', error); box.textContent = message;
  }

  function openEditor(index) {
    const entry = state.files[index]; if (!entry) return;
    state.editorIndex = index;
    const modal = $('#profileCropModal');
    const image = $('#cropImage');
    const zoom = $('#cropZoom');
    if (!modal || !image || !zoom) return;
    image.src = URL.createObjectURL(entry.file);
    zoom.value = String(entry.crop.zoom);
    modal.classList.remove('hidden');
    renderEditorImage();
  }

  function closeEditor() { state.editorIndex = -1; $('#profileCropModal')?.classList.add('hidden'); }

  function renderEditorImage() {
    const entry = state.files[state.editorIndex]; const image = $('#cropImage');
    if (!entry || !image) return;
    const {x, y, zoom} = entry.crop;
    image.style.transformOrigin = `${x * 100}% ${y * 100}%`;
    image.style.transform = `scale(${zoom})`;
  }

  function bindEditorDrag() {
    const viewport = $('#cropViewport');
    if (!viewport) return;
    let dragging = false; let startX = 0; let startY = 0; let initialX = .5; let initialY = .5;
    viewport.addEventListener('pointerdown', event => {
      const entry = state.files[state.editorIndex]; if (!entry) return;
      dragging = true; startX = event.clientX; startY = event.clientY; initialX = entry.crop.x; initialY = entry.crop.y; entry.crop.manual = true;
      try { viewport.setPointerCapture(event.pointerId); } catch {}
    });
    viewport.addEventListener('pointermove', event => {
      if (!dragging) return;
      const entry = state.files[state.editorIndex]; if (!entry) return;
      const zoom = Math.max(1, entry.crop.zoom);
      entry.crop.x = Math.max(0, Math.min(1, initialX - (event.clientX - startX) / Math.max(1, viewport.clientWidth) / zoom));
      entry.crop.y = Math.max(0, Math.min(1, initialY - (event.clientY - startY) / Math.max(1, viewport.clientHeight) / zoom));
      renderEditorImage();
    });
    const end = event => { dragging = false; try { viewport.releasePointerCapture(event.pointerId); } catch {} };
    viewport.addEventListener('pointerup', end); viewport.addEventListener('pointercancel', end);
  }

  function applyEditor() { closeEditor(); renderQueue(); }

  async function cropFile(entry) {
    const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = URL.createObjectURL(entry.file); });
    const size = 1000; const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
    const context = canvas.getContext('2d'); const scale = Math.max(size / image.width, size / image.height) * entry.crop.zoom; const width = image.width * scale; const height = image.height * scale;
    const offsetX = size / 2 - entry.crop.x * width; const offsetY = size / 2 - entry.crop.y * height;
    context.drawImage(image, offsetX, offsetY, width, height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .94));
    if (!blob) throw new Error('Cadrage impossible');
    return new File([blob], `${entry.file.name.replace(/\.[^.]+$/, '')}-profile.webp`, {type: 'image/webp'});
  }

  async function publishBatch() {
    if (!state.files.length || state.publishing) return;
    state.publishing = true;
    const button = $('#batchPublish'); const progress = $('#batchProgress');
    button.disabled = true; button.textContent = 'Publication…'; notice('WALLVERSE prépare et enregistre les images.');
    const form = new FormData(); const profile = $('#batchKind').value === 'profile';
    try {
      for (const entry of state.files) form.append('files', profile && entry.crop.manual ? await cropFile(entry) : entry.file, entry.file.name);
      form.append('content_kind', $('#batchKind').value);
      form.append('target_platform', $('#batchPlatform').value);
      form.append('category', $('#batchCategory').value);
      form.append('crop_mode', profile && state.files.some(entry => entry.crop.manual) ? 'original' : $('#batchCrop').value);
      form.append('enhance', 'true');
      const result = await api('/api/admin/wallpapers/batch-upload', {method: 'POST', body: form});
      const message = `${result.published || 0} publié(s) · ${result.failed || 0} échec(s).`;
      progress.textContent = message;
      notice(message + (result.failed ? ' Certains fichiers n’ont pas été acceptés.' : ' Toutes les images ont été enregistrées.'), Boolean(result.failed));
      if (!result.failed) state.files = [];
      renderQueue();
      if (typeof loadCatalog === 'function') await loadCatalog();
    } catch (error) {
      notice(error.message || 'La publication du lot a échoué.', true); progress.textContent = 'Échec de la publication.';
    } finally {
      state.publishing = false; button.disabled = !state.files.length; button.textContent = 'Publier le lot';
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
