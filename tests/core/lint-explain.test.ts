import { describe, expect, it } from 'vitest';
import banco from '../../src/content/banco_ejercicios.json';
import { lintProgram } from '../../src/core/lint';
import { compileProgram, programFromAwl } from '../../src/core/program';
import { traceOneCycle } from '../../src/core/testrunner';
import { explainRow } from '../../src/core/explain';

const ids = (awl: string, nc?: string[]) => {
  const p = programFromAwl(awl, 'x');
  return lintProgram(p, compileProgram(p), { ncInputs: nc }).map((i) => i.msg.slice(0, 3));
};

describe('avisos didácticos', () => {
  it('L01..L09 en programas preparados', () => {
    expect(ids('U E 0.0\n= A 4.0\nU E 0.1\n= A 4.0')).toContain('L01');
    expect(ids('U E 0.0\nL MW 10\nL 5\n>I\n= A 4.0')).toContain('L02');
    expect(ids('U E 0.0\nFP M 10.0\n= M 10.1\nU E 0.1\nFP M 10.0\n= M 10.2')).toContain('L03');
    expect(ids('U E 0.0\nL S5T#1S\nSE T 1\nU E 0.1\nL S5T#2S\nSE T 1')).toContain('L04');
    expect(ids('U E 0.0\nL 500\nSE T 1')).toContain('L05');
    expect(ids('U L 0.0\n= A 4.0')).toContain('L06');
    expect(ids('L MW 10\nT MW 11')).toContain('L07');
    expect(ids('U E 0.0\nUN E 0.1\n= A 4.0', ['E0.1'])).toContain('L08');
    expect(ids('L MW 0\nSIG: T MW 2\nL MW 2\nLOOP SIG')).toContain('L09');
  });
  it('las soluciones del banco no dan avisos salvo los intencionados', () => {
    const intended: Record<string, string[]> = { E09: ['L01'], Q04: ['L02'], Q06: ['L07'], Q10: ['L05'], Q12: ['L01'] };
    for (const e of (banco as any).ejercicios.filter((x: any) => x.awl)) {
      const p = programFromAwl(e.awl, e.id);
      const pc = compileProgram(p);
      if (!pc.cp) continue;
      const got = [...new Set(lintProgram(p, pc).map((i) => i.msg.slice(0, 3)))];
      expect({ id: e.id, got: got.filter((g) => !(intended[e.id] ?? []).includes(g)) }).toEqual({ id: e.id, got: [] });
    }
  });
});

describe('explicaciones de la traza', () => {
  const rows = (awl: string, ini: Record<string, number> = {}) => traceOneCycle(awl, ini).rows;
  it('frases del documento', () => {
    const r = rows('U E 0.0\nU E 0.1\nO\nU E 0.2\nU E 0.3\n= A 4.0', { 'E0.0': 1, 'E0.1': 0, 'E0.2': 1, 'E0.3': 1 });
    expect(explainRow(r[3])).toBe('Primera consulta (/ER = 0): RLO := E0.2 = 1.');
    expect(explainRow(r[2])).toBe('Cierra el grupo Y: OR := RLO = 0; la siguiente instrucción será primera consulta.');
    const r2 = rows('U E 0.0\nO\nU E 0.1\n= A 4.0', { 'E0.0': 1, 'E0.1': 0 });
    expect(explainRow(r2[2])).toBe('El bit OR está a 1 (un grupo anterior dio 1): el resultado se queda en 1.');
    const r3 = rows('L 10\nL 5\n>I\n= M 0.0');
    expect(explainRow(r3[2])).toBe('Compara ACU2 (10) > ACU1 (5): sí → RLO := 1. La comparación sustituye al RLO anterior.');
    const r4 = rows('U E 0.0\nSPB X\nX: = A 4.0');
    expect(explainRow(r4[1])).toBe('No salta porque RLO = 0, pero SPB deja RLO = 1 y /ER = 0.');
    const r5 = rows('L 30000\nL 10000\n+I\nT MW 0');
    expect(explainRow(r5[2])).toBe('30000 + 10000 = 40000 no cabe en INT → queda -25536; OV = OS = 1.');
    const r6 = rows('U E 0.0\nUN(\nU E 0.1\n)\n= A 4.0', { 'E0.0': 1, 'E0.1': 1 });
    expect(explainRow(r6[3])).toBe('Se recupera el RLO de antes del paréntesis (1) y se combina: 1 ∧ ¬(1) = 0.');
  });
});
