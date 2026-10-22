// Proceso principal de Electron: una ventana que carga la app web compilada (dist/).
// Sin integración de Node en el renderizador; todo el simulador corre en la página.
const { app, BrowserWindow, shell, Menu, dialog, net } = require('electron');
const path = require('node:path');
const { buscarActualizaciones } = require('./actualizaciones.cjs');

app.setName('Automatizacion');
// pruebas automáticas: carpeta de datos aparte para no tocar los datos del usuario
if (process.env.AUTOMATIZACION_USER_DATA) app.setPath('userData', process.env.AUTOMATIZACION_USER_DATA);

const isMac = process.platform === 'darwin';
const devUrl = process.env.VITE_DEV_SERVER_URL;

function sendToRenderer(win, script) {
  if (win) win.webContents.executeJavaScript(script).catch(() => {});
}

function buildMenu() {
  // solo se conecta a GitHub al pulsarlo
  const actualizaciones = { label: 'Buscar actualizaciones…', click: (_m, w) => { buscarActualizaciones({ app, dialog, shell, net }, w || BrowserWindow.getAllWindows()[0]); } };
  const template = [
    ...(isMac ? [{
      label: 'Automatizacion',
      submenu: [
        { role: 'about', label: 'Acerca de Automatizacion' },
        actualizaciones,
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar Automatizacion' },
        { role: 'hideOthers', label: 'Ocultar otros' },
        { role: 'unhide', label: 'Mostrar todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir de Automatizacion' },
      ],
    }] : []),
    {
      label: 'Edición',
      submenu: [
        { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', click: (_m, w) => sendToRenderer(w, 'window.__appUndo ? window.__appUndo() : document.execCommand("undo")') },
        { label: 'Rehacer', accelerator: 'Shift+CmdOrCtrl+Z', click: (_m, w) => sendToRenderer(w, 'window.__appRedo ? window.__appRedo() : document.execCommand("redo")') },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Ampliar' },
        { role: 'zoomOut', label: 'Reducir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged ? [] : [{ role: 'reload', label: 'Recargar' }, { role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: 'Traer todo al frente' }] : [{ role: 'close', label: 'Cerrar' }]),
      ],
    },
    // en Windows no hay menú con el nombre de la app: va en Ayuda
    ...(isMac ? [] : [{ label: 'Ayuda', submenu: [actualizaciones] }]),
  ];
  return Menu.buildFromTemplate(template);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Automatizacion',
    show: false,
    backgroundColor: '#14161a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  if (devUrl) win.loadURL(devUrl);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    // ventana de «Señales E/S» (para otro monitor): la página la rellena con un portal de React
    if (frameName === 'senales' && (url === 'about:blank' || url === '')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { title: 'Señales E/S', minWidth: 560, minHeight: 220, backgroundColor: '#14161a', fullscreenable: true },
      };
    }
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  // al cerrar la ventana principal se cierran también las demás (señales)
  win.on('closed', () => {
    for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.close();
  });
  win.webContents.on('will-navigate', (e, url) => {
    const ok = url.startsWith('file://') || (devUrl && url.startsWith(devUrl));
    if (!ok) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
  return win;
}

app.whenReady().then(() => {
  app.setAboutPanelOptions({
    applicationName: 'Automatizacion',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: '© 2026 Arzath — Práctica de autómatas en KOP y AWL',
  });
  Menu.setApplicationMenu(buildMenu());
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
