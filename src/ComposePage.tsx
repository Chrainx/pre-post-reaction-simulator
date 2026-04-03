import type { FormEvent } from 'react'
import type { AnalysisResult } from './types'

type ComposePageProps = {
  input: string
  result: AnalysisResult | null
  onInputChange: (value: string) => void
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void
  onViewResults: () => void
}

function ComposePage({
  input,
  result,
  onInputChange,
  onAnalyze,
  onViewResults,
}: ComposePageProps) {
  return (
    <>
      <section className="hero-panel">
        <p className="eyebrow">MVP Interface</p>
        <h1>Pre-Post Reaction Simulator</h1>
        <p className="hero-copy">Test how a draft might land before you post it.</p>
      </section>

      <section className="workspace-panel">
        <form className="composer-panel" onSubmit={onAnalyze}>
          <div className="composer-header">
            <label className="field-label" htmlFor="post-input">
              Draft Post
            </label>
            <p className="composer-copy">
              Paste a caption, draft, or announcement for a quick audience read.
            </p>
          </div>

          <div className="composer-body">
            <div className="composer-main">
              <textarea
                id="post-input"
                className="post-input"
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder="Type or paste the post you want to analyze..."
                rows={7}
              />

              <div className="actions-row">
                <p className="helper-text">
                  Enter some text, then open the results page.
                </p>
                <button
                  className="analyze-button"
                  type="submit"
                  disabled={!input.trim()}
                >
                  Analyze
                </button>
              </div>
            </div>

            <aside className="composer-guide">
              <div className="guide-block">
                <p className="block-label">Quick guide</p>
                <h3>Example input</h3>
                <p className="guide-copy">
                  Use realistic launch posts, announcements, captions, or
                  apology statements for the best demo output.
                </p>
              </div>

              <article className="guide-card">
                <p className="guide-title">Example</p>
                <p>
                  We’re excited to launch our new student discount this Friday.
                  Can’t wait for everyone to try it.
                </p>
              </article>

              <article className="guide-card">
                <p className="guide-title">Checks</p>
                <ul className="guide-list">
                  <li>Supporter reaction</li>
                  <li>Neutral reaction</li>
                  <li>Critic reaction</li>
                  <li>PR risk summary</li>
                </ul>
              </article>

              <button
                className="page-link"
                type="button"
                onClick={onViewResults}
                disabled={!result}
              >
                View latest results
              </button>
            </aside>
          </div>
        </form>
      </section>
    </>
  )
}

export default ComposePage
