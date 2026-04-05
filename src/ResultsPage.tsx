import type {
  PersonaCardState,
  PersonaName,
  Platform,
  Region,
  SynthesisResult,
  ToneLevel,
} from './types/personas'

type ResultsPageProps = {
  submittedText: string
  platform: Platform
  region: Region
  personaStates: PersonaCardState[]
  synthesis: SynthesisResult | null
  isAnalyzing: boolean
  isSynthesizing: boolean
  errorMessage: string | null
  onBackToEditor: () => void
  onReAnalyze: () => void
  onRunPipeline?: () => void
  onAiRewrite?: () => void
  isRewriting?: boolean
}

function formatPlatform(platform: Platform): string {
  if (platform === 'twitter') {
    return 'Twitter'
  }

  if (platform === 'linkedin') {
    return 'LinkedIn'
  }

  return 'Instagram'
}

function recommendationSupportText(
  recommendation: SynthesisResult['recommendation'],
) {
  if (recommendation === 'post') {
    return '✓ Looks good — safe to publish'
  }

  if (recommendation === 'edit') {
    return '✍ Small changes recommended before posting'
  }

  return '⚠ High risk — significant revision needed'
}

function toneClassName(tone: ToneLevel): string {
  return `persona-card-tone-${tone}`
}

function riskClassName(riskLevel: SynthesisResult['risk_level']): string {
  return `risk-accent-${riskLevel}`
}

function displayPersonaName(name: PersonaName): string {
  return name === 'Brand / Sponsor' ? 'Brand/Sponsor' : name
}

function ResultsPage({
  submittedText,
  platform,
  region,
  personaStates,
  synthesis,
  isAnalyzing,
  isSynthesizing,
  errorMessage,
  onBackToEditor,
  onReAnalyze,
  onRunPipeline,
  onAiRewrite,
  isRewriting,
}: ResultsPageProps) {
  const hasRun = submittedText.trim().length > 0
  const readyReactions = personaStates
    .filter(
      (entry): entry is PersonaCardState & { status: 'ready'; reaction: NonNullable<PersonaCardState['reaction']> } =>
        entry.status === 'ready' && entry.reaction !== null,
    )
    .map((entry) => entry.reaction)
  const toneCounts: Array<{ tone: ToneLevel; count: number }> = [
    {
      tone: 'warm' as ToneLevel,
      count: readyReactions.filter((entry) => entry.tone === 'warm').length,
    },
    {
      tone: 'neutral' as ToneLevel,
      count: readyReactions.filter((entry) => entry.tone === 'neutral').length,
    },
    {
      tone: 'skeptical' as ToneLevel,
      count: readyReactions.filter((entry) => entry.tone === 'skeptical').length,
    },
    {
      tone: 'hostile' as ToneLevel,
      count: readyReactions.filter((entry) => entry.tone === 'hostile').length,
    },
  ].filter((entry) => entry.count > 0)

  return (
    <section className="results-page" aria-live="polite">
      <div className="results-header">
        <div className="output-heading">
          <p className="output-kicker">Output</p>
          <h2>Analysis Result</h2>
          <p className="results-context-note">
            {region === 'singapore'
              ? 'SEA mode active'
              : `${formatPlatform(platform)} · Global audience`}
          </p>
        </div>
        <div className="results-actions">
          <button className="back-link" type="button" onClick={onBackToEditor}>
            Back to editor
          </button>
          <button className="back-link rerun-link" type="button" onClick={onReAnalyze}>
            ↺ Re-run
          </button>
        </div>
      </div>

      <div className="results-main">
        {!hasRun ? (
          <div className="empty-state">
            <div className="empty-state-content">
              <p className="block-label">No analysis yet</p>
              <h3>Run a draft first.</h3>
              <p>
                Head back to the editor, paste a post, and launch the multi-agent
                run.
              </p>
            </div>
          </div>
        ) : (
          <section className="output-panel">
            {errorMessage ? (
              <div className="notice-banner results-notice" role="status">
                {errorMessage}
              </div>
            ) : null}

            <div className="output-card">
              <section className="output-section draft-card">
                <div className="section-header">
                  <div>
                    <p className="block-label">Submitted text</p>
                    <h3>Draft Preview</h3>
                  </div>
                  <span className="section-chip">{formatPlatform(platform)}</span>
                </div>

                <div className="draft-preview">
                  <p>{submittedText}</p>
                </div>
              </section>

              {synthesis ? (
                synthesis.risk_level === 'low' ? (
                  <section className="risk-banner risk-banner-low">
                    <p className="risk-banner-title">Safe to post</p>
                    <p>
                      Agnes-Claw sees low immediate PR risk across the five
                      persona agents.
                    </p>
                  </section>
                ) : (
                  <section
                    className={`risk-banner ${
                      synthesis.risk_level === 'high'
                        ? 'risk-banner-high'
                        : 'risk-banner-medium'
                    }`}
                  >
                    <p className="risk-banner-title">
                      {synthesis.risk_level === 'high'
                        ? 'High PR risk'
                        : 'Medium PR risk'}
                    </p>
                    <p>{synthesis.what_could_go_wrong}</p>
                    <div className="risk-banner-headline-group">
                      <p className="risk-banner-headline-label">
                        Potential headline:
                      </p>
                      <p className="risk-banner-headline">
                        {synthesis.headline_risk}
                      </p>
                    </div>
                  </section>
                )
              ) : isSynthesizing ? (
                <section className="risk-banner risk-banner-pending">
                  <p className="risk-banner-title">Synthesizing reactions</p>
                  <p>The PR analyst agent is combining all five persona reads.</p>
                </section>
              ) : null}

            <section className="output-section analysis-main">
              <div className="section-header">
                <div>
                  <p className="block-label">Persona reactions</p>
                  <h3>Audience Simulation</h3>
                </div>
                <span className="section-chip">5 agents · Agnes-Claw</span>
              </div>

              {isAnalyzing ? (
                <div className="agent-status-line">
                  <span className="agent-status-dot" aria-hidden="true" />
                  Running 5 audience agents...
                </div>
              ) : null}

              {!isAnalyzing && toneCounts.length > 0 ? (
                <div className="tone-summary" aria-label="Tone distribution summary">
                  {toneCounts.map(({ tone, count }) => (
                    <span className="tone-summary-item" key={tone}>
                      <span
                        className={`tone-summary-dot tone-summary-dot-${tone}`}
                        aria-hidden="true"
                      />
                      {count} {tone}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="persona-strip">
                {personaStates.map((entry) =>
                  entry.status === 'ready' && entry.reaction ? (
                    <article
                      className={`persona-card ${toneClassName(entry.reaction.tone)}`}
                      key={entry.name}
                    >
                        <div className="persona-card-header">
                          <div className="persona-card-title">
                            <p className="block-label">
                              {displayPersonaName(entry.reaction.name)}
                            </p>
                            <h4>{displayPersonaName(entry.reaction.name)}</h4>
                          </div>
                          <div className="persona-card-badges">
                            <span className="tone-chip">{entry.reaction.tone}</span>
                          </div>
                        </div>

                      <p className="persona-comment">{entry.reaction.comment}</p>

                      <div className="persona-footer">
                        <p>{entry.reaction.reasoning}</p>
                        <span className="risk-mini-chip">
                          Risk: {entry.reaction.risk}
                        </span>
                      </div>
                    </article>
                  ) : (
                    <article className="persona-card persona-card-loading" key={entry.name}>
                      <div className="persona-card-header">
                        <div className="persona-card-title">
                          <p className="block-label">
                            {displayPersonaName(entry.name)}
                          </p>
                          <h4>{displayPersonaName(entry.name)}</h4>
                        </div>
                        <div className="persona-card-badges">
                          <span className="tone-chip">loading</span>
                        </div>
                      </div>

                      <div className="skeleton-line skeleton-line-long" />
                      <div className="skeleton-line skeleton-line-medium" />
                      <div className="skeleton-line skeleton-line-short" />
                    </article>
                  ),
                )}
              </div>
            </section>

              {synthesis ? (
                <>
                  <section className="synthesis-grid">
                    <article className={`synthesis-card ${riskClassName(synthesis.risk_level)}`}>
                      <p className="guide-title">⚠️ What could go wrong</p>
                      <p>{synthesis.what_could_go_wrong}</p>
                    </article>

                    <article className={`synthesis-card ${riskClassName(synthesis.risk_level)}`}>
                      <p className="guide-title">📣 Who amplifies</p>
                      <p>{synthesis.who_amplifies}</p>
                    </article>

                    <article className={`synthesis-card ${riskClassName(synthesis.risk_level)}`}>
                      <p className="guide-title">📰 Headline risk</p>
                      <p>{synthesis.headline_risk}</p>
                    </article>
                  </section>

                  <div className="recommendation-row">
                    <p className="recommendation-copy">
                      {recommendationSupportText(synthesis.recommendation)}
                    </p>
                    <div className="recommendation-buttons-row">
                      {onAiRewrite ? (
                        <button
                          type="button"
                          className="btn-ai-rewrite"
                          disabled={isRewriting}
                          onClick={onAiRewrite}
                        >
                          {isRewriting ? 'Rewriting...' : '🤖 AI Rewrite'}
                        </button>
                      ) : null}
                      {onRunPipeline ? (
                        <button
                          type="button"
                          className="btn-run-pipeline"
                          onClick={onRunPipeline}
                        >
                          🛡 Run Autonomous Protection
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : null}

              {isAnalyzing && !synthesis ? (
                <p className="helper-text results-helper">
                  Persona agents are still resolving. Cards fill in one by one.
                </p>
              ) : null}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

export default ResultsPage
