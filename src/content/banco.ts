// Banco de ejercicios (banco_ejercicios.json, exportado de ejemplos_KOP_AWL.md) con tipos y utilidades
import raw from './banco_ejercicios.json';
import ejemplosEn from '../../web/teoria/en/ejemplos.md?raw';
import ejemplosDe from '../../web/teoria/de/ejemplos.md?raw';
import type { CronoSpec, Prueba, TrazaSpec } from '../core/testrunner';
import type { InputTipo } from '../sim/SimController';
import { translateAwl } from '../core/translate';
import { idioma, T, type Idioma } from '../i18n';

export type TipoEj = 'ejemplo' | 'predice' | 'traduce' | 'programa' | 'teoria' | 'traza' | 'cronograma';

export interface Pregunta { id: string; pregunta: string; opciones: string[]; correcta: number; explicacion: string }

export interface Ejercicio {
  id: string;
  titulo: string;
  categoria: string;
  tipo: TipoEj;
  awl: string | null;
  kop_ascii: string | null;
  prueba: Prueba | null;
  traza: TrazaSpec | null;
  cronograma: CronoSpec | null;
  preguntas: Pregunta[] | null;
  markdown: string;
}

/** El banco original, en español: las pruebas, el código y lo que se deduce del enunciado salen de aquí */
export const BANCO_ES = (raw as unknown as { ejercicios: Ejercicio[] }).ejercicios;

/** Ejemplos traducidos (web/teoria/<idioma>/ejemplos.md): «### E06 — Título» y su texto, sin las pruebas */
const TRADUCCIONES: Partial<Record<Idioma, string>> = { en: ejemplosEn, de: ejemplosDe };

/** Primer bloque ```lang de un texto */
const bloque = (md: string, lang: string) => new RegExp('```' + lang + '\\n([\\s\\S]*?)```').exec(md)?.[1] ?? null;

export function traducciones(md: string): Map<string, { titulo: string; markdown: string }> {
  const out = new Map<string, { titulo: string; markdown: string }>();
  const partes = md.split(/^### /m).slice(1);
  for (const p of partes) {
    const m = /^(\w+) — (.*)\n([\s\S]*)$/.exec(p);
    if (m) out.set(m[1], { titulo: m[2].trim(), markdown: m[3].trim() + '\n' });
  }
  return out;
}

/** Los ejemplos en el idioma de la app. El código es el de la traducción (comentarios traducidos, misma nemotecnia
 *  alemana que el original); en el texto, el AWL se enseña con la nemotecnia del idioma (en inglés, la inglesa). */
function localizar(banco: Ejercicio[], i: Idioma): Ejercicio[] {
  const md = TRADUCCIONES[i];
  if (!md) return banco;
  const tr = traducciones(md);
  return banco.map((e) => {
    const t = e.tipo === 'ejemplo' ? tr.get(e.id) : undefined;
    const categoria = T.contenido.categorias[catLetter(e.categoria)] ?? e.categoria;
    if (!t) return { ...e, categoria };
    const markdown = i === 'en' ? t.markdown.replace(/```awl\n([\s\S]*?)```/g, (_m, c: string) => '```awl\n' + translateAwl(c, 'en') + '```') : t.markdown;
    return { ...e, categoria, titulo: t.titulo, markdown, awl: bloque(t.markdown, 'awl') ?? e.awl, kop_ascii: bloque(t.markdown, 'text') ?? e.kop_ascii };
  });
}

export const BANCO = localizar(BANCO_ES, idioma);

export const byId = (id: string) => BANCO.find((e) => e.id === id);

export const TIPO_LABEL: Record<TipoEj, string> = T.lista.tipos;

export const categorias = (): string[] => [...new Set(BANCO.map((e) => e.categoria))];
export function catLetter(c: string) { return c.slice(0, 1); }

/** Entradas cableadas como pulsador NC en cada ejercicio (valen 1 en reposo). */
const NC_INPUTS: Record<string, string[]> = { E06: ['E0.1'], E07: ['E0.1'], E08: ['E0.1'], P01: ['E0.1'], P04: ['E0.1'] };

/** Tipo de cada entrada del ejercicio deducido del enunciado. */
export function inputTypesFor(e: Ejercicio): Map<string, InputTipo> {
  const m = new Map<string, InputTipo>();
  // siempre del enunciado en español («pulsador»), sea cual sea el idioma de la app
  const md = BANCO_ES.find((x) => x.id === e.id)?.markdown ?? e.markdown;
  const re = /\bE\s?(\d+)\.(\d)\b([^\n]{0,40})/g;
  let x: RegExpExecArray | null;
  while ((x = re.exec(md)) !== null) {
    const key = `E${x[1]}.${x[2]}`;
    if (/pulsador/i.test(x[3]) && !m.has(key)) m.set(key, 'NA');
  }
  for (const k of NC_INPUTS[e.id] ?? []) m.set(k, 'NC');
  return m;
}

/** Bloques AWL del ejercicio (el banco solo trae OB1). */
export function ejercicioBlocks(e: Ejercicio): Record<string, string> {
  return { OB1: e.awl ?? '' };
}
