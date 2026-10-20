#!/usr/bin/env python3
"""Ejecuta casos en el intérprete de referencia (interprete_referencia.py) y devuelve el estado en JSON.

Entrada (stdin): [{"blocks": {"OB1": "...", "FC1": "..."}, "lang": "de", "steps": [{"poner": {...}, "ciclos": 1}], "trace": [1, 20]}]
Salida (stdout): [{"error": "..."} | {"steps": [snapshot, ...]}]
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, 'interprete_referencia.py')
spec = importlib.util.spec_from_file_location('interprete_ref', REF)
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)


def snapshot(cpu, with_trace):
    snap = {
        'M': list(cpu.M[:128]),
        'PAA': list(cpu.PAA[:16]),
        'out': list(cpu.periph_out[:16]),
        'DB1': list(cpu.dbs[1][:32]) if 1 in cpu.dbs else None,
        'DB2': list(cpu.dbs[2][:32]) if 2 in cpu.dbs else None,
        'T': [[t.value, int(bool(t.q)), int(bool(t.running)), t.base, int(bool(t.prev_s))] for t in cpu.timers[:4]],
        'Z': [[c.value, int(bool(c.prev_cu)), int(bool(c.prev_cd))] for c in cpu.counters[:4]],
        'acc': [cpu.acc1, cpu.acc2, cpu.ar1, cpu.ar2],
        'stw': cpu._stw(),
        'db': [cpu.open_db, cpu.open_di],
        'state': cpu.state,
        'reason': cpu.stop_reason,
        'cycles': cpu.cycles,
    }
    if with_trace:
        snap['trace'] = [{k: r[k] for k in ('bloque', 'pc', 'linea', 'instr', 'er_antes', 'er', 'rlo', 'sta', 'or', 'ov', 'os',
                                             'cc1', 'cc0', 'br', 'acu1', 'acu2', 'acu1_int', 'acu2_int')} for r in cpu.trace[:2000]]
    return snap


def run_case(case):
    try:
        cpu = ref.CPU(case['blocks'], cycle_ms=case.get('ciclo_ms', 10), lang=case.get('lang', 'de'))
    except ref.CompileError as e:
        return {'error': str(e)}
    out = []
    trace_steps = set(case.get('trace', []))
    for i, step in enumerate(case['steps'], 1):
        for k, v in (step.get('poner') or {}).items():
            ref.test_write(cpu, k, v)
        cpu.tracing = i in trace_steps
        for _ in range(step.get('ciclos', 1)):
            cpu.scan()
        out.append(snapshot(cpu, i in trace_steps))
        cpu.tracing = False
    return {'steps': out}


def main():
    cases = json.load(sys.stdin)
    json.dump([run_case(c) for c in cases], sys.stdout)


if __name__ == '__main__':
    main()
