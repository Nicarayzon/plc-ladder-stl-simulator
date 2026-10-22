# Automatizacion: práctica de KOP y AWL

Código y material de partida de **Automatizacion**, una app de escritorio para practicar la programación de autómatas en **KOP** (esquema de contactos) y **AWL** (lista de instrucciones). Trae un simulador de PLC propio, que reproduce el ciclo de scan, la palabra de estado, los acumuladores, los temporizadores y los contadores.

| Archivo | Contenido |
|---|---|
| `src/content/referencia_KOP_AWL.md` | Teoría completa: ciclo de scan, áreas de memoria (E, A, M, T, Z, DB, L, periferia), tipos y constantes, bloques, todo KOP, todo AWL (palabra de estado, RLO, /ER, OR, paréntesis, temporizadores, contadores, aritmética, saltos, indirecto), equivalencias KOP↔AWL y trampas de examen. La app la muestra en «Aprender» |
| `src/content/ejemplos_KOP_AWL.md` | 62 fichas con pruebas ejecutables: 31 ejemplos, 14 «¿qué vale…?», 4 traducciones KOP↔AWL, 4 ejercicios de programación, 5 trazas, 3 cronogramas y 24 preguntas de teoría |
| `src/content/banco_ejercicios.json` | Las fichas de los ejemplos en JSON, listas para que las cargue la app |
| `03_especificacion_simulador.md` | Especificación de partida de la app: arquitectura, modelo de CPU, sintaxis y semántica AWL, modelo y compilador KOP, interfaz, modos de práctica, corrección automática, fases y criterios de aceptación |
| `tools/interprete_referencia.py` | Intérprete AWL de referencia (Python 3 + PyYAML): verifica el banco, exporta el JSON y muestra trazas |
| `src/` | Código de la app: React y TypeScript. El motor que ejecuta KOP y AWL está en `src/core/` y el editor KOP en `src/kop/` |
| `electron/` | Proceso principal de Electron: ventana, menús y búsqueda de actualizaciones |
| `tests/` | Pruebas: `tests/core` y `tests/kop` con Vitest, y `tests/e2e` con Playwright sobre la app compilada |
| `docs/` | Web del proyecto (GitHub Pages) |

**Para el agente desarrollador**: empieza por la sección 0 de `03_especificacion_simulador.md`. La regla de oro es que el núcleo de la app reproduzca exactamente los resultados de `tools/interprete_referencia.py` (62/62 comprobaciones del banco y 31/31 pruebas internas).

```text
pip install pyyaml
python3 tools/interprete_referencia.py selftest
python3 tools/interprete_referencia.py test src/content/ejemplos_KOP_AWL.md
python3 tools/interprete_referencia.py export src/content/ejemplos_KOP_AWL.md src/content/banco_ejercicios.json
python3 tools/interprete_referencia.py traza programa.awl E0.0=1 MW30=600
```

La app (Node.js 22.12 o posterior):

```text
npm install
npm test               # núcleo, KOP y equivalencias (Vitest)
npm run test:diff      # el núcleo frente al intérprete de referencia, con programas aleatorios
npm run build          # comprueba los tipos y compila la interfaz en dist/
npm run electron       # abre la app compilada
npx playwright test    # pruebas de extremo a extremo (después de npm run build)
npm run dist           # instalador de macOS (Apple Silicon) en release/
```
