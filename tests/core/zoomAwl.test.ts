// Zoom del código AWL (Ajustes ▸ Zoom del AWL): variable --awl-zoom en <html>
import { describe, expect, it } from 'vitest';
import { LETRA_AWL, ZOOM_AWL, aplicarZoomAwl, limitarZoomAwl } from '../../src/ui/workbench/zoomAwl';
import { es } from '../../src/i18n/es';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

describe('zoom del AWL', () => {
  it('de 80 % a 180 %, en pasos de 10 %; sin valor guardado, 100 %', () => {
    expect([ZOOM_AWL.min, ZOOM_AWL.max, ZOOM_AWL.paso, ZOOM_AWL.defecto, LETRA_AWL]).toEqual([0.8, 1.8, 0.1, 1, 13]);
    expect([limitarZoomAwl(1.5), limitarZoomAwl(0.5), limitarZoomAwl(3), limitarZoomAwl(1.2000000001)]).toEqual([1.5, 0.8, 1.8, 1.2]);
    expect([limitarZoomAwl(undefined), limitarZoomAwl('1.5'), limitarZoomAwl(Number.NaN)]).toEqual([1, 1, 1]);
  });

  it('se pone como variable CSS en <html>', () => {
    const puestas: [string, string][] = [];
    const doc = { documentElement: { style: { setProperty: (k: string, v: string) => puestas.push([k, v]) } } } as unknown as Document;
    aplicarZoomAwl(doc, 1.5);
    aplicarZoomAwl(doc, 9);
    expect(puestas).toEqual([['--awl-zoom', '1.5'], ['--awl-zoom', '1.8']]);
  });

  it('tiene nombre en los tres idiomas', () => {
    expect([es.ajustes.zoomAwl, en.ajustes.zoomAwl, de.ajustes.zoomAwl]).toEqual(['Zoom del AWL', 'STL zoom', 'AWL-Zoom']);
  });
});
