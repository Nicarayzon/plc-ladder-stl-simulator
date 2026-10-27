// Ejemplos, Traduce y Programa
import { useMemo, useState } from 'react';
import type { Ejercicio } from '../../../content/banco';
import { enunciado, solucion, stripYaml, traduceDireccion, cutAtDetails } from '../../../content/markdown';
import { kopModel } from '../../../content/kop/models';
import { compileProgramText } from '../../../core/compiler';
import { Markdown } from '../../common/Markdown';
import { AwlHighlight } from '../../common/AwlHighlight';
import { KopStatic } from '../../../kop/render/KopStatic';
import { WorkbenchExercise } from './WorkbenchExercise';
import { exampleProgram, emptyAwlProgram, emptyKopProgram } from './progs';
import { describeStep } from '../../../content/grading';
import { T } from '../../../i18n';
import { displayOperand } from '../../../core/translate';
import { useSettings } from '../../../store/settings';

function TestsList({ e }: { e: Ejercicio }) {
  // las pruebas están con la nemotecnia alemana: se enseñan con la elegida (E0.0 → I0.0 con la inglesa)
  const nemotecnia = useSettings((s) => s.nemotecnia);
  const ver = (k: string) => displayOperand(k, nemotecnia);
  if (!e.prueba) return null;
  return (
    <details className="md" style={{ marginTop: 14 }}>
      <summary>{T.ejercicio.pruebas(e.prueba.pasos.length)}</summary>
      <ol style={{ fontSize: 13 }}>
        {e.prueba.inicial && <li style={{ listStyle: 'none', marginLeft: -18 }}>{T.ejercicio.alEmpezar}{Object.entries(e.prueba.inicial).map(([k, v]) => `${ver(k)} = ${v}`).join(', ')}</li>}
        {e.prueba.pasos.map((p, i) => (
          <li key={i}>{describeStep(p, e.prueba!.ciclo_ms, ver)}{T.ejercicio.seComprueba}{[...Object.entries(p.esperar ?? {}).map(([k, v]) => `${ver(k)} = ${v}`), ...(p.esperar_estado ? [T.ejercicio.cpuEn(p.esperar_estado)] : [])].join(', ')}</li>
        ))}
      </ol>
    </details>
  );
}

export function EjemploEx({ e, back }: { e: Ejercicio; back: string }) {
  const hasKop = !!kopModel(e.id);
  const md = useMemo(() => stripYaml(e.markdown), [e]);
  return (
    <WorkbenchExercise e={e} back={back} initial={() => exampleProgram(e, 'KOP')}
      extraActions={({ load }) => hasKop ? (
        <div className="btn-group" title={T.ejercicio.cargarSolucion}>
          <button className="btn" onClick={() => { if (confirm(T.ejercicio.cargarKop)) load(exampleProgram(e, 'KOP')); }}>{T.lenguaje.KOP}</button>
          <button className="btn" onClick={() => { if (confirm(T.ejercicio.cargarAwl)) load(exampleProgram(e, 'AWL')); }}>{T.lenguaje.AWL}</button>
        </div>
      ) : null}
      left={() => (
        <>
          <Markdown text={md} />
          <TestsList e={e} />
          <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>{T.ejercicio.ejemploPie}</p>
        </>
      )} />
  );
}

export function TraduceEx({ e, back }: { e: Ejercicio; back: string }) {
  const dir = traduceDireccion(e);
  const model = kopModel(e.id);
  const solution = useMemo(() => (e.awl ? compileProgramText(e.awl) : null), [e]);
  const [show, setShow] = useState(false);
  const md = useMemo(() => enunciado(e), [e]);
  return (
    <WorkbenchExercise e={e} back={back} solution={solution} withEquivalence
      initial={() => (dir === 'aAWL' ? emptyAwlProgram(T.ejercicio.escribeAwl) : emptyKopProgram())}
      left={(res) => (
        <>
          <p className="lead" style={{ margin: '0 0 10px' }}>{dir === 'aAWL' ? T.ejercicio.aAwl : T.ejercicio.aKop}</p>
          {dir === 'aAWL'
            ? (model ? <KopStatic segs={model} /> : <pre className="kop-ascii">{e.kop_ascii}</pre>)
            : <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>}
          <Markdown text={md.replace(/```(text|awl)\n[\s\S]*?```/g, '')} />
          {(res || show) ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>{T.ejercicio.solucion}</h3>
              {dir === 'aKOP' && model && <KopStatic segs={model} />}
              {dir === 'aAWL' && <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>}
              <Markdown text={solucion(e).replace(/```(text|awl)\n[\s\S]*?```/g, '')} />
            </div>
          ) : <button className="btn" style={{ marginTop: 14 }} onClick={() => setShow(true)}>{T.ejercicio.verSinComprobar}</button>}
        </>
      )} />
  );
}

export function ProgramaEx({ e, back }: { e: Ejercicio; back: string }) {
  const model = kopModel(e.id);
  const solution = useMemo(() => (e.awl ? compileProgramText(e.awl) : null), [e]);
  const [show, setShow] = useState(false);
  const md = useMemo(() => enunciado(e), [e]);
  const sol = useMemo(() => cutAtDetails(stripYaml(e.markdown)).after.replace(/<\/?details>|<summary>[^<]*<\/summary>/g, ''), [e]);
  return (
    <WorkbenchExercise e={e} back={back} solution={solution} withEquivalence
      initial={() => emptyAwlProgram(`// ${e.titulo}\n`)}
      left={(res) => (
        <>
          <Markdown text={md} />
          <p className="faint" style={{ fontSize: 12 }}>{T.ejercicio.programaPie}</p>
          <TestsList e={e} />
          {(res || show) ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>{T.ejercicio.solucionPropuesta}</h3>
              <Markdown text={sol} />
              {model && <><h4 style={{ margin: '12px 0 6px' }}>{T.ejercicio.enKop}</h4><KopStatic segs={model} /></>}
            </div>
          ) : <button className="btn" style={{ marginTop: 14 }} onClick={() => setShow(true)}>{T.ejercicio.verSolucion}</button>}
        </>
      )} />
  );
}
