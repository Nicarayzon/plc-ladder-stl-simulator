import { useEffect, useMemo } from 'react';
import { SimController, type InputTipo } from '../../sim/SimController';
import type { Programa } from '../../core/program';
import type { WbState } from './types';
import { useSettings } from '../../store/settings';
import { analyzeUsage, inputBits, outputBits } from '../../core/usage';

/** Crea un simulador para `key` y restaura entradas y señales guardadas. */
export function useWorkbenchSim(key: string, programa: Programa, wb: WbState, opts: { inputs?: Map<string, InputTipo>; autoRun?: boolean; defaultSignals?: boolean } = {}) {
  const sim = useMemo(() => {
    const s = new SimController(programa);
    for (const [k, t] of opts.inputs ?? []) s.setInputTipo(k, t);
    for (const [k, t] of wb.inputs) s.setInputTipo(k, t);
    const sigs = wb.signals.length ? wb.signals : [];
    for (const g of sigs) {
      try { s.analyzer.add(g.text, s.compiled.symbols, undefined, g.view); } catch { /* señal no válida */ }
    }
    if (!sigs.length && opts.defaultSignals !== false && s.compiled.cp) {
      const u = analyzeUsage(s.compiled.cp);
      const list = [...inputBits(u).slice(0, 4), ...outputBits(u).slice(0, 4)];
      for (const k of list) {
        try { s.analyzer.add(k.replace(/^([EA])/, '$1 ')); } catch { /* */ }
      }
    }
    if (opts.autoRun !== false) {
      s.autoPlay = true;
      if (!s.hasErrors) s.play();
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => sim.dispose(), [sim]);
  useEffect(() => useSettings.subscribe(() => sim.applySettings()), [sim]);
  return sim;
}
