const { app, BrowserWindow, session } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..'); let backend;
app.setPath('userData', path.join(root, '.local/input-diagnostic'));
app.whenReady().then(() => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Input diagnostic timed out')), 45000);
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => permission === 'media');
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'media'));
  backend = fork(path.join(root, 'server.mjs'), [], { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: '0', GRIM_DATA_DIR: path.join(root, '.local/input-diagnostic-data') }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  backend.on('message', async message => {
    if (message.type !== 'ready') return;
    try {
      const win = new BrowserWindow({ width: 580, height: 320, show: true, title: 'Grim microphone diagnostic', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
      await win.loadURL(message.url);
      const result = await win.webContents.executeJavaScript(`(async () => {
        const devices=await navigator.mediaDevices.enumerateDevices();
        const cameras=devices.filter(d=>d.kind==='videoinput').map(d=>d.label||'Unnamed camera');
        const mic=devices.find(d=>d.kind==='audioinput'&&/microphone array/i.test(d.label));
        const stream=await navigator.mediaDevices.getUserMedia({audio:mic?{deviceId:{exact:mic.deviceId},channelCount:1,echoCancellation:true,noiseSuppression:true}:true,video:false});
        const context=new AudioContext({sampleRate:16000}); await context.resume();
        let frames=0,peakRms=0,peak=0;const source=context.createMediaStreamSource(stream),processor=context.createScriptProcessor(4096,1,1);
        processor.onaudioprocess=e=>{frames++;const a=e.inputBuffer.getChannelData(0);let sum=0;for(const x of a){sum+=x*x;peak=Math.max(peak,Math.abs(x))}peakRms=Math.max(peakRms,Math.sqrt(sum/a.length))};
        source.connect(processor);processor.connect(context.destination);
        await new Promise(resolve=>setTimeout(resolve,5000));
        const track=stream.getAudioTracks()[0];const result={microphone:track.label,muted:track.muted,enabled:track.enabled,readyState:track.readyState,sampleRate:context.sampleRate,contextState:context.state,frames,peakRms,peak,cameras};
        processor.disconnect();source.disconnect();stream.getTracks().forEach(t=>t.stop());await context.close();return result;
      })()`);
      console.log(JSON.stringify(result)); clearTimeout(timer); resolve();
    } catch (error) { clearTimeout(timer); reject(error); }
  });
  backend.on('error', reject);
})).then(() => { backend?.send('shutdown'); app.exit(0); }).catch(error => { console.error(error.message); backend?.kill(); app.exit(1); });
app.on('window-all-closed', () => {});
