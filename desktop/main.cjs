const { app, BrowserWindow, Tray, Menu, nativeImage, Notification, dialog, ipcMain, shell, globalShortcut, desktopCapturer, session } = require('electron');
const { fork } = require('node:child_process');
const path = require('node:path');
const { Companion } = require('./companion.cjs');
let backend, mainWindow, tray, trayMenu, backendUrl, companion, quitting = false;
const root = path.join(__dirname, '..');
app.setName('Grim');
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');

function showWindow() { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } }
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', (_event, argv) => { if (!argv.includes('--background')) showWindow(); });
  app.whenReady().then(() => {
    console.info('Desktop runtime ready');
    session.defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin) => {
      if (!backendUrl || !contents || permission !== 'media') return false;
      try { return new URL(requestingOrigin).origin === new URL(backendUrl).origin && new URL(contents.getURL()).origin === new URL(backendUrl).origin; } catch { return false; }
    });
    // Only local camera/microphone requests are eligible. Capture starts from explicit UI controls.
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
      const trusted = !!backendUrl && contents.getURL().startsWith(new URL(backendUrl).origin + '/');
      callback(trusted && permission === 'media' && details.mediaTypes?.length > 0 && details.mediaTypes.every(type => ['audio', 'video'].includes(type)));
    });
    mainWindow = new BrowserWindow({ width: 1440, height: 960, minWidth: 720, minHeight: 600, title: 'Grim', backgroundColor: '#050505', show: !process.argv.includes('--background'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false } });
    mainWindow.removeMenu();
    const reportVisibility=()=>mainWindow.webContents.send('dashboard-visibility',mainWindow.isVisible()&&!mainWindow.isMinimized());
    for(const name of ['show','hide','minimize','restore'])mainWindow.on(name,reportVisibility);
    mainWindow.webContents.on('did-finish-load',reportVisibility);
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => console.error('Dashboard load failed', code, description));
    mainWindow.webContents.on('render-process-gone', (_event, details) => console.error('Dashboard renderer stopped', details.reason));
    mainWindow.on('close', event => { if (!quitting) { event.preventDefault(); mainWindow.hide(); } });
    mainWindow.webContents.setWindowOpenHandler(({ url }) => { if (url.startsWith('https://')) shell.openExternal(url); return { action: 'deny' }; });
    mainWindow.webContents.on('will-navigate', (event, url) => { if (!backendUrl || new URL(url).origin !== new URL(backendUrl).origin) event.preventDefault(); });
    // NativeImage SVG support varies on Windows, so draw a small bitmap without an external asset dependency.
    const pixels = Buffer.alloc(32 * 32 * 4);
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const i = (y * 32 + x) * 4, line = (x >= 9 && x <= 12 && y >= 6 && y <= 25) || (y >= 13 && y <= 25 && Math.abs(x - (21 - Math.abs(y - 18))) <= 2);
      pixels[i] = line ? 10 : 88; pixels[i + 1] = line ? 10 : 185; pixels[i + 2] = line ? 10 : 225; pixels[i + 3] = 255;
    }
    let icon=nativeImage.createFromPath(path.join(root,'public/assets/grim-atlas.png'));
    if(!icon.isEmpty()){const size=icon.getSize();icon=icon.crop({x:Math.floor(size.width/2),y:0,width:Math.floor(size.width/8),height:Math.floor(size.height/4)}).resize({width:32,height:32})}
    else icon=nativeImage.createFromBitmap(pixels,{width:32,height:32});
    tray = new Tray(icon); tray.setToolTip('Grim — cursor companion');mainWindow.setIcon(icon);
    tray.on('double-click', showWindow);
    trayMenu=Menu.buildFromTemplate([
      { label: 'Open dashboard', click: showWindow },
      { id:'wake-listening', label: 'Wake listening', type:'checkbox', checked:true, click:item=>mainWindow.webContents.send('wake-control',item.checked) },
      { label: 'Show cursor companion', type:'checkbox', checked:true, click:item=>companion?.toggle(item.checked) },
      { label: 'Keep window on top', type: 'checkbox', click: item => { mainWindow.setAlwaysOnTop(item.checked); showWindow(); } },
      { label: 'Launch at Windows sign-in', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: item => {
        app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath, args: [root,'--background'] });
      } },
      { type: 'separator' }, { label: 'Quit Grim', click: () => { quitting = true; app.quit(); } }
    ]); tray.setContextMenu(trayMenu);
    const isTrusted = event => backendUrl && event.sender === mainWindow.webContents && new URL(event.senderFrame.url).origin === new URL(backendUrl).origin;
    ipcMain.on('companion-update',(event,state)=>{
      if(!isTrusted(event)||!state||!['idle','paused','loading','waking','listening','thinking','working','speaking','success','returning','error','waiting','standby','dormant'].includes(state.phase))return;
      if(['standby','dormant'].includes(state.phase))trayMenu.getMenuItemById('wake-listening').checked=state.phase==='standby';
      companion?.update({phase:state.phase,message:String(state.message||'').slice(0,800),label:String(state.label||'').slice(0,80)});
      if(['standby','dormant'].includes(state.phase))tray.setToolTip('Grim — '+(state.phase==='standby'?'listening for Hey Grim':'microphone paused'));
    });
    let lastVoiceError=0;
    ipcMain.on('voice-error',(event,message)=>{if(!isTrusted(event)||Date.now()-lastVoiceError<60000)return;lastVoiceError=Date.now();const notice=new Notification({title:'Grim microphone needs attention',body:String(message).slice(0,250)});notice.on('click',showWindow);notice.show()});
    ipcMain.handle('open-external', async (event, url) => { if (!isTrusted(event) || typeof url !== 'string' || new URL(url).protocol !== 'https:') throw new Error('External URL blocked.'); await shell.openExternal(url); });
    ipcMain.handle('capture-screen', async event => {
      if (!isTrusted(event)) throw new Error('Screen capture blocked.');
      const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 1920, height: 1080 }, fetchWindowIcons: false });
      const choices = sources.filter(source => !source.thumbnail.isEmpty()).slice(0, 12);
      if (!choices.length) throw new Error('No screens are available.');
      const { response } = await dialog.showMessageBox(mainWindow, { type: 'question', title: 'Share one snapshot', message: 'Choose a screen or window to capture once.', detail: 'The snapshot will be previewed in your composer. It is sent to Gemini only when you send the next message.', buttons: [...choices.map(source => source.name), 'Cancel'], cancelId: choices.length, defaultId: choices.length, noLink: true });
      return response < choices.length ? choices[response].thumbnail.toJPEG(80).toString('base64').replace(/^/, 'data:image/jpeg;base64,') : null;
    });
    backend = fork(path.join(root, 'server.mjs'), [], { cwd: root, execPath: process.execPath, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let errorTail = '';
    backend.stderr.on('data', chunk => { errorTail = (errorTail + chunk.toString()).slice(-4000); });
    backend.on('message', message => {
      if (message.type === 'ready') {
        console.info('Local service ready');
        backendUrl = message.url;
        mainWindow.loadURL(backendUrl).then(() => { console.info('Dashboard loaded'); companion=new Companion(new URL(backendUrl).origin,path.join(__dirname,'preload.cjs'));if(!process.argv.includes('--background'))showWindow(); }).catch(error => console.error('Dashboard load failed', error.message));
      }
      if (message.type === 'reminder' && Notification.isSupported()) {
        const notification = new Notification({ title: 'Grim reminder', body: message.title }); notification.on('click', showWindow); notification.show();
      }
    });
    backend.on('error', error => { dialog.showErrorBox('Grim could not start', error.message); quitting = true; app.quit(); });
    backend.on('exit', code => { if (!quitting) { dialog.showErrorBox('Grim backend stopped', errorTail || `Exit code: ${code}. Check whether port 4317 is already in use.`); quitting = true; app.quit(); } });
    globalShortcut.register('CommandOrControl+Shift+Space', () => { showWindow(); if (backendUrl) mainWindow.webContents.send('voice-shortcut'); });
  }).catch(error => { dialog.showErrorBox('Grim startup error', error.message); quitting = true; app.quit(); });
}
app.on('window-all-closed', () => {});
app.on('before-quit', () => { quitting = true; companion?.destroy(); globalShortcut.unregisterAll(); if (backend?.connected) backend.send('shutdown'); });
app.on('will-quit', () => { if (backend && !backend.killed) backend.kill(); });
