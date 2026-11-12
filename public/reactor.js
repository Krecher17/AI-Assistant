import { animateGrim } from './grim-sprites.mjs';
const host=document.querySelector('.core-reticle');host.querySelectorAll('.core-ring,.core-glyph').forEach(node=>node.remove());
const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Animated Grim reaper butler companion');host.append(canvas);host.classList.add('webgl-ready');host.dataset.renderer='sprite';
const sprite=animateGrim(canvas,'sleeping');document.getElementById('reactor-renderer').textContent='GRIM · DESKTOP COMPANION';
const poses={dormant:'sleeping',standby:'idle',loading:'thinking',waking:'waking',listening:'listening',thinking:'thinking',working:'working',speaking:'speaking',success:'success',error:'error'};
new MutationObserver(()=>sprite.setPose(poses[document.body.dataset.assistantState]||'idle')).observe(document.body,{attributes:true,attributeFilter:['data-assistant-state']});
window.addEventListener('beforeunload',()=>sprite.stop());
