// Tabla de variables («Var - VAT_n») dentro de la app: ventana flotante encima de todo, o abajo junto a las señales.
// Clic derecho en OB1 → Insertar nuevo objeto → Tabla de variables
import { test, expect, _electron as electron, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

async function arrancar(nombre: string, codigo: string) {
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
  await win.locator('.modal input').fill(nombre);
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText(codigo);
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(800);
  const fin = async () => { await app.close(); fs.rmSync(userData, { recursive: true, force: true }); };
  return { app, win, errores, fin };
}

/** Clic derecho en OB1 → Insertar nuevo objeto → Tabla de variables: se abre en una ventana flotante dentro de la app */
async function insertarVat(win: Page) {
  await win.locator('.ex-block', { hasText: 'OB1' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Insertar nuevo objeto' }).click();
  await win.locator('.menu .menu button', { hasText: 'Tabla de variables' }).click();
  const h = win.locator('.vatf');
  await expect(h.locator('.vatw-menubar')).toBeVisible();
  return h;
}

/** La tabla dentro de `h` (la ventana flotante o el panel de abajo) */
const tabla = (win: Page, h: Locator) => {
  const celda = (f: number, c: string) => h.locator(`td[data-f="${f}"][data-c="${c}"]`);
  return {
    celda,
    valor: (f: number) => celda(f, 'val'),
    lentes: h.locator('button[aria-label="Observar variable"]'),
    /** Escribe en una celda: clic para seleccionarla y teclear (empezar a escribir edita en el sitio) */
    escribir: async (f: number, c: string, texto: string) => {
      await celda(f, c).click();
      await win.keyboard.type(texto);
      await win.keyboard.press('Enter');
    },
    formato: async (f: number, fmt: string) => {
      await celda(f, 'fmt').click();
      await win.keyboard.press('Enter');
      await win.locator('.menu button', { hasText: new RegExp(`^${fmt}$`) }).click();
    },
  };
};
/** Clic en la primera línea del código, por la izquierda (lo que no tapa la ventana flotante) */
const alCodigo = (win: Page) => win.locator('.cm-line').first().click({ position: { x: 10, y: 5 } });

const CONTADOR = `U E 124.0
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

test('tabla de variables: ventana dentro de la app, se queda a la vista al escribir código, pasa abajo y vuelve', async () => {
  test.setTimeout(120_000);
  const { app, win, errores, fin } = await arrancar('Contadores', CONTADOR);
  // a la derecha no están «Variables» ni «T / Z»
  await expect(win.locator('.wb-right .tab')).toHaveText(['E/S', 'CPU', 'Símbolos']);
  const h = await insertarVat(win);
  await expect(win.locator('.ex-block', { hasText: 'VAT_1' })).toHaveCount(1);
  expect(app.windows().length).toBe(1); // ninguna ventana del sistema
  await expect(h.locator('.vatf-head .tit')).toHaveText('Var - VAT_1');
  const t = tabla(win, h);

  // el área está vacía hasta pulsar las lentes; la tabla empieza con los contadores del programa
  await expect(h.locator('.vatw-sub')).toHaveCount(0);
  await t.lentes.click();
  await expect(t.lentes).toHaveAttribute('aria-pressed', 'true');
  await expect(t.celda(0, 'op')).toHaveText('Z  0');
  await expect(t.valor(0)).toHaveText('C#0');

  // teclas 1 y 8: ZV y ZR con la tabla a la vista
  await win.locator('.explorer-foot').click();
  for (let i = 0; i < 3; i++) { await win.keyboard.press('Digit1'); await win.waitForTimeout(120); await win.keyboard.press('Digit1'); await win.waitForTimeout(120); }
  await expect(t.valor(0)).toHaveText('C#3');
  await win.keyboard.press('Digit8'); await win.waitForTimeout(120); await win.keyboard.press('Digit8');
  await expect(t.valor(0)).toHaveText('C#2');

  // escribir código no la esconde: sigue encima y leyendo
  await alCodigo(win);
  await win.keyboard.press('End');
  await win.keyboard.type(' // contador');
  await expect(win.locator('.cm-line').first()).toContainText('// contador');
  await expect(h).toBeVisible();
  await expect(t.lentes).toHaveAttribute('aria-pressed', 'true');

  // añadir A 124.0 y escribir Z 0 = C#10 una vez (Activar valores de forzado)
  await t.escribir(1, 'op', 'a124.0');
  await expect(t.celda(1, 'op')).toHaveText('A  124.0');
  await expect(t.celda(1, 'fmt')).toHaveText('BOOL');
  await expect(t.valor(1)).toHaveText('true');
  await t.escribir(0, 'forz', 'C#10');
  await h.locator('button[aria-label="Activar valores de forzado (una escritura)"]').click();
  await expect(t.valor(0)).toHaveText('C#10');

  // la ventana se mueve por la app arrastrando su barra de título
  const antes = (await h.boundingBox())!;
  const cab = (await h.locator('.vatf-head .tit').boundingBox())!;
  await win.mouse.move(cab.x + 30, cab.y + 8);
  await win.mouse.down();
  await win.mouse.move(cab.x - 170, cab.y - 92, { steps: 4 });
  await win.mouse.up();
  const despues = (await h.boundingBox())!;
  expect(Math.round(antes.x - despues.x)).toBe(200);
  expect(Math.round(antes.y - despues.y)).toBe(100);

  // abajo, junto a las señales: misma tabla y sigue observando
  await h.locator('button[aria-label="Acoplar abajo, junto a las señales"]').click();
  await expect(win.locator('.vatf')).toHaveCount(0);
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_1' })).toHaveClass(/active/);
  const abajo = tabla(win, win.locator('.wb-bottom .vatw'));
  await expect(abajo.lentes).toHaveAttribute('aria-pressed', 'true');
  await expect(win.locator('.wb-bottom td[data-c="op"]')).toHaveText(['Z  0', 'A  124.0', '']);
  await win.locator('.explorer-foot').click();
  await win.keyboard.press('Digit4'); await win.waitForTimeout(120); await win.keyboard.press('Digit4'); // R Z0
  await expect(abajo.valor(0)).toHaveText('C#0');
  await expect(abajo.valor(1)).toHaveText('false');
  // y otra vez a ventana
  await win.locator('.wb-bottom button[aria-label="Abrir como ventana"]').click();
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_1' })).toHaveCount(0);
  await expect(t.lentes).toHaveAttribute('aria-pressed', 'true');
  await expect(t.valor(0)).toHaveText('C#0');

  // minimizar deja solo la barra de título; cerrar y volver a abrirla desde el explorador
  await h.locator('.vatf-head button[aria-label="Minimizar"]').click();
  await expect(h.locator('.vatw')).toHaveCount(0);
  await win.locator('.ex-block', { hasText: 'VAT_1' }).click();
  await expect(h.locator('.vatw')).toHaveCount(1);
  await h.locator('.vatf-head button[aria-label="Cerrar la tabla de variables"]').click();
  await expect(win.locator('.vatf')).toHaveCount(0);

  // se guarda con el proyecto
  await win.reload();
  await win.waitForTimeout(1200);
  await win.locator('.ex-block', { hasText: 'VAT_1' }).click();
  await tabla(win, win.locator('.vatf')).lentes.click();
  await expect(win.locator('.vatf td[data-c="op"]')).toHaveText(['Z  0', 'A  124.0', '']);
  await expect(tabla(win, win.locator('.vatf')).celda(0, 'forz')).toHaveText('C#10');

  // la última que se eligió fue «ventana»; al acoplar, la siguiente tabla se abre abajo
  await win.locator('.vatf button[aria-label="Acoplar abajo, junto a las señales"]').click();
  await win.locator('.ex-folder', { hasText: 'Contadores' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Crear tabla de variables (VAT_2)' }).click();
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_2' })).toHaveClass(/active/);
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_1' })).toHaveCount(1);
  // borrar VAT_2 en el explorador la cierra
  win.once('dialog', (d) => d.accept());
  await win.locator('.ex-block', { hasText: 'VAT_2' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Borrar VAT_2' }).click();
  await expect(win.locator('.wb-bottom .tab', { hasText: 'VAT_2' })).toHaveCount(0);
  expect(app.windows().length).toBe(1);
  expect(errores).toEqual([]);
  await fin();
});

// Criterios de aceptación de la especificación de la ventana, con un programa que da los mismos valores:
// MW 110 = 30, MD 100 = MD 30 / 2 y MW 120 cuenta los ciclos (para ver si se refresca)
const CODIGO_ESPEC = `L 30
T MW 110
L MW 120
L 1
+I
T MW 120
L MD 30
L 2.0
/R
T MD 100
`;

test('tabla de variables: lentes, formatos, forzado y subventana como en la especificación', async () => {
  test.setTimeout(120_000);
  const { win, errores, fin } = await arrancar('Proyecto 12_3er', CODIGO_ESPEC);
  const h = await insertarVat(win);
  const t = tabla(win, h);

  // 9 menús, dos barras (14 + 6 botones) y el área vacía
  await expect(h.locator('.vatw-menubar > button')).toHaveText(['Tabla', 'Edición', 'Insertar', 'Sistema de destino', 'Variable', 'Ver', 'Herramientas', 'Ventana', 'Ayuda']);
  await expect(h.locator('.vatw-tools').nth(0).locator('button')).toHaveCount(14);
  await expect(h.locator('.vatw-tools').nth(1).locator('button')).toHaveCount(6);
  await expect(h.locator('.vatw-sub')).toHaveCount(0);
  await expect(h.locator('.vatw-status')).toContainText('Proyecto 12_3er');
  await expect(h.locator('.vatw-status .cpu')).toHaveText('RUN');

  // lentes: la subventana con su título exacto (dos espacios antes de ONLINE)
  await t.lentes.click();
  expect(await h.locator('.vatw-sub-head .tit').textContent()).toBe('VAT_1 -- @Proyecto 12_3er  ONLINE');
  await t.escribir(0, 'op', 'mw 110');
  await t.escribir(1, 'op', 'md 30');
  await t.escribir(2, 'op', 'md 100');
  await t.escribir(3, 'op', 'mw 120');
  await expect(h.locator('td[data-c="op"]')).toHaveText(['MW  110', 'MD  30', 'MD  100', 'MW  120', '']);
  await expect(t.valor(0)).toHaveText('W#16#001E');
  await t.formato(1, 'REAL');
  await t.formato(2, 'REAL');
  // valores de la captura: se escribe 53.56 en MD 30 y el programa calcula MD 100
  await t.escribir(1, 'forz', '53.56');
  await h.locator('button[aria-label="Activar valores de forzado (una escritura)"]').click();
  await expect(t.valor(1)).toHaveText('53.56');
  await expect(t.valor(2)).toHaveText('26.78');
  // formato de la fila 2 en HEX, y la lista solo deja los que encajan
  await t.celda(1, 'fmt').click();
  await win.keyboard.press('Enter');
  await expect(win.locator('.menu button[disabled]')).toHaveText(['BOOL', 'S5TIME']);
  await win.locator('.menu button', { hasText: /^HEX$/ }).click();
  await expect(t.valor(1)).toHaveText('DW#16#42563D71');
  await t.formato(1, 'REAL');
  // 60.0 con «Activar valores de forzado»: MD 30 = 60 y MD 100 = 30
  await t.celda(1, 'forz').dblclick();
  await win.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await win.keyboard.type('60.0');
  await win.keyboard.press('Enter');
  await h.locator('button[aria-label="Activar valores de forzado (una escritura)"]').click();
  await expect(t.valor(1)).toHaveText('60.0');
  await expect(t.valor(2)).toHaveText('30.0');

  // «md 200» en la última fila: MD  200, HEX, DW#16#00000000 y una fila vacía más
  await t.escribir(4, 'op', 'md 200');
  await expect(t.celda(4, 'op')).toHaveText('MD  200');
  await expect(t.celda(4, 'fmt')).toHaveText('HEX');
  await expect(t.valor(4)).toHaveText('DW#16#00000000');
  await expect(h.locator('.vatw-grid tbody tr')).toHaveCount(6);
  // un operando no válido sale en rojo y no se lee
  await t.escribir(5, 'op', 'XY 3');
  await expect(t.celda(5, 'op').locator('.err-text')).toHaveText('XY 3');
  await expect(t.valor(5)).toHaveText('');

  // segundo clic en las lentes: deja de refrescar (MW 120 cuenta los ciclos)
  const v0 = await t.valor(3).textContent();
  await expect.poll(async () => t.valor(3).textContent(), { timeout: 3000 }).not.toBe(v0);
  await t.lentes.click();
  await expect(t.lentes).toHaveAttribute('aria-pressed', 'false');
  const quieto = await t.valor(3).textContent();
  await win.waitForTimeout(1300);
  await expect(t.valor(3)).toHaveText(quieto!);

  // forzar (rayo): mientras está pulsado, MW 110 = W#16#00FF aunque el programa escriba 30; al soltarlo vuelve
  await t.lentes.click();
  await t.escribir(0, 'forz', 'W#16#00FF');
  const rayo = h.locator('button[aria-label^="Forzar variable"]');
  await rayo.click();
  await expect(rayo).toHaveAttribute('aria-pressed', 'true');
  await expect(t.valor(0)).toHaveText('W#16#00FF');
  await expect(h.locator('td.ind .vatw-f').first()).toBeVisible();
  await rayo.click();
  await expect(t.valor(0)).toHaveText('W#16#001E');
  await expect(h.locator('td.ind .vatw-f')).toHaveCount(0);

  // la subventana se mueve, se maximiza, se minimiza y se cierra dentro del área; las lentes la reabren con las mismas filas
  const sub = h.locator('.vatw-sub');
  const antes = (await sub.boundingBox())!;
  const cab = (await h.locator('.vatw-sub-head .tit').boundingBox())!;
  await win.mouse.move(cab.x + 40, cab.y + 8);
  await win.mouse.down();
  await win.mouse.move(cab.x + 140, cab.y + 58, { steps: 4 });
  await win.mouse.up();
  const despues = (await sub.boundingBox())!;
  expect(Math.round(despues.x - antes.x)).toBe(100);
  expect(Math.round(despues.y - antes.y)).toBe(50);
  await h.locator('.vatw-sub-head button[aria-label="Maximizar"]').click();
  await expect(sub).toHaveClass(/max/);
  await h.locator('.vatw-sub-head button[aria-label="Restaurar"]').click();
  await h.locator('.vatw-sub-head button[aria-label="Minimizar"]').click();
  await expect(sub).toHaveClass(/min/);
  await expect(h.locator('.vatw-grid')).toHaveCount(0);
  await h.locator('.vatw-sub-head button[aria-label="Cerrar la tabla"]').click();
  await expect(sub).toHaveCount(0);
  await expect(t.lentes).toHaveAttribute('aria-pressed', 'false');
  await t.lentes.click();
  await expect(h.locator('td[data-c="op"]')).toHaveText(['MW  110', 'MD  30', 'MD  100', 'MW  120', 'MD  200', 'XY 3', '']);
  await expect(t.valor(0)).toHaveText('W#16#001E');
  // Valor de forzado queda cortado: hay desplazamiento horizontal
  expect(await h.locator('.vatw-sub-body').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);

  // sin enlace: sin «ONLINE», sin valores y las lentes avisan
  await h.locator('button[aria-label="Deshacer enlace"]').click();
  expect(await h.locator('.vatw-sub-head .tit').textContent()).toBe('VAT_1 -- @Proyecto 12_3er');
  await expect(t.valor(0)).toHaveText('');
  await expect(h.locator('.vatw-status .cpu')).toHaveText('');
  await t.lentes.click({ force: true }); // se ve desactivado, pero responde con el aviso
  await expect(win.locator('#toast')).toHaveText('No hay enlace con la CPU');
  await h.locator('button[aria-label="Establecer enlace con la CPU configurada"]').click();
  await t.lentes.click();
  await expect(t.valor(0)).toHaveText('W#16#001E');

  // deshacer (menú Edición): primero el valor de forzado de la fila 1 y luego la fila «XY 3»
  const deshacer = async () => {
    await h.locator('.vatw-menubar button', { hasText: 'Edición' }).click();
    await win.locator('.menu button', { hasText: 'Deshacer' }).click();
  };
  await deshacer();
  await expect(t.celda(0, 'forz')).toHaveText('');
  await deshacer();
  await expect(h.locator('td[data-c="op"]')).toHaveText(['MW  110', 'MD  30', 'MD  100', 'MW  120', 'MD  200', '']);
  // ⌘Z / Ctrl+Z con el foco en la tabla deshace en la tabla, no en el programa
  const awl = () => win.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('automatizacion.v1.projects') ?? '{}') as { state: { proyectos: { nombre: string; programa: { bloques: { segmentos: { awl?: string }[] }[] } }[] } };
    return d.state.proyectos.find((p) => p.nombre === 'Proyecto 12_3er')!.programa.bloques[0].segmentos[0].awl;
  });
  const codigo = await awl();
  await t.celda(0, 'op').click();
  await win.keyboard.press(process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z');
  await expect(h.locator('td[data-c="op"]')).toHaveText(['MW  110', 'MD  30', 'MD  100', 'MW  120', '']);
  expect(await awl()).toBe(codigo);
  expect(errores).toEqual([]);
  await fin();
});
