import { describe, expect, it } from 'vitest';
import { CPU } from '../../src/core/cpu';
import { CompileError } from '../../src/core/errors';
import { runTest } from '../../src/core/testrunner';
import { COMPILE_ERRORS, SELFTESTS } from './selftests.data';

describe('SELFTESTS de la referencia', () => {
  for (const [name, code, test, lang] of SELFTESTS) {
    it(name, () => {
      expect(runTest(code, test, { lang: lang ?? 'de' })).toEqual([]);
    });
  }
});

describe('COMPILE_ERRORS de la referencia', () => {
  for (const [code, why] of COMPILE_ERRORS) {
    it(`error de compilación (${why})`, () => {
      expect(() => new CPU(code)).toThrow(CompileError);
    });
  }
  it('mensajes exactos', () => {
    const msg = (code: string) => { try { new CPU(code); return ''; } catch (e) { return (e as Error).message; } };
    expect(msg('U E 0.8')).toBe('Línea 1: E 0.8: el número de bit va de 0 a 7');
    expect(msg('U(\nU E 0.0')).toBe('Falta cerrar paréntesis: hay más "(" que ")"');
    expect(msg('SPA NOEX')).toBe('Línea 1: la meta NOEX no existe');
    expect(msg('L 500\nXYZ')).toBe('Línea 2: instrucción desconocida: XYZ');
    expect(msg('= MW 10')).toBe('Línea 1: operando no válido para =: MW 10');
    expect(msg('L PAW 256')).toBe('Línea 1: la periferia de salidas (PA) no se puede leer');
    expect(msg('ENT')).toBe('Línea 1: ENT solo existe en CPU con 4 acumuladores (el simulador tiene 2)');
  });
});
