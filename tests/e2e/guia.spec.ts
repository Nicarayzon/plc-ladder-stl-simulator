// Guía «Activar la marca de ciclo»: señala cada paso del camino real (explorador ▸ Hardware ▸ CPU ▸ Ciclo/Marca de
// ciclo ▸ Aceptar ▸ Guardar y compilar ▸ Cargar en módulo) y avanza sola
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

let app: ElectronApplication;
let win: Page;
const errores: string[] = [];
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-guia-'));

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_IDIOMA: 'es', AUTOMATIZACION_USER_DATA: userData } });
  win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  win.on('pageerror', (e) => errores.push(String(e)));
  win.on('dialog', (d) => { void d.accept(); });
  await win.evaluate(() => { window.location.hash = '#/simulador'; });
  await expect(win.locator('.explorer')).toBeVisible();
});
test.afterAll(async () => {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const burbuja = () => win.locator('.guia-burbuja');
/** El paso que dice la burbuja y el elemento que rodea el contorno */
async function enPaso(n: number, objetivo: string) {
  await expect(burbuja().locator('.guia-paso')).toHaveText(`Paso ${n} de 7`);
  const aro = win.locator('.guia-aro');
  await expect(aro).toHaveCount(1);
  await expect(aro.locator('.guia-aro-num')).toHaveText(String(n));
  // el contorno está alrededor del elemento señalado (se mide cada 150 ms y las ventanas entran con una animación corta)
  const el = win.locator(`[data-guia="${objetivo}"]`).first();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([aro.boundingBox({ timeout: 1000 }), el.boundingBox({ timeout: 1000 })]);
    return !!a && !!b && Math.abs(a.x + 5 - b.x) < 3 && Math.abs(a.y + 5 - b.y) < 3;
  }).toBe(true);
}

test('el aviso de la franja empieza la guía con el byte que usa el programa, y llega hasta el final', async () => {
  // el proyecto inicial ya trae el OB1
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText('      U     M 100.5\n      =     A 124.0');
  await win.locator('.explorer-foot').click();
  const aviso = win.locator('.load-status button', { hasText: 'Activarla paso a paso (MB100)' });
  await expect(aviso).toBeVisible();
  await aviso.click();
  await enPaso(1, 'hw-fila');
  await expect(burbuja()).toContainText('doble clic en Hardware');
  await win.locator('.ex-hw').dblclick();
  await enPaso(2, 'cpu-fila');
  await win.locator('.hwc-tabla tr', { hasText: 'CPU compacta' }).dblclick();
  await enPaso(3, 'tab-ciclo');
  await win.locator('.hwp-tab', { hasText: 'Ciclo/Marca de ciclo' }).click();
  await enPaso(4, 'check-ciclo');
  await win.locator('.modal label.check', { hasText: 'Marca de ciclo' }).locator('input').check();
  // con el byte que usa el programa: primero que lo escriba
  await enPaso(5, 'byte-ciclo');
  await expect(burbuja()).toContainText('Escribe 100');
  await win.locator('.modal input[aria-label="Byte de marcas"]').fill('100');
  await enPaso(5, 'aceptar');
  // si cancela, la guía vuelve atrás
  await win.locator('.modal-foot button', { hasText: 'Cancelar' }).click();
  await enPaso(2, 'cpu-fila');
  await win.locator('.hwc-tabla tr', { hasText: 'CPU compacta' }).dblclick();
  await win.locator('.hwp-tab', { hasText: 'Ciclo/Marca de ciclo' }).click();
  await win.locator('.modal label.check', { hasText: 'Marca de ciclo' }).locator('input').check();
  await win.locator('.modal input[aria-label="Byte de marcas"]').fill('100');
  await win.locator('.modal-foot button', { hasText: 'Aceptar' }).click();
  await enPaso(6, 'guardar');
  await win.locator('.vflot.hwc button[aria-label="Guardar y compilar"]').click();
  await enPaso(7, 'cargar');
  await win.locator('.vflot.hwc button[aria-label="Cargar en módulo"]').click();
  // hecho: sin contorno, y la marca de ciclo funciona
  await expect(burbuja().locator('.guia-paso')).toHaveText('¡Hecho!');
  await expect(burbuja()).toContainText('MB 100 ya funciona');
  await expect(win.locator('.guia-aro')).toHaveCount(0);
  await expect(win.locator('.lamp.on', { hasText: '124.0' })).toBeVisible({ timeout: 3000 });
  await burbuja().locator('button', { hasText: 'Cerrar' }).click();
  await expect(burbuja()).toHaveCount(0);
  await win.locator('.vflot.hwc .vflot-head button[aria-label="Cerrar"]').click();
  await expect(win.locator('.ex-hw')).toContainText('marca de ciclo MB 100');
});

test('el botón Hardware abre la ventana y la guía solo si la marca de ciclo no está cargada; se puede saltar', async () => {
  // ya está cargada: solo la ventana
  await win.locator('.wb-toolbar button', { hasText: 'Hardware' }).click();
  await expect(win.locator('.vflot.hwc')).toHaveCount(1);
  await expect(burbuja()).toHaveCount(0);
  await win.locator('.vflot.hwc .vflot-head button[aria-label="Cerrar"]').click();
  // proyecto nuevo, sin marca de ciclo: la ventana y la guía en el paso 2
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Guía');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.wb-toolbar button', { hasText: 'Hardware' }).click();
  await enPaso(2, 'cpu-fila');
  await burbuja().locator('button', { hasText: 'Saltar la guía' }).click();
  await expect(burbuja()).toHaveCount(0);
  await expect(win.locator('.guia-aro')).toHaveCount(0);
  await expect(win.locator('.vflot.hwc')).toHaveCount(1);
  await win.locator('.vflot.hwc .vflot-head button[aria-label="Cerrar"]').click();
});

test('desde la Ayuda; con el explorador oculto, primero señala el botón que lo muestra', async () => {
  await win.locator('.sidebar .nav-item', { hasText: 'Ayuda' }).click();
  await win.locator('.md a[href="#/simulador/guia-ciclo"]').click();
  await expect(win.locator('.sidebar .nav-item.active')).toContainText('Simulador libre');
  await enPaso(1, 'hw-fila');
  // el botón de ocultar el explorador se ve (antes quedaba debajo de la barra) y, oculto, la guía señala el que lo muestra
  await win.locator('.explorer-head button[aria-label="Ocultar el explorador"]').click();
  await expect(win.locator('.explorer')).toHaveCount(0);
  await enPaso(1, 'abrir-proyectos');
  await expect(burbuja()).toContainText('explorador de proyectos');
  await win.locator('.abrir-proyectos').click();
  await enPaso(1, 'hw-fila');
  // con Equipo(1) plegado, señala Equipo(1)
  await win.locator('[data-guia="equipo"]').click();
  await enPaso(1, 'equipo');
  await win.locator('[data-guia="equipo"]').click();
  await enPaso(1, 'hw-fila');
  await burbuja().locator('button[aria-label="Saltar la guía"]').click();
  await expect(burbuja()).toHaveCount(0);
  expect(errores).toEqual([]);
});

// ───────── Guía de la tabla de variables (0.29.1) ─────────

/** Paso de la guía de la tabla de variables (5 pasos) y el elemento que rodea el contorno */
async function enPasoVat(n: number, objetivo: string) {
  await expect(burbuja().locator('.guia-paso')).toHaveText(`Paso ${n} de 5`);
  const aro = win.locator('.guia-aro');
  await expect(aro.locator('.guia-aro-num')).toHaveText(String(n));
  const el = win.locator(`[data-guia="${objetivo}"]`).first();
  await expect.poll(async () => {
    const [a, b] = await Promise.all([aro.boundingBox({ timeout: 1000 }), el.boundingBox({ timeout: 1000 })]);
    return !!a && !!b && Math.abs(a.x + 5 - b.x) < 3 && Math.abs(a.y + 5 - b.y) < 3;
  }).toBe(true);
}

test('tabla de variables: el botón de abajo empieza la guía y señala el camino hasta ver los valores en vivo', async () => {
  // proyecto nuevo, sin tablas
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('VAT guía');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText('      U     E 124.0\n      =     A 124.0');
  await win.locator('.explorer-foot').click();
  await win.locator('.wb-bottom button', { hasText: '¿Tabla de variables?' }).click();
  await expect(burbuja()).toContainText('Abrir la tabla de variables');
  await enPasoVat(1, 'bloques');
  await win.locator('[data-guia="bloques"]').click({ button: 'right' });
  await enPasoVat(2, 'insertar-objeto');
  await win.locator('.menu button', { hasText: 'Insertar nuevo objeto' }).hover();
  await enPasoVat(3, 'nueva-vat');
  await win.locator('.menu .menu button', { hasText: 'Tabla de variables' }).click();
  // la ventana flotante: sin cuadrícula hasta pulsar las gafas
  await enPasoVat(4, 'vat-gafas');
  await win.locator('.vatf [data-guia="vat-gafas"]').click();
  await enPasoVat(5, 'vat-operando');
  await win.locator('.vatf td[data-f="0"][data-c="op"]').click();
  await win.keyboard.type('E 124.0');
  await win.keyboard.press('Enter');
  await expect(burbuja().locator('.guia-paso')).toHaveText('¡Hecho!');
  await expect(burbuja()).toContainText('VAT_1 ya muestra los valores en vivo');
  await expect(win.locator('.guia-aro')).toHaveCount(0);
  await burbuja().locator('button', { hasText: 'Cerrar' }).click();
  await expect(burbuja()).toHaveCount(0);
  // con la tabla ya creada y cerrada, enseña a abrirla
  await win.locator('.vatf .vatf-head button').last().click();
  await expect(win.locator('.vatf')).toHaveCount(0);
  await win.locator('.wb-bottom button', { hasText: '¿Tabla de variables?' }).click();
  await enPasoVat(3, 'vat-fila');
  await expect(burbuja()).toContainText('Ya tienes la tabla VAT_1');
  await win.locator('[data-guia="vat-fila"]').click();
  await expect(win.locator('.vatf')).toHaveCount(1);
  await expect(burbuja().locator('.guia-paso')).not.toHaveText('Paso 3 de 5');
  await burbuja().locator('button[aria-label]').first().click();
  await expect(burbuja()).toHaveCount(0);
});

test('tabla de variables: desde la Ayuda; y empezar una guía cierra la otra', async () => {
  await win.locator('.sidebar .nav-item', { hasText: 'Ayuda' }).click();
  await win.locator('.md a[href="#/simulador/guia-vat"]').click();
  await expect(win.locator('.sidebar .nav-item.active')).toContainText('Simulador libre');
  await expect(burbuja()).toContainText('Abrir la tabla de variables');
  // la del Hardware sustituye a la de la tabla
  await win.locator('.wb-toolbar button', { hasText: 'Hardware' }).click();
  await expect(burbuja()).toHaveCount(1);
  await expect(burbuja()).toContainText('Activar la marca de ciclo');
  await burbuja().locator('button', { hasText: 'Saltar la guía' }).click();
  await expect(burbuja()).toHaveCount(0);
  await win.locator('.vflot.hwc .vflot-head button[aria-label="Cerrar"]').click();
  expect(errores).toEqual([]);
});
