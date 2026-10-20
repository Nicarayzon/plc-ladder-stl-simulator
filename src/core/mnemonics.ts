// Conjuntos de nemónicos (alemán) y traducción inglés → alemán, igual que la referencia.

export const BITLOGIC = new Set(['U', 'UN', 'O', 'ON', 'X', 'XN']);
export const NEST_OPEN = new Set(['U(', 'UN(', 'O(', 'ON(', 'X(', 'XN(']);
export const CMP = new Set<string>();
for (const r of ['==', '<>', '>', '<', '>=', '<=']) for (const t of 'IDR') CMP.add(r + t);
export const ARITH = new Set(['+I', '-I', '*I', '/I', '+D', '-D', '*D', '/D', 'MOD', '+R', '-R', '*R', '/R']);
export const FLOATFN = new Set(['ABS', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN']);
export const CONV = new Set(['BTI', 'ITB', 'BTD', 'DTB', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-',
  'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD']);
export const WORDLOG = new Set(['UW', 'OW', 'XOW', 'UD', 'OD', 'XOD']);
export const SHIFTS = new Set(['SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD']);
export const TSTART = new Set(['SI', 'SV', 'SE', 'SS', 'SA']);
export const JUMPS = new Set(['SPA', 'SPB', 'SPBN', 'SPBB', 'SPBNB', 'SPBI', 'SPBIN', 'SPO', 'SPS', 'SPZ', 'SPN',
  'SPP', 'SPM', 'SPPZ', 'SPMZ', 'SPU', 'SPL', 'LOOP']);
export const NO_OPERAND = new Set<string>(['NOT', 'SET', 'CLR', 'SAVE', 'TAK', 'PUSH', 'POP', 'RLDA', 'RRDA', 'BE', 'BEA', 'BEB',
  'MCRA', 'MCRD', 'MCR(', ')MCR', ')', ...NEST_OPEN, ...CMP, ...ARITH, ...FLOATFN, ...CONV]);
export const OTHERS = new Set(['=', 'S', 'R', 'FP', 'FN', 'FR', 'ZV', 'ZR', 'L', 'LC', 'T', 'LAR1', 'LAR2', 'TAR1', 'TAR2',
  '+AR1', '+AR2', 'INC', 'DEC', '+', 'AUF', 'UC', 'CC', 'CALL', 'NOP', 'BLD', 'ENT', 'LEAVE']);
export const MNEMONICS = new Set<string>([...BITLOGIC, ...NO_OPERAND, ...WORDLOG, ...SHIFTS, ...TSTART, ...JUMPS, ...OTHERS]);

export const EN2DE: Record<string, string> = {
  A: 'U', AN: 'UN', 'A(': 'U(', 'AN(': 'UN(',
  SP: 'SI', SE: 'SV', SD: 'SE', SF: 'SA', CU: 'ZV', CD: 'ZR',
  JU: 'SPA', JC: 'SPB', JCN: 'SPBN', JCB: 'SPBB', JNB: 'SPBNB', JBI: 'SPBI', JNBI: 'SPBIN',
  JO: 'SPO', JOS: 'SPS', JZ: 'SPZ', JN: 'SPN', JP: 'SPP', JM: 'SPM', JPZ: 'SPPZ',
  JMZ: 'SPMZ', JUO: 'SPU', JL: 'SPL',
  BEC: 'BEB', BEU: 'BEA', OPN: 'AUF', AW: 'UW', AD: 'UD',
};

export const DE2EN: Record<string, string> = Object.fromEntries(Object.entries(EN2DE).map(([en, de]) => [de, en]));

/** Descripción breve de cada nemónico (para autocompletar y ayudas). */
export const MNEMONIC_HELP: Record<string, string> = {
  U: 'Y (consulta un bit)', UN: 'Y negada', O: 'O (sin operando: O de grupos Y)', ON: 'O negada', X: 'O-exclusiva', XN: 'O-exclusiva negada',
  'U(': 'Y con paréntesis', 'UN(': 'Y negada con paréntesis', 'O(': 'O con paréntesis', 'ON(': 'O negada con paréntesis',
  'X(': 'O-exclusiva con paréntesis', 'XN(': 'O-exclusiva negada con paréntesis', ')': 'Cierra paréntesis',
  '=': 'Asignación (bit = RLO)', S: 'Poner a 1 si RLO = 1 (o cargar contador)', R: 'Poner a 0 si RLO = 1 (también T/Z)',
  NOT: 'Negar el RLO', SET: 'RLO = 1', CLR: 'RLO = 0', SAVE: 'Guardar RLO en RB (BIE)', FP: 'Flanco positivo del RLO', FN: 'Flanco negativo del RLO',
  SI: 'Temporizador impulso', SV: 'Temporizador impulso prolongado', SE: 'Temporizador retardo a la conexión',
  SS: 'Temporizador retardo a la conexión con memoria', SA: 'Temporizador retardo a la desconexión', FR: 'Habilitar (rearmar flanco) T/Z',
  ZV: 'Contar adelante', ZR: 'Contar atrás',
  L: 'Cargar en ACU1 (ACU1 → ACU2)', LC: 'Cargar valor BCD de T/Z', T: 'Transferir ACU1 al operando',
  LAR1: 'Cargar AR1', LAR2: 'Cargar AR2', TAR1: 'Transferir AR1', TAR2: 'Transferir AR2', '+AR1': 'Sumar a AR1', '+AR2': 'Sumar a AR2',
  TAK: 'Intercambiar ACU1 y ACU2', PUSH: 'ACU2 = ACU1', POP: 'ACU1 = ACU2', INC: 'Incrementar ACU1-LL', DEC: 'Decrementar ACU1-LL', '+': 'Sumar constante a ACU1',
  '+I': 'Sumar INT', '-I': 'Restar INT', '*I': 'Multiplicar INT', '/I': 'Dividir INT (cociente y resto)',
  '+D': 'Sumar DINT', '-D': 'Restar DINT', '*D': 'Multiplicar DINT', '/D': 'Dividir DINT', MOD: 'Resto DINT',
  '+R': 'Sumar REAL', '-R': 'Restar REAL', '*R': 'Multiplicar REAL', '/R': 'Dividir REAL',
  ABS: 'Valor absoluto REAL', SQR: 'Cuadrado', SQRT: 'Raíz cuadrada', EXP: 'Exponencial', LN: 'Logaritmo natural',
  SIN: 'Seno', COS: 'Coseno', TAN: 'Tangente', ASIN: 'Arcoseno', ACOS: 'Arcocoseno', ATAN: 'Arcotangente',
  BTI: 'BCD → INT', ITB: 'INT → BCD', BTD: 'BCD → DINT', DTB: 'DINT → BCD', ITD: 'INT → DINT', DTR: 'DINT → REAL',
  RND: 'Redondear REAL → DINT', TRUNC: 'Truncar REAL → DINT', 'RND+': 'Redondear hacia +∞', 'RND-': 'Redondear hacia −∞',
  INVI: 'Complemento a 1 (16 bits)', INVD: 'Complemento a 1 (32 bits)', NEGI: 'Complemento a 2 INT', NEGD: 'Complemento a 2 DINT', NEGR: 'Negar REAL',
  CAW: 'Intercambiar bytes de ACU1-L', CAD: 'Intercambiar bytes de ACU1',
  UW: 'Y palabra', OW: 'O palabra', XOW: 'O-exclusiva palabra', UD: 'Y doble palabra', OD: 'O doble palabra', XOD: 'O-exclusiva doble palabra',
  SLW: 'Desplazar palabra a la izquierda', SRW: 'Desplazar palabra a la derecha', SSI: 'Desplazar INT con signo',
  SLD: 'Desplazar doble palabra a la izquierda', SRD: 'Desplazar doble palabra a la derecha', SSD: 'Desplazar DINT con signo',
  RLD: 'Rotar a la izquierda', RRD: 'Rotar a la derecha', RLDA: 'Rotar a la izquierda por A1', RRDA: 'Rotar a la derecha por A1',
  SPA: 'Salto incondicional', SPB: 'Saltar si RLO = 1', SPBN: 'Saltar si RLO = 0', SPBB: 'Saltar si RLO = 1 y guardar en RB',
  SPBNB: 'Saltar si RLO = 0 y guardar en RB', SPBI: 'Saltar si RB = 1', SPBIN: 'Saltar si RB = 0', SPO: 'Saltar si OV = 1',
  SPS: 'Saltar si OS = 1 (lo borra)', SPZ: 'Saltar si resultado = 0', SPN: 'Saltar si resultado ≠ 0', SPP: 'Saltar si resultado > 0',
  SPM: 'Saltar si resultado < 0', SPPZ: 'Saltar si ≥ 0', SPMZ: 'Saltar si ≤ 0', SPU: 'Saltar si resultado no válido', SPL: 'Lista de saltos',
  LOOP: 'Bucle (ACU1-L − 1, salta si ≠ 0)', BE: 'Fin de bloque', BEA: 'Fin de bloque incondicional', BEB: 'Fin de bloque si RLO = 1',
  AUF: 'Abrir DB/DI', UC: 'Llamada incondicional', CC: 'Llamada condicional (RLO = 1)', CALL: 'Llamada a bloque',
  MCRA: 'Activar MCR', MCRD: 'Desactivar MCR', 'MCR(': 'Abrir zona MCR', ')MCR': 'Cerrar zona MCR', NOP: 'Sin operación', BLD: 'Instrucción de dibujo (sin efecto)',
  '==I': 'Igual INT', '<>I': 'Distinto INT', '>I': 'Mayor INT', '<I': 'Menor INT', '>=I': 'Mayor o igual INT', '<=I': 'Menor o igual INT',
  '==D': 'Igual DINT', '<>D': 'Distinto DINT', '>D': 'Mayor DINT', '<D': 'Menor DINT', '>=D': 'Mayor o igual DINT', '<=D': 'Menor o igual DINT',
  '==R': 'Igual REAL', '<>R': 'Distinto REAL', '>R': 'Mayor REAL', '<R': 'Menor REAL', '>=R': 'Mayor o igual REAL', '<=R': 'Menor o igual REAL',
};
