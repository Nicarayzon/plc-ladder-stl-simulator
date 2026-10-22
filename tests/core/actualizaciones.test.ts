// Buscar actualizaciones (electron/actualizaciones.cjs): versiones, respuesta de GitHub y lo que se le dice al usuario
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

interface Res { tipo: 'nueva' | 'al-dia' | 'error'; version?: string; url?: string; notas?: string; motivo?: string }
type Fetch = (url: string, o?: unknown) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
interface Caja { message: string; detail: string; buttons: string[] }
const act = createRequire(import.meta.url)('../../electron/actualizaciones.cjs') as {
  partes: (v: string) => number[] | null;
  comparar: (a: string, b: string) => number;
  evaluar: (actual: string, release: unknown) => Res;
  consultar: (f: Fetch, actual: string) => Promise<Res>;
  pasos: (p: string) => string;
  buscarActualizaciones: (e: unknown, w: unknown, p?: string) => Promise<Res>;
  PAGINA_RELEASES: string;
};

const responde = (status: number, cuerpo: unknown = {}): Fetch => async () => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });
const RELEASE = { tag_name: 'v0.22.0', html_url: 'https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases/tag/v0.22.0', body: 'Tabla de variables flotante.' };

describe('versiones', () => {
  it('se comparan por números, con o sin «v»', () => {
    expect(act.partes('v0.21.0')).toEqual([0, 21, 0]);
    expect(act.partes('versión rara')).toBeNull();
    expect(act.comparar('0.22.0', '0.21.0')).toBeGreaterThan(0);
    expect(act.comparar('v0.21.0', '0.21.0')).toBe(0);
    expect(act.comparar('0.9.0', '0.10.0')).toBeLessThan(0);
    expect(act.comparar('1.0.0', '0.99.9')).toBeGreaterThan(0);
  });
  it('la última Release decide si hay versión nueva', () => {
    expect(act.evaluar('0.21.0', RELEASE)).toMatchObject({ tipo: 'nueva', version: '0.22.0', url: RELEASE.html_url, notas: 'Tabla de variables flotante.' });
    expect(act.evaluar('0.22.0', RELEASE)).toMatchObject({ tipo: 'al-dia', version: '0.22.0' });
    // la de desarrollo puede ir por delante de la publicada
    expect(act.evaluar('0.23.0', RELEASE).tipo).toBe('al-dia');
    expect(act.evaluar('0.21.0', { tag_name: 'borrador' }).tipo).toBe('error');
  });
});

describe('consulta a GitHub', () => {
  it('versión nueva, sin versiones publicadas, límite de consultas y sin conexión', async () => {
    expect((await act.consultar(responde(200, RELEASE), '0.21.0')).tipo).toBe('nueva');
    expect(await act.consultar(responde(404), '0.21.0')).toMatchObject({ tipo: 'error', motivo: 'todavía no hay ninguna versión publicada' });
    expect((await act.consultar(responde(403), '0.21.0')).motivo).toMatch(/limita/);
    expect((await act.consultar(async () => { throw new Error('ENOTFOUND'); }, '0.21.0')).motivo).toBe('no hay conexión con GitHub');
  });
});

describe('cuadro de diálogo', () => {
  /** Electron de mentira: guarda los cuadros y las páginas abiertas; `boton` es lo que pulsa el usuario */
  const electron = (fetchFn: Fetch, boton: number) => {
    const cajas: Caja[] = [];
    const abiertas: string[] = [];
    return {
      cajas, abiertas,
      e: {
        app: { getVersion: () => '0.21.0' },
        net: { fetch: fetchFn },
        dialog: { showMessageBox: async (o: Caja) => { cajas.push(o); return { response: boton }; } },
        shell: { openExternal: async (u: string) => { abiertas.push(u); } },
      },
    };
  };
  it('con versión nueva, «Actualizar» abre su página y explica cómo reemplazar la anterior', async () => {
    const x = electron(responde(200, RELEASE), 0);
    await act.buscarActualizaciones(x.e, null, 'darwin');
    expect(x.cajas[0].message).toBe('Hay una versión nueva: 0.22.0');
    expect(x.cajas[0].buttons).toEqual(['Actualizar', 'Más tarde']);
    expect(x.cajas[0].detail).toContain('Tienes la 0.21.0');
    expect(x.cajas[0].detail).toContain('«Reemplazar»');
    expect(x.cajas[0].detail).toContain('Novedades:\nTabla de variables flotante.');
    expect(x.abiertas).toEqual([RELEASE.html_url]);
  });
  it('«Más tarde» no abre nada; en Windows explica el instalador', async () => {
    const x = electron(responde(200, RELEASE), 1);
    await act.buscarActualizaciones(x.e, null, 'win32');
    expect(x.cajas[0].detail).toContain('ejecuta el instalador');
    expect(x.abiertas).toEqual([]);
  });
  it('al día y sin conexión', async () => {
    const al = electron(responde(200, { ...RELEASE, tag_name: 'v0.21.0' }), 0);
    await act.buscarActualizaciones(al.e, null);
    expect(al.cajas[0].message).toBe('Tienes la última versión');
    const sin = electron(async () => { throw new Error('offline'); }, 1);
    await act.buscarActualizaciones(sin.e, null);
    expect(sin.cajas[0].detail).toBe('Motivo: no hay conexión con GitHub.');
    expect(sin.abiertas).toEqual([act.PAGINA_RELEASES]);
  });
});
