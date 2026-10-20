// Ejecución de las pruebas del banco (run_test / run_trace_test / run_chrono_test de la referencia)
import { type CompiledProgram } from './compiler';
import { CPU, type TraceRow } from './cpu';
import { type Symbols } from './operands';
import { expectedMatches, splitKey, testRead, testWrite, type TestValue } from './testio';

export interface Paso {
  poner?: Record<string, TestValue>;
  pulso?: string;
  veces?: number;
  ciclos?: number;
  tiempo_ms?: number;
  esperar?: Record<string, TestValue>;
  esperar_estado?: 'RUN' | 'STOP';
  nota?: string;
}

export interface Prueba {
  ciclo_ms?: number;
  inicial?: Record<string, TestValue>;
  pasos: Paso[];
}

export interface TrazaSpec {
  inicial?: Record<string, TestValue>;
  filas: Record<string, number | string>[];
}

export interface CronoSpec {
  paso_ms: number;
  ciclo_ms?: number;
  entradas: Record<string, string>;
  salidas: Record<string, string>;
}

export type Program = string | Record<string, string> | CompiledProgram;

export interface StepFail {
  paso: number;
  key?: string;
  got?: number | string;
  expected?: TestValue;
  stop?: string | null;
  msg: string;
}

export interface StepRunOptions {
  symbols?: Symbols;
  lang?: 'de' | 'en';
  /** Se llama tras cada paso (para «Ver en el simulador» o para registrar). */
  onStep?: (i: number, cpu: CPU) => void;
}

/** Número de ciclos que ejecuta un paso (sin contar los del pulso). */
export function stepCycles(step: Paso, cycleMs: number): number {
  if (step.ciclos !== undefined) return Math.trunc(step.ciclos);
  if (step.tiempo_ms !== undefined) return Math.ceil(step.tiempo_ms / cycleMs);
  if (step.pulso !== undefined) return 0;
  return 1;
}

/** Aplica un paso (poner, pulso, ciclos) sobre una CPU ya creada. */
export function applyStep(cpu: CPU, step: Paso) {
  for (const [k, v] of Object.entries(step.poner ?? {})) testWrite(cpu, k, v);
  if (step.pulso !== undefined) {
    const n = Math.trunc(step.veces ?? 1);
    for (let j = 0; j < n; j++) {
      testWrite(cpu, step.pulso, 1);
      cpu.scan();
      testWrite(cpu, step.pulso, 0);
      cpu.scan();
    }
  }
  const n = stepCycles(step, cpu.cycleMs);
  for (let j = 0; j < n; j++) cpu.scan();
}

/** Ejecuta una prueba en formato `pasos`. Devuelve la lista de fallos (vacía = OK). */
export function runTestDetailed(code: Program, test: Prueba, opts: StepRunOptions = {}): { fails: StepFail[]; checks: number; cpu: CPU } {
  const cycleMs = test.ciclo_ms ?? 10;
  const cpu = new CPU(code as any, { cycleMs, symbols: opts.symbols, lang: opts.lang });
  for (const [k, v] of Object.entries(test.inicial ?? {})) testWrite(cpu, k, v);
  const fails: StepFail[] = [];
  let checks = 0;
  (test.pasos ?? []).forEach((step, idx) => {
    const i = idx + 1;
    applyStep(cpu, step);
    for (const [k, exp] of Object.entries(step.esperar ?? {})) {
      checks++;
      const [, tipo] = splitKey(k);
      const got = testRead(cpu, k);
      if (!expectedMatches(got, exp, tipo)) {
        fails.push({
          paso: i, key: k, got, expected: exp, stop: cpu.state === 'STOP' ? cpu.stopReason : null,
          msg: `paso ${i}: ${k} = ${pyRepr(got)}, se esperaba ${pyRepr(exp)}` + (cpu.state === 'STOP' ? `  [CPU en STOP: ${cpu.stopReason}]` : ''),
        });
      }
    }
    if (step.esperar_estado !== undefined) {
      checks++;
      if (cpu.state !== step.esperar_estado) {
        fails.push({
          paso: i, key: 'estado', got: cpu.state, expected: step.esperar_estado, stop: cpu.stopReason,
          msg: `paso ${i}: estado = ${cpu.state}, se esperaba ${step.esperar_estado}` + (cpu.stopReason ? ` (${cpu.stopReason})` : ''),
        });
      }
    }
    opts.onStep?.(i, cpu);
  });
  return { fails, checks, cpu };
}

export function runTest(code: Program, test: Prueba, opts: StepRunOptions = {}): string[] {
  return runTestDetailed(code, test, opts).fails.map((f) => f.msg);
}

function pyRepr(v: unknown): string {
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v);
}

const normInstr = (s: string) => s.split('//')[0].replace(/\s+/g, '').toUpperCase();
const lastColon = (s: string) => {
  const parts = s.split(':');
  return parts[parts.length - 1];
};

/** Traza del OB1 en un ciclo con el estado inicial dado. */
export function traceOneCycle(code: Program, inicial: Record<string, TestValue> | undefined, opts: StepRunOptions = {}): { rows: TraceRow[]; cpu: CPU } {
  const cpu = new CPU(code as any, { symbols: opts.symbols, lang: opts.lang });
  for (const [k, v] of Object.entries(inicial ?? {})) testWrite(cpu, k, v);
  cpu.tracing = true;
  cpu.scan();
  return { rows: cpu.trace.filter((r) => r.bloque === 'OB1'), cpu };
}

/** Comprueba una traza (modo «traza»): un ciclo con el estado inicial dado. */
export function runTraceTest(code: Program, spec: TrazaSpec): string[] {
  const { rows } = traceOneCycle(code, spec.inicial);
  const fails: string[] = [];
  const exp = spec.filas;
  if (rows.length !== exp.length) fails.push(`la traza tiene ${rows.length} filas y se esperaban ${exp.length}`);
  const n = Math.min(rows.length, exp.length);
  for (let i = 0; i < n; i++) {
    const got = rows[i] as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(exp[i])) {
      if (k === 'i') {
        if (lastColon(normInstr(String(got.instr))) !== lastColon(normInstr(String(v))))
          fails.push(`fila ${i + 1}: instrucción «${got.instr}», se esperaba «${v}»`);
        continue;
      }
      if (got[k] !== v) fails.push(`fila ${i + 1} (${got.instr}): ${k} = ${got[k]}, se esperaba ${v}`);
    }
  }
  return fails;
}

/** Cronograma: cada carácter es un intervalo de `paso_ms`; se muestrea a mitad del intervalo. */
export function runChronoTest(code: Program, spec: CronoSpec): { fails: string[]; got: Record<string, string> } {
  const cycleMs = spec.ciclo_ms ?? 10;
  const cpu = new CPU(code as any, { cycleMs });
  const paso = spec.paso_ms;
  const nHalf = Math.floor(Math.floor(paso / cycleMs) / 2);
  const entradas = spec.entradas;
  const length = Object.values(entradas)[0].length;
  const got: Record<string, string> = {};
  for (const k of Object.keys(spec.salidas)) got[k] = '';
  for (let i = 0; i < length; i++) {
    for (const [k, wave] of Object.entries(entradas)) testWrite(cpu, k, parseInt(wave[i], 10));
    for (let j = 0; j < nHalf; j++) cpu.scan();
    for (const k of Object.keys(spec.salidas)) got[k] += String(testRead(cpu, k));
    for (let j = 0; j < Math.floor(paso / cycleMs) - nHalf; j++) cpu.scan();
  }
  const fails: string[] = [];
  for (const [k, exp] of Object.entries(spec.salidas)) if (got[k] !== exp) fails.push(`${k}: obtenido ${got[k]}, se esperaba ${exp}`);
  return { fails, got };
}
