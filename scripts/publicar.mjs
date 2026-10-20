// Copia el instalador de la versión actual (release/) a ../develop o ../production.
//   node scripts/publicar.mjs dev     → ../develop/Automatizacion-<versión>-arm64.dmg (+ .zip)
//   node scripts/publicar.mjs prod    → ../production/… (versión aprobada)
// El código fuente está en el repositorio de GitHub, así que ya no se copia en un .zip.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = process.argv[2];
const carpeta = { dev: 'develop', prod: 'production' }[destino];
if (!carpeta) {
  console.error('Uso: node scripts/publicar.mjs dev|prod');
  process.exit(1);
}
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const out = path.resolve(root, '..', carpeta);
fs.mkdirSync(out, { recursive: true });
const ficheros = [`Automatizacion-${version}-arm64.dmg`, `Automatizacion-${version}-arm64-mac.zip`];
for (const f of ficheros) {
  const src = path.join(root, 'release', f);
  if (!fs.existsSync(src)) {
    console.error(`No existe ${src}: ejecuta antes «npm run dist»`);
    process.exit(1);
  }
  fs.copyFileSync(src, path.join(out, f));
  console.log(`  ${carpeta}/${f}`);
}
