import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ComposePage from './ComposePage'
import ResultsPage from './ResultsPage'
import {
  PERSONA_ORDER,
  buildFallbackReaction,
  buildFallbackSynthesis,
  getAgnesConfigError,
  isDemoMode,
  runSynthesisAgent,
  simulatePersona,
} from './services/agnesApi'
import type {
  PersonaName,
  PersonaReaction,
  Platform,
  Region,
  SynthesisResult,
} from './types/personas'
import './App.css'

type PersonaCardState = {
  name: PersonaName
  status: 'idle' | 'loading' | 'ready'
  reaction: PersonaReaction | null
}

const EXAMPLE_POSTS = [
  'Hot take: degrees are becoming useless. The best developers I know are self-taught. Universities are just expensive networking events at this point.',
  "Excited to announce I'm leaving my stable job to pursue content creation full time! Life is too short to not bet on yourself 🚀",
  "Our new product launch was a disaster. We're being honest with our community — here's what went wrong and what we're doing to fix it.",
]

function createIdlePersonaStates(): PersonaCardState[] {
  return PERSONA_ORDER.map((name) => ({
    name,
    status: 'idle',
    reaction: null,
  }))
}

function createLoadingPersonaStates(): PersonaCardState[] {
  return PERSONA_ORDER.map((name) => ({
    name,
    status: 'loading',
    reaction: null,
  }))
}

function App() {
  const [input, setInput] = useState('')
  const [platform, setPlatform] = useState<Platform>('twitter')
  const [region, setRegion] = useState<Region>('singapore')
  const [submittedText, setSubmittedText] = useState('')
  const [lastPlatform, setLastPlatform] = useState<Platform>('twitter')
  const [lastRegion, setLastRegion] = useState<Region>('singapore')
  const [personaStates, setPersonaStates] =
    useState<PersonaCardState[]>(createIdlePersonaStates())
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [view, setView] = useState<'compose' | 'results'>('compose')
  const runIdRef = useRef(0)

  const hasLatestResults = submittedText.trim().length > 0
  const configError = getAgnesConfigError()
  const demoMode = isDemoMode()

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [view])

  const updatePersonaCard = (
    runId: number,
    personaName: PersonaName,
    reaction: PersonaReaction,
  ) => {
    if (runIdRef.current !== runId) {
      return
    }

    setPersonaStates((current) =>
      current.map((entry) =>
        entry.name === personaName
          ? { name: personaName, status: 'ready', reaction }
          : entry,
      ),
    )
  }

  // Issue #7: update persona cards incrementally while the full Promise.all batch resolves.
  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput) {
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    setSubmittedText(trimmedInput)
    setLastPlatform(platform)
    setLastRegion(region)
    setPersonaStates(createLoadingPersonaStates())
    setSynthesis(null)
    setErrorMessage(null)
    setIsAnalyzing(true)
    setIsSynthesizing(true)
    setView('results')

    try {
      const personaPromises = PERSONA_ORDER.map((personaName) =>
        simulatePersona(personaName, trimmedInput, platform, region)
          .then((reaction) => {
            updatePersonaCard(runId, personaName, reaction)
            return reaction
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : 'A persona agent could not complete its run.'

            const fallback = buildFallbackReaction(personaName, message)
            updatePersonaCard(runId, personaName, fallback)

            setErrorMessage((current) => current ?? message)
            return fallback
          }),
      )

      const reactions = await Promise.all(personaPromises)

      if (runIdRef.current !== runId) {
        return
      }

      const nextSynthesis = await runSynthesisAgent(trimmedInput, reactions).catch(
        (error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : 'The synthesis agent could not complete its run.'
          setErrorMessage((current) => current ?? message)
          return buildFallbackSynthesis(message)
        },
      )

      if (runIdRef.current !== runId) {
        return
      }

      setSynthesis(nextSynthesis)
    } finally {
      if (runIdRef.current === runId) {
        setIsAnalyzing(false)
        setIsSynthesizing(false)
      }
    }
  }

  const handleExampleSelect = (post: string) => {
    setInput(post)
  }

  return (
    <main className="app-shell">
      {view === 'compose' ? (
        <ComposePage
          input={input}
          platform={platform}
          region={region}
          demoMode={demoMode}
          isAnalyzing={isAnalyzing}
          canViewResults={hasLatestResults}
          noticeMessage={errorMessage ?? configError}
          examplePosts={EXAMPLE_POSTS}
          onInputChange={setInput}
          onPlatformChange={setPlatform}
          onRegionToggle={() =>
            setRegion((current) =>
              current === 'singapore' ? 'global' : 'singapore',
            )
          }
          onAnalyze={handleAnalyze}
          onViewResults={() => setView('results')}
          onExampleSelect={handleExampleSelect}
        />
      ) : (
        <ResultsPage
          submittedText={submittedText}
          platform={lastPlatform}
          region={lastRegion}
          personaStates={personaStates}
          synthesis={synthesis}
          isAnalyzing={isAnalyzing}
          isSynthesizing={isSynthesizing}
          errorMessage={errorMessage}
          onBackToEditor={() => setView('compose')}
        />
      )}
    </main>
  )
}

export default App
