import { useEffect, useMemo, useRef, useState } from 'react';
import { capitulos, nemotecniaTeoria } from '../../content/referencia';
import { Markdown } from '../common/Markdown';
import { ProbarModal } from './Probar';
import { go } from '../router';
import { Icon } from '../common/Icon';
import { T } from '../../i18n';

const CAPS = capitulos();

export function AprenderScreen({ cap }: { cap?: string }) {
  const idx = Math.max(0, CAPS.findIndex((c) => c.n === (cap ?? '1')));
  const c = CAPS[idx];
  const [q, setQ] = useState('');
  const [probar, setProbar] = useState<string | null>(null);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => { content.current?.scrollTo({ top: 0 }); }, [idx]);
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return null;
    const out: { cap: string; titulo: string; sec: string; snippet: string }[] = [];
    for (const ch of CAPS) {
      const parts = ch.md.split(/\n(?=### )/);
      for (const p of parts) {
        const i = p.toLowerCase().indexOf(t);
        if (i < 0) continue;
        const sec = /^### (.*)$/m.exec(p)?.[1] ?? ch.titulo;
        out.push({ cap: ch.n, titulo: ch.titulo, sec, snippet: p.slice(Math.max(0, i - 50), i + 90).replace(/\s+/g, ' ') });
      }
    }
    return out.slice(0, 40);
  }, [q]);
  const scrollTo = (titulo: string) => {
    const hs = content.current?.querySelectorAll('h2, h3') ?? [];
    for (const h of hs) if (h.textContent?.trim() === titulo.replace(/`/g, '').trim()) { h.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  };
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: 290, flex: 'none', borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-elev)', padding: '14px 10px' }}>
        <input className="input" style={{ width: '100%', marginBottom: 10 }} placeholder={T.aprender.buscar} value={q} onChange={(e) => setQ(e.target.value)} aria-label={T.aprender.buscarEtiqueta} />
        {hits ? (
          <div>
            <div className="faint" style={{ fontSize: 11.5, margin: '0 6px 6px' }}>{T.aprender.resultados(hits.length)}</div>
            {hits.map((h, i) => (
              <button key={i} className="nav-item" style={{ height: 'auto', padding: '6px 10px', flexDirection: 'column', alignItems: 'flex-start' }} onClick={() => { go(`aprender/${h.cap}`); setQ(''); setTimeout(() => scrollTo(h.sec), 120); }}>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{h.sec}</span>
                <span className="faint" style={{ fontSize: 11.5 }}>…{h.snippet}…</span>
              </button>
            ))}
          </div>
        ) : CAPS.map((ch) => (
          <div key={ch.n}>
            <button className={`nav-item toc-item ${ch.n === c.n ? 'active' : ''}`} onClick={() => go(`aprender/${ch.n}`)}>
              <span className="mono faint" style={{ width: 18 }}>{ch.n === '0' ? '·' : ch.n}</span>{ch.titulo}
            </button>
            {ch.n === c.n && ch.secciones.map((s) => (
              <button key={s.id} className="nav-item toc-item" style={{ paddingLeft: 38, fontSize: 12 }} onClick={() => scrollTo(s.titulo)}>{s.titulo.replace(/`/g, '')}</button>
            ))}
          </div>
        ))}
      </aside>
      <div ref={content} style={{ flex: 1, overflowY: 'auto', padding: '26px 40px 60px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Markdown text={c.md} onTry={(code) => setProbar(code)} />
          <div className="row" style={{ marginTop: 30 }}>
            {idx > 0 && <button className="btn" onClick={() => go(`aprender/${CAPS[idx - 1].n}`)}><Icon name="left" size={14} />{CAPS[idx - 1].titulo}</button>}
            <span className="spacer" />
            {idx < CAPS.length - 1 && <button className="btn" onClick={() => go(`aprender/${CAPS[idx + 1].n}`)}>{CAPS[idx + 1].titulo}<Icon name="right" size={14} /></button>}
          </div>
        </div>
      </div>
      {probar !== null && <ProbarModal code={probar} title={T.aprender.probarTitulo(c.titulo)} nemotecnia={nemotecniaTeoria} onClose={() => setProbar(null)} />}
    </div>
  );
}
