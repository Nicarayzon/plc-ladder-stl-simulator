import { describe, expect, it } from 'vitest';
import { migrarProyectos, quitarDemo } from '../../src/store/projects';
import { clockByteOf, migrarHw, type HwEstacion, type Programa } from '../../src/core/program';
import { demoAntiguo } from '../../src/store/legacyDemo';
import { emptyWbState } from '../../src/ui/workbench/types';

const wbDemo = { vat: [], signals: [], inputs: [['E0.0', 'NA'], ['E0.1', 'NC']] as [string, 'NA' | 'NC'][] };

describe('migración: quitar el programa de ejemplo antiguo', () => {
  it('borra el ejemplo si no se tocó y conserva los programas del alumno', () => {
    const mio = { id: 'b', nombre: 'Cintas', programa: { nemotecnia: 'de' as const, simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'AWL' as const, id: 'x', awl: 'U E 124.0\n= A 124.0' }] }] }, wb: emptyWbState(), actualizado: 1 };
    const r = quitarDemo({ proyectos: [{ id: 'a', nombre: 'Ejemplo: marcha y paro', programa: demoAntiguo(), wb: wbDemo, actualizado: 1 }, mio], actual: 'a' });
    expect(r.proyectos.map((p) => p.nombre)).toEqual(['Cintas']);
    expect(r.actual).toBe('b');
  });
  it('si el alumno escribió en el ejemplo, lo conserva sin los símbolos de ejemplo que no usa', () => {
    const p = demoAntiguo();
    p.bloques[0].segmentos = [{ lang: 'AWL', id: 'x', awl: 'U E 124.0\n= "Motor"' }];
    const r = quitarDemo({ proyectos: [{ id: 'a', nombre: 'Ejemplo: marcha y paro', programa: p, wb: wbDemo, actualizado: 1 }], actual: 'a' });
    expect(r.proyectos.length).toBe(1);
    expect(r.proyectos[0].nombre).toBe('Programa 1');
    expect(r.proyectos[0].programa.simbolos.map((s) => s.nombre)).toEqual(['Motor']);
    expect(r.proyectos[0].wb.inputs).toEqual([]);
  });
});

describe('migración: hardware guardado por versiones anteriores', () => {
  // hasta la 0.17.0 la CPU se guardaba con otro tipo y con el nombre automático «… 300(n)»
  const antigua = (nombre: string): HwEstacion => ({ id: 'h1', tipo: 'Antigua-300', nombre, marcaCiclo: { activa: true, byte: 10 } }) as unknown as HwEstacion;
  const programa = (est: HwEstacion[]): Programa => ({ nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [] }], hw: { estaciones: est } });

  it('la CPU pasa a tipo «CPU» y la marca de ciclo sigue activa en el mismo byte', () => {
    const p = programa([antigua('Antigua 300(1)')]);
    expect(clockByteOf(p)).toBeNull();
    const m = migrarHw(p);
    expect(m.hw!.estaciones[0]).toEqual({ id: 'h1', tipo: 'CPU', nombre: 'CPU(1)', marcaCiclo: { activa: true, byte: 10 } });
    expect(clockByteOf(m)).toBe(10);
  });
  it('conserva el nombre que puso el alumno y no toca lo ya migrado', () => {
    expect(migrarHw(programa([antigua('Banco de cintas')])).hw!.estaciones[0].nombre).toBe('Banco de cintas');
    const nuevo = programa([{ id: 'h2', tipo: 'CPU', nombre: 'CPU(1)', marcaCiclo: { activa: false, byte: 0 } }]);
    expect(migrarHw(nuevo)).toBe(nuevo);
    const sinHw: Programa = { nemotecnia: 'de', simbolos: [], bloques: [] };
    expect(migrarHw(sinHw)).toBe(sinHw);
  });
  it('los proyectos guardados con la versión 3 del almacén se migran al abrir la app', () => {
    const st = { proyectos: [{ id: 'a', nombre: 'Aviso', programa: programa([antigua('Antigua 300(1)')]), wb: emptyWbState(), actualizado: 1 }], actual: 'a' };
    const r = migrarProyectos(st, 3);
    expect(clockByteOf(r.proyectos[0].programa)).toBe(10);
    expect(r.proyectos[0].wb).toEqual(st.proyectos[0].wb);
  });
});
