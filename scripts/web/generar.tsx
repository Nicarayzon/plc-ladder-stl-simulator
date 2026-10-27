// Genera las páginas de teoría de la web en docs/<idioma>/<carpeta>/ y el sitemap.xml.
// Se ejecuta con «npm run web:teoria» (scripts/web-teoria.mjs), desde app/.
import fs from 'node:fs';
import path from 'node:path';
import { kopModel } from '../../src/content/kop/models';
import { translateAwl } from '../../src/core/translate';
import { EJEMPLOS_WEB, MINIS, type EjemploWeb } from '../../web/teoria/ejemplos-web';
import { PAGINAS, type Idioma, type Pagina } from '../../web/teoria/paginas';
import { TEXTOS, type Textos } from '../../web/teoria/textos';
import { cronogramas } from './cronogramas';
import { figuras } from './figuras';
import { ejemplo, preguntasDe, seccion, type Bloque } from './fuentes';
import { ancla, enLinea, esc, kop, markdown } from './html';
import { pagina, rutaPortada, WEB, type Alternativa } from './plantilla';
import { datosDePruebas, type DatosVivo } from './vivo-datos';

const IDIOMAS: Idioma[] = ['es', 'en', 'de'];

interface Fuentes {
  /** La referencia y, detrás, la teoría que solo está en la web (web/teoria/<idioma>/extra.md) */
  referencia: string;
  ejemplos: string;
  /** Preguntas frecuentes de cada página (web/teoria/<idioma>/preguntas.md) */
  preguntas: string;
}

interface Destino {
  pagina: Pagina;
  ancla: string;
  titulo: string;
}

function leerFuentes(raiz: string, idioma: Idioma): Fuentes | null {
  const [ref, ej] = idioma === 'es'
    ? ['src/content/referencia_KOP_AWL.md', 'src/content/ejemplos_KOP_AWL.md']
    : [`web/teoria/${idioma}/referencia.md`, `web/teoria/${idioma}/ejemplos.md`];
  const a = path.join(raiz, ref);
  const b = path.join(raiz, ej);
  if (!fs.existsSync(a) || !fs.existsSync(b)) return null;
  const opcional = (f: string) => {
    const ruta = path.join(raiz, 'web/teoria', idioma, f);
    return fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : '';
  };
  return {
    referencia: `${fs.readFileSync(a, 'utf8')}\n\n${opcional('extra.md')}`,
    ejemplos: fs.readFileSync(b, 'utf8'),
    preguntas: opcional('preguntas.md'),
  };
}

const completa = (p: Pagina, i: Idioma) => Boolean(p.slug[i] && p.titulo[i] && p.corto[i] && p.descripcion[i]);
const rutaIndice = (i: Idioma, t: Textos) => `${i}/${t.carpeta}/`;
const rutaPagina = (p: Pagina, i: Idioma, t: Textos) => `${rutaIndice(i, t)}${p.slug[i]}/`;

// ───────── Retoques del Markdown para la web ─────────

/** «§6.2 y §7.4 de la referencia» → «ver [Título](enlace) y [Título](enlace)» */
function enlaces(md: string, destinos: Map<string, Destino>, actual: Pagina, idioma: Idioma, t: Textos): string {
  // §6.2, §11 o §S.1 (apartados de la teoría que solo está en la web)
  const ref = '§(?:\\d+|[A-Z])(?:\\.\\d+)?';
  const cadena = new RegExp(`${ref}(?:\\s*(?:,|${t.y})\\s*${ref})*(?:${t.deLaReferencia})?`, 'g');
  return md
    .replace(cadena, (todo) => {
      const vinculos = [...todo.matchAll(/§((?:\d+|[A-Z])(?:\.\d+)?)/g)]
        .map((m) => destinos.get(m[1]))
        .filter((d): d is Destino => Boolean(d))
        .map((d) => {
          // un título corto («Resumen», «Elementos») no se entiende fuera de su página: va con el nombre de la página
          const otra = d.pagina !== actual;
          const texto = otra && d.titulo.split(/\s+/).length <= 2 ? `${d.pagina.corto[idioma]}: ${d.titulo}` : d.titulo;
          return `[${texto}](${otra ? `../${d.pagina.slug[idioma]}/` : ''}#${d.ancla})`;
        });
      // una referencia sin página se quita; si estaba sola entre paréntesis, también los paréntesis
      return vinculos.length ? `${t.ver} ${vinculos.join(` ${t.y} `)}` : '\u0000';
    })
    .replace(/\s*\(\s*\u0000\s*\)/g, '')
    .replace(/\u0000/g, '');
}

/** Markdown → texto sin marcas, para los datos estructurados */
const textoPlano = (md: string) => md
  .replace(/```[a-z]*\n([\s\S]*?)```/g, '$1')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[*`]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const sinYaml = (md: string) => md.replace(/```yaml\n[\s\S]*?```\n?/g, '');
/** «**Enunciado**: …» y «**Conceptos**: …» en párrafos separados */
const parrafos = (md: string) => md.replace(/([^\n])\n(\*\*[^*\n]+\*\*:)/g, '$1\n\n$2');

/**
 * HTML de un ejemplo. Si tiene modelo KOP, su dibujo sustituye al esquema ASCII. Los ejemplos resueltos
 * llevan además el panel interactivo (docs/vivo.js), con las entradas y salidas que usan sus pruebas
 * (o las que trae el ejemplo, si solo está en la web).
 */
function cuerpoEjemplo(md: string, mdEs: string, codigo: string, idioma: Idioma, t: Textos, interactivo: boolean, retocar: (md: string) => string, web?: EjemploWeb): string {
  let texto = parrafos(sinYaml(md));
  const esquema = interactivo
    ? kop(web ? web.kop : kopModel(codigo), { ingles: idioma === 'en', segmento: t.segmento, titulos: idioma === 'es', etiqueta: t.esquemaKop })
    : null;
  // sin esquema ASCII, el dibujo va antes del código AWL
  if (esquema) texto = /```text\n/.test(texto)
    ? texto.replace(/```text\n[\s\S]*?```/, '<div data-kop></div>')
    : texto.replace(/```awl\n/, '<div data-kop></div>\n\n```awl\n');
  let html = markdown(retocar(texto));
  if (!interactivo) return html;

  // las pruebas y el código que ejecuta el panel salen siempre del documento en español (el que comprueba la app)
  const nemotecnia = idioma === 'en' ? 'en' : 'de';
  const pruebas = [...mdEs.matchAll(/```yaml\n([\s\S]*?)```/g)].map((m) => m[1]).join('\n');
  const datos: DatosVivo = web
    ? { id: codigo, kop: true, segmentos: web.kop, marcaCiclo: web.marcaCiclo, nemotecnia, entradas: web.entradas, salidas: web.salidas }
    : {
      id: codigo,
      kop: Boolean(esquema),
      awl: esquema ? undefined : /```awl\n([\s\S]*?)```/.exec(mdEs)?.[1],
      nemotecnia,
      ...datosDePruebas(pruebas),
    };
  const panel = `<div class="vivo" data-vivo="${esc(JSON.stringify(datos))}"></div>`;
  if (esquema) html = html.replace('<div data-kop=""></div>', esquema + panel);
  else html += panel;
  return html;
}

const avisados = new Set<string>();

/** Apartado de la teoría; en inglés y alemán, null (con un aviso) si todavía no está traducido */
function apartado(f: Fuentes, ref: string, idioma: Idioma, pagina: string): Bloque | null {
  try {
    return seccion(f.referencia, ref);
  } catch (err) {
    if (idioma === 'es') throw err;
    const aviso = `  ${idioma}: falta traducir ${ref} (página ${pagina})`;
    if (!avisados.has(aviso)) console.warn(aviso);
    avisados.add(aviso);
    return null;
  }
}

/** Ejemplo pequeño dentro del texto («<!-- probar: id -->»): esquema KOP, panel «Pruébalo» y código AWL */
function mini(id: string, idioma: Idioma, t: Textos, retocar: (md: string) => string): string {
  const m = MINIS[id];
  if (!m) throw new Error(`No existe el ejemplo en línea «${id}» (web/teoria/ejemplos-web.ts)`);
  const esquema = kop(m.kop, { ingles: idioma === 'en', segmento: t.segmento, titulos: false, etiqueta: t.esquemaKop })!;
  const datos: DatosVivo = {
    id: `mini-${id}`, kop: true, segmentos: m.kop, marcaCiclo: m.marcaCiclo,
    nemotecnia: idioma === 'en' ? 'en' : 'de', entradas: m.entradas, salidas: m.salidas,
  };
  const codigo = markdown(retocar(`\`\`\`awl\n${m.awl[idioma] ?? m.awl.es}\n\`\`\``));
  return `<div class="ejemplo mini" id="probar-${id}">${esquema}<div class="vivo" data-vivo="${esc(JSON.stringify(datos))}"></div>${codigo}</div>`;
}

// ───────── Páginas ─────────

function lista(pags: Pagina[], idioma: Idioma, actual: Pagina | null, prefijo: string): string {
  return `<ol>${pags.map((p) =>
    `<li><a href="${prefijo}${p.slug[idioma]}/"${p === actual ? ' aria-current="page"' : ''}>${esc(p.corto[idioma]!)}</a></li>`).join('')}</ol>`;
}

/** inicio: la portada del idioma, donde están las descargas */
function practica(t: Textos, inicio: string): string {
  return `<aside class="practica">
      <div>
        <h2>${esc(t.practicaTitulo)}</h2>
        <p>${esc(t.practicaTexto)}</p>
      </div>
      <a class="btn btn-primario" href="${inicio}#descargar"><svg class="icono"><use href="#i-descarga" /></svg>${esc(t.practicaBoton)}</a>
    </aside>`;
}

interface Contexto {
  idioma: Idioma;
  t: Textos;
  f: Fuentes;
  /** Documentos en español: de ellos salen las pruebas y el código de los paneles interactivos */
  fEs: Fuentes;
  pags: Pagina[];
  destinos: Map<string, Destino>;
  alternativas: (p: Pagina | null) => Alternativa[];
}

function articulo(c: Contexto, p: Pagina, k: number): { ruta: string; html: string } {
  const { idioma, t, f, pags, destinos } = c;
  const ruta = rutaPagina(p, idioma, t);
  const raiz = '../../../';
  const retocar = (md: string) => {
    let r = enlaces(md, destinos, p, idioma, t);
    for (const q of t.quitar) r = r.replace(q, '');
    // en inglés, el código AWL con la nemotecnia inglesa (los documentos lo tienen en alemán, como la app)
    if (idioma === 'en') r = r.replace(/```awl\n([\s\S]*?)```/g, (_, codigo: string) => `\`\`\`awl\n${translateAwl(codigo.replace(/\n$/, ''), 'en')}\n\`\`\``);
    return r;
  };

  const partes: string[] = [];
  for (const s of p.secciones) {
    const b = apartado(f, s.ref, idioma, p.id);
    if (!b) continue;
    const titulo = s.titulo?.[idioma] ?? b.titulo;
    // los cronogramas dibujados van donde la referencia tiene el de ASCII (con «‾») o un «<!-- cronograma -->»
    const crono = cronogramas(s.ref, idioma, t.cronogramas);
    let md = retocar(b.cuerpo);
    if (crono) {
      const marca = ['<!-- cronograma -->', '<!-- figura -->'].find((m) => md.includes(m));
      md = marca
        ? md.replace(marca, '<div data-crono></div>')
        : md.replace(/```text\n(?:(?!```)[\s\S])*‾[\s\S]*?```/, '<div data-crono></div>');
    }
    // los esquemas en ASCII que quedan (bloques ```text que no son cronogramas) se sustituyen por figuras
    md = md.replace(/<!-- probar: ([\w-]+) -->/g, (_, id: string) => `<div data-probar="${id}"></div>`);
    const figs = figuras(s.ref, idioma, t.figuras);
    if (figs) {
      let k = 0;
      md = md.replace(/```text\n[\s\S]*?```/g, (bloque) => (bloque.includes('‾') || k >= figs.length ? bloque : `<div data-fig="${k++}"></div>`));
      if (k !== figs.length) throw new Error(`La sección ${s.ref} (${idioma}) tiene ${k} esquemas y hay ${figs.length} figuras`);
    }
    const html = markdown(md)
      .replace('<div data-crono=""></div>', crono ?? '')
      .replace(/<div data-fig="(\d+)"><\/div>/g, (_, i: string) => figs![Number(i)])
      .replace(/<div data-probar="([\w-]+)"><\/div>/g, (_, id: string) => mini(id, idioma, t, retocar));
    partes.push(`<section><h2 id="${ancla(titulo)}">${enLinea(titulo)}</h2>\n${html}</section>`);
  }

  const bloqueEjemplos = (codigos: string[] | undefined, clase: string, titulo: string, nota: string | null, interactivo: boolean) => {
    if (!codigos?.length) return;
    const items = codigos.map((codigo) => {
      // los ejemplos que solo están en la web no llevan código: no se pueden buscar en la app
      const web = EJEMPLOS_WEB[codigo];
      const b = web
        ? { titulo: web.titulo[idioma]!, cuerpo: `**${t.enunciado}**: ${web.enunciado[idioma]}\n\n\`\`\`awl\n${web.awl[idioma]}\n\`\`\`` }
        : ejemplo(f.ejemplos, codigo);
      const mdEs = web ? b.cuerpo : ejemplo(c.fEs.ejemplos, codigo).cuerpo;
      const html = cuerpoEjemplo(b.cuerpo, mdEs, codigo, idioma, t, interactivo, retocar, web);
      return `<article class="${clase}" id="${codigo.toLowerCase()}">
          <h3>${web ? '' : `<span class="codigo">${esc(codigo)}</span>`}${enLinea(b.titulo)}</h3>
          ${html}
        </article>`;
    });
    partes.push(`<section><h2 id="${ancla(titulo)}">${esc(titulo)}</h2>${nota ? `<p class="nota">${esc(nota)}</p>` : ''}
        ${items.join('\n')}</section>`);
  };
  bloqueEjemplos(p.ejemplos, 'ejemplo', t.ejemplos, null, true);
  bloqueEjemplos(p.preguntas, 'pregunta', t.preguntas, t.preguntasPie, false);

  const faq = preguntasDe(f.preguntas, p.id);
  if (faq.length) {
    partes.push(`<section><h2 id="${ancla(t.faq)}">${esc(t.faq)}</h2>
        <div class="preguntas faq">
          ${faq.map((q) => `<details><summary>${enLinea(q.pregunta)}</summary><div class="faq-respuesta">${markdown(retocar(q.respuesta))}</div></details>`).join('\n          ')}
        </div></section>`);
  }

  const ant = pags[k - 1];
  const sig = pags[k + 1];
  const enlacePag = (q: Pagina | undefined, clase: string, rotulo: string) => q
    ? `<a class="${clase}" href="../${q.slug[idioma]}/"><span>${esc(rotulo)}</span><b>${esc(q.corto[idioma]!)}</b></a>`
    : '<span></span>';

  const cuerpo = `  <div class="contenedor teoria">
    <nav class="lateral" aria-label="${esc(t.indice)}">
      <p class="lateral-titulo"><a href="../">${esc(t.teoria)}</a></p>
      ${lista(pags, idioma, p, '../')}
    </nav>
    <main class="articulo">
      <details class="indice-movil">
        <summary>${esc(t.indice)}</summary>
        ${lista(pags, idioma, p, '../')}
      </details>
      <nav class="migas" aria-label="Breadcrumb"><a href="../">${esc(t.teoria)}</a><span aria-hidden="true">›</span><span>${esc(p.corto[idioma]!)}</span></nav>
      <h1>${esc(p.titulo[idioma]!)}</h1>
      <p class="articulo-entradilla">${esc(p.descripcion[idioma]!)}</p>
      <div class="articulo-cuerpo">
${partes.join('\n')}
      </div>
      ${practica(t, raiz + rutaPortada(idioma))}
      <nav class="paginacion" aria-label="${esc(t.indice)}">
        ${enlacePag(ant, 'pag-ant', `← ${t.anterior}`)}
        ${enlacePag(sig, 'pag-sig', `${t.siguiente} →`)}
      </nav>
    </main>
  </div>${partes.some((x) => x.includes('data-vivo')) ? `
  <script type="application/json" id="vivo-textos">${JSON.stringify(t.vivo).replace(/</g, '\\u003c')}</script>
  <script type="module" src="${raiz}vivo.js"></script>` : ''}`;

  const url = WEB + ruta;
  const html = pagina({
    idioma, t, raiz, ruta,
    titulo: p.titulo[idioma]!,
    descripcion: p.descripcion[idioma]!,
    alternativas: c.alternativas(p),
    datos: [
      {
        '@context': 'https://schema.org',
        '@type': 'TechArticle',
        headline: p.titulo[idioma],
        description: p.descripcion[idioma],
        inLanguage: idioma,
        url,
        image: `${WEB}images/img5.png`,
        author: { '@type': 'Person', name: 'Arzath' },
        isPartOf: { '@type': 'WebSite', name: 'Automatizacion', url: WEB },
      },
      ...(faq.length ? [{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((q) => ({
          '@type': 'Question',
          name: q.pregunta.replace(/`/g, ''),
          acceptedAnswer: { '@type': 'Answer', text: textoPlano(retocar(q.respuesta)) },
        })),
      }] : []),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Automatizacion', item: WEB },
          { '@type': 'ListItem', position: 2, name: t.teoria, item: WEB + rutaIndice(idioma, t) },
          { '@type': 'ListItem', position: 3, name: p.corto[idioma], item: url },
        ],
      },
    ],
    cuerpo,
  });
  return { ruta, html };
}

function portadaTeoria(c: Contexto): { ruta: string; html: string } {
  const { idioma, t, pags } = c;
  const ruta = rutaIndice(idioma, t);
  const raiz = '../../';
  const temas = pags.map((p, i) => `<li><a href="${p.slug[idioma]}/">
          <span class="tema-num">${String(i + 1).padStart(2, '0')}</span>
          <b>${esc(p.corto[idioma]!)}</b>
          <span class="tema-desc">${esc(p.descripcion[idioma]!)}</span>
        </a></li>`).join('\n        ');
  const cuerpo = `  <main class="contenedor teoria-portada">
    <div class="encabezado">
      <p class="antetitulo">${esc(t.teoria)}</p>
      <h1>${esc(t.tituloIndice)}</h1>
      <p>${esc(t.entradillaIndice)}</p>
    </div>
    <ol class="temas">
        ${temas}
    </ol>
    ${practica(t, raiz + rutaPortada(idioma))}
  </main>`;
  const html = pagina({
    idioma, t, raiz, ruta,
    titulo: t.tituloIndice,
    descripcion: t.descripcionIndice,
    alternativas: c.alternativas(null),
    datos: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: t.tituloIndice,
      description: t.descripcionIndice,
      inLanguage: idioma,
      url: WEB + ruta,
      isPartOf: { '@type': 'WebSite', name: 'Automatizacion', url: WEB },
    }],
    cuerpo,
  });
  return { ruta, html };
}

// ───────── Sitemap ─────────

function sitemap(urls: { ruta: string; lastmod: string; alternos: Alternativa[] }[]): string {
  const filas = urls.map((u) => {
    const alt = u.alternos.length > 1
      ? u.alternos.map((a) => `\n    <xhtml:link rel="alternate" hreflang="${a.idioma}" href="${WEB}${a.ruta}"/>`).join('')
      : '';
    return `  <url>\n    <loc>${WEB}${u.ruta}</loc>\n    <lastmod>${u.lastmod}</lastmod>${alt}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${filas.join('\n')}
</urlset>
`;
}

const hoy = () => new Date().toISOString().slice(0, 10);

// ───────── Principal ─────────

export function generar(raiz: string): void {
  const docs = path.join(raiz, 'docs');
  const ficheroSitemap = path.join(docs, 'sitemap.xml');
  const viejoSitemap = fs.existsSync(ficheroSitemap) ? fs.readFileSync(ficheroSitemap, 'utf8') : '';
  const fechas = new Map([...viejoSitemap.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));

  const idiomas = IDIOMAS.filter((i) => TEXTOS[i] && leerFuentes(raiz, i));
  const salida = new Map<string, string>();
  const urls: { ruta: string; lastmod: string; alternos: Alternativa[] }[] = [];

  // Las portadas (docs/index.html, docs/en/index.html…) se escriben a mano: su fecha es la de la última modificación
  const portadas: Alternativa[] = IDIOMAS
    .filter((i) => TEXTOS[i] && fs.existsSync(path.join(docs, rutaPortada(i), 'index.html')))
    .map((i) => ({ idioma: i, nombre: TEXTOS[i]!.nombre, ruta: rutaPortada(i) }));
  for (const a of portadas) {
    const lastmod = fs.statSync(path.join(docs, a.ruta, 'index.html')).mtime.toISOString().slice(0, 10);
    urls.push({ ruta: a.ruta, lastmod, alternos: portadas });
  }

  const alternativas = (p: Pagina | null): Alternativa[] => idiomas
    .filter((i) => !p || completa(p, i))
    .map((i) => ({ idioma: i, nombre: TEXTOS[i]!.nombre, ruta: p ? rutaPagina(p, i, TEXTOS[i]!) : rutaIndice(i, TEXTOS[i]!) }));

  for (const idioma of idiomas) {
    const t = TEXTOS[idioma]!;
    const f = leerFuentes(raiz, idioma)!;
    const pags = PAGINAS.filter((p) => completa(p, idioma));
    const destinos = new Map<string, Destino>();
    for (const p of pags) {
      for (const s of p.secciones) {
        const b = apartado(f, s.ref, idioma, p.id);
        if (!b) continue;
        const titulo = s.titulo?.[idioma] ?? b.titulo;
        destinos.set(s.ref, { pagina: p, ancla: ancla(titulo), titulo });
      }
    }
    const c: Contexto = { idioma, t, f, fEs: leerFuentes(raiz, 'es')!, pags, destinos, alternativas };
    const paginas = [portadaTeoria(c), ...pags.map((p, k) => articulo(c, p, k))];
    for (const { ruta, html } of paginas) {
      const fichero = path.join(docs, ruta, 'index.html');
      const igual = fs.existsSync(fichero) && fs.readFileSync(fichero, 'utf8') === html;
      salida.set(fichero, html);
      const p = pags.find((q) => rutaPagina(q, idioma, t) === ruta) ?? null;
      urls.push({ ruta, lastmod: (igual && fechas.get(WEB + ruta)) || hoy(), alternos: alternativas(p) });
    }
    console.log(`${idioma}: índice y ${pags.length} páginas`);
  }

  // Se rehacen las carpetas de teoría enteras, para que no queden páginas viejas
  for (const idioma of idiomas) fs.rmSync(path.join(docs, idioma, TEXTOS[idioma]!.carpeta), { recursive: true, force: true });
  for (const [fichero, html] of salida) {
    fs.mkdirSync(path.dirname(fichero), { recursive: true });
    fs.writeFileSync(fichero, html);
  }
  fs.writeFileSync(ficheroSitemap, sitemap(urls));
  console.log(`sitemap.xml: ${urls.length} direcciones`);
}
