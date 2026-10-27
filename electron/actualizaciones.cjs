// Buscar actualizaciones: compara la versión de la app con la última Release publicada en GitHub.
// Solo se conecta cuando se pide desde el menú. «Actualizar» abre la página de esa versión en el navegador,
// donde se descarga el instalador, que sustituye a la versión anterior (los proyectos se conservan).
const REPO = 'Nicarayzon/plc-ladder-stl-simulator';
const PAGINA_RELEASES = `https://github.com/${REPO}/releases`;
// textos en español por defecto; el menú pasa los del idioma de la app
const { textos } = require('./idioma.cjs');
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
function evaluar(actual, release, t = textos('es').actualizaciones) {
  const ultima = partes(release?.tag_name);
  if (!ultima) return { tipo: 'error', motivo: t.motivos.sinRelease };
  const version = ultima.join('.');
  if (comparar(version, actual) > 0) return { tipo: 'nueva', version, url: release.html_url || PAGINA_RELEASES, notas: resumir(release.body) };
  return { tipo: 'al-dia', version };
}

/** Pide la última Release a GitHub (con `net.fetch` de Electron o, en las pruebas, otro `fetch`) */
async function consultar(fetchFn, actual, t = textos('es').actualizaciones) {
  try {
    const r = await fetchFn(API_ULTIMA, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Automatizacion/${actual}` } });
    if (r.status === 404) return { tipo: 'error', motivo: t.motivos.sinVersiones };
    if (r.status === 403 || r.status === 429) return { tipo: 'error', motivo: t.motivos.limite };
    if (!r.ok) return { tipo: 'error', motivo: t.motivos.codigo(r.status) };
    return evaluar(actual, await r.json(), t);
  } catch {
    return { tipo: 'error', motivo: t.motivos.sinConexion };
  }
}

/** Cómo se instala encima de la anterior, según el sistema (con Wine, el .exe de Windows) */
function pasos(plataforma, t = textos('es').actualizaciones) {
  return plataforma === 'darwin' ? t.pasosMac : t.pasosWin;
}

let buscando = false;

/** Menú ▸ Buscar actualizaciones…: consulta y lo dice en un cuadro de diálogo; con versión nueva, «Actualizar» abre su página */
async function buscarActualizaciones({ app, dialog, shell, net, t = textos('es').actualizaciones }, ventana, plataforma = process.platform) {
  if (buscando) return;
  buscando = true;
  try {
    const actual = app.getVersion();
    const res = await consultar((url, o) => net.fetch(url, o), actual, t);
    const caja = (o) => (ventana && !ventana.isDestroyed() ? dialog.showMessageBox(ventana, o) : dialog.showMessageBox(o));
    if (res.tipo === 'nueva') {
      const { response } = await caja({
        type: 'info', title: t.titulo, buttons: [t.actualizar, t.masTarde], defaultId: 0, cancelId: 1,
        message: t.hayNueva(res.version),
        detail: `${t.tienes(actual)}\n\n${pasos(plataforma, t)} ${t.conservan}${res.notas ? `\n\n${t.novedades}\n${res.notas}` : ''}`,
      });
      if (response === 0) await shell.openExternal(res.url);
    } else if (res.tipo === 'al-dia') {
      await caja({
        type: 'info', title: t.titulo, buttons: [t.aceptar],
        message: t.alDia,
        detail: comparar(actual, res.version) > 0 ? t.masNueva(actual, res.version) : t.version(actual),
      });
    } else {
      const { response } = await caja({
        type: 'warning', title: t.titulo, buttons: [t.aceptar, t.abrirVersiones], defaultId: 0, cancelId: 0,
        message: t.noComprobado,
        detail: t.motivo(res.motivo),
      });
      if (response === 1) await shell.openExternal(PAGINA_RELEASES);
    }
    return res;
  } finally {
    buscando = false;
  }
}

module.exports = { partes, comparar, evaluar, consultar, pasos, buscarActualizaciones, PAGINA_RELEASES };
