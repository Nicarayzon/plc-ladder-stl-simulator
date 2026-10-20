import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function Modal({ title, onClose, children, footer, width = 560 }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <span className="spacer" />
          <button className="btn ghost icon" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/** `items`: submenú (por ejemplo, «Insertar nuevo objeto ▸» del explorador de proyectos) */
export interface MenuItem { label: string; onClick?: () => void; disabled?: boolean; sep?: boolean; hint?: string; items?: MenuItem[] }

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => window.addEventListener('mousedown', close), 0);
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', k); };
  }, [onClose]);
  return <div ref={ref}><MenuList x={x} y={y} items={items} onClose={onClose} /></div>;
}

function MenuList({ x, y, items, onClose, sub }: { x: number; y: number; items: MenuItem[]; onClose: () => void; sub?: { left: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [open, setOpen] = useState<{ i: number; x: number; y: number; left: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // un submenú que no cabe a la derecha se abre a la izquierda del menú padre
    const nx = sub && x + r.width > window.innerWidth - 8 ? sub.left - r.width : Math.min(x, window.innerWidth - r.width - 8);
    setPos({ x: Math.max(8, nx), y: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) });
  }, [x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrir = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOpen({ i, x: r.right + 2, y: r.top - 5, left: r.left - 2 });
  };
  return (
    <div className="menu" ref={ref} style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) => it.sep ? <hr key={i} /> : (
        <button key={i} disabled={it.disabled} role="menuitem" aria-haspopup={it.items ? 'menu' : undefined} aria-expanded={it.items ? open?.i === i : undefined}
          className={it.items && open?.i === i ? 'open' : undefined}
          onMouseEnter={(e) => { if (it.items && !it.disabled) abrir(i, e.currentTarget); else setOpen(null); }}
          onClick={(e) => { if (it.items) { abrir(i, e.currentTarget); return; } onClose(); it.onClick?.(); }}
          style={it.disabled ? { opacity: 0.4 } : undefined}>
          <span className="grow">{it.label}</span>{it.hint && <span className="kbd">{it.hint}</span>}{it.items && <Icon name="right" size={12} />}
        </button>
      ))}
      {open && items[open.i]?.items && <MenuList key={open.i} x={open.x} y={open.y} items={items[open.i].items!} onClose={onClose} sub={{ left: open.left }} />}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, right }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void; right?: ReactNode }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'active' : ''}`} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
      {right && <><span className="spacer" />{right}</>}
    </div>
  );
}

let toastTimer: number | undefined;
export function toast(msg: string) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { if (el) el.style.display = 'none'; }, 2600);
}

/** Separador arrastrable: devuelve el tamaño en píxeles. */
export function useSplit(key: string, initial: number, min: number, max: number) {
  const [size, setSize] = useState(() => {
    try {
      const v = parseInt(localStorage.getItem(`automatizacion.split.${key}`) ?? '', 10);
      return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : initial;
    } catch { return initial; }
  });
  const save = (v: number) => {
    setSize(v);
    try { localStorage.setItem(`automatizacion.split.${key}`, String(v)); } catch { /* sin almacenamiento */ }
  };
  const start = (e: React.MouseEvent, dir: 'x' | 'y' | '-x' | '-y') => {
    e.preventDefault();
    const s0 = size;
    const p0 = dir.endsWith('x') ? e.clientX : e.clientY;
    const sign = dir.startsWith('-') ? -1 : 1;
    const move = (ev: MouseEvent) => {
      const p = dir.endsWith('x') ? ev.clientX : ev.clientY;
      save(Math.min(max, Math.max(min, s0 + sign * (p - p0))));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); document.body.style.cursor = ''; };
    document.body.style.cursor = dir.endsWith('x') ? 'col-resize' : 'row-resize';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };
  return [size, start] as const;
}

export function downloadText(name: string, text: string, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function pickFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept;
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    inp.click();
  });
}
