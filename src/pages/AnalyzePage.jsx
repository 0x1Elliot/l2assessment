import { useState, useEffect } from 'react'
import RoutingDecision from '../components/RoutingDecision'
import { dispositionLabel } from '../utils/routingLabels'

function AnalyzePage() {
  const [message, setMessage] = useState(() => localStorage.getItem('exampleMessage') || '')
  const [results, setResults] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    localStorage.removeItem('exampleMessage')
  }, [])

  const handleAnalyze = async () => {
    if (!message.trim()) {
      setError('Enter a customer message to analyze.')
      return
    }

    setIsLoading(true)
    setResults(null)
    setError('')

    try {
      const response = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const decision = await response.json()
      if ((!response.ok && decision.disposition !== 'invalid_input') || !decision.requestId) {
        throw new Error('No routing decision received')
      }

      const analysisResult = { ...decision, message }
      setResults(analysisResult)
      if (decision.disposition !== 'invalid_input') {
        try {
          const history = JSON.parse(localStorage.getItem('triageHistory') || '[]')
          history.push(analysisResult)
          localStorage.setItem('triageHistory', JSON.stringify(history))
        } catch {
          setError('The routing decision could not be saved to history.')
        }
      }
    } catch {
      setError('Human review required · ROUTING_API_UNAVAILABLE. The server decision could not be retrieved.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    setMessage('')
    setResults(null)
    setError('')
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Analyze Customer Message</h1>
          <p className="text-gray-600 mb-6">
            Paste a customer support message below to check whether it needs review or qualifies for a routine recommendation.
          </p>

          {/* Input Section */}
          <div className="mb-4">
            <label htmlFor="customer-message" className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              id="customer-message"
              maxLength={4000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here..."
              className="w-full border border-gray-300 rounded-lg p-3 h-40 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            />
            <div className="text-sm text-gray-500 mt-1">
              {message.length} characters
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAnalyze}
              disabled={isLoading}
              className={`flex-1 py-3 rounded-lg font-semibold ${
                isLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                'Analyze Message'
              )}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-900">{error}</p>}

        {/* Results Section */}
        {results && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Analysis Results</h2>
            
            <RoutingDecision result={results} />

            {results.disposition !== 'invalid_input' && (
              <div className="mt-4 space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Category</div>
                  <div className="inline-block bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
                    {results.category}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Urgency Level</div>
                  <div className={`inline-block px-4 py-2 rounded-lg font-semibold ${
                    results.urgency === 'High' ? 'bg-red-200 text-red-900' :
                    results.urgency === 'Medium' ? 'bg-yellow-200 text-yellow-900' :
                    'bg-green-200 text-green-900'
                  }`}>
                    {results.urgency}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-gray-600 mb-1">Final Action</div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-gray-800">{results.recommendedAction}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={async () => {
                  const text = [
                    dispositionLabel(results.disposition),
                    `Reason code: ${results.reasonCode}`,
                    `Request ID: ${results.requestId}`,
                    results.category && `Category: ${results.category}`,
                    results.urgency && `Urgency: ${results.urgency}`,
                    results.recommendedAction && `Final action: ${results.recommendedAction}`,
                    results.reasoning,
                  ].filter(Boolean).join('\n')
                  try {
                    await navigator.clipboard.writeText(text)
                    alert('Results copied to clipboard!')
                  } catch {
                    setError('Results could not be copied to the clipboard.')
                  }
                }}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 font-semibold"
              >
                📋 Copy Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnalyzePage
