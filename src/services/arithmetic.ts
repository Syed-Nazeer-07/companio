// Small, bounded arithmetic parser; no eval/Function or arbitrary JavaScript.
// Grammar: expression := term (('+'|'-') term)*
// term := unary (('*'|'/') unary)*
// unary := ('+'|'-') unary | '(' expression ')' | number
export function evaluateArithmetic(expression: string): number | null {
  if (typeof expression !== 'string' || expression.length > 160 ||
      !/^[\d\s.+\-*/()]+$/.test(expression)) return null;
  const source = expression.replace(/\s+/g, '');
  let i = 0, operations = 0;
  const count = () => { if (++operations > 100) throw Error('Too many operations'); };
  const finite = (n: number) => {
    if (!Number.isFinite(n) || Math.abs(n) > 1e15) throw Error('Out of numeric range');
    return n;
  };
  const number = (): number => {
    const match = source.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
    if (!match) throw Error('Expected a number');
    i += match[0].length;
    return finite(Number(match[0]));
  };
  const unary = (depth: number): number => {
    if (depth > 16) throw Error('Expression too deeply nested');
    if (source[i] === '+' || source[i] === '-') {
      const sign = source[i++];
      count();
      return finite((sign === '-' ? -1 : 1) * unary(depth + 1));
    }
    if (source[i] === '(') {
      i++; count();
      const value = expressionParser(depth + 1);
      if (source[i++] !== ')') throw Error('Expected closing parenthesis');
      return value;
    }
    return number();
  };
  const term = (depth: number): number => {
    let result = unary(depth);
    while (source[i] === '*' || source[i] === '/') {
      const operator = source[i++];
      const rhs = unary(depth);
      count();
      if (operator === '/' && rhs === 0) throw Error('Division by zero');
      result = finite(operator === '*' ? result * rhs : result / rhs);
    }
    return result;
  };
  const expressionParser = (depth: number): number => {
    let result = term(depth);
    while (source[i] === '+' || source[i] === '-') {
      const operator = source[i++];
      const rhs = term(depth);
      count();
      result = finite(operator === '+' ? result + rhs : result - rhs);
    }
    return result;
  };
  try {
    const result = expressionParser(0);
    return i === source.length ? finite(result) : null;
  } catch { return null; }
}
