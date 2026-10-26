// Sustituye a src/store/settings.ts en los ejemplos interactivos de la web (scripts/web-teoria.mjs):
// la web no guarda ajustes y usa los valores por defecto de la app.
export function getSettings() {
  return {
    nemotecnia: 'de' as const,
    cycleMs: 10,
    retentiveMBytes: 16,
    retentiveCounters: 8,
    retentiveTimers: 0,
    randomLocals: false,
  };
}
