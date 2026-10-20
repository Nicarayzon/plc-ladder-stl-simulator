// Resaltado estático de AWL (bloques de la teoría, AWL generado)
import { Fragment } from 'react';

const MN = /^(\s*)((?:[A-Za-z_][A-Za-z0-9_]{0,3}\s*:(?!=))?)(\s*)(\S*)(.*)$/;

export function highlightLine(line: string, key: number) {
  const ci = line.indexOf('//');
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const com = ci >= 0 ? line.slice(ci) : '';
  const m = MN.exec(code);
  if (!m) return <Fragment key={key}>{line}{'\n'}</Fragment>;
  const [, a, label, b, mn, rest] = m;
  const restParts = rest.split(/("[^"]*"|[A-Za-z0-9]*#[^\s;]*|\b\d+(?:\.\d+)?\b)/g);
  return (
    <Fragment key={key}>
      {a}{label && <span className="l">{label}</span>}{b}{mn && <span className="k">{mn}</span>}
      {restParts.map((p, i) => (i % 2 ? <span key={i} className="n">{p}</span> : <span key={i} className="o">{p}</span>))}
      {com && <span className="c">{com}</span>}{'\n'}
    </Fragment>
  );
}

export function AwlHighlight({ code, className }: { code: string; className?: string }) {
  return (
    <pre className={`awl-hl ${className ?? ''}`} style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre' }}>
      <code>{code.replace(/\n$/, '').split('\n').map((l, i) => highlightLine(l, i))}</code>
    </pre>
  );
}
