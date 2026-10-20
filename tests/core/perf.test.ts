import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { CPU } from '../../src/core/cpu';
import { runTest } from '../../src/core/testrunner';

describe('rendimiento', () => {
  it('3000 ciclos (tiempo_ms 30000) en < 200 ms', () => {
    const p02 = (banco as any).ejercicios.find((e: any) => e.id === 'P02');
    const t0 = performance.now();
    runTest(p02.awl, { pasos: [{ poner: { 'E0.0': 1 }, ciclos: 1 }, { tiempo_ms: 30000 }] });
    expect(performance.now() - t0).toBeLessThan(200);
  });
  it('programa de 300 instrucciones a ≥ 5000 ciclos/s', () => {
    const lines: string[] = [];
    for (let i = 0; i < 30; i++) {
      lines.push(`U E ${i % 8}.${i % 8}`, `UN M ${i}.1`, 'O(', `U M ${i}.2`, `U M ${i}.3`, ')', `= A ${4 + (i % 4)}.${i % 8}`,
        `L MW ${100 + 2 * i}`, '+ 1', `T MW ${100 + 2 * i}`);
    }
    const cpu = new CPU(lines.join('\n'));
    cpu.observe = true;
    const n = 5000;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) cpu.scan();
    const dt = performance.now() - t0;
    expect(cpu.state).toBe('RUN');
    expect(n / (dt / 1000)).toBeGreaterThan(5000);
  });
  it('bucle LOOP de ~400 000 instrucciones en < 300 ms', () => {
    const t0 = performance.now();
    const cpu = new CPU('L L#0\nT MD 4\nL 0\nSIG: T MW 2\nL MD 4\nL L#1\n+D\nT MD 4\nL MW 2\nLOOP SIG');
    cpu.scan();
    expect(cpu.state).toBe('RUN');
    expect(performance.now() - t0).toBeLessThan(300);
  });
});
