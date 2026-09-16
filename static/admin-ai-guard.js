(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const bad = /^(\d+[\s_-]*)+$|^[a-f0-9]{8,}$/i;
  const hasLetters = /[A-Za-zÀ-ÖØ-öø-ÿ]{3,}/;
  const fallback = () => {
    const category = $('#category')?.value || 'Aesthetic';
    const tags = ($('#tags')?.value || '').split(',').map(s => s.trim()).filter(Boolean);
    const useful = tags.find(t => hasLetters.test(t));
    if (useful) return `${useful} ${category}`.replace(/\s+/g, ' ').trim();
    return category === 'Noir' ? 'Midnight Contrast' : `${category} Collection`;
  };
  const sanitize = () => {
    const input = $('#title');
    if (!input) return;
    const value = String(input.value || '').trim().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
    if (!value || bad.test(value) || !hasLetters.test(value)) input.value = fallback();
  };
  const analysis = $('#analysis');
  if (analysis) new MutationObserver(sanitize).observe(analysis, { childList:true, subtree:true, characterData:true });
  $('#publishBtn')?.addEventListener('click', sanitize, true);
  $('#uploadForm')?.addEventListener('submit', sanitize, true);
  $('#image')?.addEventListener('change', () => setTimeout(sanitize, 1500));
  setInterval(sanitize, 1800);
})();
