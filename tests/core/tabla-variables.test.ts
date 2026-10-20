// Tablas de variables (VAT_1…) del simulador libre: T y Z con su valor y migración de la pestaña «Variables».
import { describe, expect, it } from 'vitest';
import { CPU } from '../../src/core/cpu';
import { fmtValue, parseUserValue } from '../../src/core/format';
import { programFromAwl } from '../../src/core/program';
import { analyzeUsage } from '../../src/core/usage';
import { compileProgramStrict } from '../../src/core/program';
import { makeReader, readRaw, writeRaw } from '../../src/sim/readers';
import { migrarProyectos } from '../../src/store/projects';
import { emptyWbState, migrarVat, nextVat } from '../../src/ui/workbench/types';
import { filasTZ, operandosDe } from '../../src/ui/workbench/vat';
import { testWrite } from '../../src/core/testio';

const CONTADOR = `U E 124.0
ZV Z0
U E 124.4
L C# 10
S Z0
U Z0
= A 124.0
U E 124.1
L S5T#2S
SE T 1
U T 1
= A 124.1
L 1234
T MW 10
`;

const pulso = (cpu: CPU, k: string) => { testWrite(cpu, k, 1); cpu.scan(); testWrite(cpu, k, 0); cpu.scan(); };

describe('tabla de variables: T y Z con su valor', () => {
  it('«Z 0» da el valor en C#, «Z 0:Q» el bit y sin valorTZ sigue siendo el bit', () => {
    const cpu = new CPU(CONTADOR);
    const z = makeReader('Z 0', undefined, true);
    expect(z.kind).toBe('counterBcd');
    expect(makeReader('Z 0').kind).toBe('counterQ');
    expect(makeReader('Z 0:Q', undefined, true).kind).toBe('counterQ');
    expect(makeReader('Z 0:VALOR', undefined, true).kind).toBe('counterVal');
    pulso(cpu, 'E124.0'); pulso(cpu, 'E124.0'); pulso(cpu, 'E124.0');
    expect(fmtValue(readRaw(cpu, z), z.size, 'BCD')).toBe('C#3');
    pulso(cpu, 'E124.4');
    expect(fmtValue(readRaw(cpu, z), z.size, 'BCD')).toBe('C#10');
  });
  it('modificar un contador con 7 o C#7; fuera de rango da error', () => {
    const cpu = new CPU(CONTADOR);
    const z = makeReader('Z 0', undefined, true);
    writeRaw(cpu, z, parseUserValue('7', 2, 'BCD'));
    expect(cpu.counters[0].value).toBe(7);
    writeRaw(cpu, z, parseUserValue('C#123', 2, 'BCD'));
    expect(cpu.counters[0].value).toBe(123);
    cpu.scan();
    expect(cpu.PAA[124] & 1).toBe(1);
    expect(() => writeRaw(cpu, z, parseUserValue('-5', 2, 'BCD'))).toThrow();
    expect(() => parseUserValue('1000', 2, 'BCD')).toThrow();
  });
  it('«T 1» da el tiempo que queda en S5TIME y se puede modificar', () => {
    const cpu = new CPU(CONTADOR);
    const t = makeReader('T 1', undefined, true);
    expect(t.kind).toBe('timerS5');
    testWrite(cpu, 'E124.1', 1);
    cpu.scan();
    expect(fmtValue(readRaw(cpu, t), 2, 'S5TIME')).toBe('S5T#2S');
    for (let i = 0; i < 50; i++) cpu.scan(); // 0,5 s
    expect(fmtValue(readRaw(cpu, t), 2, 'S5TIME')).toBe('S5T#1S_500MS');
    writeRaw(cpu, t, parseUserValue('5S', 2, 'S5TIME'));
    expect(fmtValue(readRaw(cpu, t), 2, 'S5TIME')).toBe('S5T#5S');
  });
});

describe('tabla de variables: proyecto', () => {
  it('una VAT nueva empieza con los T y Z del programa; las sugerencias son sus operandos', () => {
    const p = programFromAwl(CONTADOR);
    expect(filasTZ(p)).toEqual([{ text: 'T 1', fmt: 'S5TIME' }, { text: 'Z 0', fmt: 'BCD' }]);
    expect(operandosDe(analyzeUsage(compileProgramStrict(p)))).toEqual(['E 124.0', 'E 124.1', 'E 124.4', 'A 124.0', 'A 124.1', 'MW 10', 'T 1', 'Z 0']);
    expect(filasTZ(programFromAwl('U E 124.0\n= A 124.0'))).toEqual([]);
  });
  it('nombres VAT_1, VAT_2… sin repetir', () => {
    const wb = emptyWbState();
    expect(nextVat(wb)).toBe('VAT_1');
    expect(nextVat({ ...wb, vats: [{ nombre: 'VAT_1', filas: [] }, { nombre: 'VAT_3', filas: [] }] })).toBe('VAT_2');
  });
  it('migración v3: las filas de la pestaña «Variables» pasan a la VAT_1', () => {
    const filas = [{ text: 'Z 0:VALOR', fmt: 'DEC' as const }, { text: 'MW 10', fmt: 'HEX' as const }];
    const con = { id: 'a', nombre: 'Contadores', programa: programFromAwl(CONTADOR), wb: { ...emptyWbState(), vat: filas }, actualizado: 1 };
    const sin = { id: 'b', nombre: 'Vacío', programa: programFromAwl('NOP 0'), wb: emptyWbState(), actualizado: 1 };
    const r = migrarProyectos({ proyectos: [con, sin], actual: 'a' }, 2);
    expect(r.proyectos[0].wb.vats).toEqual([{ nombre: 'VAT_1', filas }]);
    expect(r.proyectos[0].wb.vat).toEqual([]);
    expect(r.proyectos[1].wb.vats).toBeUndefined();
    // ya migrado: no se toca
    const ya = { ...emptyWbState(), vats: [{ nombre: 'VAT_1', filas: [] }] };
    expect(migrarVat(ya)).toBe(ya);
  });
});
