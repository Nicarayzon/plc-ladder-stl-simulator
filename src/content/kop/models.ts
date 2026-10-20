// Modelos KOP de las soluciones de los ejercicios. Cada modelo, compilado, pasa las pruebas de su ejercicio
// (tests/kop/models.test.ts).
import {
  bob, box, call, cmp, coilT, cont, jmp, na, nc, n, not, p, par, r, rama, s, seg, segs, temp, biest, sz,
} from '../../kop/build';
import type { SegmentoKOP } from '../../kop/model';

const M: Record<string, () => SegmentoKOP[]> = {
  E01: () => [
    seg({ titulo: 'Contacto NA', entrada: [na('E 0.0')], salidas: [bob('A 4.0')] }),
    seg({ titulo: 'Contacto NC', entrada: [nc('E 0.0')], salidas: [bob('A 4.1')] }),
  ],
  E02: () => [
    seg({ titulo: 'Y', entrada: [na('E 0.0'), na('E 0.1')], salidas: [bob('A 4.0')] }),
    seg({ titulo: 'O', entrada: [par(na('E 0.0'), na('E 0.1'))], salidas: [bob('A 4.1')] }),
  ],
  E03: () => [
    seg({ titulo: 'NAND', entrada: [na('E 0.0'), na('E 0.1'), not()], salidas: [bob('A 4.0')] }),
    seg({ titulo: 'NOR', entrada: [par(na('E 0.0'), na('E 0.1')), not()], salidas: [bob('A 4.1')] }),
    seg({ titulo: 'O-exclusiva', entrada: [par([na('E 0.0'), nc('E 0.1')], [nc('E 0.0'), na('E 0.1')])], salidas: [bob('A 4.2')] }),
  ],
  E04: () => [seg({ entrada: [par([na('E 0.0'), na('E 0.1')], [na('E 0.2'), na('E 0.3')])], salidas: [bob('A 4.0')] })],
  E05: () => [seg({ entrada: [na('E 0.0'), par(na('E 0.1'), na('E 0.2'))], salidas: [bob('A 4.1')] })],
  E06: () => [seg({ titulo: 'Marcha y paro', entrada: [par(na('E 0.0'), na('A 4.0')), na('E 0.1')], salidas: [bob('A 4.0')] })],
  E07: () => [
    seg({ titulo: 'Marcha', entrada: [na('E 0.0')], salidas: [s('A 4.0')] }),
    seg({ titulo: 'Paro (al final: prioridad al paro)', entrada: [nc('E 0.1')], salidas: [r('A 4.0')] }),
  ],
  E08: () => [
    seg({ titulo: 'Paro', entrada: [nc('E 0.1')], salidas: [r('A 4.0')] }),
    seg({ titulo: 'Marcha (al final: prioridad a la marcha)', entrada: [na('E 0.0')], salidas: [s('A 4.0')] }),
  ],
  E09: () => [
    seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0')] }),
    seg({ comentario: 'Error típico: sobrescribe la asignación anterior', entrada: [na('E 0.1')], salidas: [bob('A 4.0')] }),
  ],
  E09b: () => [seg({ entrada: [par(na('E 0.0'), na('E 0.1'))], salidas: [bob('A 4.0')] })],
  E10: () => [
    seg({ titulo: 'Flanco positivo', entrada: [na('E 0.0'), p('M 10.0')], salidas: [bob('M 10.1')] }),
    seg({ titulo: 'Flanco negativo', entrada: [na('E 0.0'), n('M 10.2')], salidas: [bob('M 10.3')] }),
  ],
  E11: () => [
    seg({ titulo: 'Impulso', entrada: [na('E 0.0'), p('M 10.0')], salidas: [bob('M 10.1')] }),
    seg({ titulo: 'Telerruptor', entrada: [par([na('M 10.1'), nc('A 4.0')], [nc('M 10.1'), na('A 4.0')])], salidas: [bob('A 4.0')] }),
  ],
  E12: () => [seg({ titulo: 'Retardo a la conexión', entrada: [na('E 0.0')], salidas: [temp('S_EVERZ', 'T 1', 'S5T#5S', { pinR: na('E 0.1'), dual: 'MW 10', dez: 'MW 12', q: [bob('A 4.0')] })] })],
  E13: () => [seg({ titulo: 'Retardo a la desconexión', entrada: [na('E 0.2')], salidas: [temp('S_AVERZ', 'T 2', 'S5T#3S', { q: [bob('A 4.1')] })] })],
  E14: () => [seg({ titulo: 'Impulso', entrada: [na('E 0.3')], salidas: [temp('S_IMPULS', 'T 3', 'S5T#2S', { q: [bob('A 4.2')] })] })],
  E15: () => [seg({ titulo: 'Impulso prolongado', entrada: [na('E 0.4')], salidas: [temp('S_VIMP', 'T 4', 'S5T#2S', { q: [bob('A 4.3')] })] })],
  E16: () => [seg({ titulo: 'Retardo con memoria', entrada: [na('E 0.5')], salidas: [temp('S_SEVERZ', 'T 5', 'S5T#3S', { pinR: na('E 0.6'), q: [bob('A 4.4')] })] })],
  E17: () => [
    seg({ titulo: 'Tiempo apagado', entrada: [na('E 0.7'), nc('T 7')], salidas: [temp('S_EVERZ', 'T 6', 'S5T#1S')] }),
    seg({ titulo: 'Tiempo encendido', entrada: [na('T 6')], salidas: [temp('S_EVERZ', 'T 7', 'S5T#1S')] }),
    seg({ titulo: 'Salida intermitente', entrada: [na('T 6')], salidas: [bob('A 4.5')] }),
  ],
  E18: () => [
    seg({ titulo: 'Contador de plazas', entrada: [na('E 1.0')], salidas: [cont('ZAEHLER', 'Z 1', { pinZR: na('E 1.1'), pinS: na('E 1.2'), zw: 'C#5', pinR: na('E 1.3'), dual: 'MW 30', q: [bob('A 5.1')] })] }),
    seg({ titulo: 'Completo', entrada: [cmp('>=I', 'MW 30', '10')], salidas: [bob('A 5.0')] }),
  ],
  E19: () => [
    seg({ titulo: 'Cargar 3 (antes de contar, como en el AWL)', entrada: [na('E 1.4')], salidas: [sz('Z 2', 'C#3')] }),
    seg({ titulo: 'Cuenta atrás', entrada: [na('E 1.5')], salidas: [cont('Z_RUECK', 'Z 2', { dez: 'MW 32', q: [rama(bob('A 5.2'), [not()])] })] }),
  ],
  E20: () => [
    seg({ titulo: 'Nivel alto', entrada: [cmp('>I', 'MW 30', '500')], salidas: [bob('A 5.4')] }),
    seg({ titulo: 'Nivel bajo', entrada: [cmp('<I', 'MW 30', '100')], salidas: [bob('A 5.5')] }),
    seg({ titulo: 'Alarma con habilitación', entrada: [na('E 2.0'), cmp('>I', 'MW 30', '500')], salidas: [bob('A 5.6')] }),
  ],
  E21: () => [
    seg({ titulo: 'Suma', salidas: [box('ADD_I', { IN1: 'MW 40', IN2: 'MW 42', OUT: 'MW 44' })] }),
    seg({ titulo: 'Desbordamiento', entrada: [na('OV')], salidas: [bob('M 1.0')] }),
    seg({ titulo: 'Desbordamiento memorizado', entrada: [na('OS')], salidas: [s('M 1.1')] }),
    seg({ titulo: 'Acuse', entrada: [na('E 0.0')], salidas: [r('M 1.1')] }),
  ],
  E22: () => [
    seg({ titulo: 'Operandos a DINT', salidas: [box('I_DI', { IN: 'MW 50', OUT: 'MD 200' }), box('I_DI', { IN: 'MW 52', OUT: 'MD 204' })] }),
    seg({ titulo: 'Producto completo', salidas: [box('MUL_DI', { IN1: 'MD 200', IN2: 'MD 204', OUT: 'MD 54' })] }),
    seg({ titulo: 'Cociente', salidas: [box('DIV_I', { IN1: 'MW 50', IN2: 'MW 52', OUT: 'MW 58' })] }),
    seg({ titulo: 'Resto', salidas: [box('MOD_DI', { IN1: 'MD 200', IN2: 'MD 204', OUT: 'MD 208' }, [box('MOVE', { IN: 'MW 210', OUT: 'MW 60' })])] }),
  ],
  E23: () => [
    seg({ titulo: 'INT → DINT', salidas: [box('I_DI', { IN: 'PEW 256', OUT: 'MD 104' })] }),
    seg({ titulo: 'DINT → REAL', salidas: [box('DI_R', { IN: 'MD 104', OUT: 'MD 108' })] }),
    seg({ titulo: 'Normalizar', salidas: [box('DIV_R', { IN1: 'MD 108', IN2: '2.764800e+004', OUT: 'MD 112' })] }),
    seg({ titulo: 'Escalar a %', salidas: [box('MUL_R', { IN1: 'MD 112', IN2: '1.000000e+002', OUT: 'MD 100' })] }),
    seg({ titulo: 'Alarma > 80 %', entrada: [cmp('>R', 'MD 100', '8.000000e+001')], salidas: [bob('A 5.7')] }),
  ],
  E24: () => [
    seg({ titulo: 'BCD → INT', salidas: [box('BCD_I', { IN: 'EW 2', OUT: 'MW 70' })] }),
    seg({ titulo: 'Sumar 1', salidas: [box('ADD_I', { IN1: 'MW 70', IN2: '1', OUT: 'MW 72' })] }),
    seg({ titulo: 'INT → BCD al display', salidas: [box('I_BCD', { IN: 'MW 72', OUT: 'AW 6' })] }),
  ],
  E25: () => [
    seg({ titulo: 'Redondear', salidas: [box('ROUND', { IN: 'MD 100', OUT: 'MD 104' })] }),
    seg({ titulo: 'Truncar', salidas: [box('TRUNC', { IN: 'MD 100', OUT: 'MD 108' })] }),
    seg({ titulo: 'Hacia +∞', salidas: [box('CEIL', { IN: 'MD 100', OUT: 'MD 112' })] }),
    seg({ titulo: 'Hacia −∞', salidas: [box('FLOOR', { IN: 'MD 100', OUT: 'MD 116' })] }),
  ],
  E26: () => [
    seg({ titulo: 'Selector', entrada: [na('E 0.0')], salidas: [jmp('SUMA')] }),
    seg({ titulo: 'Restar', salidas: [box('SUB_I', { IN1: 'MW 30', IN2: 'MW 32', OUT: 'MW 34' })] }),
    seg({ salidas: [jmp('FIN')] }),
    seg({ titulo: 'Sumar', meta: 'SUMA', salidas: [box('ADD_I', { IN1: 'MW 30', IN2: 'MW 32', OUT: 'MW 34' })] }),
    seg({ meta: 'FIN' }),
  ],
  C01: () => [seg({ entrada: [par(na('E 0.0'), na('E 0.1')), nc('E 0.2')], salidas: [bob('A 4.0')] })],
  C02: () => [
    seg({ entrada: [par([na('E 0.0'), na('E 0.1')], [na('E 0.2'), nc('E 0.3')])], salidas: [s('A 4.0')] }),
    seg({ entrada: [na('E 0.4')], salidas: [r('A 4.0')] }),
  ],
  C03: () => [seg({ entrada: [na('E 0.0'), par(na('E 0.1'), [na('E 0.2'), na('E 0.3')])], salidas: [bob('A 4.0'), bob('A 4.1')] })],
  C04: () => [seg({ entrada: [na('E 2.0'), cmp('>I', 'MW 30', '100')], salidas: [temp('S_EVERZ', 'T 2', 'S5T#3S', { q: [bob('A 4.3')] })] })],
  P01: () => [
    seg({ titulo: 'Bomba en marcha bajo el mínimo', entrada: [nc('E 0.2')], salidas: [s('A 4.0')] }),
    seg({ titulo: 'Bomba parada en el máximo', entrada: [na('E 0.3')], salidas: [r('A 4.0')] }),
    seg({ titulo: 'Paro (NC)', entrada: [nc('E 0.1')], salidas: [r('A 4.0')] }),
  ],
  P02: () => [seg({ titulo: 'Minutero', entrada: [na('E 0.0')], salidas: [temp('S_VIMP', 'T 1', 'S5T#30S', { q: [bob('A 4.0')] })] })],
  P03: () => [
    seg({ titulo: 'Contar piezas', entrada: [na('E 1.0')], salidas: [cont('Z_VORW', 'Z 1', { dual: 'MW 200' })] }),
    seg({ titulo: 'Aviso 2 s', entrada: [cmp('>=I', 'MW 200', '5')], salidas: [coilT('SV', 'T 1', 'S5T#2S')] }),
    seg({ entrada: [na('T 1')], salidas: [bob('A 5.0')] }),
    seg({ titulo: 'Reiniciar la cuenta', entrada: [cmp('>=I', 'MW 200', '5')], salidas: [r('Z 1')] }),
  ],
  P04: () => [
    seg({ titulo: 'Línea (enclavamiento)', entrada: [par(na('E 0.0'), na('A 4.0')), na('E 0.1')], salidas: [bob('A 4.0')] }),
    seg({ titulo: 'Tiempo de estrella', entrada: [na('A 4.0')], salidas: [coilT('SE', 'T 1', 'S5T#5S')] }),
    seg({ titulo: 'Estrella', entrada: [na('A 4.0'), nc('T 1'), nc('A 4.2')], salidas: [bob('A 4.1')] }),
    seg({ titulo: 'Triángulo', entrada: [na('A 4.0'), na('T 1'), nc('A 4.1')], salidas: [bob('A 4.2')] }),
  ],
  R01: () => [seg({ entrada: [na('E 0.0')], salidas: [temp('S_EVERZ', 'T 1', 'S5T#1S', { q: [bob('A 4.0')] })] })],
  R02: () => [seg({ entrada: [na('E 0.0')], salidas: [temp('S_AVERZ', 'T 1', 'S5T#1S', { q: [bob('A 4.0')] })] })],
  R03: () => [
    seg({ titulo: 'Impulso', entrada: [na('E 0.0')], salidas: [temp('S_IMPULS', 'T 1', 'S5T#1S', { q: [bob('A 4.0')] })] }),
    seg({ titulo: 'Impulso prolongado', entrada: [na('E 0.0')], salidas: [temp('S_VIMP', 'T 2', 'S5T#1S', { q: [bob('A 4.1')] })] }),
  ],
  E28: () => [
    seg({ titulo: 'Etapa inicial', entrada: [na('E 0.0'), nc('M 20.0'), nc('M 20.1'), nc('M 20.2')], salidas: [s('M 20.0')] }),
    seg({ titulo: 'Etapa 1: verde (5 s)', entrada: [na('M 20.0')], salidas: [temp('S_EVERZ', 'T 10', 'S5T#5S', { q: [s('M 20.1'), r('M 20.0')] })] }),
    seg({ titulo: 'Etapa 2: ámbar (2 s)', entrada: [na('M 20.1')], salidas: [temp('S_EVERZ', 'T 11', 'S5T#2S', { q: [s('M 20.2'), r('M 20.1')] })] }),
    seg({ titulo: 'Etapa 3: rojo (5 s)', entrada: [na('M 20.2')], salidas: [temp('S_EVERZ', 'T 12', 'S5T#5S', { q: [s('M 20.0'), r('M 20.2')] })] }),
    seg({ titulo: 'Paro', entrada: [nc('E 0.0')], salidas: [r('M 20.0'), r('M 20.1'), r('M 20.2')] }),
    seg({ titulo: 'Verde', entrada: [na('M 20.0')], salidas: [bob('A 4.0')] }),
    seg({ titulo: 'Ámbar', entrada: [na('M 20.1')], salidas: [bob('A 4.1')] }),
    seg({ titulo: 'Rojo', entrada: [na('M 20.2')], salidas: [bob('A 4.2')] }),
  ],
};
void call;
void biest;

const cache = new Map<string, SegmentoKOP[]>();

/** Modelo KOP de la solución del ejercicio (copia nueva cada vez) o null. */
export function kopModel(id: string): SegmentoKOP[] | null {
  const f = M[id];
  if (!f) return null;
  if (!cache.has(id)) cache.set(id, segs(id, f()));
  return structuredClone(cache.get(id)!);
}

export const KOP_MODEL_IDS = Object.keys(M);
