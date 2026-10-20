// Programa del alumno para probar los contadores (ZV, ZR, S Z con C#, R Z, U Z), escrito tal cual: `Z0` y `L C# 10`.
import { describe, expect, it } from 'vitest';
import { runTest } from '../../src/core/testrunner';

const PROGRAMA = `U E 124.0
ZV Z0

U E 124.7
ZR Z0

U E 124.4
L C# 10
S Z0

U E 124.3
R Z0

U Z0
= A 124.0
`;

describe('contador Z0 (programa del alumno)', () => {
  it('cuenta por flanco, se pone a 10, se borra y A124.0 = Z0 distinto de 0', () => {
    const fails = runTest(PROGRAMA, { pasos: [
      { ciclos: 3, esperar: { 'Z0:VALOR': 0, 'Z0': 0, 'A124.0': 0 } },
      // ZR con el contador a 0: no baja de 0
      { pulso: 'E124.7', esperar: { 'Z0:VALOR': 0, 'A124.0': 0 } },
      // ZV: +1 por cada flanco de subida
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 1, 'Z0': 1, 'A124.0': 1 } },
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 2 } },
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 3 } },
      // mantener E124.0 a 1 no sigue contando
      { poner: { 'E124.0': 1 }, ciclos: 50, esperar: { 'Z0:VALOR': 4 } },
      { poner: { 'E124.0': 0 }, ciclos: 2, esperar: { 'Z0:VALOR': 4 } },
      // ZR: −1 por flanco
      { pulso: 'E124.7', esperar: { 'Z0:VALOR': 3, 'A124.0': 1 } },
      // S Z0 con C#10: carga 10 en el flanco de E124.4, aunque se mantenga
      { poner: { 'E124.4': 1 }, ciclos: 20, esperar: { 'Z0:VALOR': 10, 'A124.0': 1 } },
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 11 } },
      { poner: { 'E124.4': 0 }, ciclos: 2, esperar: { 'Z0:VALOR': 11 } },
      // R Z0: a 0 y se apaga A124.0
      { pulso: 'E124.3', esperar: { 'Z0:VALOR': 0, 'Z0': 0, 'A124.0': 0 } },
      // con E124.3 mantenido, R gana a ZV (va después en el programa)
      { poner: { 'E124.3': 1 }, ciclos: 2 },
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 0, 'A124.0': 0 } },
      { poner: { 'E124.3': 0 }, ciclos: 2 },
      // bajar de 1 a 0 apaga la salida
      { pulso: 'E124.0', esperar: { 'Z0:VALOR': 1, 'A124.0': 1 } },
      { pulso: 'E124.7', esperar: { 'Z0:VALOR': 0, 'A124.0': 0 } },
    ] });
    expect(fails).toEqual([]);
  });
});
