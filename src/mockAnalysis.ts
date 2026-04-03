import type { AnalysisResult } from './types'

export const buildMockAnalysis = (text: string): AnalysisResult => {
  const preview = text.length > 140 ? `${text.slice(0, 137)}...` : text

  return {
    submittedText: text,
    personas: [
      {
        persona: 'Supporter',
        sentiment: 'Positive',
        reaction:
          `This feels exciting and easy to rally behind. "${preview}" sounds confident and shareable to people who already support the message.`,
      },
      {
        persona: 'Neutral',
        sentiment: 'Measured',
        reaction:
          'The message is understandable, but it could use more context or specifics before a general audience fully buys in. It reads clearly without being especially emotional.',
      },
      {
        persona: 'Critic',
        sentiment: 'Skeptical',
        reaction:
          'A critical audience may question whether the wording overpromises or leaves room for misunderstanding. The tone could invite pushback if the claim is not backed up.',
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
