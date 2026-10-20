import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { CompileError, PLCError, TestValueError } from '../../src/core/errors';
import { runChronoTest, runTest, runTraceTest } from '../../src/core/testrunner';

interface Ej { id: string; titulo: string; awl: string | null; prueba: any; traza: any; cronograma: any; preguntas: any[] | null }
const items = (banco as any).ejercicios as Ej[];

function checksFor(it: Ej): [string, string[]][] {
  const checks: [string, string[]][] = [];
  try {
    if (it.prueba && it.awl) checks.push(['pasos', runTest(it.awl, it.prueba)]);
    if (it.traza && it.awl) checks.push(['traza', runTraceTest(it.awl, it.traza)]);
    if (it.cronograma && it.awl) checks.push(['cronograma', runChronoTest(it.awl, it.cronograma).fails]);
    if (it.preguntas) {
      const fails: string[] = [];
      for (const q of it.preguntas) if (!(q.correcta >= 0 && q.correcta < q.opciones.length)) fails.push(`${q.id}: índice de respuesta fuera de rango`);
      checks.push(['teoria', fails]);
    }
  } catch (e) {
    if (e instanceof CompileError || e instanceof PLCError || e instanceof TestValueError) checks.push(['error', [`${e.name}: ${e.message}`]]);
    else throw e;
  }
  return checks;
}

describe('Banco de ejercicios (banco_ejercicios.json)', () => {
  let total = 0;
  let ok = 0;
  for (const ej of items) {
    const checks = checksFor(ej);
    for (const [kind, fails] of checks) {
      total++;
      if (!fails.length) ok++;
      it(`${ej.id} ${kind} — ${ej.titulo}`, () => {
        expect(fails).toEqual([]);
      });
    }
  }
  it('62/62 comprobaciones superadas', () => {
    expect(`${ok}/${total}`).toBe('62/62');
  });
});
