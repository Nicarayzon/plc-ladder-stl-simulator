import { describe, expect, it } from 'vitest';
import { CPU } from '../../src/core/cpu';
import { bcdDecode, bcdEncode, bitsF32, f32Bits, roundHalfEven, s16, s32 } from '../../src/core/num';
import { parseConstant } from '../../src/core/constants';
import { testRead } from '../../src/core/testio';

function run(code: string) {
  const cpu = new CPU(code);
  cpu.scan();
  return cpu;
}
const md = (cpu: CPU, n: number) => testRead(cpu, `MD${n}:DWORD`);

describe('utilidades numéricas', () => {
  it('s16/s32', () => {
    expect(s16(0x8000)).toBe(-32768);
    expect(s16(0x17FFF)).toBe(32767);
    expect(s32(0xFFFFFFFF)).toBe(-1);
  });
  it('round al par', () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 2.4999, 2.5001].map((x) => roundHalfEven(x) + 0)).toEqual([0, 2, 2, 0, -2, -2, 2, 3]);
  });
  it('float32', () => {
    expect(f32Bits(1)).toBe(0x3F800000);
    expect(f32Bits(1e39)).toBe(0x7F800000);
    expect(f32Bits(-1e39)).toBe(0xFF800000);
    expect(f32Bits(NaN)).toBe(0x7FC00000);
    expect(bitsF32(0x40490FDB)).toBeCloseTo(3.14159265, 6);
  });
  it('BCD', () => {
    expect(bcdEncode(123, 3)).toBe(0x123);
    expect(bcdEncode(9999999, 7)).toBe(0x9999999);
    expect(bcdDecode(0x0999, 3)).toBe(999);
    expect(() => bcdDecode(0x0A00, 3)).toThrow('la cifra A no es válida (valor 16#A00)');
  });
  it('constantes', () => {
    expect(parseConstant('S5T#1M30S')).toEqual({ value: 0x1900, ctype: 'S5TIME' });
    expect(parseConstant('S5T#500MS')).toEqual({ value: 0x0050, ctype: 'S5TIME' });
    expect(parseConstant('T#1M30S')).toEqual({ value: 90000, ctype: 'TIME' });
    expect(parseConstant('D#1990-01-02')).toEqual({ value: 1, ctype: 'DATE' });
    expect(parseConstant('TOD#12:30:00.000')).toEqual({ value: 45000000, ctype: 'TOD' });
    expect(parseConstant('P#M100.3')).toEqual({ value: (0x83 * 2 ** 24 + 803) >>> 0, ctype: 'PTR' });
    expect(parseConstant("'AB'")).toEqual({ value: 0x4142, ctype: 'CHAR' });
    expect(parseConstant('B#(1,2,3,4)')).toEqual({ value: 0x01020304, ctype: 'DWORD' });
    expect(parseConstant('-5')).toEqual({ value: 0xFFFB, ctype: 'INT' });
    expect(parseConstant('40000')).toEqual({ value: 40000, ctype: 'DINT' });
    expect(parseConstant('E 0.0')).toBeNull();
    expect(() => parseConstant('W#16#1FFFF')).toThrow('Constante no válida');
  });
});

describe('aritmética de 32 bits', () => {
  it('*D con desbordamiento', () => {
    const cpu = run('L L#100000\nL L#100000\n*D\nT MD 0\nU OV\n= M 10.0\nU >0\n= M 10.1');
    expect(md(cpu, 0)).toBe((100000 * 100000) % 2 ** 32);
    expect(cpu.M[10] & 3).toBe(3);
  });
  it('*D negativo grande: A1A0 según el signo real', () => {
    const cpu = run('L L#-2000000000\nL L#2000000000\n*D\nT MD 0\nU <0\n= M 10.0');
    expect(cpu.M[10] & 1).toBe(1);
    expect(md(cpu, 0)).toBe(Number(BigInt.asUintN(32, -2000000000n * 2000000000n)));
  });
  it('/D y MOD con signos', () => {
    const cpu = run('L L#-7\nL L#2\n/D\nT MD 0\nL L#-7\nL L#2\nMOD\nT MD 4\nL L#-2147483648\nL L#-1\n/D\nT MD 8\nU OV\n= M 20.0');
    expect(testRead(cpu, 'MD0')).toBe(-3);
    expect(testRead(cpu, 'MD4')).toBe(-1);
    expect(testRead(cpu, 'MD8')).toBe(-2147483648);
    expect(cpu.M[20] & 1).toBe(1);
  });
  it('/I deja el resto en ACU1-H', () => {
    const cpu = run('L -7\nL 2\n/I\nT MD 0');
    expect(md(cpu, 0)).toBe(0xFFFFFFFD);
  });
  it('desplazamientos con n grande (ACU2-LL)', () => {
    const cpu = run('L 40\nL DW#16#80000001\nSLD\nT MD 0\nL 32\nL DW#16#80000001\nSRD\nT MD 4\nU >0\n= M 20.0\nL 33\nL DW#16#80000001\nRLD\nT MD 8\nL 17\nL W#16#8001\nSSI\nT MW 12');
    expect(md(cpu, 0)).toBe(0);
    expect(md(cpu, 4)).toBe(0);
    expect(cpu.M[20] & 1).toBe(1); // último bit que salió = bit 31 = 1
    expect(md(cpu, 8)).toBe(0x00000003);
    expect(testRead(cpu, 'MW12:WORD')).toBe(0xFFFF);
  });
  it('REAL: desbordamiento, NaN y subdesbordamiento', () => {
    const cpu = run('L 3.0e38\nL 10.0\n*R\nT MD 0\nU OV\n= M 20.0\nL -1.0\nSQRT\nT MD 4\nU UO\n= M 20.1\nL 1.0e-30\nL 1.0e-30\n*R\nT MD 8\nU OV\n= M 20.2\nU ==0\n= M 20.3');
    expect(md(cpu, 0)).toBe(0x7F800000);
    expect(md(cpu, 4)).toBe(0x7FC00000);
    expect(md(cpu, 8)).toBe(0);
    expect(cpu.M[20] & 0xF).toBe(0xF);
  });
  it('RND+/RND-/TRUNC y fuera de rango', () => {
    const cpu = run('L -2.5\nRND+\nT MD 0\nL -2.5\nRND-\nT MD 4\nL -2.7\nTRUNC\nT MD 8\nL L#7\nL 3.0e10\nRND\nT MD 12\nU OV\n= M 20.0');
    expect(testRead(cpu, 'MD0')).toBe(-2);
    expect(testRead(cpu, 'MD4')).toBe(-3);
    expect(testRead(cpu, 'MD8')).toBe(-2);
    expect(md(cpu, 12)).toBe(f32Bits(3.0e10));
    expect(cpu.M[20] & 1).toBe(1);
  });
  it('CAD / INVD / NEGR / DTB', () => {
    const cpu = run('L DW#16#11223344\nCAD\nT MD 0\nL DW#16#0F0F0F0F\nINVD\nT MD 4\nL 1.0\nNEGR\nT MD 8\nL L#-1234567\nDTB\nT MD 12');
    expect(md(cpu, 0)).toBe(0x44332211);
    expect(md(cpu, 4)).toBe(0xF0F0F0F0);
    expect(md(cpu, 8)).toBe(0xBF800000);
    expect(md(cpu, 12)).toBe(0xF1234567);
  });
  it('indirecto por memoria y error de puntero', () => {
    const ok = run('L P#20.0\nT MD 100\nL 55\nT MW [MD 100]');
    expect(testRead(ok, 'MW20')).toBe(55);
    const bad = run('L P#20.1\nT MD 100\nL 55\nT MW [MD 100]');
    expect(bad.state).toBe('STOP');
    expect(bad.stopReason).toBe('Puntero no válido: para byte/palabra/doble palabra el bit debe ser 0 → OB121 no cargado → STOP');
  });
});
