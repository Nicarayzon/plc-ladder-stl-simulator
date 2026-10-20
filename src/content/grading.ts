// Corrección de ejercicios: pruebas del banco con fallos explicados en lenguaje natural
import type { CompiledProgram } from '../core/compiler';
import { runChronoTest, runTestDetailed, runTraceTest, stepCycles, type Paso, type StepFail } from '../core/testrunner';
import type { Ejercicio } from './banco';
import { fmtDuration } from '../core/format';

export interface Grade {
  checks: number;
  ok: number;
  fails: string[];
  nota: number;
  stop: string | null;
  failStep: number | null;
}

const fmtV = (v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3).replace(/\.?0+$/, '') : String(v));

export function describeStep(p: Paso, cycleMs = 10): string {
  const parts: string[] = [];
  const poner = Object.entries(p.poner ?? {});
  if (poner.length) parts.push(`poner ${poner.map(([k, v]) => `${k} = ${fmtV(v)}`).join(', ')}`);
  if (p.pulso) parts.push(`dar ${p.veces && p.veces > 1 ? `${p.veces} pulsos` : 'un pulso'} en ${p.pulso}`);
  const n = stepCycles(p, cycleMs);
  if (p.tiempo_ms !== undefined) parts.push(`esperar ${fmtDuration(p.tiempo_ms).toLowerCase().replace(/_/g, ' ')}`);
  else if (n > 0) parts.push(`ejecutar ${n} ciclo${n > 1 ? 's' : ''}`);
  return parts.join(' y ') || 'ejecutar 1 ciclo';
}

export function naturalFail(f: StepFail, pasos: Paso[], cycleMs = 10): string {
  const p = pasos[f.paso - 1];
  const head = `Paso ${f.paso}: tras ${describeStep(p, cycleMs)}`;
  if (f.key === 'estado') return `${head}, la CPU debería estar en ${f.expected} y está en ${f.got}${f.stop ? ` (${f.stop})` : ''}.`;
  return `${head}, ${f.key} debería valer ${fmtV(f.expected)} y vale ${fmtV(f.got)}${f.stop ? ` — la CPU está en STOP: ${f.stop}` : ''}.`;
}

/** Ejecuta todas las comprobaciones del ejercicio sobre un programa. */
export function gradeProgram(cp: CompiledProgram, e: Ejercicio): Grade {
  let checks = 0;
  let ok = 0;
  const fails: string[] = [];
  let stop: string | null = null;
  let failStep: number | null = null;
  if (e.prueba) {
    const r = runTestDetailed(cp, e.prueba);
    checks += r.checks;
    ok += r.checks - r.fails.length;
    for (const f of r.fails) fails.push(naturalFail(f, e.prueba.pasos, e.prueba.ciclo_ms));
    if (r.fails.length) failStep = r.fails[0].paso;
    stop = r.cpu.state === 'STOP' ? r.cpu.stopReason : null;
  }
  if (e.cronograma) {
    const r = runChronoTest(cp, e.cronograma);
    for (const [k, exp] of Object.entries(e.cronograma.salidas)) {
      for (let i = 0; i < exp.length; i++) {
        checks++;
        if (r.got[k][i] === exp[i]) ok++;
      }
      if (r.got[k] !== exp) fails.push(`${k}: obtenido ${r.got[k]}, esperado ${exp}`);
    }
  }
  if (e.traza) {
    const f = runTraceTest(cp, e.traza);
    checks += 1;
    if (!f.length) ok += 1;
    else fails.push(...f);
  }
  return { checks, ok, fails, nota: checks ? ok / checks : 0, stop, failStep };
}
