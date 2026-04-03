export type PersonaId = 'supporter' | 'neutral' | 'critic' | 'sensitive'
export type RiskLevel = 'Safe' | 'Medium' | 'Risky'

export type PersonaReaction = {
  id: PersonaId
  persona: string
  sentiment: string
  reaction: string
}

export type OverallAssessment = {
  tone: string
  riskLevel: RiskLevel
}

export type RiskSummary = {
  level: RiskLevel
  summary: string
  watchout: string
}

export type AnalysisResult = {
  submittedText: string
  overallAssessment: OverallAssessment
  personas: PersonaReaction[]
  riskSummary: RiskSummary
}

export const PERSONA_ORDER: PersonaId[] = [
  'supporter',
  'neutral',
  'critic',
  'sensitive',
]
