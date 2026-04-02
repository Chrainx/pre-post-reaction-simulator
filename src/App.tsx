import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type PersonaReaction = {
  persona: 'Supporter' | 'Neutral' | 'Critic'
  sentiment: string
  reaction: string
}

type RiskSummary = {
  level: string
  summary: string
  watchout: string
}

type AnalysisResult = {
  submittedText: string
  personas: PersonaReaction[]
  riskSummary: RiskSummary
}

const buildMockAnalysis = (text: string): AnalysisResult => {
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

function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const handleAnalyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput) {
      return
    }

    setResult(buildMockAnalysis(trimmedInput))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">MVP Interface</p>
        <h1>Pre-Post Reaction Simulator</h1>
        <p className="hero-copy">
          Paste a draft post below to simulate how the app will analyze public
          reaction.
        </p>
      </section>

      <section className="workspace-panel">
        <form className="composer-panel" onSubmit={handleAnalyze}>
          <label className="field-label" htmlFor="post-input">
            Draft Post
          </label>
          <textarea
            id="post-input"
            className="post-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type or paste the post you want to analyze..."
            rows={9}
          />

          <div className="actions-row">
            <p className="helper-text">
              Enter some text, then run the simulator.
            </p>
            <button className="analyze-button" type="submit" disabled={!input.trim()}>
              Analyze
            </button>
          </div>
        </form>

        <section className="output-panel" aria-live="polite">
          <div className="output-heading">
            <p className="output-kicker">Output</p>
            <h2>Analysis Result</h2>
          </div>

          {result ? (
            <div className="output-card">
              <div className="output-block">
                <p className="block-label">Submitted text</p>
                <p>{result.submittedText}</p>
              </div>

              <div className="persona-grid">
                {result.personas.map((persona) => (
                  <article className="persona-card" key={persona.persona}>
                    <div className="persona-card-header">
                      <p className="block-label">{persona.persona}</p>
                      <span className="persona-tone">{persona.sentiment}</span>
                    </div>
                    <p>{persona.reaction}</p>
                  </article>
                ))}
              </div>

              <div className="risk-card">
                <div className="persona-card-header">
                  <p className="block-label">PR Risk Summary</p>
                  <span className="persona-tone risk-tone">
                    {result.riskSummary.level}
                  </span>
                </div>
                <div className="output-block">
                  <p>{result.riskSummary.summary}</p>
                  <p>{result.riskSummary.watchout}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Your analysis will appear here after you click Analyze.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

export default App
