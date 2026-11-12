const{app}=require('electron');const{fork}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');const{Companion}=require('../desktop/companion.cjs');
const root=path.resolve(__dirname,'..');let backend,pet;const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
app.setPath('userData',path.join(root,'.local/companion-e2e'));
app.whenReady().then(()=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Companion lifecycle timed out')),30000);
  backend=fork(path.join(root,'server.mjs'),[],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:'0',GRIM_DATA_DIR:path.join(root,'.local/companion-e2e-data')},stdio:['ignore','ignore','ignore','ipc']});
  backend.on('message',async message=>{if(message.type!=='ready')return;try{
    pet=new Companion(new URL(message.url).origin,path.join(root,'desktop/preload.cjs'));
    while(!pet.ready)await wait(100);await wait(700);
    if(pet.win.isFocusable())throw new Error('Companion must not steal keyboard focus');
    pet.update({phase:'waking',message:'Yes, Akshay.'});await wait(850);
    const awake=pet.win.getBounds();if(awake.width!==360)throw new Error('Character did not emerge from cursor size');
    const captured=await pet.win.webContents.capturePage();fs.writeFileSync(path.join(root,'.local/grim-awake.png'),captured.toPNG());
    if(captured.getBitmap()[3]!==0)throw new Error('Companion background must be transparent');
    pet.update({phase:'working',message:'Reading your project…'});await wait(300);
    const phase=await pet.win.webContents.executeJavaScript('document.body.dataset.phase');if(phase!=='working')throw new Error('Task animation did not change');
    pet.update({phase:'standby'});await wait(2100);if(pet.active||pet.win.getBounds().width!==76)throw new Error('Companion did not return to cursor');
    console.log(JSON.stringify({transparent:true,nonFocusable:true,emerged:true,taskAnimation:true,returnedToCursor:true}));clearTimeout(timer);resolve();
  }catch(error){clearTimeout(timer);reject(error)}});
})).then(()=>{pet?.destroy();backend?.send('shutdown');app.exit(0)}).catch(error=>{console.error(error.message);pet?.destroy();backend?.kill();app.exit(1)});app.on('window-all-closed',()=>{});
