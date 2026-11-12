const {app,BrowserWindow}=require('electron');const{fork}=require('node:child_process');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');let backend;
app.setPath('userData',path.join(root,'.local/voice-hybrid-e2e'));app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.whenReady().then(()=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Voice pipeline timed out')),70000);
  backend=fork(path.join(root,'server.mjs'),[],{cwd:root,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',PORT:'0',GRIM_DATA_DIR:path.join(root,'.local/voice-e2e-data')},stdio:['ignore','ignore','ignore','ipc']});
  backend.on('message',async message=>{if(message.type!=='ready')return;try{
    const win=new BrowserWindow({width:1000,height:800,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});await win.loadURL(message.url);
    const fixture=['ordinary.wav','wake-only.wav','command-only.wav','wake-calculator.wav'].map(name=>fs.readFileSync(path.join(root,'.local/fixtures',name)).toString('base64'));
    const result=await win.webContents.executeJavaScript(`(async()=>{
      await new Promise(resolve=>{const t=setInterval(()=>{if(!document.getElementById('shell').classList.contains('hidden')){clearInterval(t);resolve()}},100)});
      const commands=[],greetings=[];window.grimAssistant={data:()=>({identity:{faceSamples:0,wakeReady:true},keyConfigured:true}),busy:()=>false,speak:async text=>greetings.push(text),sendCommand:async text=>{commands.push(text);return{text:'Done',events:[]}}};
      let context,destination;
      Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{context=new AudioContext({sampleRate:16000});await context.resume();destination=context.createMediaStreamDestination();return destination.stream}});
      document.getElementById('wake-toggle').click();
      await new Promise((resolve,reject)=>{let n=0;const t=setInterval(()=>{if(document.getElementById('core-state').textContent==='STANDBY'){clearInterval(t);resolve()}else if(++n>300){clearInterval(t);reject(new Error(document.getElementById('identity-feedback').textContent))}},100)});
      const originalFetch=window.fetch;let transcriptionUploads=0;window.fetch=async(url,options)=>{if(String(url).startsWith('/api/transcribe')){if(!(options.body instanceof Blob)||options.body.size<100)throw new Error('Missing command recording');transcriptionUploads++;return new Response(JSON.stringify({text:'Open calculator.'}),{status:200,headers:{'Content-Type':'application/json'}})}return originalFetch(url,options)};
      const fixtures=${JSON.stringify(fixture)};
      async function feed(encoded){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0)),buffer=await context.decodeAudioData(bytes.buffer);const source=context.createBufferSource();source.buffer=buffer;source.connect(destination);source.start();await new Promise(resolve=>setTimeout(resolve,buffer.duration*1000))}
      async function waitFor(check,label){const until=Date.now()+12000;while(!check()){if(Date.now()>until)throw new Error(label+': '+document.getElementById('core-state').textContent+' '+document.getElementById('last-heard').textContent);await new Promise(r=>setTimeout(r,100))}}
      await feed(fixtures[0]);await new Promise(r=>setTimeout(r,5000));if(greetings.length||commands.length||transcriptionUploads)throw new Error('Ordinary speech triggered Grim');
      await feed(fixtures[1]);await waitFor(()=>document.getElementById('core-state').textContent==='LISTENING','Wake failed');await new Promise(r=>setTimeout(r,700));await feed(fixtures[2]);await waitFor(()=>commands.length===1,'Command not dispatched');if(transcriptionUploads!==1)throw new Error('Command must be uploaded exactly once');await waitFor(()=>document.getElementById('core-state').textContent==='STANDBY','No return to standby');await new Promise(r=>setTimeout(r,1000));await feed(fixtures[3]);await waitFor(()=>commands.length===2,'Combined wake command not dispatched');if(transcriptionUploads!==2)throw new Error('Combined wake command bypassed transcription');
      document.getElementById('wake-toggle').click();await context.close();
      if(commands.length!==2||commands.some(c=>c!=='Open calculator.'))throw new Error('Voice dispatch failed: '+JSON.stringify({commands,greetings,status:document.getElementById('identity-feedback').textContent}));
      return{success:true,commands,greetings,ordinarySpeechRejected:true,recordingUploadedAfterWakeOnly:true};
    })()`);console.log(JSON.stringify(result));clearTimeout(timer);resolve();
  }catch(error){clearTimeout(timer);reject(error)}});
})).then(()=>{backend?.send('shutdown');app.exit(0)}).catch(error=>{console.error(error.message);backend?.kill();app.exit(1)});app.on('window-all-closed',()=>{});

