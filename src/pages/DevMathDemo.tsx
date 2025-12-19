import { MathText } from '@/components/math/MathText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SpaceBackground from '@/components/SpaceBackground';

const examples: Array<{ title: string; text: string }> = [
  {
    title: 'Mixed text + inline + block',
    text:
      'Using Poiseuille: \\(\\frac{V}{t}=\\frac{\\pi r^4 \\Delta p}{8\\eta L}\\) then integrate: \\[\\int_0^L \\mathrm{d}p\\]',
  },
  {
    title: 'Fractions, roots, powers',
    text: 'Compute \\(\\sqrt{a^2+b^2}\\) and \\(\\frac{1}{1+x^2}\\), with \\(x^{n+1}\\).',
  },
  {
    title: 'Integrals, summations, limits',
    text:
      'Evaluate \\(\\int_0^\\infty e^{-x}\\,\\mathrm{d}x\\), \\(\\sum_{k=1}^{n} k\\), and \\(\\lim_{x\\to 0}\\frac{\\sin x}{x}\\).',
  },
  {
    title: 'Vectors + dot/cross products',
    text: 'Use \\(\\vec{v}\\), \\(\\vec{F}\\), \\(\\vec{a}\\). Dot: \\(\\vec{a}\\cdot\\vec{b}\\). Cross: \\(\\vec{a}\\times\\vec{b}\\).',
  },
  {
    title: 'Units formatting',
    text:
      'Speed: \\(\\mathrm{m\\,s^{-1}}\\), Pressure: \\(\\mathrm{N\\,m^{-2}}\\), Specific heat: \\(\\mathrm{J\\,kg^{-1}\\,K^{-1}}\\).',
  },
  {
    title: 'Matrices',
    text: 'A matrix: \\[\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\\]',
  },
  {
    title: 'Greek letters + subscripts',
    text: 'Greek: \\(\\pi, \\eta, \\Delta, \\theta, \\mu, \\lambda\\). Subscripts: \\(v_0, a_1\\).',
  },
];

export default function DevMathDemo() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <SpaceBackground />

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-white">KaTeX Math Demo</h1>
          <p className="text-white/60">
            Examples of inline <code className="text-white/80">\\(…\\)</code> and block{' '}
            <code className="text-white/80">\\[…\\]</code> rendering with <code className="text-white/80">MathText</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {examples.map((ex) => (
            <Card key={ex.title} className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white">{ex.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-white/90 leading-relaxed">
                <MathText text={ex.text} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}


