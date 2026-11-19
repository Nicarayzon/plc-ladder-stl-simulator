// Bloques de biblioteca FC 82 (RSET) y FC 83 (SSET): CALL con parámetros, ejecución, errores, avisos y fuentes.
import { describe, expect, it } from 'vitest';
import { CPU } from '../../src/core/cpu';
import { compileProgram, compileProgramStrict, programFromAwl, clockByteOf, clockByteGuardado, hwSinCargar, migrarHwCargado, conBibliotecaUsada, type Programa } from '../../src/core/program';
import { compileProgramText } from '../../src/core/compiler';
import { testRead, testWrite } from '../../src/core/testio';
import { lintProgram } from '../../src/core/lint';
import { analyzeUsage, outputBits } from '../../src/core/usage';
import { translateAwl } from '../../src/core/translate';
import { exportAwlSource, importAwlSource } from '../../src/core/awlsource';
import { addLibBlock, libEnProyecto } from '../../src/ui/workbench/programOps';
import { nuevaEstacion } from '../../src/core/hardware';
import { box, bob, na, seg, segs } from '../../src/kop/build';
import { kopToAwlText } from '../../src/kop/compile';
import { validateSegment } from '../../src/kop/validate';
import { libsDeSegmento, type SegmentoKOP } from '../../src/kop/model';

/** Programa con los bloques AWL dados y, además, los bloques de biblioteca indicados. */
function prog(blocks: Record<string, string>, libs: ('RSET' | 'SSET')[] = ['RSET']): Programa {
  let p = programFromAwl(blocks);
  for (const l of libs) p = addLibBlock(p, l);
  return p;
}
const errores = (p: Programa) => compileProgram(p).errors.map((e) => e.msg);
const bits = (cpu: CPU, byte: string) => [0, 1, 2, 3, 4, 5, 6, 7].map((b) => testRead(cpu, `${byte}.${b}`)).join('');

// El programa que pasó un usuario: reset de zona con FC 82 al pulsar E 124.7
const ITALIANO = `// --- 1. CC FC 1 ---
      U     E 124.0
      U     M 0.5
      FP    M 5.0
      CC    FC 1
// --- 2. CALL FC 2 ---
      CALL  FC 2
// --- 3. RESET DE ZONA CON FC 82 ---
      U     E 124.7
      SPBN  FIN
      CALL  FC 82           // reset en bloque
      S_BIT := A 124.0     // desde A 124.0...
      N    := 5           // ...5 bits (A 124.0 a A 124.4)
FIN:  NOP 0`;

describe('FC 82 (RSET): el programa del usuario', () => {
  it('compila con el FC 82 en el proyecto y pone a 0 A 124.0–A 124.4 al pulsar E 124.7', () => {
    const p = prog({ OB1: ITALIANO, FC1: '      L     AB 125\n      INC   1\n      T     AB 125', FC2: '      SET\n      S     A 124.0\n      S     A 124.1\n      S     A 124.5' });
    expect(errores(p)).toEqual([]);
    const cpu = new CPU(compileProgramStrict(p));
    cpu.scan();
    // FC 2 se llama siempre y pone A 124.0, A 124.1 y A 124.5
    expect(bits(cpu, 'A124')).toBe('11000100');
    testWrite(cpu, 'E124.7', 1);
    cpu.scan();
    // FC 2 los vuelve a poner, pero después FC 82 borra A 124.0–124.4: solo queda A 124.5
    expect(bits(cpu, 'A124')).toBe('00000100');
    expect(cpu.state).toBe('RUN');
  });

  it('sin el FC 82 en el proyecto compila, avisa (B04) y la CPU pasa a STOP al llamarlo', () => {
    const p = prog({ OB1: ITALIANO, FC1: 'NOP 0', FC2: 'NOP 0' }, []);
    const pc = compileProgram(p);
    expect(pc.errors).toEqual([]);
    const avisos = lintProgram(p, pc).map((w) => w.msg);
    expect(avisos.some((m) => m.startsWith('B04') && m.includes('FC 82') && m.includes('RSET'))).toBe(true);
    const cpu = new CPU(pc.cp!);
    cpu.scan();
    expect(cpu.state).toBe('RUN'); // E 124.7 = 0: salta la llamada
    testWrite(cpu, 'E124.7', 1);
    cpu.scan();
    expect(cpu.state).toBe('STOP');
    expect(cpu.stopReason).toContain('Llamada a un bloque que no existe: FC82');
  });

  it('antes el error era «instrucción desconocida: N»: ya no', () => {
    const msgs = errores(prog({ OB1: ITALIANO, FC1: 'NOP 0', FC2: 'NOP 0' }));
    expect(msgs.join('\n')).not.toMatch(/desconocida/);
  });
});

describe('FC 82 y FC 83: ejecución', () => {
  it('FC 83 pone a 1 un rango que cruza de byte; FC 82 lo vuelve a 0', () => {
    const ob1 = `      U     E 0.0
      SPBN  m1
      CALL  FC 83
        S_BIT := M 0.6
        N     := 4
m1:   U     E 0.1
      SPBN  m2
      CALL  FC 82
        S_BIT := P#M 0.0
        N     := 16
m2:   NOP   0`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 }, ['RSET', 'SSET'])));
    testWrite(cpu, 'E0.0', 1);
    cpu.scan();
    expect(bits(cpu, 'M0')).toBe('00000011');
    expect(bits(cpu, 'M1')).toBe('11000000');
    testWrite(cpu, 'E0.0', 0);
    testWrite(cpu, 'E0.1', 1);
    cpu.scan();
    expect(bits(cpu, 'M0') + bits(cpu, 'M1')).toBe('0000000000000000');
  });

  it('N puede ser una palabra; N = 0 o negativo no hace nada', () => {
    const ob1 = `      CALL  FC 83
        S_BIT := M 10.0
        N     := MW 20`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 }, ['SSET'])));
    testWrite(cpu, 'MW20', 3);
    cpu.scan();
    expect(bits(cpu, 'M10')).toBe('11100000');
    for (const n of [0, -5]) {
      testWrite(cpu, 'MB10', 0);
      testWrite(cpu, 'MW20', n);
      cpu.scan();
      expect(bits(cpu, 'M10')).toBe('00000000');
    }
  });

  it('el GRAFCET de la teoría: borra las etapas y activa la inicial', () => {
    const ob1 = `      U     E 0.0
      SPBN  m002
      CALL  FC 82
        S_BIT := M 0.0
        N     := 8
      SET
      S     M 0.0
m002: NOP   0`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 })));
    testWrite(cpu, 'MB0', 0b10110100);
    testWrite(cpu, 'E0.0', 1);
    cpu.scan();
    expect(bits(cpu, 'M0')).toBe('10000000');
  });

  it('al volver: /ER = 0, OR = 0 y BIE = 1', () => {
    const ob1 = `      U     E 0.0
      CALL  FC 82
        S_BIT := M 0.0
        N     := 1
      U     E 0.1
      =     M 1.0`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 })));
    cpu.tracing = true;
    testWrite(cpu, 'E0.0', 1);
    testWrite(cpu, 'E0.1', 0);
    cpu.scan();
    const fila = cpu.trace.find((r) => r.mn === 'CALL')!;
    expect(fila.er).toBe(0);
    expect(fila.or).toBe(0);
    expect(fila.br).toBe(1);
    // la siguiente U empieza una cadena nueva (no se combina con el RLO de antes)
    expect(testRead(cpu, 'M1.0')).toBe(0);
  });

  it('depende del MCR: en una zona MCR desactivada no cambia nada', () => {
    const ob1 = `      MCRA
      U     E 0.0
      MCR(
      CALL  FC 83
        S_BIT := A 4.0
        N     := 3
      )MCR
      MCRD`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 }, ['SSET'])));
    cpu.scan();
    expect(bits(cpu, 'A4')).toBe('00000000');
    testWrite(cpu, 'E0.0', 1);
    cpu.scan();
    expect(bits(cpu, 'A4')).toBe('11100000');
  });

  it('un rango que se sale del área pasa a STOP', () => {
    const ob1 = `      CALL  FC 83
        S_BIT := A 127.0
        N     := 9`;
    const cpu = new CPU(compileProgramStrict(prog({ OB1: ob1 }, ['SSET'])));
    cpu.scan();
    expect(cpu.state).toBe('STOP');
    expect(cpu.stopReason).toMatch(/fuera de rango/);
  });

  it('en nemotecnia inglesa: Q y P#Q', () => {
    const p: Programa = { ...prog({ OB1: `      CALL  FC 83\n        S_BIT := P#Q 4.2\n        N     := 2` }, ['SSET']), nemotecnia: 'en' };
    expect(errores(p)).toEqual([]);
    const cpu = new CPU(compileProgramStrict(p));
    cpu.scan();
    expect(bits(cpu, 'A4')).toBe('00110000');
  });

  it('sin la lista de bloques (fuente de texto), un CALL con parámetros se comprueba con la biblioteca', () => {
    const cp = compileProgramText(`      CALL  FC 82\n        S_BIT := M 0.0\n        N     := 8`);
    expect(cp.blocks.get('OB1')!.instrs[0].params!.map((x) => x.name)).toEqual(['S_BIT', 'N']);
    expect(() => compileProgramText(`      CALL  FC 82\n        S_BIT := M 0.0`)).toThrow(/falta el parámetro N/);
    // y un CALL de siempre no cambia
    expect(compileProgramText('      CALL  FC 1').blocks.get('OB1')!.instrs[0].params).toBeUndefined();
  });
});

describe('FC 82 y FC 83: errores de compilación', () => {
  const con = (cuerpo: string, extra: Record<string, string> = {}) => errores(prog({ OB1: cuerpo, ...extra }));
  it('faltan, sobran o se repiten parámetros', () => {
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0')).toEqual(['CALL FC 82: falta el parámetro N']);
    expect(con('      CALL  FC 82')).toEqual(['CALL FC 82: faltan los parámetros S_BIT y N']);
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0\n        N := 2\n        X := 1')[0]).toMatch(/no tiene el parámetro X/);
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0\n        N := 2\n        N := 3')).toEqual(['el parámetro N está repetido']);
    expect(con('      CALL  FC 82\n        S_BIT :=\n        N := 2')).toEqual(['falta el valor del parámetro S_BIT']);
  });
  it('tipos: S_BIT es la dirección de un bit y N un INT', () => {
    expect(con('      CALL  FC 82\n        S_BIT := MW 10\n        N := 2')[0]).toMatch(/S_BIT es un puntero/);
    expect(con('      CALL  FC 82\n        S_BIT := M [MD 10]\n        N := 2')[0]).toMatch(/S_BIT es un puntero/);
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0\n        N := M 1.0')[0]).toMatch(/N es un INT/);
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0\n        N := L#100000')[0]).toMatch(/N es un INT/);
    expect(con('      CALL  FC 82\n        S_BIT := M 0.0\n        N := PAW 256')[0]).toMatch(/N es un INT/);
    expect(con('      CALL  FC 82\n        S_BIT := DB1.DBX 2.3\n        N := DB1.DBW 0')).toEqual([]);
  });
  it('UC y CC no llaman a un bloque con parámetros; un FC del alumno no tiene parámetros', () => {
    expect(con('      UC    FC 82')[0]).toMatch(/UC no puede llamar a FC 82/);
    expect(con('      U E 0.0\n      CC    FC 82')[0]).toMatch(/CC no puede llamar a FC 82/);
    expect(con('      CALL  FC 1\n        N := 2', { FC1: 'NOP 0' })[0]).toMatch(/FC 1 no tiene parámetros/);
    // con un FC 82 del alumno (no de la biblioteca), tampoco
    expect(errores(programFromAwl({ OB1: '      CALL  FC 82\n        S_BIT := M 0.0\n        N := 2', FC82: 'NOP 0' }))[0]).toMatch(/FC 82 no tiene parámetros/);
  });
  it('un parámetro suelto, con meta o en otro segmento', () => {
    expect(con('      N := 5')[0]).toMatch(/va justo debajo de su CALL/);
    expect(con('      CALL  FC 82\nx1:   S_BIT := M 0.0\n        N := 2')).toContain('un parámetro de CALL no lleva meta');
    // segmento siguiente (línea en blanco + segmento nuevo en programFromAwl): el parámetro ya no es de ese CALL
    const p = prog({ OB1: '      CALL  FC 82\n        S_BIT := M 0.0\n        N := 2\n// otro segmento\n        N := 3' });
    expect(errores(p).some((m) => /va justo debajo de su CALL/.test(m))).toBe(true);
  });
  it('los parámetros de un CALL con error no dan más errores', () => {
    expect(con('      CALL  FB 1\n        N := 5')).toHaveLength(1);
  });
});

describe('FC 82 y FC 83: avisos, uso de operandos y fuentes', () => {
  it('B05: el rango incluye la marca de ciclo', () => {
    let p = prog({ OB1: '      CALL  FC 82\n        S_BIT := M 0.0\n        N     := 16' });
    p = { ...p, hw: { estaciones: [{ ...nuevaEstacion(1), marcaCiclo: { activa: true, byte: 1 } }] } };
    const avisos = lintProgram(p, compileProgram(p)).map((w) => w.msg);
    expect(avisos.find((m) => m.startsWith('B05'))).toMatch(/de M 0\.0 a M 1\.7.*MB 1/);
  });
  it('las salidas y las marcas del rango cuentan como usadas', () => {
    const u = analyzeUsage(compileProgramStrict(prog({ OB1: '      CALL  FC 82\n        S_BIT := A 124.0\n        N     := 5' })));
    expect(outputBits(u)).toEqual(['A124.0', 'A124.1', 'A124.2', 'A124.3', 'A124.4']);
  });
  it('traduce las líneas de parámetros (también con P#)', () => {
    const de = '      CALL  FC 82\n        S_BIT := P#A 124.0   // primer bit\n        N     := MW 10';
    const en = translateAwl(de, 'en');
    expect(en).toBe('      CALL  FC 82\n        S_BIT := P#Q 124.0   // primer bit\n        N     := MW 10');
    expect(translateAwl(en, 'de')).toBe(de);
  });
  it('la fuente AWL guarda el bloque de biblioteca y lo vuelve a crear al importarla', () => {
    const p = prog({ OB1: '      CALL  FC 83\n        S_BIT := M 0.0\n        N     := 2' }, ['SSET']);
    const src = exportAwlSource(p);
    expect(src).toContain('FAMILY : BIBLIOTECA');
    const q = importAwlSource(src);
    expect(q.bloques.find((b) => b.nombre === 'FC83')).toEqual({ nombre: 'FC83', segmentos: [], biblioteca: 'SSET' });
    expect(errores(q)).toEqual([]);
  });
  it('copiar al proyecto: sustituye un FC del alumno con el mismo número', () => {
    const p = programFromAwl({ OB1: 'NOP 0', FC82: 'NOP 0' });
    expect(libEnProyecto(p, 'RSET')).toBe('otro');
    const q = addLibBlock(p, 'RSET');
    expect(libEnProyecto(q, 'RSET')).toBe('igual');
    expect(q.bloques.map((b) => b.nombre)).toEqual(['OB1', 'FC82']);
  });
  it('«Probar» un ejemplo: añade los bloques de biblioteca que usa', () => {
    const p = programFromAwl('      CALL  FC 82\n        S_BIT := M 0.0\n        N     := 8\n      CALL  FC 1');
    expect(conBibliotecaUsada(p).bloques.map((b) => [b.nombre, b.biblioteca])).toEqual([['OB1', undefined], ['FC82', 'RSET']]);
  });
});

describe('hardware guardado y cargado', () => {
  it('la CPU usa el cargado; el guardado espera a «Cargar en módulo»', () => {
    const cpu = { ...nuevaEstacion(1), marcaCiclo: { activa: true, byte: 100 } };
    const p: Programa = { ...programFromAwl('NOP 0'), hw: { estaciones: [cpu] } };
    expect(clockByteGuardado(p)).toBe(100);
    expect(clockByteOf(p)).toBeNull();
    expect(hwSinCargar(p)).toBe(true);
    const cargado = { ...p, hwCargado: structuredClone(p.hw) };
    expect(clockByteOf(cargado)).toBe(100);
    expect(hwSinCargar(cargado)).toBe(false);
  });
  it('los proyectos de antes dan su hardware por cargado', () => {
    const p: Programa = { ...programFromAwl('NOP 0'), hw: { estaciones: [{ ...nuevaEstacion(1), marcaCiclo: { activa: true, byte: 0 } }] } };
    expect(clockByteOf(migrarHwCargado(p))).toBe(0);
    expect(migrarHwCargado(programFromAwl('NOP 0')).hwCargado).toBeUndefined();
  });
});

describe('KOP: cuadro FC 82 / FC 83', () => {
  const kopProg = (s: SegmentoKOP, libs: ('RSET' | 'SSET')[] = ['RSET']): Programa => {
    let p: Programa = { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'KOP', kop: segs('k', [s])[0] }] }] };
    for (const l of libs) p = addLibBlock(p, l);
    return p;
  };
  it('se compila a CALL FC 82 con sus parámetros y ENO = BIE', () => {
    const s = seg({ entrada: na('E 0.0'), salidas: [box('FC82', { S_BIT: 'M 10.0', N: '4' }, [bob('A 4.0')])] });
    expect(kopToAwlText(segs('k', [s])[0]).split('\n').map((l) => l.trim())).toEqual([
      'U     E 0.0', 'SPBNB _001', 'CALL  FC 82', 'S_BIT := M 10.0', 'N     := 4', '_001: U     BIE', '=     A 4.0',
    ]);
    const p = kopProg(s);
    expect(errores(p)).toEqual([]);
    const cpu = new CPU(compileProgramStrict(p));
    testWrite(cpu, 'MB10', 0xFF);
    cpu.scan();
    expect(bits(cpu, 'M10')).toBe('11111111'); // EN = 0: no se llama
    expect(testRead(cpu, 'A4.0')).toBe(0); // ENO = 0
    testWrite(cpu, 'E0.0', 1);
    cpu.scan();
    expect(bits(cpu, 'M10')).toBe('00001111');
    expect(testRead(cpu, 'A4.0')).toBe(1); // ENO = 1
  });
  it('valida los pines: S_BIT es un bit (con o sin P#) y N un INT', () => {
    const v = (pins: Record<string, string>) => validateSegment(segs('k', [seg({ salidas: [box('FC83', pins)] })])[0]).map((i) => i.msg);
    expect(v({ S_BIT: 'P#M 0.0', N: '8' })).toEqual([]);
    expect(v({ S_BIT: 'MW 0', N: '8' })[0]).toMatch(/S_BIT es un puntero/);
    expect(v({ S_BIT: 'M 0.0', N: 'M 1.0' })[0]).toMatch(/N es un INT/);
    expect(v({ N: '8' })).toHaveLength(1);
  });
  it('sabe qué bloques de biblioteca llama un segmento', () => {
    expect(libsDeSegmento(segs('k', [seg({ salidas: [box('FC82', {}), box('FC83', {})] })])[0])).toEqual(['RSET', 'SSET']);
  });
});
