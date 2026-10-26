// Datos de los ejemplos interactivos: los escribe el generador en cada página y los lee docs/vivo.js.
import type { SegmentoKOP } from '../../src/kop/model';

export type TipoValor = 'BOOL' | 'BYTE' | 'INT' | 'DINT' | 'REAL' | 'WORD';

export interface OperandoVivo {
  /** Operando con la nemotécnica alemana, como en las pruebas: «E 0.0», «MW 30» */
  op: string;
  tipo: TipoValor;
  /** Valor inicial en el panel */
  valor: string;
}

export interface DatosVivo {
  /** Código del ejemplo: su modelo KOP sale de src/content/kop/models.ts */
  id: string;
  kop: boolean;
  /** Modelo KOP de los ejemplos que solo están en la web (web/teoria/ejemplos-web.ts) */
  segmentos?: SegmentoKOP[];
  /** Byte de la marca de ciclo, si el ejemplo la usa */
  marcaCiclo?: number;
  /** Código AWL (nemotecnia alemana), para los ejemplos sin modelo KOP */
  awl?: string;
  /** Nemotecnia con la que se enseñan los operandos */
  nemotecnia: 'de' | 'en';
  entradas: OperandoVivo[];
  salidas: OperandoVivo[];
}

export interface TextosVivo {
  pruebalo: string;
  pista: string;
  /** Solo con teclado: en pantallas táctiles no se enseña */
  pistaMayus: string;
  reiniciar: string;
  valorNoValido: string;
}

const normal = (op: string) => op.trim().toUpperCase().replace(/^([A-Z]+)\s*(\d)/, '$1 $2');

/** Tipo por defecto según el operando; null en temporizadores y contadores (el panel los enseña aparte) */
function tipoDe(op: string, explicito: string | undefined): TipoValor | null {
  if (explicito) return /^(VALOR|Q)$/i.test(explicito) ? null : (explicito.toUpperCase() as TipoValor);
  if (/\d+\.\d$/.test(op)) return 'BOOL';
  if (/^[TZC] \d+$/.test(op)) return null;
  const tam = /^(?:P?[EAM]|DB\d+\.DB)([BWD])/.exec(op)?.[1];
  return tam === 'B' ? 'BYTE' : tam === 'W' ? 'INT' : tam === 'D' ? 'DINT' : null;
}

function pares(mapa: string): [string, string][] {
  return [...mapa.matchAll(/(?:"([^"]+)"|([^\s,:{}"]+))\s*:\s*(?:"([^"]*)"|([^,}]+))/g)]
    .map((m) => [m[1] ?? m[2], (m[3] ?? m[4]).trim()]);
}

/** Entradas (lo que las pruebas cambian) y salidas (lo que comprueban) a partir del YAML de las pruebas */
export function datosDePruebas(yaml: string): { entradas: OperandoVivo[]; salidas: OperandoVivo[] } {
  const entradas = new Map<string, OperandoVivo>();
  const salidas = new Map<string, OperandoVivo>();
  const anotar = (destino: Map<string, OperandoVivo>, clave: string, valor: string, inicial: boolean) => {
    const [texto, explicito] = clave.split(':');
    const op = normal(texto);
    const tipo = tipoDe(op, explicito);
    if (!tipo) return;
    const ya = destino.get(op);
    // los bits empiezan como dicen las condiciones iniciales (un paro NC vale 1); los números, con el primer valor de la prueba
    if (!ya) destino.set(op, { op, tipo, valor: tipo === 'BOOL' && !inicial ? '0' : valor });
    else if (inicial) ya.valor = valor;
  };
  for (const m of yaml.matchAll(/\b(inicial|poner|esperar):\s*\{([^}]*)\}/g)) {
    for (const [clave, valor] of pares(m[2])) {
      anotar(m[1] === 'esperar' ? salidas : entradas, clave, valor, m[1] === 'inicial');
    }
  }
  for (const m of yaml.matchAll(/\bpulso:\s*([^\s#]+)/g)) anotar(entradas, m[1], '0', false);
  for (const op of entradas.keys()) salidas.delete(op);
  return { entradas: ordenar([...entradas.values()]), salidas: ordenar([...salidas.values()]) };
}

/** Bits por dirección (E 1.0, E 1.1, E 1.2…) y después los números, en el orden de las pruebas */
function ordenar(ops: OperandoVivo[]): OperandoVivo[] {
  const clave = (o: OperandoVivo) => {
    const m = /^([A-Z]+) (\d+)\.(\d)$/.exec(o.op);
    return m ? `${m[1]}${m[2].padStart(5, '0')}.${m[3]}` : null;
  };
  const bits = ops.filter((o) => clave(o)).sort((a, b) => clave(a)!.localeCompare(clave(b)!));
  return [...bits, ...ops.filter((o) => !clave(o))];
}
