import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AnalysisResult = {
  submittedText: string
  summary: string
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

    setResult({
      submittedText: trimmedInput,
      summary:
        'Analysis placeholder ready. Next, we can swap this for persona-based reactions and risk scoring.',
    })
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
              <div className="output-block">
                <p className="block-label">System response</p>
                <p>{result.summary}</p>
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
