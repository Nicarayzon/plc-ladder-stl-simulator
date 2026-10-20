#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
interprete_referencia.py — Intérprete AWL de referencia ("modelo de oro") para la app de práctica.

Modela una CPU de 2 acumuladores que ejecuta AWL con nemotécnica alemana:
ciclo de scan, imagen de proceso, palabra de estado, pila de paréntesis, temporizadores y
contadores, aritmética con desbordamiento, conversiones, saltos, MCR y llamadas a FC sin
parámetros.

Para qué sirve (desde app/):
  1. Verificar los ejemplos:        python3 tools/interprete_referencia.py test src/content/ejemplos_KOP_AWL.md
  2. Exportar el banco a JSON:      python3 tools/interprete_referencia.py export src/content/ejemplos_KOP_AWL.md src/content/banco_ejercicios.json
  3. Ver la traza de un programa:   python3 tools/interprete_referencia.py traza programa.awl E0.0=1 MW30=10
  4. Pruebas internas:              python3 tools/interprete_referencia.py selftest
  5. Especificación ejecutable: la app debe producir EXACTAMENTE los mismos resultados
     (pruebas diferenciales con tools/ref_runner.py).

Requisitos: Python 3.9+ y PyYAML (pip install pyyaml), que solo se usa para leer los bloques yaml.
"""

import datetime
import json
import math
import re
import struct
import sys

# ═══════════════════════════════════════════════════════════════════════════
# Utilidades numéricas
# ═══════════════════════════════════════════════════════════════════════════


def u16(x):
    return x & 0xFFFF


def u32(x):
    return x & 0xFFFFFFFF


def s16(x):
    x &= 0xFFFF
    return x - 0x10000 if x & 0x8000 else x


def s32(x):
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x & 0x80000000 else x


def f32_bits(f):
    """float de Python → patrón IEEE 754 de 32 bits (desborda a ±inf)."""
    try:
        return struct.unpack('>I', struct.pack('>f', f))[0]
    except OverflowError:
        return struct.unpack('>I', struct.pack('>f', math.copysign(math.inf, f)))[0]


def bits_f32(u):
    return struct.unpack('>f', struct.pack('>I', u & 0xFFFFFFFF))[0]


def to_f32(f):
    return bits_f32(f32_bits(f))


class PLCError(Exception):
    """Error en tiempo de ejecución. Como el OB de error no está cargado, la CPU pasa a STOP."""

    def __init__(self, msg, ob=121):
        super().__init__(msg)
        self.ob = ob


class CompileError(Exception):
    """Error de sintaxis o de compilación: el programa no se puede cargar."""


def bcd_decode(value, ndigits):
    v = 0
    for i in range(ndigits - 1, -1, -1):
        d = (value >> (4 * i)) & 0xF
        if d > 9:
            raise PLCError(f'Error de conversión BCD: la cifra {d:X} no es válida (valor 16#{value:X})')
        v = v * 10 + d
    return v


def bcd_encode(v, ndigits):
    r = 0
    for i in range(ndigits):
        r |= (v % 10) << (4 * i)
        v //= 10
    return r


S5_BASES_MS = (10, 100, 1000, 10000)


def s5time_from_ms(ms):
    """Elige la base más fina en la que el valor cabe en 3 cifras BCD."""
    if ms < 0:
        raise CompileError('S5TIME no admite valores negativos')
    for i, b in enumerate(S5_BASES_MS):
        v = ms // b
        if v <= 999:
            return (i << 12) | bcd_encode(v, 3)
    raise CompileError(f'S5TIME fuera de rango (máximo 2H46M30S): {ms} ms')


def s5time_decode(w):
    base = (w >> 12) & 0x3
    try:
        val = bcd_decode(w & 0x0FFF, 3)
    except PLCError:
        raise PLCError(f'Valor de tiempo no válido: 16#{w & 0xFFFF:04X} no es un S5TIME (¿falta S5T#?)')
    return base, val


# ═══════════════════════════════════════════════════════════════════════════
# Constantes
# ═══════════════════════════════════════════════════════════════════════════

_DUR_UNITS = {'D': 86400000, 'H': 3600000, 'M': 60000, 'S': 1000, 'MS': 1}
_REAL_RE = re.compile(r'^[+-]?(\d+\.\d*([eE][+-]?\d+)?|\d+[eE][+-]?\d+)$')
_INT_RE = re.compile(r'^[+-]?\d+$')
_PTR_AREAS = {'P': 0x80, 'E': 0x81, 'A': 0x82, 'M': 0x83, 'DBX': 0x84, 'DIX': 0x85, 'L': 0x86, 'V': 0x87}


def parse_duration_ms(text):
    t = text.upper().replace('_', '')
    neg = t.startswith('-')
    if neg:
        t = t[1:]
    total, pos = 0.0, 0
    for m in re.finditer(r'(\d+(?:\.\d+)?)(MS|D|H|M|S)', t):
        if m.start() != pos:
            raise ValueError(text)
        total += float(m.group(1)) * _DUR_UNITS[m.group(2)]
        pos = m.end()
    if pos == 0 or pos != len(t):
        raise ValueError(text)
    ms = int(round(total))
    return -ms if neg else ms


def parse_constant(tok):
    """Devuelve (valor_u32, tipo) o None si `tok` no es una constante."""
    t = tok.strip()
    T = t.upper()
    try:
        if T.startswith('S5T#') or T.startswith('S5TIME#'):
            return s5time_from_ms(parse_duration_ms(T.split('#', 1)[1])), 'S5TIME'
        if T.startswith('TIME_OF_DAY#') or T.startswith('TOD#'):
            hh, mm, ss = T.split('#', 1)[1].split(':')
            ms = (int(hh) * 3600 + int(mm) * 60) * 1000 + int(round(float(ss) * 1000))
            return u32(ms), 'TOD'
        if T.startswith('TIME#') or T.startswith('T#'):
            return u32(parse_duration_ms(T.split('#', 1)[1])), 'TIME'
        if T.startswith('DATE#') or T.startswith('D#'):
            y, mo, d = map(int, T.split('#', 1)[1].split('-'))
            return (datetime.date(y, mo, d) - datetime.date(1990, 1, 1)).days, 'DATE'
        if T.startswith('L#'):
            v = int(T[2:])
            if not -2**31 <= v < 2**31:
                raise ValueError
            return u32(v), 'DINT'
        if T.startswith('DW#16#'):
            v = int(T[6:].replace('_', ''), 16)
            if v > 0xFFFFFFFF:
                raise ValueError
            return v, 'DWORD'
        if T.startswith('W#16#'):
            v = int(T[5:].replace('_', ''), 16)
            if v > 0xFFFF:
                raise ValueError
            return v, 'WORD'
        if T.startswith('B#16#'):
            v = int(T[5:].replace('_', ''), 16)
            if v > 0xFF:
                raise ValueError
            return v, 'BYTE'
        if T.startswith('16#'):
            v = int(T[3:].replace('_', ''), 16)
            return (v, 'WORD') if v <= 0xFFFF else (u32(v), 'DWORD')
        if T.startswith('2#'):
            bits = T[2:].replace('_', '')
            v = int(bits, 2)
            return (v, 'WORD') if len(bits) <= 16 else (u32(v), 'DWORD')
        if T.startswith('C#'):
            v = int(T[2:])
            if not 0 <= v <= 999:
                raise ValueError
            return bcd_encode(v, 3), 'BCD'
        if T.startswith('B#('):
            parts = [int(p) for p in T[3:-1].split(',')]
            if len(parts) not in (2, 4) or any(not 0 <= p <= 255 for p in parts):
                raise ValueError
            v = 0
            for p in parts:
                v = (v << 8) | p
            return v, ('WORD' if len(parts) == 2 else 'DWORD')
        if T.startswith('P#'):
            body = T[2:].replace(' ', '')
            if body.startswith('DB') and '.' in body and 'DBX' in body:
                raise CompileError('Los punteros ANY (P#DBn.DBX… BYTE n) no están soportados en el simulador')
            m = re.fullmatch(r'(DBX|DIX|[PEAMLV])?(\d+)\.([0-7])', body)
            if not m:
                raise ValueError
            off = int(m.group(2)) * 8 + int(m.group(3))
            if m.group(1):
                return u32((_PTR_AREAS[m.group(1)] << 24) | off), 'PTR'
            return off, 'PTR'
        if len(t) >= 3 and t[0] == "'" and t[-1] == "'":
            chars = t[1:-1]
            if not 1 <= len(chars) <= 4:
                raise ValueError
            v = 0
            for ch in chars:
                v = (v << 8) | (ord(ch) & 0xFF)
            return v, 'CHAR'
        if _REAL_RE.match(t):
            return f32_bits(float(t)), 'REAL'
        if _INT_RE.match(t):
            v = int(t)
            if -32768 <= v <= 32767:
                return u16(v), 'INT'
            if -2**31 <= v < 2**31:
                return u32(v), 'DINT'
            raise ValueError
    except (ValueError, IndexError):
        raise CompileError(f'Constante no válida: {tok}')
    return None


# ═══════════════════════════════════════════════════════════════════════════
# Operandos
# ═══════════════════════════════════════════════════════════════════════════

MEM_PREFIX = {
    'EB': ('E', 1), 'EW': ('E', 2), 'ED': ('E', 4),
    'AB': ('A', 1), 'AW': ('A', 2), 'AD': ('A', 4),
    'MB': ('M', 1), 'MW': ('M', 2), 'MD': ('M', 4),
    'LB': ('L', 1), 'LW': ('L', 2), 'LD': ('L', 4),
    'PEB': ('PE', 1), 'PEW': ('PE', 2), 'PED': ('PE', 4),
    'PAB': ('PA', 1), 'PAW': ('PA', 2), 'PAD': ('PA', 4),
    'DBB': ('DB', 1), 'DBW': ('DB', 2), 'DBD': ('DB', 4),
    'DIB': ('DI', 1), 'DIW': ('DI', 2), 'DID': ('DI', 4),
}
BIT_AREAS = {'E': 'E', 'A': 'A', 'M': 'M', 'L': 'L', 'DBX': 'DB', 'DIX': 'DI'}
STATUS_OPS = {'OV', 'OS', 'BIE', '==0', '<>0', '>0', '<0', '>=0', '<=0', 'UO'}
_MEMP = '|'.join(sorted(MEM_PREFIX, key=len, reverse=True))


class Op:
    __slots__ = ('kind', 'area', 'size', 'byte', 'bit', 'db', 'n', 'value', 'ctype', 'name', 'ind', 'text')

    def __init__(self, kind, **kw):
        self.kind = kind
        for k in self.__slots__[1:]:
            setattr(self, k, kw.get(k))

    def __repr__(self):
        return f'Op({self.kind}:{self.text})'


def _translate_en_operand(s):
    S = s.strip()
    rules = [(r'^PIB', 'PEB'), (r'^PIW', 'PEW'), (r'^PID', 'PED'),
             (r'^PQB', 'PAB'), (r'^PQW', 'PAW'), (r'^PQD', 'PAD'),
             (r'^IB', 'EB'), (r'^IW', 'EW'), (r'^ID', 'ED'),
             (r'^QB', 'AB'), (r'^QW', 'AW'), (r'^QD', 'AD'),
             (r'^I(?=\s*[\d\[])', 'E'), (r'^Q(?=\s*[\d\[])', 'A'),
             (r'^C(?=\s*\d+$)', 'Z'), (r'^BR$', 'BIE')]
    for pat, rep in rules:
        if re.match(pat, S, re.I):
            return re.sub(pat, rep, S, count=1, flags=re.I)
    return S


def parse_operand(text, symbols=None, lang='de'):
    s = text.strip()
    if not s:
        return None
    if s.startswith('"'):
        name = s.strip('"')
        if not symbols or name not in symbols:
            raise CompileError(f'Símbolo no definido: "{name}"')
        s = symbols[name]
    if s.startswith('#'):
        raise CompileError(f'Variable local {s}: el intérprete de referencia no admite interfaces de bloque')
    if lang == 'en':
        s = _translate_en_operand(s)
    S = re.sub(r'\s+', ' ', s.upper()).strip()
    c = parse_constant(s)
    if c is not None:
        return Op('const', value=c[0], ctype=c[1], text=S)
    if S in STATUS_OPS:
        return Op('status', name=S, text=S)
    if S == 'STW':
        return Op('stw', text=S)
    if S in ('DBNO', 'DBLG', 'DINO', 'DILG'):
        return Op('dbreg', name=S, text=S)
    if S in ('AR1', 'AR2'):
        return Op('ar', n=int(S[2]), text=S)
    m = re.fullmatch(r'(T|Z) ?(\d+)', S)
    if m:
        n = int(m.group(2))
        if n > 255:
            raise CompileError(f'{S}: solo existen T0..T255 / Z0..Z255')
        return Op('timer' if m.group(1) == 'T' else 'counter', n=n, text=S)
    m = re.fullmatch(r'(FC|FB|SFC|SFB|DB|DI) ?(\d+)', S)
    if m:
        return Op('block', name=m.group(1), n=int(m.group(2)), text=S)
    # Direccionamiento indirecto: MW [MD 30]  ·  E [MD 2]  ·  MW [AR1, P#2.0]
    m = re.fullmatch(r'(DBX|DIX|E|A|M|L|' + _MEMP + r') ?\[(.+)\]', S)
    if m:
        area_tok, inner = m.group(1), m.group(2).strip()
        mi = re.fullmatch(r'(AR1|AR2) ?, ?(P#.+)', inner)
        if mi:
            off = parse_constant(mi.group(2))[0]
            ind = ('ar', int(mi.group(1)[2]), off)
        else:
            iop = parse_operand(inner)
            if iop is None or iop.kind != 'mem' or iop.size != 4 or iop.area not in ('M', 'L', 'DB', 'DI'):
                raise CompileError(f'Puntero indirecto no válido: [{inner}] (usa MD, LD, DBD o DID)')
            ind = ('mem', iop)
        if area_tok in BIT_AREAS:
            return Op('bit', area=BIT_AREAS[area_tok], ind=ind, text=S)
        area, size = MEM_PREFIX[area_tok]
        return Op('mem', area=area, size=size, ind=ind, text=S)
    # Dirección completa de DB: DB1.DBX 2.0 · DB1.DBW 0
    m = re.fullmatch(r'DB ?(\d+)\.(DBX|DBB|DBW|DBD) ?(\d+)(?:\.([0-7]))?', S)
    if m:
        db = int(m.group(1))
        if m.group(2) == 'DBX':
            if m.group(4) is None:
                raise CompileError(f'{S}: falta el número de bit')
            return Op('bit', area='DB', db=db, byte=int(m.group(3)), bit=int(m.group(4)), text=S)
        if m.group(4) is not None:
            raise CompileError(f'{S}: un byte/palabra no lleva número de bit')
        area, size = MEM_PREFIX[m.group(2)]
        return Op('mem', area=area, size=size, db=db, byte=int(m.group(3)), text=S)
    m = re.fullmatch(r'(DBX|DIX|E|A|M|L) ?(\d+)\.(\d+)', S)
    if m:
        bit = int(m.group(3))
        if bit > 7:
            raise CompileError(f'{S}: el número de bit va de 0 a 7')
        return Op('bit', area=BIT_AREAS[m.group(1)], byte=int(m.group(2)), bit=bit, text=S)
    m = re.fullmatch(r'(' + _MEMP + r') ?(\d+)', S)
    if m:
        area, size = MEM_PREFIX[m.group(1)]
        return Op('mem', area=area, size=size, byte=int(m.group(2)), text=S)
    raise CompileError(f'Operando no válido: {text.strip()}')


# ═══════════════════════════════════════════════════════════════════════════
# Compilador (texto AWL → lista de instrucciones)
# ═══════════════════════════════════════════════════════════════════════════

BITLOGIC = {'U', 'UN', 'O', 'ON', 'X', 'XN'}
NEST_OPEN = {'U(', 'UN(', 'O(', 'ON(', 'X(', 'XN('}
CMP = {r + t for r in ('==', '<>', '>', '<', '>=', '<=') for t in 'IDR'}
ARITH = {'+I', '-I', '*I', '/I', '+D', '-D', '*D', '/D', 'MOD', '+R', '-R', '*R', '/R'}
FLOATFN = {'ABS', 'SQR', 'SQRT', 'EXP', 'LN', 'SIN', 'COS', 'TAN', 'ASIN', 'ACOS', 'ATAN'}
CONV = {'BTI', 'ITB', 'BTD', 'DTB', 'ITD', 'DTR', 'RND', 'TRUNC', 'RND+', 'RND-',
        'INVI', 'INVD', 'NEGI', 'NEGD', 'NEGR', 'CAW', 'CAD'}
WORDLOG = {'UW', 'OW', 'XOW', 'UD', 'OD', 'XOD'}
SHIFTS = {'SLW', 'SRW', 'SSI', 'SLD', 'SRD', 'SSD', 'RLD', 'RRD'}
TSTART = {'SI', 'SV', 'SE', 'SS', 'SA'}
JUMPS = {'SPA', 'SPB', 'SPBN', 'SPBB', 'SPBNB', 'SPBI', 'SPBIN', 'SPO', 'SPS', 'SPZ', 'SPN',
         'SPP', 'SPM', 'SPPZ', 'SPMZ', 'SPU', 'SPL', 'LOOP'}
NO_OPERAND = ({'NOT', 'SET', 'CLR', 'SAVE', 'TAK', 'PUSH', 'POP', 'RLDA', 'RRDA', 'BE', 'BEA', 'BEB',
               'MCRA', 'MCRD', 'MCR(', ')MCR', ')'} | NEST_OPEN | CMP | ARITH | FLOATFN | CONV)
OTHERS = {'=', 'S', 'R', 'FP', 'FN', 'FR', 'ZV', 'ZR', 'L', 'LC', 'T', 'LAR1', 'LAR2', 'TAR1', 'TAR2',
          '+AR1', '+AR2', 'INC', 'DEC', '+', 'AUF', 'UC', 'CC', 'CALL', 'NOP', 'BLD', 'ENT', 'LEAVE'}
MNEMONICS = BITLOGIC | NO_OPERAND | WORDLOG | SHIFTS | TSTART | JUMPS | OTHERS

EN2DE = {
    'A': 'U', 'AN': 'UN', 'A(': 'U(', 'AN(': 'UN(',
    'SP': 'SI', 'SE': 'SV', 'SD': 'SE', 'SF': 'SA', 'CU': 'ZV', 'CD': 'ZR',
    'JU': 'SPA', 'JC': 'SPB', 'JCN': 'SPBN', 'JCB': 'SPBB', 'JNB': 'SPBNB', 'JBI': 'SPBI', 'JNBI': 'SPBIN',
    'JO': 'SPO', 'JOS': 'SPS', 'JZ': 'SPZ', 'JN': 'SPN', 'JP': 'SPP', 'JM': 'SPM', 'JPZ': 'SPPZ',
    'JMZ': 'SPMZ', 'JUO': 'SPU', 'JL': 'SPL',
    'BEC': 'BEB', 'BEU': 'BEA', 'OPN': 'AUF', 'AW': 'UW', 'AD': 'UD',
}

_LABEL_RE = re.compile(r'^([A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*(.*)$')
_LABEL_NAME = re.compile(r'^[A-Za-z_][A-Za-z0-9_]{0,3}$')


class Instr:
    __slots__ = ('mn', 'op', 'line', 'src', 'target', 'spl_count')

    def __init__(self, mn, op, line, src):
        self.mn, self.op, self.line, self.src = mn, op, line, src
        self.target = None
        self.spl_count = 0


class Block:
    def __init__(self, instrs, labels):
        self.instrs, self.labels = instrs, labels


def _strip_comment(line):
    out, q = [], None
    i = 0
    while i < len(line):
        ch = line[i]
        if q:
            if ch == q:
                q = None
        elif ch in '"\'':
            q = ch
        elif line.startswith('//', i):
            break
        out.append(ch)
        i += 1
    return ''.join(out)


def _split_mnemonic(line):
    parts = line.split(None, 1)
    mn = parts[0].upper()
    rest = parts[1].strip() if len(parts) > 1 else ''
    if mn in ('U', 'UN', 'O', 'ON', 'X', 'XN', 'A', 'AN', 'MCR') and rest.startswith('('):
        mn += '('
        rest = rest[1:].strip()
    if mn == ')' and rest.upper().startswith('MCR'):
        mn, rest = ')MCR', rest[3:].strip()
    return mn, rest


def compile_block(text, symbols=None, lang='de'):
    instrs, labels, pending = [], {}, []
    depth = 0

    def err(lineno, msg):
        raise CompileError(f'Línea {lineno}: {msg}')

    for lineno, raw in enumerate(text.splitlines(), 1):
        line = _strip_comment(raw).strip().rstrip(';').strip()
        if not line:
            continue
        up = line.upper()
        if up.startswith(('NETWORK', 'SEGMENTO', 'TITLE', 'BEGIN', 'END_')):
            continue
        m = _LABEL_RE.match(line)
        if m:
            name = m.group(1).upper()
            if name in labels or name in pending:
                err(lineno, f'meta duplicada: {name}')
            pending.append(name)
            line = m.group(2).strip()
            if not line:
                continue
        mn, rest = _split_mnemonic(line)
        if lang == 'en':
            mn = EN2DE.get(mn, mn)
        if mn not in MNEMONICS:
            err(lineno, f'instrucción desconocida: {mn}')
        if mn in ('ENT', 'LEAVE'):
            err(lineno, f'{mn} solo existe en CPU con 4 acumuladores (el simulador tiene 2)')
        op = None
        if mn in JUMPS:
            if not _LABEL_NAME.match(rest):
                err(lineno, f'{mn} necesita una meta válida (máx. 4 caracteres, empieza por letra)')
            op = Op('label', name=rest.upper(), text=rest.upper())
        elif rest:
            try:
                op = parse_operand(rest, symbols, lang)
            except CompileError as e:
                err(lineno, str(e))
        k = op.kind if op else None

        def need(*kinds):
            if k not in kinds:
                err(lineno, f'operando no válido para {mn}: {rest or "(ninguno)"}')

        if mn in BITLOGIC:
            if op is None:
                if mn == 'O':
                    mn = 'O0'
                else:
                    err(lineno, f'{mn} necesita un operando')
            else:
                need('bit', 'timer', 'counter', 'status')
        elif mn in NO_OPERAND:
            if op is not None:
                err(lineno, f'{mn} no lleva operando')
        elif mn == '=':
            need('bit')
        elif mn == 'S':
            need('bit', 'counter')
        elif mn == 'R':
            need('bit', 'timer', 'counter')
        elif mn in ('FP', 'FN'):
            need('bit')
        elif mn in TSTART:
            need('timer')
        elif mn == 'FR':
            need('timer', 'counter')
        elif mn in ('ZV', 'ZR'):
            need('counter')
        elif mn == 'L':
            need('const', 'mem', 'timer', 'counter', 'stw', 'dbreg')
            if k == 'mem' and op.area == 'PA':
                err(lineno, 'la periferia de salidas (PA) no se puede leer')
        elif mn == 'LC':
            need('timer', 'counter')
        elif mn == 'T':
            need('mem', 'stw')
            if k == 'mem' and op.area == 'PE':
                err(lineno, 'la periferia de entradas (PE) no se puede escribir')
        elif mn in WORDLOG or mn in SHIFTS:
            if op is not None:
                need('const')
        elif mn in ('INC', 'DEC'):
            need('const')
            if op.value > 255:
                err(lineno, f'{mn}: la constante va de 0 a 255')
        elif mn == '+':
            need('const')
        elif mn in ('NOP', 'BLD'):
            need('const')
        elif mn in ('LAR1', 'LAR2'):
            if op is not None:
                need('const', 'mem', 'ar')
        elif mn in ('TAR1', 'TAR2'):
            if op is not None:
                need('mem', 'ar')
        elif mn in ('+AR1', '+AR2'):
            if op is not None:
                need('const')
        elif mn == 'AUF':
            need('block')
            if op.name not in ('DB', 'DI'):
                err(lineno, 'AUF solo abre DB o DI')
        elif mn in ('UC', 'CC', 'CALL'):
            need('block')
            if op.name not in ('FC', 'SFC'):
                err(lineno, 'el intérprete de referencia solo llama a FC sin parámetros')

        if mn in NEST_OPEN:
            depth += 1
        elif mn == ')':
            depth -= 1
            if depth < 0:
                err(lineno, "')' sin paréntesis abierto")
        ins = Instr(mn, op, lineno, raw.strip())
        for name in pending:
            labels[name] = len(instrs)
        pending = []
        instrs.append(ins)

    if pending:
        for name in pending:
            labels[name] = len(instrs)
        instrs.append(Instr('NOP', Op('const', value=0, ctype='INT', text='0'), 0, 'NOP 0'))
    if depth != 0:
        raise CompileError('Falta cerrar paréntesis: hay más "(" que ")"')
    for i, ins in enumerate(instrs):
        if ins.mn in JUMPS:
            name = ins.op.name
            if name not in labels:
                raise CompileError(f'Línea {ins.line}: la meta {name} no existe')
            ins.target = labels[name]
            if ins.mn == 'SPL':
                count = ins.target - (i + 1)
                if count < 0 or any(instrs[j].mn != 'SPA' for j in range(i + 1, ins.target)):
                    raise CompileError(f'Línea {ins.line}: SPL debe ir seguido de una lista de SPA y luego de su meta')
                ins.spl_count = count
    return Block(instrs, labels)


# ═══════════════════════════════════════════════════════════════════════════
# CPU
# ═══════════════════════════════════════════════════════════════════════════


class Timer:
    __slots__ = ('base', 'value', 'running', 'q', 'prev_s', 'prev_fr', 'acc_ms', 'mode')

    def __init__(self):
        self.base = self.value = self.acc_ms = 0
        self.running = False
        self.q = self.prev_s = self.prev_fr = 0
        self.mode = None


class Counter:
    __slots__ = ('value', 'prev_cu', 'prev_cd', 'prev_s', 'prev_fr')

    def __init__(self):
        self.value = self.prev_cu = self.prev_cd = self.prev_s = self.prev_fr = 0


class CPU:
    """CPU simulada (2 acumuladores). `blocks` es el texto AWL del OB1 o un dict {'OB1': ..., 'FC1': ...}."""

    PI_SIZE = 128        # imagen de proceso: bytes 0..127
    PERIPH_SIZE = 2048   # periferia: bytes 0..2047 (PEW256, PEW752...)
    L_SIZE = 256         # datos locales por bloque
    DB_SIZE = 1024       # los DB se crean automáticamente con este tamaño

    def __init__(self, blocks, cycle_ms=10, symbols=None, lang='de', m_size=2048, instr_limit=1_000_000):
        if isinstance(blocks, str):
            blocks = {'OB1': blocks}
        self.blocks = {re.sub(r'\s+', '', k.upper()): compile_block(v, symbols, lang) for k, v in blocks.items()}
        if 'OB1' not in self.blocks:
            raise CompileError('Falta el OB1')
        self.cycle_ms = cycle_ms
        self.periph_in = bytearray(self.PERIPH_SIZE)
        self.periph_out = bytearray(self.PERIPH_SIZE)
        self.PAE = bytearray(self.PI_SIZE)
        self.PAA = bytearray(self.PI_SIZE)
        self.M = bytearray(m_size)
        self.L = bytearray(self.L_SIZE)
        self.dbs = {}
        self.open_db = self.open_di = 0
        self.timers = [Timer() for _ in range(256)]
        self.counters = [Counter() for _ in range(256)]
        self.acc1 = self.acc2 = self.ar1 = self.ar2 = 0
        self.fc = self.rlo = self.sta = self.orb = self.os = self.ov = self.cc0 = self.cc1 = self.br = 0
        self.mcra = False
        self.mcr_stack = []
        self.state = 'RUN'
        self.stop_reason = None
        self.time_ms = 0
        self.cycles = 0
        self.tracing = False
        self.trace = []
        self.instr_limit = instr_limit
        self.icount = 0
        self._first = True

    # ───────────── ciclo ─────────────
    def scan(self):
        """Un ciclo: temporizadores → PAE → OB1 → PAA."""
        if self.state != 'RUN':
            return
        self._update_timers(self.cycle_ms)
        self.time_ms += self.cycle_ms
        self.cycles += 1
        self.PAE[:] = self.periph_in[:self.PI_SIZE]
        self.icount = 0
        if self.tracing:
            self.trace = []
        try:
            if self._first:
                self._first = False
                if 'OB100' in self.blocks:
                    self._run_block('OB100', is_ob=True)
            self._run_block('OB1', is_ob=True)
        except PLCError as e:
            self.state = 'STOP'
            self.stop_reason = f'{e} → OB{e.ob} no cargado → STOP'
            self.PAA[:] = bytes(self.PI_SIZE)
            self.periph_out[:] = bytes(self.PERIPH_SIZE)
            return
        self.periph_out[:self.PI_SIZE] = self.PAA

    def _update_timers(self, dt):
        for t in self.timers:
            if not t.running:
                continue
            t.acc_ms += dt
            b = S5_BASES_MS[t.base]
            while t.value > 0 and t.acc_ms >= b:
                t.value -= 1
                t.acc_ms -= b
            if t.value == 0:
                t.running = False
                t.acc_ms = 0
                t.q = 1 if t.mode in ('SE', 'SS') else 0

    def _run_block(self, name, is_ob=False, depth=0):
        blk = self.blocks.get(name)
        if blk is None:
            raise PLCError(f'Llamada a un bloque que no existe: {name}')
        if depth > 16:
            raise PLCError('Desbordamiento de la pila de bloques (demasiadas llamadas anidadas)', ob=121)
        saved_L = self.L
        self.L = bytearray(self.L_SIZE)
        if is_ob:
            # Simplificación documentada: al empezar cada OB la palabra de estado y los ACU valen 0.
            self.fc = self.rlo = self.sta = self.orb = self.os = self.ov = self.cc0 = self.cc1 = self.br = 0
            self.acc1 = self.acc2 = 0
            self.mcra = False
            self.mcr_stack = []
        else:
            self.fc = self.orb = self.os = 0
        nest = []
        code = blk.instrs
        pc = 0
        while pc < len(code):
            self.icount += 1
            if self.icount > self.instr_limit:
                raise PLCError('Tiempo de ciclo excedido (¿bucle infinito?)', ob=80)
            ins = code[pc]
            fc_before = self.fc
            nxt = self._exec(ins, nest, pc, depth)
            if self.tracing:
                self.trace.append({
                    'bloque': name, 'pc': pc, 'linea': ins.line, 'instr': ins.src,
                    'er_antes': fc_before, 'er': self.fc, 'rlo': self.rlo, 'sta': self.sta, 'or': self.orb,
                    'ov': self.ov, 'os': self.os, 'cc1': self.cc1, 'cc0': self.cc0, 'br': self.br,
                    'acu1': s32(self.acc1), 'acu2': s32(self.acc2),
                    'acu1_int': s16(self.acc1), 'acu2_int': s16(self.acc2),
                })
            if nxt == 'END':
                break
            pc = pc + 1 if nxt is None else nxt
        self.os = 0          # el fin de bloque borra OS
        self.fc = self.orb = 0
        self.L = saved_L

    # ───────────── memoria ─────────────
    def _db(self, n):
        if not n:
            raise PLCError('No hay ningún bloque de datos abierto (falta AUF DB n)')
        if n not in self.dbs:
            self.dbs[n] = bytearray(self.DB_SIZE)
        return self.dbs[n]

    def _buf(self, area, db):
        if area == 'E':
            return self.PAE
        if area == 'A':
            return self.PAA
        if area == 'M':
            return self.M
        if area == 'L':
            return self.L
        if area == 'PE':
            return self.periph_in
        if area == 'PA':
            return self.periph_out
        if area == 'DB':
            return self._db(db or self.open_db)
        if area == 'DI':
            return self._db(db or self.open_di)
        raise PLCError(f'Área desconocida: {area}')

    def _resolve(self, op):
        if op.ind is None:
            if op.area == 'DB' and op.db:
                self.open_db = op.db          # una dirección completa abre el DB
            return op.area, op.db, op.byte, op.bit
        if op.ind[0] == 'mem':
            ptr = self._rmem(op.ind[1])
        else:
            ar = self.ar1 if op.ind[1] == 1 else self.ar2
            ptr = (ar & 0x00FFFFFF) + op.ind[2]
        byte, bit = (ptr >> 3) & 0xFFFF, ptr & 7
        if op.kind == 'mem' and bit != 0:
            raise PLCError('Puntero no válido: para byte/palabra/doble palabra el bit debe ser 0')
        return op.area, op.db, byte, bit

    def _check(self, buf, byte, size, area):
        if byte < 0 or byte + size > len(buf):
            raise PLCError(f'Error de acceso al área {area}: la dirección {byte} está fuera de rango')

    def _rbit(self, op):
        area, db, byte, bit = self._resolve(op)
        buf = self._buf(area, db)
        self._check(buf, byte, 1, area)
        return (buf[byte] >> bit) & 1

    def _wbit(self, op, v):
        area, db, byte, bit = self._resolve(op)
        buf = self._buf(area, db)
        self._check(buf, byte, 1, area)
        if v:
            buf[byte] |= (1 << bit)
        else:
            buf[byte] &= ~(1 << bit) & 0xFF

    def _rmem(self, op):
        area, db, byte, _ = self._resolve(op)
        buf = self._buf(area, db)
        self._check(buf, byte, op.size, area)
        return int.from_bytes(buf[byte:byte + op.size], 'big')

    def _wmem(self, op, value):
        area, db, byte, _ = self._resolve(op)
        buf = self._buf(area, db)
        self._check(buf, byte, op.size, area)
        data = (value & ((1 << (8 * op.size)) - 1)).to_bytes(op.size, 'big')
        buf[byte:byte + op.size] = data
        if area == 'PA' and byte + op.size <= self.PI_SIZE:
            self.PAA[byte:byte + op.size] = data       # T PAW actualiza también la PAA

    def _timer(self, n):
        return self.timers[n]

    def _bitval(self, op):
        k = op.kind
        if k == 'bit':
            return self._rbit(op)
        if k == 'timer':
            return self.timers[op.n].q
        if k == 'counter':
            return 1 if self.counters[op.n].value > 0 else 0
        if k == 'status':
            return self._status_val(op.name)
        raise PLCError(f'Operando no booleano: {op.text}')

    def _status_val(self, name):
        c1, c0 = self.cc1, self.cc0
        return int({
            'OV': self.ov, 'OS': self.os, 'BIE': self.br,
            '==0': c1 == 0 and c0 == 0, '<>0': c1 != c0, '>0': c1 == 1 and c0 == 0,
            '<0': c1 == 0 and c0 == 1, '>=0': c0 == 0, '<=0': c1 == 0, 'UO': c1 == 1 and c0 == 1,
        }[name])

    def _stw(self):
        return (self.fc | self.rlo << 1 | self.sta << 2 | self.orb << 3 | self.os << 4 |
                self.ov << 5 | self.cc0 << 6 | self.cc1 << 7 | self.br << 8)

    def _set_stw(self, v):
        self.fc, self.rlo, self.sta, self.orb = v & 1, v >> 1 & 1, v >> 2 & 1, v >> 3 & 1
        self.os, self.ov, self.cc0, self.cc1, self.br = v >> 4 & 1, v >> 5 & 1, v >> 6 & 1, v >> 7 & 1, v >> 8 & 1

    def _load_val(self, op):
        k = op.kind
        if k == 'const':
            return op.value
        if k == 'mem':
            return self._rmem(op)
        if k == 'timer':
            return self.timers[op.n].value
        if k == 'counter':
            return self.counters[op.n].value
        if k == 'stw':
            return self._stw()
        if k == 'dbreg':
            n = self.open_db if op.name.startswith('DB') else self.open_di
            if op.name.endswith('NO'):
                return n
            return len(self.dbs[n]) if n in self.dbs else 0
        raise PLCError(f'No se puede cargar {op.text}')

    def _mcr_ok(self):
        return (not self.mcra) or all(self.mcr_stack)

    def _cc_from(self, v):
        self.cc1, self.cc0 = (0, 0) if v == 0 else ((0, 1) if v < 0 else (1, 0))

    # ───────────── lógica de bits ─────────────
    def _logic(self, base, neg, v):
        """U/UN/O/ON/X/XN. `v` es el valor real del operando."""
        x = v ^ 1 if neg else v
        if base == 'U':
            r = (self.rlo & x) if self.fc else x
            r |= self.orb                 # si un grupo O anterior ya dio 1, el resultado es 1
        elif base == 'O':
            r = ((self.rlo | x) if self.fc else x) | self.orb
            self.orb = 0
        else:
            r = ((self.rlo ^ x) if self.fc else x) | self.orb
            self.orb = 0
        self.rlo, self.fc, self.sta = r, 1, v

    def _end_chain(self):
        self.fc = 0
        self.orb = 0

    # ───────────── temporizadores ─────────────
    def _timer_start(self, n, mode):
        t = self.timers[n]
        rlo = self.rlo
        edge = rlo and not t.prev_s
        fall = (not rlo) and t.prev_s
        t.prev_s = rlo

        def load():
            t.base, t.value = s5time_decode(self.acc1 & 0xFFFF)
            t.acc_ms = 0
            t.running = True
            t.mode = mode

        if mode == 'SI':            # impulso
            if edge:
                load()
                t.q = 1
            elif not rlo:
                t.running = False
                t.q = 0
        elif mode == 'SV':          # impulso prolongado (se redispara)
            if edge:
                load()
                t.q = 1
        elif mode == 'SE':          # retardo a la conexión
            if edge:
                load()
                t.q = 0
            elif not rlo:
                t.running = False
                t.q = 0
        elif mode == 'SS':          # retardo a la conexión con memoria
            if edge:
                load()
                t.q = 0
        elif mode == 'SA':          # retardo a la desconexión
            if rlo:
                t.running = False
                t.q = 1
                t.mode = 'SA'
            elif fall:
                load()
                t.q = 1

    # ───────────── ejecución de una instrucción ─────────────
    def _exec(self, ins, nest, pc, depth):
        mn, op = ins.mn, ins.op

        # --- lógica de bits ---
        if mn in BITLOGIC:
            self._logic(mn[0], mn.endswith('N'), self._bitval(op))
            return None
        if mn == 'O0':
            if self.fc:
                self.orb = self.rlo
            self.fc, self.sta = 0, 1
            return None
        if mn in NEST_OPEN:
            if len(nest) >= 7:
                raise PLCError('Desbordamiento de la pila de anidamiento (máximo 7 niveles de paréntesis)')
            nest.append((mn[:-1], self.rlo, self.orb, self.fc))
            self.fc, self.orb, self.sta = 0, 0, 1
            return None
        if mn == ')':
            if not nest:
                raise PLCError("')' sin paréntesis abierto")
            kind, rlo, orb, fc = nest.pop()
            inner = self.rlo
            self.rlo, self.orb, self.fc = rlo, orb, fc
            self._logic(kind[0], kind.endswith('N'), inner)
            self.sta = 1
            return None
        if mn == '=':
            v = self.rlo if self._mcr_ok() else 0
            self._wbit(op, v)
            self._end_chain()
            self.sta = v
            return None
        if mn in ('S', 'R'):
            if op.kind == 'bit':
                if self.rlo and self._mcr_ok():
                    self._wbit(op, 1 if mn == 'S' else 0)
                self.sta = self._rbit(op)
            elif op.kind == 'timer':        # R T n
                if self.rlo:
                    t = self.timers[op.n]
                    t.running, t.value, t.base, t.q, t.acc_ms = False, 0, 0, 0, 0
                self.sta = self.rlo
            else:                           # S Z n / R Z n
                c = self.counters[op.n]
                if mn == 'S':
                    if self.rlo and not c.prev_s:
                        c.value = bcd_decode(self.acc1 & 0x0FFF, 3)
                    c.prev_s = self.rlo
                elif self.rlo:
                    c.value = 0
                self.sta = self.rlo
            self._end_chain()
            return None
        if mn == 'NOT':
            self.rlo ^= 1
            self.orb = 0
            self.sta = 1
            return None
        if mn == 'SET':
            self.rlo, self.sta = 1, 1
            self._end_chain()
            return None
        if mn == 'CLR':
            self.rlo, self.sta = 0, 0
            self._end_chain()
            return None
        if mn == 'SAVE':
            self.br = self.rlo
            return None
        if mn in ('FP', 'FN'):
            prev = self._rbit(op)
            cur = self.rlo
            self._wbit(op, cur)
            self.rlo = (cur & (prev ^ 1)) if mn == 'FP' else ((cur ^ 1) & prev)
            self.fc, self.orb, self.sta = 1, 0, cur
            return None

        # --- temporizadores y contadores ---
        if mn in TSTART:
            self._timer_start(op.n, mn)
            self.sta = self.rlo
            self._end_chain()
            return None
        if mn == 'FR':
            obj = self.timers[op.n] if op.kind == 'timer' else self.counters[op.n]
            if self.rlo and not obj.prev_fr:
                if op.kind == 'timer':
                    obj.prev_s = 0
                else:
                    obj.prev_cu = obj.prev_cd = obj.prev_s = 0
            obj.prev_fr = self.rlo
            self._end_chain()
            return None
        if mn in ('ZV', 'ZR'):
            c = self.counters[op.n]
            if mn == 'ZV':
                if self.rlo and not c.prev_cu and c.value < 999:
                    c.value += 1
                c.prev_cu = self.rlo
            else:
                if self.rlo and not c.prev_cd and c.value > 0:
                    c.value -= 1
                c.prev_cd = self.rlo
            self.sta = self.rlo
            self._end_chain()
            return None

        # --- carga y transferencia ---
        if mn == 'L':
            v = self._load_val(op)
            self.acc2, self.acc1 = self.acc1, u32(v)
            return None
        if mn == 'LC':
            if op.kind == 'timer':
                t = self.timers[op.n]
                v = (t.base << 12) | bcd_encode(t.value, 3)
            else:
                v = bcd_encode(self.counters[op.n].value, 3)
            self.acc2, self.acc1 = self.acc1, v
            return None
        if mn == 'T':
            if op.kind == 'stw':
                self._set_stw(self.acc1)
            else:
                self._wmem(op, self.acc1 if self._mcr_ok() else 0)
            return None
        if mn in ('LAR1', 'LAR2'):
            if op is None:
                v = self.acc1
            elif op.kind == 'ar':
                v = self.ar2 if op.n == 2 else self.ar1
            else:
                v = self._load_val(op)
            if mn == 'LAR1':
                self.ar1 = u32(v)
            else:
                self.ar2 = u32(v)
            return None
        if mn in ('TAR1', 'TAR2'):
            v = self.ar1 if mn == 'TAR1' else self.ar2
            if op is None:
                self.acc2, self.acc1 = self.acc1, v
            elif op.kind == 'ar':
                self.ar2 = v
            else:
                self._wmem(op, v)
            return None
        if mn in ('+AR1', '+AR2'):
            add = op.value if op is not None else s16(self.acc1)
            if mn == '+AR1':
                self.ar1 = u32(self.ar1 + add)
            else:
                self.ar2 = u32(self.ar2 + add)
            return None

        # --- acumuladores ---
        if mn == 'TAK':
            self.acc1, self.acc2 = self.acc2, self.acc1
            return None
        if mn == 'PUSH':
            self.acc2 = self.acc1
            return None
        if mn == 'POP':
            self.acc1 = self.acc2
            return None
        if mn in ('INC', 'DEC'):
            ll = self.acc1 & 0xFF
            ll = (ll + op.value) & 0xFF if mn == 'INC' else (ll - op.value) & 0xFF
            self.acc1 = (self.acc1 & 0xFFFFFF00) | ll
            return None
        if mn == '+':
            if op.ctype == 'INT':
                low = u16(s16(self.acc1) + s16(op.value))
                self.acc1 = (self.acc1 & 0xFFFF0000) | low
            else:
                self.acc1 = u32(self.acc1 + s32(op.value))
            return None

        # --- aritmética ---
        if mn in ('+I', '-I'):
            a, b = s16(self.acc2), s16(self.acc1)
            r = a + b if mn == '+I' else a - b
            w = s16(r)
            self.acc1 = (self.acc1 & 0xFFFF0000) | u16(w)
            self._cc_from(w)
            self.ov = int(r != w)
            self.os |= self.ov
            return None
        if mn == '*I':
            a, b = s16(self.acc2), s16(self.acc1)
            r = a * b
            self.acc1 = u32(r)
            self._cc_from(r)
            self.ov = int(not -32768 <= r <= 32767)
            self.os |= self.ov
            return None
        if mn == '/I':
            a, b = s16(self.acc2), s16(self.acc1)
            if b == 0:
                self.cc1 = self.cc0 = 1
                self.ov = self.os = 1
                return None
            q = abs(a) // abs(b) * (1 if (a >= 0) == (b > 0) else -1)
            rem = a - q * b
            w = s16(q)
            self.acc1 = (u16(rem) << 16) | u16(w)
            self._cc_from(w)
            self.ov = int(q != w)
            self.os |= self.ov
            return None
        if mn in ('+D', '-D', '*D'):
            a, b = s32(self.acc2), s32(self.acc1)
            r = a + b if mn == '+D' else (a - b if mn == '-D' else a * b)
            w = s32(r)
            self.acc1 = u32(w)
            self._cc_from(r if mn == '*D' else w)
            self.ov = int(r != w)
            self.os |= self.ov
            return None
        if mn in ('/D', 'MOD'):
            a, b = s32(self.acc2), s32(self.acc1)
            if b == 0:
                self.cc1 = self.cc0 = 1
                self.ov = self.os = 1
                return None
            q = abs(a) // abs(b) * (1 if (a >= 0) == (b > 0) else -1)
            res = q if mn == '/D' else a - q * b
            w = s32(res)
            self.acc1 = u32(w)
            self._cc_from(w)
            self.ov = int(res != w)
            self.os |= self.ov
            return None
        if mn in ('+R', '-R', '*R', '/R'):
            a, b = bits_f32(self.acc2), bits_f32(self.acc1)
            try:
                r = {'+R': lambda: a + b, '-R': lambda: a - b, '*R': lambda: a * b, '/R': lambda: a / b}[mn]()
            except ZeroDivisionError:
                r = math.nan if a == 0 or math.isnan(a) else math.copysign(math.inf, a) * math.copysign(1, b)
            except OverflowError:
                r = math.inf
            self._set_real(r)
            return None
        if mn in FLOATFN:
            x = bits_f32(self.acc1)
            if mn == 'ABS':
                self.acc1 &= 0x7FFFFFFF
                return None
            try:
                r = {
                    'SQR': lambda: x * x, 'SQRT': lambda: math.sqrt(x), 'EXP': lambda: math.exp(x),
                    'LN': lambda: math.log(x) if x > 0 else (-math.inf if x == 0 else math.nan),
                    'SIN': lambda: math.sin(x), 'COS': lambda: math.cos(x), 'TAN': lambda: math.tan(x),
                    'ASIN': lambda: math.asin(x), 'ACOS': lambda: math.acos(x), 'ATAN': lambda: math.atan(x),
                }[mn]()
            except ValueError:
                r = math.nan
            except OverflowError:
                r = math.inf
            self._set_real(r)
            return None

        # --- comparación ---
        if mn in CMP:
            typ, rel = mn[-1], mn[:-1]
            if typ == 'I':
                a, b = s16(self.acc2), s16(self.acc1)
            elif typ == 'D':
                a, b = s32(self.acc2), s32(self.acc1)
            else:
                a, b = bits_f32(self.acc2), bits_f32(self.acc1)
            if typ == 'R' and (math.isnan(a) or math.isnan(b)):
                res = 0
                self.cc1 = self.cc0 = 1
                self.ov = self.os = 1
            else:
                res = int({'==': a == b, '<>': a != b, '>': a > b, '<': a < b,
                           '>=': a >= b, '<=': a <= b}[rel])
                self.cc1, self.cc0 = (1, 0) if a > b else ((0, 1) if a < b else (0, 0))
                self.ov = 0
            self.rlo, self.fc, self.orb, self.sta = res, 1, 0, res
            return None

        # --- conversión ---
        if mn in CONV:
            return self._conv(mn)

        # --- lógica de palabras ---
        if mn in WORDLOG:
            other = op.value if op is not None else self.acc2
            fn = {'U': lambda x, y: x & y, 'O': lambda x, y: x | y, 'X': lambda x, y: x ^ y}[mn[0]]
            if mn.endswith('W'):
                res = fn(self.acc1 & 0xFFFF, other & 0xFFFF)
                self.acc1 = (self.acc1 & 0xFFFF0000) | res
            else:
                res = fn(self.acc1, other) & 0xFFFFFFFF
                self.acc1 = res
            self.cc1, self.cc0, self.ov = int(res != 0), 0, 0
            return None

        # --- desplazamiento y rotación ---
        if mn in SHIFTS:
            n = op.value if op is not None else (self.acc2 & 0xFF)
            if n == 0:
                return None
            if mn in ('SLW', 'SRW', 'SSI'):
                low = self.acc1 & 0xFFFF
                if mn == 'SLW':
                    last = (low >> (16 - n)) & 1 if n <= 16 else 0
                    res = (low << n) & 0xFFFF if n < 16 else 0
                elif mn == 'SRW':
                    last = (low >> (n - 1)) & 1 if n <= 16 else 0
                    res = low >> n if n < 16 else 0
                else:
                    v = s16(low)
                    last = (v >> min(n - 1, 15)) & 1
                    res = u16(v >> min(n, 15))
                self.acc1 = (self.acc1 & 0xFFFF0000) | res
            else:
                a = self.acc1
                if mn == 'SLD':
                    last = (a >> (32 - n)) & 1 if n <= 32 else 0
                    res = (a << n) & 0xFFFFFFFF if n < 32 else 0
                elif mn == 'SRD':
                    last = (a >> (n - 1)) & 1 if n <= 32 else 0
                    res = a >> n if n < 32 else 0
                elif mn == 'SSD':
                    v = s32(a)
                    last = (v >> min(n - 1, 31)) & 1
                    res = u32(v >> min(n, 31))
                elif mn == 'RLD':
                    k = n % 32
                    res = ((a << k) | (a >> (32 - k))) & 0xFFFFFFFF if k else a
                    last = res & 1
                else:
                    k = n % 32
                    res = ((a >> k) | (a << (32 - k))) & 0xFFFFFFFF if k else a
                    last = (res >> 31) & 1
                self.acc1 = res
            self.cc1, self.cc0, self.ov = last, 0, 0
            return None
        if mn in ('RLDA', 'RRDA'):
            a, old = self.acc1, self.cc1
            if mn == 'RLDA':
                self.cc1 = (a >> 31) & 1
                self.acc1 = ((a << 1) | old) & 0xFFFFFFFF
            else:
                self.cc1 = a & 1
                self.acc1 = (a >> 1) | (old << 31)
            self.cc0 = self.ov = 0
            return None

        # --- saltos ---
        if mn in JUMPS:
            tgt = ins.target
            if mn == 'SPA':
                return tgt
            if mn in ('SPB', 'SPBN', 'SPBB', 'SPBNB'):
                cond = self.rlo if mn in ('SPB', 'SPBB') else self.rlo ^ 1
                if mn in ('SPBB', 'SPBNB'):
                    self.br = self.rlo
                self.rlo, self.sta = 1, 1
                self._end_chain()
                return tgt if cond else None
            if mn in ('SPBI', 'SPBIN'):
                cond = self.br if mn == 'SPBI' else self.br ^ 1
                self.sta = 1
                self._end_chain()
                return tgt if cond else None
            if mn == 'SPS':
                cond = self.os
                self.os = 0
                return tgt if cond else None
            if mn == 'LOOP':
                low = (self.acc1 - 1) & 0xFFFF
                self.acc1 = (self.acc1 & 0xFFFF0000) | low
                return tgt if low != 0 else None
            if mn == 'SPL':
                k = self.acc1 & 0xFF
                return pc + 1 + k if k < ins.spl_count else tgt
            c1, c0 = self.cc1, self.cc0
            cond = {
                'SPO': self.ov == 1, 'SPZ': c1 == 0 and c0 == 0, 'SPN': c1 != c0,
                'SPP': c1 == 1 and c0 == 0, 'SPM': c1 == 0 and c0 == 1, 'SPPZ': c0 == 0,
                'SPMZ': c1 == 0, 'SPU': c1 == 1 and c0 == 1,
            }[mn]
            return tgt if cond else None

        # --- bloques ---
        if mn in ('BE', 'BEA'):
            return 'END'
        if mn == 'BEB':
            if self.rlo:
                return 'END'
            self.rlo, self.sta = 1, 1
            self._end_chain()
            return None
        if mn == 'AUF':
            self._db(op.n)
            if op.name == 'DB':
                self.open_db = op.n
            else:
                self.open_di = op.n
            return None
        if mn in ('UC', 'CC', 'CALL'):
            if mn == 'CC' and not self.rlo:
                self._end_chain()
                return None
            self._run_block(f'{op.name}{op.n}', is_ob=False, depth=depth + 1)
            return None

        # --- MCR ---
        if mn == 'MCRA':
            self.mcra = True
            return None
        if mn == 'MCRD':
            self.mcra = False
            return None
        if mn == 'MCR(':
            if len(self.mcr_stack) >= 8:
                raise PLCError('Desbordamiento de la pila MCR (máximo 8 niveles)')
            self.mcr_stack.append(self.rlo)
            self._end_chain()
            return None
        if mn == ')MCR':
            if not self.mcr_stack:
                raise PLCError(')MCR sin MCR( previo')
            self.mcr_stack.pop()
            self._end_chain()
            return None

        if mn in ('NOP', 'BLD'):
            return None
        raise PLCError(f'Instrucción no implementada: {mn}')

    def _set_real(self, r):
        bits = f32_bits(r)
        f = bits_f32(bits)
        self.acc1 = bits
        if math.isnan(f):
            self.cc1 = self.cc0 = 1
            self.ov = 1
        elif math.isinf(f):
            self.cc1, self.cc0 = (1, 0) if f > 0 else (0, 1)
            self.ov = 1
        elif f == 0:
            self.cc1 = self.cc0 = 0
            self.ov = int(r != 0)          # subdesbordamiento
        else:
            self.cc1, self.cc0 = (1, 0) if f > 0 else (0, 1)
            self.ov = 0
        self.os |= self.ov

    def _conv(self, mn):
        a = self.acc1
        if mn == 'BTI':
            v = bcd_decode(a & 0x0FFF, 3)
            if a & 0x8000:
                v = -v
            self.acc1 = (a & 0xFFFF0000) | u16(v)
        elif mn == 'ITB':
            v = s16(a)
            if abs(v) > 999:
                self.ov = self.os = 1
            else:
                w = bcd_encode(abs(v), 3) | (0xF000 if v < 0 else 0)
                self.acc1 = (a & 0xFFFF0000) | w
                self.ov = 0
        elif mn == 'BTD':
            v = bcd_decode(a & 0x0FFFFFFF, 7)
            if a & 0x80000000:
                v = -v
            self.acc1 = u32(v)
        elif mn == 'DTB':
            v = s32(a)
            if abs(v) > 9999999:
                self.ov = self.os = 1
            else:
                self.acc1 = bcd_encode(abs(v), 7) | (0xF0000000 if v < 0 else 0)
                self.ov = 0
        elif mn == 'ITD':
            self.acc1 = u32(s16(a))
        elif mn == 'DTR':
            self.acc1 = f32_bits(float(s32(a)))
        elif mn in ('RND', 'TRUNC', 'RND+', 'RND-'):
            x = bits_f32(a)
            if math.isnan(x) or math.isinf(x):
                self.ov = self.os = 1
                return None
            r = {'RND': round, 'TRUNC': math.trunc, 'RND+': math.ceil, 'RND-': math.floor}[mn](x)
            if not -2**31 <= r < 2**31:
                self.ov = self.os = 1
                return None
            self.acc1 = u32(r)
            self.ov = 0
        elif mn == 'INVI':
            self.acc1 = a ^ 0x0000FFFF
        elif mn == 'INVD':
            self.acc1 = a ^ 0xFFFFFFFF
        elif mn == 'NEGI':
            r = -s16(a)
            w = s16(r)
            self.acc1 = (a & 0xFFFF0000) | u16(w)
            self._cc_from(w)
            self.ov = int(r != w)
            self.os |= self.ov
        elif mn == 'NEGD':
            r = -s32(a)
            w = s32(r)
            self.acc1 = u32(w)
            self._cc_from(w)
            self.ov = int(r != w)
            self.os |= self.ov
        elif mn == 'NEGR':
            self.acc1 = a ^ 0x80000000
        elif mn == 'CAW':
            self.acc1 = (a & 0xFFFF0000) | ((a & 0xFF) << 8) | ((a >> 8) & 0xFF)
        elif mn == 'CAD':
            self.acc1 = int.from_bytes(a.to_bytes(4, 'big')[::-1], 'big')
        return None


# ═══════════════════════════════════════════════════════════════════════════
# Lectura/escritura para las pruebas (formato yaml de ejemplos_KOP_AWL.md)
# ═══════════════════════════════════════════════════════════════════════════


def _split_key(key):
    key = str(key).strip()
    if ':' in key:
        a, t = key.rsplit(':', 1)
        return a.strip(), t.strip().upper()
    return key, None


def _value_to_raw(value, tipo):
    if tipo == 'REAL':
        return f32_bits(float(value))
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, str):
        c = parse_constant(value)
        if c is None:
            raise ValueError(f'valor no válido: {value}')
        return c[0]
    if isinstance(value, float):
        return f32_bits(value)
    return int(value)


def test_write(cpu, key, value):
    opstr, tipo = _split_key(key)
    op = parse_operand(opstr)
    if op.kind == 'bit':
        if op.area == 'E':      # entrada física: se copia a la PAE al empezar el ciclo
            buf, b = cpu.periph_in, op.byte
            if value:
                buf[b] |= 1 << op.bit
            else:
                buf[b] &= ~(1 << op.bit) & 0xFF
        else:
            cpu._wbit(op, int(value))
        return
    if op.kind == 'mem':
        raw = _value_to_raw(value, tipo)
        if op.area in ('E', 'PE'):
            data = (raw & ((1 << (8 * op.size)) - 1)).to_bytes(op.size, 'big')
            cpu.periph_in[op.byte:op.byte + op.size] = data
        else:
            cpu._wmem(op, raw)
        return
    raise ValueError(f'no se puede escribir {key}')


def test_read(cpu, key):
    opstr, tipo = _split_key(key)
    op = parse_operand(opstr)
    if op.kind == 'bit':
        return cpu._rbit(op)
    if op.kind == 'timer':
        t = cpu.timers[op.n]
        return t.value if tipo == 'VALOR' else t.q
    if op.kind == 'counter':
        c = cpu.counters[op.n]
        return c.value if tipo == 'VALOR' else int(c.value > 0)
    if op.kind == 'mem':
        raw = cpu._rmem(op)
        if tipo == 'REAL':
            return bits_f32(raw)
        if tipo in ('WORD', 'DWORD', 'BYTE'):
            return raw
        if tipo == 'INT' or (tipo is None and op.size == 2):
            return s16(raw)
        if tipo == 'DINT' or (tipo is None and op.size == 4):
            return s32(raw)
        return raw
    raise ValueError(f'no se puede leer {key}')


def _expected_matches(actual, expected, tipo):
    if tipo == 'REAL':
        return abs(actual - float(expected)) <= 1e-3
    if isinstance(expected, str):
        exp = parse_constant(expected)[0]
        if tipo in (None, 'INT') and isinstance(actual, int) and actual < 0:
            exp = s16(exp)
        return actual == exp
    return actual == int(expected)


def run_test(code, test, symbols=None, lang='de'):
    """Ejecuta una prueba en formato `pasos`. Devuelve la lista de fallos (vacía = OK)."""
    cycle_ms = test.get('ciclo_ms', 10)
    cpu = CPU(code, cycle_ms=cycle_ms, symbols=symbols, lang=lang)
    for k, v in (test.get('inicial') or {}).items():
        test_write(cpu, k, v)
    fails = []
    for i, step in enumerate(test.get('pasos', []), 1):
        for k, v in (step.get('poner') or {}).items():
            test_write(cpu, k, v)
        if 'pulso' in step:
            for _ in range(int(step.get('veces', 1))):
                test_write(cpu, step['pulso'], 1)
                cpu.scan()
                test_write(cpu, step['pulso'], 0)
                cpu.scan()
        if 'ciclos' in step:
            n = int(step['ciclos'])
        elif 'tiempo_ms' in step:
            n = math.ceil(step['tiempo_ms'] / cycle_ms)
        elif 'pulso' in step:
            n = 0
        else:
            n = 1
        for _ in range(n):
            cpu.scan()
        for k, exp in (step.get('esperar') or {}).items():
            _, tipo = _split_key(k)
            got = test_read(cpu, k)
            if not _expected_matches(got, exp, tipo):
                fails.append(f'paso {i}: {k} = {got}, se esperaba {exp}'
                             + (f'  [CPU en STOP: {cpu.stop_reason}]' if cpu.state == 'STOP' else ''))
        if 'esperar_estado' in step and cpu.state != step['esperar_estado']:
            fails.append(f'paso {i}: estado = {cpu.state}, se esperaba {step["esperar_estado"]}'
                         + (f' ({cpu.stop_reason})' if cpu.stop_reason else ''))
    return fails


def run_trace_test(code, spec):
    """Comprueba una traza (modo «traza»): un ciclo con el estado inicial dado."""
    cpu = CPU(code)
    for k, v in (spec.get('inicial') or {}).items():
        test_write(cpu, k, v)
    cpu.tracing = True
    cpu.scan()
    rows = [r for r in cpu.trace if r['bloque'] == 'OB1']
    fails = []
    exp_rows = spec['filas']
    if len(rows) != len(exp_rows):
        fails.append(f'la traza tiene {len(rows)} filas y se esperaban {len(exp_rows)}')
    for i, (got, exp) in enumerate(zip(rows, exp_rows), 1):
        for k, v in exp.items():
            if k == 'i':
                norm = lambda s: re.sub(r'\s+', '', s.split('//')[0]).upper()
                if norm(got['instr']).split(':')[-1] != norm(str(v)).split(':')[-1]:
                    fails.append(f'fila {i}: instrucción «{got["instr"]}», se esperaba «{v}»')
                continue
            if got[k] != v:
                fails.append(f'fila {i} ({got["instr"]}): {k} = {got[k]}, se esperaba {v}')
    return fails


def run_chrono_test(code, spec):
    """Cronograma: cada carácter es un intervalo de `paso_ms`; se muestrea a mitad del intervalo."""
    cycle_ms = spec.get('ciclo_ms', 10)
    cpu = CPU(code, cycle_ms=cycle_ms)
    paso = spec['paso_ms']
    n_half = paso // cycle_ms // 2
    entradas = spec['entradas']
    length = len(next(iter(entradas.values())))
    got = {k: '' for k in spec['salidas']}
    for i in range(length):
        for k, wave in entradas.items():
            test_write(cpu, k, int(wave[i]))
        for _ in range(n_half):
            cpu.scan()
        for k in spec['salidas']:
            got[k] += str(test_read(cpu, k))
        for _ in range(paso // cycle_ms - n_half):
            cpu.scan()
    fails = []
    for k, exp in spec['salidas'].items():
        if got[k] != exp:
            fails.append(f'{k}: obtenido {got[k]}, se esperaba {exp}')
    return fails, got


# ═══════════════════════════════════════════════════════════════════════════
# Lectura del banco de ejercicios (Markdown)
# ═══════════════════════════════════════════════════════════════════════════

TIPOS = {'E': 'ejemplo', 'Q': 'predice', 'C': 'traduce', 'P': 'programa', 'M': 'teoria',
         'T': 'traza', 'R': 'cronograma'}


def parse_bank(md_text):
    import yaml
    items, cat, cur = [], None, None

    def close():
        if cur is None:
            return
        text = '\n'.join(cur['lines'])
        blocks = re.findall(r'```(\w*)\n(.*?)```', text, re.S)
        awl = next((b for lang, b in blocks if lang == 'awl'), None)
        kop = next((b for lang, b in blocks if lang == 'text'), None)
        prueba = traza = crono = preguntas = None
        for lang, b in blocks:
            if lang != 'yaml':
                continue
            data = yaml.safe_load(b)
            if not isinstance(data, dict):
                continue
            if 'pasos' in data and prueba is None:
                prueba = data
            if 'traza' in data:
                traza = data['traza']
            if 'cronograma' in data:
                crono = data['cronograma']
            if 'preguntas' in data:
                preguntas = data['preguntas']
        ident = cur['id']
        items.append({
            'id': ident, 'titulo': cur['titulo'], 'categoria': cat,
            'tipo': TIPOS.get(ident[0], 'otro'),
            'awl': awl, 'kop_ascii': kop, 'prueba': prueba, 'traza': traza,
            'cronograma': crono, 'preguntas': preguntas, 'markdown': text.strip(),
        })

    for line in md_text.splitlines():
        m = re.match(r'^# ([A-Z])\. (.+)$', line)
        if m:
            close()
            cur = None
            cat = f'{m.group(1)}. {m.group(2).strip()}'
            continue
        m = re.match(r'^### (\S+) — (.+)$', line)
        if m:
            close()
            cur = {'id': m.group(1), 'titulo': m.group(2).strip(), 'lines': []}
            continue
        if line.startswith('---') and cur is not None:
            continue
        if cur is not None:
            cur['lines'].append(line)
    close()
    return items


def test_bank(path, verbose=True):
    with open(path, encoding='utf-8') as f:
        items = parse_bank(f.read())
    total = ok = 0
    for it in items:
        checks = []
        try:
            if it['prueba'] and it['awl']:
                checks.append(('pasos', run_test(it['awl'], it['prueba'])))
            if it['traza'] and it['awl']:
                checks.append(('traza', run_trace_test(it['awl'], it['traza'])))
            if it['cronograma'] and it['awl']:
                checks.append(('cronograma', run_chrono_test(it['awl'], it['cronograma'])[0]))
            if it['preguntas']:
                fails = []
                for q in it['preguntas']:
                    if not (0 <= q['correcta'] < len(q['opciones'])):
                        fails.append(f'{q["id"]}: índice de respuesta fuera de rango')
                checks.append(('teoria', fails))
        except (CompileError, PLCError, ValueError) as e:
            checks.append(('error', [f'{type(e).__name__}: {e}']))
        if not checks:
            continue
        for kind, fails in checks:
            total += 1
            if fails:
                print(f'FALLA  {it["id"]:<5} {kind:<10} {it["titulo"]}')
                for fl in fails:
                    print(f'         - {fl}')
            else:
                ok += 1
                if verbose:
                    print(f'OK     {it["id"]:<5} {kind:<10} {it["titulo"]}')
    print(f'\n{ok}/{total} comprobaciones superadas')
    return ok == total


# ═══════════════════════════════════════════════════════════════════════════
# Pruebas internas (fragmentos de referencia_KOP_AWL.md y casos límite)
# ═══════════════════════════════════════════════════════════════════════════

SELFTESTS = [
    ('§3.3 S5TIME', 'L S5T#5S\nT MW 0\nL S5T#12S\nT MW 2\nL S5T#2M\nT MW 4\nL S5T#2H46M30S\nT MW 6',
     {'pasos': [{'esperar': {'MW0:WORD': 'W#16#0500', 'MW2:WORD': 'W#16#1120', 'MW4:WORD': 'W#16#2120',
                             'MW6:WORD': 'W#16#3999'}}]}),
    ('§3.2 BCD', 'L C#123\nT MW 0\nL W#16#0123\nBTI\nT MW 2\nL -123\nITB\nT MW 4\nL 1000\nITB\nT MW 6\nU OV\n= M 9.0',
     {'pasos': [{'esperar': {'MW0:WORD': 'W#16#0123', 'MW2': 123, 'MW4:WORD': 'W#16#F123', 'MW6': 1000, 'M9.0': 1}}]}),
    ('§7.3 asignaciones encadenadas', 'U E 0.0\nU E 0.1\n= A 4.0\n= A 4.1\nS M 0.0',
     {'pasos': [{'poner': {'E0.0': 1, 'E0.1': 1}, 'esperar': {'A4.0': 1, 'A4.1': 1, 'M0.0': 1}},
                {'poner': {'E0.1': 0}, 'esperar': {'A4.0': 0, 'A4.1': 0, 'M0.0': 1}}]}),
    ('§7.3 L/T no tocan el RLO', 'U E 0.0\nL MW 10\nT MW 12\n= A 4.0',
     {'pasos': [{'poner': {'E0.0': 1, 'MW10': 7}, 'esperar': {'A4.0': 1, 'MW12': 7}},
                {'poner': {'E0.0': 0, 'MW10': 9}, 'esperar': {'A4.0': 0, 'MW12': 9}}]}),
    ('§6.4 SR prioridad a desactivar', 'U E 0.0\nS M 0.0\nU E 0.1\nR M 0.0\nU E 0.1\nR M 0.1\nU E 0.0\nS M 0.1',
     {'pasos': [{'poner': {'E0.0': 1, 'E0.1': 1}, 'esperar': {'M0.0': 0, 'M0.1': 1}}]}),
    ('§7.13 lógica de palabras', 'L MW 10\nUW W#16#00FF\nT MW 12\nL MW 10\nSRW 4\nT MW 14\nL MW 10\nCAW\nT MW 16',
     {'pasos': [{'poner': {'MW10:WORD': 'W#16#1234'},
                 'esperar': {'MW12:WORD': 'W#16#0034', 'MW14:WORD': 'W#16#0123', 'MW16:WORD': 'W#16#3412'}}]}),
    ('§7.15 SPB no tomado deja RLO=1', 'U E 0.0\nSPB X\nX: = A 4.0',
     {'pasos': [{'poner': {'E0.0': 0}, 'esperar': {'A4.0': 1}}]}),
    ('§7.15 LOOP con contador 0 → 1 + 65535 vueltas',
     'L L#0\nT MD 4\nL 0\nSIG: T MW 2\nL MD 4\nL L#1\n+D\nT MD 4\nL MW 2\nLOOP SIG',
     {'pasos': [{'esperar': {'MD4': 65536}, 'esperar_estado': 'RUN'}]}),
    ('§7.15 LOOP normal (5 vueltas)', 'L 0\nT MW 0\nL 5\nSIG: T MW 2\nL MW 0\n+ 1\nT MW 0\nL MW 2\nLOOP SIG',
     {'pasos': [{'esperar': {'MW0': 5, 'MW2': 1}}]}),
    ('§7.15 bucle infinito → STOP (OB80)', 'M1: SPA M1',
     {'pasos': [{'esperar_estado': 'STOP'}]}),
    ('§8.3 cuadro ADD_I con EN/ENO', ('U E 0.0\nSPBNB _001\nL MW 10\nL MW 12\n+I\nT MW 14\nUN OV\nSAVE\nCLR\n'
                                       '_001: U BIE\n= A 4.0'),
     {'pasos': [{'poner': {'E0.0': 0, 'MW10': 1, 'MW12': 2}, 'esperar': {'A4.0': 0, 'MW14': 0}},
                {'poner': {'E0.0': 1}, 'esperar': {'A4.0': 1, 'MW14': 3}},
                {'poner': {'MW10': 30000, 'MW12': 10000}, 'esperar': {'A4.0': 0, 'MW14': -25536}}]}),
    ('§7.12 RND redondea al par en x,5', 'L 2.5\nRND\nT MD 0\nL 3.5\nRND\nT MD 4\nL -2.5\nRND\nT MD 8',
     {'pasos': [{'esperar': {'MD0': 2, 'MD4': 4, 'MD8': -2}}]}),
    ('§7.10 división por 0', 'L 5\nL 0\n/I\nU UO\n= M 0.0\nU OV\n= M 0.1',
     {'pasos': [{'esperar': {'M0.0': 1, 'M0.1': 1}, 'esperar_estado': 'RUN'}]}),
    ('§7.16 bits de estado como operandos', 'L 3\nL 5\n-I\nU <0\n= M 0.0\nU >0\n= M 0.1\nU ==0\n= M 0.2',
     {'pasos': [{'esperar': {'M0.0': 1, 'M0.1': 0, 'M0.2': 0}}]}),
    ('§5.4 UC / CC', {'OB1': 'UC FC 2\nU E 0.3\nCC FC 3', 'FC2': 'SET\n= M 0.0', 'FC3': 'SET\n= M 0.1'},
     {'pasos': [{'poner': {'E0.3': 0}, 'esperar': {'M0.0': 1, 'M0.1': 0}},
                {'poner': {'E0.3': 1}, 'esperar': {'M0.1': 1}}]}),
    ('Bloque inexistente → STOP', 'UC FC 9',
     {'pasos': [{'esperar_estado': 'STOP'}]}),
    ('§7.18 bloques de datos', 'L 77\nT DB1.DBW 0\nAUF DB 1\nL DBW 0\nT MW 10\nSET\n= DB1.DBX 2.0\nU DBX 2.0\n= A 4.0',
     {'pasos': [{'esperar': {'MW10': 77, 'A4.0': 1}}]}),
    ('§7.19 direccionamiento por registro', 'LAR1 P#100.0\nL 5\nT MW [AR1, P#2.0]\nL MW 102\nT MW 10',
     {'pasos': [{'esperar': {'MW10': 5}}]}),
    ('§7.20 MCR', 'MCRA\nU E 0.0\nMCR(\nSET\n= A 4.0\nL 9\nT MW 0\n)MCR\nMCRD',
     {'pasos': [{'poner': {'E0.0': 1}, 'esperar': {'A4.0': 1, 'MW0': 9}},
                {'poner': {'E0.0': 0}, 'esperar': {'A4.0': 0, 'MW0': 0}}]}),
    ('§2.2 orden de bytes MD', 'L DW#16#11223344\nT MD 10\nL MB 10\nT MW 20\nL MW 12\nT MW 22',
     {'pasos': [{'esperar': {'MW20:WORD': 'W#16#0011', 'MW22:WORD': 'W#16#3344'}}]}),
    ('Decisión: L de constante INT negativa carga 16 bits (ACU1-H = 0)', 'L -1\nT MD 0',
     {'pasos': [{'esperar': {'MD0': 65535}}]}),
    ('Nemotécnica inglesa', 'A I 0.0\nAN I 0.1\n= Q 4.0\nA I 0.0\nL S5T#1S\nSD T 1\nA T 1\n= Q 4.1',
     {'pasos': [{'poner': {'E0.0': 1}, 'esperar': {'A4.0': 1, 'A4.1': 0}},
                {'tiempo_ms': 1000, 'esperar': {'A4.1': 1}}]}, 'en'),
    ('Contador ZV en el máximo 999', 'U E 0.0\nL C#999\nS Z 1\nU E 0.1\nZV Z 1\nL Z 1\nT MW 0',
     {'pasos': [{'pulso': 'E0.0', 'esperar': {'MW0': 999}}, {'pulso': 'E0.1', 'esperar': {'MW0': 999}}]}),
    ('SPL lista de saltos', ('L MW 0\nSPL FIN\nSPA C0\nSPA C1\nFIN: L 99\nT MW 2\nBEA\nC0: L 10\nT MW 2\nBEA\n'
                             'C1: L 11\nT MW 2'),
     {'pasos': [{'poner': {'MW0': 0}, 'esperar': {'MW2': 10}}, {'poner': {'MW0': 1}, 'esperar': {'MW2': 11}},
                {'poner': {'MW0': 5}, 'esperar': {'MW2': 99}}]}),
]

COMPILE_ERRORS = [
    ('U E 0.8', 'bit 0..7'),
    ('U(\nU E 0.0', 'paréntesis sin cerrar'),
    ('SPA NOEX', 'meta inexistente'),
    ('L 500\nXYZ', 'instrucción desconocida'),
    ('= MW 10', '= con palabra'),
    ('L PAW 256', 'leer PA'),
    ('ENT', '4 acumuladores'),
]


def selftest():
    ok = total = 0
    for entry in SELFTESTS:
        name, code, test = entry[:3]
        lang = entry[3] if len(entry) > 3 else 'de'
        total += 1
        try:
            fails = run_test(code, test, lang=lang)
        except (CompileError, PLCError, ValueError) as e:
            fails = [f'{type(e).__name__}: {e}']
        if fails:
            print(f'FALLA  {name}')
            for fl in fails:
                print(f'         - {fl}')
        else:
            ok += 1
            print(f'OK     {name}')
    for code, why in COMPILE_ERRORS:
        total += 1
        try:
            CPU(code)
            print(f'FALLA  error de compilación esperado ({why}): {code!r}')
        except CompileError as e:
            ok += 1
            print(f'OK     error de compilación ({why}): {e}')
    print(f'\n{ok}/{total} pruebas internas superadas')
    return ok == total


# ═══════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════


def print_trace(code, assigns):
    cpu = CPU(code)
    for a in assigns:
        k, v = a.split('=', 1)
        test_write(cpu, k, v if not re.fullmatch(r'-?\d+', v) else int(v))
    cpu.tracing = True
    cpu.scan()
    print(f'{"instrucción":<28} {"/ER antes":>9} {"RLO":>4} {"STA":>4} {"OR":>3} {"OV":>3} {"OS":>3} '
          f'{"A1A0":>5} {"ACU1":>12} {"ACU2":>12}')
    for r in cpu.trace:
        print(f'{r["instr"][:28]:<28} {r["er_antes"]:>9} {r["rlo"]:>4} {r["sta"]:>4} {r["or"]:>3} {r["ov"]:>3} '
              f'{r["os"]:>3} {r["cc1"]:>3}{r["cc0"]:<2} {r["acu1"]:>12} {r["acu2"]:>12}')
    print(f'Estado de la CPU: {cpu.state}' + (f' — {cpu.stop_reason}' if cpu.stop_reason else ''))


def main(argv):
    if len(argv) < 2 or argv[1] not in ('test', 'export', 'traza', 'selftest'):
        print(__doc__)
        return 1
    cmd = argv[1]
    if cmd == 'selftest':
        return 0 if selftest() else 1
    if cmd == 'test':
        return 0 if test_bank(argv[2], verbose='-q' not in argv) else 1
    if cmd == 'export':
        with open(argv[2], encoding='utf-8') as f:
            items = parse_bank(f.read())
        out = {
            'formato': 'banco-kop-awl-v1',
            'fuente': argv[2],
            'convenciones': {
                'ciclo_ms_por_defecto': 10,
                'orden_del_ciclo': ['actualizar temporizadores', 'leer PAE', 'ejecutar OB1', 'escribir PAA'],
                'tipos_de_ejercicio': TIPOS,
            },
            'ejercicios': items,
        }
        with open(argv[3], 'w', encoding='utf-8') as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
        print(f'{len(items)} ejercicios exportados a {argv[3]}')
        return 0
    if cmd == 'traza':
        with open(argv[2], encoding='utf-8') as f:
            code = f.read()
        print_trace(code, argv[3:])
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main(sys.argv))
