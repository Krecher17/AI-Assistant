const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('grimDesktop', {
  onDashboardVisibility: callback => ipcRenderer.on('dashboard-visibility',(_event,visible)=>callback(visible)),
  setCompanion: state => ipcRenderer.send('companion-update',state),
  voiceError: message => ipcRenderer.send('voice-error',message),
  onCompanionState: callback => ipcRenderer.on('companion-state',(_event,state)=>callback(state)),
  onWakeControl: callback => ipcRenderer.on('wake-control',(_event,enabled)=>callback(enabled)),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  openExternal: url => ipcRenderer.invoke('open-external', url),
  onVoiceShortcut: callback => ipcRenderer.on('voice-shortcut', () => callback())
});
