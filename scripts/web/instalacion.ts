// Página «Instalación» (docs/<idioma>/<carpeta>/): los pasos de web/instalacion/textos.ts, cada uno con su captura,
// con la plantilla de la teoría. Datos estructurados HowTo para los buscadores.
import type { Idioma } from '../../web/teoria/paginas';
import type { Textos } from '../../web/teoria/textos';
import { INSTALACION } from '../../web/instalacion/textos';
import { esc, markdown } from './html';
import { pagina, rutaPortada, WEB, type Alternativa } from './plantilla';

export const rutaInstalacion = (idioma: Idioma): string | null => {
  const ti = INSTALACION[idioma];
  return ti ? `${idioma}/${ti.carpeta}/` : null;
};

export function paginaInstalacion(idioma: Idioma, t: Textos, alternativas: Alternativa[]): { ruta: string; html: string } | null {
  const ti = INSTALACION[idioma];
  const ruta = rutaInstalacion(idioma);
  if (!ti || !ruta) return null;
  const raiz = '../../';
  const portada = raiz + rutaPortada(idioma);
  const md = (s: string) => markdown(s.replace(/\{portada\}/g, portada));
  const url = WEB + ruta;

  const pasos = ti.pasos.map((p, i) => {
    const n = i + 1;
    const c = p.captura;
    const figura = c
      ? `<figure class="inst-captura" style="max-width: ${c.maximo}px">
            <img src="${raiz}images/instalacion/${c.fichero}" width="${c.ancho}" height="${c.alto}" alt="${esc(c.alt)}" loading="${n <= 2 ? 'eager' : 'lazy'}" decoding="async">
          </figure>`
      : '';
    const recuadro = p.recuadro
      ? `<aside class="inst-recuadro">
            <h3>${esc(p.recuadro.titulo)}</h3>
            ${md(p.recuadro.texto)}
          </aside>`
      : '';
    return `<li class="inst-paso" id="paso-${n}">
        <div class="inst-num" aria-hidden="true"><span>${esc(ti.paso)}</span><b>${n}</b></div>
        <div class="inst-contenido">
          <h2><span class="sr-only">${esc(ti.paso)} ${n}: </span>${esc(p.titulo)}</h2>
          ${md(p.texto)}
          ${figura}
          ${recuadro}
        </div>
      </li>`;
  });

  const cuerpo = `  <main class="contenedor instalacion">
    <div class="inst-cabeza">
      <p class="antetitulo">${esc(ti.antetitulo)}</p>
      <h1>${esc(ti.titulo)}</h1>
      <p class="articulo-entradilla">${esc(ti.entradilla)}</p>
    </div>
    <ol class="inst-pasos">
      ${pasos.join('\n      ')}
    </ol>
    <section class="inst-extra">
      <h2>${esc(ti.extraTitulo)}</h2>
      <ul>
        ${ti.extra.map((x) => `<li>${md(x).replace(/^<p>|<\/p>\s*$/g, '')}</li>`).join('\n        ')}
      </ul>
    </section>
  </main>`;

  const html = pagina({
    idioma, t, raiz, ruta,
    titulo: ti.titulo,
    descripcion: ti.descripcion,
    alternativas,
    activo: 'instalacion',
    datos: [
      {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: ti.titulo,
        description: ti.descripcion,
        inLanguage: idioma,
        url,
        totalTime: 'PT3M',
        tool: [{ '@type': 'HowToTool', name: 'Windows 10 / 11 (64 bits)' }],
        step: ti.pasos.map((p, i) => ({
          '@type': 'HowToStep',
          position: i + 1,
          name: p.titulo,
          text: p.texto.replace(/\{portada\}/g, WEB + rutaPortada(idioma)).replace(/\*\*|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'),
          url: `${url}#paso-${i + 1}`,
          ...(p.captura ? { image: `${WEB}images/instalacion/${p.captura.fichero}` } : {}),
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Automatizacion', item: WEB + rutaPortada(idioma) },
          { '@type': 'ListItem', position: 2, name: ti.menu, item: url },
        ],
      },
    ],
    cuerpo,
  });
  return { ruta, html };
}
