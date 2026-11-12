export const POSES = { sleeping: [0,0], idle: [4,0], waking: [0,1], listening: [4,1], thinking: [0,2], working: [4,2], speaking: [0,3], success: [4,3], error: [0,2], waiting: [4,2], returning: [0,1] };
export function spriteRect(pose, frame, width, height) {
  const [column,row] = POSES[pose] || POSES.idle, cellWidth = width / 8, cellHeight = height / 4;
  return { x: (column + (frame % 4)) * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight };
}
export function animateGrim(canvas, initial = 'idle') {
  const image = new Image(); let pose=initial,frame=0,timer,stopped=false,visible=true,ready=false;
  const context=canvas.getContext('2d');canvas.dataset.sprite='loading';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const observer=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible)schedule(0)});observer.observe(canvas);
  function schedule(delay){clearTimeout(timer);if(!stopped&&ready&&visible&&!document.hidden&&window.grimDashboardVisible!==false)timer=setTimeout(draw,delay)}
  function draw(){
    if(stopped||!ready||!visible||document.hidden||window.grimDashboardVisible===false)return;
    const size=Math.max(32,Math.min(448,Math.round((canvas.clientWidth||180)*Math.min(devicePixelRatio,1.25))));
    if(canvas.width!==size){canvas.width=size;canvas.height=size}
    const rect=spriteRect(pose,reduced.matches?0:frame++,image.naturalWidth,image.naturalHeight);
    context.clearRect(0,0,size,size);context.imageSmoothingEnabled=true;
    context.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,size,size);
    if(!reduced.matches)schedule(['sleeping','idle'].includes(pose)?800:180);
  }
  const onVisibility=()=>{clearTimeout(timer);if(!document.hidden)schedule(0)};document.addEventListener('visibilitychange',onVisibility);window.addEventListener('grim-dashboard-visibility',onVisibility);
  image.onload=()=>{ready=true;canvas.dataset.sprite='ready';schedule(0)};image.onerror=()=>{canvas.dataset.sprite='error'};image.src='/assets/grim-atlas.png';
  return{setPose(value){if(pose!==value){pose=value;frame=0;schedule(0)}},stop(){stopped=true;clearTimeout(timer);observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('grim-dashboard-visibility',onVisibility)},image};
}
