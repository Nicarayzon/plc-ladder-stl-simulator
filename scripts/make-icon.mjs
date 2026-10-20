// Genera build/icon.icns a partir de build/icon.svg (resvg → sips → iconutil).
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'build/icon.svg'));
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
const master = path.join(root, 'build/icon.png');
fs.writeFileSync(master, png);
const set = path.join(root, 'build/icon.iconset');
fs.rmSync(set, { recursive: true, force: true });
fs.mkdirSync(set);
for (const s of [16, 32, 128, 256, 512]) {
  for (const [scale, suffix] of [[1, ''], [2, '@2x']]) {
    const px = s * scale;
    execFileSync('sips', ['-z', String(px), String(px), master, '--out', path.join(set, `icon_${s}x${s}${suffix}.png`)], { stdio: 'ignore' });
  }
}
execFileSync('iconutil', ['-c', 'icns', set, '-o', path.join(root, 'build/icon.icns')]);
fs.rmSync(set, { recursive: true, force: true });
console.log('build/icon.icns generado');
