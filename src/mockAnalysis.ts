import type { AnalysisResult, PersonaId, PersonaReaction } from './types'

const PERSONA_BLUEPRINTS: Record<
  PersonaId,
  Omit<PersonaReaction, 'reaction'>
> = {
  supporter: {
    id: 'supporter',
    persona: 'Supporter',
    sentiment: 'Positive',
  },
  neutral: {
    id: 'neutral',
    persona: 'Neutral',
    sentiment: 'Measured',
  },
  critic: {
    id: 'critic',
    persona: 'Critic',
    sentiment: 'Skeptical',
  },
  sensitive: {
    id: 'sensitive',
    persona: 'Sensitive',
    sentiment: 'Cautious',
  },
}

export const buildMockAnalysis = (text: string): AnalysisResult => {
  const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text

  return {
    submittedText: text,
    personas: [
      {
        ...PERSONA_BLUEPRINTS.supporter,
        reaction:
          `This feels exciting and easy to rally behind. "${preview}" sounds confident and shareable to people who already support the message.`,
      },
      {
        ...PERSONA_BLUEPRINTS.neutral,
        reaction:
          'The message is understandable, but it could use more context or specifics before a general audience fully buys in. It reads clearly without being especially emotional.',
      },
      {
        ...PERSONA_BLUEPRINTS.critic,
        reaction:
          'A critical audience may question whether the wording overpromises or leaves room for misunderstanding. The tone could invite pushback if the claim is not backed up.',
      },
      {
        ...PERSONA_BLUEPRINTS.sensitive,
        reaction:
          'A more sensitive audience may focus on whether the wording feels dismissive, overly sharp, or unaware of how people affected by the topic could read it. Small tone shifts would reduce that risk.',
      },
    ],
    riskSummary: {
      level: 'Medium',
      summary:
        'The draft is broadly safe, but audiences could interpret it differently depending on how much context they already have.',
      watchout:
        'Watch for vague wording, unsupported claims, or lines that sound more confident than the evidence behind them.',
    },
  }
}
