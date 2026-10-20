import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { KOP_MODEL_IDS, kopModel } from '../../src/content/kop/models';
import { compileProgram, type Programa } from '../../src/core/program';
import { runChronoTest, runTest } from '../../src/core/testrunner';
import { validateSegment } from '../../src/kop/validate';
import { layoutSegment } from '../../src/kop/layout';

const ej = (id: string) => (banco as any).ejercicios.find((e: any) => e.id === id);

describe('modelos KOP de los ejercicios', () => {
  for (const id of KOP_MODEL_IDS) {
    it(`${id}: valida, compila y pasa las pruebas del ejercicio`, () => {
      const segs = kopModel(id)!;
      for (const s of segs) expect(validateSegment(s)).toEqual([]);
      const p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: segs.map((kop) => ({ lang: 'KOP', kop })) }] };
      const pc = compileProgram(p);
      expect(pc.errors).toEqual([]);
      const e = ej(id);
      let checked = false;
      if (e.prueba) { expect(runTest(pc.cp!, e.prueba)).toEqual([]); checked = true; }
      if (e.cronograma) { expect(runChronoTest(pc.cp!, e.cronograma).fails).toEqual([]); checked = true; }
      expect(checked).toBe(true);
      expect(JSON.parse(JSON.stringify(segs))).toEqual(segs);
      for (const s of segs) {
        const L = layoutSegment(s);
        expect(L.width).toBeGreaterThan(0);
        expect(L.height).toBeGreaterThan(0);
      }
    });
  }
});
