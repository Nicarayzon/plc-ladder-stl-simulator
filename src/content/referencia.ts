// Teoría (referencia_KOP_AWL.md) dividida en capítulos
import raw from './referencia_KOP_AWL.md?raw';

export interface Capitulo { n: string; titulo: string; md: string; secciones: { id: string; titulo: string }[] }

const slug = (s: string) => s.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');

export function capitulos(): Capitulo[] {
  const lines = raw.split('\n');
  const out: Capitulo[] = [];
  let intro: string[] = [];
  let cur: { n: string; titulo: string; lines: string[] } | null = null;
  for (const l of lines) {
    const m = /^## (\d+)\.\s+(.*)$/.exec(l);
    if (m) {
      if (cur) out.push(mk(cur));
      cur = { n: m[1], titulo: m[2].trim(), lines: [l] };
      continue;
    }
    if (/^## Índice/.test(l)) { cur = null; continue; }
    if (cur) cur.lines.push(l);
    else intro.push(l);
  }
  if (cur) out.push(mk(cur));
  intro = intro.filter((l) => !/^\s*([-*]|\d+\.) \[/.test(l));
  return [{ n: '0', titulo: 'Presentación', md: intro.join('\n'), secciones: [] }, ...out];
}

function mk(c: { n: string; titulo: string; lines: string[] }): Capitulo {
  const secciones = c.lines.filter((l) => /^### /.test(l)).map((l) => {
    const t = l.replace(/^### /, '').trim();
    return { id: slug(t), titulo: t };
  });
  return { n: c.n, titulo: c.titulo, md: c.lines.join('\n'), secciones };
}

export const REFERENCIA = raw;
