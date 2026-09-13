// WallVerse Studio: source minimum is 1080x2000; output optimization can normalize smaller portrait sources later.
const WV_MIN_LONG=2000, WV_MIN_SHORT=1080;
const wvResolutionText=()=>{
  const box=document.querySelector('#resolutionInfo');
  if(!box)return;
  const text=box.textContent||'';
  const m=text.match(/Résolution détectée\s*:\s*(\d+)\s*[×x]\s*(\d+)/i);
  if(!m)return;
  const w=Number(m[1]),h=Number(m[2]),long=Math.max(w,h),short=Math.min(w,h),ok=long>=WV_MIN_LONG&&short>=WV_MIN_SHORT;
  box.innerHTML=`<strong>Résolution détectée : ${w} × ${h}px</strong><br><span>${ok?'✓ Source acceptée — optimisation automatique WallVerse':'⚠ Résolution insuffisante — minimum source : 1080 × 2000px'}</span>`;
  box.classList.toggle('bad',!ok);
};
const wvImage=document.querySelector('#image');
if(wvImage)wvImage.addEventListener('change',()=>setTimeout(wvResolutionText,0));
