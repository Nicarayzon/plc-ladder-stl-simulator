// Figuras de la teoría de la web que sustituyen a los esquemas en ASCII de la referencia: esquemas KOP
// dibujados con el código de la app, el ciclo de scan en SVG y tablas visuales (bytes, S5TIME, línea AWL).
// Cada sección con esquemas da una figura por cada bloque ```text que no sea un cronograma, en el mismo orden.
import { bob, biest, cmp, cont, na, nc, not, p, par, r, s, seg, segs, temp } from '../../src/kop/build';
import type { SegmentoKOP } from '../../src/kop/model';
import type { Idioma } from '../../web/teoria/paginas';
import { esc, svgKop } from './html';

export interface TextosFiguras {
  /** Ciclo de scan (§1.1): cuatro cajas [título, detalle] y el rótulo de la vuelta */
  ciclo: [string, string][];
  cicloVuelta: string;
  /** Mapa de MD 10 (§2.2) */
  bytesFilas: [string, string, string, string];
  bytesPie: string;
  /** Formato de S5TIME (§3.3) */
  s5: { bit: string; sinUso: string; base: string; centenas: string; decenas: string; unidades: string; pie: string };
  /** Línea de AWL (§7.1) */
  awl: { meta: string; operacion: string; operando: string; comentario: string; ejemplo: [string, string, string, string] };
  /** Pies de los esquemas KOP */
  kop: {
    y: string; o: string; nand: string; nor: string; xor: string;
    enclavamiento: string; setReset: string; sr: string; rs: string;
    flanco: string; temporizador: string; contador: string; comparador: string;
  };
}

// ───────── KOP ─────────

function figuraKop(lista: SegmentoKOP[], pie: string, ingles: boolean, etiqueta: string): string {
  const dibujos = lista.map((sg) => `<div class="kop-seg"><div class="kop-lienzo">${svgKop(sg, ingles, etiqueta)}</div></div>`).join('');
  return `<figure class="kop figura-kop">${dibujos}${pie ? `<figcaption class="figura-pie">${esc(pie)}</figcaption>` : ''}</figure>`;
}

/** Varias figuras pequeñas en rejilla (las funciones lógicas de §6.3) */
const rejilla = (figs: string[]) => `<div class="figura-rejilla">${figs.join('')}</div>`;

const m = (id: string, lista: SegmentoKOP[]) => segs(id, lista);

// ───────── Ciclo de scan (§1.1) ─────────

function ciclo(tx: TextosFiguras): string {
  const W = 720;
  const caja = 150;
  const hueco = (W - 20 - 4 * caja) / 3;
  const y = 14;
  const alto = 62;
  const partes: string[] = [];
  tx.ciclo.forEach(([titulo, detalle], i) => {
    const x = 10 + i * (caja + hueco);
    partes.push(`<rect class="fc-caja${i === 1 ? ' fc-principal' : ''}" x="${x}" y="${y}" width="${caja}" height="${alto}" rx="10"/>`);
    partes.push(`<text class="fc-titulo" x="${x + caja / 2}" y="${y + 27}" text-anchor="middle">${esc(titulo)}</text>`);
    partes.push(`<text class="fc-detalle" x="${x + caja / 2}" y="${y + 46}" text-anchor="middle">${esc(detalle)}</text>`);
    if (i < 3) {
      const x1 = x + caja + 4;
      const x2 = x + caja + hueco - 4;
      partes.push(`<path class="fc-linea" d="M${x1} ${y + alto / 2}H${x2 - 6}"/><path class="fc-punta" d="M${x2 - 8} ${y + alto / 2 - 5}L${x2} ${y + alto / 2}L${x2 - 8} ${y + alto / 2 + 5}Z"/>`);
    }
  });
  // vuelta del último paso al primero
  const xi = 10 + caja / 2;
  const xf = 10 + 3 * (caja + hueco) + caja / 2;
  const yb = y + alto + 26;
  partes.push(`<path class="fc-linea" d="M${xf} ${y + alto + 4}V${yb}H${xi}V${y + alto + 12}"/><path class="fc-punta" d="M${xi - 5} ${y + alto + 12}L${xi} ${y + alto + 4}L${xi + 5} ${y + alto + 12}Z"/>`);
  partes.push(`<text class="fc-detalle" x="${(xi + xf) / 2}" y="${yb - 7}" text-anchor="middle">${esc(tx.cicloVuelta)}</text>`);
  const H = yb + 12;
  return `<figure class="crono figura-ciclo"><div class="crono-lienzo"><svg class="crono-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(tx.ciclo.map((c) => c[0]).join(' → '))}">${partes.join('')}</svg></div></figure>`;
}

// ───────── Tablas visuales ─────────

function bytes(tx: TextosFiguras): string {
  const [dobles, palabras, bytesFila, bits] = tx.bytesFilas;
  return `<figure class="figura-tabla"><div class="tabla"><table class="mapa">
    <tr><th>${esc(dobles)}</th><td colspan="4" class="m-d">MD 10</td></tr>
    <tr><th>${esc(palabras)}</th><td colspan="2" class="m-w">MW 10</td><td colspan="2" class="m-w">MW 12</td></tr>
    <tr><th>${esc(bytesFila)}</th><td class="m-b">MB 10</td><td class="m-b">MB 11</td><td class="m-b">MB 12</td><td class="m-b">MB 13</td></tr>
    <tr><th>${esc(bits)}</th><td class="m-bits">31…24</td><td class="m-bits">23…16</td><td class="m-bits">15…8</td><td class="m-bits">7…0</td></tr>
  </table></div><figcaption class="figura-pie">${esc(tx.bytesPie)}</figcaption></figure>`;
}

function s5time(tx: TextosFiguras): string {
  const t = tx.s5;
  const numeros = Array.from({ length: 16 }, (_, i) => `<td class="m-bits">${15 - i}</td>`).join('');
  // S5T#5S = W#16#0500
  const valor = (0x0500).toString(2).padStart(16, '0').split('').map((b) => `<td class="m-valor${b === '1' ? ' uno' : ''}">${b}</td>`).join('');
  return `<figure class="figura-tabla"><div class="tabla"><table class="mapa mapa-bits">
    <tr><th>${esc(t.bit)}</th>${numeros}</tr>
    <tr><th></th><td colspan="2" class="m-gris">${esc(t.sinUso)}</td><td colspan="2" class="m-d">${esc(t.base)}</td><td colspan="4" class="m-w">${esc(t.centenas)}</td><td colspan="4" class="m-b">${esc(t.decenas)}</td><td colspan="4" class="m-w">${esc(t.unidades)}</td></tr>
    <tr><th>S5T#5S</th>${valor}</tr>
  </table></div><figcaption class="figura-pie">${esc(t.pie)}</figcaption></figure>`;
}

function lineaAwl(tx: TextosFiguras): string {
  const a = tx.awl;
  const [meta, ins, op, com] = a.ejemplo;
  return `<figure class="figura-tabla"><div class="tabla"><table class="linea-awl">
    <tr><th>${esc(a.meta)}</th><th>${esc(a.operacion)}</th><th>${esc(a.operando)}</th><th>${esc(a.comentario)}</th></tr>
    <tr><td><code class="codigo-celda"><span class="t-meta">${esc(meta)}</span></code></td><td><code class="codigo-celda"><span class="t-ins">${esc(ins)}</span></code></td><td><code class="codigo-celda">${esc(op)}</code></td><td><code class="codigo-celda"><span class="t-com">${esc(com)}</span></code></td></tr>
  </table></div></figure>`;
}

// ───────── Figuras de cada sección ─────────

/** Figuras que sustituyen a los esquemas ASCII de la sección, en orden, o null si no tiene */
export function figuras(ref: string, idioma: Idioma, tx: TextosFiguras | undefined): string[] | null {
  if (!tx) return null;
  const en = idioma === 'en';
  const k = tx.kop;
  const fig = (id: string, lista: SegmentoKOP[], pie: string) => figuraKop(m(id, lista), pie, en, pie);
  switch (ref) {
    case '1.1': return [ciclo(tx)];
    case '2.2': return [bytes(tx)];
    case '3.3': return [s5time(tx)];
    case '7.1': return [lineaAwl(tx)];
    case '6.3': return [rejilla([
      fig('f-y', [seg({ entrada: [na('E 0.0'), na('E 0.1')], salidas: [bob('A 4.0')] })], k.y),
      fig('f-o', [seg({ entrada: [par([na('E 0.0')], [na('E 0.1')])], salidas: [bob('A 4.0')] })], k.o),
      fig('f-nand', [seg({ entrada: [na('E 0.0'), na('E 0.1'), not()], salidas: [bob('A 4.0')] })], k.nand),
      fig('f-nor', [seg({ entrada: [par([na('E 0.0')], [na('E 0.1')]), not()], salidas: [bob('A 4.0')] })], k.nor),
      fig('f-xor', [seg({ entrada: [par([na('E 0.0'), nc('E 0.1')], [nc('E 0.0'), na('E 0.1')])], salidas: [bob('A 4.2')] })], k.xor),
    ])];
    case '6.4': return [
      fig('f-encl', [seg({ entrada: [par([na('E 0.0')], [na('A 4.0')]), na('E 0.1')], salidas: [bob('A 4.0')] })], k.enclavamiento),
      fig('f-sr-bobinas', [
        seg({ entrada: [na('E 0.0')], salidas: [s('A 4.0')] }),
        seg({ entrada: [nc('E 0.1')], salidas: [r('A 4.0')] }),
      ], k.setReset),
      rejilla([
        fig('f-sr', [seg({ entrada: [na('E 0.0')], salidas: [biest('SR', 'A 4.0', nc('E 0.1'))] })], k.sr),
        fig('f-rs', [seg({ entrada: [nc('E 0.1')], salidas: [biest('RS', 'A 4.0', na('E 0.0'))] })], k.rs),
      ]),
    ];
    case '6.5': return [fig('f-flanco', [seg({ entrada: [na('E 0.0'), p('M 10.0')], salidas: [bob('M 10.1')] })], k.flanco)];
    case '6.6': return [fig('f-temp', [seg({
      entrada: [na('E 0.0')],
      salidas: [temp('S_EVERZ', 'T 1', 'S5T#5S', { pinR: na('E 0.1'), dual: 'MW 10', dez: 'MW 12', q: [bob('A 4.0')] })],
    })], k.temporizador)];
    case '6.7': return [fig('f-cont', [seg({
      entrada: [na('E 1.0')],
      salidas: [cont('Z_VORW', 'Z 1', { pinS: na('E 1.2'), zw: 'C#5', pinR: na('E 1.3'), dual: 'MW 20', dez: 'MW 22', q: [bob('A 5.1')] })],
    })], k.contador)];
    case '6.8': return [fig('f-cmp', [seg({ entrada: [na('E 2.0'), cmp('>I', 'MW 30', '500')], salidas: [bob('A 5.6')] })], k.comparador)];
  }
  return null;
}

