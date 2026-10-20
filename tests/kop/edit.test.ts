import { describe, expect, it } from 'vitest';
import * as E from '../../src/kop/edit';
import { kopToAwlText } from '../../src/kop/compile';
import { na, bob, seg, segs, par } from '../../src/kop/build';
import type { SegmentoKOP } from '../../src/kop/model';
import { validateSegment } from '../../src/kop/validate';
import { layoutSegment } from '../../src/kop/layout';

const one = (s: SegmentoKOP) => segs('t', [s])[0];
const awl = (s: SegmentoKOP) => kopToAwlText(s).split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).join(' / ');
const fill = (s: SegmentoKOP, id: string, v: string) => E.setField(s, id, 'op', v);

describe('edición KOP', () => {
  it('dibujar E06 desde cero con operaciones', () => {
    let s = one(seg({ entrada: [na('')], salidas: [bob('')] }));
    const c1 = (s.entrada as any).items[0].id;
    s = fill(s, c1, 'E 0.0');
    // rama paralela sobre E0.0 (F8)
    let r = E.wrapParallel(s, c1);
    s = fill(r.seg, r.sel!, 'A 4.0');
    // contacto en serie detrás del paralelo: seleccionando la bobina (inserta al final de la entrada)
    r = E.insertSeries(s, s.salidas[0].salida.id, E.makeNode('NA') as any);
    s = fill(r.seg, r.sel!, 'E 0.1');
    s = E.setField(s, s.salidas[0].salida.id, 'op', 'A 4.0');
    expect(validateSegment(s)).toEqual([]);
    expect(awl(s)).toBe('O E 0.0 / O A 4.0 / U E 0.1 / = A 4.0');
  });
  it('F8 sobre una rama de un paralelo añade otra rama; borrar normaliza', () => {
    let s = one(seg({ entrada: [par(na('E 0.0'), na('E 0.1')), na('E 0.2')], salidas: [bob('A 4.0')] }));
    const par0 = (s.entrada as any).items[0];
    let r = E.wrapParallel(s, par0.ramas[1].id);
    expect((r.seg.entrada as any).items[0].ramas.length).toBe(3);
    s = r.seg;
    r = E.deleteNode(s, (s.entrada as any).items[0].ramas[2].id);
    r = E.deleteNode(r.seg, (r.seg.entrada as any).items[0].ramas[1].id);
    // un paralelo de una sola rama desaparece
    expect((r.seg.entrada as any).items.map((x: any) => x.k)).toEqual(['NA', 'NA']);
  });
  it('salidas en paralelo y sustitución desde el catálogo', () => {
    let s = one(seg({ entrada: [na('E 0.0')], salidas: [bob('A 4.0')] }));
    let r = E.wrapParallel(s, s.salidas[0].salida.id);
    expect(r.seg.salidas.length).toBe(2);
    s = E.setField(r.seg, r.sel!, 'op', 'A 4.1');
    expect(awl(s)).toBe('U E 0.0 / = A 4.0 / = A 4.1');
    r = E.insertFromCatalog(s, s.salidas[1].salida.id, 'TEMP:S_EVERZ');
    expect(r.seg.salidas[1].salida.k).toBe('TEMP');
    // conectar el pin R y la salida Q
    const t = r.seg.salidas[1].salida.id;
    let r2 = E.connectPin(r.seg, t, 'pinR');
    r2 = E.connectPin(r2.seg, t, 'q');
    expect((r2.seg.salidas[1].salida as any).q.length).toBe(1);
    expect(layoutSegment(r2.seg).boxes.length).toBe(1);
  });
  it('NOT al principio de la cadena es un error de validación', () => {
    const s = one(seg({ entrada: [E.makeNode('NOT') as any, na('E 0.0')], salidas: [bob('A 4.0')] }));
    expect(validateSegment(s).map((i) => i.msg)).toContain('NOT, P, N y el conector necesitan lógica a su izquierda');
  });
  it('operando vacío y de tipo incorrecto', () => {
    const s = one(seg({ entrada: [na('')], salidas: [bob('MW 10')] }));
    const msgs = validateSegment(s).map((i) => i.msg);
    expect(msgs).toContain('falta el operando');
    expect(msgs).toContain('MW 10 no es un bit');
  });
});
