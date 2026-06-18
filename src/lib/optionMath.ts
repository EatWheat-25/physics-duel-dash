const SCIENCE_TOKEN_RE = /\[\[(smiles|img):[\s\S]*?\]\]/i
const CHEM_COMMAND_RE = /\\ce\s*\{/
const SUPERSCRIPT_OR_MATH_SYMBOL_RE = /[²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉√∫∞≈≤≥≠±×÷·πθΔ∑∏]/
const SUPERSCRIPT_OR_MATH_SYMBOL_GLOBAL_RE = /[²³⁴⁵⁶⁷⁸⁹⁰₀₁₂₃₄₅₆₇₈₉√∫∞≈≤≥≠±×÷·πθΔ∑∏]/g
const STRONG_MATH_RE =
  /(\\(?:frac|sqrt|sin|cos|tan|cot|sec|csc|ln|log|exp|theta|alpha|beta|gamma|delta|lambda|mu|sigma|pi|times|div|cdot|pm|int|sum|prod|lim|to|leq|geq|neq|approx|infty)|\^|_|=|->|<=>|\b[a-zA-Z]+\s*\/\s*[a-zA-Z]+\b)/

const ALLOWED_MATH_WORDS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'log',
  'ln',
  'exp',
  'lim',
  'mod',
  'det',
  'max',
  'min',
  'gcd',
  'lcm',
  'pi',
  'theta',
  'alpha',
  'beta',
  'gamma',
  'delta',
  'lambda',
  'mu',
  'sigma',
  'dy',
  'dx',
])

export function countUnescapedDollars(text: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] !== '$') continue

    let slashCount = 0
    for (let j = i - 1; j >= 0 && text[j] === '\\'; j -= 1) {
      slashCount += 1
    }

    if (slashCount % 2 === 0) {
      count += 1
    }
  }
  return count
}

export function hasMathDelimiters(input: string | null | undefined): boolean {
  const text = String(input ?? '').trim()
  if (!text) return false

  if (text.includes('\\(') && text.includes('\\)')) return true
  if (text.includes('\\[') && text.includes('\\]')) return true

  return countUnescapedDollars(text) >= 2
}

function hasDisqualifyingPlainLanguage(text: string): boolean {
  const stripped = text
    .replace(/\\ce\s*\{[\s\S]*?\}/g, ' ')
    .replace(/\\[A-Za-z]+/g, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/[=+\-*/^_()[\]{}<>|,.:;!?'"`~]/g, ' ')
    .replace(SUPERSCRIPT_OR_MATH_SYMBOL_GLOBAL_RE, ' ')

  const words = stripped
    .split(/\s+/)
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

  return words.some((word) => {
    if (word.length < 3) return false
    if (ALLOWED_MATH_WORDS.has(word)) return false
    if (/^[a-z]\d*$/.test(word)) return false

    const strippedFunctionPrefix = word.replace(/^(sin|cos|tan|cot|sec|csc|log|ln|exp)/, '')
    if (!strippedFunctionPrefix || /^[a-z]\d*$/.test(strippedFunctionPrefix)) return false

    return true
  })
}

export function optionNeedsInlineMathWrapper(input: string | null | undefined): boolean {
  const text = String(input ?? '').trim()
  if (!text) return false
  if (hasMathDelimiters(text)) return false
  if (/^(true|false)$/i.test(text)) return false
  if (SCIENCE_TOKEN_RE.test(text)) return false

  if (CHEM_COMMAND_RE.test(text)) {
    return true
  }

  if (!STRONG_MATH_RE.test(text) && !SUPERSCRIPT_OR_MATH_SYMBOL_RE.test(text)) {
    return false
  }

  return !hasDisqualifyingPlainLanguage(text)
}

export function normalizeInlineMathOption(input: string | null | undefined): string {
  const text = String(input ?? '').trim()
  if (!text) return text
  return optionNeedsInlineMathWrapper(text) ? `\\(${text}\\)` : text
}
