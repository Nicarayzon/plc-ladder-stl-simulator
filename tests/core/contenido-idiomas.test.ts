// El contenido traducido (Aprender y Ejemplos) tiene que ir a la par que el español:
// mismos ejemplos, mismo código (solo cambian los comentarios), mismos capítulos y títulos KOP traducidos
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BANCO_ES, traducciones } from '../../src/content/banco';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const leer = (f: string) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const sinComentarios = (awl: string) => awl.split('\n').map((l) => l.replace(/\/\/.*$/, '').trimEnd()).filter(Boolean).join('\n');
const bloque = (md: string, lang: string) => new RegExp('```' + lang + '\\n([\\s\\S]*?)```').exec(md)?.[1] ?? null;
const capitulos = (md: string) => [...md.matchAll(/^## (\d+)\./gm)].map((m) => m[1]);

describe.each([['en', en], ['de', de]] as const)('contenido en %s', (idioma, textos) => {
  const tr = traducciones(leer(`web/teoria/${idioma}/ejemplos.md`));
  const ejemplos = BANCO_ES.filter((e) => e.tipo === 'ejemplo');

  it('están los 31 ejemplos, con el mismo código que el original', () => {
    expect(ejemplos).toHaveLength(31);
    for (const e of ejemplos) {
      const t = tr.get(e.id);
      expect(t, `${e.id} sin traducir`).toBeTruthy();
      const awl = bloque(t!.markdown, 'awl');
      expect(awl, `${e.id} sin bloque awl`).not.toBeNull();
      expect(sinComentarios(awl!), e.id).toBe(sinComentarios(e.awl ?? ''));
    }
  });

  it('cada categoría de los ejemplos tiene nombre', () => {
    for (const e of ejemplos) expect(textos.contenido.categorias[e.categoria.slice(0, 1)], e.categoria).toBeTruthy();
  });

  it('los títulos y comentarios de los modelos KOP están traducidos', () => {
    const textosKop = [...leer('src/content/kop/models.ts').matchAll(/(?:titulo|comentario): '([^']*)'/g)].map((m) => m[1]);
    expect(textosKop.length).toBeGreaterThan(50);
    for (const t of textosKop) expect(textos.contenido.textosKop[t], t).toBeTruthy();
  });

  it('la teoría tiene los mismos capítulos que la española', () => {
    expect(capitulos(leer(`web/teoria/${idioma}/referencia.md`))).toEqual(capitulos(leer('src/content/referencia_KOP_AWL.md')));
  });
});
