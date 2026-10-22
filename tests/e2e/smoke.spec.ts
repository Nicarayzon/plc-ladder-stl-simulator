// Pruebas de extremo a extremo sobre la app compilada (npm run build) en Electron
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const banco = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../src/content/banco_ejercicios.json'), 'utf-8'));

let app: ElectronApplication;
let win: Page;
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-e2e-'));

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_USER_DATA: userData } });
  win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
});
test.afterAll(async () => {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const goto = async (route: string) => {
  await win.evaluate((r) => { window.location.hash = `#/${r}`; }, route);
  await win.waitForTimeout(600);
};

test('arranca en el simulador libre sin los modos de práctica', async () => {
  await expect(win.locator('.sidebar')).not.toContainText('Examen');
  await expect(win.locator('.sidebar')).not.toContainText('Predice');
  await expect(win.locator('.sidebar .nav-item.active')).toContainText('Simulador libre');
  await goto('examen');
  await expect(win.locator('h1')).toHaveText('Sección desactivada');
});

test('inicio y versión', async () => {
  await goto('inicio');
  const { version } = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../package.json'), 'utf-8'));
  expect(version).toBe('0.22.0');
  await expect(win.locator('.brand')).toContainText(`v${version}`);
  await expect(win.locator('h1')).toHaveText('Automatizacion');
});

test('ajustes: el tema se elige con el desplegable propio', async () => {
  await goto('ajustes');
  // ningún <select> nativo: con Wine su lista no sale
  await expect(win.locator('.main select')).toHaveCount(0);
  const tema = win.locator('button[aria-label="Tema"]');
  await expect(tema).toHaveText('Como el sistema', { useInnerText: true });
  const elegir = async (t: string) => { await tema.click(); await win.locator('.menu button', { hasText: t }).click(); await expect(win.locator('.menu')).toHaveCount(0); };
  await elegir('Claro');
  expect(await win.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
  await elegir('Oscuro');
  expect(await win.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  await elegir('Como el sistema');
  expect(await win.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBeNull();
  await expect(tema).toHaveText('Como el sistema', { useInnerText: true });
});

test('la barra de la izquierda se pliega a iconos y se recuerda', async () => {
  await goto('simulador');
  const ancho = async () => (await win.locator('.sidebar').boundingBox())!.width;
  expect(await ancho()).toBeGreaterThan(150);
  await win.locator('.sidebar button[aria-label="Ocultar la barra"]').click();
  expect(await ancho()).toBeLessThan(60);
  await expect(win.locator('.sidebar .nav-item', { hasText: 'Ajustes' })).toHaveCount(0);
  await win.locator('.sidebar .nav-item[aria-label="Ajustes"]').click();
  await expect(win.locator('h1')).toHaveText('Ajustes');
  await win.reload();
  await win.waitForTimeout(800);
  expect(await ancho()).toBeLessThan(60);
  await win.locator('.sidebar button[aria-label="Mostrar la barra"]').click();
  expect(await ancho()).toBeGreaterThan(150);
  await expect(win.locator('.sidebar .nav-item', { hasText: 'Ajustes' })).toHaveCount(1);
});

test('E12: el ejemplo pasa sus pruebas', async () => {
  await goto('ejercicio/E12/ejemplos');
  await win.locator('button', { hasText: 'Comprobar' }).click();
  await expect(win.locator('.grade.ok')).toContainText('¡Correcto!', { timeout: 20000 });
});

test('simulador libre: proyectos, OB1, interruptores E124 y teclas', async () => {
  await goto('simulador');
  // proyecto inicial vacío, sin ejemplos; E124.0–E124.7 y A124.0–A124.7 siempre
  await expect(win.locator('.explorer')).toContainText('Proyecto 1');
  await expect(win.locator('.sw-row').nth(0).locator('.sw-addr')).toHaveText(['124.0', '124.1', '124.2', '124.3', '124.4', '124.5', '124.6', '124.7']);
  const salidas = win.locator('.panel-sec', { hasText: 'Salidas' }).locator('.sw-row');
  await expect(salidas.nth(0).locator('.sw-addr')).toHaveText(['124.0', '124.1', '124.2', '124.3', '124.4', '124.5', '124.6', '124.7']);
  await expect(salidas.nth(1).locator('.sw-addr')).toHaveText(['125.0', '125.1', '125.2', '125.3', '125.4', '125.5', '125.6', '125.7']);
  // segunda fila E125.0–E125.7 (solo con el ratón)
  await expect(win.locator('.sw-row').nth(1).locator('.sw-addr')).toHaveText(['125.0', '125.1', '125.2', '125.3', '125.4', '125.5', '125.6', '125.7']);
  // quitar una salida con clic derecho y recuperarla
  await win.locator('.lamp', { hasText: '124.7' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Quitar A124.7 del panel' }).click();
  await expect(win.locator('.lamp', { hasText: '124.7' })).toHaveCount(0);
  await win.locator('button', { hasText: 'Mostrar salidas quitadas (1)' }).click();
  await expect(win.locator('.lamp', { hasText: '124.7' })).toHaveCount(1);
  await expect(win.locator('body')).not.toContainText('Motor');
  // proyecto nuevo con nombre y OB1 dentro
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Cintas');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await expect(win.locator('.load-status')).toContainText('Falta el OB1');
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await expect(win.locator('.ex-block.cur')).toContainText('OB1');
  await win.locator('.cm-content').first().click();
  const code = ['U E 125.6', 'S M 10.0', 'U E 125.7', 'R M 10.0', 'U M 10.0', '= A 125.7', 'U M 10.0', 'U E 124.0', 'S M 20.0',
    'U E 124.3', 'ON M 10.0', 'R M 20.0', 'U M 20.0', '= A 124.0'];
  for (const l of code) { await win.keyboard.type(l); await win.keyboard.press('Enter'); }
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(800);
  await expect(win.locator('.load-status')).toContainText('Programa cargado');
  // Mayús + clic = pulsador (1 solo mientras se mantiene)
  const pulse = async (addr: string) => {
    const b = win.locator('.sw', { hasText: addr });
    await b.dispatchEvent('mousedown', { button: 0, shiftKey: true });
    await win.waitForTimeout(60);
    await b.dispatchEvent('mouseup', { button: 0 });
    await win.waitForTimeout(250);
  };
  await pulse('124.0');
  await expect(win.locator('.lamp.on', { hasText: '124.0' })).toHaveCount(0);
  // la tecla 7 es E124.6, no toca la fila E125
  await win.keyboard.press('Digit7');
  await expect(win.locator('.sw.on .sw-addr')).toHaveText(['124.6']);
  await win.keyboard.press('Digit7');
  await pulse('125.6');
  await expect(win.locator('.lamp.on', { hasText: '125.7' })).toBeVisible();
  await expect(win.locator('.sw.on')).toHaveCount(0);
  // marcas: una fila por byte (M 10) con sus 8 bits
  const marcas = win.locator('.panel-sec', { hasText: 'Marcas' });
  await expect(marcas.locator('.sw-cap')).toHaveText(['M 10', 'M 20']);
  await expect(marcas.locator('.sw-row').first().locator('.sw-addr')).toHaveText(['10.0', '10.1', '10.2', '10.3', '10.4', '10.5', '10.6', '10.7']);
  await expect(marcas.locator('.lamp.on', { hasText: '10.0' })).toBeVisible();
  await expect(win.locator('.cm-line', { hasText: 'S M 10.0' }).locator('.cm-val.on')).toHaveText('1');
  await pulse('124.0');
  await expect(win.locator('.lamp.on', { hasText: '124.0' })).toBeVisible();
  await pulse('125.7');
  await expect(win.locator('.lamp.on')).toHaveCount(0);
  // tecla 2 = interruptor E124.1 (se queda), otra vez = baja
  await win.keyboard.press('Digit2');
  await expect(win.locator('.sw.on', { hasText: '124.1' })).toBeVisible();
  await win.keyboard.press('Digit2');
  await expect(win.locator('.sw.on')).toHaveCount(0);
  // hardware: CPU con marca de ciclo en MB0 → M0.5 (1 s) parpadea en A124.6
  await win.locator('button', { hasText: 'Hardware' }).click();
  await win.locator('.modal button', { hasText: 'CPU compacta' }).click();
  await expect(win.locator('.hw-table tbody tr')).toHaveCount(8);
  await expect(win.locator('.hw-table tbody tr').nth(3)).toContainText('0,5 s');
  await win.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.press('Meta+ArrowDown');
  await win.keyboard.press('Enter');
  await win.keyboard.type('U M 0.5'); await win.keyboard.press('Enter');
  await win.keyboard.type('= A 124.6'); await win.keyboard.press('Enter');
  await win.locator('.explorer-foot').click();
  const vistos = new Set<number>();
  for (let i = 0; i < 16; i++) { await win.waitForTimeout(100); vistos.add(await win.locator('.lamp.on', { hasText: '124.6' }).count()); }
  expect([...vistos].sort()).toEqual([0, 1]);
  // fila de la marca de ciclo: solo los bits que usa el programa (M 0.5), en su columna
  const filaCiclo = win.locator('.panel-sec', { hasText: 'Marcas' }).locator('.sw-row').first();
  await expect(win.locator('.panel-sec', { hasText: 'Marcas' }).locator('.sw-cap').first()).toHaveText('M 0 · marca de ciclo');
  await expect(filaCiclo.locator('.sw-addr')).toHaveText(['0.5']);
  await expect(filaCiclo.locator('.lamp')).toHaveCSS('grid-column-start', '6');
  // quitar la marca de ciclo en Hardware: MB0 vuelve a 0 y no se queda ningún bit encendido
  await win.locator('.wb-toolbar button', { hasText: 'Hardware' }).click();
  await win.locator('.modal label.check', { hasText: 'Marca de ciclo' }).locator('input').uncheck();
  await win.locator('.modal-foot button', { hasText: 'Cerrar' }).click();
  await expect(win.locator('.panel-sec', { hasText: 'Marcas' }).locator('.sw-cap').first()).toHaveText('M 0');
  for (let i = 0; i < 12; i++) {
    await expect(filaCiclo.locator('.lamp.on')).toHaveCount(0);
    await win.waitForTimeout(100);
  }
  // paso a paso: la pila se ve en la pestaña CPU
  await win.locator('button', { hasText: 'Instr.' }).click();
  await win.locator('button', { hasText: 'Instr.' }).click();
  await win.locator('.wb-right .tab', { hasText: 'CPU' }).click();
  await expect(win.locator('.wb-right')).toContainText('Instrucción siguiente');
  await win.locator('.wb-right .tab', { hasText: 'E/S' }).click();
});

// Modos de práctica y evaluación desactivados (src/features.ts → PRACTICA_ACTIVA = false)
test.skip('T01: traza correcta', async () => {
  await goto('ejercicio/T01/traza');
  const filas = (banco as any).ejercicios.find((e: any) => e.id === 'T01').traza.filas as Record<string, number | string>[];
  const rows = win.locator('table.trace-tbl tbody tr');
  for (let i = 0; i < filas.length; i++) {
    const cells = rows.nth(i).locator('button.cell01');
    const cols = ['er_antes', 'sta', 'rlo', 'or'].filter((c) => filas[i][c] !== undefined);
    // las columnas aparecen en el orden /ER, RLO, STA, OR
    const order = ['er_antes', 'rlo', 'sta', 'or'].filter((c) => cols.includes(c));
    for (let j = 0; j < order.length; j++) {
      const v = Number(filas[i][order[j]]);
      await cells.nth(j).click(); // ? → 0
      if (v === 1) await cells.nth(j).click(); // 0 → 1
    }
  }
  await win.locator('button', { hasText: 'Comprobar' }).click();
  await expect(win.locator('.grade.ok')).toContainText('¡Correcto!');
});

test.skip('teoría: cinco preguntas', async () => {
  await goto('teoria');
  const qs = ((banco as any).ejercicios.find((e: any) => e.id === 'M01').preguntas as { opciones: string[]; correcta: number }[]).slice(0, 5);
  for (const q of qs) {
    const correct = q.opciones[q.correcta].replace(/`/g, '').trim();
    const exact = new RegExp(`^\\s*${correct.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    await win.locator('.quiz-opt').filter({ hasText: exact }).first().click();
    await expect(win.locator('.card')).toContainText('¡Correcto!');
    await win.locator('button', { hasText: 'Siguiente' }).click();
  }
});

test.skip('examen de 5 preguntas: se completa y se corrige', async () => {
  await goto('examen');
  await win.locator('input[type=range]').fill('5');
  await win.locator('button', { hasText: 'Empezar el examen' }).click();
  win.once('dialog', (d) => d.accept());
  await win.locator('button', { hasText: 'Entregar' }).click();
  await expect(win.locator('.badge', { hasText: 'Nota:' })).toBeVisible({ timeout: 30000 });
});

test('el progreso se conserva al recargar', async () => {
  await win.reload();
  await win.waitForTimeout(800);
  await goto('ejemplos');
  await expect(win.locator('.list-row', { hasText: 'E12' })).toContainText('✔');
});
