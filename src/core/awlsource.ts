// Fuentes AWL en texto (ORGANIZATION_BLOCK / FUNCTION … END_…): importar y exportar
import { normBlockName, splitLines } from './compiler';
import { newSegId, type Bloque, type Programa, type Segmento } from './program';
import { kopToAwlText } from '../kop/compile';
import { translateAwl } from './translate';

export function exportAwlSource(p: Programa): string {
  const out: string[] = [];
  for (const b of p.bloques) {
    const name = normBlockName(b.nombre);
    const isOb = name.startsWith('OB');
    const num = name.replace(/^\D+/, '');
    out.push(isOb ? `ORGANIZATION_BLOCK OB ${num}` : `FUNCTION FC ${num} : VOID`);
    out.push(`TITLE =${b.comentario ? b.comentario : ''}`);
    out.push('VERSION : 0.1', '');
    if (isOb) out.push('VAR_TEMP', '  OB_INFO : ARRAY [0 .. 19] OF BYTE ;   // información de arranque del OB', 'END_VAR');
    out.push('BEGIN');
    for (const s of b.segmentos) {
      out.push('NETWORK');
      const t = s.lang === 'KOP' ? s.kop.titulo : s.titulo;
      const c = s.lang === 'KOP' ? s.kop.comentario : s.comentario;
      out.push(`TITLE =${t ?? ''}`);
      if (c) for (const l of c.split('\n')) out.push(`//${l}`);
      let body = s.lang === 'AWL' ? s.awl : kopToAwlText(s.kop, name);
      if (s.lang === 'KOP' && p.nemotecnia === 'en') body = translateAwl(body, 'en');
      for (const l of splitLines(body)) {
        const tr = l.replace(/\s+$/, '');
        if (!tr.trim()) continue;
        const code = tr.replace(/\/\/.*$/, '').trimEnd();
        out.push(code && !code.endsWith(';') && !/:\s*$/.test(code) ? tr.replace(code, `${code};`) : tr);
      }
      out.push('');
    }
    out.push(isOb ? 'END_ORGANIZATION_BLOCK' : 'END_FUNCTION', '');
  }
  return out.join('\n');
}

/** Importa una fuente AWL (bloques OB/FC con NETWORK). Si no hay cabeceras, todo va al OB1. */
export function importAwlSource(text: string): Programa {
  const lines = splitLines(text);
  const bloques: Bloque[] = [];
  let cur: Bloque | null = null;
  let seg: { titulo?: string; comentario: string[]; lines: string[] } | null = null;
  let inBody = false;
  let inVar = false;
  const closeSeg = () => {
    if (cur && seg) {
      const s: Segmento = { lang: 'AWL', id: newSegId(), titulo: seg.titulo, comentario: seg.comentario.join('\n') || undefined, awl: seg.lines.join('\n').replace(/^\n+|\n+$/g, '') };
      cur.segmentos.push(s);
    }
    seg = null;
  };
  const closeBlock = () => {
    closeSeg();
    if (cur) {
      if (!cur.segmentos.length) cur.segmentos.push({ lang: 'AWL', id: newSegId(), awl: '' });
      bloques.push(cur);
    }
    cur = null;
    inBody = false;
  };
  let any = false;
  for (const raw of lines) {
    const l = raw.trim();
    const m = /^(ORGANIZATION_BLOCK|FUNCTION)\s+(OB|FC)\s*(\d+)/i.exec(l);
    if (m) {
      closeBlock();
      any = true;
      cur = { nombre: `${m[2].toUpperCase()}${m[3]}`, segmentos: [] };
      continue;
    }
    if (/^(FUNCTION_BLOCK|DATA_BLOCK|TYPE)\b/i.test(l)) { closeBlock(); continue; }
    if (/^END_(ORGANIZATION_BLOCK|FUNCTION)\b/i.test(l)) { closeBlock(); continue; }
    if (!cur) continue;
    if (/^VAR(_TEMP|_INPUT|_OUTPUT|_IN_OUT)?\b/i.test(l)) { inVar = true; continue; }
    if (/^END_VAR\b/i.test(l)) { inVar = false; continue; }
    if (inVar) continue;
    if (/^BEGIN\b/i.test(l)) { inBody = true; continue; }
    if (!inBody) {
      const t = /^TITLE\s*=(.*)$/i.exec(l);
      if (t) cur.comentario = t[1].trim() || undefined;
      continue;
    }
    if (/^NETWORK\b/i.test(l)) { closeSeg(); seg = { comentario: [], lines: [] }; continue; }
    if (!seg) seg = { comentario: [], lines: [] };
    const t = /^TITLE\s*=(.*)$/i.exec(l);
    if (t && seg.titulo === undefined && !seg.lines.length) { seg.titulo = t[1].trim(); continue; }
    if (l.startsWith('//') && !seg.lines.some((x) => x.trim())) { seg.comentario.push(l.slice(2).trim()); continue; }
    seg.lines.push(raw.replace(/;(\s*(\/\/.*)?)$/, '$1'));
  }
  closeBlock();
  if (!any) {
    return { nemotecnia: 'de', simbolos: [], bloques: [{ nombre: 'OB1', segmentos: [{ lang: 'AWL', id: newSegId(), awl: text }] }] };
  }
  if (!bloques.some((b) => normBlockName(b.nombre) === 'OB1')) bloques.unshift({ nombre: 'OB1', segmentos: [{ lang: 'AWL', id: newSegId(), awl: '' }] });
  const looksEn = bloques.some((b) => b.segmentos.some((s) => s.lang === 'AWL' && /^\s*(A|AN|JC|JU)\s/m.test(s.awl)));
  return { nemotecnia: looksEn ? 'en' : 'de', simbolos: [], bloques };
}
