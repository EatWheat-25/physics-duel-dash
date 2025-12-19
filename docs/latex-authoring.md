# LaTeX authoring guide (MathText + KaTeX)

This app renders math using **KaTeX** via the reusable React component **`MathText`**.

## Delimiters (recommended format)

Write your question text as a normal string and wrap LaTeX in delimiters:

- Inline math: `\( ... \)`
- Block math: `\[ ... \]`

Example (mixed text + inline + block):

```text
Using Poiseuille: \(\frac{V}{t}=\frac{\pi r^4 \Delta p}{8\eta L}\) then integrate: \[\int_0^L \mathrm{d}p\]
```

## Where you can use LaTeX

The UI renders LaTeX in:

- `questions_v2.stem`
- `questions_v2.steps[*].prompt`
- `questions_v2.steps[*].options[*]`

## JSON escaping rules

### If you type in the Admin UI

Just type delimiters normally (single backslashes), e.g.:

```text
\(\frac{1}{2}\)
```

### If you paste raw JSON into a file / code string

You must escape backslashes. A single `\` becomes `\\`.

Example JSON snippet:

```json
{
  "stem": "Using Poiseuille: \\(\\frac{V}{t}=\\frac{\\pi r^4 \\Delta p}{8\\eta L}\\)",
  "steps": [
    {
      "id": "step-1",
      "index": 0,
      "type": "mcq",
      "title": "Step 1",
      "prompt": "Rearrange for \\(\\Delta p\\).",
      "options": [
        "\\(\\Delta p = \\frac{8\\eta L}{\\pi r^4}\\frac{V}{t}\\)",
        "\\(\\Delta p = \\frac{\\pi r^4}{8\\eta L}\\frac{V}{t}\\)",
        "None of the above",
        ""
      ],
      "correctAnswer": 0,
      "marks": 1,
      "timeLimitSeconds": 10,
      "explanation": "Rearrange the equation for \\(\\Delta p\\)."
    }
  ]
}
```

## Common patterns you can copy/paste

### Fractions / powers / roots

- `\(\frac{a}{b}\)`
- `\(x^{n+1}\)`
- `\(\sqrt{a^2+b^2}\)`

### Integrals / summations / limits

- `\(\int_0^\infty e^{-x}\,\mathrm{d}x\)`
- `\(\sum_{k=1}^{n} k\)`
- `\(\lim_{x\to 0}\frac{\sin x}{x}\)`

### Vectors / dot / cross

- `\(\vec{v}\)`, `\(\vec{F}\)`
- `\(\vec{a}\cdot\vec{b}\)`
- `\(\vec{a}\times\vec{b}\)`

### Units (recommended)

Use `\mathrm{...}` for units and thin spaces `\,` between unit factors:

- `\(\mathrm{m\,s^{-1}}\)`
- `\(\mathrm{N\,m^{-2}}\)`
- `\(\mathrm{J\,kg^{-1}\,K^{-1}}\)`

## Notes / limitations

- `MathText` is **safe**: it does not render arbitrary HTML from input text.\n+- If KaTeX fails to parse a math segment, the UI **falls back to the raw string** and logs a warning in the console.\n+

