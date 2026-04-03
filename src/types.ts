export type PersonaReaction = {
  persona: 'Supporter' | 'Neutral' | 'Critic'
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
