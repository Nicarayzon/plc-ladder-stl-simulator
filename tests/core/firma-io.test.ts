// Firma del panel E/S (ioFirma.ts): decide cuándo se repinta el panel. Con la marca de ciclo activa,
// los bits que el programa no usa (y que no salen en su fila) no deben provocar repintados.
import { describe, expect, it } from 'vitest';
import { SimController } from '../../src/sim/SimController';
import { programFromAwl } from '../../src/core/program';
import { firmaIo, marcasDe } from '../../src/ui/workbench/ioFirma';

/** Cuántas veces cambia la firma en `ms` de simulación (un ciclo cada 10 ms). */
function cambios(sim: SimController, firma: () => string, ms: number): number {
  let n = 0;
  let prev = firma();
  for (let t = 0; t < ms; t += sim.cpu.cycleMs) {
    sim.cpu.scan();
    const f = firma();
    if (f !== prev) n++;
    prev = f;
  }
  return n;
}

describe('firma del panel E/S', () => {
  it('marca de ciclo: solo cambia con los bits que enseña la fila (M 0.5), no con M 0.0', () => {
    const sim = new SimController(programFromAwl('U M 0.5\n= A 124.0'));
    sim.cpu.setClockByte(0);
    const marcas = marcasDe(sim.usage);
    expect(marcas.masks).toEqual(new Map([[0, 0b0010_0000]]));
    // M 0.5 (1 s) cambia 2 veces por segundo: en 2 s, 4 cambios (y A 124.0 los sigue en el mismo ciclo)
    const n = cambios(sim, () => firmaIo(sim, [], ['A124.0'], marcas, [], [], 0).join(), 2000);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    // sin la máscara, el byte entero (M 0.0 cambia cada 50 ms) daría unas 40 firmas distintas
    const todo = cambios(sim, () => firmaIo(sim, [], ['A124.0'], marcas, [], [], null).join(), 2000);
    expect(todo).toBeGreaterThanOrEqual(35);
  });

  it('una marca normal (no de ciclo) firma su byte entero: su fila enseña los 8 bits', () => {
    const sim = new SimController(programFromAwl('U E 124.0\n= M 10.1\nU M 10.1\n= A 124.0'));
    const marcas = marcasDe(sim.usage);
    const f = () => firmaIo(sim, ['E124.0'], ['A124.0'], marcas, [], [], null).join();
    const a = f();
    sim.cpu.M[10] |= 0b1000_0000; // M 10.7: no la usa el programa, pero sale (atenuada) en la fila
    expect(f()).not.toBe(a);
  });

  it('las palabras de marcas (MW) entran en la firma aunque estén en el byte de la marca de ciclo', () => {
    const sim = new SimController(programFromAwl('L MB 0\nT MW 20'));
    sim.cpu.setClockByte(0);
    const marcas = marcasDe(sim.usage);
    const n = cambios(sim, () => firmaIo(sim, [], [], marcas, [], [], 0).join(), 1000);
    expect(n).toBeGreaterThanOrEqual(15); // MB 0 se enseña como palabra: cada cambio cuenta
  });
});
