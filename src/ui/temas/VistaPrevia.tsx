// Miniaturas de Temas: la app en pequeño (barra, simulador con un segmento KOP y otro AWL, panel de E/S)
// con los colores de una paleta y, si se pide, un papel de fondo. Es un SVG sin textos: barras en lugar de letras.
// La escala del papel es la de la app real (la miniatura mide 800 unidades por cada 1440 px de ventana),
// así que lo que se ve aquí es lo que se verá al aplicarlo.
import { useId } from 'react';
import { mezclar, SINTAXIS, type Paleta } from './paletas';
import { PAPEL, dibujoPapel, type PapelId } from './papeles';
import type { ImagenPropia } from './imagenPropia';

const ANCHO = 800;
const ALTO = 480;
/** Unidades de la miniatura por píxel de una ventana de 1440 px */
const ESCALA = ANCHO / 1440;

interface PatronProps { id: string; papel: PapelId; paleta: Paleta; escala: number; img: ImagenPropia | null }

/** <pattern> del papel; null si no hay nada que pintar */
function Patron({ id, papel, paleta, escala, img }: PatronProps) {
  if (papel === 'propia') {
    if (!img) return null;
    return (
      <pattern id={id} patternUnits="userSpaceOnUse" width={img.w} height={img.h} patternTransform={`scale(${escala})`}>
        <image href={img.url} width={img.w} height={img.h} />
      </pattern>
    );
  }
  if (!papel) return null;
  const tam = PAPEL[papel].tam;
  return <pattern id={id} patternUnits="userSpaceOnUse" width={tam} height={tam} patternTransform={`scale(${escala})`} dangerouslySetInnerHTML={{ __html: dibujoPapel(papel, paleta) }} />;
}

const usarId = () => `t${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

export interface MiniAppProps {
  paleta: Paleta;
  papel?: PapelId;
  intensidad?: number;
  tamano?: number;
  img?: ImagenPropia | null;
  /** Texto para lectores de pantalla; sin él, la miniatura es decorativa */
  titulo?: string;
  className?: string;
}

export function MiniApp({ paleta, papel = '', intensidad = 0.35, tamano = 1, img = null, titulo, className }: MiniAppProps) {
  const id = usarId();
  const c = paleta.c;
  const sx = SINTAXIS[paleta.base];
  const hayPapel = papel === 'propia' ? !!img : !!papel;
  const b = (x: number, y: number, w: number, h: number, fill: string, rx = 2) => <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} />;
  const on = { stroke: c.power, strokeWidth: 3, fill: 'none' };
  const off = { stroke: c.nopower, strokeWidth: 1.8, strokeDasharray: '5 4', fill: 'none' };
  const contacto = (x: number, y: number, color: string) => <path d={`M${x + 6} ${y - 10}V${y + 10}M${x + 18} ${y - 10}V${y + 10}`} stroke={color} strokeWidth={2.2} fill="none" />;
  const ioOn = [1, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0];
  return (
    <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} className={className} role={titulo ? 'img' : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true} preserveAspectRatio="xMidYMid slice">
      <defs><Patron id={id} papel={papel} paleta={paleta} escala={tamano * ESCALA} img={img} /></defs>
      <rect width={ANCHO} height={ALTO} fill={c['zona-prog']} />
      {hayPapel && <rect x={116} width={ANCHO - 116} height={ALTO} fill={`url(#${id})`} opacity={intensidad} />}

      {/* barra de la izquierda */}
      <rect width={116} height={ALTO} fill={c['bg-elev']} />
      <rect x={116} width={1} height={ALTO} fill={c.border} />
      {b(14, 16, 20, 20, c.accent, 5)}
      {b(42, 19, 54, 6, c.text)}
      {b(42, 30, 40, 4, c['text-faint'])}
      {[62, 80, 98].map((y) => <g key={y}>{b(16, y - 3.5, 7, 7, c['text-dim'])}{b(30, y - 2.5, 40 + (y % 3) * 8, 5, c['text-dim'])}</g>)}
      {b(14, 120, 34, 3.5, c['text-faint'])}
      {b(8, 132, 100, 18, c['accent-bg'], 4)}
      {b(16, 137.5, 7, 7, c.text)}
      {b(30, 138.5, 56, 5, c.text)}
      {b(14, 164, 40, 3.5, c['text-faint'])}
      {[178, 196].map((y) => <g key={y}>{b(16, y - 3.5, 7, 7, c['text-dim'])}{b(30, y - 2.5, 44, 5, c['text-dim'])}</g>)}

      {/* barra de herramientas */}
      <rect x={117} width={ANCHO - 117} height={32} fill={c['zona-barra']} />
      <rect x={117} y={32} width={ANCHO - 117} height={1} fill={c.border} />
      <rect x={128.5} y={9.5} width={50} height={15} rx={3} fill={c['bg-elev2']} stroke={c['border-strong']} />
      {b(129, 10, 25, 14, c['run-bg'], 2.5)}
      {b(135, 15.5, 13, 3, c['run-text'])}
      {b(159, 15.5, 13, 3, c['text-dim'])}
      {[188, 206, 224].map((x) => <g key={x}><rect x={x + 0.5} y={9.5} width={15} height={15} rx={3} fill={c['bg-elev2']} stroke={c['border-strong']} />{b(x + 5, 15.5, 6, 4, c['text-dim'], 1)}</g>)}
      {b(252, 14.5, 70, 5, c['text-dim'])}
      {b(720, 9, 66, 16, c.accent, 3)}
      {b(732, 15.5, 42, 3.5, c['accent-text'])}

      {/* pestañas de bloques */}
      <rect x={117} y={33} width={513} height={22} fill={c['bg-elev']} />
      <rect x={117} y={54} width={513} height={1} fill={c.border} />
      <path d="M124.5 55V39.5Q124.5 36.5 127.5 36.5H159.5Q162.5 36.5 162.5 39.5V55" fill={c.bg} stroke={c.border} />
      {b(131, 44, 24, 4, c.text)}
      {b(172, 44, 24, 4, c['text-dim'])}

      {/* segmento KOP */}
      <rect x={130.5} y={66.5} width={485} height={155} rx={6} fill={c['bg-elev']} stroke={c.border} />
      {b(142, 76, 40, 4.5, c['text-dim'])}
      {b(190, 76, 90, 4.5, c.text)}
      {b(584, 73, 22, 10, mezclar(c['bg-elev'], c.power, 0.2))}
      {b(588, 76.75, 14, 2.5, c.power)}
      <rect x={131} y={91} width={484} height={1} fill={c.border} />
      <path d="M131 92H615V215.5Q615 221 609.5 221H136.5Q131 221 131 215.5Z" fill={c['code-bg']} />
      <path d="M146 104V208" stroke={c.power} strokeWidth={3} />
      <path d="M146 124H196M208 124H290" {...on} />
      {contacto(190, 124, c.power)}
      {b(186, 103, 32, 4, c.text)}
      {b(190, 140, 22, 3, c.power)}
      <rect x={283.5} y={106.5} width={38} height={34} rx={2} fill={mezclar(c['code-bg'], c['kop-sel'], 0.14)} stroke={c['kop-sel']} strokeWidth={1.5} />
      {contacto(290, 124, c.nopower)}
      {b(286, 101, 32, 4, c.text)}
      <path d="M302 124H520" {...off} />
      <path d="M520 124H530M546 124H556" stroke={c.nopower} strokeWidth={1.8} fill="none" />
      <path d="M534 114Q527 124 534 134M542 114Q549 124 542 134" stroke={c.nopower} strokeWidth={2.2} fill="none" />
      {b(522, 101, 32, 4, c.text)}
      <path d="M170 124V168H196" {...on} />
      <circle cx={170} cy={124} r={3} fill={c.power} />
      {contacto(190, 168, c.nopower)}
      {b(186, 147, 32, 4, c.text)}
      <path d="M208 168H236V124" {...off} />

      {/* segmento AWL */}
      <rect x={130.5} y={236.5} width={485} height={127} rx={6} fill={c['bg-elev']} stroke={c.border} />
      {b(142, 246, 40, 4.5, c['text-dim'])}
      {b(190, 246, 70, 4.5, c.text)}
      {b(584, 243, 22, 10, mezclar(c['bg-elev'], sx.kw, 0.22))}
      {b(588, 246.75, 14, 2.5, sx.kw)}
      <rect x={131} y={261} width={484} height={1} fill={c.border} />
      <path d="M131 262H615V357.5Q615 363 609.5 363H136.5Q131 363 131 357.5Z" fill={c['code-bg']} />
      <rect x={556} y={262} width={59} height={101} fill={mezclar(c['code-bg'], c.accent, 0.07)} />
      <rect x={156} y={262} width={1} height={101} fill={c.border} />
      <rect x={157} y={283} width={458} height={14} fill={mezclar(c['code-bg'], c.warn, 0.22)} />
      <rect x={157} y={283} width={3} height={14} fill={c.warn} />
      {[274, 290, 306, 322, 338].map((y, i) => <g key={y}>{b(140, y - 2, 10, 3.5, c['text-faint'])}{b(566, y - 2, 10, 3.5, c.text)}{b(582, y - 2, 24, 3.5, c['text-dim'])}{[
        <>{b(166, y - 2, 10, 4, sx.kw)}{b(182, y - 2, 36, 4, sx.op)}</>,
        <>{b(166, y - 2, 10, 4, sx.kw)}{b(182, y - 2, 36, 4, sx.op)}</>,
        <>{b(166, y - 2, 16, 4, sx.kw)}{b(188, y - 2, 26, 4, sx.num)}</>,
        <>{b(166, y - 2, 96, 4, c['text-faint'])}</>,
        <>{b(166, y - 2, 6, 4, sx.kw)}{b(178, y - 2, 36, 4, sx.op)}</>,
      ][i]}</g>)}

      {/* añadir segmento */}
      {[316, 376].map((x) => <g key={x}><rect x={x + 0.5} y={378.5} width={54} height={16} rx={3} fill={c['bg-elev2']} stroke={c['border-strong']} />{b(x + 10, 385, 34, 3.5, c['text-dim'])}</g>)}

      {/* panel de abajo (plegado) */}
      <rect x={117} y={454} width={513} height={26} fill={c['bg-elev']} />
      <rect x={117} y={454} width={513} height={1} fill={c.border} />
      {b(128, 465, 40, 4, c['text-dim'])}
      {b(180, 465, 46, 4, c['text-dim'])}

      {/* panel de E/S */}
      <rect x={630} y={33} width={170} height={ALTO - 33} fill={c['zona-es']} />
      <rect x={630} y={33} width={1} height={ALTO - 33} fill={c.border} />
      {b(642, 45, 50, 3.5, c['text-faint'])}
      {ioOn.map((v, i) => {
        const x = 642 + (i % 3) * 52;
        const y = 56 + Math.floor(i / 3) * 32;
        return (
          <g key={i}>
            <rect x={x + 0.5} y={y + 0.5} width={46} height={26} rx={4} fill={v ? mezclar(c['bg-elev2'], c.power, 0.16) : c['bg-elev2']} stroke={v ? mezclar(c.border, c.power, 0.6) : c['border-strong']} />
            <circle cx={x + 9} cy={y + 9} r={3.2} fill={v ? c.power : c['led-off']} />
            {b(x + 16, y + 7, 22, 4, c.text)}
            {b(x + 6, y + 17, 30, 3, c['text-dim'])}
          </g>
        );
      })}
      {b(642, 196, 44, 3.5, c['text-faint'])}
      {[0, 1, 2, 3, 4, 5].map((i) => <g key={i}><circle cx={650 + i * 24} cy={214} r={4} fill={i === 1 || i === 4 ? c.power : c['led-off']} />{b(643 + i * 24, 224, 14, 3, c['text-dim'])}</g>)}
    </svg>
  );
}

/** Muestra de un papel para la galería: el motivo sobre el fondo, sin la app alrededor */
export function MuestraPapel({ paleta, papel, img = null }: { paleta: Paleta; papel: PapelId; img?: ImagenPropia | null }) {
  const id = usarId();
  const hay = papel === 'propia' ? !!img : !!papel;
  return (
    <svg viewBox="0 0 160 120" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs><Patron id={id} papel={papel} paleta={paleta} escala={0.72} img={img} /></defs>
      <rect width={160} height={120} fill={paleta.c.bg} />
      {hay && <rect width={160} height={120} fill={`url(#${id})`} opacity={0.9} />}
      {!papel && <g fill="none" stroke={paleta.c['text-faint']} strokeWidth={3} strokeLinecap="round"><circle cx={80} cy={60} r={20} /><path d="M66 46L94 74" /></g>}
      {papel === 'propia' && !img && (
        <g fill="none" stroke={paleta.c['text-faint']} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <rect x={56} y={40} width={48} height={40} rx={5} /><path d="M60 76l13-15 10 11 6-6 11 10" /><circle cx={93} cy={52} r={4} />
        </g>
      )}
    </svg>
  );
}
