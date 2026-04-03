import { PERSONA_ORDER } from './types'
import type { AnalysisResult } from './types'

type ResultsPageProps = {
  result: AnalysisResult | null
  onBackToEditor: () => void
}

function ResultsPage({ result, onBackToEditor }: ResultsPageProps) {
  const orderedPersonas = result
    ? [...result.personas].sort(
        (left, right) =>
          PERSONA_ORDER.indexOf(left.id) - PERSONA_ORDER.indexOf(right.id),
      )
    : []

  return (
    <section className="results-page" aria-live="polite">
      <div className="results-header">
        <button className="back-link" type="button" onClick={onBackToEditor}>
          Back to editor
        </button>
        <div className="output-heading">
          <p className="output-kicker">Output</p>
          <h2>Analysis Result</h2>
        </div>
      </div>

      {result ? (
        <section className="output-panel">
          <div className="output-card">
            <div className="output-overview">
              <section className="output-section input-summary">
                <div className="section-header">
                  <div>
                    <p className="block-label">Submitted text</p>
                    <h3>Draft Preview</h3>
                  </div>
                </div>
                <div className="draft-preview">
                  <p>{result.submittedText}</p>
                </div>
              </section>

              <section className="output-section risk-card">
                <div className="section-header">
                  <div>
                    <p className="block-label">PR risk summary</p>
                    <h3>Risk Watch</h3>
                  </div>
                  <span className="persona-tone risk-tone">
                    {result.riskSummary.level}
                  </span>
                </div>

                <div className="risk-grid">
                  <div className="risk-detail">
                    <p className="risk-label">Overview</p>
                    <p>{result.riskSummary.summary}</p>
                  </div>
                  <div className="risk-detail">
                    <p className="risk-label">Watch out for</p>
                    <p>{result.riskSummary.watchout}</p>
                  </div>
                </div>
              </section>
            </div>

            <section className="output-section analysis-main">
              <div className="section-header">
                <div>
                  <p className="block-label">Persona reactions</p>
                  <h3>Audience Simulation</h3>
                </div>
                <span className="section-chip">
                  {orderedPersonas.length} perspectives
                </span>
              </div>

              <div className="persona-grid">
                {orderedPersonas.map((persona) => (
                  <article className="persona-card" key={persona.persona}>
                    <div className="persona-card-header">
                      <div>
                        <p className="block-label">{persona.persona}</p>
                        <h4>{persona.persona} reaction</h4>
                      </div>
                      <span className="persona-tone">{persona.sentiment}</span>
                    </div>
                    <p>{persona.reaction}</p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <div className="empty-state-content">
            <p className="block-label">No analysis yet</p>
            <h3>Create a draft first.</h3>
            <p>Go back to the editor and run the simulator to see results.</p>
          </div>
        </div>
      )}
    </section>
  )
}

export default ResultsPage
