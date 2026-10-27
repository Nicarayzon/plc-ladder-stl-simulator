// Diálogo para pedir un texto (window.prompt no existe en Electron)
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Modal } from './ui';
import { T } from '../../i18n';

interface AskOpts { title: string; label?: string; value?: string; placeholder?: string; ok?: string; validate?: (v: string) => string | null }

function AskModal({ o, done }: { o: AskOpts; done: (v: string | null) => void }) {
  const [v, setV] = useState(o.value ?? '');
  const err = o.validate ? o.validate(v) : null;
  const submit = () => { if (!err && v.trim()) done(v.trim()); };
  return (
    <Modal title={o.title} onClose={() => done(null)} width={420}
      footer={<><button className="btn" onClick={() => done(null)}>{T.comun.cancelar}</button><button className="btn primary" disabled={!!err || !v.trim()} onClick={submit}>{o.ok ?? T.comun.aceptar}</button></>}>
      {o.label && <div style={{ marginBottom: 6 }}>{o.label}</div>}
      <input className="input" style={{ width: '100%' }} autoFocus value={v} placeholder={o.placeholder} onChange={(e) => setV(e.target.value)}
        onFocus={(e) => e.target.select()} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} aria-label={o.label ?? o.title} />
      {err && v.trim() && <div className="err-text" style={{ fontSize: 12, marginTop: 6 }}>{err}</div>}
    </Modal>
  );
}

/** Pide un texto al usuario. Devuelve null si cancela. */
export function askText(o: AskOpts): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: string | null) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<AskModal o={o} done={done} />);
  });
}
