// Preparación del markdown de los ejercicios: oculta lo que daría la respuesta.
import type { Ejercicio } from './banco';

/** Quita los bloques ```yaml (contienen las pruebas y por tanto las respuestas). */
export function stripYaml(md: string): string {
  return md.replace(/```yaml\n[\s\S]*?```\n?/g, '');
}

/** Quita el primer bloque ```lang. */
export function stripFirstBlock(md: string, lang: string): string {
  const re = new RegExp('```' + lang + '\\n[\\s\\S]*?```\\n?');
  return md.replace(re, '');
}

export function stripAllBlocks(md: string, lang: string): string {
  const re = new RegExp('```' + lang + '\\n[\\s\\S]*?```\\n?', 'g');
  return md.replace(re, '');
}

/** Texto hasta <details> (la solución va dentro de <details> o después). */
export function cutAtDetails(md: string): { before: string; after: string } {
  const i = md.indexOf('<details>');
  if (i < 0) return { before: md, after: '' };
  return { before: md.slice(0, i), after: md.slice(i) };
}

/** Enunciado que se muestra antes de responder, según el tipo de ejercicio. */
export function enunciado(e: Ejercicio): string {
  let md = stripYaml(e.markdown);
  switch (e.tipo) {
    case 'predice':
    case 'programa':
      md = cutAtDetails(md).before;
      if (e.tipo === 'programa') md = stripAllBlocks(md, 'awl');
      return md;
    case 'traduce':
      md = cutAtDetails(md).before;
      if (/Pasar a AWL/i.test(e.titulo)) md = stripAllBlocks(md, 'awl');
      else md = stripAllBlocks(md, 'text');
      return md;
    case 'cronograma':
      return stripAllBlocks(stripAllBlocks(md, 'text'), 'awl');
    case 'traza':
      return cutAtDetails(md).before;
    default:
      return md;
  }
}

/** Solución completa (después de responder). */
export function solucion(e: Ejercicio): string {
  return stripYaml(e.markdown).replace(/<details>\s*<summary>[^<]*<\/summary>/g, '').replace(/<\/details>/g, '');
}

export const traduceDireccion = (e: Ejercicio): 'aAWL' | 'aKOP' => (/Pasar a AWL/i.test(e.titulo) ? 'aAWL' : 'aKOP');
