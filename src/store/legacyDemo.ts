import type { Programa } from '../core/program';

/** Programa de ejemplo de versiones anteriores (solo para reconocerlo y quitarlo). */
export function demoAntiguo(): Programa {
  return {
    nemotecnia: 'de',
    simbolos: [
      { nombre: 'Marcha', dir: 'E 0.0', tipo: 'BOOL', comentario: 'Pulsador de marcha (NA)' },
      { nombre: 'Paro', dir: 'E 0.1', tipo: 'BOOL', comentario: 'Pulsador de paro (NC)' },
      { nombre: 'Motor', dir: 'A 4.0', tipo: 'BOOL', comentario: 'Contactor del motor' },
      { nombre: 'Piloto', dir: 'A 4.1', tipo: 'BOOL', comentario: 'Se enciende 3 s después de arrancar' },
    ],
    bloques: [{
      nombre: 'OB1',
      segmentos: [
        { lang: 'KOP', kop: {
          id: 'demo1', titulo: 'Marcha y paro con enclavamiento',
          entrada: { k: 'SER', id: 'd1', items: [
            { k: 'PAR', id: 'd2', ramas: [{ k: 'NA', id: 'd3', op: '"Marcha"' }, { k: 'NA', id: 'd4', op: '"Motor"' }] },
            { k: 'NA', id: 'd5', op: '"Paro"' },
          ] },
          salidas: [{ salida: { k: 'BOB', id: 'd6', op: '"Motor"' } }],
        } },
        { lang: 'AWL', id: 'demo2', titulo: 'Piloto con retardo a la conexión', awl: '      U     "Motor"\n      L     S5T#3S\n      SE    T 1\n      U     T 1\n      =     "Piloto"' },
      ],
    }],
  };
}
