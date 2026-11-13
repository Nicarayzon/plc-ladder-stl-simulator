// «Imagen propia» de Temas ▸ Avanzado: una imagen del usuario que se repite como papel de fondo.
// Se guarda solo en este equipo, en su propia clave de localStorage (no en los ajustes, que se reescriben
// en cada cambio). Si es grande, se reduce antes de guardarla para no quitar sitio a los proyectos,
// que viven en el mismo almacenamiento.
import { create } from 'zustand';

const CLAVE = 'automatizacion.papel-propio';
/** Lado máximo en píxeles y tamaño máximo (caracteres del data URL) de lo que se guarda */
export const LADO_MAX = 1200;
export const LONGITUD_MAX = 900_000;

export interface ImagenPropia { url: string; w: number; h: number; nombre: string }

const valida = (v: unknown): v is ImagenPropia => {
  const i = v as ImagenPropia | null;
  return !!i && typeof i.url === 'string' && /^data:image\/(png|jpeg|webp|gif);/.test(i.url) && i.w > 0 && i.h > 0 && typeof i.nombre === 'string';
};

function leer(): ImagenPropia | null {
  if (typeof window === 'undefined') return null;
  try {
    const v: unknown = JSON.parse(window.localStorage.getItem(CLAVE) ?? 'null');
    return valida(v) ? v : null;
  } catch { return null; }
}

interface Estado {
  img: ImagenPropia | null;
  /** false si no cabe en el almacenamiento */
  poner: (img: ImagenPropia) => boolean;
  quitar: () => void;
}

export const useImagenPropia = create<Estado>((set) => ({
  img: leer(),
  poner: (img) => {
    try { localStorage.setItem(CLAVE, JSON.stringify(img)); } catch { return false; }
    set({ img });
    return true;
  },
  quitar: () => {
    try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
    set({ img: null });
  },
}));

const cargar = (url: string) => new Promise<HTMLImageElement>((ok, mal) => {
  const im = new Image();
  im.onload = () => ok(im);
  im.onerror = () => mal(new Error('imagen'));
  im.src = url;
});

const leerFichero = (f: File) => new Promise<string>((ok, mal) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => mal(new Error('fichero'));
  r.readAsDataURL(f);
});

/** Reduce la imagen (WebP, que conserva la transparencia) hasta que quepa en LADO_MAX y LONGITUD_MAX */
function reducir(im: HTMLImageElement, url: string): { url: string; w: number; h: number } {
  let w = im.naturalWidth;
  let h = im.naturalHeight;
  if (Math.max(w, h) <= LADO_MAX && url.length <= LONGITUD_MAX) return { url, w, h };
  let escala = Math.min(1, LADO_MAX / Math.max(w, h));
  let calidad = 0.9;
  for (let i = 0; i < 6; i++) {
    w = Math.max(1, Math.round(im.naturalWidth * escala));
    h = Math.max(1, Math.round(im.naturalHeight * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    lienzo.getContext('2d')?.drawImage(im, 0, 0, w, h);
    const u = lienzo.toDataURL('image/webp', calidad);
    if (u.length <= LONGITUD_MAX) return { url: u, w, h };
    escala *= 0.75;
    calidad = Math.max(0.7, calidad - 0.05);
  }
  throw new Error('grande');
}

/** Abre el selector de ficheros. null = cancelado; 'error' = no es una imagen que se pueda usar */
export function elegirImagen(): Promise<ImagenPropia | 'error' | null> {
  return new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
    inp.onchange = async () => {
      const f = inp.files?.[0];
      if (!f) return resolve(null);
      try {
        const original = await leerFichero(f);
        if (!/^data:image\/(png|jpeg|webp|gif);/.test(original)) return resolve('error');
        const r = reducir(await cargar(original), original);
        resolve({ ...r, nombre: f.name });
      } catch {
        resolve('error');
      }
    };
    inp.click();
  });
}
