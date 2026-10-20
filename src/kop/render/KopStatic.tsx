// Dibujo KOP de solo lectura (enunciados y soluciones)
import { useMemo } from 'react';
import type { SegmentoKOP } from '../model';
import { layoutSegment } from '../layout';
import { KopSvg } from './KopSvg';
import { displayOperand } from '../../core/translate';
import { useSettings } from '../../store/settings';

export function KopStatic({ segs, titles = true }: { segs: SegmentoKOP[]; titles?: boolean }) {
  const lang = useSettings((s) => s.nemotecnia);
  return (
    <div className="col" style={{ gap: 10 }}>
      {segs.map((s, i) => <KopStaticSeg key={s.id} seg={s} index={i} title={titles} lang={lang} />)}
    </div>
  );
}

function KopStaticSeg({ seg, index, title, lang }: { seg: SegmentoKOP; index: number; title: boolean; lang: 'de' | 'en' }) {
  const layout = useMemo(() => layoutSegment(seg), [seg]);
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      {title && <div className="faint" style={{ fontSize: 11.5, padding: '5px 10px', borderBottom: '1px solid var(--border)' }}>Segmento {index + 1}{seg.titulo ? ` · ${seg.titulo}` : ''}{seg.meta ? ` · meta ${seg.meta}` : ''}</div>}
      <div style={{ padding: '4px 0' }}>
        <KopSvg fit layout={layout} flow={null} selected={null} issues={new Map()} lang={lang}
          showOp={(op) => ({ main: displayOperand(op, lang) })}
          onSelect={() => {}} onEdit={() => {}} onPin={() => {}} onContext={() => {}} />
      </div>
    </div>
  );
}
