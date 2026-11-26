// Biblioteca estándar (FC 82 RSET, FC 83 SSET) y configuración del hardware desde el explorador
import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));

let app: ElectronApplication;
let win: Page;
const errores: string[] = [];
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-bib-'));

test.beforeAll(async () => {
  app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_IDIOMA: 'es', AUTOMATIZACION_USER_DATA: userData } });
  win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  win.on('pageerror', (e) => errores.push(String(e)));
  win.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await win.evaluate(() => { window.location.hash = '#/simulador'; });
  await win.waitForTimeout(800);
});
test.afterAll(async () => {
  await app.close();
  fs.rmSync(userData, { recursive: true, force: true });
});

const lampsOn = (desde: number, hasta: number) => Promise.all(Array.from({ length: hasta - desde + 1 }, (_, i) => win.locator('.lamp.on', { hasText: `124.${desde + i}` }).count())).then((v) => v.join(''));

test('FC 82 y FC 83: sin ellos, aviso y STOP; arrastrados desde la biblioteca, funcionan', async () => {
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Zonas');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  // árbol: Equipo(1) ▸ Hardware y Bloques
  await expect(win.locator('.ex-sub', { hasText: 'Equipo(1)' })).toHaveCount(1);
  await expect(win.locator('.ex-hw')).toContainText('Hardware');
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText([
    '      U     E 124.0',
    '      SPBN  m1',
    '      CALL  FC 83',
    '        S_BIT := A 124.0',
    '        N     := 5',
    'm1:   U     E 124.7',
    '      SPBN  FIN',
    '      CALL  FC 82',
    '        S_BIT := P#A 124.0',
    '        N     := 5',
    'FIN:  NOP 0',
  ].join('\n'));
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(800);
  // compila (no hay errores) y avisa de que faltan los bloques (B04)
  await expect(win.locator('.load-status')).not.toHaveClass(/err/);
  await win.locator('.wb-bottom .tab', { hasText: 'Mensajes' }).click();
  await expect(win.locator('.wb-bottom-body')).toContainText('FC 83 (SSET) no está en el proyecto');
  await expect(win.locator('.wb-bottom-body')).toContainText('FC 82 (RSET) no está en el proyecto');
  // al llamarlo, STOP
  await win.keyboard.press('Digit1');
  await expect(win.locator('.stop-banner')).toContainText('Llamada a un bloque que no existe: FC83');

  // Biblioteca estándar ▸ Bloques de conversión ▸ Bloques
  await win.locator('.explorer-head button[aria-label="Biblioteca estándar"]').click();
  const bib = win.locator('.vflot.bib');
  await bib.locator('.bib-nodo', { hasText: 'Bloques de conversión' }).click();
  await bib.locator('.bib-fila', { hasText: 'Bloques' }).first().dblclick();
  await expect(bib.locator('.bib-fila.bloque')).toHaveCount(2);
  await bib.locator('.bib-fila.bloque', { hasText: 'FC82' }).click();
  await win.keyboard.press('F1');
  await expect(bib.locator('.bib-ayuda')).toContainText('Poner a 0 un rango de bits');
  await expect(bib.locator('.bib-ayuda .bib-params')).toContainText('POINTER');
  // arrastrar FC 82 a la carpeta Bloques
  await bib.locator('.bib-fila.bloque', { hasText: 'FC82' }).dragTo(win.locator('.ex-sub', { hasText: 'Bloques' }));
  await expect(win.locator('.ex-block', { hasText: 'FC82' })).toContainText('RSET');
  // FC 83 con el menú: Copiar en la biblioteca y Pegar en la carpeta
  await bib.locator('.bib-fila.bloque', { hasText: 'FC83' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: /^Copiar/ }).first().click();
  await win.locator('.ex-sub', { hasText: 'Bloques' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Pegar FC 83 (SSET)' }).click();
  await expect(win.locator('.ex-block', { hasText: 'FC83' })).toContainText('SSET');
  // otra vez: ya está
  await bib.locator('.bib-fila.bloque', { hasText: 'FC83' }).click();
  await bib.locator('button', { hasText: 'Copiar al proyecto' }).click();
  await expect(win.locator('.toast').last()).toContainText('ya está en «Zonas»');
  await bib.locator('.vflot-head button[aria-label="Cerrar"]').click();

  // el bloque se abre protegido, sin segmentos
  await win.locator('.ex-block', { hasText: 'FC82' }).click();
  await expect(win.locator('.lib-bloque')).toContainText('Está protegido');
  await expect(win.locator('.block-tabs')).toContainText('Bloque de biblioteca RSET (protegido)');
  await expect(win.locator('.seg')).toHaveCount(0);
  await expect(win.locator('.add-seg')).toHaveCount(0);
  await win.locator('.ex-block', { hasText: 'OB1' }).click();

  // rearrancar: E 124.0 = 1 → FC 83 enciende A 124.0–124.4; E 124.7 → FC 82 los apaga
  await win.locator('.stop-banner button', { hasText: 'Rearrancar' }).click();
  await expect(win.locator('.stop-banner')).toHaveCount(0);
  await expect.poll(() => lampsOn(0, 7)).toBe('11111000');
  await win.keyboard.press('Digit1');
  await win.keyboard.press('Digit8');
  await expect.poll(() => lampsOn(0, 7)).toBe('00000000');
  await expect(win.locator('.wb-bottom-body')).not.toContainText('no está en el proyecto');
});

test('editor AWL: Intro tras «CALL FC 83» escribe sus parámetros', async () => {
  await win.locator('.add-seg button', { hasText: 'AWL' }).click();
  const ed = win.locator('.cm-content').last();
  await ed.click();
  await win.keyboard.type('      CALL  FC 83');
  await win.keyboard.press('Enter');
  await win.keyboard.type('M 10.0');
  await win.keyboard.press('ArrowDown');
  await win.keyboard.press('End');
  await win.keyboard.type('2');
  await expect(ed.locator('.cm-line')).toHaveText(['      CALL  FC 83', '        S_BIT := M 10.0', '        N     := 2']);
  await win.locator('.explorer-foot').click();
  await win.waitForTimeout(700);
  await expect(win.locator('.load-status')).not.toHaveClass(/err/);
});

test('KOP: el cuadro FC 82 del catálogo copia el bloque si falta', async () => {
  // quitar el FC 82 del proyecto
  win.once('dialog', (d) => d.accept());
  await win.locator('.ex-block', { hasText: 'FC82' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Borrar FC82' }).click();
  await expect(win.locator('.ex-block', { hasText: 'FC82' })).toHaveCount(0);
  await win.locator('.add-seg button', { hasText: 'KOP' }).click();
  await win.locator('.kop-tools button', { hasText: 'Catálogo' }).last().click();
  await win.locator('.modal .nav-item', { hasText: 'Bibliotecas' }).click();
  await expect(win.locator('.modal .cat-item')).toHaveCount(2);
  await win.locator('.modal .cat-item', { hasText: 'FC 82 RSET' }).click();
  await expect(win.locator('.ex-block', { hasText: 'FC82' })).toContainText('RSET');
  await expect(win.locator('.kop-svg .boxtxt', { hasText: 'FC82' })).toHaveCount(1);
  // el cuadro sin operandos no compila: se borra el segmento para que la prueba siguiente empiece con el programa bien
  // (si no, según lo que tarde en compilarse, la franja enseña ese error en lugar del aviso del hardware)
  win.once('dialog', (d) => d.accept());
  await win.locator('.seg').last().locator('button[aria-label="Opciones del segmento"]').click();
  await win.locator('.menu button', { hasText: 'Borrar segmento' }).click();
  await expect(win.locator('.kop-svg .boxtxt', { hasText: 'FC82' })).toHaveCount(0);
  await win.waitForTimeout(700);
  await expect(win.locator('.load-status')).not.toHaveClass(/err/);
});

test('hardware: guardado sin cargar avisa; al cargarlo, la marca de ciclo funciona', async () => {
  win.on('dialog', (d) => { void d.accept(); });
  await win.locator('.ex-hw').dblclick();
  const hw = win.locator('.vflot.hwc');
  await expect(hw.locator('.hwc-tabla tbody tr')).toHaveCount(6);
  await hw.locator('.hwc-tabla tr', { hasText: 'CPU compacta' }).click({ button: 'right' });
  await win.locator('.menu button', { hasText: 'Propiedades del objeto' }).click();
  await expect(win.locator('.hwp-tab', { hasText: 'Remanencia' })).toBeDisabled();
  await win.locator('.hwp-tab', { hasText: 'Ciclo/Marca de ciclo' }).click();
  await win.locator('.modal label.check', { hasText: 'Marca de ciclo' }).locator('input').check();
  await win.locator('.modal input[aria-label="Byte de marcas"]').fill('100');
  await win.locator('.modal-foot button', { hasText: 'Aceptar' }).click();
  await expect(hw.locator('.hwc-estado')).toContainText('cambios sin guardar');
  await win.keyboard.press('Control+s');
  await expect(hw.locator('.hwc-estado')).toContainText('Falta cargarlo');
  await hw.locator('.vflot-head button[aria-label="Cerrar"]').click();
  // la franja de estado avisa y la marca de ciclo aún no funciona
  await expect(win.locator('.load-status')).toContainText('no está cargado en la CPU');
  await expect(win.locator('.ex-hw')).toContainText('sin cargar');
  // abrir desde la franja y cargar
  await win.locator('.load-status button', { hasText: 'Abrir el Hardware' }).click();
  await hw.locator('button[aria-label="Cargar en módulo"]').click();
  await expect(hw.locator('.hwc-estado')).toContainText('cargada en la CPU');
  await hw.locator('.vflot-head button[aria-label="Cerrar"]').click();
  await expect(win.locator('.ex-hw')).toContainText('marca de ciclo MB 100');
  await expect(win.locator('.load-status')).not.toContainText('no está cargado');
  expect(errores).toEqual([]);
});
