// Captura de pantalla de la app (desarrollo): node tools/shot.mjs <ruta-hash> <salida.png> [acciones.js]
import { _electron as electron } from '@playwright/test';
import fs from 'node:fs';
const [, , route = 'inicio', out = 'shot.png', actions] = process.argv;
const app = await electron.launch({ args: ['.'], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const win = await app.firstWindow();
await win.setViewportSize({ width: 1440, height: 900 });
const errors = [];
win.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
win.on('pageerror', (e) => errors.push(String(e)));
await win.evaluate((r) => { window.location.hash = `#/${r}`; }, route);
await win.waitForTimeout(1500);
if (actions) {
  const code = fs.readFileSync(actions, 'utf-8');
  const fn = new Function('win', `return (async () => { ${code} })()`);
  await fn(win);
}
await win.screenshot({ path: out });
if (errors.length) console.log('ERRORES:\n' + errors.join('\n'));
await app.close();
