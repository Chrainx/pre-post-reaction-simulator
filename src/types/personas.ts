// Issue #6: canonical persona simulation schema shared across the app.
export type PersonaName =
  | 'Loyal Fan'
  | 'Skeptical Stranger'
  | 'The Critic'
  | 'Brand / Sponsor'
  | 'Casual Scroller'

export type ToneLevel = 'warm' | 'neutral' | 'skeptical' | 'hostile'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface PersonaReaction {
  name: PersonaName
  comment: string
  tone: ToneLevel
  reasoning: string
  risk: RiskLevel
}

export interface SynthesisResult {
  risk_level: RiskLevel
  what_could_go_wrong: string
  who_amplifies: string
  headline_risk: string
  recommendation: 'post' | 'edit' | 'reconsider'
}

export interface SimulationResult {
  personas: PersonaReaction[]
  synthesis: SynthesisResult
}

export type Region = 'global' | 'singapore'
export type Platform = 'instagram' | 'linkedin' | 'twitter'

export const PERSONA_ORDER: PersonaName[] = [
  'Loyal Fan',
  'Skeptical Stranger',
  'The Critic',
  'Brand / Sponsor',
  'Casual Scroller',
]

export const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: 'twitter', label: 'Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'instagram', label: 'Instagram' },
]
