// Menú ▸ Buscar actualizaciones…: con un servidor local que hace de GitHub; los cuadros de diálogo y el navegador se sustituyen
import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Pulsa «Buscar actualizaciones…» en el menú de la app y devuelve lo que se habría enseñado y abierto */
async function buscar(app: ElectronApplication, boton: number) {
  return app.evaluate(async ({ Menu, dialog, shell }, boton) => {
    const g = globalThis as unknown as { cajas: { message: string; detail: string; buttons: string[] }[]; abiertas: string[] };
    g.cajas = [];
    g.abiertas = [];
    (dialog as unknown as { showMessageBox: (...a: unknown[]) => Promise<{ response: number }> }).showMessageBox = async (...a: unknown[]) => {
      g.cajas.push(a[a.length - 1] as { message: string; detail: string; buttons: string[] });
      return { response: boton };
    };
    (shell as unknown as { openExternal: (u: string) => Promise<void> }).openExternal = async (u: string) => { g.abiertas.push(u); };
    const buscarEn = (items: Electron.MenuItem[]): Electron.MenuItem | undefined => {
      for (const it of items) {
        if (it.label === 'Buscar actualizaciones…') return it;
        const sub = it.submenu && buscarEn(it.submenu.items);
        if (sub) return sub;
      }
      return undefined;
    };
    const item = buscarEn(Menu.getApplicationMenu()!.items);
    if (!item) return null;
    item.click();
    for (let i = 0; i < 50 && !g.cajas.length; i++) await new Promise((r) => setTimeout(r, 100));
    return { cajas: g.cajas, abiertas: g.abiertas };
  }, boton);
}

test('buscar actualizaciones: versión nueva, al día y sin versiones publicadas', async () => {
  test.setTimeout(60_000);
  const { version } = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../package.json'), 'utf-8')) as { version: string };
  const [ma, mi] = version.split('.').map(Number);
  let respuesta: { status: number; cuerpo: unknown } = { status: 200, cuerpo: {} };
  const servidor = http.createServer((req, res) => {
    res.writeHead(respuesta.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(respuesta.cuerpo));
  });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/releases/latest`;
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-act-'));
  const app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_IDIOMA: 'es', AUTOMATIZACION_USER_DATA: userData, AUTOMATIZACION_RELEASES_URL: url } });
  await app.firstWindow();

  // hay una versión nueva: «Actualizar» abre su página
  const nueva = `${ma}.${mi + 1}.0`;
  const pagina = `https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases/tag/v${nueva}`;
  respuesta = { status: 200, cuerpo: { tag_name: `v${nueva}`, html_url: pagina, body: 'Novedades de prueba' } };
  const r1 = await buscar(app, 0);
  expect(r1).not.toBeNull();
  expect(r1!.cajas[0].message).toBe(`Hay una versión nueva: ${nueva}`);
  expect(r1!.cajas[0].detail).toContain(`Tienes la ${version}`);
  expect(r1!.abiertas).toEqual([pagina]);

  // al día: no abre nada
  respuesta = { status: 200, cuerpo: { tag_name: `v${version}`, html_url: pagina } };
  const r2 = await buscar(app, 0);
  expect(r2!.cajas[0].message).toBe('Tienes la última versión');
  expect(r2!.abiertas).toEqual([]);

  // todavía sin versiones publicadas: lo dice y ofrece la página de versiones
  respuesta = { status: 404, cuerpo: { message: 'Not Found' } };
  const r3 = await buscar(app, 1);
  expect(r3!.cajas[0].detail).toBe('Motivo: todavía no hay ninguna versión publicada.');
  expect(r3!.abiertas).toEqual(['https://github.com/Nicarayzon/plc-ladder-stl-simulator/releases']);

  await app.close();
  servidor.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
