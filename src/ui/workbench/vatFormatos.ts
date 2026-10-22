// Ventana «Var - VAT_n»: operandos, formatos de visualización y valores, sin interfaz (se prueba en tests/core/vat-ventana.test.ts)
import { FORMATOS, type Formato, fmtReal, fmtValue, parseUserValue } from '../../core/format';
import { bitsF32, s32 } from '../../core/num';
import { makeReader, type Reader } from '../../sim/readers';
import { MEM_PREFIX, type Symbols } from '../../core/operands';

const PREFIJO = new Map(Object.entries(MEM_PREFIX).map(([p, [area, size]]) => [`${area}${size}`, p]));

/** «md 200» → «MD  200», «m 10.3» → «M  10.3», «"Motor"» → su dirección: identificador, dos espacios y número, como en la tabla original */
export function normalizarOperando(text: string, symbols?: Symbols): { texto: string; reader: Reader } {
  const reader = makeReader(text, symbols, true);
  const op = reader.op;
  const db = op.db ? `${op.area}${op.db}.` : '';
  let texto = op.text;
  if (op.kind === 'timer' || op.kind === 'counter') texto = `${op.kind === 'timer' ? 'T' : 'Z'}  ${op.n}`;
  else if (op.kind === 'bit') texto = `${db}${op.area === 'DB' ? 'DBX' : op.area === 'DI' ? 'DIX' : op.area}  ${op.byte}.${op.bit}`;
  else if (op.kind === 'mem') texto = `${db}${PREFIJO.get(`${op.area}${op.size}`) ?? op.area}  ${op.byte}`;
  return { texto, reader };
}

/** El lector de una fila, o el error que se enseña en rojo. Una fila vacía no tiene lector. */
export function lectorDe(text: string, symbols?: Symbols): Reader | Error | null {
  if (!text.trim()) return null;
  try {
    return makeReader(text, symbols, true);
  } catch (e) {
    return e instanceof Error ? e : new Error(String(e));
  }
}

/** «T n» y «Z n» tienen un formato fijo (S5TIME y C#) */
export const formatoFijo = (r: Reader) => r.kind === 'timerS5' || r.kind === 'counterBcd';

/** Formatos que tienen sentido para el tamaño del operando; los demás salen en la lista, pero desactivados */
export function formatoValido(r: Reader, f: Formato): boolean {
  if (r.kind === 'timerS5') return f === 'S5TIME';
  if (r.kind === 'counterBcd') return f === 'BCD';
  switch (f) {
    case 'BOOL': return r.size === 0;
    case 'REAL': return r.size === 4;
    case 'S5TIME': return r.size === 2;
    case 'TIME': return r.size === 4;
    default: return r.size > 0;
  }
}

export const formatosValidos = (r: Reader) => FORMATOS.filter((f) => formatoValido(r, f));

/** Al escribir un operando: BOOL para los bits, HEX para bytes, palabras y dobles palabras */
export function formatoPorDefecto(r: Reader): Formato {
  if (r.kind === 'timerS5') return 'S5TIME';
  if (r.kind === 'counterBcd') return 'BCD';
  return r.size === 0 ? 'BOOL' : 'HEX';
}

/** Valor de estado como en la tabla original: true/false en los bits, L# en DEC de 32 bits y REAL con 6 cifras */
export function textoValor(raw: number, r: Reader, f: Formato): string {
  if (Number.isNaN(raw)) return '';
  if (r.size === 0) return raw & 1 ? 'true' : 'false';
  if (f === 'DEC' && r.size === 4) return `L#${s32(raw >>> 0)}`;
  if (f === 'REAL' && r.size === 4) return fmtReal(bitsF32(raw >>> 0), 6);
  return fmtValue(raw, r.size, f);
}

/** Valor de forzado escrito por el alumno en la sintaxis del formato de la fila (W#16#00FF, 12.5, true, L#5, 5S, C#10…) */
export function valorForzado(text: string, r: Reader, f: Formato): number {
  const t = text.trim();
  if (!t) throw new Error('Sin valor de forzado');
  return parseUserValue(t, r.size, f);
}
