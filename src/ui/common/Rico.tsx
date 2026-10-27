// Texto del diccionario con **negritas** y `código`: así una frase con partes destacadas se traduce entera
import { Fragment } from 'react';

export function Rico({ t }: { t: string }) {
  return (
    <>
      {t.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((p, i) => (
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b>
          : p.startsWith('`') && p.endsWith('`') && p.length > 2 ? <code key={i}>{p.slice(1, -1)}</code>
            : <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}
