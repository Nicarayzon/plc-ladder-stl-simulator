// Marca de ciclo de la CPU (Hardware → Ciclo/marca de ciclo) y el programa de aviso + motor del usuario.
import { describe, expect, it } from 'vitest';
import { CPU, CLOCK_PERIODS_MS } from '../../src/core/cpu';
import { testRead, testWrite } from '../../src/core/testio';
import { applyStep } from '../../src/core/testrunner';

/** Muestrea un bit en cada ciclo y devuelve los instantes (ms) de sus flancos de subida. */
function rises(cpu: CPU, key: string, ms: number): number[] {
  const out: number[] = [];
  let prev = testRead(cpu, key);
  for (let t = 0; t < ms; t += cpu.cycleMs) {
    cpu.scan();
    const v = testRead(cpu, key);
    if (v && !prev) out.push(cpu.timeMs);
    prev = v;
  }
  return out;
}

describe('marca de ciclo', () => {
  it('cada bit oscila con su periodo (pulso/pausa 1:1)', () => {
    for (let bit = 0; bit < 8; bit++) {
      const cpu = new CPU('NOP 0');
      cpu.clockByte = 0;
      const r = rises(cpu, `M0.${bit}`, 8000);
      const gaps = r.slice(1).map((x, i) => x - r[i]);
      expect(new Set(gaps)).toEqual(new Set([CLOCK_PERIODS_MS[bit]]));
      // la mitad del tiempo a 1
      let unos = 0;
      for (let i = 0; i < 400; i++) { cpu.scan(); unos += testRead(cpu, `M0.${bit}`); }
      expect(Math.abs(unos - 200)).toBeLessThanOrEqual(Math.ceil(CLOCK_PERIODS_MS[bit] / 20));
    }
  });
  it('se puede poner en cualquier byte y desactivada no toca la memoria', () => {
    const cpu = new CPU('NOP 0');
    cpu.clockByte = 100;
    expect(rises(cpu, 'M100.5', 3000).length).toBeGreaterThan(1);
    const off = new CPU('NOP 0');
    expect(rises(off, 'M0.5', 3000)).toEqual([]);
  });
  it('el programa la lee como una marca más', () => {
    const cpu = new CPU('U M 0.5\n= A 124.0');
    cpu.clockByte = 0;
    expect(rises(cpu, 'A124.0', 4000)).toEqual([500, 1500, 2500, 3500]);
  });
});

const PROGRAMA_USUARIO = `      U     E     124.1
      L     S5T#5S
      SV    T     1

      UN    T     1
      U     E     124.1
      =     M     10.1

      U     T     1
      =     M     10.0

      UN    T     1
      U     E     124.1
      =     M     10.1

      U     M     10.1
      =     A     124.0

      U     M     10.0
      U     M     0.1
      =     A     124.7
`;

describe('programa del usuario: aviso intermitente 5 s y luego motor', () => {
  it('con E124.1 a 1: A124.7 parpadea (M0.1 = 0,2 s) durante 5 s y después se enciende A124.0', () => {
    const cpu = new CPU(PROGRAMA_USUARIO);
    cpu.clockByte = 0;
    testWrite(cpu, 'E124.1', 1);
    const parpadeo = rises(cpu, 'A124.7', 4900);
    expect(parpadeo.length).toBeGreaterThanOrEqual(23); // 0,2 s → unos 24 destellos en 4,9 s
    expect(testRead(cpu, 'A124.0')).toBe(0);
    applyStep(cpu, { tiempo_ms: 300 });
    expect(testRead(cpu, 'A124.0')).toBe(1); // motor
    expect(rises(cpu, 'A124.7', 2000)).toEqual([]); // ya no parpadea
    testWrite(cpu, 'E124.1', 0);
    applyStep(cpu, { ciclos: 2 });
    expect(testRead(cpu, 'A124.0')).toBe(0); // su programa para el motor al soltar E124.1
  });
});

const PROGRAMA_PROPUESTO = `// Marcha (E124.0) y paro (E124.7)
      U     E     124.0
      S     M     10.0
      U     E     124.7
      R     M     10.0
// Temporizador: 5 s desde la marcha
      U     M     10.0
      L     S5T#5S
      SE    T     1
// Aviso intermitente durante los 5 s (marca de ciclo M0.5 = 1 s)
      U     M     10.0
      UN    T     1
      U     M     0.5
      =     A     124.7
// Motor a los 5 s, hasta el paro
      U     T     1
      =     A     124.0
`;

describe('versión propuesta (pulsador de marcha E124.0 y paro E124.7)', () => {
  it('pulso en E124.0 → 5 s de aviso intermitente → motor hasta pulsar E124.7', () => {
    const cpu = new CPU(PROGRAMA_PROPUESTO);
    cpu.clockByte = 0;
    applyStep(cpu, { pulso: 'E124.0' });
    const aviso = rises(cpu, 'A124.7', 4800);
    expect(aviso.length).toBeGreaterThanOrEqual(4);
    expect(testRead(cpu, 'A124.0')).toBe(0);
    applyStep(cpu, { tiempo_ms: 400 });
    expect(testRead(cpu, 'A124.0')).toBe(1);
    expect(rises(cpu, 'A124.7', 2000)).toEqual([]);
    applyStep(cpu, { tiempo_ms: 30000 });
    expect(testRead(cpu, 'A124.0')).toBe(1); // sigue en marcha
    applyStep(cpu, { pulso: 'E124.7' });
    expect(testRead(cpu, 'A124.0')).toBe(0);
    expect(testRead(cpu, 'A124.7')).toBe(0);
  });

  it('al quitar la marca de ciclo (o cambiarla de byte) el byte antiguo vuelve a 0, no se queda congelado', () => {
    const cpu = new CPU('U M 0.5\n= A 124.0');
    cpu.setClockByte(0);
    let visto = 0;
    for (let i = 0; i < 300; i++) { cpu.scan(); visto |= cpu.M[0]; }
    expect(visto).toBe(0xFF); // todos los bits han oscilado
    // quitarla cuando hay bits a 1
    while (cpu.M[0] === 0) cpu.scan();
    cpu.setClockByte(null);
    expect(cpu.M[0]).toBe(0);
    for (let i = 0; i < 300; i++) { cpu.scan(); expect(cpu.M[0]).toBe(0); expect(testRead(cpu, 'A124.0')).toBe(0); }
    // cambiarla de MB0 a MB5: MB0 a 0 y MB5 empieza a oscilar
    cpu.setClockByte(0);
    while (cpu.M[0] === 0) cpu.scan();
    cpu.setClockByte(5);
    expect(cpu.M[0]).toBe(0);
    let visto5 = 0;
    for (let i = 0; i < 300; i++) { cpu.scan(); visto5 |= cpu.M[5]; expect(cpu.M[0]).toBe(0); }
    expect(visto5).toBe(0xFF);
  });
});
