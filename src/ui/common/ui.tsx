import { type CSSProperties, type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

/** Escucha Escape en la ventana del propio diálogo, que puede ser una ventana aparte (portal a otro documento). */
export function Modal({ title, onClose, children, footer, width = 560 }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = ref.current?.ownerDocument.defaultView ?? window;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    w.addEventListener('keydown', k);
    return () => w.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" ref={ref} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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

/** `items`: submenú (por ejemplo, «Insertar nuevo objeto ▸» del explorador de proyectos). `checked`: opción elegida de un desplegable (✓) */
export interface MenuItem { label: string; onClick?: () => void; disabled?: boolean; sep?: boolean; hint?: string; items?: MenuItem[]; checked?: boolean }

/** `encima`: borde superior del control que abre el menú; si no cabe debajo, se abre encima.
 *  Escucha en la ventana del propio menú, que puede ser la de Señales E/S (portal a otro documento). */
export function ContextMenu({ x, y, items, onClose, encima }: { x: number; y: number; items: MenuItem[]; onClose: () => void; encima?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const w = ref.current?.ownerDocument.defaultView;
    if (!w) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const t = w.setTimeout(() => w.addEventListener('mousedown', close), 0);
    w.addEventListener('keydown', k);
    return () => { w.clearTimeout(t); w.removeEventListener('mousedown', close); w.removeEventListener('keydown', k); };
  }, [onClose]);
  return <div ref={ref}><MenuList x={x} y={y} items={items} onClose={onClose} encima={encima} /></div>;
}

function MenuList({ x, y, items, onClose, sub, encima }: { x: number; y: number; items: MenuItem[]; onClose: () => void; sub?: { left: number }; encima?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const [open, setOpen] = useState<{ i: number; x: number; y: number; left: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const w = el?.ownerDocument.defaultView;
    if (!el || !w) return;
    const r = el.getBoundingClientRect();
    // un submenú que no cabe a la derecha se abre a la izquierda del menú padre
    const nx = sub && x + r.width > w.innerWidth - 8 ? sub.left - r.width : Math.min(x, w.innerWidth - r.width - 8);
    const ny = encima !== undefined && y + r.height > w.innerHeight - 8 && encima - r.height - 2 >= 8 ? encima - r.height - 2 : Math.min(y, w.innerHeight - r.height - 8);
    setPos({ x: Math.max(8, nx), y: Math.max(8, ny) });
  }, [x, y]); // eslint-disable-line react-hooks/exhaustive-deps
  const abrir = (i: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setOpen({ i, x: r.right + 2, y: r.top - 5, left: r.left - 2 });
  };
  return (
    <div className="menu" ref={ref} style={{ left: pos.x, top: pos.y }} role="menu">
      {items.map((it, i) => it.sep ? <hr key={i} /> : (
        <button key={i} disabled={it.disabled} role={it.checked !== undefined ? 'menuitemradio' : 'menuitem'} aria-checked={it.checked} aria-haspopup={it.items ? 'menu' : undefined} aria-expanded={it.items ? open?.i === i : undefined}
          className={it.items && open?.i === i ? 'open' : undefined}
          onMouseEnter={(e) => { if (it.items && !it.disabled) abrir(i, e.currentTarget); else setOpen(null); }}
          onClick={(e) => { if (it.items) { abrir(i, e.currentTarget); return; } onClose(); it.onClick?.(); }}
          style={it.disabled ? { opacity: 0.4 } : undefined}>
          {it.checked !== undefined && <span className="menu-check">{it.checked && <Icon name="check" size={12} />}</span>}
          <span className="grow">{it.label}</span>{it.hint && <span className="kbd">{it.hint}</span>}{it.items && <Icon name="right" size={12} />}
        </button>
      ))}
      {open && items[open.i]?.items && <MenuList key={open.i} x={open.x} y={open.y} items={items[open.i].items!} onClose={onClose} sub={{ left: open.left }} />}
    </div>
  );
}

/** Desplegable con el menú de la app en lugar de un `<select>`: la lista nativa es una ventana emergente
 *  que algunos sistemas no enseñan (el .exe de Windows con Wine en Linux solo dejaba ver la opción elegida).
 *  Todas las etiquetas ocupan la misma celda y solo se ve la elegida, así que el ancho es el de la más larga, como en el nativo. */
export function Desplegable<T extends string>({ value, options, onChange, disabled, style, title, 'aria-label': ariaLabel }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
  disabled?: boolean; style?: CSSProperties; title?: string; 'aria-label'?: string;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; encima: number } | null>(null);
  const cerrar = useCallback(() => setMenu(null), []);
  const i = options.findIndex((o) => o.value === value);
  const abrir = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setMenu({ x: r.left, y: r.bottom + 2, encima: r.top });
  };
  return (
    <>
      <button ref={btn} type="button" className="input desplegable" style={style} disabled={disabled} title={title} aria-label={ariaLabel} aria-haspopup="menu" aria-expanded={!!menu}
        // con el menú abierto, pulsar en el botón lo cierra (si no, se cerraría al pulsar y se volvería a abrir al soltar)
        onMouseDown={(e) => { if (menu) e.stopPropagation(); }}
        onClick={(e) => { if (menu) setMenu(null); else abrir(e.currentTarget); }}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
          e.preventDefault();
          const j = Math.max(0, Math.min(options.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
          if (j !== i) onChange(options[j].value);
        }}>
        <span className="desplegable-val">
          {options.map((o) => <span key={o.value} aria-hidden={o.value !== value || undefined}>{o.label}</span>)}
          {i < 0 && <span>{value}</span>}
        </span>
        <Icon name="down" size={11} />
      </button>
      {/* en el <body> de su documento: fuera de las <label>, que reenviarían el clic al botón */}
      {menu && btn.current && createPortal(
        <ContextMenu x={menu.x} y={menu.y} encima={menu.encima} onClose={cerrar}
          items={options.map((o) => ({ label: o.label, checked: o.value === value, onClick: () => onChange(o.value) }))} />,
        btn.current.ownerDocument.body,
      )}
    </>
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
/** `doc`: el documento donde sale el aviso (el de una ventana aparte, si se llama desde ella) */
export function toast(msg: string, doc: Document = document) {
  let el = doc.getElementById('toast');
  if (!el) {
    el = doc.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    doc.body.appendChild(el);
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
