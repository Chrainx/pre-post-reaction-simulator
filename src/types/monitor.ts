// ─── Session / Monitor Page types (used by MonitorPage and monitorAgent.ts) ──

export type SessionStatus = 'idle' | 'watching' | 'flagged' | 'taken-down'

export interface MonitorLogEntry {
  time: number
  message: string
  type: 'info' | 'warning' | 'action' | 'success'
}

export interface MonitoredComment {
  id: string
  text: string
  risk: 'low' | 'medium' | 'high'
  category: 'support' | 'constructive' | 'spam' | 'abuse' | 'urgent'
  timestamp: number
}

export interface MonitorSession {
  postText: string
  status: SessionStatus
  comments: MonitoredComment[]
  riskScore: number
  takenDownAt: number | null
  agentLog: MonitorLogEntry[]
  threshold: number
}

// ─── Autonomous Pipeline types ────────────────────────────────────────────────

export type MonitorStatus = 'idle' | 'running' | 'flagged' | 'safe' | 'taken-down'

export type CommentCategory = 'support' | 'constructive' | 'spam' | 'abuse' | 'urgent'

export interface GeneratedComment {
  id: string
  text: string
  risk: 'low' | 'medium' | 'high'
  category: CommentCategory
  classifiedAt: number
}

export interface TakedownDecision {
  action: 'post-safe' | 'take-down'
  riskScore: number
  reasoning: string
  abuseCount: number
  urgentCount: number
  spamCount: number
  supportCount: number
}

export interface AgentLogEntry {
  id: string
  time: number
  agentName: string
  message: string
  type: 'info' | 'warning' | 'action' | 'success' | 'error'
}

export interface AutonomousPipelineState {
  status: MonitorStatus
  currentAgent: number
  generatedComments: GeneratedComment[]
  riskScore: number
  decision: TakedownDecision | null
  agentLog: AgentLogEntry[]
  startedAt: number | null
  completedAt: number | null
}
