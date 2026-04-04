import { useEffect, useRef, useState } from 'react'
import { runAutonomousPipeline } from './services/autonomousAgent'
import type { AutonomousPipelineState, GeneratedComment } from './types/monitor'
import type { PersonaReaction, Platform, Region, SynthesisResult } from './types/personas'

type PipelinePageProps = {
  postText: string
  platform: Platform
  region: Region
  personas: PersonaReaction[]
  synthesis: SynthesisResult
  pipelineState: AutonomousPipelineState
  threshold: number
  onThresholdChange: (value: number) => void
  onProgress: (state: AutonomousPipelineState) => void
  onBack: () => void
}

// ── helpers ──────────────────────────────────────────────────────────────────

function formatLogTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

function getRiskColor(score: number): string {
  if (score >= 60) return '#e24b4a'
  if (score >= 35) return '#ef9f27'
  return '#1d9e75'
}

function riskChipStyle(risk: GeneratedComment['risk']): React.CSSProperties {
  if (risk === 'high') return { background: '#fcebeb', color: '#9c2e2e' }
  if (risk === 'medium') return { background: '#faeeda', color: '#9a6207' }
  return { background: 'rgba(29,158,117,0.1)', color: '#176f54' }
}

type StepState = 'done' | 'active' | 'pending'

function getStepState(stepAgent: number, currentAgent: number, completed: boolean): StepState {
  if (completed || currentAgent > stepAgent) return 'done'
  if (currentAgent === stepAgent) return 'active'
  return 'pending'
}

function formatElapsed(ms: number): string {
  const s = ms / 1000
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

// ── component ─────────────────────────────────────────────────────────────────

const THRESHOLD_OPTIONS = [
  { value: 40, label: 'Low (40)', description: 'Triggers on light abuse' },
  { value: 60, label: 'Medium (60)', description: 'Balanced — default' },
  { value: 80, label: 'High (80)', description: 'Only severe threats' },
]

function PipelinePage({
  postText,
  platform,
  region,
  personas,
  synthesis,
  pipelineState,
  threshold,
  onThresholdChange,
  onProgress,
  onBack,
}: PipelinePageProps) {
  const startedRef = useRef(false)
  const logBodyRef = useRef<HTMLDivElement>(null)
  // Delay banner appearance 400ms after pipeline completes — log entries land first
  const [bannerVisible, setBannerVisible] = useState(false)

  const hasStarted = pipelineState.startedAt !== null
  const isCompleted = pipelineState.status === 'safe' || pipelineState.status === 'taken-down'

  // Auto-start on mount
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runAutonomousPipeline(postText, platform, region, personas, synthesis, threshold, onProgress).catch(
      (err: unknown) => {
        console.error('Pipeline error:', err)
      },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll log on new entries
  useEffect(() => {
    if (logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
    }
  }, [pipelineState.agentLog.length])

  // Show banner 400ms after completion so log entries render first
  useEffect(() => {
    if (!isCompleted) {
      setBannerVisible(false)
      return
    }
    const timer = window.setTimeout(() => setBannerVisible(true), 400)
    return () => window.clearTimeout(timer)
  }, [isCompleted])

  const { status, currentAgent, generatedComments, riskScore, decision, agentLog } = pipelineState

  const abuseCount = generatedComments.filter((c) => c.category === 'abuse').length
  const urgentCount = generatedComments.filter((c) => c.category === 'urgent').length
  const spamCount = generatedComments.filter((c) => c.category === 'spam').length
  const supportCount = generatedComments.filter((c) => c.category === 'support').length

  const elapsedMs =
    pipelineState.startedAt && pipelineState.completedAt
      ? pipelineState.completedAt - pipelineState.startedAt
      : null

  const completedTime = pipelineState.completedAt
    ? new Date(pipelineState.completedAt).toLocaleTimeString()
    : ''

  const riskColor = getRiskColor(riskScore)

  // Agent 8 is actively classifying
  const isClassifying = currentAgent === 8 && !isCompleted

  const steps: Array<{ label: string; agent: number }> = [
    { label: 'Agents 1–6', agent: 6 },
    { label: 'Comment Wave', agent: 7 },
    { label: 'Classifier', agent: 8 },
    { label: 'Decision', agent: 9 },
  ]

  return (
    <section className="pipeline-page">
      {/* ── Section 1: Header ── */}
      <div className="pipeline-header">
        <button className="back-link" type="button" onClick={onBack}>
          ← Back to results
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--heading)', fontSize: 'clamp(1.1rem, 2.4vw, 1.5rem)' }}>
            Autonomous Protection Pipeline
          </h2>
          <p className="pipeline-pitch">
            Agnes is generating a realistic comment wave at randomised intervals.
            In production, this connects directly to your live post via social API.
          </p>
        </div>
        <span className="eyebrow">Agnes-Claw</span>
      </div>

      {/* ── Threshold selector (only before pipeline starts) ── */}
      {!hasStarted && (
        <div className="output-section" style={{ gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <p className="block-label">Takedown threshold</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Agnes will act autonomously when the risk score reaches this level.
              </p>
            </div>
            <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-strong)', flexShrink: 0 }}>
              {threshold}/100
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {THRESHOLD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`threshold-option${threshold === opt.value ? ' threshold-option-active' : ''}`}
                onClick={() => onThresholdChange(opt.value)}
              >
                <span className="threshold-option-label">{opt.label}</span>
                <span className="threshold-option-desc">{opt.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2: Pipeline steps ── */}
      <div className="output-section" style={{ gap: 16, padding: '18px 20px' }}>
        <div className="agent-steps-row">
          {steps.map(({ label, agent }) => {
            const stepState = getStepState(agent, currentAgent, isCompleted)
            return (
              <div className="agent-step" key={label}>
                <div
                  className={`agent-step-circle ${
                    stepState === 'done'
                      ? 'agent-step-done'
                      : stepState === 'active'
                        ? 'agent-step-active'
                        : 'agent-step-pending'
                  }`}
                >
                  {stepState === 'done' ? '✓' : agent}
                </div>
                <span className="agent-step-label">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Section 3: Risk meter ── */}
      <div className="output-section" style={{ gap: 12 }}>
        <div className="risk-meter-large">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <p className="block-label">Aggregate risk score — updating in real time</p>
            <span className="risk-score-display" style={{ color: riskColor }}>
              {riskScore}/100
            </span>
          </div>

          <div className="risk-meter-bar" style={{ position: 'relative' }}>
            <div
              className="risk-meter-fill"
              style={{ width: `${riskScore}%`, backgroundColor: riskColor }}
            />
            {/* threshold tick */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: `${pipelineState.threshold}%`,
                height: '100%',
                width: 2,
                background: 'rgba(88,71,55,0.35)',
                borderRadius: 1,
                transform: 'translateX(-50%)',
              }}
              title={`Takedown threshold: ${pipelineState.threshold}`}
            />
          </div>
          <div style={{ position: 'relative', height: 16 }}>
            <span style={{
              position: 'absolute',
              left: `${pipelineState.threshold}%`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}>
              threshold {pipelineState.threshold}
            </span>
          </div>

          <div className="comment-counts-row">
            <span>🔴 {abuseCount} abuse</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>🟠 {urgentCount} urgent</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>🟡 {spamCount} spam</span>
            <span style={{ color: 'var(--border-strong)' }}>·</span>
            <span>🟢 {supportCount} support</span>
          </div>
        </div>
      </div>

      {/* ── Section 4: Decision banner (delayed 400ms) ── */}
      {bannerVisible && decision ? (
        <div
          className={`decision-banner ${
            status === 'taken-down' ? 'decision-banner-takendown' : 'decision-banner-safe'
          }`}
        >
          <p className="decision-title">
            {status === 'taken-down' ? '✓ POST TAKEN DOWN' : '✓ POST SAFE'}
          </p>
          <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            {status === 'taken-down'
              ? `Agnes acted at ${completedTime} after ${generatedComments.length} comment${generatedComments.length === 1 ? '' : 's'}${elapsedMs !== null ? ` · ${formatElapsed(elapsedMs)} into monitoring` : ''}`
              : `Agnes determined no action was needed${elapsedMs !== null ? ` · ${formatElapsed(elapsedMs)} monitoring time` : ''}`}
          </p>
          <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>{decision.reasoning}</p>
          <div className="decision-stats">
            {status === 'taken-down' ? (
              <>
                <span>{decision.abuseCount} abuse comments</span>
                <span>·</span>
                <span>{decision.urgentCount} urgent flags</span>
                <span>·</span>
                <span>{decision.riskScore}/100 risk score</span>
              </>
            ) : (
              <>
                <span>{decision.supportCount} supportive</span>
                <span>·</span>
                <span>{decision.riskScore}/100 risk score</span>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Section 5: Comment feed ── */}
      <div className="output-section" style={{ gap: 12 }}>
        <p className="block-label">Live comment feed</p>

        {currentAgent <= 7 && generatedComments.length === 0 ? (
          <div className="comment-feed-live">
            {[0, 1, 2].map((i) => (
              <div key={i} className="comment-entry comment-entry-constructive">
                <div
                  className="skeleton-line"
                  style={{ width: i === 0 ? '60%' : i === 1 ? '85%' : '45%' }}
                />
                <div className="skeleton-line skeleton-line-long" />
              </div>
            ))}
          </div>
        ) : (
          <div className="comment-feed-live">
            {[...generatedComments].reverse().map((comment) => (
              <div
                key={comment.id}
                className={`comment-entry comment-entry-${comment.category}`}
              >
                <div className="comment-meta">
                  <span className={`category-chip category-chip-${comment.category}`}>
                    {comment.category}
                  </span>
                  <span
                    className="risk-mini-chip"
                    style={riskChipStyle(comment.risk)}
                  >
                    {comment.risk} risk
                  </span>
                </div>
                <p style={{ color: 'var(--text-strong)', lineHeight: 1.5, fontSize: '0.95rem' }}>
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Change 3 — monitoring state indicator */}
        <div className="monitoring-indicator">
          {isClassifying ? (
            <span className="monitoring-indicator-active">
              <span className="monitoring-dot" aria-hidden="true" />
              Agnes monitoring for new comments...
            </span>
          ) : isCompleted ? (
            <span className="monitoring-indicator-done">
              ○ Monitoring complete — {generatedComments.length} comment{generatedComments.length === 1 ? '' : 's'} analysed
            </span>
          ) : null}
        </div>
      </div>

      {/* ── Section 6: Agent log ── */}
      <div className="agent-log-terminal">
        <div className="agent-log-terminal-header">
          <span className="block-label">Agent log · Agnes-Claw</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {agentLog.length} {agentLog.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div className="agent-log-terminal-body" ref={logBodyRef}>
          {agentLog.length === 0 ? (
            <span className="log-info">Initializing pipeline...</span>
          ) : (
            agentLog.map((entry) => (
              <div key={entry.id} className="log-line">
                <span className="log-time">[{formatLogTime(entry.time)}]</span>
                <span className={`log-${entry.type}`}>
                  {entry.agentName} · {entry.message}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export default PipelinePage
