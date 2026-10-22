// Iconos SVG en línea (trazos de 24×24, estilo lineal)
const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  book: 'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
  swap: 'M7 16V4M7 4 3 8M7 4l4 4M17 8v12M17 20l4-4M17 20l-4-4',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  wave: 'M2 12h4V6h5v12h5V8h4v4h2',
  popout: 'M14 3h7v7M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  cpu: 'M6 6h12v12H6zM9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3',
  chart: 'M3 3v18h18M7 14l4-4 4 4 5-6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
  play: 'M6 4l14 8-14 8z',
  pause: 'M7 4h4v16H7zM13 4h4v16h-4z',
  stepc: 'M5 4l10 8-10 8zM17 4h3v16h-3z',
  stepi: 'M4 12h11M11 6l6 6-6 6M20 4v16',
  stop: 'M6 6h12v12H6z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  x: 'M18 6 6 18M6 6l12 12',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  up: 'm18 15-6-6-6 6',
  down: 'm6 9 6 6 6-6',
  right: 'm9 18 6-6-6-6',
  left: 'm15 18-6-6 6-6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  dots: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  check: 'M20 6 9 17l-5-5',
  alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  zoomin: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomout: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3M8 11h6',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  refresh: 'M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5',
  ladder: 'M4 3v18M20 3v18M4 8h4M10 5v6M14 5v6M14 8h6M4 16h4M10 13v6M14 13v6M10 13l4 6M14 16h6',
  bolt: 'M13 2 3 14h9l-1 8 10-12h-9z',
  graduation: 'M22 10 12 5 2 10l10 5zM6 12v5c3 2 9 2 12 0v-5',
  // tabla de variables (ventana «Var - VAT_n»)
  enchufe: 'M2 12h5M7 8h5a4 4 0 0 1 0 8H7zM16 10h6M16 14h6',
  nuevo: 'M14 3H5v18h14V8zM14 3v5h5',
  abrir: 'M3 19V5h6l2 2h8v3M3 19l3-9h15l-3 9z',
  imprimir: 'M6 9V3h12v6M6 17H4v-8h16v8h-2M6 13h12v8H6z',
  cortar: 'M6 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12',
  pegar: 'M9 3h6v4H9zM9 5H5v16h14V5h-4',
  deshacer: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4',
  rehacer: 'M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h4',
  enlace: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  desenlace: 'M18.8 13.2 20 12a5 5 0 0 0-7-7l-1.2 1.2M5.2 10.8 4 12a5 5 0 0 0 7 7l1.2-1.2M8 2v3M2 8h3M16 22v-3M22 16h-3',
  ayudaCtx: 'M3 3l5 14 2-5 5-2zM15 4a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5v.5M17.5 12h.01',
  disparo: 'M11 19C6 19 2 16 2 12s4-7 10-7 10 3 10 7M14 22l1-3 5-5 2 2-5 5z',
  gafas: 'M6 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM18 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM10 13.5a2 2 0 0 1 4 0M2.5 13 4 6h2M21.5 13 20 6h-2',
  gafas1: 'M5 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM13 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a1 1 0 0 1 2 0M19 16l2-1.5V22',
  rayo: 'M3 19l5-7 4 3 6-9M14 6h4v4',
  rayo1: 'M2 16l4-5 3 2 5-7M11 6h3v3M19 16l2-1.5V22',
  forzado: 'M5 20 11 4M10 20l6-16M15 20l6-16',
};

export function Icon({ name, size = 16, stroke = 1.8, className, title }: { name: keyof typeof P | string; size?: number; stroke?: number; className?: string; title?: string }) {
  const filled = name === 'play' || name === 'pause' || name === 'stop' || name === 'stepc';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name] ?? P.info} />
    </svg>
  );
}
