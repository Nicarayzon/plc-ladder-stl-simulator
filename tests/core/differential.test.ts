// Pruebas diferenciales: el núcleo TS y el intérprete de referencia (tools/interprete_referencia.py) deben dar exactamente lo mismo.
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { CPU } from '../../src/core/cpu';
import { CompileError } from '../../src/core/errors';
import { testWrite } from '../../src/core/testio';
import { genCase, type GenCase } from './gen/programGen';

const N = Number(process.env.DIFF_N ?? (process.env.DIFF ? 2500 : 300));
const SEED0 = Number(process.env.DIFF_SEED ?? 1);
const runner = path.resolve(__dirname, '../../tools/ref_runner.py');
const hasPython = spawnSync('python3', ['--version']).status === 0;

const TRACE_KEYS = ['bloque', 'pc', 'linea', 'instr', 'er_antes', 'er', 'rlo', 'sta', 'or', 'ov', 'os', 'cc1', 'cc0', 'br', 'acu1', 'acu2', 'acu1_int', 'acu2_int'] as const;

function snapshot(cpu: CPU, withTrace: boolean) {
  const snap: Record<string, unknown> = {
    M: Array.from(cpu.M.subarray(0, 128)),
    PAA: Array.from(cpu.PAA.subarray(0, 16)),
    out: Array.from(cpu.periphOut.subarray(0, 16)),
    DB1: cpu.dbs.has(1) ? Array.from(cpu.dbs.get(1)!.subarray(0, 32)) : null,
    DB2: cpu.dbs.has(2) ? Array.from(cpu.dbs.get(2)!.subarray(0, 32)) : null,
    T: cpu.timers.slice(0, 4).map((t) => [t.value, t.q ? 1 : 0, t.running ? 1 : 0, t.base, t.prevS ? 1 : 0]),
    Z: cpu.counters.slice(0, 4).map((c) => [c.value, c.prevCu ? 1 : 0, c.prevCd ? 1 : 0]),
    acc: [cpu.acc1, cpu.acc2, cpu.ar1, cpu.ar2],
    stw: cpu.stw(),
    db: [cpu.openDb, cpu.openDi],
    state: cpu.state,
    reason: cpu.stopReason,
    cycles: cpu.cycles,
  };
  if (withTrace) snap.trace = cpu.trace.slice(0, 2000).map((r) => Object.fromEntries(TRACE_KEYS.map((k) => [k, (r as any)[k]])));
  return snap;
}

function runTs(c: GenCase) {
  let cpu: CPU;
  try {
    cpu = new CPU(c.blocks);
  } catch (e) {
    if (e instanceof CompileError) return { error: e.message };
    throw e;
  }
  const steps: unknown[] = [];
  c.steps.forEach((st, idx) => {
    const i = idx + 1;
    for (const [k, v] of Object.entries(st.poner ?? {})) testWrite(cpu, k, v);
    cpu.tracing = c.trace.includes(i);
    for (let j = 0; j < (st.ciclos ?? 1); j++) cpu.scan();
    steps.push(snapshot(cpu, c.trace.includes(i)));
    cpu.tracing = false;
  });
  return { steps };
}

function firstDiff(a: any, b: any, p = ''): string | null {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return `${p}: ts=${JSON.stringify(a)?.slice(0, 200)} py=${JSON.stringify(b)?.slice(0, 200)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], `${p}.${k}`);
    if (d) return d;
  }
  return null;
}

describe.skipIf(!hasPython)(`diferencial frente al intérprete de referencia (${N} programas)`, () => {
  it('mismo estado, memoria, T/Z, acumuladores y traza', () => {
    const BATCH = 250;
    let compileErrors = 0;
    let stops = 0;
    for (let start = 0; start < N; start += BATCH) {
      const cases: GenCase[] = [];
      for (let s = start; s < Math.min(N, start + BATCH); s++) cases.push(genCase(SEED0 + s));
      const res = spawnSync('python3', [runner], { input: JSON.stringify(cases), maxBuffer: 1 << 30, encoding: 'utf-8', env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
      if (res.status !== 0) throw new Error(res.stderr);
      const py = JSON.parse(res.stdout) as any[];
      cases.forEach((c, i) => {
        const ts = runTs(c);
        if ('error' in ts) compileErrors++;
        else if ((ts.steps[ts.steps.length - 1] as any).state === 'STOP') stops++;
        const d = firstDiff(ts, py[i]);
        if (d) {
          throw new Error(`Semilla ${SEED0 + start + i}: diferencia en ${d}\n--- programa ---\n${JSON.stringify(c.blocks, null, 1)}`);
        }
      });
    }
    console.log(`diferencial: ${N} programas, ${compileErrors} con error de compilación, ${stops} acaban en STOP`);
    expect(compileErrors).toBeLessThan(N * 0.2);
  });
});
