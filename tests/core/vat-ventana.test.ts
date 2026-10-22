// Ventana «Var - VAT_n»: operandos normalizados, formatos válidos y valores con los ejemplos de la especificación
import { describe, expect, it } from 'vitest';
import { f32Bits } from '../../src/core/num';
import { formatoPorDefecto, formatoValido, formatosValidos, lectorDe, normalizarOperando, textoValor, valorForzado } from '../../src/ui/workbench/vatFormatos';
import { makeReader } from '../../src/sim/readers';

const r = (t: string) => makeReader(t, undefined, true);

describe('operandos', () => {
  it('se normalizan con dos espacios y en mayúsculas', () => {
    expect(normalizarOperando('md 200').texto).toBe('MD  200');
    expect(normalizarOperando('  MW110 ').texto).toBe('MW  110');
    expect(normalizarOperando('m 10.3').texto).toBe('M  10.3');
    expect(normalizarOperando('e124.0').texto).toBe('E  124.0');
    expect(normalizarOperando('t 1').texto).toBe('T  1');
    expect(normalizarOperando('db1.dbw 4').texto).toBe('DB1.DBW  4');
    expect(normalizarOperando('"Marcha"', { Marcha: 'E 124.0' }).texto).toBe('E  124.0');
  });
  it('uno no válido da error y una fila vacía no tiene lector', () => {
    expect(lectorDe('XY 3')).toBeInstanceOf(Error);
    expect(lectorDe('M 10.8')).toBeInstanceOf(Error);
    expect(lectorDe('5')).toBeInstanceOf(Error);
    expect(lectorDe('   ')).toBeNull();
    expect(lectorDe('MD  30')).not.toBeInstanceOf(Error);
  });
});

describe('formatos', () => {
  it('por defecto: BOOL en bits y HEX en bytes, palabras y dobles palabras', () => {
    expect(formatoPorDefecto(r('M 10.3'))).toBe('BOOL');
    expect(formatoPorDefecto(r('MB 0'))).toBe('HEX');
    expect(formatoPorDefecto(r('MW 110'))).toBe('HEX');
    expect(formatoPorDefecto(r('MD 30'))).toBe('HEX');
    expect(formatoPorDefecto(r('T 1'))).toBe('S5TIME');
    expect(formatoPorDefecto(r('Z 0'))).toBe('BCD');
  });
  it('solo los que encajan con el tamaño', () => {
    expect(formatosValidos(r('M 10.3'))).toEqual(['BOOL']);
    expect(formatoValido(r('MD 30'), 'REAL')).toBe(true);
    expect(formatoValido(r('MW 110'), 'REAL')).toBe(false);
    expect(formatoValido(r('MW 110'), 'S5TIME')).toBe(true);
    expect(formatoValido(r('MD 30'), 'S5TIME')).toBe(false);
    expect(formatoValido(r('MB 0'), 'BOOL')).toBe(false);
    expect(formatosValidos(r('T 1'))).toEqual(['S5TIME']);
  });
});

describe('valores de comprobación de la especificación', () => {
  it('MW 110 = 00 1E', () => {
    expect(textoValor(0x001E, r('MW 110'), 'HEX')).toBe('W#16#001E');
    expect(textoValor(0x001E, r('MW 110'), 'DEC')).toBe('30');
    expect(textoValor(0x001E, r('MW 110'), 'BIN')).toBe('2#0000_0000_0001_1110');
  });
  it('MD 30 = 53.56 y MD 100 = 26.78', () => {
    expect(f32Bits(53.56) >>> 0).toBe(0x42563D71);
    expect(f32Bits(26.78) >>> 0).toBe(0x41D63D71);
    expect(textoValor(0x42563D71, r('MD 30'), 'REAL')).toBe('53.56');
    expect(textoValor(0x42563D71, r('MD 30'), 'HEX')).toBe('DW#16#42563D71');
    expect(textoValor(0x41D63D71, r('MD 100'), 'REAL')).toBe('26.78');
    expect(textoValor(0x41D63D71, r('MD 100'), 'HEX')).toBe('DW#16#41D63D71');
    expect(textoValor(0x42563D71, r('MD 30'), 'DEC')).toBe('L#1112948081');
    expect(textoValor(0, r('MD 200'), 'HEX')).toBe('DW#16#00000000');
  });
  it('bits en true/false', () => {
    expect(textoValor(1, r('M 10.3'), 'BOOL')).toBe('true');
    expect(textoValor(0, r('M 10.3'), 'BOOL')).toBe('false');
  });
});

describe('valores de forzado', () => {
  it('en la sintaxis del formato', () => {
    expect(valorForzado('60.0', r('MD 30'), 'REAL') >>> 0).toBe(f32Bits(60) >>> 0);
    expect(valorForzado('W#16#00FF', r('MW 110'), 'HEX')).toBe(0xFF);
    expect(valorForzado('true', r('M 10.3'), 'BOOL')).toBe(1);
    expect(valorForzado('L#5', r('MD 30'), 'DEC')).toBe(5);
    expect(valorForzado('C#10', r('Z 0'), 'BCD')).toBe(0x10);
    expect(valorForzado('10', r('Z 0'), 'BCD')).toBe(0x10);
  });
  it('lo que no encaja da error', () => {
    expect(() => valorForzado('hola', r('MW 110'), 'HEX')).toThrow();
    expect(() => valorForzado('', r('MW 110'), 'HEX')).toThrow();
    expect(() => valorForzado('2', r('M 10.3'), 'BOOL')).toThrow();
  });
});
