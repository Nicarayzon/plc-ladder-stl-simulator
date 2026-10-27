// Idioma de la app en el proceso principal: qué idioma se usa al arrancar, dónde se guarda
// y los textos que no están en la página (menús, «Acerca de», diálogos de actualizaciones).
// La página tiene sus propios textos en src/i18n/; aquí solo los del proceso principal.
const fs = require('node:fs');
const path = require('node:path');

/** Idiomas con traducción completa. Tiene que coincidir con IDIOMAS de src/i18n/index.ts */
const DISPONIBLES = ['es', 'en', 'de'];

const TEXTOS = {
  es: {
    acercaDe: 'Acerca de Automatizacion',
    copyright: '© 2026 Arzath — Práctica de autómatas en KOP y AWL',
    buscarActualizaciones: 'Buscar actualizaciones…',
    ocultar: 'Ocultar Automatizacion',
    ocultarOtros: 'Ocultar otros',
    mostrarTodo: 'Mostrar todo',
    salir: 'Salir de Automatizacion',
    edicion: 'Edición',
    deshacer: 'Deshacer',
    rehacer: 'Rehacer',
    cortar: 'Cortar',
    copiar: 'Copiar',
    pegar: 'Pegar',
    seleccionarTodo: 'Seleccionar todo',
    ver: 'Ver',
    tamanoReal: 'Tamaño real',
    ampliar: 'Ampliar',
    reducir: 'Reducir',
    pantallaCompleta: 'Pantalla completa',
    recargar: 'Recargar',
    herramientasDesarrollo: 'Herramientas de desarrollo',
    ventana: 'Ventana',
    minimizar: 'Minimizar',
    zoom: 'Zoom',
    traerAlFrente: 'Traer todo al frente',
    cerrar: 'Cerrar',
    ayuda: 'Ayuda',
    senales: 'Señales E/S',
    actualizaciones: {
      titulo: 'Actualizaciones',
      actualizar: 'Actualizar',
      masTarde: 'Más tarde',
      aceptar: 'Aceptar',
      abrirVersiones: 'Abrir la página de versiones',
      hayNueva: (v) => `Hay una versión nueva: ${v}`,
      tienes: (actual) => `Tienes la ${actual}. «Actualizar» abre su página en el navegador.`,
      conservan: 'Tus proyectos se conservan.',
      novedades: 'Novedades:',
      alDia: 'Tienes la última versión',
      masNueva: (actual, ultima) => `Tienes la ${actual}; la última publicada es la ${ultima}.`,
      version: (actual) => `Versión ${actual}.`,
      noComprobado: 'No se ha podido comprobar si hay actualizaciones',
      motivo: (m) => `Motivo: ${m}.`,
      pasosMac: 'Descarga el .dmg, sal de la app (⌘Q), abre el .dmg y arrastra Automatizacion a Aplicaciones eligiendo «Reemplazar».',
      pasosWin: 'Descarga Automatizacion-Setup-….exe, cierra la app y ejecuta el instalador: sustituye a la versión anterior.',
      motivos: {
        sinRelease: 'GitHub no ha devuelto ninguna versión publicada',
        sinVersiones: 'todavía no hay ninguna versión publicada',
        limite: 'GitHub limita las consultas seguidas: prueba otra vez dentro de un rato',
        codigo: (n) => `GitHub ha respondido con el código ${n}`,
        sinConexion: 'no hay conexión con GitHub',
      },
    },
  },
  en: {
    acercaDe: 'About Automatizacion',
    copyright: '© 2026 Arzath — LAD and STL PLC practice',
    buscarActualizaciones: 'Check for updates…',
    ocultar: 'Hide Automatizacion',
    ocultarOtros: 'Hide Others',
    mostrarTodo: 'Show All',
    salir: 'Quit Automatizacion',
    edicion: 'Edit',
    deshacer: 'Undo',
    rehacer: 'Redo',
    cortar: 'Cut',
    copiar: 'Copy',
    pegar: 'Paste',
    seleccionarTodo: 'Select All',
    ver: 'View',
    tamanoReal: 'Actual Size',
    ampliar: 'Zoom In',
    reducir: 'Zoom Out',
    pantallaCompleta: 'Toggle Full Screen',
    recargar: 'Reload',
    herramientasDesarrollo: 'Developer Tools',
    ventana: 'Window',
    minimizar: 'Minimize',
    zoom: 'Zoom',
    traerAlFrente: 'Bring All to Front',
    cerrar: 'Close',
    ayuda: 'Help',
    senales: 'I/O signals',
    actualizaciones: {
      titulo: 'Updates',
      actualizar: 'Update',
      masTarde: 'Later',
      aceptar: 'OK',
      abrirVersiones: 'Open the releases page',
      hayNueva: (v) => `A new version is available: ${v}`,
      tienes: (actual) => `You have ${actual}. “Update” opens its page in the browser.`,
      conservan: 'Your projects are kept.',
      novedades: 'What’s new:',
      alDia: 'You have the latest version',
      masNueva: (actual, ultima) => `You have ${actual}; the latest published version is ${ultima}.`,
      version: (actual) => `Version ${actual}.`,
      noComprobado: 'Could not check for updates',
      motivo: (m) => `Reason: ${m}.`,
      pasosMac: 'Download the .dmg, quit the app (⌘Q), open the .dmg and drag Automatizacion to Applications, choosing “Replace”.',
      pasosWin: 'Download Automatizacion-Setup-….exe, close the app and run the installer: it replaces the previous version.',
      motivos: {
        sinRelease: 'GitHub did not return any published version',
        sinVersiones: 'no version has been published yet',
        limite: 'GitHub limits repeated requests: try again in a while',
        codigo: (n) => `GitHub answered with code ${n}`,
        sinConexion: 'no connection to GitHub',
      },
    },
  },
  de: {
    acercaDe: 'Über Automatizacion',
    copyright: '© 2026 Arzath — Übungen zu SPS in KOP und AWL',
    buscarActualizaciones: 'Nach Updates suchen…',
    ocultar: 'Automatizacion ausblenden',
    ocultarOtros: 'Andere ausblenden',
    mostrarTodo: 'Alle einblenden',
    salir: 'Automatizacion beenden',
    edicion: 'Bearbeiten',
    deshacer: 'Rückgängig',
    rehacer: 'Wiederherstellen',
    cortar: 'Ausschneiden',
    copiar: 'Kopieren',
    pegar: 'Einfügen',
    seleccionarTodo: 'Alles auswählen',
    ver: 'Ansicht',
    tamanoReal: 'Originalgröße',
    ampliar: 'Vergrößern',
    reducir: 'Verkleinern',
    pantallaCompleta: 'Vollbild ein/aus',
    recargar: 'Neu laden',
    herramientasDesarrollo: 'Entwicklerwerkzeuge',
    ventana: 'Fenster',
    minimizar: 'Minimieren',
    zoom: 'Zoomen',
    traerAlFrente: 'Alle nach vorne bringen',
    cerrar: 'Schließen',
    ayuda: 'Hilfe',
    senales: 'E/A-Signale',
    actualizaciones: {
      titulo: 'Updates',
      actualizar: 'Aktualisieren',
      masTarde: 'Später',
      aceptar: 'OK',
      abrirVersiones: 'Seite der Versionen öffnen',
      hayNueva: (v) => `Eine neue Version ist verfügbar: ${v}`,
      tienes: (actual) => `Du hast die ${actual}. „Aktualisieren“ öffnet ihre Seite im Browser.`,
      conservan: 'Deine Projekte bleiben erhalten.',
      novedades: 'Neuerungen:',
      alDia: 'Du hast die neueste Version',
      masNueva: (actual, ultima) => `Du hast die ${actual}; die neueste veröffentlichte ist die ${ultima}.`,
      version: (actual) => `Version ${actual}.`,
      noComprobado: 'Es konnte nicht nach Updates gesucht werden',
      motivo: (m) => `Grund: ${m}.`,
      pasosMac: 'Lade die .dmg herunter, beende die App (⌘Q), öffne die .dmg und ziehe Automatizacion in „Programme“, mit „Ersetzen“.',
      pasosWin: 'Lade Automatizacion-Setup-….exe herunter, schließe die App und führe das Installationsprogramm aus: Es ersetzt die vorherige Version.',
      motivos: {
        sinRelease: 'GitHub hat keine veröffentlichte Version geliefert',
        sinVersiones: 'es ist noch keine Version veröffentlicht',
        limite: 'GitHub begrenzt wiederholte Anfragen: Versuche es später noch einmal',
        codigo: (n) => `GitHub hat mit dem Code ${n} geantwortet`,
        sinConexion: 'keine Verbindung zu GitHub',
      },
    },
  },
};

const FICHERO = 'idioma.json';

/** 'es-ES', 'en-GB', 'de-AT'… → el idioma disponible que le corresponde; si no hay ninguno, inglés (o el primero) */
function deLocale(locales) {
  for (const l of locales) {
    const i = String(l || '').slice(0, 2).toLowerCase();
    if (DISPONIBLES.includes(i)) return i;
  }
  return DISPONIBLES.includes('en') ? 'en' : DISPONIBLES[0];
}

function leer(app) {
  try {
    const { idioma } = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), FICHERO), 'utf8'));
    return DISPONIBLES.includes(idioma) ? idioma : null;
  } catch {
    return null;
  }
}

function guardar(app, idioma) {
  if (!DISPONIBLES.includes(idioma)) return false;
  const dir = app.getPath('userData');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, FICHERO), JSON.stringify({ idioma }) + '\n');
  return true;
}

/**
 * Idioma al arrancar y si hay que enseñar el aviso de bienvenida (una sola vez):
 * - ya elegido: ese, sin aviso;
 * - quien ya usaba la app antes de que hubiera idiomas (hay datos de la página): español, con aviso;
 * - instalación nueva: el del sistema, con aviso.
 * AUTOMATIZACION_IDIOMA lo fija sin aviso (pruebas automáticas).
 */
function alArrancar(app, env = process.env) {
  if (env.AUTOMATIZACION_IDIOMA && DISPONIBLES.includes(env.AUTOMATIZACION_IDIOMA)) return { idioma: env.AUTOMATIZACION_IDIOMA, bienvenida: false };
  const elegido = leer(app);
  if (elegido) return { idioma: elegido, bienvenida: false };
  const usabaLaApp = fs.existsSync(path.join(app.getPath('userData'), 'Local Storage'));
  const idioma = usabaLaApp ? 'es' : deLocale(app.getPreferredSystemLanguages?.() ?? [app.getLocale()]);
  guardar(app, idioma);
  return { idioma, bienvenida: true };
}

const textos = (idioma) => TEXTOS[idioma] ?? TEXTOS.es;

module.exports = { DISPONIBLES, TEXTOS, alArrancar, guardar, leer, deLocale, textos };
