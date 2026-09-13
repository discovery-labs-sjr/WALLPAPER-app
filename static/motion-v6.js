/* WALLVERSE motion v6 — reliable click/touch animations */
(() => {
  const nav = document.querySelector('.bottomNav');
  if (!nav) return;

  function animateIcon(button){
    const icon = button.querySelector('.navIcon');
    if (!icon || !icon.animate) return;

    const tab = button.dataset.tab;
    const keyframes = {
      home: [
        {transform:'rotate(0deg) scale(1)'},
        {transform:'rotate(190deg) scale(1.08)',offset:.45},
        {transform:'rotate(320deg) scale(1.03)',offset:.78},
        {transform:'rotate(360deg) scale(1)'}
      ],
      explore: [
        {transform:'scale(1) rotate(0deg)'},
        {transform:'scale(1.16) rotate(-5deg)',offset:.35},
        {transform:'scale(.95) rotate(3deg)',offset:.65},
        {transform:'scale(1) rotate(0deg)'}
      ],
      live: [
        {transform:'scale(1)'},
        {transform:'scale(1.18)',offset:.28},
        {transform:'scale(.94)',offset:.48},
        {transform:'scale(1.08)',offset:.68},
        {transform:'scale(1)'}
      ],
      favorites: [
        {transform:'scale(1)'},
        {transform:'scale(1.22)',offset:.24},
        {transform:'scale(.91)',offset:.45},
        {transform:'scale(1.10)',offset:.67},
        {transform:'scale(1)'}
      ],
      inspiration: [
        {transform:'scale(1) rotate(0deg)'},
        {transform:'scale(1.13) rotate(4deg)',offset:.38},
        {transform:'scale(.95) rotate(-2deg)',offset:.68},
        {transform:'scale(1) rotate(0deg)'}
      ]
    }[tab];

    if (keyframes) icon.animate(keyframes,{duration:620,easing:'cubic-bezier(.22,.82,.22,1)',fill:'none'});

    if (tab === 'inspiration') {
      const squares = icon.querySelectorAll('rect');
      const moves = [[10,10],[-10,10],[10,-10],[-10,-10]];
      squares.forEach((square,index) => {
        if (!square.animate) return;
        const [x,y] = moves[index] || [0,0];
        square.animate([
          {transform:'translate(0,0)'},
          {transform:`translate(${x}px,${y}px)`,offset:.5},
          {transform:'translate(0,0)'}
        ],{duration:520,easing:'cubic-bezier(.2,.8,.2,1)',fill:'none'});
      });
    }
  }

  nav.addEventListener('pointerdown', event => {
    const button = event.target.closest('.navBtn');
    if (button) button.classList.add('navPressing');
  }, {passive:true});

  nav.addEventListener('pointerup', event => {
    const button = event.target.closest('.navBtn');
    if (!button) return;
    button.classList.remove('navPressing');
    animateIcon(button);
  }, {passive:true});

  nav.addEventListener('pointercancel', event => {
    const button = event.target.closest('.navBtn');
    if (button) button.classList.remove('navPressing');
  }, {passive:true});

  nav.addEventListener('click', event => {
    const button = event.target.closest('.navBtn');
    if (button) animateIcon(button);
  });

  // Splash: split the existing wordmark into individual characters without changing its text.
  const logo = document.querySelector('.splashNativeLogo');
  const wordmark = logo?.querySelector('.splashWordmark');
  if (logo && wordmark && !wordmark.dataset.motionReady) {
    const parts = Array.from(wordmark.children);
    let index = 0;
    parts.forEach(part => {
      const text = part.textContent || '';
      part.textContent = '';
      [...text].forEach(char => {
        const span = document.createElement('span');
        span.className = 'splashLetter';
        span.textContent = char === ' ' ? '\u00a0' : char;
        span.style.setProperty('--letter-index', index++);
        if (part.classList.contains('brandAccent')) span.classList.add('brandAccent');
        part.appendChild(span);
      });
    });
    wordmark.dataset.motionReady = 'true';
    requestAnimationFrame(() => logo.classList.add('splashLettersReady'));
  }
})();
