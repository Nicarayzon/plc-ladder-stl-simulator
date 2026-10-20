/** Error en tiempo de ejecución. Como el OB de error no está cargado, la CPU pasa a STOP. */
export class PLCError extends Error {
  ob: number;
  constructor(msg: string, ob = 121) {
    super(msg);
    this.ob = ob;
    this.name = 'PLCError';
  }
}

/** Error de sintaxis o de compilación: el programa no se puede cargar. */
export class CompileError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'CompileError';
  }
}

/** Error de las pruebas (equivale a ValueError en la referencia). */
export class TestValueError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'ValueError';
  }
}
