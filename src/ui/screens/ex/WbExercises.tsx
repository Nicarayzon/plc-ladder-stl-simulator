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

function TestsList({ e }: { e: Ejercicio }) {
  if (!e.prueba) return null;
  return (
    <details className="md" style={{ marginTop: 14 }}>
      <summary>Pruebas con las que se comprueba ({e.prueba.pasos.length} pasos)</summary>
      <ol style={{ fontSize: 13 }}>
        {e.prueba.inicial && <li style={{ listStyle: 'none', marginLeft: -18 }}>Al empezar: {Object.entries(e.prueba.inicial).map(([k, v]) => `${k} = ${v}`).join(', ')}</li>}
        {e.prueba.pasos.map((p, i) => (
          <li key={i}>{describeStep(p, e.prueba!.ciclo_ms)} → se comprueba {[...Object.entries(p.esperar ?? {}).map(([k, v]) => `${k} = ${v}`), ...(p.esperar_estado ? [`CPU en ${p.esperar_estado}`] : [])].join(', ')}</li>
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
        <div className="btn-group" title="Cargar la solución en KOP o en AWL">
          <button className="btn" onClick={() => { if (confirm('¿Cargar la versión KOP? Se perderán tus cambios.')) load(exampleProgram(e, 'KOP')); }}>KOP</button>
          <button className="btn" onClick={() => { if (confirm('¿Cargar la versión AWL? Se perderán tus cambios.')) load(exampleProgram(e, 'AWL')); }}>AWL</button>
        </div>
      ) : null}
      left={() => (
        <>
          <Markdown text={md} />
          <TestsList e={e} />
          <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>Ejecuta el ejemplo, cambia las entradas en el panel E/S y modifícalo. «Comprobar» pasa las pruebas sobre tu versión.</p>
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
      initial={() => (dir === 'aAWL' ? emptyAwlProgram('// Escribe aquí el AWL equivalente al esquema KOP\n') : emptyKopProgram())}
      left={(res) => (
        <>
          <p className="lead" style={{ margin: '0 0 10px' }}>{dir === 'aAWL' ? 'Escribe en AWL el programa equivalente a este esquema KOP.' : 'Dibuja en KOP el esquema equivalente a este AWL (usa el editor gráfico de la derecha).'}</p>
          {dir === 'aAWL'
            ? (model ? <KopStatic segs={model} /> : <pre className="kop-ascii">{e.kop_ascii}</pre>)
            : <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>}
          <Markdown text={md.replace(/```(text|awl)\n[\s\S]*?```/g, '')} />
          {(res || show) ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Solución</h3>
              {dir === 'aKOP' && model && <KopStatic segs={model} />}
              {dir === 'aAWL' && <div className="card" style={{ padding: 10 }}><AwlHighlight code={e.awl ?? ''} /></div>}
              <Markdown text={solucion(e).replace(/```(text|awl)\n[\s\S]*?```/g, '')} />
            </div>
          ) : <button className="btn" style={{ marginTop: 14 }} onClick={() => setShow(true)}>Ver la solución sin comprobar</button>}
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
          <p className="faint" style={{ fontSize: 12 }}>Programa en AWL o en KOP (añade segmentos KOP con el botón de abajo). «Comprobar» pasa las pruebas, compara tu programa con la solución y da avisos.</p>
          <TestsList e={e} />
          {(res || show) ? (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>Solución propuesta</h3>
              <Markdown text={sol} />
              {model && <><h4 style={{ margin: '12px 0 6px' }}>En KOP</h4><KopStatic segs={model} /></>}
            </div>
          ) : <button className="btn" style={{ marginTop: 14 }} onClick={() => setShow(true)}>Ver la solución</button>}
        </>
      )} />
  );
}
