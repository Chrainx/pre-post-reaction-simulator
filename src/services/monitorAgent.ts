import { isDemoMode } from './agnesApi'
import type { MonitorLogEntry, MonitoredComment, MonitorSession, SessionStatus } from '../types/monitor'

const BASE_URL = import.meta.env.VITE_AGNES_BASE_URL || 'https://api.anthropic.com'
const API_KEY = import.meta.env.VITE_AGNES_API_KEY || ''
const MODEL = import.meta.env.VITE_AGNES_MODEL || 'claude-sonnet-4-6'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function normalizeBaseUrl(): string {
  return BASE_URL.replace(/\/+$/, '')
}

function resolveMonitorUrl(path: string): string {
  const base = normalizeBaseUrl()
  if (base.endsWith(path)) return base
  if (base.endsWith('/v1') && path.startsWith('v1/')) return `${base}/${path.slice(3)}`
  return `${base}/${path}`
}

async function callMonitorModel(prompt: string): Promise<string> {
  const isAnthropic = normalizeBaseUrl().includes('anthropic')
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch(
      isAnthropic
        ? resolveMonitorUrl('v1/messages')
        : resolveMonitorUrl('v1/chat/completions'),
      {
        method: 'POST',
        signal: controller.signal,
        headers: isAnthropic
          ? {
              'Content-Type': 'application/json',
              'x-api-key': API_KEY,
              'anthropic-version': '2023-06-01',
            }
          : {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${API_KEY}`,
            },
        body: JSON.stringify(
          isAnthropic
            ? {
                model: MODEL,
                max_tokens: 60,
                messages: [{ role: 'user', content: prompt }],
              }
            : {
                model: MODEL,
                temperature: 0.2,
                messages: [{ role: 'user', content: prompt }],
              },
        ),
      },
    )

    if (!response.ok) {
      throw new Error(`Monitor API request failed with status ${response.status}.`)
    }

    const payload = (await response.json()) as unknown

    if (isAnthropic) {
      const data = payload as { content?: Array<{ type?: string; text?: string }> }
      const text = (data.content ?? [])
        .map((entry) => (typeof entry.text === 'string' ? entry.text : ''))
        .join('')
      return text
    }

    const data = payload as {
      choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>
    }
    const raw = data.choices?.[0]?.message?.content
    if (typeof raw === 'string') return raw
    if (Array.isArray(raw)) {
      return raw.map((e) => (typeof e.text === 'string' ? e.text : '')).join('')
    }
    return ''
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Monitor classification timed out.')
    }
    if (error instanceof Error) throw error
    throw new Error('Monitor classification failed unexpectedly.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function extractFirstJsonObject(text: string): string | null {
  let depth = 0
  let start = -1
  let inString = false
  let escaping = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (escaping) { escaping = false; continue }
    if (char === '\\') { escaping = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '{') {
      if (depth === 0) start = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && start !== -1) return text.slice(start, i + 1)
    }
  }
  return null
}

export function computeRiskScore(comments: MonitoredComment[]): number {
  let score = 0
  let supportDeduction = 0

  for (const comment of comments) {
    switch (comment.category) {
      case 'abuse':
        score += 15
        break
      case 'urgent':
        score += 20
        break
      case 'spam':
        score += 5
        break
      case 'support':
        supportDeduction = Math.min(20, supportDeduction + 5)
        break
      case 'constructive':
        break
    }
  }

  return Math.max(0, Math.min(100, score - supportDeduction))
}

export function getMonitorStatus(
  score: number,
  threshold: number,
  takenDown: boolean,
): SessionStatus {
  if (takenDown) return 'taken-down'
  if (score >= threshold) return 'flagged'
  if (score > 0) return 'watching'
  return 'idle'
}

export async function classifyCommentWithAI(
  text: string,
): Promise<Pick<MonitoredComment, 'risk' | 'category'>> {
  const fallback: Pick<MonitoredComment, 'risk' | 'category'> = {
    risk: 'medium',
    category: 'constructive',
  }

  if (isDemoMode()) {
    const lower = text.toLowerCase()
    if (
      lower.includes('employer') ||
      lower.includes('screenshot') ||
      lower.includes('report')
    ) {
      return { risk: 'high', category: 'urgent' }
    }
    if (
      lower.includes('bot') ||
      lower.includes('promo') ||
      lower.includes('click here') ||
      lower.includes('.io') ||
      lower.includes('.com')
    ) {
      return { risk: 'low', category: 'spam' }
    }
    if (
      lower.includes('garbage') ||
      lower.includes('ratio') ||
      lower.includes('problem') ||
      lower.includes('society') ||
      lower.includes('people like you')
    ) {
      return { risk: 'high', category: 'abuse' }
    }
    if (
      lower.includes('agree') ||
      lower.includes('great') ||
      lower.includes('love') ||
      lower.includes('support')
    ) {
      return { risk: 'low', category: 'support' }
    }
    return { risk: 'medium', category: 'constructive' }
  }

  try {
    const prompt = `Classify this social media comment for a content moderation agent.
Comment: "${text}"
Return JSON only: {"risk": "low|medium|high", "category": "support|constructive|spam|abuse|urgent"}`

    const raw = await callMonitorModel(prompt)
    const extracted = extractFirstJsonObject(raw)
    if (!extracted) return fallback

    const parsed = JSON.parse(extracted) as unknown
    if (!isRecord(parsed)) return fallback

    const riskValues = ['low', 'medium', 'high']
    const categoryValues = ['support', 'constructive', 'spam', 'abuse', 'urgent']

    const risk = riskValues.includes(parsed.risk as string)
      ? (parsed.risk as MonitoredComment['risk'])
      : fallback.risk
    const category = categoryValues.includes(parsed.category as string)
      ? (parsed.category as MonitoredComment['category'])
      : fallback.category

    return { risk, category }
  } catch {
    return fallback
  }
}

export async function addComment(
  session: MonitorSession,
  text: string,
): Promise<{ session: MonitorSession; triggered: boolean }> {
  const { risk, category } = await classifyCommentWithAI(text)

  const comment: MonitoredComment = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    text,
    risk,
    category,
    timestamp: Date.now(),
  }

  const comments = [...session.comments, comment]
  const riskScore = computeRiskScore(comments)
  const now = Date.now()

  const logEntries: MonitorLogEntry[] = [
    {
      time: now,
      message: `Comment classified: ${category} / ${risk} risk`,
      type: 'info',
    },
    {
      time: now + 1,
      message: `Aggregate risk score: ${riskScore}/100`,
      type: riskScore >= session.threshold ? 'warning' : 'info',
    },
  ]

  if (riskScore >= session.threshold && session.status !== 'taken-down') {
    logEntries.push({
      time: now + 2,
      message: '⚠️ Risk threshold exceeded — initiating takedown sequence',
      type: 'warning',
    })
    logEntries.push({
      time: now + 3,
      message: '✓ POST HIDDEN — Agnes agent acted autonomously',
      type: 'action',
    })

    return {
      session: {
        ...session,
        comments,
        riskScore,
        status: 'taken-down',
        takenDownAt: now,
        agentLog: [...session.agentLog, ...logEntries],
      },
      triggered: true,
    }
  }

  const status = getMonitorStatus(riskScore, session.threshold, false)

  return {
    session: {
      ...session,
      comments,
      riskScore,
      status,
      agentLog: [...session.agentLog, ...logEntries],
    },
    triggered: false,
  }
}

export const DEMO_COMMENTS = [
  'This is actually a great point, fully agree with you here',
  'Absolute garbage take, ratio incoming lmao',
  'Can you provide sources for this claim?',
  'Buy followers at bot-shop.io use code PROMO50',
  "I'm screenshotting this and sending to your employer",
  'People like you are the problem with society',
]
