import type { FormEvent } from 'react'
import { PLATFORM_OPTIONS } from './types/personas'
import type { Platform, Region } from './types/personas'

type ComposePageProps = {
  input: string
  platform: Platform
  region: Region
  demoMode: boolean
  isAnalyzing: boolean
  canViewResults: boolean
  noticeMessage: string | null
  examplePosts: string[]
  onInputChange: (value: string) => void
  onPlatformChange: (value: Platform) => void
  onRegionToggle: () => void
  onAnalyze: (event: FormEvent<HTMLFormElement>) => void
  onViewResults: () => void
  onExampleSelect: (post: string) => void
}

function ComposePage({
  input,
  platform,
  region,
  demoMode,
  isAnalyzing,
  canViewResults,
  noticeMessage,
  examplePosts,
  onInputChange,
  onPlatformChange,
  onRegionToggle,
  onAnalyze,
  onViewResults,
  onExampleSelect,
}: ComposePageProps) {
  const singaporeMode = region === 'singapore'
  const analyzeDisabled = !input.trim() || isAnalyzing
  const analyzeLabel = demoMode
    ? isAnalyzing
      ? 'Running demo...'
      : 'Analyze demo'
    : isAnalyzing
      ? 'Analyzing...'
      : 'Analyze'

  const guideAgents = [
    'Loyal Fan',
    'Skeptical Stranger',
    'The Critic',
    'Brand/Sponsor',
    'Casual Scroller',
  ]

  return (
    <>
      <section className="hero-panel">
        <div className="hero-topbar">
          <p className="eyebrow">Agnes-Claw Demo</p>
          <div className="region-toggle-stack">
            <button
              className={`region-toggle ${singaporeMode ? 'is-active' : ''}`}
              type="button"
              onClick={onRegionToggle}
              aria-pressed={singaporeMode}
            >
              <span aria-hidden="true">🌏</span>
              {singaporeMode ? 'Singapore Mode: ON' : 'Singapore Mode: OFF'}
            </button>
            <p className="region-toggle-note">
              {singaporeMode
                ? 'Reactions use Singlish & SEA culture'
                : 'Global audience reactions'}
            </p>
          </div>
        </div>

        <div className="hero-copy-group">
          <h1>Pre-Post Reaction Simulator</h1>
          <p className="hero-copy">
            Write your post. Run five audience agents. Know your PR risk.
          </p>
        </div>
      </section>

      <section className="workspace-panel">
        <form className="composer-panel" onSubmit={onAnalyze}>
          <div className="composer-header">
            <div className="composer-intro">
              <label className="field-label" htmlFor="post-input">
                Draft Post
              </label>
              <p className="composer-copy">
                Type or paste your draft. Agnes-Claw simulates how five
                audience types react.
              </p>
            </div>

            <div className="composer-toolbar">
              <div className="platform-field">
                <label className="platform-label" htmlFor="platform-select">
                  Platform
                </label>
                <select
                  id="platform-select"
                  className="platform-select"
                  value={platform}
                  onChange={(event) =>
                    onPlatformChange(event.target.value as Platform)
                  }
                >
                  {PLATFORM_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {noticeMessage ? (
            <div className="notice-banner" role="alert">
              {demoMode
                ? `${noticeMessage}. Demo mode uses built-in sample reactions until you add your Agnes API key.`
                : noticeMessage}
            </div>
          ) : null}

          <div className="composer-body">
            <div className="composer-main">
              <textarea
                id="post-input"
                className="post-input"
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder="Type or paste the post you want Agnes-Claw to analyze..."
                rows={8}
              />

              <div className="examples-section">
                <p className="examples-label">Try an example</p>
                <div className="example-grid">
                  {examplePosts.map((post) => (
                    <button
                      key={post}
                      className="example-card"
                      type="button"
                      onClick={() => onExampleSelect(post)}
                    >
                      {post}
                    </button>
                  ))}
                </div>
              </div>

              <div className="actions-row">
                <p className="helper-text">
                  {demoMode
                    ? 'Demo mode is active. You can still test the full results flow without an Agnes API key.'
                    : 'Each audience persona runs as its own Agnes-Claw agent.'}
                </p>
                <div className="action-buttons">
                  <button
                    className="page-link"
                    type="button"
                    onClick={onViewResults}
                    disabled={!canViewResults}
                  >
                    View latest results
                  </button>
                  <button
                    className="analyze-button"
                    type="submit"
                    disabled={analyzeDisabled}
                  >
                    {analyzeLabel}
                  </button>
                </div>
              </div>
            </div>

            <aside className="composer-guide">
              <div className="guide-block">
                <p className="block-label">How it works</p>
                <h3>Five audience agents</h3>
                <p className="guide-copy">
                  Each persona runs separately. A synthesis agent turns those
                  reactions into a PR-risk readout.
                </p>
              </div>

              <article className="guide-card">
                <p className="guide-title">Agents</p>
                <ul className="guide-list">
                  {guideAgents.map((agent) => (
                    <li key={agent}>{agent}</li>
                  ))}
                </ul>
              </article>

              <article className="guide-card">
                <p className="guide-title">Output</p>
                <p>
                  You’ll get comments, tone, reasoning, amplification risk, and
                  a final recommendation.
                </p>
              </article>
            </aside>
          </div>
        </form>
      </section>
    </>
  )
}

export default ComposePage
