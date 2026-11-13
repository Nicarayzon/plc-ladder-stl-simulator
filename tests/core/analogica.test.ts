// Indicador de 0 a 10 V de las salidas analógicas (PAW): regla de tres con 27712 = 10 V
import { describe, expect, it } from 'vitest';
import { PEW_MAX, VALOR_10V, V_MAX, emparejar, esPaw, fraccionEscala, fueraDeEscala, voltios } from '../../src/ui/workbench/analogica';
import { es } from '../../src/i18n/es';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

describe('analógicas en voltios', () => {
  it('27712 son 10 V y el deslizador sigue llegando a 32767', () => {
    expect([VALOR_10V, PEW_MAX, V_MAX]).toEqual([27712, 32767, 10]);
    expect(voltios(0)).toBe(0);
    expect(voltios(27712)).toBe(10);
    expect(voltios(13856)).toBe(5);
    expect(voltios(2771.2)).toBeCloseTo(1, 10);
    expect(voltios(32767)).toBeCloseTo(11.824, 3);
  });

  it('llevan indicador las salidas analógicas (PAW), no las palabras de salida digitales (AW)', () => {
    expect(['PAW 256', 'PAW 258', 'AW 124', 'PEW 256'].filter(esPaw)).toEqual(['PAW 256', 'PAW 258']);
  });

  it('cada PAW lleva debajo su PEW: primero la del mismo número, luego las que quedan, por orden', () => {
    // las dos del mismo módulo
    expect(emparejar(['PEW 256', 'PEW 258'], ['PAW 256', 'PAW 258'])).toEqual({
      pares: [{ paw: 'PAW 256', pew: 'PEW 256' }, { paw: 'PAW 258', pew: 'PEW 258' }], sueltas: [],
    });
    // otro número: por orden
    expect(emparejar(['PEW 256'], ['PAW 272'])).toEqual({ pares: [{ paw: 'PAW 272', pew: 'PEW 256' }], sueltas: [] });
    // una PEW sin PAW se queda suelta; una PAW sin PEW va sola
    expect(emparejar(['PEW 256', 'PEW 258'], ['PAW 256'])).toEqual({ pares: [{ paw: 'PAW 256', pew: 'PEW 256' }], sueltas: ['PEW 258'] });
    expect(emparejar([], ['PAW 256'])).toEqual({ pares: [{ paw: 'PAW 256', pew: null }], sueltas: [] });
    expect(emparejar(['PEW 256'], [])).toEqual({ pares: [], sueltas: ['PEW 256'] });
    // mismo número antes que el orden, y por número, no por texto
    expect(emparejar(['PEW 256', 'PEW 1000'], ['PAW 1000', 'PAW 300']).pares).toEqual([
      { paw: 'PAW 300', pew: 'PEW 256' }, { paw: 'PAW 1000', pew: 'PEW 1000' },
    ]);
  });

  it('la aguja se queda en los extremos fuera de la escala', () => {
    expect(fraccionEscala(voltios(0))).toBe(0);
    expect(fraccionEscala(voltios(13856))).toBe(0.5);
    expect(fraccionEscala(voltios(27712))).toBe(1);
    expect(fraccionEscala(voltios(32767))).toBe(1);
    expect(fraccionEscala(voltios(-100))).toBe(0);
    expect([0, 13856, 27712].map((x) => fueraDeEscala(voltios(x)))).toEqual([false, false, false]);
    expect([27713, 32767, -1].map((x) => fueraDeEscala(voltios(x)))).toEqual([true, true, true]);
  });

  it('la lectura lleva la coma o el punto de cada idioma', () => {
    expect(es.io.voltios(voltios(13856))).toBe('5,00 V');
    expect(de.io.voltios(voltios(32767))).toBe('11,82 V');
    expect(en.io.voltios(voltios(27712))).toBe('10.00 V');
  });
});
