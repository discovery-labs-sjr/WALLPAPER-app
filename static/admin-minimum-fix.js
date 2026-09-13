// WallVerse Studio: align the browser-side resolution display with the backend minimum.
const WV_MIN_LONG=2340, WV_MIN_SHORT=1080;
const wvResolutionText=()=>{
  const box=document.querySelector('#resolutionInfo');
  if(!box)return;
  const text=box.textContent||'';
  const m=text.match(/Résolution détectée\s*:\s*(\d+)\s*[×x]\s*(\d+)/i);
  if(!m)return;
  const w=Number(m[1]),h=Number(m[2]),long=Math.max(w,h),short=Math.min(w,h),ok=long>=WV_MIN_LONG&&short>=WV_MIN_SHORT;
  box.innerHTML=`<strong>Résolution détectée : ${w} × ${h}px</strong><br><span>${ok?'✓ Résolution suffisante pour WallVerse':'⚠ Résolution insuffisante — minimum requis : 1080 × 2340px'}</span>`;
  box.classList.toggle('bad',!ok);
};
const wvImage=document.querySelector('#image');
if(wvImage)wvImage.addEventListener('change',()=>setTimeout(wvResolutionText,0));
