import { callModel, isDemoMode } from './agnesApi'
import type { PersonaReaction, Platform, Region, SynthesisResult } from '../types/personas'
import type {
  AgentLogEntry,
  AutonomousPipelineState,
  GeneratedComment,
  TakedownDecision,
} from '../types/monitor'

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function generateId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

// Between 400ms and 2800ms — feels like real unpredictable comment arrival
function getRandomDelay(): number {
  return Math.floor(Math.random() * 2400) + 400
}

function makeLogEntry(
  agentName: string,
  message: string,
  type: AgentLogEntry['type'] = 'info',
): AgentLogEntry {
  return { id: generateId(), time: Date.now(), agentName, message, type }
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
    if (char === '{') { if (depth === 0) start = i; depth++ }
    else if (char === '}') {
      depth--
      if (depth === 0 && start !== -1) return text.slice(start, i + 1)
    }
  }
  return null
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf('[')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaping = false
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (escaping) { escaping = false; continue }
    if (char === '\\') { escaping = true; continue }
    if (char === '"') { inString = !inString; continue }
    if (inString) continue
    if (char === '[') depth++
    else if (char === ']') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function computePipelineRiskScore(comments: GeneratedComment[]): number {
  let score = 0
  let supportDeduction = 0
  for (const c of comments) {
    if (c.category === 'abuse') score += 15
    else if (c.category === 'urgent') score += 20
    else if (c.category === 'spam') score += 5
    else if (c.category === 'support') supportDeduction = Math.min(20, supportDeduction + 5)
  }
  return Math.max(0, Math.min(100, score - supportDeduction))
}

const DEMO_COMMENT_WAVE: string[] = [
  'This is actually a really good take, fully agree',
  'Lah this one quite bold sia, respect the honesty',
  'Absolute garbage, ratio incoming',
  'Can you provide sources for this claim?',
  'Buy 10k followers at bot-shop.io code PROMO50',
  "I've shared this with my whole team, so good",
  'People like you are the problem with society honestly',
  "I'm screenshotting this and sending to your employer",
  "This is misinformation and I'm reporting it",
  'Finally someone said it!! Saving this post',
  'Imagine thinking this is a hot take lmao',
  'Unfollowing, this used to be good content',
  'SPAM SPAM FREE GIFT CARDS followme.biz SPAM',
  'This caused real harm to people in my community',
  'Not sure I agree but interesting perspective',
]

async function generateCommentWave(
  postText: string,
  personas: PersonaReaction[],
  region: Region,
): Promise<string[]> {
  if (isDemoMode()) {
    return DEMO_COMMENT_WAVE
  }

  const personaSummary = personas
    .map((p) => `${p.name}: ${p.tone} tone, ${p.risk} risk`)
    .join('\n')

  const prompt = `You are simulating the realistic comment section that would appear on a social media post.
Based on this post and these audience reactions, generate exactly 15 realistic social media comments that this post would receive.

Post: "${postText}"
Platform audience reactions summary:
${personaSummary}
Region: ${region === 'singapore' ? 'Singapore/SEA — include Singlish naturally' : 'Global'}

Generate a realistic mix: some supportive, some critical, some abusive if the reactions suggest it, some spam bots, some urgent/serious complaints if relevant.
Make them feel like real internet comments — varied length, casual tone, typos ok.

Return JSON only — array of 15 strings:
["comment 1", "comment 2", ...]`

  try {
    const raw = await callModel(prompt, 1500)
    const extracted = extractJsonArray(raw)
    if (!extracted) return DEMO_COMMENT_WAVE
    const parsed = JSON.parse(extracted) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed as string[]
    }
  } catch {
    // fall through to demo
  }
  return DEMO_COMMENT_WAVE
}

async function classifyComment(
  text: string,
): Promise<Pick<GeneratedComment, 'risk' | 'category'>> {
  const fallback: Pick<GeneratedComment, 'risk' | 'category'> = {
    risk: 'medium',
    category: 'constructive',
  }

  if (isDemoMode()) {
    const lower = text.toLowerCase()
    if (
      lower.includes('employer') ||
      lower.includes('screenshot') ||
      lower.includes('report') ||
      lower.includes('harm') ||
      lower.includes('misinformation')
    ) {
      return { risk: 'high', category: 'urgent' }
    }
    if (
      lower.includes('garbage') ||
      lower.includes('ratio') ||
      lower.includes('problem with society') ||
      lower.includes('unfollowing')
    ) {
      return { risk: 'high', category: 'abuse' }
    }
    if (
      lower.includes('bot') ||
      lower.includes('promo') ||
      lower.includes('spam') ||
      lower.includes('followers') ||
      lower.includes('.biz') ||
      lower.includes('.io')
    ) {
      return { risk: 'low', category: 'spam' }
    }
    if (
      lower.includes('agree') ||
      lower.includes('good') ||
      lower.includes('great') ||
      lower.includes('finally') ||
      lower.includes('saving') ||
      lower.includes('team') ||
      lower.includes('respect')
    ) {
      return { risk: 'low', category: 'support' }
    }
    return fallback
  }

  try {
    const prompt = `Classify this social media comment. Return JSON only:
{"risk": "low|medium|high", "category": "support|constructive|spam|abuse|urgent"}
Comment: "${text}"`

    const raw = await callModel(prompt, 80)
    const extracted = extractFirstJsonObject(raw)
    if (!extracted) return fallback

    const parsed = JSON.parse(extracted) as unknown
    if (!isRecord(parsed)) return fallback

    const riskValues = ['low', 'medium', 'high']
    const categoryValues = ['support', 'constructive', 'spam', 'abuse', 'urgent']

    const risk = riskValues.includes(parsed.risk as string)
      ? (parsed.risk as GeneratedComment['risk'])
      : fallback.risk
    const category = categoryValues.includes(parsed.category as string)
      ? (parsed.category as GeneratedComment['category'])
      : fallback.category

    return { risk, category }
  } catch {
    return fallback
  }
}

async function makeTakedownDecision(
  postText: string,
  _personas: PersonaReaction[],
  synthesis: SynthesisResult,
  comments: GeneratedComment[],
  threshold: number,
): Promise<TakedownDecision> {
  const abuseCount = comments.filter((c) => c.category === 'abuse').length
  const urgentCount = comments.filter((c) => c.category === 'urgent').length
  const spamCount = comments.filter((c) => c.category === 'spam').length
  const supportCount = comments.filter((c) => c.category === 'support').length
  const riskScore = Math.max(
    0,
    Math.min(100, abuseCount * 15 + urgentCount * 20 + spamCount * 5 - Math.min(supportCount * 5, 20)),
  )

  if (isDemoMode()) {
    await sleep(800)
    if (riskScore >= threshold) {
      return {
        action: 'take-down',
        riskScore,
        reasoning: `Agnes detected ${abuseCount} abusive comments and ${urgentCount} urgent flags. Aggregate risk score ${riskScore}/100 exceeds the safety threshold of ${threshold}. Autonomous takedown initiated to protect account reputation.`,
        abuseCount,
        urgentCount,
        spamCount,
        supportCount,
      }
    }
    return {
      action: 'post-safe',
      riskScore,
      reasoning: `Comment wave analysis shows ${supportCount} supportive reactions outweigh negative signals. Risk score ${riskScore}/100 is within the acceptable threshold of ${threshold}. Post is safe to remain live.`,
      abuseCount,
      urgentCount,
      spamCount,
      supportCount,
    }
  }

  const prompt = `You are an autonomous content moderation agent making a final decision.

Original post: "${postText}"
Pre-post risk assessment: ${synthesis.risk_level} risk — "${synthesis.what_could_go_wrong}"
Comment analysis: ${abuseCount} abusive, ${urgentCount} urgent/serious, ${spamCount} spam, ${supportCount} supportive
Aggregate risk score: ${riskScore}/100
Takedown threshold: ${threshold}/100

Make an autonomous decision: should this post be taken down?
Consider: risk score at or above ${threshold} = take down. Well below = safe. Use judgment in between.

Return JSON only:
{
  "action": "post-safe|take-down",
  "riskScore": ${riskScore},
  "reasoning": "2-3 sentence explanation of the decision",
  "abuseCount": ${abuseCount},
  "urgentCount": ${urgentCount},
  "spamCount": ${spamCount},
  "supportCount": ${supportCount}
}`

  try {
    const raw = await callModel(prompt, 400)
    const extracted = extractFirstJsonObject(raw)
    if (!extracted) throw new Error('No JSON found')
    const parsed = JSON.parse(extracted) as unknown
    if (!isRecord(parsed)) throw new Error('Invalid JSON shape')

    const action =
      parsed.action === 'take-down' || parsed.action === 'post-safe'
        ? parsed.action
        : riskScore >= threshold
          ? 'take-down'
          : 'post-safe'
    const reasoning =
      typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : `Autonomous decision based on risk score ${riskScore}/100.`

    return { action, riskScore, reasoning, abuseCount, urgentCount, spamCount, supportCount }
  } catch {
    return {
      action: riskScore >= threshold ? 'take-down' : 'post-safe',
      riskScore,
      reasoning: `Autonomous decision based on risk score ${riskScore}/100. ${riskScore >= threshold ? 'Takedown initiated.' : 'Post remains live.'}`,
      abuseCount,
      urgentCount,
      spamCount,
      supportCount,
    }
  }
}

// Finalise pipeline after Agent 9 decision — shared by both early and end-of-stream paths
async function finalisePipeline(
  state: AutonomousPipelineState,
  decision: TakedownDecision,
  demo: boolean,
  log: (agentName: string, message: string, type?: AgentLogEntry['type']) => void,
  onProgress: (s: AutonomousPipelineState) => void,
  _threshold: number,
): Promise<AutonomousPipelineState> {
  let s = { ...state, decision }

  if (decision.action === 'take-down') {
    log('Agent 9', `Risk score ${decision.riskScore}/100 — threshold exceeded`, 'warning')
    log('Agent 9', 'Initiating autonomous takedown sequence...', 'action')
    onProgress({ ...s })

    if (demo) await sleep(600)

    log('Agent 9', '✓ POST HIDDEN — Agnes acted autonomously. Account protected.', 'success')
    s = { ...s, status: 'taken-down', completedAt: Date.now() }
  } else {
    log('Agent 9', '✓ POST SAFE — Agnes determined risk is acceptable. No action taken.', 'success')
    s = { ...s, status: 'safe', completedAt: Date.now() }
  }

  onProgress({ ...s })
  return s
}

export async function runAutonomousPipeline(
  postText: string,
  platform: Platform,
  region: Region,
  personas: PersonaReaction[],
  synthesis: SynthesisResult,
  threshold: number,
  onProgress: (state: AutonomousPipelineState) => void,
): Promise<AutonomousPipelineState> {
  const demo = isDemoMode()

  // Suppress unused-param warning — platform may be used in future real-mode prompt
  void platform

  let state: AutonomousPipelineState = {
    status: 'running',
    currentAgent: 7,
    generatedComments: [],
    riskScore: 0,
    threshold,
    decision: null,
    agentLog: [],
    startedAt: Date.now(),
    completedAt: null,
  }

  function log(agentName: string, message: string, type: AgentLogEntry['type'] = 'info'): void {
    state = { ...state, agentLog: [...state.agentLog, makeLogEntry(agentName, message, type)] }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  log('Agnes-Claw', 'Pipeline initiated — Agnes-Claw autonomous protection active')
  onProgress({ ...state })
  if (demo) await sleep(800)

  // ── Agent 7 — Comment Wave ────────────────────────────────────────────────
  log('Agent 7', 'Generating realistic comment wave based on audience reactions...')
  state = { ...state, currentAgent: 7 }
  onProgress({ ...state })
  if (demo) await sleep(2500)

  const rawComments = await generateCommentWave(postText, personas, region)

  log('Agent 7', `Generated ${rawComments.length} comments — beginning classification`, 'success')
  state = { ...state, currentAgent: 8 }
  onProgress({ ...state })
  if (demo) await sleep(500)

  // ── Agent 8 — Classify each comment, with early-exit if threshold crossed ─
  let earlyExited = false

  for (let i = 0; i < rawComments.length; i++) {
    const text = rawComments[i]
    const { risk, category } = await classifyComment(text)

    const comment: GeneratedComment = {
      id: generateId(),
      text,
      risk,
      category,
      classifiedAt: Date.now(),
    }

    const newComments = [...state.generatedComments, comment]
    const newRiskScore = computePipelineRiskScore(newComments)
    const truncated = text.length > 50 ? `${text.slice(0, 50)}...` : text

    log('Agent 8', `[${category}] "${truncated}" → risk: ${risk}`)
    state = { ...state, generatedComments: newComments, riskScore: newRiskScore }

    // First time crossing threshold — flag it
    if (newRiskScore >= threshold && state.status !== 'flagged' && state.status !== 'taken-down') {
      state = { ...state, status: 'flagged' }
    }

    onProgress({ ...state })

    // ── Early Agent 9 trigger ──────────────────────────────────────────────
    if (newRiskScore >= threshold && state.decision === null) {
      const remaining = rawComments.length - i - 1
      log('Agent 8', '⚠️ Risk threshold crossed mid-stream — Agent 9 activating early', 'warning')
      if (remaining > 0) {
        log('Agent 8', `Pipeline halted — ${remaining} comment${remaining === 1 ? '' : 's'} unread`, 'warning')
      }
      state = { ...state, currentAgent: 9 }
      onProgress({ ...state })

      if (demo) await sleep(1500)

      const decision = await makeTakedownDecision(postText, personas, synthesis, state.generatedComments, threshold)
      state = await finalisePipeline(state, decision, demo, log, onProgress, threshold)
      earlyExited = true
      break
    }

    // Random delay between comments in demo mode; 0ms in real mode (webhook-driven)
    if (demo && i < rawComments.length - 1) await sleep(getRandomDelay())
  }

  if (earlyExited) {
    return state
  }

  // ── Agent 9 — Normal end-of-stream decision ───────────────────────────────
  log('Agent 9', 'All comments classified — running autonomous decision engine...')
  state = { ...state, currentAgent: 9 }
  onProgress({ ...state })
  if (demo) await sleep(1500)

  const decision = await makeTakedownDecision(postText, personas, synthesis, state.generatedComments, threshold)
  return finalisePipeline(state, decision, demo, log, onProgress, threshold)
}
