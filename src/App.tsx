import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import ComposePage from './ComposePage'
import PipelinePage from './PipelinePage'
import ResultsPage from './ResultsPage'
import RewriteModal from './RewriteModal'
import {
  PERSONA_ORDER,
  buildFallbackReaction,
  buildFallbackSynthesis,
  getAgnesConfigError,
  isDemoMode,
  runSynthesisAgent,
  simulatePersona,
  rewritePost,
} from './services/agnesApi'
import type {
  PersonaCardState,
  PersonaName,
  PersonaReaction,
  Platform,
  Region,
  SynthesisResult,
} from './types/personas'
import type { AutonomousPipelineState } from './types/monitor'
import './App.css'

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

function createInitialPipelineState(threshold = 60): AutonomousPipelineState {
  return {
    status: 'running',
    currentAgent: 7,
    generatedComments: [],
    riskScore: 0,
    threshold,
    decision: null,
    agentLog: [],
    startedAt: null,
    completedAt: null,
  }
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
  const [view, setView] = useState<'compose' | 'results' | 'pipeline'>('compose')
  const [completedPersonas, setCompletedPersonas] = useState<PersonaReaction[]>([])
  const [completedSynthesis, setCompletedSynthesis] = useState<SynthesisResult | null>(null)
  const [threshold, setThreshold] = useState(60)
  const [pipelineState, setPipelineState] = useState<AutonomousPipelineState>(
    () => createInitialPipelineState(60),
  )
  const [showRewriteModal, setShowRewriteModal] = useState(false)
  const [rewrittenText, setRewrittenText] = useState<string | null>(null)
  const [isRewriting, setIsRewriting] = useState(false)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
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

  const runAnalysis = async (
    nextText: string,
    nextPlatform: Platform,
    nextRegion: Region,
    imageBase64?: string,
  ) => {
    const trimmedInput = nextText.trim()
    if (!trimmedInput) {
      return
    }

    const runId = runIdRef.current + 1
    runIdRef.current = runId

    setSubmittedText(trimmedInput)
    setLastPlatform(nextPlatform)
    setLastRegion(nextRegion)
    setPersonaStates(createLoadingPersonaStates())
    setSynthesis(null)
    setCompletedPersonas([])
    setCompletedSynthesis(null)
    setPipelineState(createInitialPipelineState())
    setErrorMessage(null)
    setIsAnalyzing(true)
    setIsSynthesizing(true)
    setView('results')

    try {
      const personaPromises = PERSONA_ORDER.map((personaName) =>
        simulatePersona(personaName, trimmedInput, nextPlatform, nextRegion, imageBase64 ?? undefined)
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
      setCompletedPersonas(reactions)
      setCompletedSynthesis(nextSynthesis)
    } finally {
      if (runIdRef.current === runId) {
        setIsAnalyzing(false)
        setIsSynthesizing(false)
      }
    }
  }

  // Issue #7: update persona cards incrementally while the full Promise.all batch resolves.
  const handleAnalyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await runAnalysis(input, platform, region, uploadedImage ?? undefined)
  }

  const handleReAnalyze = async () => {
    await runAnalysis(submittedText, lastPlatform, lastRegion)
  }

  const handleExampleSelect = (post: string) => {
    setInput(post)
  }

  const handleRunPipeline = () => {
    setPipelineState(createInitialPipelineState(threshold))
    setView('pipeline')
  }

  const handleAiRewrite = async () => {
    if (!completedSynthesis || !submittedText) return
    setIsRewriting(true)
    setShowRewriteModal(true)
    setRewrittenText(null)
    try {
      const result = await rewritePost(
        submittedText,
        lastPlatform,
        lastRegion,
        completedSynthesis,
        completedPersonas,
      )
      setRewrittenText(result)
    } catch {
      setRewrittenText('Agnes could not generate a rewrite. Please try again.')
    } finally {
      setIsRewriting(false)
    }
  }

  const handleAcceptRewrite = (text: string) => {
    setInput(text)
    setShowRewriteModal(false)
    setRewrittenText(null)
    setView('compose')
  }

  const canRunPipeline = completedSynthesis !== null

  return (
    <main className="app-shell">
      {showRewriteModal && (
        <RewriteModal
          originalText={submittedText}
          rewrittenText={rewrittenText ?? ''}
          isLoading={isRewriting}
          onAccept={handleAcceptRewrite}
          onDismiss={() => { setShowRewriteModal(false); setRewrittenText(null) }}
        />
      )}
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
          uploadedImage={uploadedImage}
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
          onImageUpload={setUploadedImage}
          onImageClear={() => setUploadedImage(null)}
        />
      ) : view === 'results' ? (
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
          onReAnalyze={handleReAnalyze}
          onRunPipeline={canRunPipeline ? handleRunPipeline : undefined}
          onAiRewrite={completedSynthesis ? handleAiRewrite : undefined}
          isRewriting={isRewriting}
        />
      ) : completedSynthesis ? (
        <PipelinePage
          postText={submittedText}
          platform={lastPlatform}
          region={lastRegion}
          personas={completedPersonas}
          synthesis={completedSynthesis}
          pipelineState={pipelineState}
          threshold={threshold}
          onThresholdChange={setThreshold}
          onProgress={setPipelineState}
          onBack={() => setView('results')}
        />
      ) : null}
    </main>
  )
}

export default App
