// Cronogramas de la marca de ciclo (§2.6), los flancos (§6.5) y los temporizadores (§6.6) para la web. Sustituyen a los de la
// referencia, que están en ASCII: las señales salen de simular cada caso con la CPU de la app.
import { CLOCK_PERIODS_MS, CPU } from '../../src/core/cpu';
import { testRead, testWrite } from '../../src/core/testio';
import { displayOperand } from '../../src/core/translate';
import type { Idioma } from '../../web/teoria/paginas';
import { grafcet, type TextosGrafcet } from './grafcet';
import { esc } from './html';

type Tipo = 'SI' | 'SV' | 'SE' | 'SS' | 'SA';
type Tramo = [number, number];

export interface TextosCronogramas {
  nota: string;
  marcaCiclo: { pie: string };
  /** GRAFCET del semáforo (página de secuencias) */
  grafcet: TextosGrafcet;
  flancos: { pie: string };
  temporizadores: Record<Tipo, { nemo: string; nombre: string; cuadro: string; pie: string }>;
}

interface Fila {
  nombre: string;
  valores: number[];
  /** Las salidas van en verde y las entradas en azul */
  salida: boolean;
  /** Tramos que miden t (en muestras), dibujados debajo de la fila */
  cotas?: Tramo[];
  /** Texto a la derecha de la señal (el periodo, en la marca de ciclo) */
  derecha?: string;
}

const CICLO_MS = 10;

// ───────── Simulación ─────────

const activa = (tramos: Tramo[], ms: number) => (tramos.some(([a, b]) => ms >= a && ms < b) ? 1 : 0);

/** Arranque S (E 0.0), reset R (E 0.1) y Q (A 4.0) de un temporizador con t = 1 s, ciclo a ciclo */
function temporizador(tipo: Tipo, s: Tramo[], r: Tramo[], totalMs: number) {
  const cpu = new CPU(`U E 0.0\nL S5T#1S\n${tipo} T 1\nU E 0.1\nR T 1\nU T 1\n= A 4.0`);
  const S: number[] = [];
  const R: number[] = [];
  const Q: number[] = [];
  for (let ms = 0; ms < totalMs; ms += CICLO_MS) {
    testWrite(cpu, 'E0.0', activa(s, ms));
    testWrite(cpu, 'E0.1', activa(r, ms));
    cpu.scan();
    S.push(activa(s, ms));
    R.push(activa(r, ms));
    Q.push(testRead(cpu, 'A4.0'));
  }
  return { S, R, Q };
}

/** Los 8 bits de la marca de ciclo (en MB100), ciclo a ciclo */
function marcaCiclo(totalMs: number): number[][] {
  const cpu = new CPU('NOP 0');
  cpu.clockByte = 100;
  const bits: number[][] = Array.from({ length: 8 }, () => []);
  for (let ms = 0; ms < totalMs; ms += CICLO_MS) {
    cpu.scan();
    for (let b = 0; b < 8; b++) bits[b].push(testRead(cpu, `M100.${b}`));
  }
  return bits;
}

/** E 0.0 y las salidas de FP y FN, un valor por ciclo */
function flancos(e: Tramo[], ciclos: number) {
  const cpu = new CPU('U E 0.0\nFP M 10.0\n= M 10.1\nU E 0.0\nFN M 10.2\n= M 10.3');
  const E: number[] = [];
  const P: number[] = [];
  const N: number[] = [];
  for (let c = 0; c < ciclos; c++) {
    testWrite(cpu, 'E0.0', activa(e, c));
    cpu.scan();
    E.push(activa(e, c));
    P.push(testRead(cpu, 'M10.1'));
    N.push(testRead(cpu, 'M10.3'));
  }
  return { E, P, N };
}

// ───────── Dibujo ─────────

const ANCHO = 720;
const IZQ = 64;
const DER = 14;
const ARRIBA = 10;
const FILA = 40;
const AMPLITUD = 20;
const COTA = 22;
const EJE = 26;

function tramos(v: number[]): Tramo[] {
  const t: Tramo[] = [];
  let desde = -1;
  v.forEach((x, i) => {
    if (x && desde < 0) desde = i;
    if (!x && desde >= 0) { t.push([desde, i]); desde = -1; }
  });
  if (desde >= 0) t.push([desde, v.length]);
  return t;
}

function svg(filas: Fila[], muestras: number, eje: { cada: number; texto: (k: number) => string } | null, rejilla: boolean, etiqueta: string): string {
  // margen izquierdo según el nombre más largo (13 px de letra monoespaciada)
  const izq = Math.max(IZQ, Math.ceil(20 + 8.5 * Math.max(...filas.map((f) => f.nombre.length))));
  const der = filas.some((f) => f.derecha) ? 62 : DER;
  const x = (i: number) => (izq + (i / muestras) * (ANCHO - izq - der)).toFixed(1);
  const fondo: string[] = [];
  const dibujo: string[] = [];
  let y = ARRIBA;
  for (const f of filas) {
    const alto = y + 6;
    const bajo = alto + AMPLITUD;
    const cls = f.salida ? ' q' : '';
    dibujo.push(`<text class="crono-nombre" x="${izq - 12}" y="${bajo - 3}" text-anchor="end">${esc(f.nombre)}</text>`);
    if (f.derecha) dibujo.push(`<text class="crono-eje-texto" x="${ANCHO - der + 12}" y="${bajo - 4}">${esc(f.derecha)}</text>`);
    for (const [a, b] of tramos(f.valores)) {
      dibujo.push(`<rect class="crono-relleno${cls}" x="${x(a)}" y="${alto}" width="${(Number(x(b)) - Number(x(a))).toFixed(1)}" height="${AMPLITUD}"/>`);
    }
    let d = `M${x(0)} ${f.valores[0] ? alto : bajo}`;
    for (let i = 1; i < muestras; i++) {
      if (f.valores[i] !== f.valores[i - 1]) d += `H${x(i)}V${f.valores[i] ? alto : bajo}`;
    }
    dibujo.push(`<path class="crono-linea${cls}" d="${d}H${x(muestras)}"/>`);
    y += FILA;
    for (const [a, b] of f.cotas ?? []) {
      const ya = y + 4;
      const xa = Number(x(a));
      const xb = Number(x(b));
      const medio = (xa + xb) / 2;
      fondo.push(`<path class="crono-guia" d="M${xa} ${ARRIBA}V${ya}M${xb} ${ARRIBA}V${ya}"/>`);
      dibujo.push(`<path class="crono-cota" d="M${xa} ${ya - 5}V${ya + 5}M${xb} ${ya - 5}V${ya + 5}M${xa} ${ya}H${medio - 9}M${medio + 9} ${ya}H${xb}"/>`);
      dibujo.push(`<text class="crono-cota-texto" x="${medio}" y="${ya + 4}" text-anchor="middle">t</text>`);
    }
    if (f.cotas?.length) y += COTA;
  }
  if (rejilla) {
    for (let i = 0; i <= muestras; i++) fondo.push(`<path class="crono-rejilla" d="M${x(i)} ${ARRIBA}V${y - 6}"/>`);
  }
  if (eje) {
    dibujo.push(`<path class="crono-eje" d="M${izq} ${y}H${ANCHO - der}"/>`);
    for (let k = 0; k * eje.cada <= muestras; k++) {
      const xi = x(k * eje.cada);
      dibujo.push(`<path class="crono-eje" d="M${xi} ${y}v5"/><text class="crono-eje-texto" x="${xi}" y="${y + 18}" text-anchor="middle">${esc(eje.texto(k))}</text>`);
    }
    y += EJE;
  }
  return `<svg class="crono-svg" viewBox="0 0 ${ANCHO} ${y}" width="${ANCHO}" height="${y}" role="img" aria-label="${esc(etiqueta)}">${fondo.join('')}${dibujo.join('')}</svg>`;
}

function figura(titulo: string, cuerpo: string, pie: string): string {
  const cabecera = titulo ? `<figcaption class="crono-titulo">${titulo}</figcaption>` : '';
  return `<figure class="crono">${cabecera}<div class="crono-lienzo">${cuerpo}</div><p class="crono-pie">${esc(pie)}</p></figure>`;
}

// ───────── Cronogramas de cada sección ─────────

/** Casos de cada temporizador (ms), elegidos para que se vea lo que lo distingue de los demás */
const CASOS: Record<Tipo, { s: Tramo[]; r?: Tramo[]; cotas: Tramo[] }> = {
  SI: { s: [[500, 3000], [3800, 4300]], cotas: [[500, 1500]] },
  SV: { s: [[500, 800], [1200, 1400], [3500, 3700]], cotas: [[1200, 2200], [3500, 4500]] },
  SE: { s: [[500, 3000], [3800, 4400]], cotas: [[500, 1500]] },
  SS: { s: [[500, 800]], r: [[3500, 3800]], cotas: [[500, 1500]] },
  SA: { s: [[500, 2000], [2500, 3000]], cotas: [[3000, 4000]] },
};
const TOTAL_MS = 5500;

function cronogramasTemporizadores(tx: TextosCronogramas): string {
  const muestras = TOTAL_MS / CICLO_MS;
  const porSegundo = 1000 / CICLO_MS;
  const figuras = (Object.keys(CASOS) as Tipo[]).map((tipo) => {
    const caso = CASOS[tipo];
    const { S, R, Q } = temporizador(tipo, caso.s, caso.r ?? [], TOTAL_MS);
    const filas: Fila[] = [{ nombre: 'S', valores: S, salida: false }];
    if (caso.r) filas.push({ nombre: 'R', valores: R, salida: false });
    filas.push({ nombre: 'Q', valores: Q, salida: true, cotas: caso.cotas.map(([a, b]) => [a / CICLO_MS, b / CICLO_MS]) });
    const t = tx.temporizadores[tipo];
    const dibujo = svg(filas, muestras, { cada: porSegundo, texto: (k) => `${k} s` }, false, `${t.nemo}: ${t.nombre}`);
    return figura(`<b>${esc(t.nemo)}</b> ${esc(t.nombre)} <span>${esc(t.cuadro)}</span>`, dibujo, t.pie);
  });
  return `<p class="nota">${esc(tx.nota)}</p>${figuras.join('')}`;
}

function cronogramaMarcaCiclo(tx: TextosCronogramas, idioma: Idioma): string {
  const total = 4000;
  const bits = marcaCiclo(total);
  const filas: Fila[] = bits.map((valores, b) => ({
    nombre: `M 100.${b}`,
    valores,
    salida: true,
    derecha: `${(CLOCK_PERIODS_MS[b] / 1000).toLocaleString(idioma)} s`,
  }));
  return figura('', svg(filas, total / CICLO_MS, { cada: 1000 / CICLO_MS, texto: (k) => `${k} s` }, false, tx.marcaCiclo.pie), tx.marcaCiclo.pie);
}

function cronogramaFlancos(tx: TextosCronogramas, idioma: Idioma): string {
  const ciclos = 22;
  const { E, P, N } = flancos([[3, 11], [15, 19]], ciclos);
  const filas: Fila[] = [
    { nombre: displayOperand('E 0.0', idioma === 'en' ? 'en' : 'de'), valores: E, salida: false },
    { nombre: '(P)', valores: P, salida: true },
    { nombre: '(N)', valores: N, salida: true },
  ];
  return figura('', svg(filas, ciclos, null, true, tx.flancos.pie), tx.flancos.pie);
}

/** Figura de la sección (cronograma o GRAFCET), o null si la sección no tiene */
export function cronogramas(ref: string, idioma: Idioma, tx: TextosCronogramas | undefined): string | null {
  if (!tx) return null;
  if (ref === '2.6') return cronogramaMarcaCiclo(tx, idioma);
  if (ref === 'S.2') return grafcet(tx.grafcet, idioma === 'en');
  if (ref === '6.5') return cronogramaFlancos(tx, idioma);
  if (ref === '6.6') return cronogramasTemporizadores(tx);
  return null;
}
