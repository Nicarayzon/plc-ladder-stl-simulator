// Idioma de la app: cuál se usa al arrancar (electron/idioma.cjs) y que el diccionario de la página está completo
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IDIOMAS, T, textosDe } from '../../src/i18n';
import { es } from '../../src/i18n/es';

interface AppFalsa { getPath: (k: string) => string; getPreferredSystemLanguages: () => string[]; getLocale: () => string }
const idioma = createRequire(import.meta.url)('../../electron/idioma.cjs') as {
  DISPONIBLES: string[];
  TEXTOS: Record<string, unknown>;
  deLocale: (l: string[]) => string;
  leer: (app: AppFalsa) => string | null;
  guardar: (app: AppFalsa, i: string) => boolean;
  alArrancar: (app: AppFalsa, env?: Record<string, string>) => { idioma: string; bienvenida: boolean };
};

function appFalsa(sistema: string[]): AppFalsa {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'idioma-'));
  return { getPath: () => dir, getPreferredSystemLanguages: () => sistema, getLocale: () => sistema[0] ?? 'es' };
}

describe('idioma de la app', () => {
  it('los idiomas de la página y del proceso principal son los mismos, y los menús están en todos', () => {
    expect(IDIOMAS.map((x) => x.id)).toEqual(idioma.DISPONIBLES);
    // las mismas claves en todos los idiomas (también las de los diálogos de actualizaciones)
    const claves = (o: unknown, pre = ''): string[] => Object.entries(o as object).flatMap(([k, v]) => (v && typeof v === 'object' ? claves(v, `${pre}${k}.`) : [`${pre}${k}`]));
    for (const i of idioma.DISPONIBLES) expect(claves(idioma.TEXTOS[i]), i).toEqual(claves(idioma.TEXTOS.es));
  });

  it('en las pruebas la app está en español', () => {
    expect(T).toBe(es);
    expect(textosDe('es')).toBe(es);
  });

  it('el idioma del sistema se elige entre los disponibles; si no hay ninguno, inglés o el primero', () => {
    expect(idioma.deLocale(['es-ES'])).toBe('es');
    expect(idioma.deLocale(['de-AT', 'en-GB'])).toBe('de');
    expect(idioma.deLocale(['fr-FR', 'en-US'])).toBe('en');
    const otro = idioma.deLocale(['fr-FR', 'pt-BR']);
    expect(idioma.DISPONIBLES).toContain(otro);
    expect(otro).toBe(idioma.DISPONIBLES.includes('en') ? 'en' : idioma.DISPONIBLES[0]);
  });

  it('instalación nueva: idioma del sistema y aviso de bienvenida una sola vez', () => {
    const app = appFalsa(['es-ES']);
    expect(idioma.alArrancar(app, {})).toEqual({ idioma: 'es', bienvenida: true });
    expect(idioma.leer(app)).toBe('es');
    expect(idioma.alArrancar(app, {})).toEqual({ idioma: 'es', bienvenida: false });
  });

  it('quien ya usaba la app sigue en español, con el aviso', () => {
    const app = appFalsa(['de-DE']);
    fs.mkdirSync(path.join(app.getPath('userData'), 'Local Storage'));
    expect(idioma.alArrancar(app, {})).toEqual({ idioma: 'es', bienvenida: true });
  });

  it('solo se guardan idiomas disponibles, y AUTOMATIZACION_IDIOMA lo fija sin aviso', () => {
    const app = appFalsa(['es-ES']);
    expect(idioma.guardar(app, 'fr')).toBe(false);
    expect(idioma.leer(app)).toBeNull();
    expect(idioma.alArrancar(app, { AUTOMATIZACION_IDIOMA: 'es' })).toEqual({ idioma: 'es', bienvenida: false });
    fs.writeFileSync(path.join(app.getPath('userData'), 'idioma.json'), '{"idioma":"xx"}');
    expect(idioma.leer(app)).toBeNull();
  });
});
