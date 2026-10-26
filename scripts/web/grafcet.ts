// GRAFCET del semáforo (ejemplo E28), dibujado en SVG para la página de secuencias de la web.
import { displayOperand } from '../../src/core/translate';
import { esc } from './html';

export interface TextosGrafcet {
  reposo: string;
  verde: string;
  ambar: string;
  rojo: string;
  marcha: string;
  pie: string;
}

const ANCHO = 600;
const CX = 150;
const LADO = 44;
const PASO = 96;
const ARRIBA = 18;

/** Etapas del semáforo: número, marca, acción y condición de la transición que sale de ella */
export function grafcet(tx: TextosGrafcet, ingles: boolean): string {
  const op = (o: string) => displayOperand(o, ingles ? 'en' : 'de');
  const etapas = [
    { n: '0', marca: '', accion: tx.reposo, salida: `${op('E 0.0')} (${tx.marcha})` },
    { n: '1', marca: 'M 20.0', accion: `${op('A 4.0')} ${tx.verde} · T 10 = 5 s`, salida: 'T 10' },
    { n: '2', marca: 'M 20.1', accion: `${op('A 4.1')} ${tx.ambar} · T 11 = 2 s`, salida: 'T 11' },
    { n: '3', marca: 'M 20.2', accion: `${op('A 4.2')} ${tx.rojo} · T 12 = 5 s`, salida: 'T 12' },
  ];
  const partes: string[] = [];
  etapas.forEach((e, i) => {
    const y = ARRIBA + i * PASO;
    const x = CX - LADO / 2;
    // etapa (la inicial, con doble cuadrado)
    partes.push(`<rect class="gf-etapa" x="${x}" y="${y}" width="${LADO}" height="${LADO}"/>`);
    if (i === 0) partes.push(`<rect class="gf-etapa" x="${x + 4}" y="${y + 4}" width="${LADO - 8}" height="${LADO - 8}"/>`);
    partes.push(`<text class="gf-num" x="${CX}" y="${y + LADO / 2 + 6}" text-anchor="middle">${e.n}</text>`);
    if (e.marca) partes.push(`<text class="gf-marca" x="${x - 10}" y="${y + LADO / 2 + 4}" text-anchor="end">${esc(e.marca)}</text>`);
    // acción
    if (i > 0) {
      const ax = CX + LADO / 2 + 26;
      partes.push(`<path class="gf-linea" d="M${CX + LADO / 2} ${y + LADO / 2}H${ax}"/>`);
      partes.push(`<rect class="gf-accion" x="${ax}" y="${y + 8}" width="${ANCHO - ax - 10}" height="${LADO - 16}" rx="4"/>`);
      partes.push(`<text class="gf-texto" x="${ax + 12}" y="${y + LADO / 2 + 5}">${esc(e.accion)}</text>`);
    } else {
      partes.push(`<text class="gf-texto tenue" x="${CX + LADO / 2 + 16}" y="${y + LADO / 2 + 5}">${esc(e.accion)}</text>`);
    }
    // enlace y transición
    const yt = y + LADO + 24;
    const fin = i < etapas.length - 1 ? y + PASO : yt + 22;
    partes.push(`<path class="gf-linea" d="M${CX} ${y + LADO}V${fin}"/>`);
    partes.push(`<path class="gf-transicion" d="M${CX - 15} ${yt}H${CX + 15}"/>`);
    partes.push(`<text class="gf-texto" x="${CX + 26}" y="${yt + 5}">${esc(e.salida)}</text>`);
  });
  // la última transición vuelve a la etapa 1
  const yFin = ARRIBA + (etapas.length - 1) * PASO + LADO + 46;
  const yUno = ARRIBA + PASO - 12;
  const xv = CX - 112;
  partes.push(`<path class="gf-linea" d="M${CX} ${yFin}H${xv}V${yUno}H${CX}"/>`);
  const ym = (yFin + yUno) / 2;
  partes.push(`<path class="gf-flecha" d="M${xv - 6} ${ym + 6}L${xv} ${ym - 4}L${xv + 6} ${ym + 6}Z"/>`);
  const alto = yFin + 14;
  return `<figure class="crono"><div class="crono-lienzo"><svg class="crono-svg gf" viewBox="0 0 ${ANCHO} ${alto}" width="${ANCHO}" height="${alto}" role="img" aria-label="${esc(tx.pie)}">${partes.join('')}</svg></div><p class="crono-pie">${esc(tx.pie)}</p></figure>`;
}
