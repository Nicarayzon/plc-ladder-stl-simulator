// Tabla de variables: clic derecho en OB1 → Insertar nuevo objeto → Tabla de variables; se abre abajo, junto a las señales
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

const CODIGO = `U E 124.0
ZV Z0

U E 124.7
ZR Z0

U E 124.4
L C# 10
S Z0

U E 124.3
R Z0

U Z0
= A 124.0
`;

test('tabla de variables: crear desde OB1, contar con las teclas, modificar y guardar con el proyecto', async () => {
  test.setTimeout(120_000);
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-vat-'));
  const app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_USER_DATA: userData } });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  const errores: string[] = [];
  win.on('pageerror', (e) => errores.push(String(e)));
  win.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await win.evaluate(() => { window.location.hash = '#/simulador'; });
  await win.waitForTimeout(800);
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Contadores');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText(CODIGO);
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(800);

  // a la derecha ya no están «Variables» ni «T / Z»
  await expect(win.locator('.wb-right .tab')).toHaveText(['E/S', 'CPU', 'Símbolos']);

  // clic derecho en OB1 → Insertar nuevo objeto → Tabla de variables
  await win.locator('.ex-block', { hasText: 'OB1' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Insertar nuevo objeto' }).click();
  await win.locator('.menu .menu button', { hasText: 'Tabla de variables' }).click();
  await expect(win.locator('.menu')).toHaveCount(0);
  await expect(win.locator('.ex-block', { hasText: 'VAT_1' })).toHaveCount(1);

  // se abre abajo con los contadores del programa
  const tab = win.locator('.wb-bottom .tab', { hasText: 'VAT_1' });
  await expect(tab).toHaveClass(/active/);
  await expect(win.locator('.wb-bottom.collapsed')).toHaveCount(0);
  const fila = (op: string) => win.locator('.wb-bottom .vat tbody tr', { hasText: op });
  const valor = (op: string) => fila(op).locator('td.val');
  await expect(win.locator('.wb-bottom .vat tbody tr')).toHaveCount(1);
  await expect(valor('Z 0')).toHaveText('C#0');

  // teclas 1 y 8: ZV y ZR con la tabla a la vista
  await win.locator('.explorer-foot').click();
  for (let i = 0; i < 3; i++) { await win.keyboard.press('Digit1'); await win.waitForTimeout(120); await win.keyboard.press('Digit1'); await win.waitForTimeout(120); }
  await expect(valor('Z 0')).toHaveText('C#3');
  await win.keyboard.press('Digit8'); await win.waitForTimeout(120); await win.keyboard.press('Digit8');
  await expect(valor('Z 0')).toHaveText('C#2');
  // también con otra pestaña a la derecha
  await win.locator('.wb-right .tab', { hasText: 'CPU' }).click();
  await win.locator('.explorer-foot').click();
  await win.keyboard.press('Digit1'); await win.waitForTimeout(120); await win.keyboard.press('Digit1');
  await expect(valor('Z 0')).toHaveText('C#3');
  await win.locator('.wb-right .tab', { hasText: 'E/S' }).click();

  // añadir A 124.0 (con sugerencias del programa) y modificar Z 0
  const sugerencias = await win.locator('.wb-bottom datalist option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(sugerencias).toContain('A 124.0');
  expect(sugerencias).not.toContain('Z 0');
  await win.locator('.wb-bottom input[aria-label="Operando nuevo"]').fill('A 124.0');
  await win.locator('.wb-bottom button', { hasText: 'Añadir' }).click();
  await expect(valor('A 124.0')).toHaveText('1');
  await fila('Z 0').locator('input[aria-label="Nuevo valor"]').fill('C#10');
  await fila('Z 0').locator('button', { hasText: 'Modificar' }).click();
  await expect(valor('Z 0')).toHaveText('C#10');
  await win.keyboard.press('Digit4'); await win.waitForTimeout(120); await win.keyboard.press('Digit4'); // R Z0
  await expect(valor('Z 0')).toHaveText('C#0');
  await expect(valor('A 124.0')).toHaveText('0');

  // ir a las señales y volver desde el explorador
  await win.locator('.wb-bottom .tab', { hasText: 'Señales E/S' }).click();
  await expect(win.locator('.wb-bottom .vat')).toHaveCount(0);
  await win.locator('.ex-block', { hasText: 'VAT_1' }).click();
  await expect(tab).toHaveClass(/active/);

  // se guarda con el proyecto
  await win.reload();
  await win.waitForTimeout(1200);
  await win.locator('.ex-block', { hasText: 'VAT_1' }).click();
  await expect(win.locator('.wb-bottom .vat tbody tr')).toHaveCount(2);

  // una segunda tabla desde el menú de la carpeta: VAT_2
  await win.locator('.ex-folder', { hasText: 'Contadores' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Crear tabla de variables (VAT_2)' }).click();
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_2' })).toHaveClass(/active/);
  expect(errores).toEqual([]);
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});
