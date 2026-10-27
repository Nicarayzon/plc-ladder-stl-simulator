// Corrección de ejercicios: pruebas del banco con fallos explicados en lenguaje natural
import type { CompiledProgram } from '../core/compiler';
import { runChronoTest, runTestDetailed, runTraceTest, stepCycles, type Paso, type StepFail } from '../core/testrunner';
import type { Ejercicio } from './banco';
import { fmtDuration } from '../core/format';
import { T } from '../i18n';

export interface Grade {
  checks: number;
  ok: number;
  fails: string[];
  nota: number;
  stop: string | null;
  failStep: number | null;
}

const fmtV = (v: unknown) => (typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3).replace(/\.?0+$/, '') : String(v));

/** `ver`: cómo se escribe cada operando de las pruebas (que están con la nemotecnia alemana): con la inglesa, E0.0 → I0.0 */
export type VerOperando = (k: string) => string;
const igual: VerOperando = (k) => k;

export function describeStep(p: Paso, cycleMs = 10, ver: VerOperando = igual): string {
  const parts: string[] = [];
  const poner = Object.entries(p.poner ?? {});
  if (poner.length) parts.push(T.correccion.poner(poner.map(([k, v]) => `${ver(k)} = ${fmtV(v)}`).join(', ')));
  if (p.pulso) parts.push(T.correccion.pulsos(p.veces, ver(p.pulso)));
  const n = stepCycles(p, cycleMs);
  if (p.tiempo_ms !== undefined) parts.push(T.correccion.esperar(fmtDuration(p.tiempo_ms).toLowerCase().replace(/_/g, ' ')));
  else if (n > 0) parts.push(T.correccion.ejecutar(n));
  return parts.join(T.correccion.y) || T.correccion.unCiclo;
}

export function naturalFail(f: StepFail, pasos: Paso[], cycleMs = 10, ver: VerOperando = igual): string {
  const p = pasos[f.paso - 1];
  const head = T.correccion.pasoTras(f.paso, describeStep(p, cycleMs, ver));
  if (f.key === 'estado') return T.correccion.estado(head, String(f.expected), String(f.got), f.stop ?? '');
  return T.correccion.valorFallo(head, ver(String(f.key)), fmtV(f.expected), fmtV(f.got), f.stop ?? '');
}

/** Ejecuta todas las comprobaciones del ejercicio sobre un programa. */
export function gradeProgram(cp: CompiledProgram, e: Ejercicio, ver: VerOperando = igual): Grade {
  let checks = 0;
  let ok = 0;
  const fails: string[] = [];
  let stop: string | null = null;
  let failStep: number | null = null;
  if (e.prueba) {
    const r = runTestDetailed(cp, e.prueba);
    checks += r.checks;
    ok += r.checks - r.fails.length;
    for (const f of r.fails) fails.push(naturalFail(f, e.prueba.pasos, e.prueba.ciclo_ms, ver));
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
