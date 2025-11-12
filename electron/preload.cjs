const { contextBridge, ipcRenderer, webFrame } = require('electron');

// Lock application UI zoom: disable page/layout zoom and pin factor to 1.0
try {
  webFrame.setZoomFactor(1.0);
  if (webFrame.setVisualZoomLevelLimits) webFrame.setVisualZoomLevelLimits(1, 1);
  if (webFrame.setLayoutZoomLevelLimits) webFrame.setLayoutZoomLevelLimits(0, 0);
} catch (e) { /* ignore */ }

contextBridge.exposeInMainWorld('menuAPI', {
  onAction: (handler) => {
    const listener = (_event, msg) => {
      try { handler(msg?.type, msg?.payload); } catch (e) { console.error('[Preload] handler error', e); }
    };
    ipcRenderer.on('menu:action', listener);
    return () => ipcRenderer.removeListener('menu:action', listener);
  }
});

contextBridge.exposeInMainWorld('logAPI', {
  log: (level, message, meta) => {
    try { ipcRenderer.send('log:renderer', { level, message, meta, ts: new Date().toISOString() }); } catch (e) {}
  }
});
