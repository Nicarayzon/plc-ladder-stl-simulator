// Idioma de la app: se decide al arrancar, se guarda en idioma.json y se elige en Ajustes ▸ Idioma
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Arranca la app con una carpeta de datos nueva; sin `idioma`, como una instalación de verdad (sin AUTOMATIZACION_IDIOMA) */
async function abrir(userData: string, idioma?: string) {
  const env: Record<string, string | undefined> = { ...process.env, AUTOMATIZACION_USER_DATA: userData };
  if (idioma) env.AUTOMATIZACION_IDIOMA = idioma;
  else delete env.AUTOMATIZACION_IDIOMA;
  const app = await electron.launch({ args: ['.'], cwd: path.resolve(HERE, '../..'), env: env as Record<string, string> });
  const win = await app.firstWindow();
  await win.setViewportSize({ width: 1440, height: 900 });
  return { app, win };
}
const menus = (app: Awaited<ReturnType<typeof abrir>>['app']) => app.evaluate(({ Menu }) => Menu.getApplicationMenu()?.items.map((m) => m.label) ?? []);

test('quien ya usaba la app sigue en español, ve el aviso y puede pasar al inglés o al alemán', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-e2e-idioma-'));
  // datos de una versión anterior: la app ya se había usado
  fs.mkdirSync(path.join(userData, 'Local Storage'));
  const { app, win } = await abrir(userData);
  try {
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'idioma.json'), 'utf8')).idioma).toBe('es');
    // aviso de bienvenida, en español
    const aviso = win.locator('.modal', { hasText: 'Idioma de la app' });
    await expect(aviso).toContainText('También puedes usarla en inglés y alemán');
    await aviso.getByRole('button', { name: 'Ir a Ajustes' }).click();
    await expect(win.locator('h1')).toHaveText('Ajustes');
    expect(await menus(app)).toContain('Edición');

    // elegir inglés: el aviso sale ya en inglés, con la casilla de la nemotecnia
    await win.getByRole('button', { name: 'Idioma' }).click();
    await win.locator('.menu button', { hasText: 'English' }).click();
    const reinicio = win.locator('.modal', { hasText: 'Change the language' });
    await expect(reinicio).toContainText('The app will be shown in English');
    await expect(reinicio.locator('input[type=checkbox]')).toBeChecked();
    await reinicio.getByRole('button', { name: 'Later' }).click();
    // se guarda para el próximo arranque, los menús cambian ya y la página sigue en español hasta reiniciar
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'idioma.json'), 'utf8')).idioma).toBe('en');
    expect(await menus(app)).toContain('Edit');
    await expect(win.locator('body')).toContainText('English will be used the next time you open the app.');
    await expect(win.locator('h1')).toHaveText('Ajustes');
    await expect(win.getByRole('button', { name: 'Nemotécnica por defecto' })).toContainText('Inglesa');

    // y luego el alemán: el aviso sale en alemán y propone volver a la nemotecnia alemana
    await win.getByRole('button', { name: 'Idioma' }).click();
    await win.locator('.menu button', { hasText: 'Deutsch' }).click();
    const aleman = win.locator('.modal', { hasText: 'Sprache ändern' });
    await expect(aleman).toContainText('Die App wird beim nächsten Öffnen auf Deutsch angezeigt');
    await expect(aleman).toContainText('Auch im Code die deutsche Mnemonik verwenden');
    await aleman.getByRole('button', { name: 'Später' }).click();
    expect(JSON.parse(fs.readFileSync(path.join(userData, 'idioma.json'), 'utf8')).idioma).toBe('de');
    expect(await menus(app)).toContain('Bearbeiten');
    await expect(win.locator('body')).toContainText('Deutsch wird beim nächsten Öffnen der App verwendet.');
    await expect(win.getByRole('button', { name: 'Nemotécnica por defecto' })).toContainText('Alemana');
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('en inglés: interfaz, menús y nemotecnia inglesa en una instalación nueva', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-e2e-idioma-'));
  const { app, win } = await abrir(userData, 'en');
  try {
    await expect(win.locator('.sidebar .nav-item.active')).toContainText('Free simulator');
    expect(await menus(app)).toEqual(expect.arrayContaining(['Edit', 'View', 'Window']));
    // sin ajustes guardados, el código se escribe con la nemotecnia inglesa y las direcciones salen como I y Q
    await win.locator('.cm-content').first().click();
    for (const l of ['A I 124.0', '= Q 124.0']) { await win.keyboard.type(l); await win.keyboard.press('Enter'); }
    await win.locator('.explorer-foot').click();
    await win.waitForTimeout(900);
    await expect(win.locator('.load-status')).toContainText('Program loaded in the CPU and running (RUN).');
    await expect(win.locator('.sw-cap').first()).toHaveText(/^I 124/);
    // la teoría y los ejemplos, en inglés
    await win.evaluate(() => { window.location.hash = '#/aprender/1'; });
    await expect(win.locator('h2').first()).toContainText('How the PLC works');
    await win.evaluate(() => { window.location.hash = '#/ejercicio/E06/ejemplos'; });
    await expect(win.locator('.ex-head')).toContainText('Start and stop with latching');
    await win.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(win.locator('.grade')).toContainText('Correct!');
    // las señales del analizador, también con la nemotecnia inglesa
    await expect(win.locator('.an-sig .nm').first()).toHaveText('I 0.0');
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});

test('en alemán: interfaz, menús, teoría y ejemplos con la nemotecnia alemana', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'automatizacion-e2e-idioma-'));
  const { app, win } = await abrir(userData, 'de');
  try {
    await expect(win.locator('.sidebar .nav-item.active')).toContainText('Freier Simulator');
    expect(await menus(app)).toEqual(expect.arrayContaining(['Bearbeiten', 'Ansicht', 'Fenster']));
    await win.locator('.cm-content').first().click();
    for (const l of ['U E 124.0', '= A 124.0']) { await win.keyboard.type(l); await win.keyboard.press('Enter'); }
    await win.locator('.explorer-foot').click();
    await win.waitForTimeout(900);
    await expect(win.locator('.load-status')).toContainText('Programm in die CPU geladen und in Betrieb (RUN).');
    await expect(win.locator('.sw-cap').first()).toHaveText(/^E 124/);
    // la teoría (también los capítulos que solo usa la app) y los ejemplos, en alemán
    await win.evaluate(() => { window.location.hash = '#/aprender/1'; });
    await expect(win.locator('h2').first()).toContainText('Wie die SPS arbeitet');
    await win.evaluate(() => { window.location.hash = '#/aprender/9'; });
    await expect(win.locator('h2').first()).toContainText('Typische Fehler und Prüfungsfallen');
    await win.evaluate(() => { window.location.hash = '#/ejercicio/E06/ejemplos'; });
    await expect(win.locator('.ex-head')).toContainText('Ein und Aus mit Selbsthaltung');
    await expect(win.locator('.an-sig .nm').first()).toHaveText('E 0.0');
    await win.getByRole('button', { name: 'Prüfen', exact: true }).click();
    await expect(win.locator('.grade')).toContainText('Richtig!');
  } finally {
    await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
