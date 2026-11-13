// Temas (barra de la izquierda ▸ Aplicación ▸ Temas). Dos pestañas:
// - Básicos: paletas de colores. Se aplican al pulsar: la propia app es la vista previa.
// - Avanzado: papeles de fondo (motivos que se repiten, como un papel de regalo) y una imagen propia.
//   Al pulsar uno se ve en la vista previa; «Aplicar a la app» lo pone (también con doble clic).
import { useState } from 'react';
import { useSettings } from '../../store/settings';
import { T } from '../../i18n';
import { go } from '../router';
import { Icon } from '../common/Icon';
import { toast } from '../common/ui';
import { PALETA, PALETAS, paletaDe, type Theme } from '../temas/paletas';
import { GRUPOS_PAPEL, INTENSIDAD, TAMANO, limitar, papelesDe, type PapelId } from '../temas/papeles';
import { elegirImagen, useImagenPropia } from '../temas/imagenPropia';
import { usePaletaVisible, useSistemaOscuro } from '../temas/CapaPapel';
import { MiniApp, MuestraPapel } from '../temas/VistaPrevia';

type Pestana = 'basicos' | 'avanzado';

export function TemasScreen({ pestana }: { pestana?: string }) {
  const tab: Pestana = pestana === 'avanzado' ? 'avanzado' : 'basicos';
  return (
    <div className="page temas-pagina"><div className="page-narrow" style={{ maxWidth: 1040 }}>
      <h1>{T.temas.titulo}</h1>
      <p className="lead">{T.temas.lead}</p>
      <div className="btn-group temas-modo" role="tablist" aria-label={T.temas.modos}>
        {(['basicos', 'avanzado'] as const).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`btn${tab === id ? ' active' : ''}`} onClick={() => go(id === 'basicos' ? 'temas' : 'temas/avanzado')}>
            <Icon name={id === 'basicos' ? 'paleta' : 'papel'} size={14} />{T.temas[id]}
          </button>
        ))}
      </div>
      {tab === 'basicos' ? <Basicos /> : <Avanzado />}
    </div></div>
  );
}

const nombrePapel = (id: PapelId) => (id === '' ? T.temas.sinPapel : id === 'propia' ? T.temas.propia : T.temas.papeles[id]);

function Basicos() {
  const theme = useSettings((s) => s.theme);
  const papel = useSettings((s) => s.papel);
  const intensidad = useSettings((s) => s.papelIntensidad);
  const tamano = useSettings((s) => s.papelTamano);
  const img = useImagenPropia((s) => s.img);
  const sistemaOscuro = useSistemaOscuro();
  // las miniaturas llevan el papel que está puesto, para ver cómo queda con cada paleta
  const mini = { papel, intensidad: limitar(intensidad, INTENSIDAD), tamano: limitar(tamano, TAMANO), img };
  const tarjeta = (id: Theme) => {
    const activo = theme === id;
    const { n, d } = T.temas.paletas[id];
    return (
      <button key={id} type="button" className={`tema-card${activo ? ' activo' : ''}`} aria-pressed={activo} onClick={() => useSettings.getState().set({ theme: id })}>
        <span className="tema-mini">
          {id === 'system'
            ? <><MiniApp paleta={PALETA.dark} {...mini} /><MiniApp paleta={PALETA.light} {...mini} className="mitad" /></>
            : <MiniApp paleta={paletaDe(id, sistemaOscuro)} {...mini} />}
        </span>
        <span className="row">
          <b className="grow" style={id !== 'system' && PALETA[id].terminal ? { fontFamily: 'var(--mono)' } : undefined}>{n}</b>
          {activo
            ? <span className="badge accent">{T.temas.enUso}</span>
            : id !== 'system' && <span className="tema-muestras" aria-hidden="true">{[PALETA[id].c.accent, PALETA[id].motivo[1], PALETA[id].motivo[2]].map((col, i) => <i key={i} style={{ background: col }} />)}</span>}
        </span>
        <span className="desc">{d}</span>
      </button>
    );
  };
  return (
    <>
      <h2>{T.temas.predeterminados}</h2>
      <div className="temas-grid">{(['system', 'dark', 'light'] as const).map(tarjeta)}</div>
      {(['dark', 'light'] as const).map((base) => {
        const ids = PALETAS.filter((p) => p.base === base && p.id !== 'dark' && p.id !== 'light').map((p) => p.id);
        return (
          <section key={base}>
            <h2>{base === 'dark' ? T.temas.coloresOscuros : T.temas.coloresClaros}<span className="cuenta">{ids.length}</span></h2>
            <div className="temas-grid">{ids.map(tarjeta)}</div>
          </section>
        );
      })}
    </>
  );
}

function Avanzado() {
  const s = useSettings();
  const paleta = usePaletaVisible();
  const img = useImagenPropia((st) => st.img);
  const [visto, setVisto] = useState<PapelId>(s.papel || 'contactos');
  const [intensidad, setIntensidad] = useState(limitar(s.papelIntensidad, INTENSIDAD));
  const [tamano, setTamano] = useState(limitar(s.papelTamano, TAMANO));
  const sinImagen = visto === 'propia' && !img;
  const aplicado = visto === '' ? !s.papel : s.papel === visto && s.papelIntensidad === intensidad && s.papelTamano === tamano;

  const aplicar = (id: PapelId = visto) => {
    if (id === 'propia' && !useImagenPropia.getState().img) return;
    s.set(id === '' ? { papel: '' } : { papel: id, papelIntensidad: intensidad, papelTamano: tamano });
  };
  const elegir = async () => {
    const r = await elegirImagen();
    if (r === null) return;
    if (r === 'error') return toast(T.temas.imagenError);
    if (!useImagenPropia.getState().poner(r)) return toast(T.temas.imagenGrande);
    setVisto('propia');
  };
  const borrarImagen = () => {
    if (s.papel === 'propia') s.set({ papel: '' });
    useImagenPropia.getState().quitar();
  };
  const ver = (id: PapelId) => {
    setVisto(id);
    if (id === 'propia' && !img) void elegir();
  };

  const tarjeta = (id: PapelId) => {
    const enUso = s.papel === id && (id !== 'propia' || !!img);
    return (
      <button key={id || 'ninguno'} type="button" className={`papel-card${visto === id ? ' visto' : ''}`} aria-pressed={visto === id} title={T.temas.dobleClic}
        onClick={() => ver(id)} onDoubleClick={() => aplicar(id)}>
        <span className="muestra"><MuestraPapel paleta={paleta} papel={id} img={img} /></span>
        <span className="nombre"><span className="grow">{nombrePapel(id)}</span>{enUso && <Icon name="check" size={13} className="en-uso" title={T.temas.enUso} />}</span>
      </button>
    );
  };

  return (
    <>
      <div className="card papel-vista">
        <div>
          <div className="tema-mini grande">
            <MiniApp paleta={paleta} papel={visto} intensidad={intensidad} tamano={tamano} img={img} titulo={T.temas.vistaPreviaDe(nombrePapel(visto))} />
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>{T.temas.vistaNota}</div>
        </div>
        <div className="col papel-ctrl">
          <div>
            <div className="papel-etiqueta">{T.temas.vistaPrevia}</div>
            <h3 className="papel-nombre">{nombrePapel(visto)}</h3>
          </div>
          <label className="row">
            <span className="papel-campo">{T.temas.intensidad}</span>
            <input type="range" min={INTENSIDAD.min} max={INTENSIDAD.max} step={0.05} value={intensidad} disabled={visto === ''} onChange={(e) => setIntensidad(+e.target.value)} />
            <span className="mono papel-valor">{Math.round(intensidad * 100)} %</span>
          </label>
          <label className="row">
            <span className="papel-campo">{T.temas.tamano}</span>
            <input type="range" min={TAMANO.min} max={TAMANO.max} step={0.1} value={tamano} disabled={visto === ''} onChange={(e) => setTamano(+e.target.value)} />
            <span className="mono papel-valor">{Math.round(tamano * 100)} %</span>
          </label>
          {visto === 'propia' && (
            <div className="col" style={{ gap: 6 }}>
              <div className="faint" style={{ fontSize: 12 }}>{T.temas.imagenNota}</div>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <button className="btn small" onClick={() => void elegir()}><Icon name="upload" size={13} />{img ? T.temas.cambiarImagen : T.temas.elegirImagen}</button>
                {img && <button className="btn small ghost danger" onClick={borrarImagen}><Icon name="trash" size={13} />{T.temas.borrarImagen}</button>}
              </div>
              {img && <div className="faint papel-fichero" title={img.nombre}>{img.nombre} · {img.w}×{img.h}</div>}
            </div>
          )}
          <div className="row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            <button className="btn primary" disabled={aplicado || sinImagen} onClick={() => aplicar()}>
              <Icon name="check" size={14} />{aplicado ? T.temas.aplicado : T.temas.aplicar}
            </button>
            <button className="btn" disabled={!s.papel} onClick={() => s.set({ papel: '' })}>{T.temas.quitar}</button>
          </div>
          <div className="faint" style={{ fontSize: 12 }}>{s.papel && (s.papel !== 'propia' || img) ? T.temas.enUsoPapel(nombrePapel(s.papel)) : T.temas.ningunPapel}</div>
        </div>
      </div>
      {GRUPOS_PAPEL.map((g) => (
        <section key={g}>
          <h2>{T.temas.grupos[g]}<span className="cuenta">{papelesDe(g).length}</span></h2>
          <div className="papeles-grid">{papelesDe(g).map((p) => tarjeta(p.id))}</div>
        </section>
      ))}
      <h2>{T.temas.grupos.otros}</h2>
      <div className="papeles-grid">{tarjeta('propia')}{tarjeta('')}</div>
    </>
  );
}
