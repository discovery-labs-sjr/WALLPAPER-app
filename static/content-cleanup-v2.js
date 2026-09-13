/* WALLVERSE content cleanup — wallpaper first. */
(() => {
  const genericLabel = /^(image\s*4k|image\s*hd|wallpaper\s*4k|wallpaper\s*hd|hd|4k|live|live\s*wallpaper|wallpaper\s*live)$/i;
  const selectors = ["#hero", "#sections", "#inspiration", "#liveSection"];
  function clean(root = document){
    selectors.forEach(selector => {
      root.querySelectorAll?.(`${selector} *`).forEach(node => {
        if(node.children.length === 0 && genericLabel.test((node.textContent || "").trim())){
          node.textContent = "";
          node.setAttribute("aria-hidden", "true");
          node.style.display = "none";
        }
      });
    });
  }
  function start(){
    clean();
    const observer = new MutationObserver(() => clean());
    observer.observe(document.body, {subtree:true, childList:true, characterData:true});
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once:true});
  else start();
})();
