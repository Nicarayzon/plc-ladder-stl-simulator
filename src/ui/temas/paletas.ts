// Temas básicos: paletas de colores de la interfaz (Temas ▸ Básicos).
// Cada paleta da valor a las mismas variables CSS que src/styles/theme.css (--bg, --accent…).
// «dark» y «light» son las de siempre y viven en theme.css (una prueba comprueba que coinciden con las de aquí).
// El resto se inyectan como CSS al arrancar (instalarPaletas) y se eligen con <html data-paleta="…">;
// <html data-theme> lleva además «dark» o «light» según el fondo, para el resaltado del código AWL.

export const TOKENS = [
  'bg', 'bg-elev', 'bg-elev2', 'bg-elev3', 'bg-hover', 'zona-barra', 'zona-es', 'zona-prog', 'zona-proy', 'proy-hover', 'proy-sel', 'proy-nombre', 'border', 'border-strong',
  'text', 'text-dim', 'text-faint', 'accent', 'accent-bg', 'accent-text',
  'power', 'nopower', 'skipped', 'warn', 'warn-bg', 'err', 'err-bg', 'ok', 'ok-bg',
  'led-off', 'kop-wire', 'kop-sel', 'code-bg', 'shadow', 'run-bg', 'run-text', 'stop-bg', 'stop-text',
] as const;
export type Token = (typeof TOKENS)[number];
export type Colores = Record<Token, string>;

/** Los tres colores con los que se pintan los motivos de los papeles */
export type ColoresMotivo = readonly [string, string, string];

// «ambar» (Ámbar retro) se quitó en la 0.30.0: quien lo tenía guardado pasa a Café (src/store/settings.ts)
// 0.34.0: ocho más (cuatro oscuras y cuatro claras), las del final de cada línea
export const PALETA_IDS = [
  'dark', 'light',
  'oceano', 'hacker', 'violeta', 'cafe', 'medianoche', 'grafito', 'neon', 'bosque',
  'cielo', 'rosa', 'naranja', 'menta', 'lavanda', 'turquesa', 'limon', 'arena', 'niebla',
] as const;
export type PaletaId = (typeof PALETA_IDS)[number];
/** Lo que se guarda en Ajustes: una paleta o «como el sistema» (oscura o clara según el sistema operativo) */
export type Theme = 'system' | PaletaId;

export interface Paleta {
  id: PaletaId;
  /** Fondo oscuro o claro: decide el resaltado del código y los colores de estado por defecto */
  base: 'dark' | 'light';
  c: Colores;
  motivo: ColoresMotivo;
  /** Colores de las señales del cronograma que cambian con esta paleta (los de src/sim/analyzer.ts → el nuevo) */
  senales?: Readonly<Record<string, string>>;
  /** Letra de terminal (la monoespaciada del código) en toda la interfaz, y un poco más grande (`LETRA_TERMINAL`) */
  terminal?: boolean;
}

/** Tamaño de la letra de la interfaz con `terminal`, en px (la normal es 13, en theme.css) */
export const LETRA_TERMINAL = 14;

/** Color con el que se pinta una señal del cronograma con la paleta `p` */
export const colorSenal = (p: Paleta, color: string): string => p.senales?.[color] ?? color;

// ───────── colores ─────────

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** Mezcla `a` con `b`: t = 0 → a, t = 1 → b */
export function mezclar(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return `#${x.map((v, i) => hex2(v + (y[i] - v) * t)).join('')}`;
}

/** Luminancia relativa (WCAG) */
export function luminancia(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contraste WCAG entre dos colores (1 a 21) */
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// ───────── paletas ─────────

/** Las de siempre: copia exacta de theme.css. El explorador (`zona-proy`, sus filas y `proy-nombre`) sale de `zonaProyectos`, como en las demás. */
const OSCURO: Colores = {
  'bg': '#121418', 'bg-elev': '#191c21', 'bg-elev2': '#20242a', 'bg-elev3': '#282d34', 'bg-hover': '#2a3038',
  'zona-barra': '#191c21', 'zona-es': '#191c21', 'zona-prog': '#121418', 'zona-proy': '#1d2c3f', 'proy-hover': '#2b394b', 'proy-sel': '#253e5b', 'proy-nombre': '#ffffff',
  'border': '#2c3139', 'border-strong': '#3a414b', 'text': '#e6e9ee', 'text-dim': '#9aa3ae', 'text-faint': '#6b7480',
  'accent': '#4f9cf0', 'accent-bg': '#1d3550', 'accent-text': '#ffffff', 'power': '#3ddc84', 'nopower': '#5aa0e6',
  'skipped': '#5b626c', 'warn': '#f2b84b', 'warn-bg': '#3a2e14', 'err': '#ef5b6b', 'err-bg': '#3b1a20', 'ok': '#3ddc84',
  'ok-bg': '#163524', 'led-off': '#343a43', 'kop-wire': '#8a94a0', 'kop-sel': '#f2b84b', 'code-bg': '#15181c',
  'shadow': '0 6px 24px rgba(0, 0, 0, 0.45)',
  'run-bg': '#22c55e', 'run-text': '#03200d', 'stop-bg': '#dc2626', 'stop-text': '#ffffff',
};
const CLARO: Colores = {
  'bg': '#f3f5f8', 'bg-elev': '#ffffff', 'bg-elev2': '#eef1f5', 'bg-elev3': '#e3e8ee', 'bg-hover': '#e6ebf1',
  'zona-barra': '#ffffff', 'zona-es': '#ffffff', 'zona-prog': '#f3f5f8', 'zona-proy': '#d2e0f2', 'proy-hover': '#e2ebf7', 'proy-sel': '#edf3fb', 'proy-nombre': '#0b0c0e',
  'border': '#d8dde4', 'border-strong': '#c3cad3', 'text': '#1b1f24', 'text-dim': '#56606c', 'text-faint': '#8b95a1',
  'accent': '#1f6fd1', 'accent-bg': '#dbe9fa', 'accent-text': '#ffffff', 'power': '#17a356', 'nopower': '#2f73c6',
  'skipped': '#a7afb9', 'warn': '#a86b0c', 'warn-bg': '#fdf1dc', 'err': '#c9364a', 'err-bg': '#fbe3e6', 'ok': '#17a356',
  'ok-bg': '#ddf4e7', 'led-off': '#cfd5dc', 'kop-wire': '#6b7480', 'kop-sel': '#d48806', 'code-bg': '#f8f9fb',
  'shadow': '0 6px 24px rgba(20, 30, 50, 0.15)',
  'run-bg': '#15803d', 'run-text': '#ffffff', 'stop-bg': '#c81e1e', 'stop-text': '#ffffff',
};

interface Semilla {
  base: 'dark' | 'light';
  /** Fondo de la app */
  fondo: string;
  /** Paneles y tarjetas (solo en las claras; en las oscuras sale del fondo) */
  superficie?: string;
  /** Color del texto */
  tinta: string;
  acento: string;
  /** Texto sobre el acento (botón principal) */
  acentoTexto?: string;
  /** Cambios sobre lo que sale de la mezcla (colores de estado, selección…) */
  extra?: Partial<Colores>;
}

/**
 * Intensidad del color del tema en cada zona del simulador, de menos a más: la del programa (AWL y KOP),
 * el panel de entradas y salidas, el explorador de proyectos y la barra de arriba (RUN/STOP, Hardware…).
 * `barra`, `proy` y `es`: cuánto acento llevan sobre el fondo. `prog` (claras): cuánto se acerca el fondo del
 * programa a la superficie, para que sea más claro que el resto; en las oscuras es el propio fondo.
 * El explorador va entre la E/S y la barra: así no se confunde con la barra lateral ni con el programa, que lo
 * tienen a los lados. En Oscuro y Claro (las de siempre, en theme.css) solo lleva color el explorador.
 */
const ZONA = { dark: { barra: 0.22, proy: 0.18, es: 0.14 }, light: { barra: 0.2, proy: 0.155, es: 0.11, prog: 0.5 } } as const;
/**
 * Filas del explorador sobre su color, para que se vean y se lea la letra atenuada de encima.
 * Oscuras: al pasar el ratón, un poco hacia la tinta; la abierta, hacia el acento.
 * Claras: al pasar el ratón, hacia la superficie; la abierta es la superficie con un poco de acento (más clara que el
 * resto: hacia el acento quedaría oscura y la letra atenuada no se leería).
 */
const FILAS_PROY = { dark: { hover: 0.07, sel: 0.16 }, light: { hover: 0.35, sel: 0.08 } } as const;
/**
 * Nombres de los proyectos en el explorador (los pidió más gruesos y con el máximo contraste): blanco en las oscuras;
 * en las claras, la tinta llevada casi a negro (conserva un poco el tono del tema).
 */
const NOMBRE_PROY_CLARAS = 0.6;
/**
 * Fondo del explorador de proyectos, de sus filas (al pasar el ratón y la abierta) y color de los nombres.
 * `claro`: hacia donde aclaran las filas, la tinta en las oscuras y la superficie en las claras.
 */
function zonaProyectos(base: 'dark' | 'light', fondo: string, tinta: string, claro: string, acento: string): Pick<Colores, 'zona-proy' | 'proy-hover' | 'proy-sel' | 'proy-nombre'> {
  const z = mezclar(fondo, acento, ZONA[base].proy);
  const f = FILAS_PROY[base];
  return {
    'zona-proy': z,
    'proy-hover': mezclar(z, claro, f.hover),
    'proy-sel': base === 'dark' ? mezclar(z, acento, f.sel) : mezclar(claro, acento, f.sel),
    'proy-nombre': base === 'dark' ? '#ffffff' : mezclar(tinta, '#000000', NOMBRE_PROY_CLARAS),
  };
}
/**
 * Botones RUN y STOP de la barra, rellenos y con colores fijos (RUN verde, STOP rojo) para que se vean con cualquier
 * tema, también en los que tienen un acento parecido. En las oscuras, el verde es claro con letra oscura; en las
 * claras, oscuro con letra blanca.
 */
const BOTONES_CPU = {
  dark: { 'run-bg': '#22c55e', 'run-text': '#03200d', 'stop-bg': '#dc2626', 'stop-text': '#ffffff' },
  light: { 'run-bg': '#15803d', 'run-text': '#ffffff', 'stop-bg': '#c81e1e', 'stop-text': '#ffffff' },
} as const;
/** En las oscuras, los paneles llevan también un poco del acento (en las claras lo da la superficie) */
const TINTE_OSCURO = 0.036;

/** Una paleta completa a partir de unos pocos colores: las superficies y los textos son mezclas del fondo con la tinta */
function derivar(s: Semilla): Colores {
  const { fondo, tinta, acento } = s;
  const m = (t: number) => mezclar(fondo, tinta, t);
  if (s.base === 'dark') {
    const estado = { power: '#3ddc84', nopower: '#5aa0e6', warn: '#f2b84b', err: '#ef5b6b', ok: '#3ddc84', 'kop-sel': '#f2b84b', ...s.extra };
    const sf = (t: number) => mezclar(m(t), acento, TINTE_OSCURO);
    return {
      'bg': fondo, 'bg-elev': sf(0.04), 'bg-elev2': sf(0.075), 'bg-elev3': sf(0.11), 'bg-hover': sf(0.125),
      'zona-barra': mezclar(fondo, acento, ZONA.dark.barra), 'zona-es': mezclar(fondo, acento, ZONA.dark.es), 'zona-prog': fondo,
      ...zonaProyectos('dark', fondo, tinta, tinta, acento),
      'border': sf(0.13), 'border-strong': sf(0.2), 'text': tinta, 'text-dim': m(0.72), 'text-faint': m(0.52),
      'accent': acento, 'accent-bg': mezclar(fondo, acento, 0.3), 'accent-text': s.acentoTexto ?? '#ffffff',
      'power': estado.power, 'nopower': estado.nopower, 'skipped': m(0.36),
      'warn': estado.warn, 'warn-bg': mezclar(fondo, estado.warn, 0.17), 'err': estado.err, 'err-bg': mezclar(fondo, estado.err, 0.17),
      'ok': estado.ok, 'ok-bg': mezclar(fondo, estado.ok, 0.15), 'led-off': m(0.16), 'kop-wire': m(0.6), 'kop-sel': estado['kop-sel'],
      'code-bg': m(0.015), 'shadow': '0 6px 24px rgba(0, 0, 0, 0.5)',
      ...BOTONES_CPU.dark,
      ...s.extra,
    };
  }
  const sup = s.superficie ?? '#ffffff';
  const estado = { power: '#17a356', nopower: '#2f73c6', warn: '#a86b0c', err: '#c9364a', ok: '#17a356', 'kop-sel': '#d48806', ...s.extra };
  const [r, g, b] = rgb(tinta);
  return {
    'bg': fondo, 'bg-elev': sup, 'bg-elev2': m(0.03), 'bg-elev3': m(0.075), 'bg-hover': m(0.06),
    'zona-barra': mezclar(fondo, acento, ZONA.light.barra), 'zona-es': mezclar(fondo, acento, ZONA.light.es),
    'zona-prog': mezclar(fondo, sup, ZONA.light.prog), ...zonaProyectos('light', fondo, tinta, sup, acento),
    'border': m(0.125), 'border-strong': m(0.22), 'text': tinta, 'text-dim': m(0.78), 'text-faint': m(0.58),
    'accent': acento, 'accent-bg': mezclar(sup, acento, 0.15), 'accent-text': s.acentoTexto ?? '#ffffff',
    'power': estado.power, 'nopower': estado.nopower, 'skipped': m(0.33),
    'warn': estado.warn, 'warn-bg': mezclar(sup, estado.warn, 0.12), 'err': estado.err, 'err-bg': mezclar(sup, estado.err, 0.12),
    'ok': estado.ok, 'ok-bg': mezclar(sup, estado.ok, 0.13), 'led-off': m(0.17), 'kop-wire': m(0.63), 'kop-sel': estado['kop-sel'],
    'code-bg': mezclar(fondo, sup, 0.8), 'shadow': `0 6px 24px rgba(${r}, ${g}, ${b}, 0.15)`,
    ...BOTONES_CPU.light,
    ...s.extra,
  };
}

export const PALETAS: Paleta[] = [
  { id: 'dark', base: 'dark', c: OSCURO, motivo: ['#4f9cf0', '#3ddc84', '#f2b84b'] },
  { id: 'light', base: 'light', c: CLARO, motivo: ['#1f6fd1', '#17a356', '#e0a020'] },
  {
    id: 'oceano', base: 'dark', motivo: ['#3aa0ff', '#45d6c4', '#f5c451'],
    c: derivar({ base: 'dark', fondo: '#081627', tinta: '#dbe7f4', acento: '#3399f2' }),
  },
  {
    id: 'cielo', base: 'light', motivo: ['#2b86e8', '#4cc3e6', '#f2a93b'],
    c: derivar({ base: 'light', fondo: '#e0edfb', superficie: '#f9fbff', tinta: '#0f2440', acento: '#1565c8' }),
  },
  {
    id: 'rosa', base: 'light', motivo: ['#e8619a', '#f5a3c0', '#a57ee0'],
    c: derivar({ base: 'light', fondo: '#fbe2ec', superficie: '#fff6fa', tinta: '#3b1a29', acento: '#c0306c' }),
  },
  {
    // Lo que en el resto de temas es verde (corriente, pilotos de E/S, RUN, «cargado»…) aquí es rojo,
    // para que destaque sobre la interfaz verde. Los errores, que suelen ser rojos, pasan a magenta.
    // Letra de terminal, casi blanca (también la secundaria, más clara que en las otras oscuras).
    id: 'hacker', base: 'dark', motivo: ['#22e06a', '#139a44', '#a6ffbf'], terminal: true,
    c: derivar({
      base: 'dark', fondo: '#040806', tinta: '#eafdee', acento: '#22e06a', acentoTexto: '#02140a',
      extra: {
        power: '#ff3344', ok: '#ff3344', err: '#ff4fd8', nopower: '#3fb8ff', 'kop-sel': '#e8ff4d',
        'text-dim': mezclar('#040806', '#eafdee', 0.8),
        // RUN en rojo, como sus pilotos, y STOP en blanco: los dos destacan sobre el verde (lo eligió el usuario)
        'run-bg': '#ff3344', 'run-text': '#1a0306', 'stop-bg': '#f4f4f4', 'stop-text': '#0a0f0b',
      },
    }),
    // cronograma: los dos verdes, a rojo y a rojo claro; el rojo rosado de la 4.ª señal, a blanco para no confundirlo
    senales: { '#3ddc84': '#ff3344', '#9bd35a': '#ff9a9a', '#e2667a': '#f2f2f2' },
  },
  {
    id: 'naranja', base: 'light', motivo: ['#f28a2e', '#f7bd4f', '#e8603c'],
    c: derivar({ base: 'light', fondo: '#fce8d6', superficie: '#fff8f1', tinta: '#3a2210', acento: '#b04c08' }),
  },
  {
    id: 'menta', base: 'light', motivo: ['#16a37a', '#6fd1b0', '#f2b84a'],
    c: derivar({ base: 'light', fondo: '#ddf4e9', superficie: '#f6fdf9', tinta: '#0d2c21', acento: '#0a7a57' }),
  },
  {
    id: 'violeta', base: 'dark', motivo: ['#a57cf7', '#f07cc2', '#62c6f2'],
    c: derivar({ base: 'dark', fondo: '#160d29', tinta: '#e9dffa', acento: '#a57cf7', acentoTexto: '#140a2a' }),
  },
  {
    id: 'lavanda', base: 'light', motivo: ['#7d5cf2', '#c99bf5', '#f59bbd'],
    c: derivar({ base: 'light', fondo: '#e9e4fa', superficie: '#faf8ff', tinta: '#221c3f', acento: '#5f40cc' }),
  },
  {
    id: 'cafe', base: 'dark', motivo: ['#e2a15c', '#c8724a', '#93bb6c'],
    c: derivar({ base: 'dark', fondo: '#1b120b', tinta: '#f0e4d8', acento: '#e2a15c', acentoTexto: '#1f1307' }),
  },
  // ── 0.34.0 ──
  {
    // azul muy oscuro, casi negro, con un azul lavanda (más frío que Violeta y más apagado que Azul océano)
    id: 'medianoche', base: 'dark', motivo: ['#8f9bff', '#5ed0e6', '#f5c451'],
    c: derivar({ base: 'dark', fondo: '#0b0d1a', tinta: '#e2e6f5', acento: '#8f9bff', acentoTexto: '#0a0c24' }),
  },
  {
    // gris neutro, sin tinte azul, con verde azulado
    id: 'grafito', base: 'dark', motivo: ['#2fc7a8', '#a7b0bb', '#f2b84b'],
    c: derivar({ base: 'dark', fondo: '#131416', tinta: '#f0f0f2', acento: '#2bb8a8', acentoTexto: '#03201c' }),
  },
  {
    // casi negro con rosa fucsia; los errores, que con este acento se confundirían, van en rojo anaranjado
    id: 'neon', base: 'dark', motivo: ['#ff5fb0', '#7cf0ff', '#ffe066'],
    c: derivar({ base: 'dark', fondo: '#120a1a', tinta: '#f3e6f5', acento: '#ff6bb5', acentoTexto: '#2a0518', extra: { err: '#ff6a3d', nopower: '#6cc7ff' } }),
  },
  {
    // verde muy oscuro con dorado; los avisos, que con este acento se confundirían, van en naranja
    id: 'bosque', base: 'dark', motivo: ['#cfa850', '#6fbf8a', '#e8825a'],
    c: derivar({ base: 'dark', fondo: '#0a140e', tinta: '#edf6ef', acento: '#cfa850', acentoTexto: '#1c1503', extra: { warn: '#ff9d4d', 'kop-sel': '#ff9d4d' } }),
  },
  {
    id: 'turquesa', base: 'light', motivo: ['#0e9aa7', '#5fd0cf', '#f2a65a'],
    c: derivar({ base: 'light', fondo: '#d8f0f1', superficie: '#f5fcfc', tinta: '#0c2b2e', acento: '#0a6e7f' }),
  },
  {
    id: 'limon', base: 'light', motivo: ['#c9b400', '#9bc53d', '#f28a2e'],
    c: derivar({ base: 'light', fondo: '#f5efc6', superficie: '#fffdf0', tinta: '#2d290b', acento: '#6c6400' }),
  },
  {
    id: 'arena', base: 'light', motivo: ['#b9793c', '#d9b382', '#5f9c8a'],
    c: derivar({ base: 'light', fondo: '#eee2cf', superficie: '#fbf7ee', tinta: '#281f15', acento: '#87481c' }),
  },
  {
    // gris neutro, casi sin color: el acento es un gris azulado oscuro
    id: 'niebla', base: 'light', motivo: ['#5b6b82', '#a3aebd', '#d9a441'],
    c: derivar({ base: 'light', fondo: '#e4e7ec', superficie: '#f9fafb', tinta: '#1b1f26', acento: '#3c4a5e' }),
  },
];

export const PALETA = Object.fromEntries(PALETAS.map((p) => [p.id, p])) as Record<PaletaId, Paleta>;

export const esTema = (v: unknown): v is Theme => v === 'system' || PALETA_IDS.includes(v as PaletaId);

/** El tema guardado en los ajustes, al arrancar: Ámbar retro (quitado) pasa a Café, el más parecido; lo desconocido, a «como el sistema» */
export const temaGuardado = (v: unknown): Theme => (v === 'ambar' ? 'cafe' : esTema(v) ? v : 'system');

/** La paleta que se ve: con «como el sistema», la oscura o la clara según el sistema operativo */
export const paletaDe = (t: Theme, sistemaOscuro: boolean): Paleta => (t === 'system' ? PALETA[sistemaOscuro ? 'dark' : 'light'] : PALETA[t] ?? PALETA.dark);

/** Variables CSS de una paleta, para un `style` (vista previa con otros colores sin cambiar la app) */
export function variablesCss(p: Paleta): Record<string, string> {
  return Object.fromEntries(TOKENS.map((t) => [`--${t}`, p.c[t]]));
}

/** Reglas CSS de las paletas que no están en theme.css */
export function cssPaletas(): string {
  return PALETAS.filter((p) => p.id !== 'dark' && p.id !== 'light')
    .map((p) => {
      const sel = `:root[data-theme][data-paleta='${p.id}']`;
      const vars = `color-scheme: ${p.base}; ${TOKENS.map((t) => `--${t}: ${p.c[t]};`).join(' ')}`;
      if (!p.terminal) return `${sel} { ${vars} }`;
      return `${sel} { ${vars} --font: var(--mono); }\n${sel} body { font-size: ${LETRA_TERMINAL}px; }`;
    })
    .join('\n');
}

/** Pone las reglas de las paletas en <head> (una vez). Las ventanas aparte copian los <style> de la principal. */
export function instalarPaletas(doc: Document = document): void {
  if (doc.getElementById('paletas')) return;
  const st = doc.createElement('style');
  st.id = 'paletas';
  st.textContent = cssPaletas();
  doc.head.appendChild(st);
}

/** <html data-theme data-paleta>: lo que lee el CSS. «system» no pone nada (manda prefers-color-scheme). */
export function aplicarTema(doc: Document, t: Theme): void {
  const el = doc.documentElement;
  if (t === 'system' || !PALETA[t]) {
    el.removeAttribute('data-theme');
    el.removeAttribute('data-paleta');
    return;
  }
  el.setAttribute('data-theme', PALETA[t].base);
  if (t === 'dark' || t === 'light') el.removeAttribute('data-paleta');
  else el.setAttribute('data-paleta', t);
}

/** Colores del resaltado del AWL (los de .awl-editor en workbench.css), para la vista previa */
export const SINTAXIS = {
  dark: { kw: '#c792ea', op: '#82aaff', num: '#f78c6c', label: '#ffcb6b' },
  light: { kw: '#7c3aed', op: '#1f5fbf', num: '#b5501b', label: '#9a6700' },
} as const;
