/* WALLVERSE motion v8 — final deterministic interaction layer */
(() => {
  const nav = document.querySelector('.bottomNav');
  if (!nav) return;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function play(button){
    const icon=button.querySelector('.navIcon');
    if(!icon || !icon.animate || reduced) return;
    const frames={
      home:[{transform:'rotate(0) scale(1)'},{transform:'rotate(360deg) scale(1.06)',offset:.72},{transform:'rotate(360deg) scale(1)'}],
      explore:[{transform:'scale(1)'},{transform:'scale(1.18) rotate(-5deg)',offset:.35},{transform:'scale(.96) rotate(3deg)',offset:.68},{transform:'scale(1)'}],
      live:[{transform:'scale(1)'},{transform:'scale(1.22)',offset:.3},{transform:'scale(.94)',offset:.52},{transform:'scale(1.08)',offset:.72},{transform:'scale(1)'}],
      favorites:[{transform:'scale(1)'},{transform:'scale(1.24)',offset:.25},{transform:'scale(.9)',offset:.47},{transform:'scale(1.1)',offset:.7},{transform:'scale(1)'}],
      inspiration:[{transform:'scale(1)'},{transform:'scale(1.13) rotate(3deg)',offset:.38},{transform:'scale(.95) rotate(-2deg)',offset:.68},{transform:'scale(1)'}]
    }[button.dataset.tab];
    if(!frames) return;
    icon.getAnimations().forEach(a=>a.cancel());
    icon.animate(frames,{duration:600,easing:'cubic-bezier(.16,.84,.2,1)',fill:'none'});
    if(button.dataset.tab==='inspiration'){
      const moves=[[9,9],[-9,9],[9,-9],[-9,-9]];
      icon.querySelectorAll('rect').forEach((square,i)=>{
        square.getAnimations?.().forEach(a=>a.cancel());
        const [x,y]=moves[i]||[0,0];
        square.animate([{transform:'translate(0,0)'},{transform:`translate(${x}px,${y}px)`,offset:.5},{transform:'translate(0,0)'}],{duration:540,easing:'cubic-bezier(.2,.8,.2,1)',fill:'none'});
      });
    }
  }
  nav.addEventListener('click',e=>{const b=e.target.closest('.navBtn');if(b)play(b)});
})();
