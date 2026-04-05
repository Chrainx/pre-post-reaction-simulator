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
    // spam: ignored — bots don't reflect real sentiment
    else if (c.category === 'support') supportDeduction += 2
  }
  return Math.max(0, Math.min(100, score - supportDeduction))
}

// Build demo comments that actually reference the post and are weighted by risk level
function buildDemoCommentWave(
  postText: string,
  synthesis: SynthesisResult,
  region: Region,
): string[] {
  const preview = postText.length > 70 ? `${postText.slice(0, 67)}...` : postText
  const sea = region === 'singapore'
  const risk = synthesis.risk_level

  // High risk → heavy negative skew (~65% negative, 20% neutral, 15% supportive)
  // Medium risk → ~40% negative, 35% neutral, 25% supportive
  // Low risk → ~15% negative, 35% neutral, 50% supportive
  if (risk === 'high') {
    return [
      `This is exactly the kind of post that gets people fired. Think before you tweet.`,
      sea ? `Wah lao, you really posted this? Cannot lah.` : `Genuinely can't believe you thought this was okay to say publicly.`,
      `I'm screenshotting this and sending it to your employer.`,
      `The audacity is unreal. Ratio incoming.`,
      `This caused real harm to people in my community. Take it down.`,
      `Reporting this. This is exactly the kind of content that shouldn't be on this platform.`,
      `"${preview}" — did you actually think about who this affects?`,
      `People like you are exactly why this platform is toxic.`,
      sea ? `Alamak, so tone deaf sia. Your PR team must be crying.` : `Your PR team is going to have a very long day.`,
      `Unfollowing. I used to respect this account.`,
      `Not gonna lie, I see the point but the wording is really bad.`,
      `Interesting take but I can see why people are upset.`,
      `Okay I actually agree with the core point, even if badly put.`,
      `Bold of you to post this. Respect the honesty at least.`,
      sea ? `Eh, give chance lah, at least they're being real.` : `Finally someone saying this out loud, even if clumsy.`,
    ]
  }

  if (risk === 'medium') {
    return [
      `"${preview}" — not sure I fully agree with this framing.`,
      sea ? `Hmm, quite bold take sia. Got some points but also some holes.` : `Bold take. I see where you're coming from but it's more nuanced than this.`,
      `This is going to be misread by a lot of people.`,
      `Can you provide sources or context for this claim?`,
      `The intent is fine but the wording is going to backfire.`,
      `I've shared this with some people and reactions are very mixed.`,
      `Okay the core message is valid but the way it's said is the problem.`,
      sea ? `Wah, some people are going to take this out of context leh.` : `People are going to screenshot the worst part of this.`,
      `Interesting perspective. Disagree on the specifics though.`,
      `This is a bit much but I get the frustration.`,
      `Actually agree with this 100%. Well said.`,
      sea ? `Finally someone said it! Shiok.` : `Finally someone with the guts to say this out loud.`,
      `This is the take I needed today. Saving this.`,
      `Couldn't agree more. Sharing this.`,
      sea ? `Very good point lah, people just don't want to hear it.` : `Not sure I agree but this is worth discussing.`,
    ]
  }

  // low risk
  return [
    `This is really well put. Fully agree.`,
    sea ? `Alamak, finally someone said it! Lah this is so real.` : `This is exactly the kind of content I follow this account for.`,
    `Sharing this with my whole team. So good.`,
    `This resonates deeply. Thank you for posting.`,
    `100%. No notes.`,
    sea ? `Wah very good point sia, more people need to see this.` : `More people need to see this. Bookmarked.`,
    `This is beautifully said. The nuance here is appreciated.`,
    `"${preview}" — exactly this. Couldn't have said it better.`,
    `I've been thinking about this for ages and you nailed it.`,
    `Love this perspective. Following.`,
    `Not sure I fully agree on every point but this is a good conversation starter.`,
    `Hmm, interesting. What about [edge case]? Curious your take.`,
    sea ? `Quite true leh, but got one part I not so sure about.` : `The first half is great, the second part I'm less sure about.`,
    `Thoughtful post. A bit too optimistic but I appreciate the framing.`,
    `Good take overall, though I'd push back on the framing slightly.`,
  ]
}

// Demo classifier: uses synthesis-driven expectations + simple heuristics
// Classifies relative to the post (supporting the poster vs criticizing them)
function demoCategorize(
  text: string,
  synthesis: SynthesisResult,
): Pick<GeneratedComment, 'risk' | 'category'> {
  const lower = text.toLowerCase()

  // Urgent signals: threats, doxxing, reporting, platform action
  if (
    lower.includes('employer') ||
    lower.includes('screenshotting') ||
    lower.includes('reporting this') ||
    lower.includes('real harm') ||
    lower.includes('take it down') ||
    lower.includes('shouldn\'t be on this platform')
  ) {
    return { risk: 'high', category: 'urgent' }
  }

  // Abuse: hostile, personal attacks, dismissive
  if (
    lower.includes('ratio') ||
    lower.includes('audacity') ||
    lower.includes('toxic') ||
    lower.includes('people like you') ||
    lower.includes('unfollowing') ||
    lower.includes('cannot lah') ||
    lower.includes('fired') ||
    lower.includes('tone deaf') ||
    lower.includes('unreal') ||
    lower.includes('wah lao')
  ) {
    return { risk: 'high', category: 'abuse' }
  }

  // Support: agrees with, praises, shares
  if (
    lower.includes('fully agree') ||
    lower.includes('100%') ||
    lower.includes('finally someone said') ||
    lower.includes('sharing this') ||
    lower.includes('well put') ||
    lower.includes('resonates') ||
    lower.includes('bookmarked') ||
    lower.includes('saving this') ||
    lower.includes('no notes') ||
    lower.includes('nailed it') ||
    lower.includes('beautiful') ||
    lower.includes('shiok') ||
    lower.includes('so real')
  ) {
    return { risk: 'low', category: 'support' }
  }

  // Default: constructive (mild pushback, questions, nuanced)
  // Risk level based on synthesis — a medium/high risk post makes even neutral comments riskier
  const risk = synthesis.risk_level === 'high' ? 'medium' : 'low'
  return { risk, category: 'constructive' }
}

async function generateCommentWave(
  postText: string,
  personas: PersonaReaction[],
  synthesis: SynthesisResult,
  region: Region,
): Promise<string[]> {
  if (isDemoMode()) {
    return buildDemoCommentWave(postText, synthesis, region)
  }

  const personaSummary = personas
    .map((p) => `${p.name}: ${p.tone} tone, ${p.risk} risk — ${p.reasoning}`)
    .join('\n')

  // Derive realistic distribution from risk level
  const distribution =
    synthesis.risk_level === 'high'
      ? '~7 critical/hostile, ~4 neutral/questioning, ~4 supportive'
      : synthesis.risk_level === 'medium'
        ? '~5 critical/questioning, ~5 neutral, ~5 supportive'
        : '~3 critical, ~4 neutral/questioning, ~8 supportive'

  const prompt = `You are simulating the realistic comment section for a social media post.

Post: "${postText}"
Risk assessment: ${synthesis.risk_level} risk — ${synthesis.what_could_go_wrong}
Audience reactions:
${personaSummary}
Region: ${region === 'singapore' ? 'Singapore/SEA — include Singlish naturally where authentic' : 'Global'}

Generate exactly 15 realistic comments that this specific post would actually receive.
Distribution: ${distribution}

Rules:
- Every comment must be a reaction to THIS specific post — reference its actual content or claims
- NO generic comments that could apply to any post
- NO spam or bot comments
- Critical comments should challenge the post's argument specifically
- Supportive comments should agree with the post's specific point
- Varied length, casual internet tone, occasional typos ok
- ${region === 'singapore' ? 'Naturally mix in Singlish for some comments' : ''}

Return JSON only — array of 15 strings:
["comment 1", "comment 2", ...]`

  try {
    const raw = await callModel(prompt, 1500)
    const extracted = extractJsonArray(raw)
    if (!extracted) return buildDemoCommentWave(postText, synthesis, region)
    const parsed = JSON.parse(extracted) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed as string[]
    }
  } catch {
    // fall through to demo
  }
  return buildDemoCommentWave(postText, synthesis, region)
}

// Classifies in the context of the post — is this comment supporting the poster or criticising them?
async function classifyComment(
  text: string,
  postText: string,
  synthesis: SynthesisResult,
): Promise<Pick<GeneratedComment, 'risk' | 'category'>> {
  const fallback: Pick<GeneratedComment, 'risk' | 'category'> = {
    risk: 'medium',
    category: 'constructive',
  }

  if (isDemoMode()) {
    return demoCategorize(text, synthesis)
  }

  try {
    const prompt = `You are a content moderation classifier. Classify the comment below in the context of the original post.

Original post: "${postText}"
Comment: "${text}"

Determine:
1. Does this comment SUPPORT the poster's view, or CRITICISE/ATTACK it?
2. How harmful is it to the poster's reputation?

Categories (pick exactly one):
- support: agrees with, defends, or praises the original post
- constructive: neutral question, mild disagreement, no hostility
- abuse: hostile attack on the poster, mocking, dismissive, personal
- urgent: threats, doxxing attempts, calls to report/deplatform, claims of serious harm caused

Risk:
- low: no reputational threat
- medium: some pushback, minor negative signal
- high: serious threat to poster's reputation or safety

Return JSON only:
{"risk": "low|medium|high", "category": "support|constructive|abuse|urgent"}`

    const raw = await callModel(prompt, 100)
    const extracted = extractFirstJsonObject(raw)
    if (!extracted) return fallback

    const parsed = JSON.parse(extracted) as unknown
    if (!isRecord(parsed)) return fallback

    const riskValues = ['low', 'medium', 'high']
    const categoryValues = ['support', 'constructive', 'abuse', 'urgent']

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
  const supportCount = comments.filter((c) => c.category === 'support').length
  const riskScore = Math.max(
    0,
    Math.min(100, abuseCount * 15 + urgentCount * 20 - supportCount * 2),
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
        supportCount,
      }
    }
    return {
      action: 'post-safe',
      riskScore,
      reasoning: `Comment wave analysis shows ${supportCount} supportive reactions outweigh negative signals. Risk score ${riskScore}/100 is within the acceptable threshold of ${threshold}. Post is safe to remain live.`,
      abuseCount,
      urgentCount,
      supportCount,
    }
  }

  const prompt = `You are an autonomous content moderation agent making a final decision.

Original post: "${postText}"
Pre-post risk assessment: ${synthesis.risk_level} risk — "${synthesis.what_could_go_wrong}"
Comment analysis: ${abuseCount} abusive, ${urgentCount} urgent/serious, ${supportCount} supportive
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

    return { action, riskScore, reasoning, abuseCount, urgentCount, supportCount }
  } catch {
    return {
      action: riskScore >= threshold ? 'take-down' : 'post-safe',
      riskScore,
      reasoning: `Autonomous decision based on risk score ${riskScore}/100. ${riskScore >= threshold ? 'Takedown initiated.' : 'Post remains live.'}`,
      abuseCount,
      urgentCount,
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

  const rawComments = await generateCommentWave(postText, personas, synthesis, region)

  log('Agent 7', `Generated ${rawComments.length} comments — beginning classification`, 'success')
  state = { ...state, currentAgent: 8 }
  onProgress({ ...state })
  if (demo) await sleep(500)

  // ── Agent 8 — Classify each comment, with early-exit if threshold crossed ─
  let earlyExited = false

  for (let i = 0; i < rawComments.length; i++) {
    const text = rawComments[i]
    const { risk, category } = await classifyComment(text, postText, synthesis)

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
