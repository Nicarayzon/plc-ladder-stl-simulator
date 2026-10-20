// Tabla de variables (VAT): operandos del programa para sugerirlos y para empezar una VAT nueva
import { MEM_PREFIX } from '../../core/operands';
import { analyzeUsage, type Usage } from '../../core/usage';
import { compileProgram, type Programa } from '../../core/program';
import type { VatFila } from './types';

const AREAS = ['E', 'A', 'M', 'PE', 'PA', 'T', 'Z'];
const PREFIJO = new Map(Object.entries(MEM_PREFIX).map(([p, [area, size]]) => [`${area}${size}`, p]));

/** «E 124.0», «MW 10», «T 1», «Z 0»… que lee o escribe el programa (sin L, DB ni indirectos), ordenados por área y dirección */
export function operandosDe(u: Usage): string[] {
  const out = new Map<string, number[]>();
  for (const a of u.accesses) {
    if (a.indirect || a.byte < 0 || !AREAS.includes(a.area)) continue;
    let t: string | undefined;
    if (a.kind === 'timer') t = `T ${a.byte}`;
    else if (a.kind === 'counter') t = `Z ${a.byte}`;
    else if (a.kind === 'bit') t = `${a.area} ${a.byte}.${a.bit}`;
    else {
      const p = PREFIJO.get(`${a.area}${a.size}`);
      if (p) t = `${p} ${a.byte}`;
    }
    if (t) out.set(t, [AREAS.indexOf(a.area), a.byte * 8 + a.bit, a.size]);
  }
  return [...out.entries()].sort(([, x], [, y]) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]).map(([t]) => t);
}

/** Una VAT nueva empieza con los temporizadores y contadores del programa (lo que enseñaba la pestaña «T / Z») */
export function filasTZ(p: Programa): VatFila[] {
  const cp = compileProgram(p).cp;
  if (!cp) return [];
  const u = analyzeUsage(cp);
  return [
    ...[...u.timers.keys()].sort((a, b) => a - b).map((n): VatFila => ({ text: `T ${n}`, fmt: 'S5TIME' })),
    ...[...u.counters].sort((a, b) => a - b).map((n): VatFila => ({ text: `Z ${n}`, fmt: 'BCD' })),
  ];
}
