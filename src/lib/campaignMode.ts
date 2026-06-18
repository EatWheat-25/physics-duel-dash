import type { QuestionSubject } from '@/types/questions'

export type CampaignLevel = 'A1' | 'A2'
export type CampaignTopicKind = 'chapter' | 'topicTag'

export interface CampaignTopicOption {
  kind: CampaignTopicKind
  value: string
  label: string
}

export interface CampaignSelectionState {
  mode: 'campaign'
  subject: QuestionSubject
  level: CampaignLevel
  topicKind: CampaignTopicKind
  topicValue: string
  topicLabel: string
  topicRankPoints?: number
}

export const CAMPAIGN_SUBJECT_LABELS: Record<QuestionSubject, string> = {
  math: 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
}

export const CAMPAIGN_LEVEL_LABELS: Record<CampaignLevel, string> = {
  A1: 'A1',
  A2: 'A2',
}

const PHYSICS_CHAPTERS: string[] = [
  'Chapter 1: Physical Quantities',
  'Chapter 2: Kinematics',
  'Chapter 3: Dynamics',
  'Chapter 4: Force Density and Pressure',
  'Chapter 5: Work, Power and Energy',
  'Chapter 6: Deformation of Solids',
  'Chapter 7: Waves',
  'Chapter 8: Superpositions',
  'Chapter 9: Current of Electricity',
  'Chapter 10: DC Circuits',
  'Chapter 11: Nuclear Physics',
]

const CHEMISTRY_CHAPTERS: string[] = [
  'Atomic Structure',
  'Moles & Calculations',
  'Bonding & Structure',
  'States of Matter & Gases',
  'Energetics',
  'Rate of Reaction',
  'Equilibrium',
  'Acids, Bases & pH',
  'Redox & Electrochemistry',
  'Periodicity & Group Chemistry',
  'Organic Basics',
  'Hydrocarbons',
  'Organic Functional Groups',
  'Analytical Techniques',
]

const MATH_A1_CHAPTERS: string[] = [
  'Coordinate geometry',
  'Circular measure',
  'sequence',
  'Binomial',
  'quadratics',
  'Trignometry',
  'Functions',
  'Differenciation',
  'Integeration',
]

const MATH_A2_CHAPTERS: string[] = [
  'Algebra',
  'Binomial',
  'Logarithmic and Exponential Functions',
  'Trigonometry',
  'Differentiation',
  'Integration',
  'Differential Equations',
  'Numerical Solutions',
  'Vectors',
  'Complex Numbers',
]

export const getCampaignFallbackTopics = (
  subject: QuestionSubject,
  level: CampaignLevel
): CampaignTopicOption[] => {
  const chapters =
    subject === 'math'
      ? (level === 'A1' ? MATH_A1_CHAPTERS : MATH_A2_CHAPTERS)
      : subject === 'chemistry'
        ? CHEMISTRY_CHAPTERS
        : PHYSICS_CHAPTERS

  return chapters.map((chapter) => ({
    kind: 'chapter',
    value: chapter,
    label: chapter,
  }))
}

export const normalizeCampaignTopicValue = (value: string) => value.trim()

export const isCampaignSelectionState = (value: unknown): value is CampaignSelectionState => {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<CampaignSelectionState>
  return (
    candidate.mode === 'campaign' &&
    (candidate.subject === 'math' || candidate.subject === 'physics' || candidate.subject === 'chemistry') &&
    (candidate.level === 'A1' || candidate.level === 'A2') &&
    (candidate.topicKind === 'chapter' || candidate.topicKind === 'topicTag') &&
    typeof candidate.topicValue === 'string' &&
    candidate.topicValue.trim().length > 0 &&
    typeof candidate.topicLabel === 'string' &&
    candidate.topicLabel.trim().length > 0
  )
}

export const getCampaignSummaryLabel = (selection: CampaignSelectionState) => {
  const subjectLabel = CAMPAIGN_SUBJECT_LABELS[selection.subject]
  return `${subjectLabel} ${selection.level} - ${selection.topicLabel}`
}
