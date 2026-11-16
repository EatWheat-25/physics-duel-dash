/**
 * Question template engine
 *
 * A template is a question with its numbers pulled out as variables. This
 * engine picks values for the variables, computes every answer and every wrong
 * option from formulas, and fills in the text. No AI is involved at this
 * stage, so a template that has been checked once produces correct questions
 * every time.
 *
 * It has no dependencies (plain TypeScript, no Node APIs), so the same file
 * can later run inside the game server.
 */

export interface TemplateVariable {
  name: string;
  min: number;
  max: number;
  /** Values are picked from min, min + step, ... up to max. */
  step: number;
}

export interface TemplateStep {
  title: string;
  /** Text with {{name}} or {{name|3}} placeholders (3 = significant figures). */
  prompt: string;
  /** Formula for the correct answer, in the unit shown. */
  answer_expr: string;
  /** LaTeX for the unit, e.g. "\\mathrm{N}" or "\\mathrm{m\\,s^{-2}}". Empty for a pure number. */
  unit_latex: string;
  sig_figs: number;
  /** Three wrong answers, each from a specific mistake. */
  distractors: { expr: string; mistake: string }[];
  explanation: string;
  marks: number;
  topics: string[];
  archetype: string;
}

export interface QuestionTemplate {
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
  variables: TemplateVariable[];
  /** Named intermediate values, evaluated in order. */
  derived: { name: string; expr: string }[];
  /** Conditions every version must satisfy, e.g. "tension > 0". */
  constraints: string[];
  /** The single main question the player sees first and works out in full. */
  stem: string;
  /** Total working time for the main question, in seconds. Split evenly across the steps. */
  main_timer_seconds: number;
  /** The mark-scheme route to the answer: intermediate results in order, the final answer last. */
  steps: TemplateStep[];
  needs_figure: boolean;
  figure_description: string;
  /** matplotlib code that reads its numbers from a dict called PARAMS. Empty if no figure. */
  figure_script: string;
}

/** One step, in the same shape as a step in the game's questions table. */
export interface InstanceStep {
  index: number;
  type: 'mcq';
  title: string;
  prompt: string;
  options: string[];
  correctAnswer: number;
  marks: number;
  timeLimitSeconds: number;
  explanation: string;
}

export interface QuestionInstance {
  stem: string;
  main_question_timer_seconds: number;
  total_marks: number;
  steps: InstanceStep[];
  /** Every variable, derived value and step answer (ans1, ans2, ...) for this version. */
  values: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Formula evaluator: numbers, names, + - * / ^, brackets, comparisons, and a
// fixed set of functions. Nothing else can be expressed, so a formula cannot
// run arbitrary code.
// ---------------------------------------------------------------------------

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  exp: Math.exp,
  ln: Math.log,
  log10: Math.log10,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  /** Trig in degrees, the usual case in exam questions. */
  sind: (x) => Math.sin((x * Math.PI) / 180),
  cosd: (x) => Math.cos((x * Math.PI) / 180),
  tand: (x) => Math.tan((x * Math.PI) / 180),
  asind: (x) => (Math.asin(x) * 180) / Math.PI,
  acosd: (x) => (Math.acos(x) * 180) / Math.PI,
  atand: (x) => (Math.atan(x) * 180) / Math.PI,
  min: Math.min,
  max: Math.max,
  round: (x, places = 0) => Math.round(x * 10 ** places) / 10 ** places,
};
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Token = { t: 'num'; v: number } | { t: 'name'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const re = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(<=|>=|\*\*|[-+*/^(),<>]))/y;
  let i = 0;
  while (i < src.length) {
    if (/^\s*$/.test(src.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(src);
    if (!m) throw new Error(`cannot read formula "${src}" at position ${i}`);
    if (m[1] !== undefined) out.push({ t: 'num', v: Number(m[1]) });
    else if (m[2] !== undefined) out.push({ t: 'name', v: m[2] });
    else out.push({ t: 'op', v: m[3] === '**' ? '^' : m[3] });
    i = re.lastIndex;
  }
  return out;
}

export function evaluate(src: string, scope: Record<string, number>): number {
  const tokens = tokenize(src);
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (v: string) => peek()?.t === 'op' && peek().v === v;
  const take = (v: string) => {
    if (!isOp(v)) throw new Error(`expected "${v}" in formula "${src}"`);
    p++;
  };

  function comparison(): number {
    let left = sum();
    while (peek()?.t === 'op' && ['<', '>', '<=', '>='].includes(peek().v as string)) {
      const op = (tokens[p++] as { v: string }).v;
      const right = sum();
      left = (op === '<' ? left < right : op === '>' ? left > right : op === '<=' ? left <= right : left >= right) ? 1 : 0;
    }
    return left;
  }
  function sum(): number {
    let left = product();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[p++] as { v: string }).v;
      const right = product();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }
  function product(): number {
    let left = unary();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[p++] as { v: string }).v;
      const right = unary();
      left = op === '*' ? left * right : left / right;
    }
    return left;
  }
  function unary(): number {
    if (isOp('-')) {
      p++;
      return -unary();
    }
    if (isOp('+')) {
      p++;
      return unary();
    }
    return power();
  }
  function power(): number {
    const base = atom();
    if (isOp('^')) {
      p++;
      return Math.pow(base, unary()); // right-associative
    }
    return base;
  }
  function atom(): number {
    const tok = tokens[p++];
    if (!tok) throw new Error(`formula "${src}" ends unexpectedly`);
    if (tok.t === 'num') return tok.v;
    if (tok.t === 'name') {
      if (isOp('(')) {
        const fn = FUNCTIONS[tok.v];
        if (!fn) throw new Error(`unknown function "${tok.v}" in formula "${src}"`);
        p++;
        const args: number[] = [];
        if (!isOp(')')) {
          args.push(comparison());
          while (isOp(',')) {
            p++;
            args.push(comparison());
          }
        }
        take(')');
        return fn(...args);
      }
      if (Object.prototype.hasOwnProperty.call(scope, tok.v)) return scope[tok.v];
      if (Object.prototype.hasOwnProperty.call(CONSTANTS, tok.v)) return CONSTANTS[tok.v];
      throw new Error(`unknown name "${tok.v}" in formula "${src}"`);
    }
    if (tok.v === '(') {
      const v = comparison();
      take(')');
      return v;
    }
    throw new Error(`unexpected "${tok.v}" in formula "${src}"`);
  }

  const value = comparison();
  if (p < tokens.length) throw new Error(`unexpected "${(tokens[p] as { v: unknown }).v}" in formula "${src}"`);
  return value;
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/** Round to significant figures. */
export function roundSig(x: number, sig: number): number {
  if (x === 0 || !Number.isFinite(x)) return x;
  return Number(x.toPrecision(sig));
}

/** A number as LaTeX (without $ signs), using standard form for very large or small values. */
export function formatNumber(x: number, sig?: number): string {
  if (!Number.isFinite(x)) return '?';
  if (x === 0) return '0';
  const abs = Math.abs(x);
  if (sig === undefined) {
    // Natural form: drop floating-point noise, keep the digits that are there.
    const clean = Number(x.toPrecision(10));
    if (abs >= 1e5 || abs < 1e-3) return formatNumber(clean, Math.min(6, String(clean.toExponential()).split('e')[0].replace(/[-.]/g, '').length));
    return String(clean);
  }
  if (abs >= 1e4 || abs < 1e-2) {
    const [mant, exp] = x.toExponential(sig - 1).split('e');
    return `${mant} \\times 10^{${Number(exp)}}`;
  }
  // toPrecision switches to exponent form when the number has more digits than
  // sig (7351.5 at 3 s.f. gives "7.35e+3"); write those out plainly as 7350.
  const rounded = Number(x.toPrecision(sig));
  if (Math.abs(rounded) >= 10 ** sig) return String(rounded);
  return x.toPrecision(sig);
}

function fill(text: string, scope: Record<string, number>): string {
  // A placeholder holds a name or a small formula, e.g. {{mass}}, {{mass|3}} or {{work - heat|3}}.
  return text.replace(/\{\{\s*([^{}|]+?)\s*(?:\|\s*(\d+)\s*)?\}\}/g, (_, expr: string, sig?: string) => {
    let value: number;
    try {
      value = evaluate(expr, scope);
    } catch (err) {
      throw new Error(`text uses {{${expr}}}: ${(err as Error).message}`);
    }
    return formatNumber(value, sig ? Number(sig) : undefined);
  });
}

// ---------------------------------------------------------------------------
// Making one version of a template
// ---------------------------------------------------------------------------

function pick(v: TemplateVariable, rand: () => number): number {
  const count = Math.max(1, Math.floor((v.max - v.min) / v.step + 1e-9) + 1);
  const value = v.min + Math.floor(rand() * count) * v.step;
  return Number(value.toPrecision(10));
}

/** Small seeded random generator, so a version can be reproduced from its seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build one version. Returns null if this choice of values breaks a
 * constraint or gives options that are not clearly different; the caller
 * should simply try again. Throws if the template itself is broken.
 */
export function tryInstantiate(template: QuestionTemplate, rand: () => number): QuestionInstance | null {
  const scope: Record<string, number> = {};
  for (const v of template.variables) scope[v.name] = pick(v, rand);
  for (const d of template.derived) scope[d.name] = evaluate(d.expr, scope);
  for (const c of template.constraints) if (!evaluate(c, scope)) return null;

  // As in the existing questions, the main timer is shared equally between the steps.
  const mainTimer = Math.min(600, Math.max(60, Math.round(template.main_timer_seconds || 240)));
  const stepTime = Math.max(30, Math.round(mainTimer / Math.max(1, template.steps.length) / 5) * 5);

  const steps: InstanceStep[] = [];
  for (let i = 0; i < template.steps.length; i++) {
    const s = template.steps[i];
    const correct = roundSig(evaluate(s.answer_expr, scope), s.sig_figs);
    if (!Number.isFinite(correct)) return null;
    const wrong = s.distractors.map((d) => roundSig(evaluate(d.expr, scope), s.sig_figs));
    const all = [correct, ...wrong];
    if (all.some((x) => !Number.isFinite(x))) return null;
    // Every option must be clearly different from every other.
    for (let a = 0; a < all.length; a++) {
      for (let b = a + 1; b < all.length; b++) {
        const scale = Math.max(Math.abs(all[a]), Math.abs(all[b]));
        if (scale === 0 || Math.abs(all[a] - all[b]) / scale < 0.03) return null;
      }
    }
    // Later steps and the text can refer to this step's rounded answer as ans1, ans2, ...
    scope[`ans${i + 1}`] = correct;

    const unit = s.unit_latex.trim();
    const order = all.map((_, k) => k);
    for (let k = order.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [order[k], order[j]] = [order[j], order[k]];
    }
    steps.push({
      index: i,
      type: 'mcq',
      timeLimitSeconds: stepTime,
      title: s.title,
      prompt: fill(s.prompt, scope),
      options: order.map((k) => `$${formatNumber(all[k], s.sig_figs)}${unit ? `\\,${unit}` : ''}$`),
      correctAnswer: order.indexOf(0),
      marks: s.marks,
      explanation: fill(s.explanation, scope),
    });
  }
  return {
    stem: fill(template.stem, scope),
    main_question_timer_seconds: stepTime * steps.length,
    total_marks: steps.reduce((n, s) => n + s.marks, 0),
    steps,
    values: scope,
  };
}

/** Build one version, retrying with new values until one works. */
export function instantiate(template: QuestionTemplate, rand: () => number, maxTries = 200): QuestionInstance {
  for (let i = 0; i < maxTries; i++) {
    const inst = tryInstantiate(template, rand);
    if (inst) return inst;
  }
  throw new Error('no valid version found: the constraints or options are too tight for the variable ranges');
}

/**
 * Stress-test a template: try many versions and report how many work.
 * A healthy template yields a version on most attempts.
 */
export function healthCheck(template: QuestionTemplate, tries = 200, seed = 7): { ok: number; tries: number; error: string | null } {
  const rand = seededRandom(seed);
  let ok = 0;
  try {
    for (let i = 0; i < tries; i++) if (tryInstantiate(template, rand)) ok++;
  } catch (err) {
    return { ok, tries, error: (err as Error).message };
  }
  return { ok, tries, error: null };
}
