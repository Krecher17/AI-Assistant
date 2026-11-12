const { BrowserWindow, screen } = require('electron');
const path = require('node:path');
function clamp(value,min,max){return Math.min(Math.max(value,min),Math.max(min,max))}
function position(cursor, work, width, height) { return { x: Math.round(clamp(cursor.x + 14, work.x, work.x + work.width - width)), y: Math.round(clamp(cursor.y + 12, work.y, work.y + work.height - height)), width, height }; }
class Companion {
  constructor(origin, preload) {
    this.active=false;this.enabled=true;this.phase='idle';this.timer=null;this.returnAt=0;
    this.win=new BrowserWindow({width:76,height:84,show:false,frame:false,transparent:true,hasShadow:false,resizable:false,focusable:false,skipTaskbar:true,alwaysOnTop:true,backgroundColor:'#00000000',webPreferences:{preload,contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
    this.win.setIgnoreMouseEvents(true,{forward:true});this.win.setAlwaysOnTop(true,'screen-saver');
    this.win.webContents.setWindowOpenHandler(()=>({action:'deny'}));this.win.webContents.on('will-navigate',event=>event.preventDefault());
    this.win.loadURL(origin+'/companion').then(()=>{this.ready=true;this.send({phase:'idle'});this.win.showInactive()});
    this.loop=setInterval(()=>this.tick(),50);
  }
  send(state){if(this.ready&&!this.win.isDestroyed())this.win.webContents.send('companion-state',state)}
  tick(){
    if(!this.enabled||this.win.isDestroyed())return;
    const cursor=screen.getCursorScreenPoint(),work=screen.getDisplayNearestPoint(cursor).workArea;
    if(!this.active){const bounds=position(cursor,work,76,84);if(!this.lastBounds||bounds.x!==this.lastBounds.x||bounds.y!==this.lastBounds.y||this.lastBounds.width!==76){this.win.setBounds(bounds,false);this.lastBounds=bounds}}
    else if(this.phase==='returning'){
      const target=position(cursor,work,360,360),current=this.win.getBounds();this.win.setPosition(Math.round(current.x+(target.x-current.x)*.18),Math.round(current.y+(target.y-current.y)*.18),false);
    }
  }
  update(input){
    if(!this.enabled)return;
    const phase=input.phase,message=String(input.message||'').slice(0,320);
    if(phase==='waking'){
      clearTimeout(this.timer);this.active=true;this.phase=phase;
      const cursor=screen.getCursorScreenPoint(),work=screen.getDisplayNearestPoint(cursor).workArea,bounds=position({x:cursor.x-185,y:cursor.y-245},work,360,360);
      this.lastBounds=bounds;this.win.setBounds(bounds,false);this.win.showInactive();this.send({phase,message,origin:{x:cursor.x-bounds.x,y:cursor.y-bounds.y}});return;
    }
    if(['standby','dormant','paused'].includes(phase)){
      if(this.active&&this.phase!=='waiting')this.finish();else if(!this.active){this.phase='idle';this.send({phase:'idle'})}return;
    }
    if(!this.active)return;
    clearTimeout(this.timer);this.phase=phase;this.send({phase,message,label:input.label||phase.toUpperCase()});
    if(phase==='error')this.timer=setTimeout(()=>this.returnHome(),5000);
    if(phase==='success')this.timer=setTimeout(()=>this.returnHome(),1000);
  }
  finish(){if(['returning','success'].includes(this.phase))return;clearTimeout(this.timer);this.phase='success';this.send({phase:'success',message:'Done. Back at your cursor.'});this.timer=setTimeout(()=>this.returnHome(),1000)}
  returnHome(){clearTimeout(this.timer);this.phase='returning';this.send({phase:'returning'});this.timer=setTimeout(()=>{this.active=false;this.phase='idle';this.tick();this.send({phase:'idle'})},850)}
  toggle(enabled){this.enabled=enabled;if(enabled){this.tick();this.win.showInactive()}else this.win.hide()}
  destroy(){clearInterval(this.loop);clearTimeout(this.timer);if(!this.win.isDestroyed())this.win.destroy()}
}
module.exports={Companion,position};
