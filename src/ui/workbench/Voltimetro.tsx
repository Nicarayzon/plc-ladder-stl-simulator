// Indicador de la tensión de una salida analógica (PAW): medio círculo de 0 a 10 V con aguja, como el
// velocímetro de un coche, y la lectura al lado. Va encima de «Analógicas y palabras», uno por fila, con su
// PEW justo debajo, dentro del mismo bloque (`children`).
// Las clases llevan el prefijo «volt-»: otras genéricas ya tienen estilos en otros sitios (con papel,
// `.lectura` es la hoja de Aprender y le ponía un marco a la lectura).
import { useMemo, type ReactNode } from 'react';
import { T } from '../../i18n';
import { makeReader, readRaw } from '../../sim/readers';
import { s16 } from '../../core/num';
import type { SimController } from '../../sim/SimController';
import { VALOR_10V, V_MAX, fraccionEscala, fueraDeEscala, voltios } from './analogica';

// geometría (unidades del viewBox): centro de la aguja y radios. Los números van por fuera del arco,
// para que la aguja no los tape en 0 V y en 10 V.
const CX = 80;
const CY = 78;
const R_PISTA = 54;
const R_NUMEROS = 68;
const R_AGUJA = 46;
const punto = (grados: number, r: number) => {
  const a = (grados * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)] as const;
};
/** Ángulo de un valor de la escala: 180° = 0 V (izquierda), 0° = 10 V (derecha) */
const angulo = (v: number) => 180 - (v / V_MAX) * 180;
const [IX, IY] = punto(180, R_PISTA);
const [FX, FY] = punto(0, R_PISTA);
const ARCO = `M ${IX} ${IY} A ${R_PISTA} ${R_PISTA} 0 0 1 ${FX} ${FY}`;
const MARCAS = Array.from({ length: V_MAX * 2 + 1 }, (_, i) => i / 2);

export function Voltimetro({ sim, addr, children }: { sim: SimController; addr: string; children?: ReactNode }) {
  const r = useMemo(() => makeReader(addr), [addr]);
  const raw = readRaw(sim.cpu, r);
  const valor = Number.isNaN(raw) ? 0 : s16(raw);
  const v = voltios(valor);
  const f = fraccionEscala(v);
  const fuera = fueraDeEscala(v);
  return (
    <div className="volt">
      <div className="volt-cab" role="meter" aria-label={T.io.tension(addr)} aria-valuemin={0} aria-valuemax={V_MAX} aria-valuenow={Math.round(v * 100) / 100}
        aria-valuetext={T.io.voltios(v)} title={fuera ? T.io.fueraDeEscala(VALOR_10V) : undefined}>
        <svg className="volt-dial" viewBox="0 0 160 88" aria-hidden="true">
          <path className="volt-pista" d={ARCO} />
          <path className="volt-arco" d={ARCO} pathLength={100} strokeDasharray={`${f * 100} 100`} />
          {MARCAS.map((m) => {
            const grande = m % 2 === 0;
            const [x1, y1] = punto(angulo(m), grande ? 38 : 42);
            const [x2, y2] = punto(angulo(m), 46);
            return <line key={m} className={grande ? 'volt-marca grande' : 'volt-marca'} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          {MARCAS.filter((m) => m % 2 === 0).map((m) => {
            const [x, y] = punto(angulo(m), R_NUMEROS);
            return <text key={m} x={x} y={y + 3}>{m}</text>;
          })}
          {/* la aguja se dibuja en 0 V y se gira hasta el valor */}
          <g className="volt-aguja" style={{ transform: `rotate(${f * 180}deg)`, transformOrigin: `${CX}px ${CY}px` }}>
            <line x1={CX + 6} y1={CY} x2={CX - R_AGUJA} y2={CY} />
          </g>
          <circle className="volt-eje" cx={CX} cy={CY} r={5} />
        </svg>
        <div className="volt-info">
          <div className="volt-nombre">{addr}</div>
          <div className={`volt-lectura${fuera ? ' fuera' : ''}`}>{T.io.voltios(v)}</div>
          <div className="volt-crudo">{valor}</div>
        </div>
      </div>
      {children}
    </div>
  );
}
