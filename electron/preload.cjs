// Puente entre la página y el proceso principal: solo el idioma de la app y reiniciarla.
// La página sigue sin acceso a Node; esto es lo único que ve, en window.automatizacionApp.
const { contextBridge, ipcRenderer } = require('electron');

// el idioma tiene que estar antes de que se carguen los módulos de la página: por eso la consulta es síncrona
const inicio = ipcRenderer.sendSync('idioma:inicio') || { idioma: 'es', bienvenida: false };

contextBridge.exposeInMainWorld('automatizacionApp', {
  idioma: inicio.idioma,
  bienvenida: inicio.bienvenida,
  /** Guarda el idioma para el próximo arranque (los menús cambian ya) */
  guardarIdioma: (idioma) => ipcRenderer.invoke('idioma:guardar', idioma),
  /** Cierra la app y la vuelve a abrir */
  reiniciar: () => ipcRenderer.send('app:reiniciar'),
});
