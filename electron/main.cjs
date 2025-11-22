const { app, BrowserWindow, Menu, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#0b1020',
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => {
    console.log('[Main] window closed');
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[Main] render-process-gone', details);
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    console.log('[Main] DEV mode. VITE_DEV_SERVER_URL =', devUrl);
    let attempts = 0;
    const maxAttempts = 15;
    const tryLoad = () => {
      attempts++;
      console.log(`[Main] loadURL attempt ${attempts}/${maxAttempts}`);
      win.loadURL(devUrl).catch((e)=> console.error('[Main] loadURL error', e));
    };
    tryLoad();
    // win.webContents.openDevTools({ mode: 'detach' }); // disable auto DevTools to avoid interference
    win.webContents.on('did-finish-load', () => {
      console.log('[Main] Renderer did-finish-load');
      // Probe renderer context
      win.webContents.executeJavaScript(`
        try {
          console.log('[Probe] Renderer context alive');
          if (document && document.body) document.body.dataset.probe = 'ok';
          if (!window.__appMounted) {
            console.log('[Probe] Forcing module import /src/main.tsx');
            import('/src/main.tsx').catch(e => console.error('[Probe] import failed', e));
          }
        } catch (e) { console.error('[Probe] failed', e); }
      `).catch(()=>{});
    });
    win.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
      console.error('[Main] Renderer did-fail-load', { code, desc, url, isMainFrame });
      if (attempts < maxAttempts) {
        setTimeout(tryLoad, 500);
      }
    });
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Build native menu and forward actions to renderer via postMessage
  const send = (type, payload={}) => {
    try {
      const msg = { type, payload };
      console.log('[Menu] ipc send', msg);
      win.webContents.send('menu:action', msg);
    } catch (e) { /* ignore */ }
  };

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Nuova mappa…', click: () => send('file:new') },
        // Rimosso: Nuova mappa veloce (i preset sono nel modale Nuova mappa)
        { type: 'separator' },
        { label: 'Apri progetto…', click: () => send('file:open-project') },
        { label: 'Salva progetto', click: () => send('file:save-project') },
        {
          label: 'Importa',
          submenu: [
            { label: 'Importa asset…', click: () => send('file:import-assets') },
            { label: 'Imposta background…', click: () => send('file:set-background') },
          ]
        },
        {
          label: 'Esporta',
          submenu: [
            { label: 'Esporta PNG…', click: () => send('file:export-png') },
          ]
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit' },
      ]
    },
    {
      label: 'Modifica',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('edit:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => send('edit:redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'delete' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Snap On/Off', click: () => send('edit:toggle-snap') },
        { label: 'Griglia On/Off', click: () => send('edit:toggle-grid') },
      ]
    },
    {
      label: 'Visualizza',
      submenu: [
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: () => send('view:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('view:zoom-out') },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', click: () => send('view:zoom-reset') },
        { type: 'separator' },
        {
          label: 'Pannelli',
          submenu: [
            { label: 'Assets', click: () => send('view:toggle-assets') },
            { label: 'Layers', click: () => send('view:toggle-layers') },
            { label: 'Proprietà', click: () => send('view:toggle-properties') },
          ]
        },
        { type: 'separator' },
        {
          label: 'Interfaccia',
          submenu: [
            { label: 'Piccola', type: 'radio', checked: false, enabled: false },
            { label: 'Media', type: 'radio', checked: true, enabled: false },
            { label: 'Grande', type: 'radio', checked: false, enabled: false },
          ]
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ]
    },
    {
      label: 'Strumenti',
      submenu: [
        { label: 'Selezione', click: () => send('tool:set', { tool: 'select' }) },
        { label: 'Muovi', click: () => send('tool:set', { tool: 'move' }) },
        { label: 'Ruota', click: () => send('tool:set', { tool: 'rotate' }) },
        { label: 'Scala', click: () => send('tool:set', { tool: 'scale' }) },
        { type: 'separator' },
        { label: 'Porta avanti', click: () => send('zorder:forward') },
        { label: 'Porta dietro', click: () => send('zorder:backward') },
        { label: 'Porta in cima', click: () => send('zorder:front') },
        { label: 'Porta in fondo', click: () => send('zorder:back') },
      ]
    },
    {
      label: 'Aiuto',
      submenu: [
        { label: 'Scorciatoie', click: () => send('help:shortcuts') },
        { label: 'Informazioni', click: () => send('help:about') },
      ]
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// simple file logger
function ensureLogsDir() {
  const dir = path.join(__dirname, 'logs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}
let mainLogStream = null;
let rendererLogStream = null;

function initFileLogs() {
  const dir = ensureLogsDir();
  const ts = new Date().toISOString().replace(/[:.]/g,'_');
  mainLogStream = fs.createWriteStream(path.join(dir, `main-${ts}.log`), { flags: 'a' });
  rendererLogStream = fs.createWriteStream(path.join(dir, `renderer-${ts}.log`), { flags: 'a' });
  const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
  const write = (level, args) => {
    const line = `[${level.toUpperCase()}] ${new Date().toISOString()} ${args.map(a=> typeof a==='string'? a: JSON.stringify(a)).join(' ')}\n`;
    try { mainLogStream.write(line); } catch {}
  };
  console.log = (...args) => { write('log', args); orig.log(...args); };
  console.info = (...args) => { write('info', args); orig.info(...args); };
  console.warn = (...args) => { write('warn', args); orig.warn(...args); };
  console.error = (...args) => { write('error', args); orig.error(...args); };
  console.debug = (...args) => { write('debug', args); orig.debug(...args); };
}

app.whenReady().then(() => {
  initFileLogs();
  try { session.defaultSession && session.defaultSession.setCacheDisabled(true); } catch {}
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  ipcMain.on('log:renderer', (_e, entry) => {
    try {
      const line = `[${(entry.level||'info').toUpperCase()}] ${entry.ts||new Date().toISOString()} ${entry.message} ${entry.meta? JSON.stringify(entry.meta): ''}\n`;
      rendererLogStream && rendererLogStream.write(line);
    } catch {}
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
