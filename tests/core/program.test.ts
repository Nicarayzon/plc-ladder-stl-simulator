import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { compileBlockText } from '../../src/core/compiler';
import { compileProgram, programFromAwl, type Programa } from '../../src/core/program';
import { runTest } from '../../src/core/testrunner';

const sig = (instrs: any[]) => instrs.map((i) => `${i.mn} ${i.op?.text ?? ''} ${i.target}`);

describe('programa por segmentos', () => {
  const items = (banco as any).ejercicios.filter((e: any) => e.awl);
  for (const e of items) {
    it(`${e.id}: segmentado ≡ texto completo`, () => {
      let ref: string[] | string;
      try { ref = sig(compileBlockText(e.awl).instrs); } catch (err) { ref = 'error'; }
      const pc = compileProgram(programFromAwl(e.awl, e.id));
      const got = pc.cp ? sig(pc.cp.blocks.get('OB1')!.instrs) : 'error';
      expect(got).toEqual(ref);
    });
  }
  it('metas entre segmentos, FC y símbolos', () => {
    const p: Programa = {
      nemotecnia: 'de',
      simbolos: [{ nombre: 'Marcha', dir: 'E 0.0', tipo: 'BOOL' }, { nombre: 'Motor', dir: 'A 4.0', tipo: 'BOOL' }],
      bloques: [
        { nombre: 'OB1', segmentos: [
          { lang: 'AWL', id: 'a', awl: 'U "Marcha"\nSPB SALT' },
          { lang: 'AWL', id: 'b', awl: 'UC FC 1' },
          { lang: 'AWL', id: 'c', awl: 'SALT: U "Marcha"\n= "Motor"' },
        ] },
        { nombre: 'FC1', segmentos: [{ lang: 'AWL', id: 'f', awl: 'SET\n= M 0.0' }] },
      ],
    };
    const pc = compileProgram(p);
    expect(pc.errors).toEqual([]);
    expect(runTest(pc.cp!, { pasos: [{ poner: { 'E0.0': 0 }, esperar: { 'A4.0': 0, 'M0.0': 1 } }, { poner: { 'E0.0': 1 }, esperar: { 'A4.0': 1 } }] })).toEqual([]);
  });
  it('errores con segmento y línea; símbolo no definido; meta reservada', () => {
    const p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [
      { lang: 'AWL', id: 'a', titulo: 'Uno', awl: 'U E 0.0\n= A 4.0' },
      { lang: 'AWL', id: 'b', titulo: 'Dos', awl: 'U "Nada"\nXYZ\n_X: NOP 0' },
    ] }] };
    const pc = compileProgram(p);
    expect(pc.cp).toBeNull();
    expect(pc.errors.map((e) => e.full)).toEqual([
      'OB1 · Segmento 2 «Dos», línea 3: la meta _X empieza por _ (reservado para el KOP)',
      'OB1 · Segmento 2 «Dos», línea 1: Símbolo no definido: "Nada"',
      'OB1 · Segmento 2 «Dos», línea 2: instrucción desconocida: XYZ',
    ]);
  });
  it('nemotécnica inglesa por programa', () => {
    const p: Programa = { nemotecnia: 'en', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'AWL', id: 'a', awl: 'A I 0.0\n= Q 4.0' }] }] };
    const pc = compileProgram(p);
    expect(runTest(pc.cp!, { pasos: [{ poner: { 'E0.0': 1 }, esperar: { 'A4.0': 1 } }] })).toEqual([]);
  });
});
