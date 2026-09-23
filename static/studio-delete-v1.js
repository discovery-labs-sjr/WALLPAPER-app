(() => {
  const csrfToken = () => {
    const match = document.cookie.match(/(?:^|;\s*)wallverse_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  async function removeWallpaper(button) {
    const id = button.dataset.id;
    if (!id) return;
    if (!window.confirm('Supprimer définitivement ce wallpaper ? Cette action est irréversible.')) return;
    button.disabled = true;
    try {
      const response = await fetch(`/api/admin/wallpapers/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRF-Token': csrfToken() }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `Erreur ${response.status}`);
      button.closest('.item')?.remove();
      const count = document.querySelector('#count');
      if (count) count.textContent = String(document.querySelectorAll('#catalog .item').length);
    } catch (error) {
      window.alert(error.message || 'Suppression impossible.');
      button.disabled = false;
    }
  }

  function decorate() {
    document.querySelectorAll('#catalog .item').forEach(item => {
      if (item.querySelector('.deleteItem')) return;
      const edit = item.querySelector('.editItem');
      if (!edit) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'deleteItem';
      button.textContent = 'Supprimer';
      button.dataset.id = edit.dataset.id;
      button.addEventListener('click', () => removeWallpaper(button));
      edit.insertAdjacentElement('afterend', button);
    });
  }

  new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  decorate();
})();
