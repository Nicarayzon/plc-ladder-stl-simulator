// Temas: paletas (Básicos) y papeles de fondo (Avanzado)
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LETRA_TERMINAL, PALETA, PALETAS, PALETA_IDS, TOKENS, colorSenal, contraste, cssPaletas, esTema, luminancia, mezclar, paletaDe, temaGuardado, type PaletaId } from '../../src/ui/temas/paletas';
import { COLORS as COLORES_SENAL } from '../../src/sim/analyzer';
import { PAPEL, PAPEL_IDS, GRUPOS_PAPEL, papelesDe, dibujoPapel, imagenPapel, esPapel, limitar, INTENSIDAD } from '../../src/ui/temas/papeles';
import { es } from '../../src/i18n/es';
import { en } from '../../src/i18n/en';
import { de } from '../../src/i18n/de';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const css = fs.readFileSync(path.resolve(HERE, '../../src/styles/theme.css'), 'utf-8');

/** Variables de un bloque de theme.css (el primero que empieza por `selector {`) */
function bloque(selector: string): Record<string, string> {
  const i = css.indexOf(`${selector} {`);
  expect(i).toBeGreaterThanOrEqual(0);
  const cuerpo = css.slice(i, css.indexOf('}', i));
  return Object.fromEntries([...cuerpo.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** Etiquetas abiertas y cerradas en orden (el SVG de un papel tiene que estar bien formado) */
function bienFormado(svg: string): boolean {
  const pila: string[] = [];
  for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
    if (m[3]) continue;
    if (m[1]) { if (pila.pop() !== m[2]) return false; } else pila.push(m[2]);
  }
  return pila.length === 0;
}

/** Tono (0–360) y saturación (0–1) de un color */
function tono(hex: string): { h: number; s: number } {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return { h: 0, s: 0 };
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / max };
}
const esVerde = (hex: string) => { const { h, s } = tono(hex); return s > 0.3 && h >= 80 && h <= 165; };
const esRojo = (hex: string) => { const { h, s } = tono(hex); return s > 0.5 && (h >= 345 || h <= 10); };
/** Distancia entre dos colores (RGB) */
const distancia = (a: string, b: string) => Math.hypot(...[1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)));

describe('paletas', () => {
  it('«Oscuro» y «Claro» son las de theme.css', () => {
    const oscuro = bloque(':root');
    const claro = bloque(":root[data-theme='light']");
    for (const t of TOKENS) {
      expect(PALETA.dark.c[t], `--${t} oscuro`).toBe(oscuro[t]);
      expect(PALETA.light.c[t], `--${t} claro`).toBe(claro[t]);
    }
  });

  it('todas dan valor a todas las variables, con colores válidos', () => {
    for (const p of PALETAS) {
      for (const t of TOKENS) {
        const v = p.c[t];
        if (t === 'shadow') expect(v).toMatch(/^0 6px 24px rgba\(/);
        else expect(v, `${p.id} --${t}`).toMatch(/^#[0-9a-f]{6}$/);
      }
      for (const m of p.motivo) expect(m).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('se leen bien: contraste del texto, del acento y de la corriente del KOP', () => {
    for (const { id, c, base } of PALETAS) {
      expect(contraste(c.text, c.bg), `${id} texto`).toBeGreaterThanOrEqual(10);
      expect(contraste(c.text, c['bg-elev']), `${id} texto en panel`).toBeGreaterThanOrEqual(10);
      expect(contraste(c['text-dim'], c['bg-elev']), `${id} texto atenuado`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c['text-faint'], c.bg), `${id} texto tenue`).toBeGreaterThanOrEqual(2.6);
      expect(contraste(c.accent, c['bg-elev']), `${id} acento`).toBeGreaterThanOrEqual(base === 'dark' ? 5 : 4.5);
      expect(contraste(c['accent-text'], c.accent), `${id} botón principal`).toBeGreaterThanOrEqual(2.8);
      expect(contraste(c.text, c['accent-bg']), `${id} elemento activo`).toBeGreaterThanOrEqual(7);
      expect(contraste(c.power, c['code-bg']), `${id} corriente`).toBeGreaterThanOrEqual(2.9);
      expect(contraste(c.err, c['bg-elev']), `${id} error`).toBeGreaterThanOrEqual(3.5);
    }
  });

  it('zonas: el programa más claro, la E/S con más color y la barra de arriba con más aún (en Oscuro y Claro, las de siempre)', () => {
    for (const id of ['dark', 'light'] as const) {
      const { c } = PALETA[id];
      expect([c['zona-barra'], c['zona-es'], c['zona-prog']], id).toEqual([c['bg-elev'], c['bg-elev'], c.bg]);
    }
    for (const { id, base, c } of PALETAS.filter((p) => p.id !== 'dark' && p.id !== 'light')) {
      // cuánto color del tema lleva cada zona, medido desde la del programa
      const es = distancia(c['zona-es'], c['zona-prog']);
      const barra = distancia(c['zona-barra'], c['zona-prog']);
      expect(barra, `${id} barra / E/S`).toBeGreaterThan(es * 1.3);
      if (base === 'light') expect(luminancia(c['zona-prog']), `${id} programa más claro que el fondo`).toBeGreaterThan(luminancia(c.bg));
      // se distinguen entre ellas y de los paneles
      expect(contraste(c['zona-es'], c['zona-prog']), `${id} E/S / programa`).toBeGreaterThanOrEqual(1.1);
      expect(contraste(c['zona-barra'], c['zona-es']), `${id} barra / E/S`).toBeGreaterThanOrEqual(1.04);
      for (const z of ['zona-barra', 'zona-es'] as const) {
        expect(contraste(c[z], c['bg-elev']), `${id} ${z} / panel`).toBeGreaterThanOrEqual(1.05);
      }
      // y se leen los textos que van encima
      for (const z of ['zona-barra', 'zona-es', 'zona-prog'] as const) {
        expect(contraste(c.text, c[z]), `${id} texto en ${z}`).toBeGreaterThanOrEqual(7);
        expect(contraste(c['text-dim'], c[z]), `${id} texto atenuado en ${z}`).toBeGreaterThanOrEqual(4.5);
      }
      expect(contraste(c['text-faint'], c['zona-es']), `${id} títulos de E/S`).toBeGreaterThanOrEqual(2.6);
      // los botones activos (×1, Observar…) se ven sobre la barra
      expect(contraste(c['accent-bg'], c['zona-barra']), `${id} botón activo en la barra`).toBeGreaterThanOrEqual(1.05);
    }
  });

  it('el explorador de proyectos lleva su propia intensidad: no se confunde con la barra lateral ni con el programa', () => {
    for (const { id, c } of PALETAS) {
      const z = c['zona-proy'];
      // sus vecinos: la barra lateral (a la izquierda) y el programa (a la derecha)
      expect(contraste(z, c['zona-prog']), `${id} explorador / programa`).toBeGreaterThanOrEqual(1.2);
      expect(contraste(z, c['bg-elev']), `${id} explorador / barra lateral`).toBeGreaterThanOrEqual(1.12);
      // en los temas de color, más color que la E/S y menos que la barra de arriba
      if (id !== 'dark' && id !== 'light') {
        const color = (x: string) => distancia(x, c['zona-prog']);
        expect(color(z), `${id} explorador / E/S`).toBeGreaterThan(color(c['zona-es']));
        expect(color(z), `${id} explorador / barra`).toBeLessThan(color(c['zona-barra']));
      }
      // nombres (texto) y título, pie y descripciones (atenuado)
      expect(contraste(c.text, z), `${id} texto`).toBeGreaterThanOrEqual(7);
      expect(contraste(c['text-dim'], z), `${id} atenuado`).toBeGreaterThanOrEqual(4.5);
      // filas: al pasar el ratón y la abierta se ven, y se lee lo que llevan
      expect(contraste(c['proy-hover'], z), `${id} fila al pasar el ratón`).toBeGreaterThanOrEqual(1.1);
      expect(contraste(c['proy-sel'], z), `${id} fila abierta`).toBeGreaterThanOrEqual(1.18);
      expect(contraste(c['text-dim'], c['proy-hover']), `${id} atenuado al pasar el ratón`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.text, c['proy-sel']), `${id} texto en la fila abierta`).toBeGreaterThanOrEqual(7);
      expect(contraste(c['text-dim'], c['proy-sel']), `${id} descripción en la fila abierta`).toBeGreaterThanOrEqual(4.2);
    }
  });

  it('los nombres de los proyectos, con el máximo contraste: blanco en las oscuras y casi negro en las claras', () => {
    for (const { id, base, c } of PALETAS) {
      const n = c['proy-nombre'];
      if (base === 'dark') expect(n, id).toBe('#ffffff');
      else expect(luminancia(n), `${id} casi negro`).toBeLessThan(0.01);
      // más contraste que el texto normal, también con la fila bajo el ratón
      expect(contraste(n, c['zona-proy']), `${id} nombre`).toBeGreaterThanOrEqual(Math.max(12, contraste(c.text, c['zona-proy'])));
      expect(contraste(n, c['proy-hover']), `${id} nombre al pasar el ratón`).toBeGreaterThanOrEqual(10);
    }
  });

  it('RUN verde y STOP rojo, rellenos y legibles en todos los temas (en Verde hacker, RUN rojo y STOP blanco)', () => {
    for (const { id, c } of PALETAS) {
      // la letra se lee sobre el relleno
      expect(contraste(c['run-text'], c['run-bg']), `${id} RUN`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c['stop-text'], c['stop-bg']), `${id} STOP`).toBeGreaterThanOrEqual(4.5);
      // el botón destaca sobre la barra, y RUN no se confunde con STOP
      expect(contraste(c['run-bg'], c['zona-barra']), `${id} RUN / barra`).toBeGreaterThanOrEqual(2.5);
      expect(contraste(c['stop-bg'], c['zona-barra']), `${id} STOP / barra`).toBeGreaterThanOrEqual(2.5);
      expect(distancia(c['run-bg'], c['stop-bg']), `${id} RUN / STOP`).toBeGreaterThanOrEqual(150);
      if (id === 'hacker') {
        expect(esRojo(c['run-bg']), 'hacker RUN rojo').toBe(true);
        expect(luminancia(c['stop-bg']), 'hacker STOP blanco').toBeGreaterThan(0.8);
      } else {
        expect([esVerde(c['run-bg']), esRojo(c['stop-bg'])], id).toEqual([true, true]);
      }
    }
  });

  it('panel de E/S: los títulos y sus botones («Todas a 0», «Ocultar») se ven en todos los temas', () => {
    for (const { id, c } of PALETAS) {
      // título en el color del texto, con la marca del acento delante
      expect(contraste(c.text, c['zona-es']), `${id} título`).toBeGreaterThanOrEqual(7);
      expect(contraste(c.accent, c['zona-es']), `${id} marca del título`).toBeGreaterThanOrEqual(3);
      // botón: borde y letra del acento sobre la superficie; al pasar el ratón, texto sobre el fondo del acento
      expect(contraste(c.accent, c['bg-elev']), `${id} letra del botón`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(c.text, c['accent-bg']), `${id} botón al pasar el ratón`).toBeGreaterThanOrEqual(7);
    }
  });

  it('la carpeta que abre el explorador de proyectos se ve sobre la barra de arriba en todos los temas', () => {
    for (const { id, c } of PALETAS) {
      // el icono (color del acento) sobre la barra y sobre el botón
      expect(contraste(c.accent, c['zona-barra']), `${id} carpeta / barra`).toBeGreaterThanOrEqual(3);
      expect(contraste(c.accent, c['bg-elev']), `${id} carpeta / botón`).toBeGreaterThanOrEqual(3);
    }
  });

  it('la corriente no se confunde con los errores ni con el acento', () => {
    for (const { id, c } of PALETAS) {
      expect(distancia(c.power, c.err), `${id} corriente / error`).toBeGreaterThanOrEqual(100);
      expect(distancia(c.ok, c.err), `${id} RUN / error`).toBeGreaterThanOrEqual(100);
    }
  });

  it('Verde hacker: lo que en los demás temas es verde (corriente, pilotos, RUN, señales) es rojo', () => {
    const { c } = PALETA.hacker;
    expect(esVerde(c.accent)).toBe(true); // la interfaz sigue verde
    for (const t of ['power', 'ok'] as const) expect(esRojo(c[t]), t).toBe(true);
    expect(esRojo(c.err)).toBe(false); // los errores, en otro color
    // en los temas de siempre, el verde es el de la corriente
    expect(esVerde(PALETA.dark.c.power) && esVerde(PALETA.light.c.power)).toBe(true);
    const senales = COLORES_SENAL.map((x) => colorSenal(PALETA.hacker, x));
    expect(senales[0]).toBe(c.power);
    expect(senales.filter(esVerde)).toEqual([]);
    expect(new Set(senales).size).toBe(senales.length);
  });

  it('los colores de señal que cambia una paleta existen en el cronograma', () => {
    for (const p of PALETAS) {
      for (const [de, a] of Object.entries(p.senales ?? {})) {
        expect(COLORES_SENAL, `${p.id} ${de}`).toContain(de);
        expect(a).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
    expect(colorSenal(PALETA.dark, '#3ddc84')).toBe('#3ddc84');
  });

  it('el CSS lleva una regla por paleta nueva, con todas las variables', () => {
    const reglas = cssPaletas().split('\n');
    const colores = reglas.filter((r) => r.includes('{ color-scheme:'));
    expect(colores).toHaveLength(PALETAS.length - 2);
    for (const r of colores) {
      expect(r).toMatch(/^:root\[data-theme\]\[data-paleta='[a-z]+'\] \{ color-scheme: (dark|light);/);
      const id = r.match(/data-paleta='([a-z]+)'/)![1] as PaletaId;
      // con letra de terminal, también --font
      expect(r.match(/--[a-z0-9-]+:/g), id).toHaveLength(TOKENS.length + (PALETA[id].terminal ? 1 : 0));
    }
    // las demás reglas: el tamaño de la letra de las paletas con letra de terminal
    expect(reglas.filter((r) => !colores.includes(r))).toEqual(
      PALETAS.filter((p) => p.terminal).map((p) => `:root[data-theme][data-paleta='${p.id}'] body { font-size: ${LETRA_TERMINAL}px; }`),
    );
  });

  it('Verde hacker: letra de terminal, casi blanca y algo más grande; las demás, la de siempre', () => {
    expect(PALETAS.filter((p) => p.terminal).map((p) => p.id)).toEqual(['hacker']);
    expect(cssPaletas()).toMatch(/data-paleta='hacker'\] \{[^}]*--font: var\(--mono\);/);
    expect(LETRA_TERMINAL).toBeGreaterThan(13);
    const { c } = PALETA.hacker;
    expect(luminancia(c.text)).toBeGreaterThan(0.9);
    // la secundaria, más clara que en cualquier otra oscura
    for (const p of PALETAS.filter((x) => x.base === 'dark' && x.id !== 'hacker')) {
      expect(contraste(c['text-dim'], c.bg), p.id).toBeGreaterThan(contraste(p.c['text-dim'], p.c.bg));
    }
  });

  it('«Automático» es la oscura o la clara según el sistema; un valor guardado desconocido no rompe nada', () => {
    expect(paletaDe('system', true).id).toBe('dark');
    expect(paletaDe('system', false).id).toBe('light');
    expect(paletaDe('rosa', true).id).toBe('rosa');
    expect(esTema('hacker')).toBe(true);
    expect(esTema('azul')).toBe(false);
    expect(paletaDe('azul' as never, false).id).toBe('dark');
  });

  it('Ámbar retro ya no está: quien lo tenía guardado pasa a Café; un tema desconocido, a «como el sistema»', () => {
    expect(PALETA_IDS).not.toContain('ambar');
    expect(esTema('ambar')).toBe(false);
    expect(temaGuardado('ambar')).toBe('cafe');
    expect(temaGuardado('violeta')).toBe('violeta');
    expect(temaGuardado('system')).toBe('system');
    expect([temaGuardado('azul'), temaGuardado(undefined), temaGuardado(3)]).toEqual(['system', 'system', 'system']);
  });

  it('mezclar', () => {
    expect(mezclar('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mezclar('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mezclar('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('papeles', () => {
  it('cada uno da un SVG bien formado con cualquier paleta, sin valores sin calcular', () => {
    for (const id of PAPEL_IDS) {
      for (const p of PALETAS) {
        const d = dibujoPapel(id, p);
        expect(d.length, id).toBeGreaterThan(50);
        expect(d, `${id} ${p.id}`).not.toMatch(/undefined|NaN|Infinity/);
        expect(bienFormado(d), `${id} ${p.id}`).toBe(true);
      }
    }
  });

  it('el azulejo para CSS es un data URL que escala con el tamaño', () => {
    const a = imagenPapel('gatos', PALETA.light, 1);
    const b = imagenPapel('gatos', PALETA.light, 1.5);
    expect(a.url).toMatch(/^url\("data:image\/svg\+xml,%3Csvg%20xmlns/);
    expect(a.lado).toBe(PAPEL.gatos.tam);
    expect(b.lado).toBe(PAPEL.gatos.tam * 1.5);
    expect(decodeURIComponent(a.url)).toContain(`viewBox="0 0 ${PAPEL.gatos.tam} ${PAPEL.gatos.tam}"`);
    // ningún carácter que rompa url("…") en CSS
    expect(a.url.slice(5, -2)).not.toMatch(/["\s]/);
  });

  it('todos están en un grupo y los motivos usan los colores de la paleta', () => {
    expect(GRUPOS_PAPEL.flatMap(papelesDe).map((p) => p.id).sort()).toEqual([...PAPEL_IDS].sort());
    for (const id of PAPEL_IDS) expect(dibujoPapel(id, PALETA.rosa), id).toContain(PALETA.rosa.motivo[0]);
  });

  it('valores guardados', () => {
    expect(esPapel('')).toBe(true);
    expect(esPapel('propia')).toBe(true);
    expect(esPapel('otro')).toBe(false);
    expect(limitar(5, INTENSIDAD)).toBe(1);
    expect(limitar(Number.NaN, INTENSIDAD)).toBe(INTENSIDAD.defecto);
  });
});

describe('textos', () => {
  it('cada paleta y cada papel tienen nombre en los tres idiomas', () => {
    for (const t of [es, en, de]) {
      for (const id of ['system', ...PALETA_IDS] as const) expect(t.temas.paletas[id].n.length).toBeGreaterThan(1);
      for (const id of PAPEL_IDS) expect(t.temas.papeles[id].length).toBeGreaterThan(1);
    }
  });
});
