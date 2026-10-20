// Bucle del simulador y avisos a la interfaz: el bucle se despierta a ritmo fijo (LOOP_HZ), los
// ciclos normales no son «cambios de estructura» (los paneles que no enseñan valores en vivo no se
// repintan) y la ventana de señales puede hacer avanzar la simulación si la principal está oculta.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOOP_HZ, SimController } from '../../src/sim/SimController';
import { programFromAwl } from '../../src/core/program';

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }); });
afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { document?: unknown }).document;
});

const nuevoSim = (awl: string) => {
  const sim = new SimController(programFromAwl(awl));
  sim.setRun(true);
  return sim;
};

describe('bucle del simulador', () => {
  it(`se despierta unas ${LOOP_HZ} veces por segundo, no a la frecuencia de la pantalla`, () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    sim.cpu.cycleMs = 1; // un ciclo cada 1 ms: todos los despertares tienen ciclos nuevos
    const avisos = vi.fn();
    sim.subscribe(avisos);
    vi.advanceTimersByTime(1000);
    expect(avisos.mock.calls.length).toBeGreaterThanOrEqual(LOOP_HZ - 2);
    expect(avisos.mock.calls.length).toBeLessThanOrEqual(LOOP_HZ + 1);
    // el tiempo del PLC sigue al reloj: 1 s = 1000 ciclos de 1 ms
    expect(sim.cpu.cycles).toBeGreaterThanOrEqual(985);
    expect(sim.cpu.cycles).toBeLessThanOrEqual(1001);
  });

  it('×100 con ciclos de 10 ms: 10 000 ciclos por segundo', () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    sim.setSpeed(100);
    vi.advanceTimersByTime(1000);
    expect(sim.cpu.cycles).toBeGreaterThanOrEqual(9800);
    expect(sim.cpu.cycles).toBeLessThanOrEqual(10000);
    expect(sim.limited).toBe(false);
  });

  it('ciclos normales: sube version pero no rev', () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    vi.advanceTimersByTime(20);
    const rev = sim.rev;
    const ver = sim.version;
    vi.advanceTimersByTime(100);
    expect(sim.cpu.cycles).toBeGreaterThanOrEqual(9);
    expect(sim.version).toBeGreaterThan(ver);
    expect(sim.rev).toBe(rev);
  });

  it('un despertar sin ciclos nuevos no avisa a nadie', () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    sim.cpu.cycleMs = 1000;
    const avisos = vi.fn();
    sim.subscribe(avisos);
    vi.advanceTimersByTime(500);
    expect(sim.cpu.cycles).toBe(0);
    expect(avisos).not.toHaveBeenCalled();
  });

  it('entradas, STOP y programa nuevo suben rev', async () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    let rev = sim.rev;
    sim.setInputBit('E124.0', 1);
    await Promise.resolve();
    expect(sim.rev).toBeGreaterThan(rev);
    rev = sim.rev;
    vi.advanceTimersByTime(30);
    expect(sim.cpu.periphOut[124] & 1).toBe(1);
    expect(sim.rev).toBe(rev);
    sim.setProgram(programFromAwl('U E 124.0\n= A 124.1'));
    expect(sim.rev).toBeGreaterThan(rev);
    rev = sim.rev;
    sim.setRun(false);
    expect(sim.rev).toBeGreaterThan(rev);
    // en STOP el bucle no sigue despertándose
    const ver = sim.version;
    vi.advanceTimersByTime(500);
    expect(sim.version).toBe(ver);
  });

  it('un error de ejecución dentro del lote de ciclos sube rev (STOP)', async () => {
    const sim = nuevoSim('U E 124.0\nSPBN M1\nL P#20.1\nT MD 100\nL 55\nT MW [MD 100]\nM1: NOP 0');
    vi.advanceTimersByTime(30);
    expect(sim.cpu.state).toBe('RUN');
    sim.setInputBit('E124.0', 1);
    await Promise.resolve();
    const rev = sim.rev;
    vi.advanceTimersByTime(30);
    expect(sim.cpu.state).toBe('STOP');
    expect(sim.lastStop).not.toBeNull();
    expect(sim.rev).toBeGreaterThan(rev);
  });

  it('ventana principal oculta: el tiempo se para; pump() (ventana de señales) lo hace avanzar', () => {
    const sim = nuevoSim('U E 124.0\n= A 124.0');
    vi.advanceTimersByTime(100);
    const c0 = sim.cpu.cycles;
    (globalThis as { document?: unknown }).document = { hidden: true };
    vi.advanceTimersByTime(1000);
    expect(sim.cpu.cycles).toBe(c0);
    // la ventana de señales llama a pump() con sus propios temporizadores
    for (let i = 0; i < 90; i++) { vi.advanceTimersByTime(1000 / LOOP_HZ); sim.pump(); }
    // el primer pump recupera como mucho 250 ms; después, al ritmo de la ventana de señales
    expect(sim.cpu.cycles - c0).toBeGreaterThanOrEqual(25 + 95);
    const c1 = sim.cpu.cycles;
    sim.pump(); // recién avanzado: no hace nada
    expect(sim.cpu.cycles).toBe(c1);
    // con la principal visible, pump() no hace nada: ya va al día
    delete (globalThis as { document?: unknown }).document;
    vi.advanceTimersByTime(300);
    const c2 = sim.cpu.cycles;
    sim.pump();
    expect(sim.cpu.cycles).toBe(c2);
    // en pausa tampoco
    sim.pause();
    vi.advanceTimersByTime(400);
    sim.pump();
    expect(sim.cpu.cycles).toBe(c2);
  });
});
