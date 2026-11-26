// Guía «Abrir la tabla de variables»: el paso sale de lo que hay en pantalla (menús, la tabla, las gafas)
import { describe, expect, it } from 'vitest';
import { pasoGuiaVat, TOTAL_PASOS_VAT, useGuiaVat, type EstadoVat } from '../../src/ui/workbench/guiaVatEstado';
import { useGuiaCiclo } from '../../src/ui/workbench/guiaCicloEstado';
import { es } from '../../src/i18n/es';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

const NADA: EstadoVat = { tabla: null, menuInsertar: false, menuVat: false };
const tabla = (t: Partial<NonNullable<EstadoVat['tabla']>> = {}) => ({ nombre: 'VAT_1', visible: false, observando: false, conOperando: false, ...t });
const ids = (e: EstadoVat) => { const p = pasoGuiaVat(e); return [p.n, ...p.objetivos.map((o) => o.id)]; };

describe('pasos de la guía de la tabla de variables', () => {
  it('el camino completo: clic derecho en Bloques, Insertar nuevo objeto, Tabla de variables, gafas y operando', () => {
    expect(ids(NADA)).toEqual([1, 'bloques', 'proyecto', 'abrir-proyectos']);
    expect(ids({ ...NADA, menuInsertar: true })).toEqual([2, 'insertar-objeto']);
    // con el submenú abierto (el menú de arriba sigue abierto)
    expect(ids({ ...NADA, menuInsertar: true, menuVat: true })).toEqual([3, 'nueva-vat']);
    // ventana flotante recién abierta: sin cuadrícula hasta pulsar las gafas
    expect(ids({ ...NADA, tabla: tabla() })).toEqual([4, 'vat-gafas']);
    expect(ids({ ...NADA, tabla: tabla({ visible: true, observando: true }) })).toEqual([5, 'vat-operando']);
    const hecho = pasoGuiaVat({ ...NADA, tabla: tabla({ visible: true, observando: true, conOperando: true }) });
    expect([hecho.n, hecho.objetivos[0].id]).toEqual([TOTAL_PASOS_VAT + 1, 'vat-tabla']);
    expect(hecho.objetivos[0].texto).toContain('VAT_1');
    expect(TOTAL_PASOS_VAT).toBe(5);
  });

  it('abajo la cuadrícula se ve siempre: primero las gafas, aunque ya tenga operandos (los T y Z del programa)', () => {
    expect(ids({ ...NADA, tabla: tabla({ visible: true, conOperando: true }) })).toEqual([4, 'vat-gafas']);
    // en pausa, otra vez las gafas
    expect(ids({ ...NADA, tabla: tabla({ visible: true, observando: false, conOperando: true }) })[0]).toBe(4);
  });

  it('si el proyecto ya tiene una tabla, enseña a abrirla (y, si Bloques está plegada, a desplegarla)', () => {
    const p = pasoGuiaVat({ ...NADA, existente: 'VAT_1' });
    expect([p.n, ...p.objetivos.map((o) => o.id)]).toEqual([3, 'vat-fila', 'bloques', 'proyecto', 'abrir-proyectos']);
    expect(p.objetivos[0].texto).toBe(es.guiaVat.abrir('VAT_1'));
    expect(p.objetivos[1].texto).toBe(es.guiaVat.desplegar('VAT_1'));
    // con la tabla abierta, lo de siempre
    expect(ids({ ...NADA, existente: 'VAT_1', tabla: tabla() })[0]).toBe(4);
  });

  it('una guía a la vez: al empezar una se cierra la otra', () => {
    useGuiaCiclo.getState().empezar();
    useGuiaVat.getState().empezar();
    expect([useGuiaCiclo.getState().activa, useGuiaVat.getState().activa]).toEqual([false, true]);
    useGuiaCiclo.getState().empezar();
    expect([useGuiaCiclo.getState().activa, useGuiaVat.getState().activa]).toEqual([true, false]);
    useGuiaCiclo.getState().terminar();
  });

  it('cada paso tiene su texto en los tres idiomas, con los nombres de la app', () => {
    for (const t of [es, en, de]) {
      for (const k of ['titulo', 'boton', 'botonTitulo', 'bloques', 'insertar', 'nueva', 'gafas', 'operando'] as const) expect(t.guiaVat[k].length, k).toBeGreaterThan(5);
      expect(t.guiaVat.abrir('VAT_7')).toContain('VAT_7');
      expect(t.guiaVat.desplegar('VAT_7')).toContain('VAT_7');
      expect(t.guiaVat.listo('VAT_7')).toContain('VAT_7');
      // los mismos rótulos que se ven en la app
      expect(t.guiaVat.bloques).toContain(t.libre.carpetaBloques);
      expect(t.guiaVat.insertar).toContain(t.libre.insertarObjeto);
      expect(t.guiaVat.nueva).toContain(t.libre.obj.vat);
      expect(t.guiaVat.gafas).toContain(t.vatv.b.observar);
      expect(t.guiaVat.operando).toContain(t.vatv.col.operando);
      expect(t.guiaVat.listo('X')).toContain(t.vatv.col.forzado);
      expect(t.guiaVat.listo('X')).toContain(t.vatv.activarForzado);
    }
  });
});
