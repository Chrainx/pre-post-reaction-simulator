export type PersonaId = 'supporter' | 'neutral' | 'critic' | 'sensitive'

export type PersonaReaction = {
  id: PersonaId
  persona: string
  sentiment: string
  reaction: string
}

export type RiskSummary = {
  level: string
  summary: string
  watchout: string
}

export type AnalysisResult = {
  submittedText: string
  personas: PersonaReaction[]
  riskSummary: RiskSummary
}

export const PERSONA_ORDER: PersonaId[] = [
  'supporter',
  'neutral',
  'critic',
  'sensitive',
]
