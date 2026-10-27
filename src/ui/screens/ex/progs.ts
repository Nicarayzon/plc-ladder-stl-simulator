import type { Programa } from '../../../core/program';
import { programFromAwl, newSegId } from '../../../core/program';
import type { SegmentoKOP } from '../../../kop/model';
import { kopModel } from '../../../content/kop/models';
import { newKopSegment } from '../../workbench/programOps';
import type { Ejercicio } from '../../../content/banco';
import { translateAwl } from '../../../core/translate';
import { getSettings } from '../../../store/settings';
import { T } from '../../../i18n';

/** Título o comentario de un modelo KOP en el idioma de la app */
const textoKop = (t: string | undefined) => (t ? T.contenido.textosKop[t] ?? t : t);

export function programFromKop(segs: SegmentoKOP[]): Programa {
  return { nemotecnia: getSettings().nemotecnia, simbolos: [], bloques: [{ nombre: 'OB1', segmentos: segs.map((kop) => ({ lang: 'KOP' as const, kop: { ...kop, titulo: textoKop(kop.titulo), comentario: textoKop(kop.comentario) } })) }] };
}

export function programFromEx(e: Ejercicio): Programa {
  const p = programFromAwl(e.awl ?? '', e.id);
  if (getSettings().nemotecnia === 'en') {
    p.nemotecnia = 'en';
    for (const b of p.bloques) for (const s of b.segmentos) if (s.lang === 'AWL') s.awl = translateAwl(s.awl, 'en');
  }
  return p;
}

export function exampleProgram(e: Ejercicio, lang: 'KOP' | 'AWL'): Programa {
  const m = lang === 'KOP' ? kopModel(e.id) : null;
  return m ? programFromKop(m) : programFromEx(e);
}

export function emptyAwlProgram(comment = ''): Programa {
  return { nemotecnia: getSettings().nemotecnia, simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'AWL', id: newSegId(), titulo: '', awl: comment }] }] };
}

export function emptyKopProgram(): Programa {
  return { nemotecnia: getSettings().nemotecnia, simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'KOP', kop: newKopSegment() }] }] };
}
