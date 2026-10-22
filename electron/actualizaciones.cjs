// Buscar actualizaciones: compara la versión de la app con la última Release publicada en GitHub.
// Solo se conecta cuando se pide desde el menú. «Actualizar» abre la página de esa versión en el navegador,
// donde se descarga el instalador, que sustituye a la versión anterior (los proyectos se conservan).
const REPO = 'Nicarayzon/plc-ladder-stl-simulator';
const PAGINA_RELEASES = `https://github.com/${REPO}/releases`;
// pruebas automáticas: otra dirección (un servidor local) en lugar de GitHub
const API_ULTIMA = process.env.AUTOMATIZACION_RELEASES_URL || `https://api.github.com/repos/${REPO}/releases/latest`;

/** «v0.21.0» → [0, 21, 0]; null si no es una versión */
function partes(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '').trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** Negativo si `a` es anterior a `b`, 0 si son la misma y positivo si es posterior */
function comparar(a, b) {
  const x = partes(a) ?? [0, 0, 0];
  const y = partes(b) ?? [0, 0, 0];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/** Las notas de la versión, cortas, para el cuadro de diálogo */
function resumir(notas, max = 600) {
  const t = String(notas ?? '').replace(/\r\n/g, '\n').trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/** Qué hay que decir con la última Release que devuelve GitHub */
function evaluar(actual, release) {
  const ultima = partes(release?.tag_name);
  if (!ultima) return { tipo: 'error', motivo: 'GitHub no ha devuelto ninguna versión publicada' };
  const version = ultima.join('.');
  if (comparar(version, actual) > 0) return { tipo: 'nueva', version, url: release.html_url || PAGINA_RELEASES, notas: resumir(release.body) };
  return { tipo: 'al-dia', version };
}

/** Pide la última Release a GitHub (con `net.fetch` de Electron o, en las pruebas, otro `fetch`) */
async function consultar(fetchFn, actual) {
  try {
    const r = await fetchFn(API_ULTIMA, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Automatizacion/${actual}` } });
    if (r.status === 404) return { tipo: 'error', motivo: 'todavía no hay ninguna versión publicada' };
    if (r.status === 403 || r.status === 429) return { tipo: 'error', motivo: 'GitHub limita las consultas seguidas: prueba otra vez dentro de un rato' };
    if (!r.ok) return { tipo: 'error', motivo: `GitHub ha respondido con el código ${r.status}` };
    return evaluar(actual, await r.json());
  } catch {
    return { tipo: 'error', motivo: 'no hay conexión con GitHub' };
  }
}

/** Cómo se instala encima de la anterior, según el sistema (con Wine, el .exe de Windows) */
function pasos(plataforma) {
  return plataforma === 'darwin'
    ? 'Descarga el .dmg, sal de la app (⌘Q), abre el .dmg y arrastra Automatizacion a Aplicaciones eligiendo «Reemplazar».'
    : 'Descarga Automatizacion-Setup-….exe, cierra la app y ejecuta el instalador: sustituye a la versión anterior.';
}

let buscando = false;

/** Menú ▸ Buscar actualizaciones…: consulta y lo dice en un cuadro de diálogo; con versión nueva, «Actualizar» abre su página */
async function buscarActualizaciones({ app, dialog, shell, net }, ventana, plataforma = process.platform) {
  if (buscando) return;
  buscando = true;
  try {
    const actual = app.getVersion();
    const res = await consultar((url, o) => net.fetch(url, o), actual);
    const caja = (o) => (ventana && !ventana.isDestroyed() ? dialog.showMessageBox(ventana, o) : dialog.showMessageBox(o));
    if (res.tipo === 'nueva') {
      const { response } = await caja({
        type: 'info', title: 'Actualizaciones', buttons: ['Actualizar', 'Más tarde'], defaultId: 0, cancelId: 1,
        message: `Hay una versión nueva: ${res.version}`,
        detail: `Tienes la ${actual}. «Actualizar» abre su página en el navegador.\n\n${pasos(plataforma)} Tus proyectos se conservan.${res.notas ? `\n\nNovedades:\n${res.notas}` : ''}`,
      });
      if (response === 0) await shell.openExternal(res.url);
    } else if (res.tipo === 'al-dia') {
      await caja({
        type: 'info', title: 'Actualizaciones', buttons: ['Aceptar'],
        message: 'Tienes la última versión',
        detail: comparar(actual, res.version) > 0 ? `Tienes la ${actual}; la última publicada es la ${res.version}.` : `Versión ${actual}.`,
      });
    } else {
      const { response } = await caja({
        type: 'warning', title: 'Actualizaciones', buttons: ['Aceptar', 'Abrir la página de versiones'], defaultId: 0, cancelId: 0,
        message: 'No se ha podido comprobar si hay actualizaciones',
        detail: `Motivo: ${res.motivo}.`,
      });
      if (response === 1) await shell.openExternal(PAGINA_RELEASES);
    }
    return res;
  } finally {
    buscando = false;
  }
}

module.exports = { partes, comparar, evaluar, consultar, pasos, buscarActualizaciones, PAGINA_RELEASES };
