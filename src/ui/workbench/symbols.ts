import { parseOperand } from '../../core/operands';
import type { Programa } from '../../core/program';

export const normAddr = (s: string): string => {
  try {
    const op = parseOperand(s);
    return op ? op.text.replace(/\s+/g, '') : s.replace(/\s+/g, '').toUpperCase();
  } catch {
    return s.replace(/\s+/g, '').toUpperCase();
  }
};

/** dirección normalizada (E0.0, MW10, T1) → nombre del símbolo */
export function symbolsByAddr(p: Programa): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of p.simbolos) if (s.nombre.trim() && s.dir.trim()) m.set(normAddr(s.dir), s.nombre.trim());
  return m;
}
