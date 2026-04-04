import { useEffect, useRef, useState } from 'react'
import { DEMO_COMMENTS, addComment } from './services/monitorAgent'
import type { MonitorLogEntry, MonitorSession, SessionStatus } from './types/monitor'

type MonitorPageProps = {
  postText: string
  onBack: () => void
}

function getRiskMeterColor(score: number): string {
  if (score >= 70) return '#e24b4a'
  if (score >= 40) return '#ef9f27'
  return '#1d9e75'
}

function formatLogTime(ts: number): string {
  const d = new Date(ts)
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0'))
    .join(':')
}

function formatRelativeTime(ts: number): string {
  const delta = Math.floor((Date.now() - ts) / 1000)
  if (delta < 5) return 'just now'
  if (delta < 60) return `${delta}s ago`
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`
  return `${Math.floor(delta / 3600)}h ago`
}

function statusDotClass(status: SessionStatus): string {
  switch (status) {
    case 'watching': return 'status-dot status-dot-watching'
    case 'flagged': return 'status-dot status-dot-flagged'
    case 'taken-down': return 'status-dot status-dot-taken-down'
    default: return 'status-dot status-dot-idle'
  }
}

function statusPillLabel(status: SessionStatus): string {
  switch (status) {
    case 'watching': return 'watching'
    case 'flagged': return 'flagged'
    case 'taken-down': return 'taken down'
    default: return 'idle'
  }
}

function statusPillStyle(status: SessionStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 12px',
    fontSize: '0.78rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  }
  switch (status) {
    case 'watching':
      return { ...base, background: 'rgba(29,158,117,0.14)', color: '#176f54' }
    case 'flagged':
      return { ...base, background: '#faeeda', color: '#9a6207' }
    case 'taken-down':
      return { ...base, background: '#fcebeb', color: '#9c2e2e' }
    default:
      return { ...base, background: 'rgba(136,135,128,0.12)', color: '#888780' }
  }
}

function logEntryClass(type: MonitorLogEntry['type']): string {
  switch (type) {
    case 'warning': return 'log-entry log-warning'
    case 'action': return 'log-entry log-action'
    case 'success': return 'log-entry log-success'
    default: return 'log-entry log-info'
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function MonitorPage({ postText, onBack }: MonitorPageProps) {
  const [session, setSession] = useState<MonitorSession>({
    postText,
    status: 'idle',
    comments: [],
    riskScore: 0,
    takenDownAt: null,
    agentLog: [],
    threshold: 70,
  })
  const [manualInput, setManualInput] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [demoIndex, setDemoIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'paste' | 'simulate'>('simulate')
  const [logOpen, setLogOpen] = useState(true)
  const [, setTick] = useState(0)
  const logBodyRef = useRef<HTMLDivElement>(null)
  const simulatingRef = useRef(false)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (logOpen && logBodyRef.current) {
      logBodyRef.current.scrollTop = logBodyRef.current.scrollHeight
    }
  }, [session.agentLog, logOpen])

  const handleThresholdChange = (value: number) => {
    setSession((prev) => ({ ...prev, threshold: value }))
  }

  const handlePasteProcess = async () => {
    const lines = manualInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    if (!lines.length || isProcessing) return

    setIsProcessing(true)
    let currentSession = session

    for (let i = 0; i < lines.length; i++) {
      const { session: nextSession, triggered } = await addComment(currentSession, lines[i])
      currentSession = nextSession
      setSession({ ...nextSession })

      if (triggered || nextSession.status === 'taken-down') break
      if (i < lines.length - 1) await sleep(300)
    }

    setManualInput('')
    setIsProcessing(false)
  }

  const handleSimulate = async () => {
    if (isProcessing || simulatingRef.current || session.status === 'taken-down') return

    simulatingRef.current = true
    setIsProcessing(true)

    let currentSession = session
    let currentIndex = demoIndex

    for (let i = currentIndex; i < DEMO_COMMENTS.length; i++) {
      if (!simulatingRef.current) break

      const { session: nextSession, triggered } = await addComment(
        currentSession,
        DEMO_COMMENTS[i],
      )
      currentSession = nextSession
      currentIndex = i + 1
      setSession({ ...nextSession })
      setDemoIndex(i + 1)

      if (triggered || nextSession.status === 'taken-down') break
      if (i < DEMO_COMMENTS.length - 1) await sleep(900)
    }

    simulatingRef.current = false
    setIsProcessing(false)
  }

  useEffect(() => {
    return () => {
      simulatingRef.current = false
    }
  }, [])

  const takenDownTime = session.takenDownAt
    ? new Date(session.takenDownAt).toLocaleTimeString()
    : ''

  const allDemoUsed = demoIndex >= DEMO_COMMENTS.length
  const simulateDisabled =
    isProcessing || session.status === 'taken-down' || allDemoUsed

  const fillColor = getRiskMeterColor(session.riskScore)

  return (
    <section className="monitor-page">
      {/* Header */}
      <div className="monitor-header">
        <button className="back-link" type="button" onClick={onBack}>
          ← Back to results
        </button>

        <div className="monitor-title-group">
          <span className={statusDotClass(session.status)} aria-hidden="true" />
          <h2 style={{ margin: 0, fontFamily: 'var(--heading)', fontSize: 'clamp(1.2rem, 2.5vw, 1.6rem)' }}>
            Live Monitor
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span
            className="block-label"
            style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}
          >
            Auto-takedown at:
          </span>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.92rem',
              color: 'var(--text-strong)',
              minWidth: 32,
              textAlign: 'right',
            }}
          >
            {session.threshold}
          </span>
          <input
            type="range"
            min={40}
            max={90}
            step={5}
            value={session.threshold}
            disabled={session.status === 'taken-down'}
            onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
            style={{ width: 90, cursor: session.status === 'taken-down' ? 'not-allowed' : 'pointer' }}
            aria-label="Auto-takedown threshold"
          />
        </div>
      </div>

      {/* Post preview */}
      <div className="output-section draft-card">
        <div className="section-header">
          <div>
            <p className="block-label">Monitored post</p>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>Draft Preview</h3>
          </div>
          <span style={statusPillStyle(session.status)}>{statusPillLabel(session.status)}</span>
        </div>
        <div className="draft-preview">
          <p>{postText}</p>
        </div>
      </div>

      {/* Risk meter */}
      <div className="output-section" style={{ gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="block-label">Aggregate risk score</p>
          <span
            style={{
              fontWeight: 700,
              fontSize: '0.88rem',
              color: fillColor,
            }}
          >
            {session.riskScore}/100
          </span>
        </div>

        <div className="risk-meter-track">
          <div
            className="risk-meter-fill"
            style={
              {
                '--fill-width': `${session.riskScore}%`,
                background: fillColor,
              } as React.CSSProperties
            }
          />
          <div
            className="risk-meter-tick"
            style={{ left: `${session.threshold}%` }}
            title={`Takedown threshold: ${session.threshold}`}
          />
        </div>

        <div style={{ position: 'relative', height: 18 }}>
          <span
            style={{
              position: 'absolute',
              left: `${session.threshold}%`,
              transform: 'translateX(-50%)',
              fontSize: 10,
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
            }}
          >
            takedown threshold
          </span>
        </div>
      </div>

      {/* Status banner */}
      {session.status !== 'idle' && (
        <div
          className={`monitor-status-banner ${
            session.status === 'watching'
              ? 'monitor-status-watching'
              : session.status === 'flagged'
                ? 'monitor-status-flagged'
                : 'monitor-status-taken-down'
          }`}
        >
          {session.status === 'watching' &&
            '🤖 Agnes agent is monitoring your post in real time'}
          {session.status === 'flagged' &&
            '⚠️ Risk elevated — agent is watching closely'}
          {session.status === 'taken-down' &&
            `✓ POST TAKEN DOWN — Agnes agent acted at ${takenDownTime}`}
        </div>
      )}

      {/* Comment input area */}
      <div className="output-section" style={{ gap: 14 }}>
        <div className="tab-row">
          <button
            type="button"
            className={`tab-btn${activeTab === 'simulate' ? ' tab-btn-active' : ''}`}
            onClick={() => setActiveTab('simulate')}
          >
            ▶ Simulate live
          </button>
          <button
            type="button"
            className={`tab-btn${activeTab === 'paste' ? ' tab-btn-active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            Paste comments
          </button>
        </div>

        {activeTab === 'simulate' ? (
          <div style={{ display: 'grid', gap: 10 }}>
            <p className="helper-text">
              Plays through {DEMO_COMMENTS.length} pre-set comments one by one — watch the risk
              meter climb in real time.
              {allDemoUsed && ' All demo comments used.'}
            </p>
            <button
              type="button"
              className="analyze-button"
              style={{ justifySelf: 'start', minWidth: 240 }}
              onClick={handleSimulate}
              disabled={simulateDisabled}
            >
              {isProcessing && simulatingRef.current
                ? '⏳ Simulating...'
                : allDemoUsed
                  ? 'All comments used'
                  : session.status === 'taken-down'
                    ? 'Post taken down'
                    : `▶ Simulate incoming comments (${DEMO_COMMENTS.length - demoIndex} left)`}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <textarea
              className="post-input"
              style={{ minHeight: 100, fontSize: '0.95rem' }}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Paste comments here, one per line..."
              rows={4}
              disabled={isProcessing || session.status === 'taken-down'}
            />
            <button
              type="button"
              className="analyze-button"
              style={{ justifySelf: 'start' }}
              onClick={handlePasteProcess}
              disabled={
                isProcessing ||
                session.status === 'taken-down' ||
                !manualInput.trim()
              }
            >
              {isProcessing ? 'Processing...' : 'Process comments'}
            </button>
          </div>
        )}
      </div>

      {/* Comments feed */}
      {session.comments.length > 0 && (
        <div className="output-section" style={{ gap: 12 }}>
          <p className="block-label">Comments feed</p>
          <div className="comment-feed">
            {[...session.comments].reverse().map((comment) => (
              <div
                key={comment.id}
                className={`comment-entry comment-entry-${comment.category}`}
              >
                <div className="comment-entry-meta">
                  <span className={`category-chip category-chip-${comment.category}`}>
                    {comment.category}
                  </span>
                  <span
                    className="risk-mini-chip"
                    style={{
                      color:
                        comment.risk === 'high'
                          ? '#9c2e2e'
                          : comment.risk === 'medium'
                            ? '#9a6207'
                            : '#176f54',
                      background:
                        comment.risk === 'high'
                          ? '#fcebeb'
                          : comment.risk === 'medium'
                            ? '#faeeda'
                            : 'rgba(29,158,117,0.1)',
                    }}
                  >
                    {comment.risk} risk
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {formatRelativeTime(comment.timestamp)}
                  </span>
                </div>
                <p style={{ lineHeight: 1.5, color: 'var(--text-strong)', fontSize: '0.95rem' }}>
                  {comment.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent log */}
      <div className="agent-log-panel">
        <div
          className="agent-log-header"
          onClick={() => setLogOpen((o) => !o)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') setLogOpen((o) => !o)
          }}
          aria-expanded={logOpen}
        >
          <span className="block-label">Agent log</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {logOpen ? '▲ collapse' : '▼ expand'}
          </span>
        </div>

        {logOpen && (
          <div className="agent-log-body" ref={logBodyRef}>
            {session.agentLog.length === 0 ? (
              <span className="log-info log-entry">
                No activity yet — add comments to start monitoring.
              </span>
            ) : (
              session.agentLog.map((entry, i) => (
                <div key={i} className={logEntryClass(entry.type)}>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    [{formatLogTime(entry.time)}]
                  </span>
                  <span>· {entry.message}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default MonitorPage
