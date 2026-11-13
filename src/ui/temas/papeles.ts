// Temas avanzados: «papeles» de fondo, motivos que se repiten como en un papel de regalo (Temas ▸ Avanzado).
// Cada papel es un azulejo SVG que se repite por todo el fondo de la app. Los motivos son dibujos propios
// (nada de personajes ni marcas) y se pintan con los colores del tema básico elegido (`motivo` de la paleta),
// así que combinan con cualquier paleta. «propia» es una imagen que elige el usuario y se queda en su ordenador.
import { mezclar, type ColoresMotivo, type Paleta } from './paletas';

// 0.34.0: catorce más, los de la segunda línea de cada grupo
export const PAPEL_IDS = [
  'contactos', 'rayos', 'engranajes', 'circuito', 'binario',
  'pulsos', 'bombillas', 'tuercas',
  'gatos', 'espacio', 'estrellas', 'corazones', 'notas', 'copos', 'hojas',
  'nubes', 'peces', 'globos', 'cerezas', 'setas',
  'olas', 'lunares', 'vichy',
  'rayas', 'zigzag', 'rombos', 'panal', 'cuadricula', 'escamas',
] as const;
export type PapelDibujoId = (typeof PAPEL_IDS)[number];
/** '' = sin papel */
export type PapelId = '' | PapelDibujoId | 'propia';

export type GrupoPapel = 'tecnico' | 'divertido' | 'clasico';

interface Ctx { c: ColoresMotivo; fondo: string; tinta: string }

interface PapelDef {
  id: PapelDibujoId;
  grupo: GrupoPapel;
  /** Lado del azulejo, en píxeles con tamaño 100 % */
  tam: number;
  dibujar: (x: Ctx) => string;
}

// ───────── utilidades ─────────

const n = (v: number) => +v.toFixed(2);

const en = (x: number, y: number, contenido: string, rot = 0, esc = 1) =>
  `<g transform="translate(${n(x)} ${n(y)})${rot ? ` rotate(${rot})` : ''}${esc !== 1 ? ` scale(${esc})` : ''}">${contenido}</g>`;

/** Un motivo en (x, y). Si se sale del azulejo (radio `r`), se repite por el lado contrario para que no se corte */
function poner(tam: number, x: number, y: number, r: number, contenido: string, rot = 0, esc = 1): string {
  const dx = [0, ...(x - r < 0 ? [tam] : []), ...(x + r > tam ? [-tam] : [])];
  const dy = [0, ...(y - r < 0 ? [tam] : []), ...(y + r > tam ? [-tam] : [])];
  return dx.flatMap((a) => dy.map((b) => en(x + a, y + b, contenido, rot, esc))).join('');
}

const trazo = (color: string, ancho: number, d: string) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"/>`;
const relleno = (color: string, d: string, extra = '') => `<path d="${d}" fill="${color}"${extra}/>`;
const circulo = (x: number, y: number, r: number, color: string, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${color}"${extra}/>`;

/** Polígono de una estrella de `puntas` puntas */
function estrella(r: number, ri: number, puntas = 5): string {
  const p: string[] = [];
  for (let i = 0; i < puntas * 2; i++) {
    const a = (Math.PI * i) / puntas - Math.PI / 2;
    const rr = i % 2 ? ri : r;
    p.push(`${n(Math.cos(a) * rr)} ${n(Math.sin(a) * rr)}`);
  }
  return `M${p.join('L')}Z`;
}

/** Rueda dentada con agujero (fill-rule evenodd) */
function engranaje(r: number, dientes: number): string {
  const ri = r * 0.78;
  const paso = (2 * Math.PI) / dientes;
  const p: string[] = [];
  for (let i = 0; i < dientes; i++) {
    const a = i * paso;
    for (const [f, rr] of [[-0.3, ri], [-0.17, r], [0.17, r], [0.3, ri]] as const) {
      p.push(`${n(Math.cos(a + f * paso) * rr)} ${n(Math.sin(a + f * paso) * rr)}`);
    }
  }
  const h = r * 0.32;
  return `M${p.join('L')}ZM${n(h)} 0A${n(h)} ${n(h)} 0 1 0 ${n(-h)} 0A${n(h)} ${n(h)} 0 1 0 ${n(h)} 0Z`;
}

// ───────── motivos (centrados en 0,0; unos 16 px de radio) ─────────

const contactoNA = (c: string) => trazo(c, 3.2, 'M-20 0H-6M-6-10V10M6-10V10M6 0H20');
const contactoNC = (c: string) => trazo(c, 3.2, 'M-20 0H-6M-6-10V10M6-10V10M6 0H20M-10 10L10-10');
const bobina = (c: string) => trazo(c, 3.2, 'M-20 0H-9M9 0H20M-4-10Q-11 0-4 10M4-10Q11 0 4 10');
const piloto = (c: string) => trazo(c, 3, 'M-20 0H-9M9 0H20M-6.4-6.4L6.4 6.4M-6.4 6.4L6.4-6.4') + `<circle r="9" fill="none" stroke="${c}" stroke-width="3"/>`;
const rayo = (c: string) => relleno(c, 'M4-16-9 2h8L-4 16 10-4H2z', ` stroke="${c}" stroke-width="1.5" stroke-linejoin="round"`);
const destello = (c: string) => relleno(c, 'M0-9Q1.2-1.2 9 0Q1.2 1.2 0 9Q-1.2 1.2-9 0Q-1.2-1.2 0-9z');
const corazon = (c: string) => relleno(c, 'M0 10C-7 5-13 1-13-5C-13-9.5-9.8-12-6.5-12C-3.5-12-1.3-10-0-7.6C1.3-10 3.5-12 6.5-12C9.8-12 13-9.5 13-5C13 1 7 5 0 10Z');
const brillo = (c: string) => relleno(c, 'M-6-6.5a2.6 2.6 0 1 0 0.01 0z', ' opacity="0.55"');

function gato(c: string, x: Ctx): string {
  const claro = mezclar(c, '#ffffff', 0.55);
  const oscuro = mezclar(c, '#000000', 0.45);
  return [
    relleno(c, 'M-13-1L-14-16L-5-10Q0-11.5 5-10L14-16L13-1Q13 11 0 11Q-13 11-13-1Z'),
    relleno(claro, 'M-11.5-4L-12-12.5L-7-9.5Z M11.5-4L12-12.5L7-9.5Z'),
    relleno(claro, 'M-6 4Q-6-1 0-1Q6-1 6 4Q6 8.5 0 8.5Q-6 8.5-6 4Z'),
    `<ellipse cx="-5" cy="-3" rx="2.6" ry="3.1" fill="#ffffff"/><ellipse cx="5" cy="-3" rx="2.6" ry="3.1" fill="#ffffff"/>`,
    circulo(-4.4, -2.6, 1.5, '#1b1f24'), circulo(5.6, -2.6, 1.5, '#1b1f24'),
    relleno('#f28aa8', 'M-2 1.2H2L0 3.4Z'),
    trazo(oscuro, 1.1, 'M0 3.4V5M0 5Q-1.6 6.6-3 5.4M0 5Q1.6 6.6 3 5.4'),
    trazo(x.tinta, 1, 'M-7 3.5H-18M-7 5.8L-17 8.5M7 3.5H18M7 5.8L17 8.5'),
  ].join('');
}

const huella = (c: string) =>
  `<ellipse cx="0" cy="4" rx="6" ry="5" fill="${c}"/>` + [[-7, -3], [-2.6, -7.5], [2.6, -7.5], [7, -3]].map(([a, b]) => circulo(a, b, 2.6, c)).join('');

function cohete(x: Ctx): string {
  const [c0, c1, c2] = x.c;
  return [
    relleno(c2, 'M-3.5 10Q0 21 3.5 10Z'),
    relleno(c1, 'M-5 1L-11 11L-5 9Z M5 1L11 11L5 9Z'),
    relleno(c0, 'M0-17C7-11 7.5-2 5.5 10H-5.5C-7.5-2-7-11 0-17Z'),
    circulo(0, -4, 3.4, '#ffffff', ` stroke="${c1}" stroke-width="1.8"`),
  ].join('');
}

function planeta(x: Ctx): string {
  const [, c1, c2] = x.c;
  return [
    `<ellipse rx="17" ry="5" fill="none" stroke="${c2}" stroke-width="2.6" transform="rotate(-18)"/>`,
    circulo(0, 0, 10, c1),
    circulo(-3, -3, 2.2, mezclar(c1, '#000000', 0.2)), circulo(3.5, 2.5, 1.6, mezclar(c1, '#000000', 0.2)),
    // la mitad de delante del anillo, encima del planeta
    `<path d="M-17 0A17 5 0 0 0 17 0" fill="none" stroke="${c2}" stroke-width="2.6" transform="rotate(-18)"/>`,
  ].join('');
}

const corchea = (c: string) =>
  `<ellipse cx="-4" cy="9" rx="5.2" ry="3.8" fill="${c}" transform="rotate(-20 -4 9)"/>` + trazo(c, 2.2, 'M0.6 8V-13') + relleno(c, 'M0.6-13Q8-10 8.5-2Q6.5-6.5 0.6-7.5Z');
const semicorcheas = (c: string) =>
  `<ellipse cx="-9" cy="10" rx="4.8" ry="3.5" fill="${c}" transform="rotate(-20 -9 10)"/><ellipse cx="8" cy="7" rx="4.8" ry="3.5" fill="${c}" transform="rotate(-20 8 7)"/>` +
  trazo(c, 2.2, 'M-5 9V-10M12 6V-13') + relleno(c, 'M-5-10L12-13V-8.5L-5-5.5Z');

function copo(c: string, r: number): string {
  const brazo = `M0 0V${-r}M0 ${n(-r * 0.55)}L${n(-r * 0.28)} ${n(-r * 0.82)}M0 ${n(-r * 0.55)}L${n(r * 0.28)} ${n(-r * 0.82)}`;
  return [0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a})">${trazo(c, 2.1, brazo)}</g>`).join('');
}

const hoja = (c: string, x: Ctx) =>
  relleno(c, 'M0-15C9.5-8.5 9.5 6 0 15C-9.5 6-9.5-8.5 0-15Z') + trazo(x.fondo, 1.4, 'M0-11V13M0-3L4.5-7M0 3L-4.5-1M0 8L4 4.5');

// ── 0.34.0 ──

function bombilla(c: string, x: Ctx, encendida: boolean): string {
  return [
    encendida ? trazo(x.c[2], 2, 'M0-19V-23M-10.5-14.5L-13.5-17.5M10.5-14.5L13.5-17.5M-14.5-5H-18.5M14.5-5H18.5') : '',
    circulo(0, -5, 9, c),
    relleno(c, 'M-5 1H5V7H-5Z'),
    relleno(mezclar(c, '#000000', 0.4), 'M-4.2 7.5H4.2V10.5Q4.2 13 0 13Q-4.2 13-4.2 10.5Z'),
    trazo(x.fondo, 1.3, 'M-3.6-3L-1.8-6.5L0-3L1.8-6.5L3.6-3'),
    encendida ? brillo('#ffffff') : '',
  ].join('');
}

/** Polígono regular de `lados` lados */
function poligono(r: number, lados: number): string {
  const p: string[] = [];
  for (let i = 0; i < lados; i++) {
    const a = (2 * Math.PI * i) / lados;
    p.push(`${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`);
  }
  return `M${p.join('L')}Z`;
}
const agujero = (h: number) => `M${n(h)} 0A${n(h)} ${n(h)} 0 1 0 ${n(-h)} 0A${n(h)} ${n(h)} 0 1 0 ${n(h)} 0Z`;
const tuerca = (c: string, r: number) => relleno(c, poligono(r, 6) + agujero(r * 0.45), ' fill-rule="evenodd"');
const tornillo = (c: string, x: Ctx) => circulo(0, 0, 8, c) + trazo(x.fondo, 2.2, 'M-4.6 0H4.6M0-4.6V4.6');
const arandela = (c: string) => `<circle r="7" fill="none" stroke="${c}" stroke-width="4"/>`;

const nube = (c: string) => relleno(c, 'M-14 6a6 6 0 0 1 0-12a8 8 0 0 1 14-4a7 7 0 0 1 13 4a6 6 0 0 1 1 12z');
const gota = (c: string) => relleno(c, 'M0-6C3-2 4 0 4 2a4 4 0 0 1-8 0C-4 0-3-2 0-6z');
const sol = (c: string) => circulo(0, 0, 6.5, c) + [0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<g transform="rotate(${a})">${trazo(c, 2, 'M0-10V-13.5')}</g>`).join('');

/** `s` = 1 mira a la izquierda; -1, a la derecha */
function pez(c: string, s: 1 | -1): string {
  const claro = mezclar(c, '#ffffff', 0.45);
  return [
    relleno(claro, `M${9 * s} 0L${19 * s}-7.5Q${15 * s} 0 ${19 * s} 7.5Z`),
    `<ellipse rx="12" ry="7.5" fill="${c}"/>`,
    relleno(claro, `M${-1 * s}-7Q${4 * s}-13 ${7 * s}-5.5Z`),
    trazo(claro, 1.3, `M${1 * s}-3Q${4 * s} 0 ${1 * s} 3`),
    circulo(-6.5 * s, -1.5, 2.1, '#ffffff'), circulo(-7 * s, -1.5, 1, '#1b1f24'),
  ].join('');
}
const burbuja = (c: string, r: number) => `<circle r="${r}" fill="none" stroke="${c}" stroke-width="1.6"/>`;

const globo = (c: string, x: Ctx) =>
  trazo(x.tinta, 1, 'M0 8Q4 13 0 18Q-3 21.5 0 25') + `<ellipse cy="-5" rx="9.5" ry="11.5" fill="${c}"/>` + relleno(c, 'M-2.6 9L0 5.5L2.6 9Z') +
  `<ellipse cx="-3.6" cy="-9.5" rx="2" ry="3.4" fill="#ffffff" opacity="0.5" transform="rotate(24 -3.6 -9.5)"/>`;

const cerezas = (c: string, tallo: string) =>
  trazo(tallo, 1.8, 'M-6 3Q-5-8 3-13M7 5Q8-5 3-13') + relleno(tallo, 'M3-13Q10-18 15-11Q8-7.5 3-13Z') +
  circulo(-6, 8, 6.2, c) + circulo(7, 10, 6.2, c) + circulo(-8, 6, 1.6, '#ffffff', ' opacity="0.55"') + circulo(5, 8, 1.6, '#ffffff', ' opacity="0.55"');

const seta = (c: string) =>
  relleno(mezclar(c, '#ffffff', 0.72), 'M-4.5 0H4.5L5.5 10.5Q0 13.5-5.5 10.5Z') + relleno(c, 'M-13.5 1A13.5 13 0 0 1 13.5 1Q0 4-13.5 1Z') +
  [[-5.5, -5, 2.3], [3.5, -7.5, 1.9], [7.5, -2.5, 1.5], [-9.5, -1.5, 1.2]].map(([a, b, r]) => circulo(a, b, r, '#ffffff', ' opacity="0.85"')).join('');

/** Panal: 7 × 8 celdas en un azulejo cuadrado (las celdas quedan un 1 % más anchas que un hexágono regular) */
function panal(tam: number, x: Ctx): string {
  const cols = 7;
  const filas = 8;
  const a = tam / cols / 2;
  const s = tam / filas / 1.5;
  const centro = (f: number, col: number): [number, number] => [col * 2 * a + (f % 2 ? a : 0), f * 1.5 * s + s];
  const celda = (cx: number, cy: number) =>
    `M${n(cx)} ${n(cy - s)}L${n(cx + a)} ${n(cy - s / 2)}V${n(cy + s / 2)}L${n(cx)} ${n(cy + s)}L${n(cx - a)} ${n(cy + s / 2)}V${n(cy - s / 2)}Z`;
  // de cada celda, solo el lado izquierdo y los dos de arriba: los demás los pintan las vecinas
  let d = '';
  for (let f = -1; f <= filas; f++) {
    for (let col = 0; col <= cols; col++) {
      const [cx, cy] = centro(f, col);
      d += `M${n(cx - a)} ${n(cy + s / 2)}V${n(cy - s / 2)}L${n(cx)} ${n(cy - s)}L${n(cx + a)} ${n(cy - s / 2)}`;
    }
  }
  const llena = (f: number, col: number, color: string, op: number) => relleno(color, celda(...centro(f, col)), ` opacity="${op}"`);
  return [llena(1, 1, x.c[1], 0.7), llena(2, 5, x.c[2], 0.7), llena(4, 3, x.c[0], 0.45), llena(5, 0, x.c[2], 0.5), llena(6, 5, x.c[1], 0.7), trazo(x.c[0], 1.6, d)].join('');
}

// ───────── papeles ─────────

const PAPELES: PapelDef[] = [
  {
    id: 'contactos', grupo: 'tecnico', tam: 128,
    dibujar: ({ c }) => [
      poner(128, 32, 32, 22, contactoNA(c[0])), poner(128, 96, 32, 22, contactoNC(c[2])),
      poner(128, 32, 96, 22, piloto(c[2])), poner(128, 96, 96, 22, bobina(c[1])),
    ].join(''),
  },
  {
    id: 'rayos', grupo: 'tecnico', tam: 112,
    dibujar: ({ c }) => [
      poner(112, 28, 28, 18, rayo(c[0]), -14), poner(112, 84, 84, 18, rayo(c[2]), 16),
      poner(112, 86, 26, 10, destello(c[1])), poner(112, 26, 86, 10, destello(c[1]), 0, 0.7),
      circulo(56, 56, 2.2, c[1]), circulo(4, 56, 1.8, c[2]), circulo(108, 56, 1.8, c[2]),
    ].join(''),
  },
  {
    id: 'engranajes', grupo: 'tecnico', tam: 120,
    dibujar: ({ c }) => [
      poner(120, 32, 34, 17, relleno(c[0], engranaje(16, 10), ' fill-rule="evenodd"')),
      poner(120, 49, 51, 11, relleno(c[1], engranaje(10, 7), ' fill-rule="evenodd"'), 13),
      poner(120, 92, 92, 15, relleno(c[2], engranaje(14, 9), ' fill-rule="evenodd"'), 8),
      poner(120, 94, 28, 8, relleno(c[1], engranaje(7, 6), ' fill-rule="evenodd"')),
      poner(120, 28, 96, 8, relleno(c[0], engranaje(6.5, 6), ' fill-rule="evenodd"'), 20),
    ].join(''),
  },
  {
    id: 'circuito', grupo: 'tecnico', tam: 120,
    dibujar: ({ c, fondo }) => {
      const pad = (x: number, y: number) => circulo(x, y, 3.4, fondo, ` stroke="${c[1]}" stroke-width="2.2"`);
      const patas = [19, 25, 31, 37].map((px) => `M${px} 74V78M${px} 96V100`).join('');
      return [
        trazo(c[0], 2.4, 'M0 30H34L48 16H78L92 30H120'),
        trazo(c[0], 2.4, 'M104 0V48L90 62V96L104 110V120'),
        trazo(c[1], 2.2, 'M20 56H44L58 70'),
        trazo(c[1], 2.2, 'M42 87H66L76 77'),
        `<rect x="14" y="78" width="28" height="18" rx="2.5" fill="${c[2]}"/>`, trazo(c[2], 2, patas),
        pad(104, 30), pad(20, 56), pad(58, 70), pad(76, 77), pad(48, 16),
      ].join('');
    },
  },
  {
    id: 'binario', grupo: 'tecnico', tam: 120,
    dibujar: ({ c }) => {
      const t = (x: number, y: number, s: string, col: string) =>
        `<text x="${x}" y="${y}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="13" font-weight="700" fill="${col}">${s}</text>`;
      return [
        t(8, 22, '1011', c[0]), t(68, 22, '0110', c[1]),
        t(38, 52, '1101', c[2]), t(98, 52, '0010', c[0]), t(-22, 52, '0010', c[0]),
        t(8, 82, '0111', c[1]), t(68, 82, '1001', c[2]),
        t(38, 112, '0100', c[0]), t(98, 112, '1110', c[1]), t(-22, 112, '1110', c[1]),
      ].join('');
    },
  },
  {
    // tres señales de 0 y 1, como las del cronograma
    id: 'pulsos', grupo: 'tecnico', tam: 120,
    dibujar: ({ c }) => [
      trazo(c[0], 3, 'M0 30H20V14H50V30H80V14H100V30H120'),
      trazo(c[1], 3, 'M0 70H15V54H45V70H75V54H105V70H120'),
      trazo(c[2], 3, 'M0 110H40V94H100V110H120'),
      ...[20, 50, 80, 100].map((px) => circulo(px, 14, 2.4, c[0])), ...[40, 100].map((px) => circulo(px, 94, 2.4, c[2])),
    ].join(''),
  },
  {
    id: 'bombillas', grupo: 'tecnico', tam: 112,
    dibujar: (x) => [
      poner(112, 28, 32, 24, bombilla(x.c[0], x, true), -12), poner(112, 84, 88, 24, bombilla(x.c[1], x, false), 14),
      poner(112, 86, 26, 10, destello(x.c[2]), 0, 0.8), poner(112, 24, 88, 10, destello(x.c[2]), 0, 0.6),
      circulo(56, 58, 2, x.c[1]), circulo(56, 2, 1.6, x.c[0]),
    ].join(''),
  },
  {
    id: 'tuercas', grupo: 'tecnico', tam: 120,
    dibujar: (x) => [
      poner(120, 30, 32, 15, tuerca(x.c[0], 14), 10), poner(120, 90, 90, 15, tuerca(x.c[2], 13), 28),
      poner(120, 92, 28, 9, tornillo(x.c[1], x), 20), poner(120, 28, 92, 10, arandela(x.c[1])),
      poner(120, 60, 60, 6, tornillo(x.c[0], x), 45, 0.55), poner(120, 60, 0, 6, arandela(x.c[2]), 0, 0.5), poner(120, 0, 60, 6, tuerca(x.c[1], 6), 15),
    ].join(''),
  },
  {
    id: 'gatos', grupo: 'divertido', tam: 128,
    dibujar: (x) => [
      poner(128, 32, 36, 19, gato(x.c[0], x)), poner(128, 96, 98, 19, gato(x.c[1], x), 8),
      poner(128, 96, 30, 11, huella(x.c[2]), 22), poner(128, 30, 96, 11, huella(x.c[2]), -16),
    ].join(''),
  },
  {
    id: 'espacio', grupo: 'divertido', tam: 128,
    dibujar: (x) => [
      poner(128, 32, 36, 21, cohete(x), 35), poner(128, 96, 96, 19, planeta(x)),
      poner(128, 96, 28, 10, destello(x.c[2])), poner(128, 28, 100, 10, destello(x.c[0]), 0, 0.7),
      circulo(64, 64, 1.8, x.c[2]), circulo(60, 10, 1.4, x.c[1]), circulo(118, 62, 1.5, x.c[0]), circulo(10, 64, 1.2, x.c[2]),
    ].join(''),
  },
  {
    id: 'estrellas', grupo: 'divertido', tam: 120,
    dibujar: ({ c }) => {
      const e = (col: string, r: number) => relleno(col, estrella(r, r * 0.46), ` stroke="${col}" stroke-width="2" stroke-linejoin="round"`);
      return [
        poner(120, 30, 30, 16, e(c[0], 13), -10), poner(120, 90, 90, 16, e(c[2], 13), 12),
        poner(120, 90, 28, 10, destello(c[1])), poner(120, 28, 92, 9, e(c[1], 7), 20),
        circulo(60, 60, 2.2, c[2]), circulo(60, 4, 1.6, c[0]), circulo(4, 60, 1.6, c[0]),
      ].join('');
    },
  },
  {
    id: 'corazones', grupo: 'divertido', tam: 112,
    dibujar: ({ c }) => [
      poner(112, 28, 28, 16, corazon(c[0]) + brillo('#ffffff'), -14), poner(112, 84, 84, 16, corazon(c[1]) + brillo('#ffffff'), 12),
      poner(112, 84, 26, 9, corazon(c[2]), 18, 0.55), poner(112, 26, 84, 9, corazon(c[2]), -8, 0.55),
    ].join(''),
  },
  {
    id: 'notas', grupo: 'divertido', tam: 112,
    dibujar: ({ c }) => [
      poner(112, 28, 30, 16, corchea(c[0]), -10), poner(112, 84, 82, 18, semicorcheas(c[1]), 8),
      poner(112, 86, 26, 10, destello(c[2]), 0, 0.8), poner(112, 26, 86, 10, corchea(c[2]), 12, 0.6),
    ].join(''),
  },
  {
    id: 'copos', grupo: 'divertido', tam: 120,
    dibujar: ({ c }) => [
      poner(120, 30, 30, 15, copo(c[0], 13)), poner(120, 90, 90, 15, copo(c[1], 13), 15),
      poner(120, 90, 28, 9, copo(c[2], 7), 10), poner(120, 28, 92, 9, copo(c[2], 7)),
      circulo(60, 60, 2, c[1]), circulo(60, 2, 1.5, c[0]), circulo(2, 60, 1.5, c[0]),
    ].join(''),
  },
  {
    id: 'hojas', grupo: 'divertido', tam: 120,
    dibujar: (x) => [
      poner(120, 30, 32, 16, hoja(x.c[0], x), -30), poner(120, 88, 88, 16, hoja(x.c[1], x), 40),
      poner(120, 90, 26, 11, hoja(x.c[2], x), 115, 0.65), poner(120, 28, 90, 11, hoja(x.c[1], x), 200, 0.65),
    ].join(''),
  },
  {
    id: 'nubes', grupo: 'divertido', tam: 128,
    dibujar: ({ c }) => [
      poner(128, 36, 32, 22, nube(c[0]), 0, 1.15), poner(128, 98, 94, 20, nube(c[1])),
      poner(128, 98, 30, 14, sol(c[2])),
      ...[[24, 58], [36, 64], [48, 57]].map(([a, b]) => poner(128, a, b, 6, gota(c[1]), 12, 0.6)),
      poner(128, 30, 104, 12, nube(c[0]), 0, 0.5),
    ].join(''),
  },
  {
    id: 'peces', grupo: 'divertido', tam: 128,
    dibujar: ({ c }) => [
      poner(128, 34, 34, 20, pez(c[0], 1), -8), poner(128, 96, 98, 20, pez(c[1], -1), -6),
      poner(128, 92, 30, 6, burbuja(c[2], 4.5)), poner(128, 102, 18, 4, burbuja(c[2], 2.6)), poner(128, 84, 14, 3, burbuja(c[2], 1.8)),
      poner(128, 30, 96, 6, burbuja(c[2], 4)), poner(128, 20, 82, 4, burbuja(c[2], 2.4)),
      poner(128, 64, 66, 14, pez(c[2], 1), 6, 0.5),
    ].join(''),
  },
  {
    id: 'globos', grupo: 'divertido', tam: 120,
    dibujar: (x) => [
      poner(120, 30, 30, 27, globo(x.c[0], x), -8), poner(120, 90, 88, 27, globo(x.c[1], x), 10),
      poner(120, 92, 26, 19, globo(x.c[2], x), 14, 0.68), poner(120, 28, 92, 19, globo(x.c[2], x), -12, 0.68),
      circulo(60, 60, 1.8, x.c[0]), circulo(60, 4, 1.5, x.c[1]), circulo(4, 60, 1.5, x.c[1]),
    ].join(''),
  },
  {
    id: 'cerezas', grupo: 'divertido', tam: 120,
    dibujar: ({ c }) => [
      poner(120, 30, 32, 19, cerezas(c[0], c[1]), -6), poner(120, 90, 90, 19, cerezas(c[2], c[1]), 12),
      poner(120, 92, 28, 12, cerezas(c[2], c[1]), 20, 0.6), poner(120, 28, 92, 12, cerezas(c[0], c[1]), -18, 0.6),
    ].join(''),
  },
  {
    id: 'setas', grupo: 'divertido', tam: 120,
    dibujar: ({ c }) => [
      poner(120, 30, 34, 16, seta(c[0]), -8), poner(120, 90, 92, 16, seta(c[2]), 9),
      poner(120, 92, 30, 11, seta(c[1]), 14, 0.65), poner(120, 28, 94, 11, seta(c[1]), -12, 0.65),
      circulo(60, 62, 1.8, c[0]), circulo(60, 4, 1.5, c[2]),
    ].join(''),
  },
  {
    id: 'olas', grupo: 'clasico', tam: 96,
    dibujar: ({ c }) => [0, 1, 2].map((i) => {
      const y = 16 + i * 32;
      return trazo(c[i], 3.2, `M0 ${y}Q24 ${y - 9} 48 ${y}T96 ${y}`) + trazo(c[i], 1.4, `M0 ${y + 8}Q24 ${y - 1} 48 ${y + 8}T96 ${y + 8}`);
    }).join(''),
  },
  {
    id: 'lunares', grupo: 'clasico', tam: 64,
    dibujar: ({ c }) => [
      ...[[0, 0], [64, 0], [0, 64], [64, 64]].map(([x, y]) => circulo(x, y, 8, c[0])),
      circulo(32, 32, 8, c[1]),
      ...[[32, 0], [0, 32], [64, 32], [32, 64]].map(([x, y]) => circulo(x, y, 3, c[2])),
    ].join(''),
  },
  {
    id: 'vichy', grupo: 'clasico', tam: 40,
    dibujar: ({ c }) => `<rect width="20" height="40" fill="${c[0]}" opacity="0.5"/><rect width="40" height="20" fill="${c[0]}" opacity="0.5"/>` +
      trazo(c[1], 1, 'M30 0V40M0 30H40'),
  },
  {
    id: 'rayas', grupo: 'clasico', tam: 48,
    dibujar: ({ c }) => `<path d="M-12 12L12-12M0 48L48 0M36 60L60 36" stroke="${c[0]}" stroke-width="11" opacity="0.55" fill="none"/>` +
      `<path d="M-12 36L36-12M12 60L60 12" stroke="${c[1]}" stroke-width="2.5" fill="none"/>`,
  },
  {
    id: 'zigzag', grupo: 'clasico', tam: 48,
    dibujar: ({ c }) => [0, 1, 2].map((i) => {
      const y = 11 + i * 16;
      return trazo(c[i], 3, `M-12 ${y}L0 ${y - 7}L12 ${y}L24 ${y - 7}L36 ${y}L48 ${y - 7}L60 ${y}`);
    }).join(''),
  },
  {
    id: 'rombos', grupo: 'clasico', tam: 64,
    dibujar: ({ c }) => relleno(c[0], 'M32 4L56 32L32 60L8 32Z', ' opacity="0.5"') + poner(64, 0, 0, 30, relleno(c[1], 'M0-28L24 0L0 28L-24 0Z', ' opacity="0.5"')) +
      `<path d="M0 0L64 64M64 0L0 64" stroke="${c[2]}" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>`,
  },
  { id: 'panal', grupo: 'clasico', tam: 126, dibujar: (x) => panal(126, x) },
  {
    // papel cuadriculado: líneas finas cada 16 y una más gruesa cada 80
    id: 'cuadricula', grupo: 'clasico', tam: 80,
    dibujar: ({ c }) => `<path d="${[16, 32, 48, 64].map((v) => `M${v} 0V80M0 ${v}H80`).join('')}" stroke="${c[0]}" stroke-width="0.9" opacity="0.6" fill="none"/>` +
      `<path d="M0 0V80M80 0V80M0 0H80M0 80H80" stroke="${c[0]}" stroke-width="2.2" fill="none"/>` + poner(80, 0, 0, 4, circulo(0, 0, 3, c[2])) + circulo(40, 40, 1.6, c[1]),
  },
  {
    id: 'escamas', grupo: 'clasico', tam: 60,
    dibujar: ({ c }) => [0, 1, 2, 3, 4].map((i) => {
      const y = i * 15;
      const x0 = i % 2 ? 0 : -15;
      const arcos = [0, 1, 2].map((k) => `A15 15 0 0 0 ${x0 + (k + 1) * 30} ${y}`).join('');
      return trazo(c[[0, 1, 2, 1, 0][i]], 2, `M${x0} ${y}${arcos}`);
    }).join(''),
  },
];

export const PAPEL = Object.fromEntries(PAPELES.map((p) => [p.id, p])) as Record<PapelDibujoId, PapelDef>;
export const GRUPOS_PAPEL: GrupoPapel[] = ['tecnico', 'divertido', 'clasico'];
export const papelesDe = (g: GrupoPapel) => PAPELES.filter((p) => p.grupo === g);

export const esPapel = (v: unknown): v is PapelId => v === '' || v === 'propia' || PAPEL_IDS.includes(v as PapelDibujoId);

/** Lo de dentro del azulejo (para un <pattern> de la vista previa) */
export function dibujoPapel(id: PapelDibujoId, p: Paleta): string {
  return PAPEL[id].dibujar({ c: p.motivo, fondo: p.c.bg, tinta: p.c.text });
}

/** El azulejo como imagen para CSS: `url("data:image/svg+xml,…")` y su lado en píxeles con el tamaño elegido */
export function imagenPapel(id: PapelDibujoId, p: Paleta, tamano: number): { url: string; lado: number } {
  const def = PAPEL[id];
  const lado = n(def.tam * tamano);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${def.tam} ${def.tam}">${dibujoPapel(id, p)}</svg>`;
  return { url: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, lado };
}

/** Intensidad (10–100 %) y tamaño (50–200 %) */
export const INTENSIDAD = { min: 0.1, max: 1, defecto: 0.35 };
export const TAMANO = { min: 0.5, max: 2, defecto: 1 };
export const limitar = (v: number, r: { min: number; max: number; defecto: number }) => (Number.isFinite(v) ? Math.min(r.max, Math.max(r.min, v)) : r.defecto);
