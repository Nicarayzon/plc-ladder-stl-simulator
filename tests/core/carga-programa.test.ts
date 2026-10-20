// El programa que ve el alumno tiene que llegar a la CPU (caso real: LED A125.7 que no se encendía).
import { describe, expect, it } from 'vitest';
import { compileProgram, type Programa } from '../../src/core/program';
import { lintProgram } from '../../src/core/lint';
import { runTest } from '../../src/core/testrunner';
import { newKopSegment } from '../../src/ui/workbench/programOps';

const awl = (id: string, code: string) => ({ lang: 'AWL' as const, id, awl: code });

describe('carga del programa en la CPU', () => {
  it('un segmento KOP recién añadido (sin rellenar) no impide cargar el resto', () => {
    const p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [
      { lang: 'KOP', kop: newKopSegment() },
      awl('a', 'U E 125.6\nS M 10.0\n\nU M 10.0\n= A 125.7'),
    ] }] };
    const pc = compileProgram(p);
    expect(pc.errors).toEqual([]);
    expect(pc.warnings.map((w) => w.msg)).toEqual(['segmento KOP sin rellenar: no hace nada']);
    expect(runTest(pc.cp!, { pasos: [{ pulso: 'E125.6', esperar: { 'A125.7': 1, 'M10.0': 1 } }] })).toEqual([]);
  });
  it('un segmento KOP a medio rellenar sí es un error', () => {
    const k = newKopSegment();
    (k.entrada as any).items[0].op = 'E 124.0';
    const pc = compileProgram({ nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'KOP', kop: k }] }] });
    expect(pc.cp).toBeNull();
    expect(pc.errors[0].msg).toBe('falta el operando');
  });
  it('avisa si el código está en un FC que nadie llama o en el OB100', () => {
    const p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [
      { nombre: 'OB1', segmentos: [awl('a', '')] },
      { nombre: 'OB100', segmentos: [awl('b', 'SET\n= A 124.0')] },
      { nombre: 'FC1', segmentos: [awl('c', 'U E 125.6\n= A 125.7')] },
    ] };
    const msgs = lintProgram(p, compileProgram(p)).map((w) => w.msg.slice(0, 3));
    expect(msgs).toContain('B01');
    expect(msgs).toContain('B02');
  });
});
