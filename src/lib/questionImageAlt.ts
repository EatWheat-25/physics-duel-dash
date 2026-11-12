/**
 * Resolves descriptive alt text for a question image.
 *
 * The question schema has no dedicated alt-text column, so for specific
 * authored diagrams we map the known asset to a meaningful description for
 * accessibility. Anything else falls back to a sensible generic label.
 */
export function defaultQuestionImageAlt(imageUrl?: string | null): string {
  if (!imageUrl) return 'Question diagram';
  if (imageUrl.includes('trains_overtaking')) {
    return (
      'Diagram of two trains on the same straight track moving in the same direction: ' +
      'a front train travelling at 10 m per second and a faster rear train approaching from ' +
      'behind to overtake it.'
    );
  }
  return 'Question diagram';
}
