// Señales E/S: botón, panel de abajo plegable y ventana aparte (otro monitor)
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

test('señales E/S: botón, ventana aparte, teclas y simulación con la principal minimizada', async () => {
  test.setTimeout(180_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-sen-'));
  const app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_USER_DATA: userData } });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  const errores: string[] = [];
  win.on('pageerror', (e) => errores.push(String(e)));
  win.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await win.evaluate(() => { window.location.hash = '#/simulador'; });
  await win.waitForTimeout(800);
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Cintas');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText('U E 124.0\n= A 124.0\nU M 0.5\n= A 124.7\n');
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(800);
  // 1) por defecto el panel de abajo está plegado: solo pestañas, sin analizador
  await expect(win.locator('.wb-bottom.collapsed')).toHaveCount(1);
  await expect(win.locator('.wb-bottom .an')).toHaveCount(0);
  // 2) «Señales E/S» lo abre con el analizador; otra vez lo oculta
  const boton = win.locator('.wb-toolbar button', { hasText: 'Señales E/S' });
  await boton.click();
  await expect(win.locator('.wb-bottom .an')).toHaveCount(1);
  await expect(boton).toHaveClass(/active/);
  await expect(win.locator('.wb-bottom .an-sig .nm')).toHaveText(['E 124.0', 'A 124.0', 'A 124.7']);
  await win.keyboard.press('Digit1');
  await win.waitForTimeout(700);
  await boton.click();
  await expect(win.locator('.wb-bottom.collapsed')).toHaveCount(1);
  // pestaña Mensajes también abre el panel
  await win.locator('.wb-bottom .tab', { hasText: 'Mensajes' }).click();
  await expect(win.locator('.wb-bottom-body')).toContainText('M 0.5 se consulta');
  // marca de ciclo para que M 0.5 parpadee
  await win.locator('.wb-toolbar button', { hasText: 'Hardware' }).click();
  await win.locator('.modal button', { hasText: 'CPU compacta' }).click();
  await win.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await win.waitForTimeout(600);
  await win.locator('.wb-bottom button', { hasText: 'Ocultar' }).click();
  await expect(win.locator('.wb-bottom.collapsed')).toHaveCount(1);
  // 3) ventana aparte
  const [hija] = await Promise.all([app.waitForEvent('window'), win.locator('.wb-toolbar button[aria-label="Abrir las señales en otra ventana"]').click()]);
  hija.on('pageerror', (e) => errores.push('hija: ' + String(e)));
  await expect(hija.locator('.senales-head')).toContainText('Señales E/S');
  await expect(hija.locator('canvas')).toHaveCount(1);
  await expect(boton).toHaveClass(/active/);
  // añadir una señal desde la ventana aparte (eventos de React en el portal)
  await hija.locator('input[aria-label="Señal nueva"]').fill('M 0.5');
  await hija.locator('button', { hasText: 'Señal' }).click();
  await expect(hija.locator('.an-sig .nm')).toHaveText(['E 124.0', 'A 124.0', 'A 124.7', 'M 0.5']);
  // el desplegable «Disparo» abre su menú en esta ventana y se cierra con un clic fuera de él
  const disparo = hija.locator('button[aria-label="Disparo"]');
  await expect(hija.locator('select')).toHaveCount(0);
  await disparo.click();
  await expect(hija.locator('.menu')).toHaveCount(1);
  await expect(win.locator('.menu')).toHaveCount(0);
  await hija.locator('.senales-head').click({ position: { x: 4, y: 4 } });
  await expect(hija.locator('.menu')).toHaveCount(0);
  await disparo.click();
  await hija.locator('.menu button', { hasText: 'Pausar si E 124.0 ↑' }).click();
  await expect(disparo).toHaveText('Pausar si E 124.0 ↑', { useInnerText: true });
  await disparo.click();
  await hija.locator('.menu button', { hasText: 'Sin disparo' }).click();
  await expect(disparo).toHaveText('Sin disparo', { useInnerText: true });
  // teclas 1–8 con la ventana de señales delante → entradas de la principal
  const on0 = await win.locator('.sw.on', { hasText: '124.0' }).count();
  await hija.locator('canvas').click();
  await hija.keyboard.press('Digit1');
  await win.waitForTimeout(300);
  expect(await win.locator('.sw.on', { hasText: '124.0' }).count()).toBe(on0 ? 0 : 1);
  // el lienzo tiene dibujo (no está vacío)
  await hija.waitForTimeout(1500);
  const pintado = await hija.evaluate(() => { const c = document.querySelector('canvas')!; const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return { w: c.width, h: c.height, n }; });
  // la rejilla usa el color del borde del tema, no el de la señal (verde)
  const rejilla = await hija.evaluate(() => { const c = document.querySelector('canvas')!; const g = c.getContext('2d')!; const d = g.getImageData(0, Math.round(c.height * 0.95), c.width, 1).data; const cols = new Set<string>(); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) cols.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return [...cols]; });
  expect(rejilla.some((c) => c === '61,220,132')).toBe(false);
  expect(pintado.n).toBeGreaterThan(1000);
  // 4) principal minimizada: la simulación sigue gracias a la ventana de señales
  const c0 = await win.evaluate(() => Number(document.querySelector('.wb-status b')!.textContent!.replace(/\./g, '')));
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => !w.getTitle().startsWith('Señales'))!.minimize());
  await hija.waitForTimeout(3000);
  const tHija = await hija.locator('.wb-status').innerText();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.restore()));
  await win.waitForTimeout(500);
  const c1 = await win.evaluate(() => Number(document.querySelector('.wb-status b')!.textContent!.replace(/\./g, '')));
  expect(c1 - c0).toBeGreaterThan(200);
  // 5) «Volver a la ventana principal» → se cierra y vuelven abajo
  await hija.locator('button', { hasText: 'Volver a la ventana principal' }).click();
  await win.waitForTimeout(800);
  expect(app.windows().length).toBe(1);
  await expect(win.locator('.wb-bottom .an')).toHaveCount(1);
  await expect(win.locator('.an-sig .nm')).toHaveText(['E 124.0', 'A 124.0', 'A 124.7', 'M 0.5']);
  // 6) abrir otra vez y cerrar con el botón rojo: la principal se entera
  const [hija2] = await Promise.all([app.waitForEvent('window'), win.locator('.wb-toolbar button[aria-label="Abrir las señales en otra ventana"]').click()]);
  await expect(hija2.locator('.senales-head')).toBeVisible();
  await expect(win.locator('.senales-aparte')).toHaveCount(0); // estaba en «Señales»: el panel se pliega
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.getTitle().startsWith('Señales'))!.close());
  await win.waitForTimeout(1200);
  await expect(win.locator('.wb-toolbar button[aria-label="Abrir las señales en otra ventana"]')).toBeVisible();
  // geometría recordada
  expect(errores).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
