import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { checkEquivalence } from '../../src/core/equivalence';
import { compileProgramText } from '../../src/core/compiler';
import { compileProgramStrict, type Programa } from '../../src/core/program';
import { KOP_MODEL_IDS, kopModel } from '../../src/content/kop/models';

const ej = (id: string) => (banco as any).ejercicios.find((e: any) => e.id === id);
const obsOf = (e: any) => [...new Set((e.prueba?.pasos ?? []).flatMap((p: any) => Object.keys(p.esperar ?? {})))] as string[];

describe('equivalencia', () => {
  for (const id of KOP_MODEL_IDS.filter((x) => ej(x)?.awl && !['E09', 'E22', 'P03'].includes(x))) {
    it(`${id}: el modelo KOP es equivalente a su AWL`, async () => {
      const e = ej(id);
      const p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: kopModel(id)!.map((kop) => ({ lang: 'KOP', kop })) }] };
      const r = await checkEquivalence(compileProgramStrict(p), compileProgramText(e.awl), { observables: obsOf(e), inicial: e.prueba?.inicial, walks: 6, steps: 150 });
      expect(r.contraejemplo?.diff ?? null).toBeNull();
      expect(r.equivalente).toBe(true);
    });
  }

  it('detecta prioridad a la marcha frente a prioridad al paro (secuencial)', async () => {
    const r = await checkEquivalence(compileProgramText(ej('E08').awl), compileProgramText(ej('E07').awl), { inicial: { 'E0.1': 1 } });
    expect(r.equivalente).toBe(false);
    expect(r.modo).toBe('secuencial');
    expect(r.contraejemplo!.steps.length).toBeLessThanOrEqual(5);
  });

  it('detecta evaluación secuencial (combinacional, exhaustivo)', async () => {
    const r = await checkEquivalence(compileProgramText('U E 0.0\nO E 0.1\nU E 0.2\n= A 4.0'), compileProgramText('U E 0.0\nO(\nU E 0.1\nU E 0.2\n)\n= A 4.0'));
    expect(r.modo).toBe('combinacional');
    expect(r.equivalente).toBe(false);
    expect(r.contraejemplo!.steps.length).toBe(1);
  });

  it('detecta SE frente a SS', async () => {
    const r = await checkEquivalence(compileProgramText('U E 0.0\nL S5T#1S\nSS T 1\nU T 1\n= A 4.0'), compileProgramText('U E 0.0\nL S5T#1S\nSE T 1\nU T 1\n= A 4.0'));
    expect(r.equivalente).toBe(false);
    expect(r.contraejemplo!.steps.length).toBeLessThanOrEqual(5);
  });

  it('dos formas equivalentes de escribir C01', async () => {
    const r = await checkEquivalence(compileProgramText('U(\nO E 0.0\nO E 0.1\n)\nUN E 0.2\n= A 4.0'), compileProgramText(ej('C01').awl));
    expect(r.equivalente).toBe(true);
  });
});
