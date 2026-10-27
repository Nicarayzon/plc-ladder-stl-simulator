// Proceso principal de Electron: una ventana que carga la app web compilada (dist/).
// Sin integración de Node en el renderizador; todo el simulador corre en la página.
const { app, BrowserWindow, shell, Menu, dialog, net, ipcMain } = require('electron');
const path = require('node:path');
const { buscarActualizaciones } = require('./actualizaciones.cjs');
const idiomas = require('./idioma.cjs');

app.setName('Automatizacion');
// pruebas automáticas: carpeta de datos aparte para no tocar los datos del usuario
if (process.env.AUTOMATIZACION_USER_DATA) app.setPath('userData', process.env.AUTOMATIZACION_USER_DATA);

const isMac = process.platform === 'darwin';
const devUrl = process.env.VITE_DEV_SERVER_URL;

// idioma de la app: se decide al arrancar (ver idioma.cjs). Los menús cambian en cuanto se elige otro;
// la página, al reiniciar.
let inicio = { idioma: 'es', bienvenida: false };
let idioma = 'es';

function sendToRenderer(win, script) {
  if (win) win.webContents.executeJavaScript(script).catch(() => {});
}

function buildMenu() {
  const t = idiomas.textos(idioma);
  // solo se conecta a GitHub al pulsarlo
  const actualizaciones = { label: t.buscarActualizaciones, click: (_m, w) => { buscarActualizaciones({ app, dialog, shell, net, t: t.actualizaciones }, w || BrowserWindow.getAllWindows()[0]); } };
  const template = [
    ...(isMac ? [{
      label: 'Automatizacion',
      submenu: [
        { role: 'about', label: t.acercaDe },
        actualizaciones,
        { type: 'separator' },
        { role: 'hide', label: t.ocultar },
        { role: 'hideOthers', label: t.ocultarOtros },
        { role: 'unhide', label: t.mostrarTodo },
        { type: 'separator' },
        { role: 'quit', label: t.salir },
      ],
    }] : []),
    {
      label: t.edicion,
      submenu: [
        { label: t.deshacer, accelerator: 'CmdOrCtrl+Z', click: (_m, w) => sendToRenderer(w, 'window.__appUndo ? window.__appUndo() : document.execCommand("undo")') },
        { label: t.rehacer, accelerator: 'Shift+CmdOrCtrl+Z', click: (_m, w) => sendToRenderer(w, 'window.__appRedo ? window.__appRedo() : document.execCommand("redo")') },
        { type: 'separator' },
        { role: 'cut', label: t.cortar },
        { role: 'copy', label: t.copiar },
        { role: 'paste', label: t.pegar },
        { role: 'selectAll', label: t.seleccionarTodo },
      ],
    },
    {
      label: t.ver,
      submenu: [
        { role: 'resetZoom', label: t.tamanoReal },
        { role: 'zoomIn', label: t.ampliar },
        { role: 'zoomOut', label: t.reducir },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.pantallaCompleta },
        ...(app.isPackaged ? [] : [{ role: 'reload', label: t.recargar }, { role: 'toggleDevTools', label: t.herramientasDesarrollo }]),
      ],
    },
    {
      label: t.ventana,
      submenu: [
        { role: 'minimize', label: t.minimizar },
        { role: 'zoom', label: t.zoom },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: t.traerAlFrente }] : [{ role: 'close', label: t.cerrar }]),
      ],
    },
    // en Windows no hay menú con el nombre de la app: va en Ayuda
    ...(isMac ? [] : [{ label: t.ayuda, submenu: [actualizaciones] }]),
  ];
  return Menu.buildFromTemplate(template);
}

/** Menú y «Acerca de» en el idioma actual */
function aplicarIdioma() {
  app.setAboutPanelOptions({
    applicationName: 'Automatizacion',
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: idiomas.textos(idioma).copyright,
  });
  Menu.setApplicationMenu(buildMenu());
}

/** Solo la página de la app (no una dirección externa) puede cambiar el idioma o reiniciar */
const dePagina = (e) => {
  const url = e.senderFrame?.url ?? '';
  return url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl));
};

ipcMain.on('idioma:inicio', (e) => { e.returnValue = inicio; });
ipcMain.handle('idioma:guardar', (e, nuevo) => {
  if (!dePagina(e) || !idiomas.guardar(app, nuevo)) return false;
  idioma = nuevo;
  aplicarIdioma();
  return true;
});
ipcMain.on('app:reiniciar', (e) => {
  if (!dePagina(e)) return;
  app.relaunch();
  app.exit(0);
});

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
      preload: path.join(__dirname, 'preload.cjs'),
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
        overrideBrowserWindowOptions: { title: idiomas.textos(idioma).senales, minWidth: 560, minHeight: 220, backgroundColor: '#14161a', fullscreenable: true },
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
  inicio = idiomas.alArrancar(app);
  idioma = inicio.idioma;
  aplicarIdioma();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
