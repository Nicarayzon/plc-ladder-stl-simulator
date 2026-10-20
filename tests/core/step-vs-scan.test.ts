import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { CPU } from '../../src/core/cpu';
import { applyStep, type Prueba } from '../../src/core/testrunner';
import { testWrite } from '../../src/core/testio';
import { SELFTESTS } from './selftests.data';

function snapshot(cpu: CPU) {
  return {
    M: Array.from(cpu.M.subarray(0, 256)), PAA: Array.from(cpu.PAA), out: Array.from(cpu.periphOut.subarray(0, 128)),
    T: cpu.timers.map((t) => [t.value, t.q, t.running, t.base]), Z: cpu.counters.map((c) => c.value),
    state: cpu.state, reason: cpu.stopReason, acc: [cpu.acc1, cpu.acc2], cycles: cpu.cycles,
    trace: cpu.trace.map(({ origin, ...r }) => r),
  };
}

function runWith(code: any, test: Prueba, stepping: boolean, lang: 'de' | 'en' = 'de') {
  const cpu = new CPU(code, { cycleMs: test.ciclo_ms ?? 10, lang });
  cpu.tracing = true;
  if (stepping) {
    cpu.scan = function () {
      if (this.state !== 'RUN') return;
      let guard = 0;
      for (;;) {
        const r = CPU.prototype.stepInstruction.call(this);
        if (r.kind === 'cycleEnd' || r.kind === 'stop' || r.kind === 'idle') break;
        if (++guard > 5_000_000) throw new Error('bucle');
      }
    };
  }
  for (const [k, v] of Object.entries(test.inicial ?? {})) testWrite(cpu, k, v);
  const snaps: unknown[] = [];
  for (const step of test.pasos) {
    applyStep(cpu, step);
    snaps.push(snapshot(cpu));
  }
  return snaps;
}

describe('paso a paso ≡ ciclo completo', () => {
  const items = (banco as any).ejercicios.filter((e: any) => e.awl && e.prueba);
  for (const e of items) {
    it(e.id, () => {
      expect(runWith(e.awl, e.prueba, true)).toEqual(runWith(e.awl, e.prueba, false));
    });
  }
  for (const [name, code, test, lang] of SELFTESTS) {
    if (name.includes('LOOP con contador 0')) continue; // 400 000 instrucciones con traza: lento y sin interés aquí
    it(name, () => {
      expect(runWith(code, test, true, lang)).toEqual(runWith(code, test, false, lang));
    });
  }
});

describe('llamadas: orden de la traza y reanudación', () => {
  it('la fila de UC va después de las del FC, con /ER de antes de la llamada', () => {
    const cpu = new CPU({ OB1: 'U E 0.0\nUC FC 1\n= A 4.0', FC1: 'SET\n= M 0.0' });
    cpu.tracing = true;
    cpu.scan();
    expect(cpu.trace.map((r) => `${r.bloque}:${r.instr}:${r.er_antes}`)).toEqual([
      'OB1:U E 0.0:0', 'FC1:SET:0', 'FC1:= M 0.0:0', 'OB1:UC FC 1:1', 'OB1:= A 4.0:0',
    ]);
    expect(cpu.PAA[4] & 1).toBe(1); // el RLO del FC llega al OB1
  });
  it('bloque vacío y llamadas anidadas', () => {
    const cpu = new CPU({ OB1: 'UC FC 1\nUC FC 2\nL 7\nT MW 0', FC1: '', FC2: 'UC FC 3', FC3: 'L 5\nT MW 2\nBEA\nL 9\nT MW 2' });
    cpu.scan();
    expect(cpu.state).toBe('RUN');
    expect(cpu.M[1]).toBe(7);
    expect(cpu.M[3]).toBe(5);
  });
  it('profundidad > 16 → STOP', () => {
    const cpu = new CPU({ OB1: 'UC FC 1', FC1: 'UC FC 1' });
    cpu.scan();
    expect(cpu.state).toBe('STOP');
    expect(cpu.stopReason).toContain('Desbordamiento de la pila de bloques');
  });
  it('CC con RLO = 0 no llama', () => {
    const cpu = new CPU({ OB1: 'CLR\nCC FC 1', FC1: 'SET\n= M 0.0' });
    cpu.scan();
    expect(cpu.M[0]).toBe(0);
  });
  it('OB100 solo en el primer ciclo', () => {
    const cpu = new CPU({ OB1: 'L MW 0\n+ 1\nT MW 0', OB100: 'L 100\nT MW 0' });
    cpu.scan();
    cpu.scan();
    expect((cpu.M[0] << 8) | cpu.M[1]).toBe(102);
  });
  it('puntos de parada: para antes de la instrucción y reanuda', () => {
    const cpu = new CPU({ OB1: 'L 1\nT MW 0\nUC FC 1\nL 3\nT MW 4', FC1: 'L 2\nT MW 2' });
    cpu.breakpoints.set('FC1', new Set([1]));
    expect(cpu.run({ maxCycles: 1, breakpoints: true })).toBe('break');
    expect(cpu.currentLoc()!.block).toBe('FC1');
    expect(cpu.currentLoc()!.pc).toBe(1);
    expect(cpu.acc1).toBe(2);
    expect(cpu.M[3]).toBe(0);
    expect(cpu.run({ maxCycles: 1, breakpoints: true })).toBe('done');
    expect(cpu.M[3]).toBe(2);
    expect(cpu.M[5]).toBe(3);
    expect(cpu.run({ maxCycles: 1, breakpoints: true })).toBe('break');
  });
});
