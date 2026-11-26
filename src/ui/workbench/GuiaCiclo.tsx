// La guía «Activar la marca de ciclo» en pantalla (0.29.1): el paso lo calcula `pasoGuia` (guiaCicloEstado.ts) a partir
// del estado, y lo pinta `Guia` (Guia.tsx), igual que la de la tabla de variables.
import { clockByteGuardado, clockByteOf, hwSinCargar, type Programa } from '../../core/program';
import { pasoGuia, useGuiaCiclo, TOTAL_PASOS } from './guiaCicloEstado';
import { Guia, type Zona } from './Guia';
import { T } from '../../i18n';

const ZONAS: Record<string, Zona> = {
  'hw-fila': 'explorador', equipo: 'explorador', proyecto: 'explorador', 'abrir-proyectos': 'ventana',
  'cpu-fila': 'ventana', 'tab-ciclo': 'ventana', 'check-ciclo': 'ventana', 'byte-ciclo': 'ventana', aceptar: 'pie', guardar: 'ventana', cargar: 'ventana', 'estado-hw': 'ventana',
};

export function GuiaCiclo({ programa }: { programa: Programa }) {
  const { hw, sugerido, terminar } = useGuiaCiclo();
  const paso = pasoGuia({ guardado: clockByteGuardado(programa), cargado: clockByteOf(programa), sinCargar: hwSinCargar(programa), hw, sugerido });
  return <Guia titulo={T.guia.titulo} icono="clock" total={TOTAL_PASOS} paso={paso} zonas={ZONAS} onCerrar={terminar} />;
}
