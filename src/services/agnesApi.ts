import { PERSONA_ORDER } from '../types/personas'
import type {
  PersonaName,
  PersonaReaction,
  Platform,
  Region,
  RiskLevel,
  SimulationResult,
  SynthesisResult,
  ToneLevel,
} from '../types/personas'

// Issue #7/#8: Agnes-Claw runs each audience persona as a separate agent call.
const BASE_URL =
  import.meta.env.VITE_AGNES_BASE_URL || 'https://api.anthropic.com'
const API_KEY = import.meta.env.VITE_AGNES_API_KEY || ''
const MODEL = import.meta.env.VITE_AGNES_MODEL || 'claude-sonnet-4-6'
const REQUEST_TIMEOUT_MS = 30_000

type JsonRecord = Record<string, unknown>

type OpenAICompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
}

type AnthropicResponse = {
  content?: Array<{ type?: string; text?: string }>
}

const PERSONA_DESCRIPTIONS: Record<PersonaName, string> = {
  'Loyal Fan':
    'Your biggest supporter. Interprets everything charitably. Enthusiastic but genuine.',
  'Skeptical Stranger':
    'Sees this for the first time with no goodwill. Reads it literally at face value.',
  'The Critic':
    'Actively looking for something to push back on. Sharp, adversarial by habit.',
  'Brand / Sponsor':
    'A professional or employer reading this. Risk-averse, conservative, formal.',
  'Casual Scroller':
    'Barely reading. Reacts to vibes, not content. Quick gut reaction.',
}

const SEA_CONTEXT =
  'The user is Singaporean. Generate a comment that reflects SEA internet culture — including Singlish, local references, and regional sensitivities where authentic and natural.'

const DEMO_DELAY_MS: Record<PersonaName, number> = {
  'Loyal Fan': 320,
  'Skeptical Stranger': 540,
  'The Critic': 760,
  'Brand / Sponsor': 980,
  'Casual Scroller': 1180,
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function isPersonaName(value: unknown): value is PersonaName {
  return PERSONA_ORDER.includes(value as PersonaName)
}

function isToneLevel(value: unknown): value is ToneLevel {
  return (
    value === 'warm' ||
    value === 'neutral' ||
    value === 'skeptical' ||
    value === 'hostile'
  )
}

function isRiskLevel(value: unknown): value is RiskLevel {
  return value === 'low' || value === 'medium' || value === 'high'
}

function isRecommendation(
  value: unknown,
): value is SynthesisResult['recommendation'] {
  return value === 'post' || value === 'edit' || value === 'reconsider'
}

function getApiKeyError(): string | null {
  return API_KEY.trim() ? null : 'Please set your API key in .env'
}

export function getAgnesConfigError(): string | null {
  return getApiKeyError()
}

export function isDemoMode(): boolean {
  return !API_KEY.trim()
}

function normalizeBaseUrl(): string {
  return BASE_URL.replace(/\/+$/, '')
}

function resolveUrl(path: string): string {
  const base = normalizeBaseUrl()

  if (base.endsWith(path)) {
    return base
  }

  if (base.endsWith('/v1') && path.startsWith('v1/')) {
    return `${base}/${path.slice(3)}`
  }

  return `${base}/${path}`
}

function extractApiError(status: number, responseText: string): string {
  const trimmed = responseText.trim()
  if (!trimmed) {
    return `Request failed with status ${status}.`
  }

  const extracted = extractJsonObject(trimmed)
  if (!extracted) {
    return trimmed
  }

  try {
    const parsed = JSON.parse(extracted) as unknown
    if (isRecord(parsed)) {
      if (typeof parsed.error === 'string') {
        return parsed.error
      }
      if (isRecord(parsed.error) && typeof parsed.error.message === 'string') {
        return parsed.error.message
      }
      if (typeof parsed.message === 'string') {
        return parsed.message
      }
    }
  } catch {
    return trimmed
  }

  return trimmed
}

function extractTextFromContent(
  content: string | Array<{ type?: string; text?: string }> | undefined,
): string {
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .map((entry) => (typeof entry.text === 'string' ? entry.text : ''))
    .join('\n')
}

async function callModel(prompt: string): Promise<string> {
  const configError = getApiKeyError()
  if (configError) {
    throw new Error(configError)
  }

  const isAnthropic = normalizeBaseUrl().includes('anthropic')
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(
      isAnthropic
        ? resolveUrl('v1/messages')
        : resolveUrl('v1/chat/completions'),
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
                max_tokens: 600,
                messages: [{ role: 'user', content: prompt }],
              }
            : {
                model: MODEL,
                temperature: 0.6,
                messages: [{ role: 'user', content: prompt }],
              },
        ),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(extractApiError(response.status, errorText))
    }

    const payload = (await response.json()) as unknown

    if (isAnthropic) {
      const data = payload as AnthropicResponse
      const text = extractTextFromContent(data.content)
      if (!text.trim()) {
        throw new Error('The Agnes response was empty.')
      }

      return text
    }

    const data = payload as OpenAICompletionResponse
    const text = extractTextFromContent(data.choices?.[0]?.message?.content)
    if (!text.trim()) {
      throw new Error('The Agnes response was empty.')
    }

    return text
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out after 30 seconds. Please try again.')
    }

    if (error instanceof Error) {
      throw error
    }

    throw new Error('The Agnes request failed unexpectedly.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}

function extractJsonObject(text: string): string | null {
  let depth = 0
  let start = -1
  let inString = false
  let escaping = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (escaping) {
      escaping = false
      continue
    }

    if (char === '\\') {
      escaping = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        start = index
      }
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0 && start !== -1) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

function parseRecoveredJson(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown
  } catch {
    const extracted = extractJsonObject(text)
    if (!extracted) {
      return null
    }

    try {
      return JSON.parse(extracted) as unknown
    } catch {
      return null
    }
  }
}

function buildFallbackReaction(
  personaName: PersonaName,
  reason = 'The model response could not be parsed cleanly.',
): PersonaReaction {
  return {
    name: personaName,
    comment: `${personaName} could not return a clean structured comment.`,
    tone: 'neutral',
    reasoning: reason,
    risk: 'medium',
  }
}

function buildFallbackSynthesis(
  reason = 'The synthesis response could not be parsed cleanly.',
): SynthesisResult {
  return {
    risk_level: 'medium',
    what_could_go_wrong: reason,
    who_amplifies: 'A skeptical audience could share the post without the intended context.',
    headline_risk: 'Draft post draws criticism after context is lost online.',
    recommendation: 'edit',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function buildPreview(text: string): string {
  return text.length > 110 ? `${text.slice(0, 107)}...` : text
}

function buildDemoReaction(
  personaName: PersonaName,
  postText: string,
  region: Region,
): PersonaReaction {
  const preview = buildPreview(postText)
  const seaTag = region === 'singapore' ? ' Lah, people here will read the vibe fast.' : ''

  switch (personaName) {
    case 'Loyal Fan':
      return {
        name: personaName,
        comment: `This feels bold and authentic. "${preview}" sounds like someone being real, not overly polished.${seaTag}`,
        tone: 'warm',
        reasoning: 'Supportive audiences usually reward honesty and conviction when the message feels personal.',
        risk: 'low',
      }
    case 'Skeptical Stranger':
      return {
        name: personaName,
        comment:
          'I get the point, but I would still want more context before I fully buy into it.',
        tone: 'neutral',
        reasoning: 'A cold audience tends to read literal claims first and trust the message only if specifics are obvious.',
        risk: 'medium',
      }
    case 'The Critic':
      return {
        name: personaName,
        comment:
          'This could easily invite pushback if people feel the wording is too sweeping or overconfident.',
        tone: 'hostile',
        reasoning: 'Critical readers look for overreach, blind spots, and emotionally loaded phrasing they can challenge.',
        risk: 'high',
      }
    case 'Brand / Sponsor':
      return {
        name: personaName,
        comment:
          'From a brand-safety angle, the post has energy, but it may need cleaner framing before it feels low-risk.',
        tone: 'skeptical',
        reasoning: 'Professional stakeholders usually react to ambiguity and screenshot risk more than to personality.',
        risk: 'medium',
      }
    case 'Casual Scroller':
      return {
        name: personaName,
        comment:
          region === 'singapore'
            ? 'First impression: quite spicy, maybe a bit drama, but people will stop and read.'
            : 'Quick vibe check: catchy, slightly risky, definitely something people would pause on.',
        tone: 'skeptical',
        reasoning: 'Fast-scrolling audiences react to emotional tone and shareability before they process nuance.',
        risk: 'medium',
      }
  }
}

function buildDemoSynthesis(
  postText: string,
  reactions: PersonaReaction[],
): SynthesisResult {
  const highRiskCount = reactions.filter((entry) => entry.risk === 'high').length
  const mediumRiskCount = reactions.filter(
    (entry) => entry.risk === 'medium',
  ).length
  const likelyRisk = highRiskCount > 0 ? 'high' : mediumRiskCount > 1 ? 'medium' : 'low'

  if (likelyRisk === 'high') {
    return {
      risk_level: 'high',
      what_could_go_wrong:
        'People could screenshot the post as arrogant, reductive, or insensitive if the framing lands more sharply than intended.',
      who_amplifies:
        'Critics, quote-tweet accounts, and anyone already skeptical of the take could amplify it negatively.',
      headline_risk:
        'Creator faces backlash after blunt social post sparks criticism online.',
      recommendation: 'reconsider',
    }
  }

  if (likelyRisk === 'medium') {
    return {
      risk_level: 'medium',
      what_could_go_wrong:
        'The post may be interpreted differently by neutral readers, especially if they do not already share your context.',
      who_amplifies:
        'Skeptical strangers and casual scrollers are the most likely to pass along the sharpest interpretation.',
      headline_risk:
        'Post draws mixed reactions as audiences debate the intent behind the wording.',
      recommendation: 'edit',
    }
  }

  return {
    risk_level: 'low',
    what_could_go_wrong:
      'There is limited immediate PR risk, though mild confusion is still possible if context is missing.',
    who_amplifies:
      'Mostly supporters or existing followers rather than hostile audiences.',
    headline_risk: `Low-risk post about "${buildPreview(postText)}" stays largely well received.`,
    recommendation: 'post',
  }
}

function sanitizePersonaReaction(
  payload: unknown,
  personaName: PersonaName,
): PersonaReaction | null {
  if (!isRecord(payload)) {
    return null
  }

  const name = isPersonaName(payload.name) ? payload.name : personaName
  const comment = typeof payload.comment === 'string' ? payload.comment : null
  const tone = isToneLevel(payload.tone) ? payload.tone : null
  const reasoning =
    typeof payload.reasoning === 'string' ? payload.reasoning : null
  const risk = isRiskLevel(payload.risk) ? payload.risk : null

  if (!comment || !tone || !reasoning || !risk) {
    return null
  }

  return {
    name,
    comment,
    tone,
    reasoning,
    risk,
  }
}

function sanitizeSynthesis(payload: unknown): SynthesisResult | null {
  if (!isRecord(payload)) {
    return null
  }

  const riskLevel = isRiskLevel(payload.risk_level) ? payload.risk_level : null
  const wrong =
    typeof payload.what_could_go_wrong === 'string'
      ? payload.what_could_go_wrong
      : null
  const amplifies =
    typeof payload.who_amplifies === 'string' ? payload.who_amplifies : null
  const headline =
    typeof payload.headline_risk === 'string' ? payload.headline_risk : null
  const recommendation = isRecommendation(payload.recommendation)
    ? payload.recommendation
    : null

  if (!riskLevel || !wrong || !amplifies || !headline || !recommendation) {
    return null
  }

  return {
    risk_level: riskLevel,
    what_could_go_wrong: wrong,
    who_amplifies: amplifies,
    headline_risk: headline,
    recommendation,
  }
}

function buildPersonaPrompt(
  personaName: PersonaName,
  postText: string,
  platform: Platform,
  region: Region,
): string {
  const seaContext = region === 'singapore' ? SEA_CONTEXT : ''

  return `You are simulating a specific social media user reacting to a draft post.

Persona: ${personaName}
Platform: ${platform}
Draft post: "${postText}"
${seaContext}

Persona descriptions:
- Loyal Fan: ${PERSONA_DESCRIPTIONS['Loyal Fan']}
- Skeptical Stranger: ${PERSONA_DESCRIPTIONS['Skeptical Stranger']}
- The Critic: ${PERSONA_DESCRIPTIONS['The Critic']}
- Brand / Sponsor: ${PERSONA_DESCRIPTIONS['Brand / Sponsor']}
- Casual Scroller: ${PERSONA_DESCRIPTIONS['Casual Scroller']}

Respond ONLY with valid JSON (no markdown, no preamble):
{"name": "${personaName}", "comment": "...", "tone": "warm|neutral|skeptical|hostile", "reasoning": "one sentence explaining the reaction", "risk": "low|medium|high"}`
}

function buildSynthesisPrompt(
  postText: string,
  reactions: PersonaReaction[],
): string {
  return `You are a PR risk analyst. Five audience personas have reacted to a draft social media post.

Original post: "${postText}"

Reactions:
${JSON.stringify(reactions, null, 2)}

Reason through this carefully:
1. What specifically could go wrong if this is posted?
2. Who would screenshot or amplify this negatively?
3. What negative headline could form from this?
4. What is the overall risk level?

Respond ONLY with valid JSON (no markdown, no preamble):
{"risk_level": "low|medium|high", "what_could_go_wrong": "...", "who_amplifies": "...", "headline_risk": "...", "recommendation": "post|edit|reconsider"}`
}

export async function simulatePersona(
  personaName: PersonaName,
  postText: string,
  platform: Platform,
  region: Region,
): Promise<PersonaReaction> {
  if (isDemoMode()) {
    await sleep(DEMO_DELAY_MS[personaName])
    return buildDemoReaction(personaName, postText, region)
  }

  const raw = await callModel(
    buildPersonaPrompt(personaName, postText, platform, region),
  )
  const parsed = parseRecoveredJson(raw)
  const reaction = sanitizePersonaReaction(parsed, personaName)

  if (reaction) {
    return reaction
  }

  return buildFallbackReaction(
    personaName,
    'The persona agent answered, but the JSON shape was invalid.',
  )
}

export async function runSynthesisAgent(
  postText: string,
  reactions: PersonaReaction[],
): Promise<SynthesisResult> {
  if (isDemoMode()) {
    await sleep(500)
    return buildDemoSynthesis(postText, reactions)
  }

  const raw = await callModel(buildSynthesisPrompt(postText, reactions))
  const parsed = parseRecoveredJson(raw)
  const synthesis = sanitizeSynthesis(parsed)

  if (synthesis) {
    return synthesis
  }

  return buildFallbackSynthesis(
    'The synthesis agent answered, but the JSON shape was invalid.',
  )
}

export async function runFullSimulation(
  postText: string,
  platform: Platform,
  region: Region,
): Promise<SimulationResult> {
  const personas = await Promise.all(
    PERSONA_ORDER.map((personaName) =>
      simulatePersona(personaName, postText, platform, region),
    ),
  )
  const synthesis = await runSynthesisAgent(postText, personas)

  return { personas, synthesis }
}

export { buildFallbackReaction, buildFallbackSynthesis, PERSONA_ORDER }
