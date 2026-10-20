// Banco de ejercicios (banco_ejercicios.json, exportado de ejemplos_KOP_AWL.md) con tipos y utilidades
import raw from './banco_ejercicios.json';
import type { CronoSpec, Prueba, TrazaSpec } from '../core/testrunner';
import type { InputTipo } from '../sim/SimController';

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

export const BANCO = (raw as unknown as { ejercicios: Ejercicio[] }).ejercicios;

export const byId = (id: string) => BANCO.find((e) => e.id === id);

export const TIPO_LABEL: Record<TipoEj, string> = {
  ejemplo: 'Ejemplo', predice: 'Predice', traduce: 'Traduce', programa: 'Programa', teoria: 'Teoría', traza: 'Traza', cronograma: 'Cronograma',
};

export const categorias = (): string[] => [...new Set(BANCO.map((e) => e.categoria))];
export const catLetter = (c: string) => c.slice(0, 1);

/** Entradas cableadas como pulsador NC en cada ejercicio (valen 1 en reposo). */
const NC_INPUTS: Record<string, string[]> = { E06: ['E0.1'], E07: ['E0.1'], E08: ['E0.1'], P01: ['E0.1'], P04: ['E0.1'] };

/** Tipo de cada entrada del ejercicio deducido del enunciado. */
export function inputTypesFor(e: Ejercicio): Map<string, InputTipo> {
  const m = new Map<string, InputTipo>();
  const md = e.markdown;
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
