// Markdown → HTML estático, AWL resaltado y esquemas KOP dibujados con el mismo código que la app.
import { Children, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { layoutSegment } from '../../src/kop/layout';
import type { SegmentoKOP } from '../../src/kop/model';
import { KopSvg } from '../../src/kop/render/KopSvg';
import { displayOperand } from '../../src/core/translate';

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Título con `código` en línea, como en el Markdown */
export const enLinea = (s: string) => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

/** Identificador para anclas: minúsculas, sin tildes y con guiones */
export function ancla(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ───────── AWL ─────────

/** Constantes: números, S5T#…, C#…, W#16#…, P#…, 'A'… */
const CONSTANTE = /^(-?\d|[A-Z0-9]*#|')/i;

function resaltarLinea(linea: string): string {
  let resto = linea;
  let comentario = '';
  const ic = resto.indexOf('//');
  if (ic >= 0) { comentario = resto.slice(ic); resto = resto.slice(0, ic); }

  let html = '';
  const meta = /^(\s*)([A-Za-z_][A-Za-z0-9_]*:)/.exec(resto);
  if (meta) {
    html += `${meta[1]}<span class="t-meta">${esc(meta[2])}</span>`;
    resto = resto.slice(meta[0].length);
  }
  const ins = /^(\s*)(\S+)/.exec(resto);
  if (ins) {
    html += `${ins[1]}<span class="t-ins">${esc(ins[2])}</span>`;
    resto = resto.slice(ins[0].length);
  }
  const op = /^(\s*)(.*?)(\s*)$/.exec(resto)!;
  if (op[2]) html += `${op[1]}<span class="${CONSTANTE.test(op[2]) ? 't-cte' : 't-op'}">${esc(op[2])}</span>${op[3]}`;
  else html += resto;
  if (comentario) html += `<span class="t-com">${esc(comentario)}</span>`;
  return html;
}

export const resaltarAwl = (texto: string) => texto.split('\n').map(resaltarLinea).join('\n');

// ───────── Markdown ─────────

function Pre({ children }: { children?: ReactNode }) {
  const code = Children.toArray(children).find(isValidElement) as
    | { props: { className?: string; children?: ReactNode } }
    | undefined;
  const lenguaje = /language-(\w+)/.exec(code?.props.className ?? '')?.[1] ?? '';
  const texto = String(code?.props.children ?? '').replace(/\n$/, '');
  if (lenguaje === 'awl') {
    return <pre className="codigo-awl"><code dangerouslySetInnerHTML={{ __html: resaltarAwl(texto) }} /></pre>;
  }
  return <pre className="esquema"><code>{texto}</code></pre>;
}

function Tabla({ children }: { children?: ReactNode }) {
  return <div className="tabla"><table>{children}</table></div>;
}

export function markdown(md: string): string {
  return renderToStaticMarkup(
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ pre: Pre, table: Tabla }}>
      {md}
    </Markdown>,
  ).replace(/<code>([^<]*)<\/code>/g, (todo, texto: string) => iconoKop(desesc(texto)) ?? todo);
}

const desesc = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

// ───────── Símbolos KOP en línea ─────────

/** Elementos de un símbolo escrito en texto: «--», «| |», «|/|», «|NOT|», «( )», «(S)»… */
const ELEMENTO = /--|\|[^|]{0,4}\||\([^()]{0,5}\)/g;

/**
 * Dibuja en SVG los símbolos KOP que la referencia escribe con caracteres («--| |--», «T1 --(SE)», «(R)»),
 * o null si el código no es un símbolo. Usa el color del texto.
 */
export function iconoKop(texto: string): string | null {
  const m = /^(?:(\S+) )?((?:--|\|[^|]{0,4}\||\([^()]{0,5}\))+)$/.exec(texto);
  if (!m || !/[|(]/.test(m[2])) return null;
  const H = 20;
  const Y = H / 2;
  const LETRA = 6.6;
  const partes: string[] = [];
  let x = 1;
  if (m[1]) {
    partes.push(`<text x="${x}" y="${Y + 3.5}" class="ki-txt">${esc(m[1])}</text>`);
    x += m[1].length * LETRA + 5;
  }
  for (const el of m[2].match(ELEMENTO)!) {
    if (el === '--') {
      partes.push(`<path d="M${x} ${Y}h10"/>`);
      x += 10;
    } else if (el.startsWith('|')) {
      const dentro = el.slice(1, -1);
      if (dentro.trim() === '' || dentro === '/') {
        partes.push(`<path d="M${x + 2} 3v14M${x + 12} 3v14"/>`);
        if (dentro === '/') partes.push(`<path d="M${x + 3.5} 16L${x + 10.5} 4"/>`);
        x += 14;
      } else {
        const w = dentro.length * LETRA + 8;
        partes.push(`<rect x="${x}" y="3" width="${w}" height="14" rx="2"/><text x="${x + w / 2}" y="${Y + 3.5}" text-anchor="middle" class="ki-txt">${esc(dentro)}</text>`);
        x += w;
      }
    } else {
      const dentro = el.slice(1, -1).trim();
      const w = Math.max(16, dentro.length * LETRA + 12);
      partes.push(`<path d="M${x + 5} 3Q${x} ${Y} ${x + 5} 17M${x + w - 5} 3Q${x + w} ${Y} ${x + w - 5} 17"/>`);
      if (dentro) partes.push(`<text x="${x + w / 2}" y="${Y + 3.5}" text-anchor="middle" class="ki-txt">${esc(dentro)}</text>`);
      x += w;
    }
  }
  const W = Math.ceil(x + 1);
  return `<svg class="kop-ico" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(texto)}">${partes.join('')}</svg>`;
}

// ───────── KOP ─────────

const nada = () => {};

/** Dibujo SVG de un segmento KOP, sin corriente. En inglés, con la nemotécnica inglesa. */
export function svgKop(seg: SegmentoKOP, ingles: boolean, etiqueta: string): string {
  const lang = ingles ? 'en' : 'de';
  return renderToStaticMarkup(
    <KopSvg
      layout={layoutSegment(seg)} flow={null} selected={null} issues={new Map()} lang={lang}
      showOp={(op) => ({ main: displayOperand(op, lang) })}
      onSelect={nada} onEdit={nada} onPin={nada} onContext={nada}
    />,
  ).replace(/aria-label="[^"]*"/, `aria-label="${esc(etiqueta)}"`);
}

/** Esquema KOP de un ejemplo (su modelo, o null si no tiene) */
export function kop(segs: SegmentoKOP[] | null, o: { ingles: boolean; segmento: string; titulos: boolean; etiqueta: string }): string | null {
  if (!segs) return null;
  const partes = segs.map((seg, i) => {
    const svg = svgKop(seg, o.ingles, o.etiqueta);
    const nombre = `${o.segmento} ${i + 1}${o.titulos && seg.titulo ? ` · ${seg.titulo}` : ''}`;
    const titulo = segs.length > 1 ? `<p class="kop-titulo">${esc(nombre)}</p>` : '';
    return `<div class="kop-seg">${titulo}<div class="kop-lienzo">${svg}</div></div>`;
  });
  // docs/vivo.js vuelve a dibujar el esquema con el flujo de corriente y necesita los rótulos
  return `<figure class="kop" data-segmento="${esc(o.segmento)}"${o.titulos ? ' data-titulos="1"' : ''}>${partes.join('')}</figure>`;
}
