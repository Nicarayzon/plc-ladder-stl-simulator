import { describe, expect, it } from 'vitest';
import { compileKopSegment, newKopCtx } from '../../src/kop/compile';
import { bob, box, cmp, na, nc, not, par, rama, s, seg, segs, ser, temp, jmp, call, ret, coilT } from '../../src/kop/build';
import type { SegmentoKOP } from '../../src/kop/model';
import { runTest } from '../../src/core/testrunner';
import { compileProgramStrict, type Programa } from '../../src/core/program';

const awl = (sg: SegmentoKOP) => compileKopSegment(sg, newKopCtx('OB1')).map((l) => (l.label ? `${l.label}: ` : '') + (l.op ? `${l.mn} ${l.op}` : l.mn)).join(' / ');
const one = (sg: SegmentoKOP) => segs('t', [sg])[0];
const prog = (list: SegmentoKOP[]): Programa => ({ nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: segs('t', list).map((kop) => ({ lang: 'KOP', kop })) }] });

describe('compilación KOP → AWL: ejemplos esperados (texto exacto)', () => {
  it('E06 enclavamiento', () => {
    expect(awl(one(seg({ entrada: [par(na('E 0.0'), na('A 4.0')), na('E 0.1')], salidas: [bob('A 4.0')] }))))
      .toBe('O E 0.0 / O A 4.0 / U E 0.1 / = A 4.0');
  });
  it('E05 Y con grupo O', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0'), par(na('E 0.1'), na('E 0.2'))], salidas: [bob('A 4.1')] }))))
      .toBe('U E 0.0 / U( / O E 0.1 / O E 0.2 / ) / = A 4.1');
  });
  it('E04 O de grupos Y', () => {
    expect(awl(one(seg({ entrada: [par([na('E 0.0'), na('E 0.1')], [na('E 0.2'), na('E 0.3')])], salidas: [bob('A 4.0')] }))))
      .toBe('O( / U E 0.0 / U E 0.1 / ) / O( / U E 0.2 / U E 0.3 / ) / = A 4.0');
  });
  it('E12 temporizador S_EVERZ', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [temp('S_EVERZ', 'T 1', 'S5T#5S', { pinR: na('E 0.1'), dual: 'MW 10', dez: 'MW 12', q: [bob('A 4.0')] })] }))))
      .toBe('U E 0.0 / L S5T#5S / SE T 1 / U E 0.1 / R T 1 / L T 1 / T MW 10 / LC T 1 / T MW 12 / U T 1 / = A 4.0');
  });
  it('E20 comparador detrás de un contacto', () => {
    expect(awl(one(seg({ entrada: [na('E 2.0'), cmp('>I', 'MW 30', '500')], salidas: [bob('A 5.6')] }))))
      .toBe('U E 2.0 / U( / L MW 30 / L 500 / >I / ) / = A 5.6');
  });
  it('MOVE con EN/ENO', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [box('MOVE', { IN: 'MW 10', OUT: 'MW 12' }, [bob('A 4.0')])] }))))
      .toBe('U E 0.0 / SPBNB _001 / L MW 10 / T MW 12 / SET / SAVE / CLR / _001: U BIE / = A 4.0');
  });
});

describe('casos adicionales', () => {
  it('varias bobinas en paralelo sin pre: sin bit temporal', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0'), s('M 0.0')] })))).toBe('U E 0.0 / = A 4.0 / S M 0.0');
  });
  it('ramas con pre: bit temporal L 20.0', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [rama(bob('A 4.0'), na('E 0.1')), rama(bob('A 4.1'), nc('E 0.2'))] }))))
      .toBe('U E 0.0 / = L 20.0 / U L 20.0 / U E 0.1 / = A 4.0 / U L 20.0 / UN E 0.2 / = A 4.1');
  });
  it('entrada vacía: SET, SPA, UC', () => {
    expect(awl(one(seg({ salidas: [bob('M 1.0')] })))).toBe('SET / = M 1.0');
    expect(awl(one(seg({ salidas: [jmp('fin')] })))).toBe('SPA FIN');
    expect(awl(one(seg({ salidas: [call('FC 1')] })))).toBe('UC FC 1');
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [call('FC 1')] })))).toBe('U E 0.0 / CC FC 1');
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [ret()] })))).toBe('U E 0.0 / BEB');
  });
  it('meta del segmento y NOT', () => {
    expect(awl(one(seg({ meta: 'M1', entrada: [na('E 0.0'), not()], salidas: [bob('A 4.0')] })))).toBe('M1: U E 0.0 / NOT / = A 4.0');
    expect(awl(one(seg({ meta: 'FIN' })))).toBe('FIN: NOP 0');
  });
  it('cuadros encadenados ENO → EN', () => {
    const sg = one(seg({ entrada: [na('E 0.0')], salidas: [box('ADD_I', { IN1: 'MW 0', IN2: 'MW 2', OUT: 'MW 4' }, [box('MOVE', { IN: 'MW 4', OUT: 'MW 6' }, [bob('A 4.0')])])] }));
    expect(awl(sg)).toBe('U E 0.0 / SPBNB _001 / L MW 0 / L MW 2 / +I / T MW 4 / UN OV / SAVE / CLR / _001: U BIE / SPBNB _002 / L MW 4 / T MW 6 / SET / SAVE / CLR / _002: U BIE / = A 4.0');
  });
  it('PAR con rama SER que contiene un PAR', () => {
    const sg = one(seg({ entrada: [par([na('E 0.0'), par(na('E 0.1'), na('E 0.2'))], nc('E 0.3'))], salidas: [bob('A 4.0')] }));
    expect(awl(sg)).toBe('O( / U E 0.0 / U( / O E 0.1 / O E 0.2 / ) / ) / ON E 0.3 / = A 4.0');
  });
  it('bobina de temporizador', () => {
    expect(awl(one(seg({ entrada: [na('E 0.0')], salidas: [coilT('SE', 'T 2', 'S5T#2S')] })))).toBe('U E 0.0 / L S5T#2S / SE T 2');
  });
});

describe('programas KOP ejecutados', () => {
  it('E06 en KOP pasa la prueba de E06', () => {
    const p = prog([seg({ entrada: [par(na('E 0.0'), na('A 4.0')), na('E 0.1')], salidas: [bob('A 4.0')] })]);
    const fails = runTest(compileProgramStrict(p), { pasos: [
      { poner: { 'E0.0': 0, 'E0.1': 1 }, esperar: { 'A4.0': 0 } },
      { poner: { 'E0.0': 1 }, esperar: { 'A4.0': 1 } },
      { poner: { 'E0.0': 0 }, esperar: { 'A4.0': 1 } },
      { poner: { 'E0.1': 0 }, esperar: { 'A4.0': 0 } },
    ] });
    expect(fails).toEqual([]);
  });
  it('dos cuadros MOVE en paralelo (bit temporal)', () => {
    const p = prog([seg({ entrada: [na('E 0.0')], salidas: [box('MOVE', { IN: '5', OUT: 'MW 0' }), box('MOVE', { IN: '7', OUT: 'MW 2' })] })]);
    const fails = runTest(compileProgramStrict(p), { pasos: [
      { poner: { 'E0.0': 0 }, esperar: { MW0: 0, MW2: 0 } },
      { poner: { 'E0.0': 1 }, esperar: { MW0: 5, MW2: 7 } },
    ] });
    expect(fails).toEqual([]);
  });
});

describe('cuadro con ENO sin conectar', () => {
  it('termina en NOP 0 y no arrastra la cadena al segmento siguiente', () => {
    expect(awl(one(seg({ salidas: [box('ADD_I', { IN1: 'MW 0', IN2: 'MW 2', OUT: 'MW 4' })] }))))
      .toBe('SET / SPBNB _001 / L MW 0 / L MW 2 / +I / T MW 4 / UN OV / SAVE / CLR / _001: NOP 0');
  });
});
