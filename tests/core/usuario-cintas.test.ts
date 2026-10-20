// Programa real de un alumno (línea de cajas con tres cintas), comprobado antes en un PLC simulado.
import { describe, expect, it } from 'vitest';
import { runTest } from '../../src/core/testrunner';

const ORIGINAL = `U E 125.6
S M 10.0

U E 125.7
R M 10.0

U M 10.0
= A 125.7

U M 10.0
U E 124.0
S M 20.0

U M 10.0
U E 124.1
S M 20.1

U M 10.0
U E 124.2
S M 20.2

U E 124.3
ON M 10.0
R M 20.0
R M 20.1
R M 20.2


U M 20.0
= A 124.0

U M 20.1
= A 124.1

U M 20.2
= A 124.2
`;

const REORDENADO = `U E 125.6
S M 10.0

U M 10.0
= A 125.7

U E 125.7
R M 10.0


U M 10.0
U E 124.0
S M 20.0

U M 20.0
= A 124.0

U M 10.0
U E 124.1
S M 20.1

U M 20.1
= A 124.1


U M 10.0
U E 124.2
S M 20.2

U M 20.2
= A 124.2

U E 124.3
ON M 10.0
R M 20.0
R M 20.1
R M 20.2
`;

describe('línea de cajas (programa del alumno)', () => {
  for (const [nombre, code] of [['original', ORIGINAL], ['reordenado', REORDENADO]] as const) it(`versión ${nombre}: se comporta como la CPU real`, () => {
    const fails = runTest(code, { pasos: [
      { esperar: { 'A125.7': 0, 'A124.0': 0 } },
      // sin máquina encendida, una caja no hace nada
      { pulso: 'E124.0', esperar: { 'A124.0': 0, 'M20.0': 0 } },
      // encender la máquina
      { pulso: 'E125.6', esperar: { 'M10.0': 1, 'A125.7': 1 } },
      // cajas por las tres cintas
      { pulso: 'E124.0', esperar: { 'A124.0': 1, 'A124.1': 0 } },
      { pulso: 'E124.1', esperar: { 'A124.0': 1, 'A124.1': 1, 'A124.2': 0 } },
      { pulso: 'E124.2', esperar: { 'A124.2': 1 } },
      // E124.3 borra las cintas, la máquina sigue encendida
      { pulso: 'E124.3', esperar: { 'A124.0': 0, 'A124.1': 0, 'A124.2': 0, 'A125.7': 1 } },
      { pulso: 'E124.1', esperar: { 'A124.1': 1 } },
      // parar la máquina: se apaga A125.7 y se borran las cintas (ON M 10.0)
      { pulso: 'E125.7', esperar: { 'A125.7': 0, 'A124.1': 0 } },
    ] });
    expect(fails).toEqual([]);
  });
});
