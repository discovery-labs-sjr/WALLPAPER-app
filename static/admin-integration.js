/* WALLVERSE admin entry — backend remains the authority. */
(() => {
  const button = document.getElementById('adminEntry');
  if (!button) return;
  let lastState = null;

  async function checkAdmin() {
    try {
      const response = await fetch('/api/admin/me', { credentials: 'include', cache: 'no-store' });
      const isAdmin = response.ok;
      if (isAdmin !== lastState) {
        lastState = isAdmin;
        button.classList.toggle('isVisible', isAdmin);
        button.setAttribute('aria-hidden', isAdmin ? 'false' : 'true');
      }
    } catch {
      if (lastState !== false) {
        lastState = false;
        button.classList.remove('isVisible');
        button.setAttribute('aria-hidden', 'true');
      }
    }
  }

  button.addEventListener('click', () => { window.location.href = '/admin'; });
  checkAdmin();
  window.setInterval(checkAdmin, 4000);
})();
