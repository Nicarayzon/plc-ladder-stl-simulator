// Guía «Activar la marca de ciclo»: el paso sale del estado (lo guardado, lo cargado y la ventana del hardware)
import { describe, expect, it } from 'vitest';
import { HW_CERRADA, pasoGuia, TOTAL_PASOS, type EstadoGuia, type HwVisto } from '../../src/ui/workbench/guiaCicloEstado';
import { colocar } from '../../src/ui/workbench/Guia';
import { es } from '../../src/i18n/es';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

const SIN: EstadoGuia = { guardado: null, cargado: null, sinCargar: false, hw: HW_CERRADA };
const abierta = (h: Partial<HwVisto> = {}): HwVisto => ({ ...HW_CERRADA, abierta: true, ...h });
const ids = (e: EstadoGuia) => { const p = pasoGuia(e); return [p.n, ...p.objetivos.map((o) => o.id)]; };

describe('pasos de la guía', () => {
  it('el camino completo, de 1 a 7 y hecho', () => {
    // 1: el Hardware del explorador (y, si no se ve, lo que hay que abrir para verlo)
    expect(ids(SIN)).toEqual([1, 'hw-fila', 'equipo', 'proyecto', 'abrir-proyectos']);
    // 2: ventana abierta, la CPU
    expect(ids({ ...SIN, hw: abierta() })).toEqual([2, 'cpu-fila']);
    // 3–5: propiedades de la CPU
    expect(ids({ ...SIN, hw: abierta({ props: { pestana: 'general', activa: false, byte: 0 } }) })).toEqual([3, 'tab-ciclo']);
    expect(ids({ ...SIN, hw: abierta({ props: { pestana: 'ciclo', activa: false, byte: 0 } }) })).toEqual([4, 'check-ciclo']);
    expect(ids({ ...SIN, hw: abierta({ props: { pestana: 'ciclo', activa: true, byte: 0 } }) })).toEqual([5, 'aceptar']);
    // 6: aceptado, sin guardar
    expect(ids({ ...SIN, hw: abierta({ borradorCiclo: true, sucio: true }) })).toEqual([6, 'guardar']);
    // 7: guardado, sin cargar
    expect(ids({ ...SIN, guardado: 0, sinCargar: true, hw: abierta({ borradorCiclo: true }) })).toEqual([7, 'cargar']);
    // hecho
    expect(ids({ ...SIN, guardado: 0, cargado: 0, hw: abierta({ borradorCiclo: true }) })).toEqual([TOTAL_PASOS + 1, 'estado-hw', 'hw-fila']);
    expect(ids({ ...SIN, guardado: 0, cargado: 0 })).toEqual([TOTAL_PASOS + 1, 'hw-fila']);
    expect(TOTAL_PASOS).toBe(7);
  });

  it('con un byte propuesto, pide escribirlo antes de aceptar, y no da por buena la marca de ciclo en otro byte', () => {
    const props = (byte: number) => abierta({ props: { pestana: 'ciclo', activa: true, byte } });
    expect(ids({ ...SIN, sugerido: 100, hw: props(0) })).toEqual([5, 'byte-ciclo']);
    expect(pasoGuia({ ...SIN, sugerido: 100, hw: props(0) }).objetivos[0].texto).toContain('100');
    expect(ids({ ...SIN, sugerido: 100, hw: props(100) })).toEqual([5, 'aceptar']);
    // cargada en MB 0 pero el programa usa M 100: no está hecho, hay que abrir el Hardware y cambiar el byte
    expect(ids({ ...SIN, sugerido: 100, guardado: 0, cargado: 0 })[0]).toBe(1);
    expect(ids({ ...SIN, sugerido: 100, guardado: 0, cargado: 0, hw: abierta({ borradorCiclo: true }) })).toEqual([2, 'cpu-fila']);
    expect(ids({ ...SIN, sugerido: 100, guardado: 100, cargado: 100 })[0]).toBe(TOTAL_PASOS + 1);
  });

  it('retrocede si se cierra algo antes de tiempo, y con lo guardado sin cargar manda a abrir otra vez el Hardware', () => {
    // propiedades canceladas: vuelve a la CPU
    expect(ids({ ...SIN, hw: abierta() })[0]).toBe(2);
    // ventana cerrada sin guardar: vuelta al principio
    expect(ids(SIN)[0]).toBe(1);
    // guardado sin cargar y ventana cerrada: paso 7, en el explorador
    const p = pasoGuia({ ...SIN, guardado: 0, sinCargar: true });
    expect([p.n, p.objetivos[0].id]).toEqual([7, 'hw-fila']);
    expect(p.objetivos[0].texto).toBe(es.guia.reabrir);
    // con cambios sin guardar no está hecho, aunque la CPU ya tenga una marca de ciclo
    expect(ids({ ...SIN, guardado: 0, cargado: 0, hw: abierta({ borradorCiclo: true, sucio: true }) })).toEqual([6, 'guardar']);
    // si en el borrador se quitó la marca de ciclo, hay que volver a la CPU
    expect(ids({ ...SIN, hw: abierta({ borradorCiclo: false, sucio: true }) })).toEqual([2, 'cpu-fila']);
  });

  it('cada paso tiene su texto en los tres idiomas', () => {
    for (const t of [es, en, de]) {
      for (const k of ['titulo', 'hecho', 'saltar', 'cerrar', 'hwFila', 'equipo', 'proyecto', 'explorador', 'cpu', 'pestana', 'casilla', 'guardar', 'cargar', 'reabrir'] as const) {
        expect(t.guia[k].length, k).toBeGreaterThan(3);
      }
      expect(t.guia.byte(100)).toContain('100');
      expect(t.guia.aceptar(7)).toContain('MB 7');
      expect(t.guia.listo(7)).toContain('MB 7');
      expect(t.guia.pasoDe(3, 7)).toMatch(/3.*7/);
    }
  });
});

describe('burbuja', () => {
  const VW = 1440;
  const VH = 900;
  it('a la derecha si cabe; si no, al siguiente lado del orden, sin tapar el elemento', () => {
    const fila = { left: 20, top: 100, width: 180, height: 22 };
    const d = colocar(fila, 290, 150, VW, VH, ['derecha', 'debajo']);
    expect(d.lado).toBe('derecha');
    expect(d.x).toBeGreaterThanOrEqual(fila.left + fila.width);
    // fila ancha (la de la CPU): no cabe a la derecha, va debajo
    const cpu = { left: 300, top: 200, width: 1000, height: 26 };
    const b = colocar(cpu, 290, 150, VW, VH, ['derecha', 'debajo', 'encima']);
    expect(b.lado).toBe('debajo');
    expect(b.y).toBeGreaterThanOrEqual(cpu.top + cpu.height);
    // abajo del todo: encima
    const pie = { left: 900, top: 860, width: 80, height: 28 };
    expect(colocar(pie, 290, 150, VW, VH, ['debajo', 'encima']).lado).toBe('encima');
  });

  it('nunca se sale de la ventana', () => {
    for (const r of [{ left: 1400, top: 10, width: 30, height: 20 }, { left: 0, top: 880, width: 1440, height: 20 }]) {
      const p = colocar(r, 290, 150, VW, VH, ['derecha', 'izquierda', 'debajo', 'encima']);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + 290).toBeLessThanOrEqual(VW);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y + 150).toBeLessThanOrEqual(VH);
    }
  });
});
