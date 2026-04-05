export type MonitorStatus = 'idle' | 'running' | 'flagged' | 'safe' | 'taken-down'

export type CommentCategory = 'support' | 'constructive' | 'abuse' | 'urgent'

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
  threshold: number
  decision: TakedownDecision | null
  agentLog: AgentLogEntry[]
  startedAt: number | null
  completedAt: number | null
}
