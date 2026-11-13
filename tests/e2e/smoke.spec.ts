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
  app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: { ...process.env, AUTOMATIZACION_IDIOMA: 'es', AUTOMATIZACION_USER_DATA: userData } });
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
  expect(version).toBe('0.27.0');
  await expect(win.locator('.brand')).toContainText(`v${version}`);
  await expect(win.locator('h1')).toHaveText('Automatizacion');
});

test('temas: los básicos cambian los colores y el papel se ve antes de aplicarlo', async () => {
  const attr = (a: string) => win.evaluate((x) => document.documentElement.getAttribute(x), a);
  const variable = (v: string) => win.evaluate((x) => getComputedStyle(document.documentElement).getPropertyValue(x).trim(), v);
  await goto('ajustes');
  // el tema ya no está en Ajustes, sino en su propia sección; ningún <select> nativo (con Wine su lista no sale)
  await expect(win.locator('button[aria-label="Tema"]')).toHaveCount(0);
  await win.locator('.sidebar .nav-item', { hasText: 'Temas' }).click();
  await expect(win.locator('h1')).toHaveText('Temas');
  await expect(win.locator('.main select')).toHaveCount(0);
  const tarjeta = (t: string) => win.locator('.tema-card', { has: win.locator('b', { hasText: new RegExp(`^${t}$`) }) });
  await expect(tarjeta('Automático')).toHaveAttribute('aria-pressed', 'true');
  expect(await attr('data-theme')).toBeNull();
  await tarjeta('Claro').click();
  expect(await attr('data-theme')).toBe('light');
  expect(await attr('data-paleta')).toBeNull();
  await tarjeta('Rosa claro').click();
  expect([await attr('data-theme'), await attr('data-paleta')]).toEqual(['light', 'rosa']);
  expect(await variable('--bg')).toBe('#fbe2ec');
  await tarjeta('Verde hacker').click();
  expect([await attr('data-theme'), await attr('data-paleta')]).toEqual(['dark', 'hacker']);
  expect(await variable('--accent')).toBe('#22e06a');
  // en Verde hacker, la corriente y los pilotos son rojos, y la letra es la de terminal
  expect(await variable('--power')).toBe('#ff3344');
  const letra = () => win.evaluate(() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.body).fontSize]);
  expect(await letra()).toEqual([expect.stringMatching(/Mono.*monospace$/), '14px']);
  await expect(tarjeta('Verde hacker')).toHaveAttribute('aria-pressed', 'true');
  // Ámbar retro se quitó
  await expect(tarjeta('Ámbar retro')).toHaveCount(0);
  // el explorador de proyectos lleva su propia intensidad (--zona-proy de Verde hacker): distinto de la barra lateral y del programa
  await goto('simulador');
  const fondo = (sel: string) => win.locator(sel).first().evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await fondo('.explorer')).toBe('rgb(9, 47, 24)');
  expect(new Set([await fondo('.explorer'), await fondo('.sidebar'), await fondo('.wb')]).size).toBe(3);
  // y los nombres de los proyectos, más gruesos y en blanco (el abierto, más aún)
  const nombre = win.locator('.ex-folder .ex-name').first();
  expect(await nombre.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).fontWeight])).toEqual(['rgb(255, 255, 255)', '700']);
  // y la carpeta de al lado, más grande y del mismo color
  const carpeta = win.locator('.ex-folder .ex-carpeta').first();
  expect(await carpeta.evaluate((e) => [getComputedStyle(e).color, e.getAttribute('width')])).toEqual(['rgb(255, 255, 255)', '17']);
  await goto('temas');

  // Avanzado: al pulsar un papel se ve en la vista previa, y solo se pone en la app al aplicarlo
  await win.locator('.temas-modo button', { hasText: 'Avanzado' }).click();
  await win.locator('.papel-card', { hasText: 'Gatitos' }).click();
  await expect(win.locator('.tema-mini.grande svg[aria-label="Vista previa: Gatitos"] pattern')).toHaveCount(1);
  await expect(win.locator('.papel-capa')).toHaveCount(0);
  await win.locator('.papel-ctrl input[type=range]').first().fill('0.6');
  await win.locator('button', { hasText: 'Aplicar a la app' }).click();
  const capa = win.locator('.papel-capa');
  await expect(capa).toHaveCount(1);
  expect(await capa.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('data:image/svg+xml');
  expect(await capa.evaluate((e) => getComputedStyle(e).opacity)).toBe('0.6');
  expect(await attr('data-papel')).toBe('gatos');
  await expect(win.locator('.papel-card', { hasText: 'Gatitos' }).locator('.en-uso')).toHaveCount(1);
  // en el simulador, el fondo deja ver el papel entre los segmentos
  await goto('simulador');
  expect(await win.locator('.wb').first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  // se recuerda al volver a entrar y se quita con un botón
  await goto('temas/avanzado');
  await expect(win.locator('.papel-ctrl')).toContainText('En uso: Gatitos');
  await win.locator('button', { hasText: 'Quitar el papel' }).click();
  await expect(win.locator('.papel-capa')).toHaveCount(0);
  expect(await attr('data-papel')).toBeNull();
  // vuelta al de siempre
  await win.locator('.temas-modo button', { hasText: 'Básicos' }).click();
  await tarjeta('Automático').click();
  expect([await attr('data-theme'), await attr('data-paleta')]).toEqual([null, null]);
  expect(await letra()).toEqual([expect.not.stringContaining('Mono'), '13px']);
});

test('un tema guardado que ya no existe (Ámbar retro) pasa a Café al arrancar', async () => {
  const attr = (a: string) => win.evaluate((x) => document.documentElement.getAttribute(x), a);
  await win.evaluate(() => {
    const k = 'automatizacion.v1.settings';
    const g = JSON.parse(localStorage.getItem(k) ?? '{"state":{},"version":2}');
    g.state.theme = 'ambar';
    localStorage.setItem(k, JSON.stringify(g));
  });
  await win.reload();
  await win.waitForTimeout(800);
  expect([await attr('data-theme'), await attr('data-paleta')]).toEqual(['dark', 'cafe']);
  await goto('temas');
  const tarjeta = (t: string) => win.locator('.tema-card', { has: win.locator('b', { hasText: new RegExp(`^${t}$`) }) });
  await expect(tarjeta('Café')).toHaveAttribute('aria-pressed', 'true');
  await tarjeta('Automático').click();
  expect([await attr('data-theme'), await attr('data-paleta')]).toEqual([null, null]);
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

test('analógicas: un indicador de 0 a 10 V por cada PAW, uno debajo de otro (27712 = 10 V); las marcas se ocultan', async () => {
  await goto('simulador');
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Analógica');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText('L PEW 256\nT PAW 256\nL PEW 258\nT PAW 258\nU E 124.0\n= M 10.0\n');
  await win.locator('.explorer-foot').click();
  await expect(win.locator('.load-status')).toContainText('Programa cargado');
  const sec = win.locator('.panel-sec', { hasText: 'Analógicas y palabras' });
  const indicadores = sec.locator('.volt');
  await expect(indicadores).toHaveCount(2);
  // van encima del título de la sección, el segundo debajo del primero
  expect(await sec.evaluate((e) => e.firstElementChild?.className)).toBe('volts');
  await expect(indicadores.locator('.volt-nombre')).toHaveText(['PAW 256', 'PAW 258']);
  // cada uno con su PEW justo debajo, dentro del mismo bloque; ninguna PEW suelta debajo del título
  await expect(indicadores.locator('.analog > span.mono')).toHaveText(['PEW 256', 'PEW 258']);
  const [dial, pew] = await indicadores.first().evaluate((e) => [e.querySelector('.volt-cab')!, e.querySelector('.analog')!].map((x) => x.getBoundingClientRect().bottom));
  expect(pew).toBeGreaterThan(dial);
  await expect(sec.locator(':scope > .analog', { hasText: 'PEW' })).toHaveCount(0);
  // sin display de 7 segmentos
  await expect(win.locator('.seven')).toHaveCount(0);
  const [a, b] = await indicadores.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: r.top, bottom: r.bottom, left: r.left })));
  expect(b.top).toBeGreaterThanOrEqual(a.bottom);
  expect(b.left).toBe(a.left);
  const indicador = indicadores.first();
  await expect(indicador.locator('.volt-lectura')).toHaveText('0,00 V');
  const deslizador = sec.locator('.analog input[type=range]').first();
  await expect(deslizador).toHaveAttribute('max', '32767');
  await deslizador.fill('13856');
  await expect(indicador.locator('.volt-lectura')).toHaveText('5,00 V');
  await expect(indicador.locator('.volt-cab')).toHaveAttribute('aria-valuenow', '5');
  await deslizador.fill('27712');
  await expect(indicador.locator('.volt-lectura')).toHaveText('10,00 V');
  await expect(indicador.locator('.volt-lectura')).not.toHaveClass(/fuera/);
  // por encima de 27712: más de 10 V, fuera de escala, y la aguja se queda al final
  await deslizador.fill('32767');
  await expect(indicador.locator('.volt-lectura')).toHaveText('11,82 V');
  await expect(indicador.locator('.volt-lectura')).toHaveClass(/fuera/);
  await expect(indicador.locator('.volt-cab')).toHaveAttribute('aria-valuenow', '11.82');
  expect(await indicador.locator('.volt-aguja').evaluate((e) => e.style.transform)).toBe('rotate(180deg)');
  await expect(indicadores.nth(1).locator('.volt-lectura')).toHaveText('0,00 V');

  // la sección de marcas se oculta (queda el título) y se vuelve a mostrar
  const marcas = win.locator('.marcas-sec');
  await expect(marcas.locator('.sw-row')).toHaveCount(1);
  await marcas.locator('button', { hasText: 'Ocultar' }).click();
  await expect(marcas).toHaveClass(/oculta/);
  await expect(marcas.locator('.sw-row')).toHaveCount(0);
  await expect(marcas.locator('h4')).toContainText('Marcas');
  await marcas.locator('button', { hasText: 'Mostrar' }).click();
  await expect(marcas.locator('.sw-row')).toHaveCount(1);
});

test('zoom del AWL: en Ajustes, como el del KOP; crecen el código, las columnas de «Observar» y su cabecera', async () => {
  const zoom = win.locator('label', { hasText: 'Zoom del AWL' });
  const tam = (sel: string) => win.locator(sel).first().evaluate((e) => getComputedStyle(e).fontSize);
  await goto('ajustes');
  await expect(zoom).toContainText('100 %');
  await zoom.locator('input[type=range]').fill('1.5');
  await expect(zoom).toContainText('150 %');
  await goto('simulador');
  expect(await tam('.awl-editor .cm-editor')).toBe('19.5px');
  expect(await tam('.awl-editor .cm-gutters')).toBe('19.5px');
  expect((await win.locator('.awl-editor .cm-line').first().boundingBox())!.height).toBeGreaterThan(26);
  // con «Observar», las columnas y su cabecera (RLO, STA…) crecen a la mitad de ritmo: 125 %
  await expect(win.locator('.obs-head')).toHaveCount(1);
  expect(await tam('.obs-head')).toBe('13.125px');
  // vuelta al 100 %
  await goto('ajustes');
  await zoom.locator('input[type=range]').fill('1');
  await expect(zoom).toContainText('100 %');
  await goto('simulador');
  expect(await tam('.awl-editor .cm-editor')).toBe('13px');
});

test('panel de E/S: títulos destacados y «Todas a 0» con forma de botón', async () => {
  await goto('simulador');
  const colorDe = (v: string) => win.evaluate((x) => {
    const d = document.createElement('div');
    d.style.color = `var(${x})`;
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  }, v);
  const [texto, acento] = [await colorDe('--text'), await colorDe('--accent')];
  const titulo = win.locator('.wb-right .panel-sec h4', { hasText: 'Entradas' }).first();
  expect(await titulo.evaluate((e) => [getComputedStyle(e).color, getComputedStyle(e).fontWeight, getComputedStyle(e, '::before').backgroundColor])).toEqual([texto, '700', acento]);
  const boton = titulo.locator('button.io-accion', { hasText: 'Todas a 0' });
  await expect(boton.locator('svg')).toHaveCount(1);
  expect(await boton.evaluate((e) => [getComputedStyle(e).borderTopColor, getComputedStyle(e).color])).toEqual([acento, acento]);
  // sigue funcionando: sube un interruptor (clic) y el botón lo baja
  const e0 = win.locator('.sw', { hasText: '124.0' }).first();
  await e0.click();
  await expect(e0).toHaveAttribute('aria-pressed', 'true');
  await boton.click();
  await expect(e0).toHaveAttribute('aria-pressed', 'false');
});

test('palabras que se pisan: aviso subrayado en el editor; RUN verde y STOP rojo rellenos', async () => {
  await goto('simulador');
  await win.locator('.explorer-head button', { hasText: 'Nuevo' }).click();
  await win.locator('.modal input').fill('Solapadas');
  await win.locator('.modal button', { hasText: 'Crear' }).click();
  await win.locator('.ex-create', { hasText: 'Crear OB1' }).click();
  await win.locator('.cm-content').first().click();
  await win.keyboard.insertText('L PEW 128\nT PAW 128\nL PEW 129\nT PAW 129\n');
  await win.locator('.explorer-foot').click();
  // es un aviso, no un error: el programa se carga igual
  await expect(win.locator('.load-status')).toContainText('Programa cargado');
  await expect(win.locator('.cm-lintRange-warning')).toHaveCount(2);
  await win.locator('.wb-bottom .tab', { hasText: 'Mensajes' }).click();
  const msgs = win.locator('.wb-bottom-body');
  await expect(msgs).toContainText('PEW 128 y PEW 129 se solapan: comparten el byte 129');
  await expect(msgs).toContainText('usa PEW 130');
  await expect(msgs).toContainText('usa PAW 130');
  // RUN y STOP con su relleno (los colores de la paleta)
  const fondo = (t: string) => win.locator('.run-switch button', { hasText: t }).evaluate((e) => getComputedStyle(e).backgroundColor);
  const variable = (v: string) => win.evaluate((x) => {
    const d = document.createElement('div');
    d.style.color = `var(${x})`;
    document.body.appendChild(d);
    const c = getComputedStyle(d).color;
    d.remove();
    return c;
  }, v);
  const [runBg, stopBg] = [await variable('--run-bg'), await variable('--stop-bg')];
  await win.locator('.run-switch button', { hasText: 'RUN' }).click();
  await expect.poll(() => fondo('RUN')).toBe(runBg);
  await win.locator('.run-switch button', { hasText: 'STOP' }).click();
  await expect.poll(() => fondo('STOP')).toBe(stopBg);
  await win.locator('.run-switch button', { hasText: 'RUN' }).click();
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
