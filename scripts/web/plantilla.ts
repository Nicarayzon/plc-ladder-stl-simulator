// Esqueleto HTML de las páginas de teoría: cabecera, pie y metadatos, con el mismo aspecto que la portada.
import type { Idioma } from '../../web/teoria/paginas';
import type { Textos } from '../../web/teoria/textos';
import { esc } from './html';

export const WEB = 'https://nicarayzon.github.io/plc-ladder-stl-simulator/';
const REPO = 'https://github.com/Nicarayzon/plc-ladder-stl-simulator';

export interface Alternativa {
  idioma: Idioma;
  nombre: string;
  /** Dirección relativa a la raíz de la web: «es/teoria/flancos/» */
  ruta: string;
}

export interface DatosPagina {
  idioma: Idioma;
  t: Textos;
  /** Prefijo relativo hasta la raíz de la web («../../../») */
  raiz: string;
  ruta: string;
  titulo: string;
  descripcion: string;
  alternativas: Alternativa[];
  /** Objetos JSON-LD */
  datos: object[];
  cuerpo: string;
}

const ICONOS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="i-github" viewBox="0 0 24 24"><path stroke="none" fill="currentColor" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.58 9.58 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></symbol>
    <symbol id="i-luna" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></symbol>
    <symbol id="i-sol" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></symbol>
    <symbol id="i-descarga" viewBox="0 0 24 24"><path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" /></symbol>
  </svg>`;

export function pagina(p: DatosPagina): string {
  const { t, raiz } = p;
  const url = WEB + p.ruta;
  const indice = `${raiz}${p.idioma}/${t.carpeta}/`;
  const alternos = p.alternativas.map((a) => `  <link rel="alternate" hreflang="${a.idioma}" href="${WEB}${a.ruta}">`);
  const porDefecto = p.alternativas.find((a) => a.idioma === 'es');
  if (porDefecto) alternos.push(`  <link rel="alternate" hreflang="x-default" href="${WEB}${porDefecto.ruta}">`);
  const selector = p.alternativas.length > 1
    ? `<nav class="idiomas" aria-label="${esc(t.idiomas)}">${p.alternativas.map((a) =>
      `<a href="${raiz}${a.ruta}" hreflang="${a.idioma}" lang="${a.idioma}" title="${esc(a.nombre)}"${a.idioma === p.idioma ? ' aria-current="page"' : ''}>${a.idioma.toUpperCase()}</a>`).join('')}</nav>`
    : '';

  return `<!doctype html>
<html lang="${p.idioma}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(p.titulo)} · Automatizacion</title>
  <meta name="description" content="${esc(p.descripcion)}">
  <meta name="author" content="Arzath">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" content="#0e1013">
  <link rel="icon" href="${raiz}favicon.svg" type="image/svg+xml">
  <link rel="canonical" href="${url}">
${alternos.join('\n')}
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Automatizacion">
  <meta property="og:locale" content="${t.locale}">
  <meta property="og:title" content="${esc(p.titulo)}">
  <meta property="og:description" content="${esc(p.descripcion)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${WEB}images/img5.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
  ${JSON.stringify(p.datos.length === 1 ? p.datos[0] : p.datos)}
  </script>
  <link rel="stylesheet" href="${raiz}estilos.css">
  <link rel="stylesheet" href="${raiz}teoria.css">
  <script>
    // tema elegido antes de pintar, para que no parpadee
    try { const t = localStorage.getItem('automatizacion-web-tema'); if (t) document.documentElement.dataset.theme = t; } catch (e) {}
  </script>
  <script src="${raiz}teoria.js" defer></script>
</head>
<body>
  ${ICONOS}

  <header class="cabecera">
    <div class="contenedor cabecera-fila">
      <a class="marca" href="${raiz}" aria-label="Automatizacion">
        <img src="${raiz}favicon.svg" alt="" width="30" height="30">
        <span>Automatizacion</span>
      </a>
      <nav class="menu" aria-label="${esc(t.teoria)}">
        <a href="${raiz}">${esc(t.simulador)}</a>
        <a href="${indice}" class="activo">${esc(t.teoria)}</a>
      </nav>
      <div class="cabecera-acciones">
        ${selector}
        <button class="boton-icono" id="cambiar-tema" type="button" aria-label="${esc(t.cambiarTema)}">
          <svg class="icono icono-sol"><use href="#i-sol" /></svg>
          <svg class="icono icono-luna"><use href="#i-luna" /></svg>
        </button>
        <a class="boton-icono" href="${REPO}" aria-label="${esc(t.codigoGitHub)}">
          <svg class="icono"><use href="#i-github" /></svg>
        </a>
        <a class="btn btn-primario btn-pequeno" href="${raiz}#descargar">${esc(t.descargar)}</a>
      </div>
    </div>
  </header>

${p.cuerpo}

  <footer class="pie">
    <div class="contenedor pie-fila">
      <div class="marca marca-pie">
        <img src="${raiz}favicon.svg" alt="" width="24" height="24">
        <span>Automatizacion</span>
      </div>
      <p>${esc(t.pie)}</p>
      <a href="${REPO}">GitHub</a>
    </div>
  </footer>
</body>
</html>
`;
}
