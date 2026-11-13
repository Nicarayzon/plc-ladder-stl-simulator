// El papel de fondo de la app: una capa fija detrás de todo (z-index -1 dentro de <html>), así que solo se ve
// donde no hay paneles: el fondo del simulador entre segmentos y los márgenes de las páginas.
// No repinta nada por ciclo: es una imagen fija que el navegador pinta una vez y reutiliza.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useSettings } from '../../store/settings';
import { aplicarTema, paletaDe, type Paleta } from './paletas';
import { imagenPapel, limitar, INTENSIDAD, TAMANO, type PapelId } from './papeles';
import { useImagenPropia, type ImagenPropia } from './imagenPropia';

const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

/** ¿El sistema está en modo oscuro? (para «Automático») */
export function useSistemaOscuro(): boolean {
  const [oscuro, setOscuro] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA_OSCURO).matches);
  useEffect(() => {
    const mq = window.matchMedia(CONSULTA_OSCURO);
    const cambio = () => setOscuro(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return oscuro;
}

/** La paleta que se está viendo ahora */
export function usePaletaVisible(): Paleta {
  const theme = useSettings((s) => s.theme);
  return paletaDe(theme, useSistemaOscuro());
}

/** Pone en <html> los atributos del tema elegido */
export function useAplicarTema(): void {
  const theme = useSettings((s) => s.theme);
  useEffect(() => aplicarTema(document, theme), [theme]);
}

/** background-image y background-size del papel; null si no hay papel (o falta la imagen propia) */
export function fondoPapel(papel: PapelId, paleta: Paleta, tamano: number, img: ImagenPropia | null): CSSProperties | null {
  const t = limitar(tamano, TAMANO);
  if (papel === 'propia') {
    if (!img) return null;
    return { backgroundImage: `url("${img.url}")`, backgroundSize: `${Math.round(img.w * t)}px ${Math.round(img.h * t)}px` };
  }
  if (!papel) return null;
  const { url, lado } = imagenPapel(papel, paleta, t);
  return { backgroundImage: url, backgroundSize: `${lado}px ${lado}px` };
}

export function CapaPapel() {
  const papel = useSettings((s) => s.papel);
  const intensidad = useSettings((s) => s.papelIntensidad);
  const tamano = useSettings((s) => s.papelTamano);
  const paleta = usePaletaVisible();
  const img = useImagenPropia((s) => s.img);
  const fondo = useMemo(() => fondoPapel(papel, paleta, tamano, img), [papel, paleta, tamano, img]);
  useEffect(() => {
    const el = document.documentElement;
    if (fondo) el.setAttribute('data-papel', papel);
    else el.removeAttribute('data-papel');
  }, [fondo, papel]);
  if (!fondo) return null;
  return <div className="papel-capa" aria-hidden="true" style={{ ...fondo, opacity: limitar(intensidad, INTENSIDAD) }} />;
}
