// La guía «Abrir la tabla de variables» en pantalla (0.29.1): lee lo que hay a la vista (menús y la tabla, por sus
// atributos `data-guia`), calcula el paso con `pasoGuiaVat` (guiaVatEstado.ts) y lo pinta `Guia` (Guia.tsx).
import { Guia, useEnPantalla, type Zona } from './Guia';
import { pasoGuiaVat, useGuiaVat, TOTAL_PASOS_VAT, type EstadoVat } from './guiaVatEstado';
import { T } from '../../i18n';

const ZONAS: Record<string, Zona> = {
  bloques: 'explorador', proyecto: 'explorador', 'vat-fila': 'explorador', 'abrir-proyectos': 'ventana',
  'insertar-objeto': 'explorador', 'nueva-vat': 'explorador', 'vat-gafas': 'ventana', 'vat-operando': 'ventana', 'vat-tabla': 'ventana',
};

/** Lo que se ve ahora: los menús abiertos y la primera tabla de variables a la vista */
function leer(): Omit<EstadoVat, 'existente'> {
  const v = document.querySelector<HTMLElement>('[data-guia="vat-ventana"]');
  const tabla = v ? {
    nombre: v.dataset.vat ?? '',
    visible: !!v.querySelector('[data-guia="vat-tabla"]'),
    observando: v.querySelector('[data-guia="vat-gafas"]')?.getAttribute('aria-pressed') === 'true',
    conOperando: [...v.querySelectorAll('td[data-c="op"]')].some((td) => (td.textContent ?? '').trim() !== ''),
  } : null;
  return {
    tabla,
    menuInsertar: !!document.querySelector('[data-guia="insertar-objeto"]'),
    menuVat: !!document.querySelector('[data-guia="nueva-vat"]'),
  };
}

export function GuiaVat({ existente }: { existente?: string }) {
  const terminar = useGuiaVat((g) => g.terminar);
  const visto = useEnPantalla(leer, (x) => JSON.stringify(x));
  const paso = pasoGuiaVat({ ...visto, existente });
  return <Guia titulo={T.guiaVat.titulo} icono="table" total={TOTAL_PASOS_VAT} paso={paso} zonas={ZONAS} onCerrar={terminar} />;
}
