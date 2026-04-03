import { useState } from 'react'
import type { FormEvent } from 'react'
import ComposePage from './ComposePage'
import ResultsPage from './ResultsPage'
import { buildMockAnalysis } from './mockAnalysis'
import type { AnalysisResult } from './types'
import './App.css'

function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [view, setView] = useState<'compose' | 'results'>('compose')

  const handleAnalyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (!trimmedInput) {
      return
    }

    setResult(buildMockAnalysis(trimmedInput))
    setView('results')
  }

  return (
    <main className="app-shell">
      {view === 'compose' ? (
        <ComposePage
          input={input}
          result={result}
          onInputChange={setInput}
          onAnalyze={handleAnalyze}
          onViewResults={() => setView('results')}
        />
      ) : (
        <ResultsPage result={result} onBackToEditor={() => setView('compose')} />
      )}
    </main>
  )
}

export default App
