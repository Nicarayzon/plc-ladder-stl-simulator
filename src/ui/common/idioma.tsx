// Elegir el idioma de la app (Ajustes ▸ Idioma) y el aviso de la primera vez.
// El idioma se aplica al volver a abrir la app: el aviso de reinicio sale ya en el idioma elegido.
import { useEffect, useState } from 'react';
import { CLAVE_IDIOMA_WEB, IDIOMAS, idioma, puente, T, textosDe, type Idioma } from '../../i18n';
import { useSettings } from '../../store/settings';
import { go } from '../router';
import { Desplegable, Modal } from './ui';

/** Nemotecnia que va con cada idioma: inglesa con el inglés, alemana con el resto */
const nemotecniaDe = (i: Idioma) => (i === 'en' ? 'en' : 'de');

/** El idioma elegido en esta sesión, que se aplica al reiniciar */
let pendiente: Idioma | null = null;

async function guardar(i: Idioma): Promise<void> {
  if (puente) await puente.guardarIdioma(i);
  else {
    try { localStorage.setItem(CLAVE_IDIOMA_WEB, i); } catch { /* sin almacenamiento */ }
  }
  pendiente = i === idioma ? null : i;
}

function reiniciar() {
  if (puente) puente.reiniciar();
  else location.reload();
}

function AvisoReinicio({ nuevo, onClose }: { nuevo: Idioma; onClose: (guardado: boolean) => void }) {
  const t = textosDe(nuevo);
  const nemotecnia = useSettings((s) => s.nemotecnia);
  const sugerida = nemotecniaDe(nuevo);
  const [cambiarNem, setCambiarNem] = useState(true);
  const confirmar = async (ahora: boolean) => {
    if (sugerida !== nemotecnia && cambiarNem) useSettings.getState().set({ nemotecnia: sugerida });
    await guardar(nuevo);
    if (ahora) reiniciar();
    else onClose(true);
  };
  return (
    <Modal title={t.idioma.reinicioTitulo} onClose={() => onClose(false)} width={460}
      footer={<>
        <button className="btn" onClick={() => confirmar(false)}>{t.idioma.masTarde}</button>
        <button className="btn primary" autoFocus onClick={() => confirmar(true)}>{t.idioma.reiniciarAhora}</button>
      </>}>
      <p style={{ marginTop: 0 }}>{t.idioma.reinicioTexto(t.idioma.nombres[nuevo])}</p>
      {!puente && <p className="faint">{t.idioma.reinicioSinApp}</p>}
      {sugerida !== nemotecnia && (
        <label className="check">
          <input type="checkbox" checked={cambiarNem} onChange={(e) => setCambiarNem(e.target.checked)} />
          {sugerida === 'en' ? t.idioma.nemotecniaEn : t.idioma.nemotecniaDe}
        </label>
      )}
    </Modal>
  );
}

/** Fila «Idioma» de Ajustes */
export function SelectorIdioma() {
  const [elegido, setElegido] = useState<Idioma>(pendiente ?? idioma);
  const [preguntar, setPreguntar] = useState<Idioma | null>(null);
  const nombre = (i: Idioma) => IDIOMAS.find((x) => x.id === i)?.nombre ?? i;
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row">{T.idioma.titulo}
        <Desplegable value={elegido} options={IDIOMAS.map((x) => ({ value: x.id, label: x.nombre }))}
          onChange={(i) => { if (i !== elegido) setPreguntar(i); }} aria-label={T.idioma.titulo} />
      </div>
      {elegido !== idioma && <div className="faint" style={{ fontSize: 12 }}>{textosDe(elegido).idioma.seAplicaAlReiniciar(nombre(elegido))}</div>}
      {preguntar && <AvisoReinicio nuevo={preguntar} onClose={(guardado) => { if (guardado) setElegido(preguntar); setPreguntar(null); }} />}
    </div>
  );
}

/** Primera vez que se abre una versión con idiomas: dice que se puede cambiar en Ajustes (en el idioma de la app) */
export function BienvenidaIdioma() {
  const otros = IDIOMAS.filter((x) => x.id !== idioma).map((x) => T.idioma.nombres[x.id]);
  const [abierta, setAbierta] = useState(false);
  useEffect(() => { if (puente?.bienvenida && otros.length > 0) setAbierta(true); }, []);
  if (!abierta) return null;
  return (
    <Modal title={T.idioma.bienvenidaTitulo} onClose={() => setAbierta(false)} width={440}
      footer={<>
        <button className="btn" onClick={() => { setAbierta(false); go('ajustes'); }}>{T.idioma.irAAjustes}</button>
        <button className="btn primary" autoFocus onClick={() => setAbierta(false)}>{T.comun.aceptar}</button>
      </>}>
      <p style={{ margin: 0 }}>{T.idioma.bienvenidaTexto(T.idioma.lista(otros))}</p>
    </Modal>
  );
}
