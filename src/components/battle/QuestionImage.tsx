import { defaultQuestionImageAlt } from '@/lib/questionImageAlt'

/**
 * Renders a question/diagram image on a white "paper" card.
 *
 * - Responsive: fills the available width up to a readable max, so it scales
 *   down cleanly on mobile.
 * - Preserves aspect ratio and shows the whole diagram without cropping
 *   (`h-auto` + `object-contain`).
 * - White background so black-on-white exam diagrams stay legible on the dark
 *   app theme.
 */
export function QuestionImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt?: string | null
  className?: string
}) {
  return (
    <div className={`my-6 flex justify-center ${className}`}>
      <div className="w-full max-w-2xl rounded-lg border border-slate-300 bg-white p-3">
        <img
          src={src}
          alt={alt || defaultQuestionImageAlt(src)}
          className="mx-auto block h-auto w-full object-contain"
          loading="lazy"
        />
      </div>
    </div>
  )
}
