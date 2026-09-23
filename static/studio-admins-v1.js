(() => {
  const $ = (s) => document.querySelector(s);
  const escapeHtml = (v = '') => String(v).replace(/[&<>'\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
  let csrf = '';
  async function loadCsrf() { await fetch('/api/auth/csrf', {credentials:'include'}); csrf = document.cookie.split('; ').find(x => x.startsWith('wallverse_csrf='))?.split('=').slice(1).join('=') || ''; }
  async function request(url, options = {}) {
    const response = await fetch(url, {credentials:'include', ...options, headers:{...(options.headers || {}), ...(options.method && options.method !== 'GET' ? {'X-CSRF-Token': csrf} : {})}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Erreur ${response.status}`);
    return data;
  }
  function mount() {
    const studio = $('#studio');
    if (!studio || $('#adminManagement')) return;
    studio.insertAdjacentHTML('beforeend', `<section id="adminManagement" class="panel" style="margin-top:18px"><div class="panelTop"><div><p class="eyebrow">CONTRÔLE PRINCIPAL</p><h2>Administrateurs</h2></div><span class="pill">OWNER</span></div><p class="status">Ajoute ou retire les administrateurs secondaires. Ton compte principal est protégé.</p><form id="adminAddForm" class="row"><label>Adresse e-mail<input id="adminEmail" type="email" required placeholder="admin@exemple.com"></label><button class="primary" type="submit">Ajouter</button></form><div id="adminStatus" class="status"></div><div id="adminList"></div></section>`);
    $('#adminAddForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = $('#adminEmail').value.trim();
      try { await request('/api/admin/administrators', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({email})}); $('#adminEmail').value=''; $('#adminStatus').textContent='Administrateur ajouté ✓'; await render(); }
      catch (error) { $('#adminStatus').textContent = error.message; }
    });
  }
  async function render() {
    const list = $('#adminList'); if (!list) return;
    try {
      const admins = await request('/api/admin/administrators');
      list.innerHTML = admins.map(item => `<div class="row" style="align-items:center;justify-content:space-between;border-top:1px solid rgba(255,255,255,.08);padding:12px 0"><div><strong>${escapeHtml(item.email)}</strong><small style="display:block;opacity:.7">${item.role === 'owner' ? 'Administrateur principal' : 'Administrateur secondaire'}</small></div>${item.protected ? '<span class="pill">Protégé</span>' : `<button type="button" class="secondary" data-remove-admin="${escapeHtml(item.email)}">Retirer</button>`}</div>`).join('');
      list.querySelectorAll('[data-remove-admin]').forEach(button => button.addEventListener('click', async () => {
        const email = button.dataset.removeAdmin;
        if (!confirm(`Retirer ${email} du Studio ?`)) return;
        try { await request(`/api/admin/administrators/${encodeURIComponent(email)}`, {method:'DELETE'}); $('#adminStatus').textContent='Administrateur retiré ✓'; await render(); }
        catch (error) { $('#adminStatus').textContent = error.message; }
      }));
    } catch (error) { list.innerHTML = `<div class="status">${escapeHtml(error.message)}</div>`; }
  }
  window.addEventListener('load', async () => { try { await loadCsrf(); mount(); await render(); } catch (_) {} });
})();
