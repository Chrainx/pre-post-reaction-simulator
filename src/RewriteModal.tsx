import { createPortal } from 'react-dom'

type RewriteModalProps = {
  originalText: string
  rewrittenText: string
  isLoading: boolean
  onAccept: (text: string) => void
  onDismiss: () => void
}

function RewriteModal({ originalText, rewrittenText, isLoading, onAccept, onDismiss }: RewriteModalProps) {
  return createPortal(
    <div className="rewrite-overlay" onClick={(e) => { if (e.target === e.currentTarget) onDismiss() }}>
      <div className="rewrite-modal">
        {/* Header */}
        <div className="rewrite-modal-header">
          <h3 style={{ margin: 0, fontFamily: 'var(--heading)', fontSize: '1.3rem' }}>
            AI Rewrite
          </h3>
          <button type="button" className="rewrite-dismiss-btn" onClick={onDismiss}>
            × dismiss
          </button>
        </div>

        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Agnes rewrote your draft to reduce PR risk while preserving your voice.
        </p>

        {/* Loading state */}
        {isLoading ? (
          <div className="rewrite-loading">
            <p className="rewrite-loading-text">Agnes is rewriting your draft...</p>
            <div className="skeleton-line skeleton-line-long" />
            <div className="skeleton-line skeleton-line-medium" />
            <div className="skeleton-line skeleton-line-short" />
          </div>
        ) : (
          <>
            {/* Comparison panels */}
            <div className="rewrite-comparison">
              <div className="rewrite-panel">
                <span className="rewrite-panel-label rewrite-panel-label-original">Original</span>
                <div className="rewrite-text-box rewrite-text-box-original">{originalText}</div>
                <span className="rewrite-risk-label rewrite-risk-label-original">High PR risk</span>
              </div>
              <div className="rewrite-panel">
                <span className="rewrite-panel-label rewrite-panel-label-rewrite">Agnes Rewrite</span>
                <div className="rewrite-text-box rewrite-text-box-rewrite">{rewrittenText}</div>
                <span className="rewrite-risk-label rewrite-risk-label-rewrite">Lower PR risk</span>
              </div>
            </div>

            <p className="rewrite-diff-hint">
              Agnes softened the tone and reduced language likely to cause negative reactions.
            </p>
          </>
        )}

        {/* Footer */}
        <div className="rewrite-modal-footer">
          <button type="button" className="rewrite-dismiss-action" onClick={onDismiss}>
            Dismiss
          </button>
          {!isLoading && (
            <button type="button" className="rewrite-accept-btn" onClick={() => onAccept(rewrittenText)}>
              Use this draft
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default RewriteModal
