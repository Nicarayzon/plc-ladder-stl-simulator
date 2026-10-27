// Genera las páginas de teoría de la web (docs/<idioma>/…) a partir de la referencia y de los ejemplos,
// y docs/vivo.js, los ejemplos interactivos con el motor de la app.
// Uso, desde app/: npm run web:teoria
// Compila scripts/web/generar.tsx con esbuild (usa el dibujo KOP de la app, que está en TypeScript) y lo ejecuta.
import { build } from 'esbuild';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const raiz = path.resolve(import.meta.dirname, '..');
const salida = path.join(raiz, 'node_modules/.cache/web-teoria/generar.mjs');

await build({
  entryPoints: [path.join(raiz, 'scripts/web/generar.tsx')],
  outfile: salida,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  jsx: 'automatic',
  logLevel: 'warning',
});

const { generar } = await import(`${pathToFileURL(salida).href}?${Date.now()}`);
generar(raiz);

// La web no guarda ajustes: el simulador usa los valores por defecto de la app
const ajustesWeb = {
  name: 'ajustes-web',
  setup(b) {
    b.onResolve({ filter: /\/store\/settings$/ }, () => ({ path: path.join(raiz, 'scripts/web/ajustes-web.ts') }));
    // ni el diccionario de la app: los textos de la web van aparte (ver i18n-web.ts)
    b.onResolve({ filter: /\/i18n$/ }, () => ({ path: path.join(raiz, 'scripts/web/i18n-web.ts') }));
  },
};

const r = await build({
  entryPoints: [path.join(raiz, 'scripts/web/vivo.tsx')],
  outfile: path.join(raiz, 'docs/vivo.js'),
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: 'es2022',
  minify: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [ajustesWeb],
  metafile: true,
  logLevel: 'warning',
});
const bytes = Object.values(r.metafile.outputs)[0].bytes;
console.log(`vivo.js: ${Math.round(bytes / 1024)} KB`);
