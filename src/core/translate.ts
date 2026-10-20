// Conversión de texto AWL entre nemotécnica alemana e inglesa (IEC)
import { DE2EN, EN2DE } from './mnemonics';
import { stripComment, splitLines } from './compiler';
import { translateEnOperand } from './operands';

const DE_OP_RULES: [RegExp, string][] = [
  [/^PEB/i, 'PIB'], [/^PEW/i, 'PIW'], [/^PED/i, 'PID'],
  [/^PAB/i, 'PQB'], [/^PAW/i, 'PQW'], [/^PAD/i, 'PQD'],
  [/^EB(?=\s*[\d[])/i, 'IB'], [/^EW(?=\s*[\d[])/i, 'IW'], [/^ED(?=\s*[\d[])/i, 'ID'],
  [/^AB(?=\s*[\d[])/i, 'QB'], [/^AW(?=\s*[\d[])/i, 'QW'], [/^AD(?=\s*[\d[])/i, 'QD'],
  [/^E(?=\s*[\d[])/i, 'I'], [/^A(?=\s*[\d[])/i, 'Q'], [/^Z(?=\s*\d+$)/i, 'C'], [/^BIE$/i, 'BR'],
];

export function operandDeToEn(op: string): string {
  const s = op.trim();
  if (s.startsWith('"')) return op;
  for (const [re, rep] of DE_OP_RULES) if (re.test(s)) return s.replace(re, rep);
  return op;
}

export function operandEnToDe(op: string): string {
  const s = op.trim();
  if (s.startsWith('"')) return op;
  return translateEnOperand(s);
}

const LINE_RE = /^(\s*)((?:[A-Za-z_][A-Za-z0-9_]{0,3})\s*:(?!=)\s*)?(\S+)(\s*)(.*)$/;

/** Traduce una línea conservando la meta, la sangría y el comentario. */
export function translateLine(line: string, to: 'de' | 'en'): string {
  const code = stripComment(line);
  const comment = line.slice(code.length);
  const m = LINE_RE.exec(code);
  if (!m) return line;
  const [, ind, label = '', mnRaw, sp, restRaw] = m;
  let mn = mnRaw;
  let rest = restRaw;
  let paren = '';
  // «U (» → tratar el paréntesis como parte del nemónico
  if (rest.startsWith('(') && /^(U|UN|O|ON|X|XN|A|AN)$/i.test(mn)) {
    paren = '(';
    rest = rest.slice(1);
  }
  const key = (mn + paren).toUpperCase();
  const table = to === 'en' ? DE2EN : EN2DE;
  const tr = table[key];
  const keepCase = (orig: string, t: string) => (orig === orig.toLowerCase() ? t.toLowerCase() : t);
  const mnFinal = tr ? keepCase(mn, paren ? tr.slice(0, -1) : tr) : mn;
  const mnOut = tr ?? key;
  // conserva la columna del operando
  const sp2 = sp.length > 0 && !paren ? ' '.repeat(Math.max(1, mn.length + sp.length - mnFinal.length)) : sp;
  const trailing = rest.match(/\s*$/)![0];
  const operand = rest.slice(0, rest.length - trailing.length);
  const isJump = /^(SP|J|LOOP)/i.test(mnOut);
  const opOut = operand && !isJump ? (to === 'en' ? operandDeToEn(operand) : operandEnToDe(operand)) : operand;
  const body = paren ? `${mnFinal}${sp2}(${opOut}` : `${mnFinal}${sp2}${opOut}`;
  return `${ind}${label}${body}${trailing}${comment}`;
}

export function translateAwl(text: string, to: 'de' | 'en'): string {
  return splitLines(text).map((l) => translateLine(l, to)).join('\n');
}

/** Nemónico y operando para mostrar en la nemotécnica elegida (KOP y paneles). */
export function displayOperand(op: string, lang: 'de' | 'en'): string {
  return lang === 'en' ? operandDeToEn(op) : op;
}
export function displayMnemonic(mn: string, lang: 'de' | 'en'): string {
  return lang === 'en' ? DE2EN[mn] ?? mn : mn;
}
